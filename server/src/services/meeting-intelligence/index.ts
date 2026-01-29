/**
 * Meeting Intelligence Service
 * AI-powered analysis of meeting transcripts for CS insights
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Types
// ============================================

export interface MeetingTranscript {
  meetingId: string;
  source: 'zoom' | 'google_meet' | 'teams' | 'otter' | 'manual';
  title: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  participants: MeetingParticipant[];
  transcript: TranscriptSegment[];
  rawText?: string;
}

export interface MeetingParticipant {
  name: string;
  email?: string;
  role?: 'host' | 'participant' | 'customer' | 'internal';
  speakingTime?: number;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime?: number;
  endTime?: number;
}

export interface MeetingAnalysis {
  id: string;
  meetingId: string;
  customerId?: string;
  analyzedAt: Date;

  // Summary
  summary: string;
  keyTopics: string[];
  duration: number;

  // Sentiment & Tone
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number; // -1 to 1
  customerMood: string;

  // Action Items
  actionItems: ActionItem[];
  commitments: Commitment[];
  followUps: FollowUp[];

  // Risk Signals
  riskSignals: RiskSignal[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Expansion Signals
  expansionSignals: ExpansionSignal[];
  expansionPotential: 'none' | 'low' | 'medium' | 'high';

  // Stakeholder Insights
  stakeholderInsights: StakeholderInsight[];

  // Questions & Concerns
  unresolvedQuestions: string[];
  customerConcerns: string[];

  // Competitive Intelligence
  competitorMentions: CompetitorMention[];

  // Metadata
  confidence: number;
  modelUsed: string;
  processingTime: number;
}

export interface ActionItem {
  description: string;
  owner: 'customer' | 'internal' | 'both' | 'unknown';
  ownerName?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  category: 'feature_request' | 'bug_fix' | 'documentation' | 'training' | 'follow_up' | 'other';
}

export interface Commitment {
  description: string;
  madeBy: string;
  madeByRole: 'customer' | 'internal';
  deadline?: string;
}

export interface FollowUp {
  description: string;
  type: 'email' | 'call' | 'meeting' | 'demo' | 'document' | 'other';
  suggestedDate?: string;
  assignee?: string;
}

export interface RiskSignal {
  type: 'churn' | 'dissatisfaction' | 'competitor' | 'budget' | 'adoption' | 'support' | 'executive_change';
  description: string;
  severity: 'low' | 'medium' | 'high';
  quote?: string;
}

export interface ExpansionSignal {
  type: 'upsell' | 'cross_sell' | 'new_use_case' | 'additional_users' | 'new_department';
  description: string;
  potential: 'low' | 'medium' | 'high';
  quote?: string;
}

export interface StakeholderInsight {
  name: string;
  role?: string;
  influence: 'decision_maker' | 'influencer' | 'end_user' | 'blocker' | 'champion' | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative';
  keyStatements: string[];
}

export interface CompetitorMention {
  competitor: string;
  context: 'comparison' | 'evaluation' | 'migration' | 'complement' | 'general';
  sentiment: 'positive' | 'neutral' | 'negative';
  quote?: string;
}

// ============================================
// Meeting Intelligence Service
// ============================================

export class MeetingIntelligenceService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Analyze a meeting transcript
   */
  async analyzeMeeting(
    transcript: MeetingTranscript,
    options?: {
      customerId?: string;
      customerName?: string;
      extractionFocus?: ('actions' | 'risks' | 'expansion' | 'sentiment' | 'all')[];
    }
  ): Promise<MeetingAnalysis> {
    const startTime = Date.now();

    // Build transcript text
    const transcriptText = this.buildTranscriptText(transcript);

    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(transcript, transcriptText, options);

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
    const analysisText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    const analysis = this.parseAnalysisResponse(analysisText, transcript);

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Store analysis
    const storedAnalysis = await this.storeAnalysis({
      ...analysis,
      meetingId: transcript.meetingId,
      customerId: options?.customerId,
      analyzedAt: new Date(),
      modelUsed: 'claude-sonnet-4-20250514',
      processingTime,
    });

    return storedAnalysis;
  }

  /**
   * Build transcript text from segments
   */
  private buildTranscriptText(transcript: MeetingTranscript): string {
    if (transcript.rawText) {
      return transcript.rawText;
    }

    return transcript.transcript
      .map((segment) => `${segment.speaker}: ${segment.text}`)
      .join('\n\n');
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(
    transcript: MeetingTranscript,
    transcriptText: string,
    options?: {
      customerId?: string;
      customerName?: string;
      extractionFocus?: string[];
    }
  ): string {
    const customerContext = options?.customerName
      ? `\nCustomer: ${options.customerName}`
      : '';

    return `You are an expert Customer Success analyst. Analyze this meeting transcript and extract actionable insights.

Meeting Details:
- Title: ${transcript.title}
- Date: ${transcript.startTime.toISOString()}
- Duration: ${transcript.duration || 'Unknown'} minutes
- Participants: ${transcript.participants.map((p) => p.name).join(', ')}${customerContext}

TRANSCRIPT:
---
${transcriptText}
---

Provide a comprehensive analysis in the following JSON format. Be thorough but concise.

{
  "summary": "2-3 sentence executive summary of the meeting",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "overallSentiment": "positive|neutral|negative|mixed",
  "sentimentScore": 0.0, // -1 to 1
  "customerMood": "Brief description of customer's emotional state",

  "actionItems": [
    {
      "description": "Clear description of the action",
      "owner": "customer|internal|both|unknown",
      "ownerName": "Person's name if mentioned",
      "dueDate": "Date if mentioned (YYYY-MM-DD)",
      "priority": "low|medium|high",
      "category": "feature_request|bug_fix|documentation|training|follow_up|other"
    }
  ],

  "commitments": [
    {
      "description": "What was committed",
      "madeBy": "Person's name",
      "madeByRole": "customer|internal",
      "deadline": "Date if mentioned"
    }
  ],

  "followUps": [
    {
      "description": "Suggested follow-up",
      "type": "email|call|meeting|demo|document|other",
      "suggestedDate": "When to follow up",
      "assignee": "Who should do it"
    }
  ],

  "riskSignals": [
    {
      "type": "churn|dissatisfaction|competitor|budget|adoption|support|executive_change",
      "description": "Description of the risk",
      "severity": "low|medium|high",
      "quote": "Relevant quote from transcript"
    }
  ],

  "expansionSignals": [
    {
      "type": "upsell|cross_sell|new_use_case|additional_users|new_department",
      "description": "Description of the opportunity",
      "potential": "low|medium|high",
      "quote": "Relevant quote"
    }
  ],

  "stakeholderInsights": [
    {
      "name": "Person's name",
      "role": "Their role if mentioned",
      "influence": "decision_maker|influencer|end_user|blocker|champion|unknown",
      "sentiment": "positive|neutral|negative",
      "keyStatements": ["Important thing they said"]
    }
  ],

  "unresolvedQuestions": ["Questions that weren't fully answered"],

  "customerConcerns": ["Explicit concerns raised by the customer"],

  "competitorMentions": [
    {
      "competitor": "Competitor name",
      "context": "comparison|evaluation|migration|complement|general",
      "sentiment": "positive|neutral|negative",
      "quote": "What was said"
    }
  ],

  "riskLevel": "low|medium|high|critical",
  "expansionPotential": "none|low|medium|high",
  "confidence": 0.85
}

Important:
- Extract actual quotes when supporting risk or expansion signals
- Be conservative with risk levels - only mark as critical if there are clear churn indicators
- Identify all stakeholders and their influence level
- Flag any competitor mentions, even casual ones
- Include follow-ups that weren't explicitly stated but would be valuable

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Parse Claude's analysis response
   */
  private parseAnalysisResponse(
    responseText: string,
    transcript: MeetingTranscript
  ): Omit<MeetingAnalysis, 'id' | 'meetingId' | 'customerId' | 'analyzedAt' | 'modelUsed' | 'processingTime'> {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || 'No summary available',
        keyTopics: parsed.keyTopics || [],
        duration: transcript.duration || 0,
        overallSentiment: parsed.overallSentiment || 'neutral',
        sentimentScore: parsed.sentimentScore || 0,
        customerMood: parsed.customerMood || 'Unknown',
        actionItems: parsed.actionItems || [],
        commitments: parsed.commitments || [],
        followUps: parsed.followUps || [],
        riskSignals: parsed.riskSignals || [],
        riskLevel: parsed.riskLevel || 'low',
        expansionSignals: parsed.expansionSignals || [],
        expansionPotential: parsed.expansionPotential || 'none',
        stakeholderInsights: parsed.stakeholderInsights || [],
        unresolvedQuestions: parsed.unresolvedQuestions || [],
        customerConcerns: parsed.customerConcerns || [],
        competitorMentions: parsed.competitorMentions || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('Error parsing analysis response:', error);

      // Return minimal analysis on error
      return {
        summary: 'Analysis failed to parse',
        keyTopics: [],
        duration: transcript.duration || 0,
        overallSentiment: 'neutral',
        sentimentScore: 0,
        customerMood: 'Unknown',
        actionItems: [],
        commitments: [],
        followUps: [],
        riskSignals: [],
        riskLevel: 'low',
        expansionSignals: [],
        expansionPotential: 'none',
        stakeholderInsights: [],
        unresolvedQuestions: [],
        customerConcerns: [],
        competitorMentions: [],
        confidence: 0,
      };
    }
  }

  /**
   * Store analysis in database
   */
  private async storeAnalysis(analysis: Omit<MeetingAnalysis, 'id'>): Promise<MeetingAnalysis> {
    const { data, error } = await supabase
      .from('meeting_analyses')
      .insert({
        meeting_id: analysis.meetingId,
        customer_id: analysis.customerId,
        analyzed_at: analysis.analyzedAt.toISOString(),
        summary: analysis.summary,
        key_topics: analysis.keyTopics,
        duration: analysis.duration,
        overall_sentiment: analysis.overallSentiment,
        sentiment_score: analysis.sentimentScore,
        customer_mood: analysis.customerMood,
        action_items: JSON.stringify(analysis.actionItems),
        commitments: JSON.stringify(analysis.commitments),
        follow_ups: JSON.stringify(analysis.followUps),
        risk_signals: JSON.stringify(analysis.riskSignals),
        risk_level: analysis.riskLevel,
        expansion_signals: JSON.stringify(analysis.expansionSignals),
        expansion_potential: analysis.expansionPotential,
        stakeholder_insights: JSON.stringify(analysis.stakeholderInsights),
        unresolved_questions: analysis.unresolvedQuestions,
        customer_concerns: analysis.customerConcerns,
        competitor_mentions: JSON.stringify(analysis.competitorMentions),
        confidence: analysis.confidence,
        model_used: analysis.modelUsed,
        processing_time: analysis.processingTime,
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing analysis:', error);
      throw new Error('Failed to store analysis');
    }

    return {
      id: data.id,
      meetingId: data.meeting_id,
      customerId: data.customer_id,
      analyzedAt: new Date(data.analyzed_at),
      summary: data.summary,
      keyTopics: data.key_topics,
      duration: data.duration,
      overallSentiment: data.overall_sentiment,
      sentimentScore: data.sentiment_score,
      customerMood: data.customer_mood,
      actionItems: JSON.parse(data.action_items),
      commitments: JSON.parse(data.commitments),
      followUps: JSON.parse(data.follow_ups),
      riskSignals: JSON.parse(data.risk_signals),
      riskLevel: data.risk_level,
      expansionSignals: JSON.parse(data.expansion_signals),
      expansionPotential: data.expansion_potential,
      stakeholderInsights: JSON.parse(data.stakeholder_insights),
      unresolvedQuestions: data.unresolved_questions,
      customerConcerns: data.customer_concerns,
      competitorMentions: JSON.parse(data.competitor_mentions),
      confidence: data.confidence,
      modelUsed: data.model_used,
      processingTime: data.processing_time,
    };
  }

  /**
   * Get analysis by meeting ID
   */
  async getAnalysis(meetingId: string): Promise<MeetingAnalysis | null> {
    const { data, error } = await supabase
      .from('meeting_analyses')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      meetingId: data.meeting_id,
      customerId: data.customer_id,
      analyzedAt: new Date(data.analyzed_at),
      summary: data.summary,
      keyTopics: data.key_topics,
      duration: data.duration,
      overallSentiment: data.overall_sentiment,
      sentimentScore: data.sentiment_score,
      customerMood: data.customer_mood,
      actionItems: typeof data.action_items === 'string' ? JSON.parse(data.action_items) : data.action_items,
      commitments: typeof data.commitments === 'string' ? JSON.parse(data.commitments) : data.commitments,
      followUps: typeof data.follow_ups === 'string' ? JSON.parse(data.follow_ups) : data.follow_ups,
      riskSignals: typeof data.risk_signals === 'string' ? JSON.parse(data.risk_signals) : data.risk_signals,
      riskLevel: data.risk_level,
      expansionSignals: typeof data.expansion_signals === 'string' ? JSON.parse(data.expansion_signals) : data.expansion_signals,
      expansionPotential: data.expansion_potential,
      stakeholderInsights: typeof data.stakeholder_insights === 'string' ? JSON.parse(data.stakeholder_insights) : data.stakeholder_insights,
      unresolvedQuestions: data.unresolved_questions,
      customerConcerns: data.customer_concerns,
      competitorMentions: typeof data.competitor_mentions === 'string' ? JSON.parse(data.competitor_mentions) : data.competitor_mentions,
      confidence: data.confidence,
      modelUsed: data.model_used,
      processingTime: data.processing_time,
    };
  }

  /**
   * List analyses for a customer
   */
  async listAnalysesForCustomer(
    customerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MeetingAnalysis[]> {
    const { data, error } = await supabase
      .from('meeting_analyses')
      .select('*')
      .eq('customer_id', customerId)
      .order('analyzed_at', { ascending: false })
      .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 20) - 1);

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      meetingId: row.meeting_id,
      customerId: row.customer_id,
      analyzedAt: new Date(row.analyzed_at),
      summary: row.summary,
      keyTopics: row.key_topics,
      duration: row.duration,
      overallSentiment: row.overall_sentiment,
      sentimentScore: row.sentiment_score,
      customerMood: row.customer_mood,
      actionItems: typeof row.action_items === 'string' ? JSON.parse(row.action_items) : row.action_items,
      commitments: typeof row.commitments === 'string' ? JSON.parse(row.commitments) : row.commitments,
      followUps: typeof row.follow_ups === 'string' ? JSON.parse(row.follow_ups) : row.follow_ups,
      riskSignals: typeof row.risk_signals === 'string' ? JSON.parse(row.risk_signals) : row.risk_signals,
      riskLevel: row.risk_level,
      expansionSignals: typeof row.expansion_signals === 'string' ? JSON.parse(row.expansion_signals) : row.expansion_signals,
      expansionPotential: row.expansion_potential,
      stakeholderInsights: typeof row.stakeholder_insights === 'string' ? JSON.parse(row.stakeholder_insights) : row.stakeholder_insights,
      unresolvedQuestions: row.unresolved_questions,
      customerConcerns: row.customer_concerns,
      competitorMentions: typeof row.competitor_mentions === 'string' ? JSON.parse(row.competitor_mentions) : row.competitor_mentions,
      confidence: row.confidence,
      modelUsed: row.model_used,
      processingTime: row.processing_time,
    }));
  }

  /**
   * Get risk summary across all customer meetings
   */
  async getRiskSummary(customerId: string): Promise<{
    totalMeetings: number;
    riskMeetings: number;
    highestRiskLevel: string;
    recentRisks: RiskSignal[];
  }> {
    const { data } = await supabase
      .from('meeting_analyses')
      .select('risk_level, risk_signals')
      .eq('customer_id', customerId)
      .order('analyzed_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) {
      return {
        totalMeetings: 0,
        riskMeetings: 0,
        highestRiskLevel: 'low',
        recentRisks: [],
      };
    }

    const riskMeetings = data.filter(
      (m) => m.risk_level !== 'low'
    ).length;

    const riskLevelOrder = ['low', 'medium', 'high', 'critical'];
    const highestRiskLevel = data.reduce(
      (highest, m) =>
        riskLevelOrder.indexOf(m.risk_level) > riskLevelOrder.indexOf(highest)
          ? m.risk_level
          : highest,
      'low'
    );

    const recentRisks = data
      .flatMap((m) =>
        typeof m.risk_signals === 'string'
          ? JSON.parse(m.risk_signals)
          : m.risk_signals
      )
      .slice(0, 5);

    return {
      totalMeetings: data.length,
      riskMeetings,
      highestRiskLevel,
      recentRisks,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const meetingIntelligenceService = new MeetingIntelligenceService();
