/**
 * AI Email Response Suggestions Service
 * PRD-215: Smart Email Response Suggestions
 *
 * Uses Claude to generate context-aware email response suggestions
 * that incorporate customer health, recent meetings, open issues, etc.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types (matching frontend types)
// ============================================

export type ResponseStyle = 'formal' | 'friendly' | 'brief';
export type DetectedIntent =
  | 'information_request'
  | 'support_request'
  | 'scheduling_request'
  | 'escalation'
  | 'feedback'
  | 'renewal_discussion'
  | 'general'
  | 'complaint'
  | 'thank_you';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';
export type RecommendedAction =
  | 'respond_immediately'
  | 'respond_today'
  | 'respond_this_week'
  | 'schedule_call'
  | 'escalate'
  | 'forward_to_support';

export interface EmailContext {
  customerId: string;
  customerName: string;
  healthScore: number;
  arr?: number;
  stage?: string;
  industry?: string;
  renewalDate?: string;
  lastContactDate?: string;
  openSupportTickets?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
  recentMeetings?: Array<{
    title: string;
    date: string;
    summary?: string;
    actionItems?: string[];
  }>;
  riskSignals?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  upcomingEvents?: Array<{
    type: string;
    title: string;
    date: string;
  }>;
}

export interface StakeholderInfo {
  name: string;
  email: string;
  role?: string;
  title?: string;
  isDecisionMaker?: boolean;
}

export interface IncomingEmailData {
  from: {
    email: string;
    name?: string;
  };
  subject: string;
  bodyText: string;
  receivedAt?: Date;
  threadHistory?: Array<{
    from: string;
    bodyText: string;
    sentAt: Date;
    isInbound: boolean;
  }>;
}

export interface EmailResponseSuggestion {
  id: string;
  style: ResponseStyle;
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullText: string;
  confidence: number;
  contextUsed: string[];
  suggestedSendTime: string | null;
  talkingPoints?: string[];
}

export interface GenerateSuggestionsResult {
  suggestions: EmailResponseSuggestion[];
  detectedIntent: DetectedIntent;
  urgency: UrgencyLevel;
  recommendedAction: RecommendedAction;
  contextSummary: string;
}

// ============================================
// Main Service Functions
// ============================================

/**
 * Generate email response suggestions using Claude
 */
export async function generateEmailSuggestions(
  email: IncomingEmailData,
  context: EmailContext,
  stakeholder?: StakeholderInfo,
  senderName: string = 'Your CSM'
): Promise<GenerateSuggestionsResult> {
  const anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });

  // Build the context-rich prompt
  const prompt = buildSuggestionPrompt(email, context, stakeholder, senderName);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: `You are an expert Customer Success Manager assistant that helps draft professional, context-aware email responses.

Your responses should:
- Be personalized based on the customer's health score and recent interactions
- Reference relevant context naturally (meetings, support tickets, upcoming events)
- Address all questions or concerns in the original email
- Include clear next steps when appropriate
- Match the requested tone while remaining professional
- Never be generic or templated-sounding
- Be concise but complete

Always return valid JSON matching the exact format requested.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    return parseSuggestionsResponse(responseText);
  } catch (error) {
    console.error('Email suggestion generation error:', error);
    return generateFallbackSuggestions(email, context, stakeholder, senderName);
  }
}

/**
 * Build the prompt for suggestion generation
 */
function buildSuggestionPrompt(
  email: IncomingEmailData,
  context: EmailContext,
  stakeholder?: StakeholderInfo,
  senderName: string = 'Your CSM'
): string {
  // Format recent meetings
  const meetingsStr = context.recentMeetings?.length
    ? context.recentMeetings.slice(0, 3).map(m =>
        `  - ${m.title} (${new Date(m.date).toLocaleDateString()})${m.summary ? ': ' + m.summary : ''}`
      ).join('\n')
    : 'No recent meetings';

  // Format open tickets
  const ticketsStr = context.openSupportTickets?.length
    ? context.openSupportTickets.map(t =>
        `  - #${t.id}: ${t.title} (${t.status}, ${t.priority})`
      ).join('\n')
    : 'No open support tickets';

  // Format risk signals
  const risksStr = context.riskSignals?.length
    ? context.riskSignals.map(r => `  - [${r.severity.toUpperCase()}] ${r.description}`).join('\n')
    : '';

  // Format upcoming events
  const eventsStr = context.upcomingEvents?.length
    ? context.upcomingEvents.map(e =>
        `  - ${e.type}: ${e.title} (${new Date(e.date).toLocaleDateString()})`
      ).join('\n')
    : '';

  // Format thread history if available
  const threadStr = email.threadHistory?.length
    ? email.threadHistory.slice(-3).map(m =>
        `[${m.isInbound ? 'CUSTOMER' : 'CSM'}] ${m.bodyText.slice(0, 200)}...`
      ).join('\n\n')
    : '';

  return `Generate 3 email response suggestions for this customer email.

## INCOMING EMAIL

From: ${stakeholder?.name || email.from.name || 'Customer'} (${stakeholder?.role || stakeholder?.title || 'Unknown Role'}) at ${context.customerName}
Email: ${email.from.email}
Subject: ${email.subject}
Received: ${email.receivedAt ? new Date(email.receivedAt).toLocaleString() : 'Recently'}

Body:
${email.bodyText}

${threadStr ? `## PREVIOUS THREAD MESSAGES\n${threadStr}` : ''}

## ACCOUNT CONTEXT

Customer: ${context.customerName}
Health Score: ${context.healthScore}/100
${context.arr ? `ARR: $${context.arr.toLocaleString()}` : ''}
${context.stage ? `Stage: ${context.stage}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.renewalDate ? `Renewal Date: ${context.renewalDate}` : ''}
${context.lastContactDate ? `Last Contact: ${context.lastContactDate}` : ''}

### Recent Meetings
${meetingsStr}

### Open Support Tickets
${ticketsStr}

${risksStr ? `### Risk Signals\n${risksStr}` : ''}

${eventsStr ? `### Upcoming Events\n${eventsStr}` : ''}

## RESPONSE REQUIREMENTS

1. Generate 3 response variations:
   - "formal": Professional, suitable for executives or formal situations
   - "friendly": Warm and personable, suitable for established relationships
   - "brief": Concise and efficient, for quick acknowledgments

2. For EACH response, provide:
   - Subject line (for reply, usually "Re: {original subject}")
   - Greeting (personalized to the recipient)
   - Body (address all points, reference context naturally)
   - Closing (professional sign-off)
   - Confidence score (0-1, how appropriate this response is)
   - Context used (list what account info was incorporated)
   - Suggested send time (if timing matters, else null)
   - Key talking points (optional, for complex responses)

3. Also analyze and return:
   - Detected intent of the original email
   - Urgency level (low/normal/high/critical)
   - Recommended action (respond_immediately/respond_today/respond_this_week/schedule_call/escalate/forward_to_support)
   - Brief context summary

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown code blocks) with this exact structure:
{
  "suggestions": [
    {
      "id": "sugg-formal",
      "style": "formal",
      "subject": "Re: Original Subject",
      "greeting": "Dear [Name],",
      "body": "Full response body here...",
      "closing": "Best regards,\\n${senderName}",
      "confidence": 0.92,
      "contextUsed": ["Referenced QBR meeting from Jan 15", "Noted open support ticket #1234"],
      "suggestedSendTime": null,
      "talkingPoints": ["Point 1", "Point 2"]
    },
    {
      "id": "sugg-friendly",
      "style": "friendly",
      "subject": "Re: Original Subject",
      "greeting": "Hi [Name]!",
      "body": "...",
      "closing": "Thanks!\\n${senderName}",
      "confidence": 0.88,
      "contextUsed": [...],
      "suggestedSendTime": null,
      "talkingPoints": [...]
    },
    {
      "id": "sugg-brief",
      "style": "brief",
      "subject": "Re: Original Subject",
      "greeting": "Hi [Name],",
      "body": "...",
      "closing": "Best,\\n${senderName}",
      "confidence": 0.85,
      "contextUsed": [...],
      "suggestedSendTime": null,
      "talkingPoints": [...]
    }
  ],
  "detectedIntent": "information_request",
  "urgency": "normal",
  "recommendedAction": "respond_today",
  "contextSummary": "Brief summary of key context that informed these suggestions"
}`;
}

/**
 * Parse the LLM response into structured suggestions
 */
function parseSuggestionsResponse(text: string): GenerateSuggestionsResult {
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

    // Validate and transform suggestions
    const suggestions: EmailResponseSuggestion[] = (parsed.suggestions || []).map((s: any, index: number) => ({
      id: s.id || `sugg-${index}`,
      style: s.style || 'formal',
      subject: s.subject || 'Re: Your message',
      greeting: s.greeting || 'Hi,',
      body: s.body || '',
      closing: s.closing || 'Best regards',
      fullText: `${s.greeting}\n\n${s.body}\n\n${s.closing}`,
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.7,
      contextUsed: Array.isArray(s.contextUsed) ? s.contextUsed : [],
      suggestedSendTime: s.suggestedSendTime || null,
      talkingPoints: Array.isArray(s.talkingPoints) ? s.talkingPoints : undefined,
    }));

    return {
      suggestions,
      detectedIntent: parsed.detectedIntent || 'general',
      urgency: parsed.urgency || 'normal',
      recommendedAction: parsed.recommendedAction || 'respond_today',
      contextSummary: parsed.contextSummary || 'Customer email requiring response',
    };
  } catch (error) {
    console.error('Failed to parse suggestions response:', error);
    throw new Error('Failed to parse AI-generated suggestions');
  }
}

/**
 * Generate fallback suggestions when AI fails
 */
function generateFallbackSuggestions(
  email: IncomingEmailData,
  context: EmailContext,
  stakeholder?: StakeholderInfo,
  senderName: string = 'Your CSM'
): GenerateSuggestionsResult {
  const recipientName = stakeholder?.name || email.from.name || 'there';
  const firstName = recipientName.split(' ')[0];

  const suggestions: EmailResponseSuggestion[] = [
    {
      id: 'sugg-formal',
      style: 'formal',
      subject: `Re: ${email.subject}`,
      greeting: `Dear ${recipientName},`,
      body: `Thank you for reaching out. I've reviewed your message and wanted to follow up promptly.

I understand your inquiry regarding ${email.subject}. Let me address this for you.

${context.healthScore < 70 ? 'I also want to take this opportunity to check in on how things are going with your team. Your feedback is important to us.' : ''}

Please let me know if you have any additional questions or if there's anything else I can help with.`,
      closing: `Best regards,\n${senderName}`,
      fullText: '',
      confidence: 0.6,
      contextUsed: context.healthScore < 70 ? ['Noted health score below target'] : [],
      suggestedSendTime: null,
    },
    {
      id: 'sugg-friendly',
      style: 'friendly',
      subject: `Re: ${email.subject}`,
      greeting: `Hi ${firstName}!`,
      body: `Thanks for your message! I appreciate you reaching out.

Regarding ${email.subject} - I'm happy to help with this.

${context.recentMeetings?.length ? `It was great connecting during our recent meeting. ` : ''}Let me know if you'd like to hop on a quick call to discuss further.`,
      closing: `Thanks!\n${senderName}`,
      fullText: '',
      confidence: 0.55,
      contextUsed: context.recentMeetings?.length ? ['Referenced recent meeting'] : [],
      suggestedSendTime: null,
    },
    {
      id: 'sugg-brief',
      style: 'brief',
      subject: `Re: ${email.subject}`,
      greeting: `Hi ${firstName},`,
      body: `Got it! I'm looking into this and will get back to you shortly.`,
      closing: `Best,\n${senderName}`,
      fullText: '',
      confidence: 0.5,
      contextUsed: [],
      suggestedSendTime: null,
    },
  ];

  // Set fullText for each
  suggestions.forEach(s => {
    s.fullText = `${s.greeting}\n\n${s.body}\n\n${s.closing}`;
  });

  return {
    suggestions,
    detectedIntent: 'general',
    urgency: 'normal',
    recommendedAction: 'respond_today',
    contextSummary: 'Unable to fully analyze email. Using standard response templates.',
  };
}

// ============================================
// Context Gathering Functions
// ============================================

/**
 * Gather full email context for a customer
 */
export async function gatherEmailContext(customerId: string): Promise<EmailContext | null> {
  if (!supabase) {
    // Return mock context for development
    return {
      customerId,
      customerName: 'Demo Customer',
      healthScore: 75,
      arr: 50000,
      stage: 'active',
      industry: 'Technology',
      lastContactDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  try {
    // Fetch customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerId);
      return null;
    }

    // Fetch recent meetings (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: meetings } = await supabase
      .from('meetings')
      .select('title, date, summary, action_items')
      .eq('customer_id', customerId)
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false })
      .limit(5);

    // Fetch open support tickets
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('id, title, status, priority')
      .eq('customer_id', customerId)
      .neq('status', 'closed')
      .limit(10);

    // Fetch risk signals
    const { data: risks } = await supabase
      .from('risk_signals')
      .select('type, severity, description')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .limit(5);

    // Fetch upcoming events
    const { data: events } = await supabase
      .from('customer_events')
      .select('type, title, date')
      .eq('customer_id', customerId)
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(5);

    return {
      customerId,
      customerName: customer.name,
      healthScore: customer.health_score || 70,
      arr: customer.arr,
      stage: customer.stage,
      industry: customer.industry,
      renewalDate: customer.renewal_date,
      lastContactDate: customer.last_contact_at,
      openSupportTickets: tickets?.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
      recentMeetings: meetings?.map((m: any) => ({
        title: m.title,
        date: m.date,
        summary: m.summary,
        actionItems: m.action_items,
      })),
      riskSignals: risks?.map((r: any) => ({
        type: r.type,
        severity: r.severity,
        description: r.description,
      })),
      upcomingEvents: events?.map((e: any) => ({
        type: e.type,
        title: e.title,
        date: e.date,
      })),
    };
  } catch (error) {
    console.error('Error gathering email context:', error);
    return null;
  }
}

/**
 * Get stakeholder info by email
 */
export async function getStakeholderByEmail(
  email: string,
  customerId?: string
): Promise<StakeholderInfo | null> {
  if (!supabase) {
    return {
      name: 'Demo Contact',
      email,
      role: 'Customer',
    };
  }

  try {
    let query = supabase
      .from('stakeholders')
      .select('*')
      .eq('email', email.toLowerCase());

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return {
      name: data.name,
      email: data.email,
      role: data.role,
      title: data.title,
      isDecisionMaker: data.is_decision_maker,
    };
  } catch (error) {
    console.error('Error fetching stakeholder:', error);
    return null;
  }
}

// ============================================
// Feedback Storage
// ============================================

/**
 * Store suggestion feedback for learning
 */
export async function storeSuggestionFeedback(
  userId: string,
  suggestionId: string,
  emailId: string,
  feedback: 'used' | 'edited' | 'rejected',
  rating?: number,
  notes?: string,
  originalText?: string,
  finalText?: string,
  emailContext?: Record<string, any>
): Promise<string | null> {
  if (!supabase) {
    console.log('Feedback stored (in-memory):', { suggestionId, feedback, rating });
    return 'mock-feedback-id';
  }

  try {
    const { data, error } = await supabase
      .from('email_suggestion_feedback')
      .insert({
        user_id: userId,
        suggestion_id: suggestionId,
        email_id: emailId,
        email_context: emailContext || {},
        suggestion_text: originalText,
        final_text: finalText,
        feedback,
        rating,
        notes,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error storing feedback:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error storing suggestion feedback:', error);
    return null;
  }
}

/**
 * Get feedback statistics for improving suggestions
 */
export async function getFeedbackStats(userId?: string): Promise<{
  totalSuggestions: number;
  usedCount: number;
  editedCount: number;
  rejectedCount: number;
  averageRating: number;
}> {
  if (!supabase) {
    return {
      totalSuggestions: 0,
      usedCount: 0,
      editedCount: 0,
      rejectedCount: 0,
      averageRating: 0,
    };
  }

  try {
    let query = supabase.from('email_suggestion_feedback').select('feedback, rating');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        totalSuggestions: 0,
        usedCount: 0,
        editedCount: 0,
        rejectedCount: 0,
        averageRating: 0,
      };
    }

    const usedCount = data.filter((d: any) => d.feedback === 'used').length;
    const editedCount = data.filter((d: any) => d.feedback === 'edited').length;
    const rejectedCount = data.filter((d: any) => d.feedback === 'rejected').length;
    const ratings = data.filter((d: any) => d.rating).map((d: any) => d.rating);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
      : 0;

    return {
      totalSuggestions: data.length,
      usedCount,
      editedCount,
      rejectedCount,
      averageRating,
    };
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    return {
      totalSuggestions: 0,
      usedCount: 0,
      editedCount: 0,
      rejectedCount: 0,
      averageRating: 0,
    };
  }
}

export default {
  generateEmailSuggestions,
  gatherEmailContext,
  getStakeholderByEmail,
  storeSuggestionFeedback,
  getFeedbackStats,
};
