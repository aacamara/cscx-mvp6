/**
 * AI Meeting Summarizer Service (PRD-213)
 *
 * Uses Claude AI to analyze meeting transcripts and generate
 * comprehensive summaries with action items, risk signals, and insights.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import { driveService } from '../google/drive.js';
import { docsService } from '../google/docs.js';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type TranscriptSource = 'zoom' | 'otter' | 'manual';
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionItemPriority = 'high' | 'medium' | 'low';
export type ActionItemStatus = 'pending_review' | 'approved' | 'created' | 'completed';

export interface MeetingAttendee {
  name: string;
  email?: string;
  role?: string;
  company?: string;
  isInternal?: boolean;
}

export interface MeetingMetadata {
  title: string;
  meetingDate: string;
  durationMinutes?: number;
  attendees: MeetingAttendee[];
  meetingType?: string;
  calendarEventId?: string;
}

export interface ActionItem {
  id: string;
  description: string;
  suggestedOwner: string;
  suggestedDueDate: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
}

export interface Commitment {
  id: string;
  description: string;
  party: 'us' | 'customer' | 'mutual';
  deadline?: string;
  context?: string;
}

export interface RiskSignal {
  id: string;
  type: string;
  severity: RiskLevel;
  description: string;
  quote?: string;
}

export interface ExpansionSignal {
  id: string;
  type: string;
  description: string;
  potentialValue?: number;
  confidence: number;
  quote?: string;
}

export interface MeetingSummary {
  id: string;
  meetingId: string;
  customerId: string;
  customerName?: string;
  executiveSummary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  commitments: Commitment[];
  riskSignals: RiskSignal[];
  expansionSignals: ExpansionSignal[];
  overallRiskLevel: RiskLevel;
  overallSentiment: SentimentType;
  sentimentScore: number;
  followUpRecommendations: string[];
  confidenceScore: number;
  transcriptWordCount?: number;
  status: 'processing' | 'ready' | 'approved' | 'archived';
  driveDocId?: string;
  driveDocUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeMeetingParams {
  meetingId?: string;
  transcriptSource: TranscriptSource;
  transcriptContent: string;
  customerId: string;
  customerName?: string;
  customerArr?: number;
  meetingMetadata: MeetingMetadata;
  userId: string;
}

export interface AnalysisResult {
  success: boolean;
  summary?: MeetingSummary;
  error?: string;
  processingTimeMs?: number;
}

// ============================================
// AI Prompts
// ============================================

const SUMMARY_EXTRACTION_PROMPT = `Analyze this customer success meeting transcript and extract structured information.

Meeting Context:
- Customer: {{customer_name}}
- Account ARR: {{arr}}
- Meeting Type: {{meeting_type}}
- Attendees: {{attendees}}

Transcript:
{{transcript}}

Extract the following in JSON format:
{
  "executiveSummary": "2-3 sentence overview of the meeting that captures the essence and outcomes",
  "keyPoints": ["Array of 4-6 main discussion topics as complete sentences"],
  "decisions": ["Array of any decisions or agreements reached"],
  "actionItems": [
    {
      "description": "Clear, actionable task description",
      "suggestedOwner": "customer | csm | internal | specific person name",
      "suggestedDueDate": "YYYY-MM-DD format or null if not mentioned",
      "priority": "high | medium | low"
    }
  ],
  "commitments": [
    {
      "description": "What was promised",
      "party": "us | customer | mutual",
      "deadline": "YYYY-MM-DD if mentioned",
      "context": "Why this commitment was made"
    }
  ],
  "followUpRecommendations": ["Array of suggested next steps for the CSM"]
}

Guidelines:
- Be specific and actionable in action items
- Only include decisions that were actually agreed upon
- Follow-up recommendations should be proactive suggestions not explicitly discussed
- Return ONLY valid JSON, no markdown code blocks`;

const RISK_DETECTION_PROMPT = `Analyze this customer success meeting transcript for risk signals.

Meeting Context:
- Customer: {{customer_name}}
- Account ARR: {{arr}}

Transcript:
{{transcript}}

Identify risk signals in these categories:
1. Competitor mentions (evaluating alternatives, competitor name drops)
2. Budget concerns (cost discussions, budget freezes, ROI questions)
3. Champion departure (key contact leaving, reorg mentions)
4. Dissatisfaction (complaints, frustration, negative feedback)
5. Timeline pressure (urgent deadlines, "need results by X date")
6. Stakeholder alignment (internal disagreements, conflicting priorities)

Return JSON:
{
  "riskSignals": [
    {
      "type": "competitor_mention | budget_concern | champion_departure | dissatisfaction | timeline_pressure | stakeholder_alignment | other",
      "severity": "low | medium | high | critical",
      "description": "Clear explanation of the risk",
      "quote": "Direct quote from transcript if available"
    }
  ],
  "overallRiskLevel": "low | medium | high | critical",
  "riskSummary": "Brief overall risk assessment"
}

Return ONLY valid JSON, no markdown code blocks.`;

const SENTIMENT_PROMPT = `Analyze the sentiment of this customer meeting transcript.

Transcript:
{{transcript}}

Evaluate:
1. Overall tone of the meeting
2. Customer engagement level
3. Positive vs negative language ratio
4. Non-verbal cues mentioned (if any)

Return JSON:
{
  "overallSentiment": "positive | neutral | negative | mixed",
  "sentimentScore": -100 to 100 (where -100 is very negative, 0 is neutral, 100 is very positive),
  "sentimentBreakdown": {
    "customerSentiment": "positive | neutral | negative | mixed",
    "topPositiveIndicators": ["list of positive signals"],
    "topNegativeIndicators": ["list of concerns or negative signals"]
  }
}

Return ONLY valid JSON, no markdown code blocks.`;

const EXPANSION_DETECTION_PROMPT = `Analyze this customer meeting transcript for expansion opportunities.

Meeting Context:
- Customer: {{customer_name}}
- Current ARR: {{arr}}

Transcript:
{{transcript}}

Look for signals of:
1. Interest in new features
2. Need for additional licenses/seats
3. New teams wanting to adopt
4. New use cases mentioned
5. Budget availability hints
6. Positive ROI statements

Return JSON:
{
  "expansionSignals": [
    {
      "type": "new_features | more_licenses | new_teams | new_use_cases | other",
      "description": "Clear description of the opportunity",
      "potentialValue": estimated additional ARR if possible to infer (number or null),
      "confidence": 0-100 confidence level,
      "quote": "Supporting quote from transcript"
    }
  ],
  "expansionPotential": "low | medium | high",
  "expansionSummary": "Brief summary of expansion opportunities"
}

Return ONLY valid JSON, no markdown code blocks.`;

// ============================================
// Meeting Summarizer Service
// ============================================

class MeetingSummarizerService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Analyze a meeting transcript and generate a comprehensive summary
   */
  async analyzeMeeting(params: AnalyzeMeetingParams): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      if (!this.anthropic) {
        throw new Error('AI service not configured');
      }

      const meetingId = params.meetingId || uuidv4();

      // Get customer data if not provided
      let customerName = params.customerName;
      let customerArr = params.customerArr;

      if (!customerName && supabase) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name, arr')
          .eq('id', params.customerId)
          .single();

        if (customer) {
          customerName = customer.name;
          customerArr = customer.arr;
        }
      }

      customerName = customerName || 'Customer';
      customerArr = customerArr || 0;

      // Prepare context for prompts
      const context = {
        customer_name: customerName,
        arr: customerArr ? `$${customerArr.toLocaleString()}` : 'Unknown',
        meeting_type: params.meetingMetadata.meetingType || 'Meeting',
        attendees: params.meetingMetadata.attendees.map(a => a.name).join(', '),
        transcript: this.truncateTranscript(params.transcriptContent, 25000),
      };

      // Run all analysis in parallel
      const [summaryResult, riskResult, sentimentResult, expansionResult] = await Promise.all([
        this.extractSummary(context),
        this.detectRisks(context),
        this.analyzeSentiment(context),
        this.detectExpansion(context),
      ]);

      // Combine results into a meeting summary
      const summary: MeetingSummary = {
        id: uuidv4(),
        meetingId,
        customerId: params.customerId,
        customerName,
        executiveSummary: summaryResult.executiveSummary,
        keyPoints: summaryResult.keyPoints,
        decisions: summaryResult.decisions,
        actionItems: summaryResult.actionItems.map((item, index) => ({
          ...item,
          id: uuidv4(),
          status: 'pending_review' as ActionItemStatus,
        })),
        commitments: summaryResult.commitments.map((commitment, index) => ({
          ...commitment,
          id: uuidv4(),
        })),
        riskSignals: riskResult.riskSignals.map(signal => ({
          ...signal,
          id: uuidv4(),
        })),
        expansionSignals: expansionResult.expansionSignals.map(signal => ({
          ...signal,
          id: uuidv4(),
        })),
        overallRiskLevel: riskResult.overallRiskLevel,
        overallSentiment: sentimentResult.overallSentiment,
        sentimentScore: sentimentResult.sentimentScore,
        followUpRecommendations: summaryResult.followUpRecommendations,
        confidenceScore: this.calculateConfidence(summaryResult, riskResult, sentimentResult),
        transcriptWordCount: params.transcriptContent.split(/\s+/).length,
        status: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      if (supabase) {
        await this.saveSummary(summary, params.meetingMetadata, params.userId);
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        summary,
        processingTimeMs,
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Error analyzing meeting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract summary, action items, and key points
   */
  private async extractSummary(context: Record<string, string>): Promise<{
    executiveSummary: string;
    keyPoints: string[];
    decisions: string[];
    actionItems: Omit<ActionItem, 'id' | 'status'>[];
    commitments: Omit<Commitment, 'id'>[];
    followUpRecommendations: string[];
  }> {
    const prompt = this.replaceVariables(SUMMARY_EXTRACTION_PROMPT, context);

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = this.extractText(response);
      const parsed = this.parseJSON(text);

      return {
        executiveSummary: parsed.executiveSummary || 'Meeting summary not available.',
        keyPoints: parsed.keyPoints || [],
        decisions: parsed.decisions || [],
        actionItems: (parsed.actionItems || []).map((item: any) => ({
          description: item.description || '',
          suggestedOwner: item.suggestedOwner || 'csm',
          suggestedDueDate: item.suggestedDueDate || null,
          priority: item.priority || 'medium',
        })),
        commitments: (parsed.commitments || []).map((c: any) => ({
          description: c.description || '',
          party: c.party || 'mutual',
          deadline: c.deadline,
          context: c.context,
        })),
        followUpRecommendations: parsed.followUpRecommendations || [],
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Summary extraction error:', error);
      return {
        executiveSummary: 'Unable to generate summary. Please review the transcript.',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        commitments: [],
        followUpRecommendations: [],
      };
    }
  }

  /**
   * Detect risk signals in the transcript
   */
  private async detectRisks(context: Record<string, string>): Promise<{
    riskSignals: Omit<RiskSignal, 'id'>[];
    overallRiskLevel: RiskLevel;
  }> {
    const prompt = this.replaceVariables(RISK_DETECTION_PROMPT, context);

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = this.extractText(response);
      const parsed = this.parseJSON(text);

      return {
        riskSignals: (parsed.riskSignals || []).map((signal: any) => ({
          type: signal.type || 'other',
          severity: signal.severity || 'low',
          description: signal.description || '',
          quote: signal.quote,
        })),
        overallRiskLevel: parsed.overallRiskLevel || 'low',
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Risk detection error:', error);
      return {
        riskSignals: [],
        overallRiskLevel: 'low',
      };
    }
  }

  /**
   * Analyze meeting sentiment
   */
  private async analyzeSentiment(context: Record<string, string>): Promise<{
    overallSentiment: SentimentType;
    sentimentScore: number;
  }> {
    const prompt = this.replaceVariables(SENTIMENT_PROMPT, context);

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-3-5-haiku-20241022', // Faster model for sentiment
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = this.extractText(response);
      const parsed = this.parseJSON(text);

      return {
        overallSentiment: parsed.overallSentiment || 'neutral',
        sentimentScore: Math.max(-100, Math.min(100, parsed.sentimentScore || 0)),
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Sentiment analysis error:', error);
      return {
        overallSentiment: 'neutral',
        sentimentScore: 0,
      };
    }
  }

  /**
   * Detect expansion opportunities
   */
  private async detectExpansion(context: Record<string, string>): Promise<{
    expansionSignals: Omit<ExpansionSignal, 'id'>[];
  }> {
    const prompt = this.replaceVariables(EXPANSION_DETECTION_PROMPT, context);

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = this.extractText(response);
      const parsed = this.parseJSON(text);

      return {
        expansionSignals: (parsed.expansionSignals || []).map((signal: any) => ({
          type: signal.type || 'other',
          description: signal.description || '',
          potentialValue: signal.potentialValue,
          confidence: Math.max(0, Math.min(100, signal.confidence || 50)),
          quote: signal.quote,
        })),
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Expansion detection error:', error);
      return {
        expansionSignals: [],
      };
    }
  }

  /**
   * Save summary to database
   */
  private async saveSummary(
    summary: MeetingSummary,
    metadata: MeetingMetadata,
    userId: string
  ): Promise<void> {
    if (!supabase) return;

    try {
      // Save to meeting_analyses table
      await supabase.from('meeting_analyses').insert({
        id: summary.id,
        meeting_id: summary.meetingId,
        customer_id: summary.customerId,
        user_id: userId,
        summary: summary.executiveSummary,
        key_points: summary.keyPoints,
        decisions: summary.decisions,
        action_items: summary.actionItems,
        commitments: summary.commitments,
        risk_signals: summary.riskSignals,
        expansion_signals: summary.expansionSignals,
        overall_sentiment: summary.overallSentiment,
        sentiment_score: summary.sentimentScore,
        risk_level: summary.overallRiskLevel,
        follow_up_recommendations: summary.followUpRecommendations,
        confidence_score: summary.confidenceScore,
        status: summary.status,
        meeting_title: metadata.title,
        meeting_date: metadata.meetingDate,
        meeting_type: metadata.meetingType,
        attendees: metadata.attendees,
        duration_minutes: metadata.durationMinutes,
        analyzed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[MeetingSummarizer] Error saving summary:', error);
      throw error;
    }
  }

  /**
   * Get a saved summary by meeting ID
   */
  async getSummary(meetingId: string): Promise<MeetingSummary | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('meeting_analyses')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (error || !data) return null;

    return this.mapDbToSummary(data);
  }

  /**
   * Get summaries for a customer
   */
  async getCustomerSummaries(
    customerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MeetingSummary[]> {
    if (!supabase) return [];

    let query = supabase
      .from('meeting_analyses')
      .select('*')
      .eq('customer_id', customerId)
      .order('meeting_date', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(this.mapDbToSummary);
  }

  /**
   * Update a summary (for approvals/edits)
   */
  async updateSummary(
    meetingId: string,
    updates: Partial<MeetingSummary>
  ): Promise<MeetingSummary | null> {
    if (!supabase) return null;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.executiveSummary !== undefined) updateData.summary = updates.executiveSummary;
    if (updates.keyPoints !== undefined) updateData.key_points = updates.keyPoints;
    if (updates.decisions !== undefined) updateData.decisions = updates.decisions;
    if (updates.actionItems !== undefined) updateData.action_items = updates.actionItems;
    if (updates.commitments !== undefined) updateData.commitments = updates.commitments;
    if (updates.followUpRecommendations !== undefined) {
      updateData.follow_up_recommendations = updates.followUpRecommendations;
    }
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.driveDocId !== undefined) updateData.drive_doc_id = updates.driveDocId;
    if (updates.driveDocUrl !== undefined) updateData.drive_doc_url = updates.driveDocUrl;

    const { data, error } = await supabase
      .from('meeting_analyses')
      .update(updateData)
      .eq('meeting_id', meetingId)
      .select()
      .single();

    if (error || !data) return null;

    return this.mapDbToSummary(data);
  }

  /**
   * Save summary to Google Drive as a document
   */
  async saveToGoogleDrive(
    summary: MeetingSummary,
    userId: string,
    customerId: string
  ): Promise<{ docId: string; docUrl: string } | null> {
    try {
      // Get customer folder
      let folderId: string | undefined;

      if (supabase) {
        const { data: folders } = await supabase
          .from('customer_workspace_folders')
          .select('meetings_folder_id')
          .eq('customer_id', customerId)
          .single();

        folderId = folders?.meetings_folder_id;
      }

      // Build document content
      const content = this.buildDocumentContent(summary);

      const dateStr = new Date(summary.createdAt).toISOString().split('T')[0];
      const title = `${dateStr} - ${summary.customerName || 'Meeting'} Summary`;

      const doc = await docsService.createDocument(userId, {
        title,
        folderId,
        content,
      });

      // Update summary with doc info
      if (supabase) {
        await this.updateSummary(summary.meetingId, {
          driveDocId: doc.id,
          driveDocUrl: doc.webViewLink,
        });
      }

      return {
        docId: doc.id,
        docUrl: doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`,
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Error saving to Drive:', error);
      return null;
    }
  }

  /**
   * Build document content from summary
   */
  private buildDocumentContent(summary: MeetingSummary): string {
    const date = new Date(summary.createdAt).toLocaleDateString();

    let content = `# Meeting Summary: ${summary.customerName || 'Customer Meeting'}\n\n`;
    content += `**Date:** ${date}\n`;
    content += `**Sentiment:** ${summary.overallSentiment} (${summary.sentimentScore}/100)\n`;
    content += `**Risk Level:** ${summary.overallRiskLevel.toUpperCase()}\n\n`;

    content += `## Executive Summary\n${summary.executiveSummary}\n\n`;

    if (summary.keyPoints.length > 0) {
      content += `## Key Discussion Points\n`;
      summary.keyPoints.forEach(point => {
        content += `- ${point}\n`;
      });
      content += '\n';
    }

    if (summary.decisions.length > 0) {
      content += `## Decisions Made\n`;
      summary.decisions.forEach(decision => {
        content += `- ${decision}\n`;
      });
      content += '\n';
    }

    if (summary.actionItems.length > 0) {
      content += `## Action Items\n`;
      content += `| Task | Owner | Due Date | Priority |\n`;
      content += `|------|-------|----------|----------|\n`;
      summary.actionItems.forEach(item => {
        content += `| ${item.description} | ${item.suggestedOwner} | ${item.suggestedDueDate || 'TBD'} | ${item.priority} |\n`;
      });
      content += '\n';
    }

    if (summary.commitments.length > 0) {
      content += `## Commitments\n`;
      summary.commitments.forEach(c => {
        content += `- **${c.party === 'us' ? 'Our' : c.party === 'customer' ? 'Customer' : 'Mutual'} Commitment:** ${c.description}`;
        if (c.deadline) content += ` (by ${c.deadline})`;
        content += '\n';
      });
      content += '\n';
    }

    if (summary.riskSignals.length > 0) {
      content += `## Risk Signals\n`;
      summary.riskSignals.forEach(signal => {
        content += `- **[${signal.severity.toUpperCase()}]** ${signal.description}\n`;
      });
      content += '\n';
    }

    if (summary.expansionSignals.length > 0) {
      content += `## Expansion Opportunities\n`;
      summary.expansionSignals.forEach(signal => {
        content += `- ${signal.description}`;
        if (signal.potentialValue) content += ` (Est. $${signal.potentialValue.toLocaleString()})`;
        content += ` [${signal.confidence}% confidence]\n`;
      });
      content += '\n';
    }

    if (summary.followUpRecommendations.length > 0) {
      content += `## Follow-Up Recommendations\n`;
      summary.followUpRecommendations.forEach((rec, i) => {
        content += `${i + 1}. ${rec}\n`;
      });
      content += '\n';
    }

    content += `---\n`;
    content += `*Generated by CSCX.AI Meeting Summarization*\n`;
    content += `*Confidence Score: ${summary.confidenceScore}%*`;

    return content;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private truncateTranscript(transcript: string, maxChars: number): string {
    if (transcript.length <= maxChars) return transcript;
    return transcript.substring(0, maxChars) + '\n\n[Transcript truncated...]';
  }

  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
  }

  private extractText(response: Anthropic.Message): string {
    const block = response.content.find(b => b.type === 'text');
    return block?.type === 'text' ? block.text : '';
  }

  private parseJSON(text: string): any {
    // Remove markdown code blocks if present
    let jsonString = text.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.slice(7);
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.slice(3);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }
    jsonString = jsonString.trim();

    // Try to extract JSON object
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(jsonString);
  }

  private calculateConfidence(
    summaryResult: any,
    riskResult: any,
    sentimentResult: any
  ): number {
    let score = 70; // Base confidence

    // Adjust based on content richness
    if (summaryResult.keyPoints.length >= 3) score += 5;
    if (summaryResult.actionItems.length >= 1) score += 5;
    if (summaryResult.decisions.length >= 1) score += 5;
    if (riskResult.riskSignals.length > 0 || riskResult.overallRiskLevel !== 'low') score += 5;
    if (sentimentResult.overallSentiment !== 'neutral') score += 5;

    return Math.min(100, score);
  }

  private mapDbToSummary(data: any): MeetingSummary {
    return {
      id: data.id,
      meetingId: data.meeting_id,
      customerId: data.customer_id,
      customerName: data.customer_name || data.meeting_title?.split(' - ')[0],
      executiveSummary: data.summary || '',
      keyPoints: data.key_points || [],
      decisions: data.decisions || [],
      actionItems: data.action_items || [],
      commitments: data.commitments || [],
      riskSignals: data.risk_signals || [],
      expansionSignals: data.expansion_signals || [],
      overallRiskLevel: data.risk_level || 'low',
      overallSentiment: data.overall_sentiment || 'neutral',
      sentimentScore: data.sentiment_score || 0,
      followUpRecommendations: data.follow_up_recommendations || [],
      confidenceScore: data.confidence_score || 70,
      transcriptWordCount: data.transcript_word_count,
      status: data.status || 'ready',
      driveDocId: data.drive_doc_id,
      driveDocUrl: data.drive_doc_url,
      createdAt: data.created_at || data.analyzed_at,
      updatedAt: data.updated_at || data.analyzed_at,
    };
  }
}

// Export singleton instance
export const meetingSummarizerService = new MeetingSummarizerService();
export default meetingSummarizerService;
