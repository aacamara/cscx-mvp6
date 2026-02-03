/**
 * Email Thread Summarizer Service (PRD-009)
 *
 * AI-powered analysis of email threads for comprehensive summaries,
 * sentiment analysis, action items, and relationship insights.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ParsedThread, ParsedEmail, EmailParticipant } from '../email/threadParser.js';

// Types
export interface ThreadSummary {
  id: string;
  threadId: string;
  customerId?: string;
  analyzedAt: Date;

  // Basic info
  subject: string;
  messageCount: number;
  participantCount: number;
  duration: string;
  dateRange: string;

  // Summary
  overview: string;
  keyPoints: KeyPoint[];
  resolution?: string;

  // Timeline
  timeline: TimelineEntry[];

  // Action Items
  actionItems: ActionItem[];
  commitments: Commitment[];
  openItems: OpenItem[];

  // Sentiment Analysis
  sentimentArc: SentimentArc;
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';

  // Response Metrics
  responseMetrics: ResponseMetrics;

  // Relationship Insights
  relationshipInsights: RelationshipInsight[];

  // Suggested Actions
  suggestedActions: SuggestedAction[];

  // Metadata
  confidence: number;
  modelUsed: string;
  processingTime: number;
}

export interface KeyPoint {
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

export interface TimelineEntry {
  date: string;
  from: string;
  keyContent: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'concerned' | 'relieved' | 'waiting';
  sentimentEmoji: string;
}

export interface ActionItem {
  description: string;
  owner: string;
  ownerType: 'internal' | 'customer' | 'unknown';
  status: 'pending' | 'done' | 'blocked';
  dueDate?: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface Commitment {
  description: string;
  madeBy: string;
  deadline?: string;
}

export interface OpenItem {
  description: string;
  waitingOn: string;
  daysOpen: number;
  urgency: 'high' | 'medium' | 'low';
}

export interface SentimentArc {
  start: string;
  middle: string;
  end: string;
  trend: 'improving' | 'stable' | 'declining' | 'volatile';
}

export interface ResponseMetrics {
  averageResponseTimeHours: number;
  longestGapHours: number;
  threadDurationDays: number;
  internalResponsiveness: string;
  customerResponsiveness: string;
}

export interface RelationshipInsight {
  observation: string;
  signal: 'positive' | 'neutral' | 'concerning';
}

export interface SuggestedAction {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DraftReply {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  suggestedAttachments?: string[];
  tone: string;
}

// Initialize services
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * Email Thread Summarizer Service
 */
export class EmailSummarizerService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Generate a comprehensive summary of an email thread
   */
  async summarizeThread(
    thread: ParsedThread,
    options?: {
      customerId?: string;
      customerName?: string;
      userEmail?: string;
    }
  ): Promise<ThreadSummary> {
    const startTime = Date.now();

    // Build the thread content for analysis
    const threadContent = this.buildThreadContent(thread);

    // Build the analysis prompt
    const prompt = this.buildAnalysisPrompt(thread, threadContent, options);

    // Call Claude for analysis
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse the analysis
    const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
    const analysis = this.parseAnalysisResponse(analysisText, thread);

    const processingTime = Date.now() - startTime;

    // Build and store the summary
    const summary: ThreadSummary = {
      id: '', // Will be set after storage
      threadId: thread.id,
      customerId: options?.customerId,
      analyzedAt: new Date(),
      subject: thread.subject,
      messageCount: thread.messageCount,
      participantCount: thread.participants.length,
      duration: this.formatDuration(thread.duration),
      dateRange: this.formatDateRange(thread.startDate, thread.endDate),
      ...analysis,
      confidence: analysis.confidence || 0.85,
      modelUsed: 'claude-sonnet-4-20250514',
      processingTime,
    };

    // Store the summary
    summary.id = await this.storeSummary(summary);

    return summary;
  }

  /**
   * Draft a reply to the email thread
   */
  async draftReply(
    thread: ParsedThread,
    summary: ThreadSummary,
    options?: {
      replyTo?: string; // specific participant to reply to
      focus?: string; // what to focus the reply on
      tone?: 'formal' | 'friendly' | 'urgent' | 'apologetic';
      includeContext?: boolean;
      senderName?: string;
    }
  ): Promise<DraftReply> {
    const lastMessage = thread.messages[thread.messages.length - 1];
    const replyTo = options?.replyTo || lastMessage.from.email;

    const prompt = this.buildReplyPrompt(thread, summary, {
      ...options,
      replyTo,
    });

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    return this.parseReplyResponse(responseText, thread, replyTo);
  }

  /**
   * Build thread content string for analysis
   */
  private buildThreadContent(thread: ParsedThread): string {
    return thread.messages
      .map((msg, idx) => {
        const date = msg.date.toLocaleString();
        const from = msg.from.name ? `${msg.from.name} <${msg.from.email}>` : msg.from.email;
        const to = msg.to.map(t => t.name ? `${t.name} <${t.email}>` : t.email).join(', ');

        return `--- Email ${idx + 1} of ${thread.messages.length} ---
From: ${from}
To: ${to}
Date: ${date}
Subject: ${msg.subject}

${msg.bodyText}`;
      })
      .join('\n\n');
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(
    thread: ParsedThread,
    content: string,
    options?: { customerName?: string; userEmail?: string }
  ): string {
    const customerContext = options?.customerName
      ? `\nCustomer/Account: ${options.customerName}`
      : '';

    const userContext = options?.userEmail
      ? `\nYour email (internal): ${options.userEmail}`
      : '';

    const participants = thread.participants
      .map(p => `${p.name || p.email} (${p.role}, ${p.isInternal ? 'internal' : 'external'})`)
      .join(', ');

    return `You are an expert Customer Success analyst. Analyze this email thread and provide a comprehensive summary with actionable insights.

## THREAD METADATA

Subject: ${thread.subject}
Duration: ${this.formatDuration(thread.duration)} (${thread.startDate.toLocaleDateString()} - ${thread.endDate.toLocaleDateString()})
Messages: ${thread.messageCount}
Participants: ${participants}${customerContext}${userContext}

## EMAIL THREAD

${content}

## ANALYSIS REQUIREMENTS

Provide a detailed analysis in the following JSON format:

{
  "overview": "2-3 sentence executive summary of the entire thread",
  "resolution": "How the thread was resolved (or null if unresolved)",

  "keyPoints": [
    {
      "title": "Short title (3-5 words)",
      "description": "What was discussed/decided",
      "importance": "high|medium|low"
    }
  ],

  "timeline": [
    {
      "date": "Date string",
      "from": "Sender name or email",
      "keyContent": "One-line summary of this email's key contribution",
      "sentiment": "positive|neutral|negative|concerned|relieved|waiting",
      "sentimentEmoji": "appropriate emoji"
    }
  ],

  "actionItems": [
    {
      "description": "Clear description of the action needed",
      "owner": "Person's name",
      "ownerType": "internal|customer|unknown",
      "status": "pending|done|blocked",
      "dueDate": "Date if mentioned, null otherwise",
      "urgency": "high|medium|low"
    }
  ],

  "commitments": [
    {
      "description": "What was committed to",
      "madeBy": "Person's name",
      "deadline": "Date if mentioned"
    }
  ],

  "openItems": [
    {
      "description": "What remains unresolved",
      "waitingOn": "Who needs to act",
      "daysOpen": number,
      "urgency": "high|medium|low"
    }
  ],

  "sentimentArc": {
    "start": "Sentiment at thread start (e.g., 'Worried about deadline')",
    "middle": "Sentiment during discussion (e.g., 'Problem-solving, neutral')",
    "end": "Sentiment at thread end (e.g., 'Relieved, agreement reached')",
    "trend": "improving|stable|declining|volatile"
  },

  "overallSentiment": "positive|neutral|negative|mixed",

  "responseMetrics": {
    "averageResponseTimeHours": number,
    "longestGapHours": number,
    "threadDurationDays": number,
    "internalResponsiveness": "Rating or observation",
    "customerResponsiveness": "Rating or observation"
  },

  "relationshipInsights": [
    {
      "observation": "What the thread reveals about the relationship",
      "signal": "positive|neutral|concerning"
    }
  ],

  "suggestedActions": [
    {
      "action": "What to do next",
      "reason": "Why this is recommended",
      "priority": "high|medium|low"
    }
  ],

  "confidence": 0.85
}

Important guidelines:
- Extract actual quotes when identifying sentiment or concerns
- Be specific about action items - who owns what
- Flag any items that have been waiting for response
- Identify relationship health signals (engagement level, tone warmth, etc.)
- Calculate actual response times where possible
- Suggest concrete next steps based on thread state

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Build the reply draft prompt
   */
  private buildReplyPrompt(
    thread: ParsedThread,
    summary: ThreadSummary,
    options: {
      replyTo: string;
      focus?: string;
      tone?: string;
      includeContext?: boolean;
      senderName?: string;
    }
  ): string {
    const lastMessage = thread.messages[thread.messages.length - 1];
    const openItems = summary.openItems.map(i => `- ${i.description}`).join('\n');
    const pendingActions = summary.actionItems
      .filter(a => a.status === 'pending' && a.ownerType === 'internal')
      .map(a => `- ${a.description}`)
      .join('\n');

    return `Draft a reply email based on this thread summary.

## THREAD SUMMARY

Subject: ${summary.subject}
Overview: ${summary.overview}
Current sentiment: ${summary.overallSentiment}
${summary.resolution ? `Resolution: ${summary.resolution}` : ''}

## LAST EMAIL

From: ${lastMessage.from.name || lastMessage.from.email}
Content summary: ${summary.timeline[summary.timeline.length - 1]?.keyContent || 'See thread'}

## OPEN ITEMS

${openItems || 'None identified'}

## YOUR PENDING ACTIONS

${pendingActions || 'None identified'}

## REPLY REQUIREMENTS

Reply to: ${options.replyTo}
Tone: ${options.tone || 'professional'}
${options.focus ? `Focus on: ${options.focus}` : ''}

Sender name: ${options.senderName || 'Your Customer Success Manager'}

## OUTPUT FORMAT

{
  "to": ["recipient emails"],
  "cc": ["cc emails if appropriate"],
  "subject": "Re: ${thread.subject}",
  "body": "Full email body with proper formatting",
  "suggestedAttachments": ["Document names that should be attached"],
  "tone": "Description of tone used"
}

Return ONLY valid JSON.`;
  }

  /**
   * Parse Claude's analysis response
   */
  private parseAnalysisResponse(
    responseText: string,
    thread: ParsedThread
  ): Omit<ThreadSummary, 'id' | 'threadId' | 'customerId' | 'analyzedAt' | 'subject' | 'messageCount' | 'participantCount' | 'duration' | 'dateRange' | 'modelUsed' | 'processingTime'> {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overview: parsed.overview || 'Unable to generate summary',
        keyPoints: parsed.keyPoints || [],
        resolution: parsed.resolution,
        timeline: parsed.timeline || this.generateFallbackTimeline(thread),
        actionItems: parsed.actionItems || [],
        commitments: parsed.commitments || [],
        openItems: parsed.openItems || [],
        sentimentArc: parsed.sentimentArc || {
          start: 'Unknown',
          middle: 'Unknown',
          end: 'Unknown',
          trend: 'stable',
        },
        overallSentiment: parsed.overallSentiment || 'neutral',
        responseMetrics: parsed.responseMetrics || this.calculateBasicMetrics(thread),
        relationshipInsights: parsed.relationshipInsights || [],
        suggestedActions: parsed.suggestedActions || [],
        confidence: parsed.confidence || 0.7,
      };
    } catch (error) {
      console.error('Error parsing analysis response:', error);

      // Return fallback analysis
      return {
        overview: `Thread with ${thread.messageCount} messages about "${thread.subject}"`,
        keyPoints: [],
        timeline: this.generateFallbackTimeline(thread),
        actionItems: [],
        commitments: [],
        openItems: [],
        sentimentArc: {
          start: 'Unable to analyze',
          middle: 'Unable to analyze',
          end: 'Unable to analyze',
          trend: 'stable',
        },
        overallSentiment: 'neutral',
        responseMetrics: this.calculateBasicMetrics(thread),
        relationshipInsights: [],
        suggestedActions: [{
          action: 'Review thread manually',
          reason: 'Automated analysis was unable to process this thread',
          priority: 'medium',
        }],
        confidence: 0.3,
      };
    }
  }

  /**
   * Parse reply draft response
   */
  private parseReplyResponse(
    responseText: string,
    thread: ParsedThread,
    replyTo: string
  ): DraftReply {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        to: parsed.to || [replyTo],
        cc: parsed.cc,
        subject: parsed.subject || `Re: ${thread.subject}`,
        body: parsed.body || 'Please draft your reply manually.',
        suggestedAttachments: parsed.suggestedAttachments,
        tone: parsed.tone || 'professional',
      };
    } catch (error) {
      console.error('Error parsing reply response:', error);

      return {
        to: [replyTo],
        subject: `Re: ${thread.subject}`,
        body: `Hi,

Thank you for your email. I wanted to follow up on our conversation.

[Please complete this draft]

Best regards`,
        tone: 'professional',
      };
    }
  }

  /**
   * Generate fallback timeline from thread
   */
  private generateFallbackTimeline(thread: ParsedThread): TimelineEntry[] {
    return thread.messages.map(msg => ({
      date: msg.date.toLocaleDateString(),
      from: msg.from.name || msg.from.email,
      keyContent: msg.subject || '(Message content)',
      sentiment: 'neutral' as const,
      sentimentEmoji: '',
    }));
  }

  /**
   * Calculate basic response metrics
   */
  private calculateBasicMetrics(thread: ParsedThread): ResponseMetrics {
    const messages = thread.messages;
    let totalGapHours = 0;
    let longestGapHours = 0;
    let gapCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const gap = (messages[i].date.getTime() - messages[i - 1].date.getTime()) / (1000 * 60 * 60);
      totalGapHours += gap;
      gapCount++;
      if (gap > longestGapHours) {
        longestGapHours = gap;
      }
    }

    const avgResponseHours = gapCount > 0 ? totalGapHours / gapCount : 0;
    const durationDays = thread.duration / (1000 * 60 * 60 * 24);

    return {
      averageResponseTimeHours: Math.round(avgResponseHours * 10) / 10,
      longestGapHours: Math.round(longestGapHours * 10) / 10,
      threadDurationDays: Math.round(durationDays * 10) / 10,
      internalResponsiveness: avgResponseHours < 4 ? 'Excellent' : avgResponseHours < 12 ? 'Good' : 'Could improve',
      customerResponsiveness: 'Unable to determine',
    };
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) {
      return `${Math.round(hours)} hours`;
    }
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  /**
   * Format date range for display
   */
  private formatDateRange(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (start.toDateString() === end.toDateString()) {
      return startStr;
    }
    return `${startStr} - ${endStr}`;
  }

  /**
   * Store summary in database
   */
  private async storeSummary(summary: ThreadSummary): Promise<string> {
    const id = `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (supabase) {
      try {
        const { error } = await supabase.from('email_thread_summaries').insert({
          id,
          thread_id: summary.threadId,
          customer_id: summary.customerId,
          analyzed_at: summary.analyzedAt.toISOString(),
          subject: summary.subject,
          message_count: summary.messageCount,
          participant_count: summary.participantCount,
          duration: summary.duration,
          date_range: summary.dateRange,
          overview: summary.overview,
          key_points: JSON.stringify(summary.keyPoints),
          resolution: summary.resolution,
          timeline: JSON.stringify(summary.timeline),
          action_items: JSON.stringify(summary.actionItems),
          commitments: JSON.stringify(summary.commitments),
          open_items: JSON.stringify(summary.openItems),
          sentiment_arc: JSON.stringify(summary.sentimentArc),
          overall_sentiment: summary.overallSentiment,
          response_metrics: JSON.stringify(summary.responseMetrics),
          relationship_insights: JSON.stringify(summary.relationshipInsights),
          suggested_actions: JSON.stringify(summary.suggestedActions),
          confidence: summary.confidence,
          model_used: summary.modelUsed,
          processing_time: summary.processingTime,
        });

        if (error) {
          console.warn('Failed to store summary:', error.message);
        }
      } catch (err) {
        console.warn('Database storage error:', err);
      }
    }

    return id;
  }

  /**
   * Get a summary by ID
   */
  async getSummary(summaryId: string): Promise<ThreadSummary | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('email_thread_summaries')
        .select('*')
        .eq('id', summaryId)
        .single();

      if (error || !data) return null;

      return this.mapDbRowToSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
      return null;
    }
  }

  /**
   * Get summaries for a customer
   */
  async getSummariesForCustomer(
    customerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ThreadSummary[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('email_thread_summaries')
        .select('*')
        .eq('customer_id', customerId)
        .order('analyzed_at', { ascending: false })
        .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 20) - 1);

      if (error || !data) return [];

      return data.map(this.mapDbRowToSummary);
    } catch (err) {
      console.error('Error fetching summaries:', err);
      return [];
    }
  }

  /**
   * Map database row to ThreadSummary
   */
  private mapDbRowToSummary(row: any): ThreadSummary {
    return {
      id: row.id,
      threadId: row.thread_id,
      customerId: row.customer_id,
      analyzedAt: new Date(row.analyzed_at),
      subject: row.subject,
      messageCount: row.message_count,
      participantCount: row.participant_count,
      duration: row.duration,
      dateRange: row.date_range,
      overview: row.overview,
      keyPoints: typeof row.key_points === 'string' ? JSON.parse(row.key_points) : row.key_points,
      resolution: row.resolution,
      timeline: typeof row.timeline === 'string' ? JSON.parse(row.timeline) : row.timeline,
      actionItems: typeof row.action_items === 'string' ? JSON.parse(row.action_items) : row.action_items,
      commitments: typeof row.commitments === 'string' ? JSON.parse(row.commitments) : row.commitments,
      openItems: typeof row.open_items === 'string' ? JSON.parse(row.open_items) : row.open_items,
      sentimentArc: typeof row.sentiment_arc === 'string' ? JSON.parse(row.sentiment_arc) : row.sentiment_arc,
      overallSentiment: row.overall_sentiment,
      responseMetrics: typeof row.response_metrics === 'string' ? JSON.parse(row.response_metrics) : row.response_metrics,
      relationshipInsights: typeof row.relationship_insights === 'string' ? JSON.parse(row.relationship_insights) : row.relationship_insights,
      suggestedActions: typeof row.suggested_actions === 'string' ? JSON.parse(row.suggested_actions) : row.suggested_actions,
      confidence: row.confidence,
      modelUsed: row.model_used,
      processingTime: row.processing_time,
    };
  }
}

// Singleton instance
export const emailSummarizerService = new EmailSummarizerService();
