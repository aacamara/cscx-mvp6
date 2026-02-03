/**
 * Transcript Analyzer Service
 * PRD-116: AI-powered analysis of meeting transcripts
 *
 * Extracts:
 * - Summary (3-5 bullet points)
 * - Action items with owners and due dates
 * - Commitments made by both parties
 * - Risk signals
 * - Expansion signals
 * - Competitor mentions
 * - Sentiment analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import type {
  TranscriptAnalysisInput,
  TranscriptAnalysisOutput,
  ActionItem,
  Commitment,
  RiskSignal,
  ExpansionSignal,
  Sentiment,
} from './types.js';

// ============================================
// Constants
// ============================================

const MAX_TRANSCRIPT_LENGTH = 100000; // ~25k tokens
const DEFAULT_ACTION_ITEM_DUE_DAYS = 7;

// ============================================
// Transcript Analyzer
// ============================================

export class TranscriptAnalyzer {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Analyze a meeting transcript and extract structured insights
   */
  async analyze(input: TranscriptAnalysisInput): Promise<TranscriptAnalysisOutput> {
    if (!this.anthropic) {
      console.warn('Anthropic API not configured, returning fallback analysis');
      return this.getFallbackAnalysis(input);
    }

    try {
      const truncatedTranscript = input.transcript.substring(0, MAX_TRANSCRIPT_LENGTH);

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(input, truncatedTranscript);

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '';

      return this.parseAnalysisResponse(responseText);
    } catch (error) {
      console.error('Transcript analysis failed:', error);
      throw new Error(`Transcript analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Build the system prompt for analysis
   */
  private buildSystemPrompt(): string {
    return `You are an expert Customer Success Manager AI assistant that analyzes meeting transcripts.

Your job is to extract key information from customer call transcripts to help CSMs follow up effectively.

You must:
1. Extract ALL action items mentioned - be thorough, don't miss any
2. Identify commitments made by both parties
3. Detect any risk signals (churn indicators, frustration, unmet expectations)
4. Identify expansion opportunities (interest in new features, additional use cases)
5. Note any competitor mentions
6. Assess overall sentiment accurately

Be specific and actionable. Use exact quotes when relevant. Assign reasonable due dates if not explicitly stated (default to 7 days).

IMPORTANT: Never hallucinate or make up action items that weren't discussed. Only extract what was actually mentioned.

Always return valid JSON matching the exact schema requested.`;
  }

  /**
   * Build the user prompt with transcript and context
   */
  private buildUserPrompt(input: TranscriptAnalysisInput, transcript: string): string {
    return `Analyze this customer meeting transcript and extract structured insights.

## Meeting Context
- Title: ${input.meetingTitle}
${input.customerName ? `- Customer: ${input.customerName}` : ''}
${input.participants?.length ? `- Participants: ${input.participants.join(', ')}` : ''}
${input.meetingType ? `- Meeting Type: ${input.meetingType}` : ''}

## Transcript
${transcript}

## Required Output
Return a JSON object with EXACTLY this structure:

{
  "summary": "2-4 sentences summarizing the main discussion points and outcomes",
  "actionItems": [
    {
      "description": "Clear, specific action item description",
      "owner": "Name of person responsible",
      "ownerType": "internal" or "customer",
      "dueDate": "YYYY-MM-DD or null if not specified",
      "priority": "high", "medium", or "low"
    }
  ],
  "commitments": [
    {
      "description": "What was committed to",
      "party": "us" or "customer",
      "deadline": "YYYY-MM-DD or omit if not specified"
    }
  ],
  "riskSignals": [
    {
      "type": "churn_risk" | "dissatisfaction" | "budget_concerns" | "champion_leaving" | "adoption_issues" | "other",
      "severity": "low", "medium", or "high",
      "description": "What was said that indicates this risk"
    }
  ],
  "expansionSignals": [
    {
      "type": "upsell" | "cross_sell" | "additional_seats" | "new_use_case" | "referral",
      "description": "What was said that indicates this opportunity",
      "potentialValue": estimated_value_in_dollars_or_null
    }
  ],
  "competitorMentions": ["List of competitor names mentioned"],
  "sentiment": "positive", "neutral", "negative", or "mixed",
  "sentimentScore": number from -1.0 to 1.0,
  "keyTopics": ["Main topics discussed"],
  "nextSteps": ["Agreed next steps from the meeting"]
}

Return ONLY valid JSON. No markdown, no explanation.`;
  }

  /**
   * Parse the AI response into structured output
   */
  private parseAnalysisResponse(text: string): TranscriptAnalysisOutput {
    // Clean up the response
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

      // Validate and normalize the response
      return {
        summary: parsed.summary || 'No summary available',
        actionItems: this.normalizeActionItems(parsed.actionItems || []),
        commitments: this.normalizeCommitments(parsed.commitments || []),
        riskSignals: this.normalizeRiskSignals(parsed.riskSignals || []),
        expansionSignals: this.normalizeExpansionSignals(parsed.expansionSignals || []),
        competitorMentions: parsed.competitorMentions || [],
        sentiment: this.normalizeSentiment(parsed.sentiment),
        sentimentScore: this.normalizeSentimentScore(parsed.sentimentScore),
        keyTopics: parsed.keyTopics || [],
        nextSteps: parsed.nextSteps || [],
      };
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      throw new Error('Failed to parse AI analysis response');
    }
  }

  /**
   * Normalize action items with defaults
   */
  private normalizeActionItems(items: unknown[]): ActionItem[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        description: String(item.description || ''),
        owner: String(item.owner || 'Unassigned'),
        ownerType: item.ownerType === 'customer' ? 'customer' : 'internal',
        dueDate: item.dueDate ? String(item.dueDate) : this.getDefaultDueDate(),
        priority: this.normalizePriority(item.priority),
      }))
      .filter((item) => item.description.length > 0);
  }

  /**
   * Normalize commitments
   */
  private normalizeCommitments(items: unknown[]): Commitment[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        description: String(item.description || ''),
        party: item.party === 'customer' ? 'customer' : 'us',
        deadline: item.deadline ? String(item.deadline) : undefined,
      }))
      .filter((item) => item.description.length > 0);
  }

  /**
   * Normalize risk signals
   */
  private normalizeRiskSignals(items: unknown[]): RiskSignal[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        type: String(item.type || 'other'),
        severity: this.normalizeSeverity(item.severity),
        description: String(item.description || ''),
      }))
      .filter((item) => item.description.length > 0);
  }

  /**
   * Normalize expansion signals
   */
  private normalizeExpansionSignals(items: unknown[]): ExpansionSignal[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        type: String(item.type || 'other'),
        description: String(item.description || ''),
        potentialValue:
          typeof item.potentialValue === 'number' ? item.potentialValue : undefined,
      }))
      .filter((item) => item.description.length > 0);
  }

  /**
   * Normalize sentiment value
   */
  private normalizeSentiment(value: unknown): Sentiment {
    const valid: Sentiment[] = ['positive', 'neutral', 'negative', 'mixed'];
    return valid.includes(value as Sentiment) ? (value as Sentiment) : 'neutral';
  }

  /**
   * Normalize sentiment score
   */
  private normalizeSentimentScore(value: unknown): number {
    if (typeof value !== 'number') return 0;
    return Math.max(-1, Math.min(1, value));
  }

  /**
   * Normalize priority value
   */
  private normalizePriority(value: unknown): 'high' | 'medium' | 'low' {
    const valid = ['high', 'medium', 'low'];
    return valid.includes(value as string) ? (value as 'high' | 'medium' | 'low') : 'medium';
  }

  /**
   * Normalize severity value
   */
  private normalizeSeverity(value: unknown): 'low' | 'medium' | 'high' {
    const valid = ['low', 'medium', 'high'];
    return valid.includes(value as string) ? (value as 'low' | 'medium' | 'high') : 'medium';
  }

  /**
   * Get default due date (7 days from now)
   */
  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + DEFAULT_ACTION_ITEM_DUE_DAYS);
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate fallback analysis when AI is not available
   */
  private getFallbackAnalysis(input: TranscriptAnalysisInput): TranscriptAnalysisOutput {
    return {
      summary: `Meeting: ${input.meetingTitle}. Transcript analysis requires AI configuration.`,
      actionItems: [],
      commitments: [],
      riskSignals: [],
      expansionSignals: [],
      competitorMentions: [],
      sentiment: 'neutral',
      sentimentScore: 0,
      keyTopics: [],
      nextSteps: [],
    };
  }
}

// Export singleton
export const transcriptAnalyzer = new TranscriptAnalyzer();
