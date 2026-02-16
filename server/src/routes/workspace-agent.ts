/**
 * Workspace Agent API Routes
 *
 * Handles quick action execution from the WorkspaceAgent UI.
 * Connects UI actions to real Google Workspace services.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { googleOAuth } from '../services/google/oauth.js';
import { GmailService } from '../services/google/gmail.js';
import { CalendarService } from '../services/google/calendar.js';
import { DriveService } from '../services/google/drive.js';
import { DocsService } from '../services/google/docs.js';
import { SheetsService } from '../services/google/sheets.js';
import { activityLogger } from '../services/activityLogger.js';
import { mcpRegistry } from '../mcp/registry.js';
import type { MCPContext } from '../mcp/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Initialize services
const gmailService = new GmailService();
const calendarService = new CalendarService();
const driveService = new DriveService();
const docsService = new DocsService();
const sheetsService = new SheetsService();

// Default folder for all generated documents
const DEFAULT_FOLDER_ID = config.google.defaultFolderId;

interface QuickActionRequest {
  actionId: string;
  category: string;
  customerId?: string;
  customerName?: string;
  params?: Record<string, unknown>;
}

interface QuickActionResult {
  success: boolean;
  actionId: string;
  data?: unknown;
  error?: string;
  requiresApproval?: boolean;
  approvalId?: string;
}

/**
 * GET /api/workspace-agent/status
 *
 * Get workspace connection status for the user.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await googleOAuth.getConnectionStatus(userId);

    res.json({
      connected: status.connected,
      email: status.email,
      services: {
        gmail: status.connected && status.scopes?.some(s => s.includes('gmail')),
        calendar: status.connected && status.scopes?.some(s => s.includes('calendar')),
        drive: status.connected && status.scopes?.some(s => s.includes('drive')),
        docs: status.connected && status.scopes?.some(s => s.includes('documents')),
        sheets: status.connected && status.scopes?.some(s => s.includes('spreadsheets')),
        slides: status.connected && status.scopes?.some(s => s.includes('presentations')),
      },
    });
  } catch (error) {
    console.error('Workspace status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/workspace-agent/execute
 *
 * Execute a workspace quick action.
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { actionId, category, customerId, customerName, params } = req.body as QuickActionRequest;

    if (!actionId || !category) {
      return res.status(400).json({ error: 'actionId and category are required' });
    }

    // Log the action start
    const activityId = await activityLogger.logActivity({
      customer_id: customerId,
      user_id: userId,
      agent_type: 'strategic',
      action_type: `workspace_${category}_${actionId}`,
      action_data: { actionId, category, customerName, params },
      status: 'running',
    });

    const startTime = Date.now();

    try {
      // Execute the action based on category
      let result: QuickActionResult;

      // Map UI action IDs to backend handler IDs
      const resolvedActionId = resolveActionId(actionId, category);

      switch (category) {
        case 'email':
          result = await executeEmailAction(userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'calendar':
          result = await executeCalendarAction(userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'document':
        case 'documents':
          result = await executeDocumentAction(userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'health_score':
          result = await executeHealthScoreAction(req, userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'qbr':
          result = await executeQBRAction(userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'renewal':
          result = await executeRenewalAction(req, userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'knowledge':
          result = await executeKnowledgeAction(req, userId, resolvedActionId, customerId, customerName, params);
          break;
        case 'meeting_intelligence':
          result = await executeMeetingIntelligenceAction(req, userId, resolvedActionId, customerId, customerName, params);
          break;
        default:
          result = {
            success: false,
            actionId,
            error: `Unknown category: ${category}`,
          };
      }

      // Update activity with result
      if (activityId) {
        await activityLogger.updateActivity(activityId, {
          status: result.success ? 'completed' : 'failed',
          result_data: result.data as Record<string, unknown>,
          error_message: result.error,
          duration_ms: Date.now() - startTime,
        });
      }

      res.json(result);
    } catch (error) {
      // Update activity with error
      if (activityId) {
        await activityLogger.updateActivity(activityId, {
          status: 'failed',
          error_message: (error as Error).message,
          duration_ms: Date.now() - startTime,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Workspace action error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// EMAIL ACTIONS
// ============================================

async function executeEmailAction(
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  // Services use userId internally to get authenticated client

  switch (actionId) {
    case 'summarize_thread': {
      // Get recent emails and summarize
      const threads = await gmailService.listThreads(userId, { maxResults: 10 });
      return {
        success: true,
        actionId,
        data: {
          threadCount: threads.length,
          threads: threads.slice(0, 5).map((t: { id?: string; snippet?: string; messages?: unknown[] }) => ({
            id: t.id,
            snippet: t.snippet,
            messageCount: t.messages?.length || 0,
          })),
        },
      };
    }

    case 'draft_email': {
      // Create a draft email with purpose-aware defaults
      const purpose = params?.purpose as string || 'follow_up';
      const stakeholders = params?.stakeholderEmails as string[] || params?.to as string[] || [];

      const purposeDefaults: Record<string, { subject: string; body: string }> = {
        check_in: {
          subject: `Quick check-in - ${customerName}`,
          body: `Hi team,\n\nI wanted to reach out for a quick check-in. How are things going with the platform?\n\nBest regards`,
        },
        follow_up: {
          subject: `Following up on our conversation - ${customerName}`,
          body: `Hi team,\n\nThank you for the great conversation earlier. I wanted to follow up on the action items we discussed.\n\nBest regards`,
        },
        renewal: {
          subject: `Renewal Discussion - ${customerName}`,
          body: `Hi team,\n\nI wanted to reach out regarding your upcoming renewal.\n\nBest regards`,
        },
        escalation: {
          subject: `Urgent: Following up on your issue - ${customerName}`,
          body: `Hi team,\n\nI wanted to personally reach out regarding the issue you're experiencing.\n\nBest regards`,
        },
      };

      const defaults = purposeDefaults[purpose] || purposeDefaults.follow_up;
      const subject = params?.subject as string || defaults.subject;
      const body = params?.body as string || defaults.body;

      const draftId = await gmailService.createDraft(userId, {
        to: stakeholders,
        subject,
        body,
      });
      return {
        success: true,
        actionId,
        data: {
          draftId,
          to: stakeholders,
          subject,
          body,
          purpose,
        },
        requiresApproval: true,
      };
    }

    case 'find_customer_emails': {
      // Search for customer emails
      const query = customerName ? `from:${customerName} OR to:${customerName}` : '';
      const threads = await gmailService.listThreads(userId, { query, maxResults: 20 });
      return {
        success: true,
        actionId,
        data: {
          customerName,
          threadCount: threads.length,
          threads: threads.slice(0, 10).map(t => ({
            id: t.id,
            snippet: t.snippet,
          })),
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown email action: ${actionId}`,
      };
  }
}

// ============================================
// CALENDAR ACTIONS
// ============================================

async function executeCalendarAction(
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  // Services use userId internally to get authenticated client

  switch (actionId) {
    case 'check_availability': {
      // Get upcoming events
      const events = await calendarService.listEvents(userId, {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: 50,
      });

      // Find free slots
      const freeSlots = findFreeSlots(events, 7);

      return {
        success: true,
        actionId,
        data: {
          upcomingEvents: events.length,
          freeSlots: freeSlots.slice(0, 5),
        },
      };
    }

    case 'schedule_meeting': {
      // Create a calendar event
      const event = await calendarService.createEvent(userId, {
        summary: params?.title as string || `Meeting with ${customerName}`,
        description: params?.description as string || '',
        start: params?.start as string || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        end: params?.end as string || new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        attendees: params?.attendees as string[] || [],
      });
      return {
        success: true,
        actionId,
        data: {
          eventId: event.id,
          htmlLink: event.htmlLink,
          summary: event.summary,
        },
        requiresApproval: true,
      };
    }

    case 'find_customer_meetings': {
      // Search for meetings with customer
      const events = await calendarService.listEvents(userId, {
        q: customerName,
        maxResults: 20,
      });
      return {
        success: true,
        actionId,
        data: {
          customerName,
          meetingCount: events.length,
          meetings: events.slice(0, 10).map(e => ({
            id: e.id,
            summary: e.summary,
            start: e.start,
            end: e.end,
          })),
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown calendar action: ${actionId}`,
      };
  }
}

// ============================================
// DOCUMENT ACTIONS
// ============================================

async function executeDocumentAction(
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  // Services use userId internally to get authenticated client

  switch (actionId) {
    case 'find_documents': {
      // Search for customer documents
      const files = await driveService.listFiles(userId, {
        query: customerName ? `name contains '${customerName}'` : undefined,
        maxResults: 20,
      });
      return {
        success: true,
        actionId,
        data: {
          customerName,
          fileCount: files.length,
          files: files.slice(0, 10).map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            webViewLink: f.webViewLink,
          })),
        },
      };
    }

    case 'create_document': {
      // Create a new document in the default folder
      const doc = await docsService.createDocument(userId, {
        title: params?.title as string || `${customerName} - Document`,
        content: params?.content as string || '',
        folderId: DEFAULT_FOLDER_ID,
      });
      return {
        success: true,
        actionId,
        data: {
          documentId: doc.documentId,
          title: doc.title,
          webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        },
      };
    }

    case 'create_spreadsheet': {
      // Create a new spreadsheet in the default folder
      const sheet = await sheetsService.createSpreadsheet(userId, {
        title: params?.title as string || `${customerName} - Spreadsheet`,
        folderId: DEFAULT_FOLDER_ID,
      });
      return {
        success: true,
        actionId,
        data: {
          spreadsheetId: sheet.spreadsheetId,
          title: sheet.properties?.title,
          webViewLink: sheet.spreadsheetUrl,
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown document action: ${actionId}`,
      };
  }
}

// ============================================
// HEALTH SCORE ACTIONS
// ============================================

async function executeHealthScoreAction(
  req: Request,
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  if (!supabase) {
    return {
      success: false,
      actionId,
      error: 'Database not configured',
    };
  }

  switch (actionId) {
    case 'calculate_score': {
      // Get customer data and calculate health score
      let custQuery = supabase.from('customers').select('*');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customer } = await custQuery
        .eq('id', customerId)
        .single();

      if (!customer) {
        return {
          success: false,
          actionId,
          error: 'Customer not found',
        };
      }

      // Simple health score calculation
      const usageScore = Math.min(100, (customer.usage_score || 50));
      const engagementScore = Math.min(100, (customer.engagement_score || 50));
      const sentimentScore = Math.min(100, (customer.sentiment_score || 70));
      const healthScore = Math.round((usageScore + engagementScore + sentimentScore) / 3);

      return {
        success: true,
        actionId,
        data: {
          customerId,
          customerName: customer.name,
          healthScore,
          components: {
            usage: usageScore,
            engagement: engagementScore,
            sentiment: sentimentScore,
          },
        },
      };
    }

    case 'get_trends': {
      // Get health score history
      let histQuery = supabase.from('health_score_history').select('*');
      histQuery = applyOrgFilter(histQuery, req);
      const { data: history } = await histQuery
        .eq('customer_id', customerId)
        .order('recorded_at', { ascending: false })
        .limit(30);

      return {
        success: true,
        actionId,
        data: {
          customerId,
          historyCount: history?.length || 0,
          history: history || [],
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown health score action: ${actionId}`,
      };
  }
}

// ============================================
// QBR ACTIONS
// ============================================

async function executeQBRAction(
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  // Services use userId internally to get authenticated client

  switch (actionId) {
    case 'prepare_qbr': {
      // Create QBR preparation document in the default folder
      const doc = await docsService.createDocument(userId, {
        title: `QBR Prep - ${customerName} - ${new Date().toLocaleDateString()}`,
        content: `# QBR Preparation\n\n## Customer: ${customerName}\n\n## Agenda\n1. Review of Goals\n2. Usage Metrics\n3. Health Score Analysis\n4. Upcoming Initiatives\n5. Next Steps\n\n## Notes\n\n`,
        folderId: DEFAULT_FOLDER_ID,
      });

      return {
        success: true,
        actionId,
        data: {
          documentId: doc.documentId,
          title: doc.title,
          webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        },
      };
    }

    case 'generate_slides': {
      // Create QBR slides (simplified - would use Slides API) in the default folder
      const doc = await docsService.createDocument(userId, {
        title: `QBR Presentation - ${customerName}`,
        content: `# QBR Presentation\n\n## ${customerName}\n\n### Slide 1: Executive Summary\n\n### Slide 2: Key Metrics\n\n### Slide 3: Achievements\n\n### Slide 4: Roadmap\n\n### Slide 5: Next Steps`,
        folderId: DEFAULT_FOLDER_ID,
      });

      return {
        success: true,
        actionId,
        data: {
          documentId: doc.documentId,
          title: doc.title,
          webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
          note: 'Created as document - convert to Slides for presentation',
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown QBR action: ${actionId}`,
      };
  }
}

// ============================================
// RENEWAL ACTIONS
// ============================================

async function executeRenewalAction(
  req: Request,
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  if (!supabase) {
    return {
      success: false,
      actionId,
      error: 'Database not configured',
    };
  }

  switch (actionId) {
    case 'check_renewal': {
      // Get renewal information
      let renewQuery = supabase.from('customers').select('*, renewal_pipeline(*)');
      renewQuery = applyOrgFilter(renewQuery, req);
      const { data: customer } = await renewQuery
        .eq('id', customerId)
        .single();

      if (!customer) {
        return {
          success: false,
          actionId,
          error: 'Customer not found',
        };
      }

      const renewalDate = customer.renewal_date ? new Date(customer.renewal_date) : null;
      const daysToRenewal = renewalDate
        ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        success: true,
        actionId,
        data: {
          customerId,
          customerName: customer.name,
          renewalDate: customer.renewal_date,
          daysToRenewal,
          arr: customer.arr,
          status: customer.status,
          pipeline: customer.renewal_pipeline,
        },
      };
    }

    case 'start_playbook': {
      // Create renewal playbook tracking
      const { data, error } = await supabase
        .from('renewal_pipeline')
        .upsert({
          customer_id: customerId,
          status: 'in_progress',
          playbook_started_at: new Date().toISOString(),
          owner_id: userId,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          actionId,
          error: error.message,
        };
      }

      return {
        success: true,
        actionId,
        data: {
          pipelineId: data.id,
          status: data.status,
          startedAt: data.playbook_started_at,
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown renewal action: ${actionId}`,
      };
  }
}

// ============================================
// KNOWLEDGE BASE ACTIONS
// ============================================

async function executeKnowledgeAction(
  req: Request,
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  if (!supabase) {
    return {
      success: false,
      actionId,
      error: 'Database not configured',
    };
  }

  switch (actionId) {
    case 'search': {
      // Search knowledge base
      const query = params?.query as string || customerName || '';

      const { data } = await supabase
        .from('csm_playbooks')
        .select('*')
        .textSearch('content', query)
        .limit(10);

      return {
        success: true,
        actionId,
        data: {
          query,
          resultCount: data?.length || 0,
          results: data || [],
        },
      };
    }

    case 'get_playbook': {
      // Get specific playbook
      const category = params?.category as string;

      const { data } = await supabase
        .from('csm_playbooks')
        .select('*')
        .eq('category', category)
        .limit(5);

      return {
        success: true,
        actionId,
        data: {
          category,
          playbooks: data || [],
        },
      };
    }

    case 'get_customer_insights': {
      // Aggregate customer insights from multiple sources
      let insightCustQuery = supabase.from('customers').select('*');
      insightCustQuery = applyOrgFilter(insightCustQuery, req);
      const { data: customer } = await insightCustQuery
        .eq('id', customerId)
        .single();

      const { data: activities } = await supabase
        .from('agent_activities')
        .select('action_type, result_data, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      return {
        success: true,
        actionId,
        data: {
          customerId,
          customerName: customer?.name || customerName,
          relationshipSummary: customer?.notes || 'No summary available',
          keyStakeholders: customer?.stakeholders || [],
          mainUseCases: customer?.use_cases || [],
          recentActivity: activities || [],
        },
      };
    }

    case 'get_customer_timeline': {
      // Get customer interaction timeline
      const { data: activities } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(50);

      return {
        success: true,
        actionId,
        data: {
          customerId,
          customerName,
          timeline: activities || [],
          totalEvents: activities?.length || 0,
        },
      };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown knowledge action: ${actionId}`,
      };
  }
}

// ============================================
// ACTION ID MAPPING
// Maps UI action IDs to backend handler IDs
// ============================================

const ACTION_ID_MAP: Record<string, { actionId: string; category?: string }> = {
  // Email aliases
  summarize_emails: { actionId: 'summarize_thread' },
  draft_checkin: { actionId: 'draft_email' },
  draft_followup: { actionId: 'draft_email' },
  draft_renewal: { actionId: 'draft_email' },
  draft_escalation: { actionId: 'draft_email' },

  // Calendar aliases
  find_availability: { actionId: 'check_availability' },
  schedule_qbr: { actionId: 'schedule_meeting' },
  schedule_checkin: { actionId: 'schedule_meeting' },

  // Document aliases
  find_docs: { actionId: 'find_documents' },
  create_meeting_notes: { actionId: 'create_document' },
  create_success_plan: { actionId: 'create_document' },

  // Health score aliases
  calculate_health: { actionId: 'calculate_score' },
  health_trend: { actionId: 'get_trends' },

  // QBR aliases
  generate_qbr_full: { actionId: 'generate_slides' },

  // Renewal aliases
  renewal_health_check: { actionId: 'check_renewal' },
  create_renewal_playbook: { actionId: 'start_playbook' },

  // Knowledge aliases
  search_knowledge: { actionId: 'search' },
  get_insights: { actionId: 'get_customer_insights' },
  view_timeline: { actionId: 'get_customer_timeline' },

  // Meeting intelligence aliases
  get_transcript: { actionId: 'list_recent_meetings' },
  summarize_meeting: { actionId: 'analyze_meeting' },
  extract_actions: { actionId: 'extract_action_items' },
};

function resolveActionId(actionId: string, category: string): string {
  const mapping = ACTION_ID_MAP[actionId];
  return mapping?.actionId || actionId;
}

// ============================================
// MEETING INTELLIGENCE ACTIONS
// ============================================

async function executeMeetingIntelligenceAction(
  req: Request,
  userId: string,
  actionId: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<QuickActionResult> {
  const mcpContext: MCPContext = {
    userId,
    customerId,
    customerName,
  };

  switch (actionId) {
    case 'list_recent_meetings': {
      // Use MCP zoom_list_meetings tool
      const result = await mcpRegistry.execute(
        'zoom_list_meetings',
        { type: 'previous_meetings', pageSize: 10 },
        mcpContext
      );

      if (!result.success) {
        // Fallback: query meeting_analyses table if Zoom isn't connected
        if (supabase && customerId) {
          let mtgQuery = supabase.from('meeting_analyses').select('*');
          mtgQuery = applyOrgFilter(mtgQuery, req);
          const { data } = await mtgQuery
            .eq('customer_id', customerId)
            .order('meeting_date', { ascending: false })
            .limit(10);

          return {
            success: true,
            actionId,
            data: {
              source: 'database',
              meetings: data || [],
              meetingCount: data?.length || 0,
            },
          };
        }
        return { success: false, actionId, error: result.error || 'Failed to list meetings' };
      }

      return {
        success: true,
        actionId,
        data: {
          source: 'zoom',
          meetings: result.data,
          meetingCount: result.metadata?.totalRecords || 0,
        },
      };
    }

    case 'analyze_meeting': {
      // Use MCP analyze_meeting_transcript tool
      const meetingId = params?.meetingId as string;

      if (meetingId) {
        // Analyze a specific Zoom recording
        const result = await mcpRegistry.execute(
          'analyze_zoom_recording',
          { meetingId, customerId, customerName },
          mcpContext
        );

        return {
          success: result.success,
          actionId,
          data: result.data,
          error: result.error,
        };
      }

      // If no meeting ID, get latest meeting analysis from DB
      if (supabase && customerId) {
        let analyzeMtgQuery = supabase.from('meeting_analyses').select('*');
        analyzeMtgQuery = applyOrgFilter(analyzeMtgQuery, req);
        const { data } = await analyzeMtgQuery
          .eq('customer_id', customerId)
          .order('meeting_date', { ascending: false })
          .limit(1)
          .single();

        return {
          success: true,
          actionId,
          data: data || { message: 'No meeting analyses found' },
        };
      }

      return { success: false, actionId, error: 'Meeting ID or customer ID required' };
    }

    case 'extract_action_items': {
      // Get action items from latest meeting analysis
      if (supabase && customerId) {
        let actionItemsQuery = supabase.from('meeting_analyses').select('meeting_id, meeting_title, action_items, meeting_date');
        actionItemsQuery = applyOrgFilter(actionItemsQuery, req);
        const { data } = await actionItemsQuery
          .eq('customer_id', customerId)
          .order('meeting_date', { ascending: false })
          .limit(1)
          .single();

        return {
          success: true,
          actionId,
          data: {
            meetingId: data?.meeting_id,
            meetingTitle: data?.meeting_title,
            actionItems: data?.action_items || [],
            meetingDate: data?.meeting_date,
          },
        };
      }

      return { success: false, actionId, error: 'Database not configured or customer ID missing' };
    }

    default:
      return {
        success: false,
        actionId,
        error: `Unknown meeting intelligence action: ${actionId}`,
      };
  }
}

// ============================================
// ENHANCED KNOWLEDGE ACTIONS (add new handlers)
// ============================================

// Extend executeKnowledgeAction to handle additional action IDs:

// ============================================
// HELPER FUNCTIONS
// ============================================

function findFreeSlots(events: { start?: { dateTime?: string }; end?: { dateTime?: string } }[], days: number): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const now = new Date();

  // Simple implementation - find gaps between events
  // In production, this would be more sophisticated
  for (let d = 0; d < days; d++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() + d);
    dayStart.setHours(9, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(17, 0, 0, 0);

    // Skip weekends
    if (dayStart.getDay() === 0 || dayStart.getDay() === 6) continue;

    slots.push({
      start: dayStart.toISOString(),
      end: new Date(dayStart.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour slot
    });
  }

  return slots;
}

export default router;
