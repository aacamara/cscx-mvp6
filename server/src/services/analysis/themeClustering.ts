/**
 * Theme Clustering Service
 * PRD-010: Product Feedback Upload - Theme Clustering
 *
 * Uses AI-powered NLP to cluster feedback into coherent themes,
 * analyze sentiment, identify sub-themes, and track trends.
 *
 * Features:
 * - AI-powered theme identification (10-20 primary themes)
 * - Sub-theme detection within major categories
 * - Sentiment analysis per theme
 * - Customer distribution and ARR impact calculation
 * - Trend analysis (emerging vs declining themes)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import { ParsedFeedbackItem, FeedbackSource } from '../feedback/feedbackParser.js';

// ============================================
// Types
// ============================================

export type SentimentLevel = 'very_negative' | 'negative' | 'mixed' | 'neutral' | 'positive' | 'very_positive';

export interface Theme {
  id: string;
  name: string;
  description: string;
  frequency: number;
  sentimentScore: number; // -1 to 1
  sentimentLevel: SentimentLevel;
  customerCount: number;
  arrImpact: number;
  subThemes: SubTheme[];
  sampleFeedback: SampleFeedback[];
  customerSegments: Record<string, number>; // segment -> count
  trendDirection: 'increasing' | 'stable' | 'decreasing' | 'new';
  isHighImpact: boolean; // high frequency + negative sentiment
  feedbackIds: string[];
}

export interface SubTheme {
  id: string;
  name: string;
  frequency: number;
  sentimentScore: number;
  feedbackIds: string[];
}

export interface SampleFeedback {
  text: string;
  customerName?: string;
  sentiment: SentimentLevel;
  source: FeedbackSource;
}

export interface ThemeClusteringResult {
  uploadId: string;
  themes: Theme[];
  summary: ThemeSummary;
  emergingThemes: EmergingTheme[];
  highImpactThemes: Theme[];
  segmentMatrix: SegmentThemeMatrix;
  processedAt: Date;
  processingTimeMs: number;
}

export interface ThemeSummary {
  totalFeedbackItems: number;
  totalThemes: number;
  totalSubThemes: number;
  averageSentiment: number;
  customersAnalyzed: number;
  totalArrRepresented: number;
  dominantTheme: string;
  mostNegativeTheme: string;
  mostPositiveTheme: string;
}

export interface EmergingTheme {
  name: string;
  frequency: number;
  sentiment: SentimentLevel;
  isNew: boolean;
  growthRate?: number; // Percentage growth vs previous period
}

export interface SegmentThemeMatrix {
  segments: string[];
  themes: string[];
  data: number[][]; // segments x themes frequency matrix
}

// AI Response Types
interface AIThemeResponse {
  themes: Array<{
    name: string;
    description: string;
    sub_themes: string[];
    sentiment: 'very_negative' | 'negative' | 'mixed' | 'neutral' | 'positive' | 'very_positive';
    sentiment_score: number;
    is_emerging: boolean;
    feedback_indices: number[];
  }>;
  summary: {
    dominant_theme: string;
    most_negative_theme: string;
    most_positive_theme: string;
    overall_sentiment: number;
  };
}

// ============================================
// Service Class
// ============================================

class ThemeClusteringService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Cluster feedback items into themes using AI
   */
  async clusterFeedback(
    uploadId: string,
    items: ParsedFeedbackItem[],
    options: {
      minThemes?: number;
      maxThemes?: number;
      previousThemes?: Theme[]; // For trend comparison
    } = {}
  ): Promise<ThemeClusteringResult> {
    const startTime = Date.now();
    const { minThemes = 5, maxThemes = 20 } = options;

    if (items.length === 0) {
      throw new Error('No feedback items to cluster');
    }

    // Prepare feedback for AI analysis
    const feedbackForAnalysis = items.map((item, idx) => ({
      index: idx,
      text: item.text.substring(0, 500), // Limit text length
      source: item.source,
      segment: item.customerSegment || 'Unknown'
    }));

    // Get themes from AI
    const aiResponse = await this.analyzeWithAI(feedbackForAnalysis, minThemes, maxThemes);

    // Build theme objects with full data
    const themes = await this.buildThemes(aiResponse.themes, items, options.previousThemes);

    // Calculate summary
    const summary = this.calculateSummary(themes, items, aiResponse.summary);

    // Identify high-impact themes (high frequency + negative sentiment)
    const highImpactThemes = themes.filter(t => t.isHighImpact)
      .sort((a, b) => b.arrImpact - a.arrImpact);

    // Identify emerging themes
    const emergingThemes = this.identifyEmergingThemes(themes, options.previousThemes);

    // Build segment matrix
    const segmentMatrix = this.buildSegmentMatrix(themes, items);

    // Store results
    if (this.supabase) {
      await this.saveClusteringResult(uploadId, themes, summary);
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      uploadId,
      themes,
      summary,
      emergingThemes,
      highImpactThemes,
      segmentMatrix,
      processedAt: new Date(),
      processingTimeMs
    };
  }

  /**
   * Get clustering result for an upload
   */
  async getClusteringResult(uploadId: string): Promise<ThemeClusteringResult | null> {
    if (!this.supabase) return null;

    const { data: themesData, error } = await this.supabase
      .from('feedback_themes')
      .select('*')
      .eq('upload_id', uploadId)
      .order('frequency', { ascending: false });

    if (error || !themesData || themesData.length === 0) return null;

    const themes = themesData.map(this.mapDbTheme);

    // Get feedback items for segment matrix
    const { data: itemsData } = await this.supabase
      .from('feedback_items')
      .select('id, customer_segment')
      .eq('upload_id', uploadId);

    const items = (itemsData || []).map(d => ({
      id: d.id,
      customerSegment: d.customer_segment
    })) as ParsedFeedbackItem[];

    // Build segment matrix
    const segmentMatrix = this.buildSegmentMatrix(themes, items);

    // Calculate summary
    const totalArr = themes.reduce((sum, t) => sum + t.arrImpact, 0);
    const summary: ThemeSummary = {
      totalFeedbackItems: themes.reduce((sum, t) => sum + t.frequency, 0),
      totalThemes: themes.length,
      totalSubThemes: themes.reduce((sum, t) => sum + t.subThemes.length, 0),
      averageSentiment: themes.reduce((sum, t) => sum + t.sentimentScore, 0) / themes.length,
      customersAnalyzed: new Set(themes.flatMap(t => Object.values(t.customerSegments))).size,
      totalArrRepresented: totalArr,
      dominantTheme: themes[0]?.name || '',
      mostNegativeTheme: themes.reduce((a, b) => a.sentimentScore < b.sentimentScore ? a : b)?.name || '',
      mostPositiveTheme: themes.reduce((a, b) => a.sentimentScore > b.sentimentScore ? a : b)?.name || ''
    };

    return {
      uploadId,
      themes,
      summary,
      emergingThemes: themes.filter(t => t.trendDirection === 'new').map(t => ({
        name: t.name,
        frequency: t.frequency,
        sentiment: t.sentimentLevel,
        isNew: true
      })),
      highImpactThemes: themes.filter(t => t.isHighImpact),
      segmentMatrix,
      processedAt: new Date(),
      processingTimeMs: 0
    };
  }

  /**
   * Drill into a specific theme
   */
  async getThemeDetail(
    uploadId: string,
    themeId: string
  ): Promise<Theme | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('feedback_themes')
      .select('*')
      .eq('upload_id', uploadId)
      .eq('id', themeId)
      .single();

    if (error || !data) return null;
    return this.mapDbTheme(data);
  }

  // ============================================
  // Private Methods
  // ============================================

  private async analyzeWithAI(
    feedbackItems: Array<{ index: number; text: string; source: string; segment: string }>,
    minThemes: number,
    maxThemes: number
  ): Promise<AIThemeResponse> {
    const defaultResponse: AIThemeResponse = {
      themes: [],
      summary: {
        dominant_theme: 'General Feedback',
        most_negative_theme: 'Unknown',
        most_positive_theme: 'Unknown',
        overall_sentiment: 0
      }
    };

    if (!this.anthropic) {
      console.warn('Claude API not configured, using basic clustering');
      return this.basicClustering(feedbackItems);
    }

    const systemPrompt = `You are an expert product feedback analyst. Your task is to cluster customer feedback into coherent, actionable themes.

Guidelines:
- Identify ${minThemes}-${maxThemes} primary themes based on the feedback content
- Each theme should be distinct and actionable for a product team
- Provide clear, concise theme names (2-5 words)
- Identify sub-themes within major categories
- Analyze sentiment accurately based on language used
- Mark themes as emerging if they seem new or unexpected
- Return indices of feedback items that belong to each theme`;

    const prompt = `Analyze this customer feedback and cluster it into themes.

Feedback items:
${feedbackItems.map(item => `[${item.index}] (${item.source}/${item.segment}) "${item.text}"`).join('\n\n')}

Return a JSON object with:
{
  "themes": [
    {
      "name": "Theme Name",
      "description": "Brief description of this theme",
      "sub_themes": ["Sub-theme 1", "Sub-theme 2"],
      "sentiment": "very_negative" | "negative" | "mixed" | "neutral" | "positive" | "very_positive",
      "sentiment_score": -1.0 to 1.0,
      "is_emerging": boolean,
      "feedback_indices": [0, 1, 5, ...]
    }
  ],
  "summary": {
    "dominant_theme": "Most frequent theme name",
    "most_negative_theme": "Theme with lowest sentiment",
    "most_positive_theme": "Theme with highest sentiment",
    "overall_sentiment": -1.0 to 1.0
  }
}

Return ONLY valid JSON, no markdown.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = message.content.find(block => block.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '';

      // Parse JSON response
      let jsonString = responseText.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      return JSON.parse(jsonString) as AIThemeResponse;
    } catch (error) {
      console.error('AI theme clustering failed:', error);
      // Fall back to basic clustering
      return this.basicClustering(feedbackItems);
    }
  }

  private basicClustering(
    feedbackItems: Array<{ index: number; text: string; source: string; segment: string }>
  ): AIThemeResponse {
    // Simple keyword-based clustering as fallback
    const keywords: Record<string, { pattern: RegExp; sentiment: number }> = {
      'Performance Issues': { pattern: /slow|performance|speed|loading|lag|timeout/i, sentiment: -0.6 },
      'Feature Requests': { pattern: /feature|request|wish|want|need|add/i, sentiment: -0.1 },
      'UI/UX Feedback': { pattern: /ui|ux|interface|design|confusing|intuitive/i, sentiment: -0.3 },
      'Bug Reports': { pattern: /bug|error|broken|fix|crash|issue/i, sentiment: -0.7 },
      'Positive Feedback': { pattern: /great|love|excellent|amazing|helpful|easy/i, sentiment: 0.8 },
      'Support Experience': { pattern: /support|help|customer[\s_-]?service|response/i, sentiment: 0 },
      'Pricing Concerns': { pattern: /price|cost|expensive|cheap|value|worth/i, sentiment: -0.4 },
      'Integration Requests': { pattern: /integrat|api|connect|sync|plugin/i, sentiment: -0.1 },
      'Documentation': { pattern: /doc|documentation|guide|tutorial|help[\s_-]?center/i, sentiment: -0.2 },
      'General Feedback': { pattern: /.*/i, sentiment: 0 }
    };

    const themes: AIThemeResponse['themes'] = [];
    const assignedIndices = new Set<number>();

    for (const [name, { pattern, sentiment }] of Object.entries(keywords)) {
      if (name === 'General Feedback') continue;

      const matchingIndices = feedbackItems
        .filter(item => pattern.test(item.text) && !assignedIndices.has(item.index))
        .map(item => item.index);

      if (matchingIndices.length > 0) {
        matchingIndices.forEach(idx => assignedIndices.add(idx));
        themes.push({
          name,
          description: `Feedback related to ${name.toLowerCase()}`,
          sub_themes: [],
          sentiment: this.getSentimentLevel(sentiment),
          sentiment_score: sentiment,
          is_emerging: false,
          feedback_indices: matchingIndices
        });
      }
    }

    // Assign remaining to General Feedback
    const remainingIndices = feedbackItems
      .filter(item => !assignedIndices.has(item.index))
      .map(item => item.index);

    if (remainingIndices.length > 0) {
      themes.push({
        name: 'General Feedback',
        description: 'Miscellaneous feedback not fitting other categories',
        sub_themes: [],
        sentiment: 'neutral',
        sentiment_score: 0,
        is_emerging: false,
        feedback_indices: remainingIndices
      });
    }

    const dominantTheme = themes.sort((a, b) => b.feedback_indices.length - a.feedback_indices.length)[0];

    return {
      themes,
      summary: {
        dominant_theme: dominantTheme?.name || 'General Feedback',
        most_negative_theme: themes.reduce((a, b) => a.sentiment_score < b.sentiment_score ? a : b)?.name || 'Unknown',
        most_positive_theme: themes.reduce((a, b) => a.sentiment_score > b.sentiment_score ? a : b)?.name || 'Unknown',
        overall_sentiment: themes.reduce((sum, t) => sum + t.sentiment_score * t.feedback_indices.length, 0) /
          feedbackItems.length
      }
    };
  }

  private getSentimentLevel(score: number): SentimentLevel {
    if (score <= -0.6) return 'very_negative';
    if (score <= -0.2) return 'negative';
    if (score <= 0.2) return score < 0 ? 'mixed' : 'neutral';
    if (score <= 0.6) return 'positive';
    return 'very_positive';
  }

  private async buildThemes(
    aiThemes: AIThemeResponse['themes'],
    items: ParsedFeedbackItem[],
    previousThemes?: Theme[]
  ): Promise<Theme[]> {
    const previousThemeMap = new Map(previousThemes?.map(t => [t.name.toLowerCase(), t]) || []);

    return aiThemes.map(aiTheme => {
      const feedbackItems = aiTheme.feedback_indices.map(idx => items[idx]).filter(Boolean);
      const customerIds = new Set(feedbackItems.map(i => i.customerId || i.customerName || i.customerEmail).filter(Boolean));
      const arrImpact = feedbackItems.reduce((sum, i) => sum + (i.customerArr || 0), 0);

      // Calculate segment distribution
      const customerSegments: Record<string, number> = {};
      feedbackItems.forEach(item => {
        const segment = item.customerSegment || 'Unknown';
        customerSegments[segment] = (customerSegments[segment] || 0) + 1;
      });

      // Sample feedback (up to 3)
      const sampleFeedback: SampleFeedback[] = feedbackItems.slice(0, 3).map(item => ({
        text: item.text,
        customerName: item.customerName,
        sentiment: aiTheme.sentiment,
        source: item.source
      }));

      // Build sub-themes
      const subThemes: SubTheme[] = aiTheme.sub_themes.map(name => ({
        id: uuidv4(),
        name,
        frequency: Math.floor(feedbackItems.length / (aiTheme.sub_themes.length || 1)),
        sentimentScore: aiTheme.sentiment_score,
        feedbackIds: []
      }));

      // Determine trend direction
      const previousTheme = previousThemeMap.get(aiTheme.name.toLowerCase());
      let trendDirection: Theme['trendDirection'] = 'new';
      if (previousTheme) {
        const changePercent = ((feedbackItems.length - previousTheme.frequency) / previousTheme.frequency) * 100;
        if (changePercent > 20) trendDirection = 'increasing';
        else if (changePercent < -20) trendDirection = 'decreasing';
        else trendDirection = 'stable';
      } else if (aiTheme.is_emerging) {
        trendDirection = 'new';
      }

      // Determine if high impact (frequency > 10% and sentiment < -0.3)
      const isHighImpact = feedbackItems.length > items.length * 0.1 && aiTheme.sentiment_score < -0.3;

      return {
        id: uuidv4(),
        name: aiTheme.name,
        description: aiTheme.description,
        frequency: feedbackItems.length,
        sentimentScore: aiTheme.sentiment_score,
        sentimentLevel: aiTheme.sentiment,
        customerCount: customerIds.size,
        arrImpact,
        subThemes,
        sampleFeedback,
        customerSegments,
        trendDirection,
        isHighImpact,
        feedbackIds: feedbackItems.map(i => i.id)
      };
    });
  }

  private calculateSummary(
    themes: Theme[],
    items: ParsedFeedbackItem[],
    aiSummary: AIThemeResponse['summary']
  ): ThemeSummary {
    const customerIds = new Set(items.map(i => i.customerId || i.customerName || i.customerEmail).filter(Boolean));
    const totalArr = items.reduce((sum, i) => sum + (i.customerArr || 0), 0);

    return {
      totalFeedbackItems: items.length,
      totalThemes: themes.length,
      totalSubThemes: themes.reduce((sum, t) => sum + t.subThemes.length, 0),
      averageSentiment: aiSummary.overall_sentiment,
      customersAnalyzed: customerIds.size,
      totalArrRepresented: totalArr,
      dominantTheme: aiSummary.dominant_theme,
      mostNegativeTheme: aiSummary.most_negative_theme,
      mostPositiveTheme: aiSummary.most_positive_theme
    };
  }

  private identifyEmergingThemes(themes: Theme[], previousThemes?: Theme[]): EmergingTheme[] {
    const previousMap = new Map(previousThemes?.map(t => [t.name.toLowerCase(), t]) || []);

    return themes
      .filter(t => t.trendDirection === 'new' || t.trendDirection === 'increasing')
      .map(t => {
        const previous = previousMap.get(t.name.toLowerCase());
        return {
          name: t.name,
          frequency: t.frequency,
          sentiment: t.sentimentLevel,
          isNew: t.trendDirection === 'new',
          growthRate: previous
            ? ((t.frequency - previous.frequency) / previous.frequency) * 100
            : undefined
        };
      });
  }

  private buildSegmentMatrix(themes: Theme[], items: ParsedFeedbackItem[]): SegmentThemeMatrix {
    const segments = [...new Set(items.map(i => i.customerSegment || 'Unknown'))].sort();
    const themeNames = themes.map(t => t.name);

    // Build frequency matrix
    const data: number[][] = segments.map(segment => {
      return themeNames.map(themeName => {
        const theme = themes.find(t => t.name === themeName);
        return theme?.customerSegments[segment] || 0;
      });
    });

    return { segments, themes: themeNames, data };
  }

  private async saveClusteringResult(
    uploadId: string,
    themes: Theme[],
    summary: ThemeSummary
  ): Promise<void> {
    if (!this.supabase) return;

    // Delete existing themes for this upload
    await this.supabase
      .from('feedback_themes')
      .delete()
      .eq('upload_id', uploadId);

    // Insert new themes
    const records = themes.map(theme => ({
      id: theme.id,
      upload_id: uploadId,
      name: theme.name,
      description: theme.description,
      frequency: theme.frequency,
      sentiment_score: theme.sentimentScore,
      sentiment_level: theme.sentimentLevel,
      customer_count: theme.customerCount,
      arr_impact: theme.arrImpact,
      sub_themes: theme.subThemes,
      sample_feedback: theme.sampleFeedback,
      customer_segments: theme.customerSegments,
      trend_direction: theme.trendDirection,
      is_high_impact: theme.isHighImpact,
      feedback_ids: theme.feedbackIds
    }));

    await this.supabase.from('feedback_themes').insert(records);

    // Update upload status
    await this.supabase
      .from('feedback_uploads')
      .update({
        status: 'clustered',
        clustered_at: new Date().toISOString()
      })
      .eq('id', uploadId);
  }

  private mapDbTheme(data: Record<string, unknown>): Theme {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string,
      frequency: data.frequency as number,
      sentimentScore: data.sentiment_score as number,
      sentimentLevel: data.sentiment_level as SentimentLevel,
      customerCount: data.customer_count as number,
      arrImpact: data.arr_impact as number,
      subThemes: (data.sub_themes as SubTheme[]) || [],
      sampleFeedback: (data.sample_feedback as SampleFeedback[]) || [],
      customerSegments: (data.customer_segments as Record<string, number>) || {},
      trendDirection: data.trend_direction as Theme['trendDirection'],
      isHighImpact: data.is_high_impact as boolean,
      feedbackIds: (data.feedback_ids as string[]) || []
    };
  }
}

// Singleton instance
export const themeClustering = new ThemeClusteringService();
export default themeClustering;
