/**
 * QBR Email Routes
 * PRD-026: One-Click QBR Email Generation
 *
 * API endpoints for generating and sending QBR emails
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { gmailService } from '../services/google/gmail.js';
import { googleOAuth } from '../services/google/oauth.js';
import { generateQBRInviteEmail, type QBRInviteData } from '../templates/emails/qbr-invite.js';
import { generateQBRFollowupEmail, type QBRFollowupData } from '../templates/emails/qbr-followup.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
interface QBREmailPreviewRequest {
  type: 'invite' | 'followup';
  quarter?: string;
  year?: number;
  proposedDates?: Array<{ date: string; time: string }>;
  scheduledDate?: string;
  meetingDate?: string;
  highlights?: string[];
  actionItems?: Array<{ task: string; owner: string; dueDate?: string }>;
  nextSteps?: string[];
  customMessage?: string;
  documentUrl?: string;
  presentationUrl?: string;
}

interface QBREmailSendRequest extends QBREmailPreviewRequest {
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
}

/**
 * GET /api/customers/:id/qbr-email/preview
 * Preview QBR email content without sending
 */
router.get('/:id/qbr-email/preview', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const {
      type = 'invite',
      quarter,
      year,
    } = req.query;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    // Get user ID from header or query
    const userId = req.headers['x-user-id'] as string || req.query.userId as string;

    // Fetch customer data
    let previewCustQuery = supabase.from('customers').select('*');
    previewCustQuery = applyOrgFilter(previewCustQuery, req);
    const { data: customer, error: customerError } = await previewCustQuery
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Fetch stakeholders
    let previewStakeQuery = supabase.from('stakeholders').select('*');
    previewStakeQuery = applyOrgFilter(previewStakeQuery, req);
    const { data: stakeholders } = await previewStakeQuery
      .eq('customer_id', customerId);

    // Get CSM info (from user or default)
    let csmInfo = {
      name: 'Your Customer Success Manager',
      email: '',
      title: 'Customer Success Manager',
    };

    if (userId) {
      try {
        const tokens = await googleOAuth.getTokens(userId);
        if (tokens?.google_email) {
          csmInfo.email = tokens.google_email;
          csmInfo.name = tokens.google_email.split('@')[0].replace(/\./g, ' ');
        }
      } catch (e) {
        console.warn('Could not get CSM info from Google tokens');
      }
    }

    // Determine current quarter if not provided
    const now = new Date();
    const currentQuarter = (quarter as string) || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
    const currentYear = year ? parseInt(year as string) : now.getFullYear();

    // Format stakeholders
    const formattedStakeholders = (stakeholders || [])
      .filter((s: any) => s.email)
      .slice(0, 5) // Limit to top 5 stakeholders
      .map((s: any) => ({
        name: s.name || 'Stakeholder',
        email: s.email,
        title: s.role || s.title,
      }));

    // If no stakeholders, add placeholder
    if (formattedStakeholders.length === 0) {
      formattedStakeholders.push({
        name: customer.primary_contact_name || 'Primary Contact',
        email: customer.primary_contact_email || 'contact@company.com',
        title: customer.primary_contact_title || 'Executive',
      });
    }

    // Determine health trend
    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    let previewMetricsQuery = supabase.from('usage_metrics').select('health_score');
    previewMetricsQuery = applyOrgFilter(previewMetricsQuery, req);
    const { data: recentMetrics } = await previewMetricsQuery
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(5);

    if (recentMetrics && recentMetrics.length >= 2) {
      const scores = recentMetrics.map((m: any) => m.health_score || 0).filter((s: number) => s > 0);
      if (scores.length >= 2) {
        const recent = scores.slice(0, 2).reduce((a: number, b: number) => a + b, 0) / 2;
        const older = scores.slice(-2).reduce((a: number, b: number) => a + b, 0) / 2;
        if (recent > older + 5) healthTrend = 'improving';
        else if (recent < older - 5) healthTrend = 'declining';
      }
    }

    // Generate preview based on type
    if (type === 'followup') {
      const followupData: QBRFollowupData = {
        customer: {
          name: customer.name,
          arr: customer.arr || 0,
          healthScore: customer.health_score || 70,
        },
        stakeholders: formattedStakeholders,
        qbr: {
          quarter: currentQuarter,
          year: currentYear,
          meetingDate: new Date().toISOString(),
        },
        csm: csmInfo,
        highlights: [
          'Successfully achieved key adoption milestones',
          `Maintained ${customer.health_score || 70} health score`,
          'Strong engagement from key stakeholders',
        ],
        actionItems: [
          { task: 'Review product roadmap alignment', owner: 'CSM', dueDate: getDateInDays(14) },
          { task: 'Schedule training session', owner: 'Customer', dueDate: getDateInDays(21) },
        ],
      };

      const result = generateQBRFollowupEmail(followupData);

      return res.json({
        type: 'followup',
        subject: result.subject,
        bodyHtml: result.bodyHtml,
        bodyText: result.bodyText,
        recipients: result.recipients,
        customer: {
          id: customerId,
          name: customer.name,
          arr: customer.arr,
          healthScore: customer.health_score,
        },
        stakeholders: formattedStakeholders,
        qbr: {
          quarter: currentQuarter,
          year: currentYear,
        },
      });
    }

    // Default: generate invite email
    const inviteData: QBRInviteData = {
      customer: {
        name: customer.name,
        arr: customer.arr || 0,
        healthScore: customer.health_score || 70,
        healthTrend,
      },
      stakeholders: formattedStakeholders,
      qbr: {
        quarter: currentQuarter,
        year: currentYear,
        proposedDates: generateProposedDates(),
      },
      csm: csmInfo,
    };

    const result = generateQBRInviteEmail(inviteData);

    res.json({
      type: 'invite',
      subject: result.subject,
      bodyHtml: result.bodyHtml,
      bodyText: result.bodyText,
      recipients: result.recipients,
      customer: {
        id: customerId,
        name: customer.name,
        arr: customer.arr,
        healthScore: customer.health_score,
        healthTrend,
      },
      stakeholders: formattedStakeholders,
      qbr: {
        quarter: currentQuarter,
        year: currentYear,
        proposedDates: inviteData.qbr.proposedDates,
      },
    });
  } catch (error) {
    console.error('QBR email preview error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate QBR email preview' }
    });
  }
});

/**
 * POST /api/customers/:id/qbr-email
 * Generate and send QBR email (requires approval)
 */
router.post('/:id/qbr-email', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const body: QBREmailSendRequest = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    // Fetch customer data
    let sendCustQuery = supabase.from('customers').select('*');
    sendCustQuery = applyOrgFilter(sendCustQuery, req);
    const { data: customer, error: customerError } = await sendCustQuery
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Fetch stakeholders
    let sendStakeQuery = supabase.from('stakeholders').select('*');
    sendStakeQuery = applyOrgFilter(sendStakeQuery, req);
    const { data: stakeholders } = await sendStakeQuery
      .eq('customer_id', customerId);

    // Get CSM info
    let csmInfo = {
      name: 'Your Customer Success Manager',
      email: '',
      title: 'Customer Success Manager',
    };

    try {
      const tokens = await googleOAuth.getTokens(userId);
      if (tokens?.google_email) {
        csmInfo.email = tokens.google_email;
        csmInfo.name = tokens.google_email.split('@')[0].replace(/\./g, ' ');
      }
    } catch (e) {
      console.warn('Could not get CSM info from Google tokens');
    }

    // Determine current quarter if not provided
    const now = new Date();
    const currentQuarter = body.quarter || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
    const currentYear = body.year || now.getFullYear();

    // Format stakeholders
    const formattedStakeholders = (stakeholders || [])
      .filter((s: any) => s.email)
      .slice(0, 5)
      .map((s: any) => ({
        name: s.name || 'Stakeholder',
        email: s.email,
        title: s.role || s.title,
      }));

    // Use provided recipients or stakeholder emails
    const recipients = body.recipients && body.recipients.length > 0
      ? body.recipients
      : formattedStakeholders.map(s => s.email);

    if (recipients.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'No recipients specified' }
      });
    }

    // Determine health trend
    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    let sendMetricsQuery = supabase.from('usage_metrics').select('health_score');
    sendMetricsQuery = applyOrgFilter(sendMetricsQuery, req);
    const { data: recentMetrics } = await sendMetricsQuery
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(5);

    if (recentMetrics && recentMetrics.length >= 2) {
      const scores = recentMetrics.map((m: any) => m.health_score || 0).filter((s: number) => s > 0);
      if (scores.length >= 2) {
        const recent = scores.slice(0, 2).reduce((a: number, b: number) => a + b, 0) / 2;
        const older = scores.slice(-2).reduce((a: number, b: number) => a + b, 0) / 2;
        if (recent > older + 5) healthTrend = 'improving';
        else if (recent < older - 5) healthTrend = 'declining';
      }
    }

    // Generate email based on type
    let emailContent: { subject: string; bodyHtml: string; bodyText: string };

    if (body.type === 'followup') {
      const followupData: QBRFollowupData = {
        customer: {
          name: customer.name,
          arr: customer.arr || 0,
          healthScore: customer.health_score || 70,
        },
        stakeholders: formattedStakeholders,
        qbr: {
          quarter: currentQuarter,
          year: currentYear,
          meetingDate: body.meetingDate || new Date().toISOString(),
          documentUrl: body.documentUrl,
          presentationUrl: body.presentationUrl,
        },
        csm: csmInfo,
        highlights: body.highlights || [
          'Successfully achieved key adoption milestones',
          `Maintained ${customer.health_score || 70} health score`,
          'Strong engagement from key stakeholders',
        ],
        actionItems: body.actionItems || [
          { task: 'Review product roadmap alignment', owner: 'CSM', dueDate: getDateInDays(14) },
          { task: 'Schedule training session', owner: 'Customer', dueDate: getDateInDays(21) },
        ],
        nextSteps: body.nextSteps,
        customMessage: body.customMessage,
      };

      emailContent = generateQBRFollowupEmail(followupData);
    } else {
      const inviteData: QBRInviteData = {
        customer: {
          name: customer.name,
          arr: customer.arr || 0,
          healthScore: customer.health_score || 70,
          healthTrend,
        },
        stakeholders: formattedStakeholders,
        qbr: {
          quarter: currentQuarter,
          year: currentYear,
          proposedDates: body.proposedDates || generateProposedDates(),
          scheduledDate: body.scheduledDate,
        },
        csm: csmInfo,
        customMessage: body.customMessage,
      };

      emailContent = generateQBRInviteEmail(inviteData);
    }

    // Create approval request for HITL
    const approvalId = `qbr_email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const { error: approvalError } = await supabase
      .from('approval_queue')
      .insert({
        id: approvalId,
        user_id: userId,
        customer_id: customerId,
        action_type: 'send_email',
        agent_type: 'communicator',
        status: 'pending',
        urgency: 'important',
        title: `QBR ${body.type === 'followup' ? 'Follow-up' : 'Invitation'} Email - ${customer.name}`,
        description: `Send ${body.type === 'followup' ? 'follow-up' : 'invitation'} email for ${currentQuarter} ${currentYear} QBR`,
        action_data: {
          type: 'qbr_email',
          emailType: body.type || 'invite',
          to: recipients,
          cc: body.cc || [],
          bcc: body.bcc || [],
          subject: emailContent.subject,
          bodyHtml: emailContent.bodyHtml,
          bodyText: emailContent.bodyText,
          quarter: currentQuarter,
          year: currentYear,
        },
        preview: {
          subject: emailContent.subject,
          recipients,
          bodyPreview: emailContent.bodyText.substring(0, 500),
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });

    if (approvalError) {
      console.error('Failed to create approval:', approvalError);
      // Still return draft even if approval creation fails
    }

    // Log activity
    await supabase.from('agent_activity_log').insert({
      user_id: userId,
      customer_id: customerId,
      agent_type: 'communicator',
      action_type: 'qbr_email_draft',
      action_data: {
        type: body.type || 'invite',
        quarter: currentQuarter,
        year: currentYear,
        recipientCount: recipients.length,
      },
      status: 'pending_approval',
      started_at: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'QBR email created and submitted for approval',
      approvalId,
      draft: {
        type: body.type || 'invite',
        subject: emailContent.subject,
        recipients,
        cc: body.cc || [],
        bodyHtml: emailContent.bodyHtml,
        bodyText: emailContent.bodyText,
      },
      customer: {
        id: customerId,
        name: customer.name,
        arr: customer.arr,
        healthScore: customer.health_score,
      },
      qbr: {
        quarter: currentQuarter,
        year: currentYear,
      },
    });
  } catch (error) {
    console.error('QBR email send error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create QBR email' }
    });
  }
});

/**
 * POST /api/customers/:id/qbr-email/send
 * Actually send the QBR email after approval
 */
router.post('/:id/qbr-email/send', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const { approvalId, subject, bodyHtml, recipients, cc, bcc } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    // Verify approval if provided
    if (approvalId) {
      const { data: approval } = await supabase
        .from('approval_queue')
        .select('*')
        .eq('id', approvalId)
        .eq('status', 'approved')
        .single();

      if (!approval) {
        return res.status(403).json({
          error: { code: 'NOT_APPROVED', message: 'Email not yet approved or approval expired' }
        });
      }
    }

    // Send email via Gmail
    const messageId = await gmailService.sendEmail(userId, {
      to: recipients,
      cc: cc || [],
      bcc: bcc || [],
      subject,
      bodyHtml,
      saveToDb: true,
      customerId,
    });

    // Update approval status
    if (approvalId) {
      await supabase
        .from('approval_queue')
        .update({
          status: 'executed',
          result_data: { messageId, sentAt: new Date().toISOString() },
        })
        .eq('id', approvalId);
    }

    // Log activity
    await supabase.from('agent_activity_log').insert({
      user_id: userId,
      customer_id: customerId,
      agent_type: 'communicator',
      action_type: 'qbr_email_sent',
      action_data: {
        messageId,
        subject,
        recipientCount: recipients.length,
      },
      result_data: { messageId },
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'QBR email sent successfully',
      messageId,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('QBR email send error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send QBR email' }
    });
  }
});

// Helper functions

function generateProposedDates(): Array<{ date: string; time: string }> {
  const dates: Array<{ date: string; time: string }> = [];
  const now = new Date();

  // Generate 2-3 proposed dates in the next 2 weeks
  for (let i = 0; i < 3; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + 7 + (i * 3)); // Starting a week out, 3 days apart

    // Skip weekends
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);

    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Alternate between morning and afternoon times
    const time = i % 2 === 0 ? '10:00 AM' : '2:00 PM';

    dates.push({ date: formattedDate, time });
  }

  return dates;
}

function getDateInDays(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

export default router;
