/**
 * AI Meeting Prep Service
 *
 * Generates comprehensive meeting briefs with context, talking points,
 * and questions to ask based on customer data and AI analysis.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export type MeetingType = 'qbr' | 'check_in' | 'escalation' | 'renewal' | 'kickoff' | 'training';

export interface StakeholderInfo {
  name: string;
  role?: string;
  email?: string;
  isChampion?: boolean;
  lastContact?: string;
}

export interface MeetingPrepParams {
  customerId: string;
  customerName: string;
  meetingType: MeetingType;
  attendees?: string[];
  additionalContext?: string;
}

export interface MeetingBrief {
  summary: string;
  talkingPoints: string[];
  risksToAddress: string[];
  questionsToAsk: string[];
  successMetrics: string[];
  stakeholderNotes: string[];
  suggestedAgenda: string[];
  prepChecklist: string[];
}

/**
 * Prepare a comprehensive meeting brief
 */
export async function prepareMeetingBrief(params: MeetingPrepParams): Promise<MeetingBrief> {
  const { customerId, customerName, meetingType, attendees, additionalContext } = params;

  // Gather context from database
  const customer = await getCustomerData(customerId);
  const recentActivity = await getActivityFeed(customerId, 30);
  const healthHistory = await getHealthHistory(customerId, 90);
  const stakeholders = await getStakeholders(customerId);
  const riskSignals = await getRiskSignals(customerId);

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const prompt = buildMeetingPrepPrompt({
      customerName,
      meetingType,
      attendees,
      additionalContext,
      customer,
      recentActivity,
      healthHistory,
      stakeholders,
      riskSignals,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an expert Customer Success Manager preparing for an important customer meeting.

Your meeting briefs should:
- Be actionable and specific to the customer
- Highlight both opportunities and risks
- Include data-driven insights
- Provide questions that demonstrate deep understanding
- Suggest ways to strengthen the relationship

Always return valid JSON matching the requested format.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    return parseMeetingBriefResponse(responseText, meetingType, customerName);
  } catch (error) {
    console.error('Meeting prep error:', error);
    return generateFallbackBrief(params);
  }
}

/**
 * Build the prompt for meeting prep
 */
function buildMeetingPrepPrompt(context: {
  customerName: string;
  meetingType: MeetingType;
  attendees?: string[];
  additionalContext?: string;
  customer: Record<string, unknown> | null;
  recentActivity: string[];
  healthHistory: Array<{ date: string; score: number }>;
  stakeholders: StakeholderInfo[];
  riskSignals: string[];
}): string {
  const meetingDescriptions: Record<MeetingType, string> = {
    qbr: 'Quarterly Business Review - comprehensive performance review and planning',
    check_in: 'Regular check-in call to maintain relationship',
    escalation: 'Escalation meeting to address critical issues',
    renewal: 'Renewal discussion to secure continued partnership',
    kickoff: 'Project kickoff to align on goals and timeline',
    training: 'Training session to improve product adoption',
  };

  const healthTrend = context.healthHistory.length >= 2
    ? context.healthHistory[context.healthHistory.length - 1].score -
      context.healthHistory[0].score
    : 0;

  return `Generate a comprehensive meeting brief for an upcoming ${meetingDescriptions[context.meetingType]}.

## CUSTOMER CONTEXT

Customer: ${context.customerName}
Meeting Type: ${context.meetingType.toUpperCase()}
${context.attendees?.length ? `Attendees: ${context.attendees.join(', ')}` : ''}
${context.additionalContext ? `Additional Context: ${context.additionalContext}` : ''}

## CUSTOMER DATA

Health Score: ${context.customer?.health_score || 'Unknown'}/100
Health Trend: ${healthTrend > 0 ? `+${healthTrend} (improving)` : healthTrend < 0 ? `${healthTrend} (declining)` : 'Stable'}
ARR: ${context.customer?.arr ? `$${Number(context.customer.arr).toLocaleString()}` : 'Unknown'}
Industry: ${context.customer?.industry || 'Unknown'}
Stage: ${context.customer?.stage || 'Unknown'}

## STAKEHOLDERS
${context.stakeholders.length > 0
    ? context.stakeholders.map(s =>
        `- ${s.name}${s.role ? ` (${s.role})` : ''}${s.isChampion ? ' [CHAMPION]' : ''}`
      ).join('\n')
    : 'No stakeholder data available'}

## RECENT ACTIVITY (Last 30 days)
${context.recentActivity.length > 0
    ? context.recentActivity.map(a => `- ${a}`).join('\n')
    : 'No recent activity tracked'}

## RISK SIGNALS
${context.riskSignals.length > 0
    ? context.riskSignals.map(r => `- ⚠️ ${r}`).join('\n')
    : 'No active risk signals'}

## OUTPUT FORMAT

Return a JSON object with exactly this structure:
{
  "summary": "2-3 sentence executive summary of the meeting context and objectives",
  "talkingPoints": ["5-7 specific talking points tailored to this customer"],
  "risksToAddress": ["Any risks or concerns to proactively address"],
  "questionsToAsk": ["5-7 insightful questions to deepen the relationship"],
  "successMetrics": ["Key metrics to discuss or celebrate"],
  "stakeholderNotes": ["Important notes about specific stakeholders attending"],
  "suggestedAgenda": ["Recommended agenda items with time allocations"],
  "prepChecklist": ["Things to do before the meeting"]
}

Return ONLY valid JSON, no markdown code blocks.`;
}

/**
 * Parse the AI response into a MeetingBrief
 */
function parseMeetingBriefResponse(
  text: string,
  meetingType: MeetingType,
  customerName: string
): MeetingBrief {
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
      summary: parsed.summary || `Preparing for ${meetingType} with ${customerName}`,
      talkingPoints: parsed.talkingPoints || [],
      risksToAddress: parsed.risksToAddress || [],
      questionsToAsk: parsed.questionsToAsk || [],
      successMetrics: parsed.successMetrics || [],
      stakeholderNotes: parsed.stakeholderNotes || [],
      suggestedAgenda: parsed.suggestedAgenda || [],
      prepChecklist: parsed.prepChecklist || [],
    };
  } catch (error) {
    console.error('Failed to parse meeting brief:', error);
    throw new Error('Failed to parse AI-generated meeting brief');
  }
}

/**
 * Generate a fallback brief when AI fails
 */
function generateFallbackBrief(params: MeetingPrepParams): MeetingBrief {
  const { customerName, meetingType } = params;

  const agendas: Record<MeetingType, string[]> = {
    qbr: [
      '1. Welcome & Introductions (5 min)',
      '2. Business Performance Review (15 min)',
      '3. Product Usage & Adoption (10 min)',
      '4. Success Stories & Wins (10 min)',
      '5. Challenges & Opportunities (10 min)',
      '6. Roadmap Preview (5 min)',
      '7. Q&A & Next Steps (5 min)',
    ],
    check_in: [
      '1. Open conversation (5 min)',
      '2. Recent updates from customer (10 min)',
      '3. Product updates & tips (5 min)',
      '4. Questions & concerns (5 min)',
      '5. Next steps (5 min)',
    ],
    escalation: [
      '1. Acknowledge the situation (5 min)',
      '2. Review the issues (10 min)',
      '3. Root cause discussion (10 min)',
      '4. Resolution plan (10 min)',
      '5. Commitments & timeline (10 min)',
      '6. Follow-up plan (5 min)',
    ],
    renewal: [
      '1. Relationship recap (5 min)',
      '2. Value delivered review (15 min)',
      '3. Future goals discussion (10 min)',
      '4. Renewal terms (10 min)',
      '5. Questions & next steps (10 min)',
    ],
    kickoff: [
      '1. Team introductions (10 min)',
      '2. Project overview & goals (10 min)',
      '3. Success criteria (10 min)',
      '4. Timeline & milestones (10 min)',
      '5. Communication plan (5 min)',
      '6. Q&A (5 min)',
    ],
    training: [
      '1. Introduction & objectives (5 min)',
      '2. Feature deep-dive (20 min)',
      '3. Hands-on practice (15 min)',
      '4. Q&A (10 min)',
      '5. Resources & next steps (5 min)',
    ],
  };

  return {
    summary: `Upcoming ${meetingType} meeting with ${customerName}. Review customer data and recent activity before the call.`,
    talkingPoints: [
      `Welcome and thank ${customerName} for their partnership`,
      'Review recent product usage and engagement',
      'Discuss any open support tickets or issues',
      'Share relevant product updates or new features',
      'Align on upcoming goals and objectives',
    ],
    risksToAddress: [
      'Check for any declining usage patterns',
      'Review any outstanding concerns from previous conversations',
    ],
    questionsToAsk: [
      'How are things going overall with the team?',
      'What are your key priorities for the next quarter?',
      'Are there any pain points we should address?',
      'How can we better support your goals?',
      'Who else should we be talking to on your team?',
    ],
    successMetrics: [
      'User adoption rate',
      'Feature utilization',
      'Support ticket resolution time',
      'Customer satisfaction score',
    ],
    stakeholderNotes: [
      'Confirm attendee list before the meeting',
      'Review past interactions with each attendee',
    ],
    suggestedAgenda: agendas[meetingType] || agendas.check_in,
    prepChecklist: [
      'Review customer health dashboard',
      'Check recent support tickets',
      'Prepare relevant data/charts',
      'Test screen sharing and meeting link',
      'Prepare follow-up email template',
    ],
  };
}

// Database helpers

async function getCustomerData(customerId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) {
    return {
      health_score: 75,
      arr: 100000,
      industry: 'Technology',
      stage: 'active',
    };
  }

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  return data;
}

async function getActivityFeed(customerId: string, days: number): Promise<string[]> {
  if (!supabase) {
    return [
      'Login activity increased 20%',
      'Completed onboarding milestone',
      'Support ticket resolved',
      'Feature adoption improved',
    ];
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Try activity_feed table
    const { data: activities } = await supabase
      .from('activity_feed')
      .select('action_type, action_data, created_at')
      .eq('customer_id', customerId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (activities && activities.length > 0) {
      return activities.map(a => {
        const date = new Date(a.created_at).toLocaleDateString();
        return `${a.action_type} (${date})`;
      });
    }

    // Fallback to usage events
    const { data: events } = await supabase
      .from('usage_events')
      .select('event_type, timestamp')
      .eq('customer_id', customerId)
      .gte('timestamp', cutoff.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10);

    if (events && events.length > 0) {
      return events.map(e => {
        const date = new Date(e.timestamp).toLocaleDateString();
        return `${e.event_type} (${date})`;
      });
    }
  } catch (error) {
    console.error('Error fetching activity:', error);
  }

  return [];
}

async function getHealthHistory(
  customerId: string,
  days: number
): Promise<Array<{ date: string; score: number }>> {
  if (!supabase) {
    return [
      { date: '2025-01-01', score: 72 },
      { date: '2025-01-15', score: 75 },
      { date: '2025-01-23', score: 78 },
    ];
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const { data } = await supabase
      .from('health_score_history')
      .select('calculated_at, score')
      .eq('customer_id', customerId)
      .gte('calculated_at', cutoff.toISOString())
      .order('calculated_at', { ascending: true });

    if (data && data.length > 0) {
      return data.map(d => ({
        date: d.calculated_at.split('T')[0],
        score: d.score,
      }));
    }
  } catch (error) {
    console.error('Error fetching health history:', error);
  }

  return [];
}

async function getStakeholders(customerId: string): Promise<StakeholderInfo[]> {
  if (!supabase) {
    return [
      { name: 'John Smith', role: 'VP of Operations', isChampion: true },
      { name: 'Jane Doe', role: 'Product Manager' },
    ];
  }

  try {
    // Try to get from contracts table
    const { data: contract } = await supabase
      .from('contracts')
      .select('extracted_data')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (contract?.extracted_data) {
      const extractedData = contract.extracted_data as { stakeholders?: StakeholderInfo[] };
      if (extractedData.stakeholders) {
        return extractedData.stakeholders.map(s => ({
          name: s.name || 'Unknown',
          role: s.role,
          email: s.email,
          isChampion: false,
        }));
      }
    }
  } catch (error) {
    console.error('Error fetching stakeholders:', error);
  }

  return [];
}

async function getRiskSignals(customerId: string): Promise<string[]> {
  const signals: string[] = [];

  if (!supabase) {
    return ['Monitor usage trends', 'Check renewal timeline'];
  }

  try {
    // Get customer data for risk analysis
    const { data: customer } = await supabase
      .from('customers')
      .select('health_score, stage, renewal_date')
      .eq('id', customerId)
      .single();

    if (customer) {
      // Health score risk
      if (customer.health_score && customer.health_score < 60) {
        signals.push('Low health score indicates engagement issues');
      }

      // Stage risk
      if (customer.stage === 'at_risk') {
        signals.push('Customer marked as at-risk');
      }

      // Renewal proximity risk
      if (customer.renewal_date) {
        const daysToRenewal = Math.ceil(
          (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
        if (daysToRenewal <= 60 && daysToRenewal > 0) {
          signals.push(`Renewal in ${daysToRenewal} days - ensure alignment`);
        }
      }
    }

    // Check for usage decline
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count } = await supabase
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .gte('timestamp', weekAgo.toISOString());

    if (count === 0) {
      signals.push('No product usage in the last 7 days');
    }
  } catch (error) {
    console.error('Error analyzing risks:', error);
  }

  return signals;
}

/**
 * Format meeting brief as a document
 */
export function formatMeetingBriefAsDocument(brief: MeetingBrief, customerName: string, meetingType: MeetingType): string {
  const date = new Date().toLocaleDateString();

  return `# Meeting Prep Brief
## ${customerName} - ${meetingType.toUpperCase()}
### Generated: ${date}

---

## Executive Summary
${brief.summary}

---

## Suggested Agenda
${brief.suggestedAgenda.map(item => `- ${item}`).join('\n')}

---

## Key Talking Points
${brief.talkingPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

---

## Questions to Ask
${brief.questionsToAsk.map((q, i) => `${i + 1}. ${q}`).join('\n')}

---

## Risks to Address
${brief.risksToAddress.length > 0
    ? brief.risksToAddress.map(r => `- ⚠️ ${r}`).join('\n')
    : '- No active risk signals'}

---

## Success Metrics to Discuss
${brief.successMetrics.map(m => `- ${m}`).join('\n')}

---

## Stakeholder Notes
${brief.stakeholderNotes.map(n => `- ${n}`).join('\n')}

---

## Pre-Meeting Checklist
${brief.prepChecklist.map(item => `- [ ] ${item}`).join('\n')}

---

*[AI Generated] Review and customize before the meeting.*
*Generated: ${new Date().toISOString()}*
`;
}

export default {
  prepareMeetingBrief,
  formatMeetingBriefAsDocument,
};
