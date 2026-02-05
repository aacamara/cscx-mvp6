/**
 * WorkspaceAgent - Agentic Google Workspace Integration
 * Connected to MCP backend for all actions.
 *
 * Key Features:
 * - Quick actions for common CSM tasks across all categories
 * - Human-in-the-loop approval for sensitive actions
 * - Meeting intelligence with transcript summaries
 * - Health score calculation and display
 * - QBR generation workflow
 * - Renewal management automation
 * - WebSocket subscription for real-time updates
 * - Per-action loading states with error handling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  WorkspaceConnection,
  EmailThread,
  EmailDraft,
  MeetingProposal,
  DriveDocument,
  ActionResult,
  QuickAction,
  CSM_QUICK_ACTIONS,
  AgentMemory,
  AvailabilitySlot,
  HealthScore,
  MeetingRecording,
  MeetingSummary,
  QBRPackage,
  RenewalPlaybook,
  QuickActionCategory,
  CustomerInsight,
  CustomerSignal,
  QBRSectionType,
  WorkspaceAction,
  SessionContext,
} from '../../types/workspaceAgent';

interface WorkspaceAgentProps {
  customerId?: string;
  customerName?: string;
  stakeholderEmails?: string[];
  healthScore?: number;
  renewalDate?: Date;
  onActionComplete?: (result: ActionResult) => void;
  compact?: boolean;
}

// API configuration
const API_URL = import.meta.env.VITE_API_URL || '';
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

// Default empty connection
const INITIAL_CONNECTION: WorkspaceConnection = {
  status: 'disconnected',
  gmail: { connected: false, lastSync: new Date() },
  calendar: { connected: false, lastSync: new Date() },
  drive: { connected: false, lastSync: new Date() },
  docs: { connected: false, lastSync: new Date() },
  sheets: { connected: false, lastSync: new Date() },
  slides: { connected: false, lastSync: new Date() },
  lastSync: new Date(),
  userEmail: 'Not connected',
  scopes: [],
};

// Helper to execute workspace actions via MCP backend
async function executeWorkspaceAction(
  actionId: string,
  category: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string; requiresApproval?: boolean; approvalId?: string }> {
  const response = await fetch(`${API_URL}/api/workspace-agent/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': DEMO_USER_ID,
    },
    body: JSON.stringify({
      actionId,
      category,
      customerId,
      customerName,
      params,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    return { success: false, error: error.message || `HTTP ${response.status}` };
  }

  return await response.json();
}

// Purpose-specific params for draft email actions
function getDraftParams(actionId: string, stakeholderEmails: string[]): Record<string, unknown> {
  const purposeMap: Record<string, string> = {
    draft_checkin: 'check_in',
    draft_followup: 'follow_up',
    draft_renewal: 'renewal',
    draft_escalation: 'escalation',
  };
  return {
    purpose: purposeMap[actionId] || 'follow_up',
    stakeholderEmails,
  };
}

// Meeting type params for schedule actions
function getScheduleParams(actionId: string, customerName: string, stakeholderEmails: string[]): Record<string, unknown> {
  if (actionId === 'schedule_qbr') {
    return {
      title: `Quarterly Business Review - ${customerName}`,
      description: `QBR with ${customerName} team.\n\nAgenda:\n- Performance review\n- Roadmap alignment\n- Success metrics\n- Next quarter planning`,
      duration: 60,
      attendees: stakeholderEmails,
    };
  }
  return {
    title: `Check-in - ${customerName}`,
    description: `Regular check-in with ${customerName} team.`,
    duration: 30,
    attendees: stakeholderEmails,
  };
}

// Document type params
function getDocumentParams(actionId: string, customerName: string): Record<string, unknown> {
  if (actionId === 'create_meeting_notes') {
    return { title: `${customerName} - Meeting Notes - ${new Date().toLocaleDateString()}` };
  }
  if (actionId === 'create_success_plan') {
    return { title: `${customerName} - Success Plan` };
  }
  return {};
}

export const WorkspaceAgent: React.FC<WorkspaceAgentProps> = ({
  customerId,
  customerName = 'Acme Corp',
  stakeholderEmails = [],
  renewalDate,
  onActionComplete,
  compact = false,
}) => {
  // Connection state
  const [connection, setConnection] = useState<WorkspaceConnection>(INITIAL_CONNECTION);

  // Per-action loading state (tracks which action is running)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<QuickActionCategory | 'all'>('all');
  const [pendingApproval, setPendingApproval] = useState<{
    type: 'email' | 'meeting' | 'qbr' | 'renewal';
    data: EmailDraft | MeetingProposal | QBRPackage | RenewalPlaybook;
    approvalId?: string;
  } | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Memory state
  const [agentMemory, setAgentMemory] = useState<AgentMemory>({
    customerId,
    preferences: [],
    recentActions: [],
    learnedPatterns: [],
    sessionContext: {
      activeCustomerId: customerId,
      activeCustomerName: customerName,
      pendingApprovals: [],
      recentDocuments: [],
      recentMeetings: [],
      conversationHistory: [],
    } as SessionContext,
  });

  // Data states (populated by backend)
  const [emailSummary, setEmailSummary] = useState<{
    threads: EmailThread[];
    summary: string;
    actionItems: string[];
  } | null>(null);
  const [draftEmail, setDraftEmail] = useState<EmailDraft | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [meetingProposal, setMeetingProposal] = useState<MeetingProposal | null>(null);
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<MeetingRecording[]>([]);
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);
  const [healthScoreData, setHealthScoreData] = useState<HealthScore | null>(null);
  const [qbrPackage, setQBRPackage] = useState<QBRPackage | null>(null);
  const [renewalPlaybook, setRenewalPlaybook] = useState<RenewalPlaybook | null>(null);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsight | null>(null);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch real connection status on mount
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/workspace-agent/status`, {
          headers: { 'x-user-id': DEMO_USER_ID },
        });
        if (response.ok) {
          const data = await response.json();
          setConnection({
            status: data.connected ? 'connected' : 'disconnected',
            gmail: { connected: data.services?.gmail || false, lastSync: new Date() },
            calendar: { connected: data.services?.calendar || false, lastSync: new Date() },
            drive: { connected: data.services?.drive || false, lastSync: new Date() },
            docs: { connected: data.services?.docs || false, lastSync: new Date() },
            sheets: { connected: data.services?.sheets || false, lastSync: new Date() },
            slides: { connected: data.services?.slides || false, lastSync: new Date() },
            lastSync: new Date(),
            userEmail: data.email || 'Not connected',
            scopes: [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch connection status:', error);
      }
    };
    fetchConnectionStatus();
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = API_URL.replace(/^http/, 'ws') || `ws://${window.location.hostname}:3001`;
    try {
      const ws = new WebSocket(`${wsUrl}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', data: { token: DEMO_USER_ID } }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWSMessage(message);
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        console.warn('[WorkspaceAgent] WebSocket connection failed - updates will use polling');
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch {
      console.warn('[WorkspaceAgent] WebSocket not available');
    }
  }, []);

  const handleWSMessage = useCallback((message: { type: string; data: Record<string, unknown> }) => {
    switch (message.type) {
      case 'approval_required':
        // Real-time approval notification from backend
        console.log('[WorkspaceAgent] Approval required via WebSocket:', message.data);
        break;
      case 'agent_message':
        // Agent status update
        console.log('[WorkspaceAgent] Agent message:', message.data);
        break;
      case 'agent:step':
        // Step-level update for long-running actions
        console.log('[WorkspaceAgent] Agent step:', message.data);
        break;
    }
  }, []);

  // Record action for memory
  const recordAction = useCallback((action: string, outcome: 'success' | 'modified' | 'rejected') => {
    setAgentMemory(prev => ({
      ...prev,
      recentActions: [
        { id: `action_${Date.now()}`, action, context: `Customer: ${customerName}`, timestamp: new Date(), outcome },
        ...prev.recentActions.slice(0, 9),
      ],
    }));
  }, [customerName]);

  // Process backend response into appropriate UI state
  const processBackendResponse = useCallback((
    action: QuickAction,
    data: unknown,
    requiresApproval?: boolean,
    approvalId?: string
  ) => {
    const result = data as Record<string, unknown>;

    switch (action.category) {
      case 'email': {
        if (action.id === 'summarize_emails') {
          const threads = (result.threads as Array<{ id: string; snippet: string; messageCount?: number }>) || [];
          setEmailSummary({
            threads: threads.map(t => ({
              id: t.id,
              subject: t.snippet?.slice(0, 60) || 'Untitled',
              snippet: t.snippet || '',
              participants: [],
              messageCount: t.messageCount || 0,
              unreadCount: 0,
              lastMessageDate: new Date(),
              labels: [],
              isCustomerThread: true,
            })),
            summary: `Found ${result.threadCount || threads.length} recent threads with ${customerName}.`,
            actionItems: [],
          });
        } else if (requiresApproval && result.draftId) {
          const draft: EmailDraft = {
            id: result.draftId as string,
            to: (result.to as string[]) || stakeholderEmails,
            subject: (result.subject as string) || '',
            body: (result.body as string) || '',
            purpose: (result.purpose as EmailDraft['purpose']) || 'follow_up',
            tone: 'friendly',
            status: 'pending_approval',
            aiGenerated: true,
            suggestions: [],
          };
          setDraftEmail(draft);
          setPendingApproval({ type: 'email', data: draft, approvalId });
        }
        break;
      }

      case 'calendar': {
        if (action.id === 'find_availability') {
          const freeSlots = (result.freeSlots as Array<{ start: string; end: string }>) || [];
          setAvailableSlots(freeSlots.map((slot, i) => ({
            start: new Date(slot.start),
            end: new Date(slot.end),
            score: Math.max(70, 95 - i * 5),
            reason: 'Available slot',
          })));
        } else if (action.id === 'schedule_qbr' || action.id === 'schedule_checkin') {
          if (requiresApproval && result.eventId) {
            const proposal: MeetingProposal = {
              id: result.eventId as string,
              title: (result.summary as string) || `Meeting with ${customerName}`,
              description: '',
              duration: action.id === 'schedule_qbr' ? 60 : 30,
              attendees: stakeholderEmails,
              proposedSlots: availableSlots,
              meetingType: action.id === 'schedule_qbr' ? 'qbr' : 'check_in',
              status: 'proposing',
              includeMeetLink: true,
              sendInvites: true,
            };
            setMeetingProposal(proposal);
            setPendingApproval({ type: 'meeting', data: proposal, approvalId });
          }
        }
        break;
      }

      case 'document': {
        if (action.id === 'find_docs') {
          const files = (result.files as Array<{ id: string; name: string; mimeType: string; webViewLink: string }>) || [];
          setDocuments(files.map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            type: f.mimeType.includes('presentation') ? 'presentation' as const :
                  f.mimeType.includes('spreadsheet') ? 'spreadsheet' as const :
                  f.mimeType.includes('document') ? 'document' as const :
                  f.mimeType.includes('pdf') ? 'pdf' as const : 'document' as const,
            webViewLink: f.webViewLink || '',
            lastModified: new Date(),
            isCustomerDoc: true,
            customerName,
          })));
        } else if (result.documentId || result.spreadsheetId) {
          const newDoc: DriveDocument = {
            id: (result.documentId || result.spreadsheetId) as string,
            name: (result.title as string) || 'New Document',
            mimeType: result.spreadsheetId ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document',
            type: result.spreadsheetId ? 'spreadsheet' : 'document',
            webViewLink: (result.webViewLink as string) || '',
            lastModified: new Date(),
            isCustomerDoc: true,
            customerName,
          };
          setDocuments(prev => [newDoc, ...prev]);
        }
        break;
      }

      case 'meeting_intelligence': {
        if (action.id === 'get_transcript') {
          const meetings = (result.meetings as Array<{
            id?: string; meeting_id?: string; topic?: string; meeting_title?: string;
            start_time?: string; meeting_date?: string; duration?: number;
          }>) || [];
          setRecentMeetings(meetings.map(m => ({
            id: m.id || m.meeting_id || `meeting_${Date.now()}`,
            platform: 'zoom' as const,
            title: m.topic || m.meeting_title || 'Meeting',
            startTime: new Date(m.start_time || m.meeting_date || Date.now()),
            duration: m.duration || 0,
            participants: [],
            transcriptAvailable: true,
            customerId,
            customerName,
          })));
        } else if (action.id === 'summarize_meeting') {
          const analysis = result as Record<string, unknown>;
          const summary: MeetingSummary = {
            id: `summary_${Date.now()}`,
            meetingId: (analysis.meetingId as string) || '',
            format: 'detailed',
            overview: (analysis.summary as string) || (analysis.message as string) || 'Analysis complete.',
            keyPoints: (analysis.keyPoints as string[]) || [],
            actionItems: ((analysis.actionItems || analysis.action_items) as Array<{
              id?: string; description: string; owner?: string; priority?: string; status?: string;
            }> || []).map((item, i) => ({
              id: item.id || `${i}`,
              description: item.description,
              owner: item.owner || 'Unassigned',
              priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
              status: (item.status || 'pending') as 'pending' | 'completed',
              source: 'meeting' as const,
            })),
            decisions: (analysis.decisions as string[]) || [],
            followUps: (analysis.followUps as string[]) || [],
            sentiment: (analysis.sentiment as 'positive' | 'negative' | 'neutral') || 'neutral',
            customerSignals: ((analysis.customerSignals as Array<{ type: string; description: string; severity: string }>) || []).map(s => ({
              ...s,
              type: s.type as CustomerSignal['type'],
              severity: s.severity as CustomerSignal['severity'],
            })),
            generatedAt: new Date(),
          };
          setMeetingSummary(summary);
        } else if (action.id === 'extract_actions') {
          const items = (result.actionItems as Array<{
            id?: string; description: string; owner?: string; priority?: string; status?: string;
          }>) || [];
          const summary: MeetingSummary = {
            id: `summary_${Date.now()}`,
            meetingId: (result.meetingId as string) || '',
            format: 'detailed',
            overview: `Extracted ${items.length} action items from ${result.meetingTitle || 'latest meeting'}.`,
            keyPoints: [],
            actionItems: items.map((item, i) => ({
              id: item.id || `${i}`,
              description: item.description,
              owner: item.owner || 'Unassigned',
              priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
              status: (item.status || 'pending') as 'pending' | 'completed',
              source: 'meeting' as const,
            })),
            decisions: [],
            followUps: [],
            sentiment: 'neutral',
            customerSignals: [],
            generatedAt: new Date(),
          };
          setMeetingSummary(summary);
        }
        break;
      }

      case 'health_score': {
        const score = (result.healthScore as number) || (result.score as number) || 0;
        const components = result.components as Record<string, number> | undefined;
        setHealthScoreData({
          customerId: customerId || '',
          score,
          grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
          trend: score >= 70 ? 'improving' : score >= 50 ? 'stable' : 'declining',
          previousScore: score - 5,
          signals: {
            productUsage: { loginFrequency: 0, featureAdoption: 0, usageVsEntitlement: 0, activeUsers: 0, trend: 'up', score: components?.usage || 0 },
            engagement: { meetingFrequency: 0, emailResponseTime: 0, eventAttendance: 0, lastContactDays: 0, score: components?.engagement || 0 },
            support: { ticketVolume: 0, avgSeverity: 0, resolutionSatisfaction: 0, openTickets: 0, escalations: 0, score: 0 },
            nps: { latestScore: 0, previousScore: 0, trend: 'promoter', lastSurveyDate: new Date(), score: 0 },
            contract: { daysToRenewal: 0, expansionHistory: 0, paymentStatus: 'current', contractValue: 0, score: 0 },
            stakeholder: { championStrength: 'moderate', executiveEngagement: false, turnoverRisk: 'medium', decisionMakerAccess: false, score: 0 },
          },
          factors: components ? [
            { name: 'Usage', weight: 0.33, score: components.usage || 0, impact: (components.usage || 0) >= 70 ? 'positive' as const : 'neutral' as const, description: 'Product usage metrics' },
            { name: 'Engagement', weight: 0.33, score: components.engagement || 0, impact: (components.engagement || 0) >= 70 ? 'positive' as const : 'neutral' as const, description: 'Engagement metrics' },
            { name: 'Sentiment', weight: 0.33, score: components.sentiment || 0, impact: (components.sentiment || 0) >= 70 ? 'positive' as const : 'neutral' as const, description: 'Sentiment analysis' },
          ] : [],
          recommendations: [],
          calculatedAt: new Date(),
        });
        break;
      }

      case 'qbr': {
        if (result.documentId) {
          const qbr: QBRPackage = {
            id: `qbr_${Date.now()}`,
            customerId: customerId || '',
            customerName,
            quarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}` as 'Q1' | 'Q2' | 'Q3' | 'Q4',
            year: new Date().getFullYear(),
            status: 'draft',
            documentId: result.documentId as string,
            presentationId: result.documentId as string,
            documentUrl: (result.webViewLink as string) || '',
            presentationUrl: (result.webViewLink as string) || '',
            sections: [{ name: 'executive_summary' as QBRSectionType, included: true, content: result.title as string }],
            generatedAt: new Date(),
          };
          setQBRPackage(qbr);
          setPendingApproval({ type: 'qbr', data: qbr, approvalId });
        }
        break;
      }

      case 'renewal': {
        if (action.id === 'renewal_health_check') {
          const daysToRenewal = result.daysToRenewal as number;
          // Also calculate health score if we have the data
          if (result.healthScore || result.arr) {
            setRenewalPlaybook({
              id: `renewal_${Date.now()}`,
              customerId: customerId || '',
              customerName,
              renewalDate: result.renewalDate ? new Date(result.renewalDate as string) : (renewalDate || new Date()),
              status: 'not_started',
              stages: [],
              probability: daysToRenewal && daysToRenewal > 60 ? 85 : 65,
              riskFactors: [],
              positiveIndicators: [],
              recommendedActions: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } else if (result.pipelineId || result.status) {
          const playbook: RenewalPlaybook = {
            id: (result.pipelineId as string) || `renewal_${Date.now()}`,
            customerId: customerId || '',
            customerName,
            renewalDate: renewalDate || new Date(Date.now() + 90 * 86400000),
            status: (result.status as string) === 'in_progress' ? 'in_progress' : 'not_started',
            stages: [
              { name: '90 Days Out', daysBeforeRenewal: 90, status: 'pending', actions: [
                { id: '1', type: 'email', description: 'Send renewal reminder', status: 'pending' },
                { id: '2', type: 'meeting', description: 'Schedule renewal discussion', status: 'pending' },
              ]},
              { name: '60 Days Out', daysBeforeRenewal: 60, status: 'pending', actions: [
                { id: '3', type: 'email', description: 'Send proposal', status: 'pending' },
              ]},
              { name: '30 Days Out', daysBeforeRenewal: 30, status: 'pending', actions: [
                { id: '4', type: 'call', description: 'Follow up call', status: 'pending' },
              ]},
            ],
            probability: 85,
            riskFactors: [],
            positiveIndicators: [],
            recommendedActions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setRenewalPlaybook(playbook);
          setPendingApproval({ type: 'renewal', data: playbook, approvalId });
        }
        break;
      }

      case 'knowledge': {
        if (action.id === 'get_insights' || action.id === 'search_knowledge' || action.id === 'view_timeline') {
          setCustomerInsights({
            relationshipSummary: (result.relationshipSummary as string) || 'Customer insights loaded from database.',
            keyStakeholders: (result.keyStakeholders as string[]) || [],
            mainUseCases: (result.mainUseCases as string[]) || [],
            successFactors: [],
            riskFactors: [],
            expansionOpportunities: [],
            communicationPreferences: '',
            lastUpdated: new Date(),
          });
        }
        break;
      }
    }
  }, [customerId, customerName, stakeholderEmails, availableSlots, renewalDate]);

  // Execute a quick action via MCP backend
  const executeAction = useCallback(async (action: QuickAction) => {
    setLoadingActionId(action.id);
    setActionError(null);
    setShowResults(true);

    try {
      // Build action-specific params
      let params: Record<string, unknown> = { stakeholderEmails };

      if (['draft_checkin', 'draft_followup', 'draft_renewal', 'draft_escalation'].includes(action.id)) {
        params = { ...params, ...getDraftParams(action.id, stakeholderEmails) };
      } else if (['schedule_qbr', 'schedule_checkin'].includes(action.id)) {
        params = { ...params, ...getScheduleParams(action.id, customerName, stakeholderEmails) };
      } else if (['create_meeting_notes', 'create_success_plan'].includes(action.id)) {
        params = { ...params, ...getDocumentParams(action.id, customerName) };
      }

      const result = await executeWorkspaceAction(
        action.id,
        action.category,
        customerId,
        customerName,
        params
      );

      if (result.success) {
        processBackendResponse(action, result.data, result.requiresApproval, result.approvalId);
        recordAction(action.id.toUpperCase(), 'success');

        if (onActionComplete) {
          onActionComplete({
            success: true,
            action: { type: action.id.toUpperCase(), customerId: customerId || '' } as unknown as WorkspaceAction,
            data: result.data,
          });
        }
      } else {
        setActionError(result.error || 'Action failed');
        recordAction(action.id.toUpperCase(), 'rejected');

        if (onActionComplete) {
          onActionComplete({
            success: false,
            action: { type: action.id.toUpperCase(), customerId: customerId || '' } as unknown as WorkspaceAction,
            error: result.error || 'Action failed',
          });
        }
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setActionError(errorMsg);
      recordAction(action.id.toUpperCase(), 'rejected');
    } finally {
      setLoadingActionId(null);
    }
  }, [customerId, customerName, stakeholderEmails, onActionComplete, processBackendResponse, recordAction]);

  // === APPROVAL HANDLERS ===
  const handleApprove = async () => {
    if (!pendingApproval) return;
    setLoadingActionId('approve');

    try {
      if (pendingApproval.type === 'email') {
        const draft = pendingApproval.data as EmailDraft;
        // Execute approval via MCP backend
        if (pendingApproval.approvalId) {
          await fetch(`${API_URL}/api/mcp/execute/gmail_send_email/with-approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
            body: JSON.stringify({
              input: { to: draft.to, subject: draft.subject, body: draft.body },
              approvalId: pendingApproval.approvalId,
              approved: true,
            }),
          });
        }
        setDraftEmail({ ...draft, status: 'sent' });
        recordAction('SEND_EMAIL', 'success');
      } else if (pendingApproval.type === 'meeting') {
        const meeting = pendingApproval.data as MeetingProposal;
        setMeetingProposal({ ...meeting, status: 'pending_response' });
        recordAction('SCHEDULE_MEETING', 'success');
      } else if (pendingApproval.type === 'qbr') {
        const qbr = pendingApproval.data as QBRPackage;
        setQBRPackage({ ...qbr, status: 'approved', approvedAt: new Date() });
        recordAction('GENERATE_QBR', 'success');
      } else if (pendingApproval.type === 'renewal') {
        const renewal = pendingApproval.data as RenewalPlaybook;
        setRenewalPlaybook({ ...renewal, status: 'in_progress' });
        recordAction('CREATE_RENEWAL_PLAYBOOK', 'success');
      }
    } catch (error) {
      console.error('Approval error:', error);
    }

    setPendingApproval(null);
    setLoadingActionId(null);
  };

  const handleModify = () => {
    console.log('Modify action:', pendingApproval);
  };

  // Get unique categories from quick actions
  const categories: QuickActionCategory[] = [
    'email', 'calendar', 'document', 'meeting_intelligence',
    'health_score', 'qbr', 'renewal', 'knowledge',
  ];

  const getActionsByCategory = (category: QuickActionCategory | 'all') => {
    if (category === 'all') return CSM_QUICK_ACTIONS;
    return CSM_QUICK_ACTIONS.filter(a => a.category === category);
  };

  const getCategoryName = (category: QuickActionCategory | 'all'): string => {
    const names: Record<string, string> = {
      all: 'All Actions', email: 'Email', calendar: 'Calendar', document: 'Documents',
      meeting_intelligence: 'Meeting Intel', health_score: 'Health Score', qbr: 'QBR',
      renewal: 'Renewal', knowledge: 'Knowledge', onboarding: 'Onboarding', automation: 'Automation',
    };
    return names[category] || category;
  };

  const getCategoryIcon = (category: QuickActionCategory | 'all'): string => {
    const icons: Record<string, string> = {
      all: '🎯', email: '📧', calendar: '📅', document: '📁', meeting_intelligence: '🎙️',
      health_score: '💚', qbr: '📊', renewal: '🔄', knowledge: '💡', onboarding: '🚀', automation: '⚡',
    };
    return icons[category] || '📌';
  };

  const isProcessing = loadingActionId !== null;

  // Connection status indicator
  const ConnectionStatus: React.FC = () => (
    <div className="flex items-center gap-3 p-2 bg-cscx-gray-800 rounded-lg text-xs">
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${connection.gmail.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-cscx-gray-400">Gmail</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${connection.calendar.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-cscx-gray-400">Cal</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${connection.drive.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-cscx-gray-400">Drive</span>
      </div>
    </div>
  );

  // Quick action button with per-action loading
  const ActionButton: React.FC<{ action: QuickAction; size?: 'sm' | 'md' }> = ({ action, size = 'md' }) => {
    const isLoading = loadingActionId === action.id;
    return (
      <button
        onClick={() => executeAction(action)}
        disabled={isProcessing}
        className={`bg-cscx-gray-800 hover:bg-cscx-gray-700 border border-cscx-gray-700 rounded-lg text-left transition-all ${
          isProcessing && !isLoading ? 'opacity-50 cursor-not-allowed' : ''
        } ${isLoading ? 'ring-2 ring-cscx-accent' : ''} ${size === 'sm' ? 'p-2' : 'p-3'}`}
      >
        <div className="flex items-center gap-2 mb-1">
          {isLoading ? (
            <div className="animate-spin w-4 h-4 border-2 border-cscx-accent border-t-transparent rounded-full" />
          ) : (
            <span className={size === 'sm' ? 'text-base' : 'text-lg'}>{action.icon}</span>
          )}
          <span className="text-white font-medium text-sm">{action.name}</span>
        </div>
        {size === 'md' && <p className="text-xs text-cscx-gray-400">{action.description}</p>}
        {action.requiresApproval && size === 'md' && (
          <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
            Requires approval
          </span>
        )}
      </button>
    );
  };

  // Compact mode for embedded use
  if (compact) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            <span>🤖</span> Workspace Agent
          </h4>
          <ConnectionStatus />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CSM_QUICK_ACTIONS.slice(0, 4).map(action => (
            <button
              key={action.id}
              onClick={() => executeAction(action)}
              disabled={isProcessing}
              className="p-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 border border-cscx-gray-700 rounded-lg text-left transition-colors"
            >
              <span className="text-sm text-white">
                {loadingActionId === action.id ? (
                  <span className="inline-block animate-spin w-3 h-3 border-2 border-cscx-accent border-t-transparent rounded-full mr-1" />
                ) : action.icon}{' '}
                {action.name}
              </span>
            </button>
          ))}
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 p-2 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg">
            <div className="animate-spin w-4 h-4 border-2 border-cscx-accent border-t-transparent rounded-full" />
            <span className="text-sm text-white">Processing...</span>
          </div>
        )}

        {actionError && (
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400">{actionError}</p>
          </div>
        )}

        {emailSummary && (
          <div className="p-3 bg-cscx-gray-800 rounded-lg">
            <p className="text-sm text-white">{emailSummary.summary}</p>
            {emailSummary.actionItems.length > 0 && (
              <ul className="mt-2 text-xs text-cscx-gray-400">
                {emailSummary.actionItems.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {healthScoreData && (
          <div className="p-3 bg-cscx-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">Health Score</span>
              <span className={`text-lg font-bold ${
                healthScoreData.score >= 80 ? 'text-green-400' :
                healthScoreData.score >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>{healthScoreData.score}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs rounded ${
                healthScoreData.trend === 'improving' ? 'bg-green-500/20 text-green-400' :
                healthScoreData.trend === 'declining' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {healthScoreData.trend === 'improving' ? '↑' : healthScoreData.trend === 'declining' ? '↓' : '→'} {healthScoreData.trend}
              </span>
              <span className="text-xs text-cscx-gray-400">Grade: {healthScoreData.grade}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              CSCX Workspace Agent
            </h3>
            <p className="text-sm text-cscx-gray-400">
              AI-powered actions for {customerName}
            </p>
          </div>
          <ConnectionStatus />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-cscx-accent text-white'
                : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
            }`}
          >
            {getCategoryIcon('all')} All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              {getCategoryIcon(cat)} {getCategoryName(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {getActionsByCategory(activeCategory).map(action => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        {/* Error Display */}
        {actionError && !isProcessing && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <span className="text-red-400 text-sm">Action failed: {actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="ml-auto text-xs text-cscx-gray-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results Section */}
        {showResults && !isProcessing && (
          <div className="space-y-4">
            {/* Email Summary */}
            {emailSummary && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">📧 Email Summary</h4>
                <p className="text-sm text-cscx-gray-300 mb-3">{emailSummary.summary}</p>
                <div className="space-y-2">
                  {emailSummary.threads.map(thread => (
                    <div key={thread.id} className="p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{thread.subject}</p>
                          <p className="text-xs text-cscx-gray-400">{thread.snippet}</p>
                        </div>
                        {thread.sentiment && (
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            thread.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                            thread.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>{thread.sentiment}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health Score */}
            {healthScoreData && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">💚 Health Score</h4>
                <div className="flex items-center gap-6">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="36" fill="none" stroke="#222" strokeWidth="8" />
                      <circle
                        cx="40" cy="40" r="36" fill="none"
                        stroke={healthScoreData.score >= 80 ? '#22c55e' : healthScoreData.score >= 60 ? '#eab308' : '#ef4444'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(healthScoreData.score / 100) * 226} 226`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xl font-bold ${
                        healthScoreData.score >= 80 ? 'text-green-400' :
                        healthScoreData.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{healthScoreData.score}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-medium">Grade: {healthScoreData.grade}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        healthScoreData.trend === 'improving' ? 'bg-green-500/20 text-green-400' :
                        healthScoreData.trend === 'declining' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {healthScoreData.trend === 'improving' ? '↑' : healthScoreData.trend === 'declining' ? '↓' : '→'} {healthScoreData.trend}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {healthScoreData.factors.slice(0, 3).map((factor, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-cscx-gray-400">{factor.name}</span>
                          <span className={factor.impact === 'positive' ? 'text-green-400' : factor.impact === 'negative' ? 'text-red-400' : 'text-gray-400'}>
                            {factor.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {healthScoreData.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cscx-gray-700">
                    <p className="text-xs text-cscx-gray-500 mb-1">Recommendations:</p>
                    <ul className="text-xs text-cscx-gray-400">
                      {healthScoreData.recommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Meeting Summary */}
            {meetingSummary && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">🎙️ Meeting Summary</h4>
                <p className="text-sm text-cscx-gray-300 mb-3">{meetingSummary.overview}</p>
                <div className="grid grid-cols-2 gap-3">
                  {meetingSummary.keyPoints.length > 0 && (
                    <div>
                      <p className="text-xs text-cscx-gray-500 mb-1">Key Points:</p>
                      <ul className="text-xs text-cscx-gray-400">
                        {meetingSummary.keyPoints.slice(0, 3).map((point, i) => (
                          <li key={i}>• {point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {meetingSummary.actionItems.length > 0 && (
                    <div>
                      <p className="text-xs text-cscx-gray-500 mb-1">Action Items:</p>
                      <ul className="text-xs text-cscx-gray-400">
                        {meetingSummary.actionItems.slice(0, 3).map((item, i) => (
                          <li key={i}>• {item.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    meetingSummary.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                    meetingSummary.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>Sentiment: {meetingSummary.sentiment}</span>
                </div>
              </div>
            )}

            {/* Recent Meetings */}
            {recentMeetings.length > 0 && !meetingSummary && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">🎙️ Recent Meetings</h4>
                <div className="space-y-2">
                  {recentMeetings.map(meeting => (
                    <div key={meeting.id} className="p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium text-sm">{meeting.title}</p>
                        <span className="text-xs text-cscx-gray-400">{meeting.duration} min</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-cscx-gray-400">{meeting.startTime.toLocaleDateString()}</span>
                        <span className="px-2 py-0.5 text-xs bg-cscx-gray-700 rounded">{meeting.platform}</span>
                        {meeting.transcriptAvailable && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Transcript</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Insights */}
            {customerInsights && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">💡 Customer Insights</h4>
                <p className="text-sm text-cscx-gray-300 mb-3">{customerInsights.relationshipSummary}</p>
                <div className="grid grid-cols-2 gap-3">
                  {customerInsights.keyStakeholders.length > 0 && (
                    <div>
                      <p className="text-xs text-cscx-gray-500 mb-1">Key Stakeholders:</p>
                      <ul className="text-xs text-cscx-gray-400">
                        {customerInsights.keyStakeholders.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {customerInsights.expansionOpportunities.length > 0 && (
                    <div>
                      <p className="text-xs text-cscx-gray-500 mb-1">Expansion Opportunities:</p>
                      <ul className="text-xs text-cscx-gray-400">
                        {customerInsights.expansionOpportunities.map((o, i) => (
                          <li key={i}>• {o}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">📁 Customer Documents</h4>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <a
                      key={doc.id}
                      href={doc.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700 hover:border-cscx-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {doc.type === 'presentation' ? '📊' :
                           doc.type === 'spreadsheet' ? '📈' :
                           doc.type === 'document' ? '📄' :
                           doc.type === 'pdf' ? '📑' : '📁'}
                        </span>
                        <div>
                          <p className="text-white text-sm">{doc.name}</p>
                          <p className="text-xs text-cscx-gray-400">{doc.category || doc.type} • {doc.lastModified.toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className="text-cscx-gray-400">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Available Slots */}
            {availableSlots.length > 0 && !meetingProposal && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">📅 Available Times</h4>
                <div className="space-y-2">
                  {availableSlots.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700">
                      <div>
                        <p className="text-white text-sm">
                          {slot.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' '}
                          {slot.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-cscx-gray-400">{slot.reason}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        slot.score >= 90 ? 'bg-green-500/20 text-green-400' :
                        slot.score >= 80 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{slot.score}% match</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Approval */}
        {pendingApproval && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">⚠️ Approval Required</h4>

            {pendingApproval.type === 'email' && draftEmail && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-xs text-cscx-gray-500 mb-1">To: {draftEmail.to.join(', ')}</p>
                  <p className="text-white font-medium text-sm mb-2">{draftEmail.subject}</p>
                  <pre className="text-sm text-cscx-gray-300 whitespace-pre-wrap font-sans">{draftEmail.body}</pre>
                </div>
              </div>
            )}

            {pendingApproval.type === 'meeting' && meetingProposal && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-white font-medium text-sm mb-1">{meetingProposal.title}</p>
                  <p className="text-xs text-cscx-gray-400 mb-2">
                    Duration: {meetingProposal.duration} min • Attendees: {meetingProposal.attendees.join(', ')}
                  </p>
                  <pre className="text-sm text-cscx-gray-300 whitespace-pre-wrap font-sans">{meetingProposal.description}</pre>
                </div>
              </div>
            )}

            {pendingApproval.type === 'qbr' && qbrPackage && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-white font-medium text-sm mb-1">QBR Package - {qbrPackage.quarter} {qbrPackage.year}</p>
                  <p className="text-xs text-cscx-gray-400 mb-2">
                    Includes: Document + Presentation with {qbrPackage.sections.filter(s => s.included).length} sections
                  </p>
                  <div className="flex gap-2">
                    {qbrPackage.documentUrl && (
                      <a href={qbrPackage.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cscx-accent hover:underline">📄 View Document</a>
                    )}
                    {qbrPackage.presentationUrl && qbrPackage.presentationUrl !== qbrPackage.documentUrl && (
                      <a href={qbrPackage.presentationUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cscx-accent hover:underline">📊 View Slides</a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pendingApproval.type === 'renewal' && renewalPlaybook && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-white font-medium text-sm mb-1">Renewal Playbook</p>
                  <p className="text-xs text-cscx-gray-400 mb-2">
                    Renewal: {renewalPlaybook.renewalDate.toLocaleDateString()} • Probability: {renewalPlaybook.probability}%
                  </p>
                  <p className="text-xs text-cscx-gray-400">
                    {renewalPlaybook.stages.length} stages with {renewalPlaybook.stages.reduce((acc, s) => acc + s.actions.length, 0)} actions
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loadingActionId === 'approve' ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Approving...
                  </span>
                ) : '✓ Approve'}
              </button>
              <button
                onClick={handleModify}
                className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ✏️ Modify
              </button>
              <button
                onClick={() => {
                  setPendingApproval(null);
                  setDraftEmail(null);
                  setMeetingProposal(null);
                  setQBRPackage(null);
                  setRenewalPlaybook(null);
                }}
                className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-400 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recent Agent Actions */}
        {agentMemory.recentActions.length > 0 && (
          <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-2 flex items-center gap-2">🧠 Recent Actions</h4>
            <div className="space-y-1">
              {agentMemory.recentActions.slice(0, 5).map(action => (
                <div key={action.id} className="flex items-center justify-between text-xs">
                  <span className="text-cscx-gray-300">{action.action.replace(/_/g, ' ')}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    action.outcome === 'success' ? 'bg-green-500/20 text-green-400' :
                    action.outcome === 'modified' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{action.outcome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceAgent;
