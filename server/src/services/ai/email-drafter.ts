/**
 * AI Email Drafter Service
 *
 * Uses Claude to draft personalized, context-aware emails for CSM outreach.
 * Considers customer health, recent activity, and relationship history.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export type EmailType =
  | 'check_in'
  | 'renewal_reminder'
  | 'qbr_invite'
  | 'risk_outreach'
  | 'welcome'
  | 'follow_up'
  | 'escalation'
  | 'value_recap'
  | 'feature_announcement'
  | 'custom';

export type EmailTone = 'formal' | 'friendly' | 'urgent' | 'professional';

export interface EmailContext {
  healthScore: number;
  lastContact?: string;
  recentActivity?: string[];
  renewalDate?: string;
  arr?: number;
  industry?: string;
  stage?: string;
  riskSignals?: string[];
  successMilestones?: string[];
}

export interface DraftEmailParams {
  type: EmailType;
  customerName: string;
  recipientName: string;
  recipientRole?: string;
  recipientEmail?: string;
  context: EmailContext;
  tone?: EmailTone;
  customInstructions?: string;
  senderName?: string;
}

export interface DraftedEmail {
  subject: string;
  body: string;
  suggestedSendTime: string;
  talkingPoints?: string[];
  followUpActions?: string[];
  sentiment: 'positive' | 'neutral' | 'concerned';
}

/**
 * Draft a personalized email using Claude
 */
export async function draftEmail(params: DraftEmailParams): Promise<DraftedEmail> {
  const {
    type,
    customerName,
    recipientName,
    recipientRole,
    context,
    tone = 'professional',
    customInstructions,
    senderName = 'Your CSM',
  } = params;

  // Determine urgency based on context
  const isUrgent = context.healthScore < 50 || (context.riskSignals && context.riskSignals.length > 0);
  const effectiveTone = isUrgent ? 'urgent' : tone;

  // Build the prompt
  const prompt = buildEmailPrompt({
    type,
    customerName,
    recipientName,
    recipientRole,
    context,
    tone: effectiveTone,
    customInstructions,
    senderName,
  });

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are an expert Customer Success Manager assistant that drafts personalized, effective customer communications.

Your emails should:
- Be concise and scannable (executives are busy)
- Lead with value, not asks
- Reference specific data points when available
- Include a clear, single call-to-action
- Match the requested tone while remaining professional
- Never be generic or templated-sounding

Always return valid JSON matching the requested format.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse the JSON response
    const parsed = parseEmailResponse(responseText);
    return parsed;
  } catch (error) {
    console.error('Email drafting error:', error);

    // Return a fallback draft
    return generateFallbackEmail(params);
  }
}

/**
 * Build the prompt for email drafting
 */
function buildEmailPrompt(params: DraftEmailParams): string {
  const {
    type,
    customerName,
    recipientName,
    recipientRole,
    context,
    tone,
    customInstructions,
    senderName,
  } = params;

  const typeDescriptions: Record<EmailType, string> = {
    check_in: 'a friendly check-in to maintain the relationship',
    renewal_reminder: 'a renewal reminder with value highlights',
    qbr_invite: 'an invitation to schedule a Quarterly Business Review',
    risk_outreach: 'a proactive outreach to address potential concerns',
    welcome: 'a warm welcome email for a new customer',
    follow_up: 'a follow-up after a recent interaction',
    escalation: 'a professional escalation notification',
    value_recap: 'a summary of value delivered',
    feature_announcement: 'an announcement about new features',
    custom: 'a custom email based on the provided instructions',
  };

  const recentActivityStr = context.recentActivity?.length
    ? `Recent Activity:\n${context.recentActivity.slice(0, 5).map(a => `  - ${a}`).join('\n')}`
    : 'No recent activity tracked';

  const riskSignalsStr = context.riskSignals?.length
    ? `Risk Signals:\n${context.riskSignals.map(r => `  - ${r}`).join('\n')}`
    : '';

  const successStr = context.successMilestones?.length
    ? `Success Milestones:\n${context.successMilestones.map(s => `  - ${s}`).join('\n')}`
    : '';

  return `Draft ${typeDescriptions[type]}.

## CONTEXT

Customer: ${customerName}
Recipient: ${recipientName}${recipientRole ? ` (${recipientRole})` : ''}
Health Score: ${context.healthScore}/100
Last Contact: ${context.lastContact || 'Unknown'}
${context.renewalDate ? `Renewal Date: ${context.renewalDate}` : ''}
${context.arr ? `ARR: $${context.arr.toLocaleString()}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.stage ? `Stage: ${context.stage}` : ''}

${recentActivityStr}

${riskSignalsStr}

${successStr}

## REQUIREMENTS

Email Type: ${type}
Tone: ${tone}
Sender: ${senderName}
${customInstructions ? `\nSpecial Instructions: ${customInstructions}` : ''}

## OUTPUT FORMAT

Return a JSON object with exactly this structure:
{
  "subject": "Concise, compelling subject line (no generic templates)",
  "body": "The full email body with proper formatting. Use line breaks for readability. Sign off as ${senderName}.",
  "suggestedSendTime": "Best time to send (e.g., 'Tuesday morning', 'Within 24 hours')",
  "talkingPoints": ["Key point 1", "Key point 2"],
  "followUpActions": ["Action 1", "Action 2"],
  "sentiment": "positive" | "neutral" | "concerned"
}

Return ONLY valid JSON, no markdown code blocks.`;
}

/**
 * Parse the LLM response into a DraftedEmail
 */
function parseEmailResponse(text: string): DraftedEmail {
  let jsonString = text.trim();

  // Remove markdown code blocks if present
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.slice(7);
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.slice(3);
  }
  if (jsonString.endsWith('```')) {
    jsonString = jsonString.slice(0, -3);
  }

  jsonString = jsonString.trim();

  try {
    const parsed = JSON.parse(jsonString);
    return {
      subject: parsed.subject || 'Follow-up from your CSM',
      body: parsed.body || 'Please let me know if you have any questions.',
      suggestedSendTime: parsed.suggestedSendTime || 'Any business day morning',
      talkingPoints: parsed.talkingPoints || [],
      followUpActions: parsed.followUpActions || [],
      sentiment: parsed.sentiment || 'neutral',
    };
  } catch (error) {
    console.error('Failed to parse email response:', error);
    throw new Error('Failed to parse AI-generated email');
  }
}

/**
 * Generate a fallback email when AI fails
 */
function generateFallbackEmail(params: DraftEmailParams): DraftedEmail {
  const { type, customerName, recipientName, context, senderName = 'Your CSM' } = params;

  const subjects: Record<EmailType, string> = {
    check_in: `Quick check-in, ${recipientName}`,
    renewal_reminder: `${customerName} renewal coming up`,
    qbr_invite: `QBR scheduling for ${customerName}`,
    risk_outreach: `Let's connect, ${recipientName}`,
    welcome: `Welcome to the team, ${recipientName}!`,
    follow_up: `Following up on our conversation`,
    escalation: `Attention needed: ${customerName}`,
    value_recap: `Your success with us at ${customerName}`,
    feature_announcement: `New features available for ${customerName}`,
    custom: `Quick note from your CSM`,
  };

  const bodies: Record<EmailType, string> = {
    check_in: `Hi ${recipientName},

I wanted to reach out and see how things are going with your team at ${customerName}.

Your current health score is ${context.healthScore}/100, and I want to make sure we're meeting your needs.

Would you have 15 minutes this week for a quick sync?

Best,
${senderName}`,
    renewal_reminder: `Hi ${recipientName},

I noticed your renewal is coming up${context.renewalDate ? ` on ${context.renewalDate}` : ' soon'}. I wanted to connect to discuss your experience and explore how we can continue supporting ${customerName}.

Let me know when you're available to chat.

Best,
${senderName}`,
    qbr_invite: `Hi ${recipientName},

I'd like to schedule our Quarterly Business Review for ${customerName}. This is a great opportunity to review your progress, discuss roadmap items, and ensure alignment on your goals.

Would you be available sometime in the next two weeks?

Best,
${senderName}`,
    risk_outreach: `Hi ${recipientName},

I wanted to personally reach out as I noticed a few things I'd like to discuss with you regarding ${customerName}'s account.

Can we find time to connect this week? I'm confident we can address any concerns and ensure you're getting full value.

Best,
${senderName}`,
    welcome: `Hi ${recipientName},

Welcome to ${customerName}'s customer success journey! I'm ${senderName}, and I'll be your dedicated Customer Success Manager.

I'm here to ensure you get the most value from our partnership. Let's schedule a kickoff call to align on your goals.

Looking forward to working together!

Best,
${senderName}`,
    follow_up: `Hi ${recipientName},

Thank you for taking the time to speak with me. I wanted to follow up on our conversation and ensure we're moving forward on the items we discussed.

Please let me know if you have any questions.

Best,
${senderName}`,
    escalation: `Hi ${recipientName},

I wanted to bring an important matter to your attention regarding ${customerName}. I believe this requires your input to ensure we're providing the best possible support.

Can we schedule a call at your earliest convenience?

Best,
${senderName}`,
    value_recap: `Hi ${recipientName},

I wanted to share a quick recap of the value ${customerName} has achieved with us. Your health score is currently ${context.healthScore}/100.

I'd love to discuss what's working well and explore opportunities for even more value.

Best,
${senderName}`,
    feature_announcement: `Hi ${recipientName},

Exciting news! We've launched new features that could benefit ${customerName}. I'd love to walk you through them and discuss how they might fit your needs.

Would you have time for a quick demo this week?

Best,
${senderName}`,
    custom: `Hi ${recipientName},

I wanted to reach out regarding ${customerName}. Please let me know when you have a moment to connect.

Best,
${senderName}`,
  };

  return {
    subject: subjects[type] || `Quick note from your CSM`,
    body: bodies[type] || bodies.custom,
    suggestedSendTime: 'Tuesday or Wednesday morning',
    talkingPoints: ['Review recent activity', 'Discuss goals', 'Address any concerns'],
    followUpActions: ['Schedule follow-up if needed', 'Update CRM notes'],
    sentiment: context.healthScore < 60 ? 'concerned' : context.healthScore > 80 ? 'positive' : 'neutral',
  };
}

/**
 * Get recent activity for a customer (for email context)
 */
export async function getRecentActivity(customerId: string, limit: number = 5): Promise<string[]> {
  if (!supabase) {
    return [
      'Product demo completed',
      'Support ticket resolved',
      'Training session attended',
      'Feature adoption increased',
      'Monthly check-in completed',
    ];
  }

  try {
    // Try to get from activity_feed table if it exists
    const { data: activities } = await supabase
      .from('activity_feed')
      .select('action_type, action_data, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (activities && activities.length > 0) {
      return activities.map(a => {
        const date = new Date(a.created_at).toLocaleDateString();
        return `${a.action_type}: ${a.action_data?.summary || a.action_type} (${date})`;
      });
    }

    // Fallback to usage events
    const { data: events } = await supabase
      .from('usage_events')
      .select('event_type, event_name, timestamp')
      .eq('customer_id', customerId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (events && events.length > 0) {
      return events.map(e => {
        const date = new Date(e.timestamp).toLocaleDateString();
        return `${e.event_name || e.event_type} (${date})`;
      });
    }
  } catch (error) {
    console.error('Error fetching recent activity:', error);
  }

  return [];
}

/**
 * Get customer data for email context
 */
export async function getCustomerEmailContext(customerId: string): Promise<EmailContext | null> {
  if (!supabase) {
    return {
      healthScore: 75,
      lastContact: 'Last week',
      recentActivity: ['Login', 'Feature used'],
      arr: 50000,
      industry: 'Technology',
      stage: 'active',
    };
  }

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('health_score, arr, industry, stage, updated_at')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return null;
    }

    const recentActivity = await getRecentActivity(customerId);

    return {
      healthScore: customer.health_score || 70,
      lastContact: customer.updated_at ? new Date(customer.updated_at).toLocaleDateString() : undefined,
      recentActivity,
      arr: customer.arr,
      industry: customer.industry,
      stage: customer.stage,
    };
  } catch (error) {
    console.error('Error fetching customer context:', error);
    return null;
  }
}

/**
 * Batch draft multiple emails for different purposes
 */
export async function draftEmailBatch(
  customerName: string,
  recipientName: string,
  context: EmailContext,
  types: EmailType[]
): Promise<Record<EmailType, DraftedEmail>> {
  const results: Partial<Record<EmailType, DraftedEmail>> = {};

  // Draft emails in parallel for efficiency
  const drafts = await Promise.all(
    types.map(type =>
      draftEmail({
        type,
        customerName,
        recipientName,
        context,
      }).then(draft => ({ type, draft }))
    )
  );

  for (const { type, draft } of drafts) {
    results[type] = draft;
  }

  return results as Record<EmailType, DraftedEmail>;
}

export default {
  draftEmail,
  draftEmailBatch,
  getRecentActivity,
  getCustomerEmailContext,
};
