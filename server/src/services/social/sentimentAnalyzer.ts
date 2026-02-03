/**
 * Social Mention Sentiment Analyzer (PRD-019)
 *
 * AI-powered sentiment analysis for social mentions:
 * - Sentiment scoring (-100 to +100)
 * - Theme identification
 * - Risk indicator detection
 * - Response recommendations
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import {
  SocialMention,
  MentionSentiment,
  SentimentAnalysisResult,
  MentionTheme,
  ResponseDraft,
  ResponseOption,
} from '../../../../types/socialMention.js';

// Initialize Anthropic client
let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

// ============================================================================
// Constants
// ============================================================================

const POSITIVE_KEYWORDS = [
  'love', 'amazing', 'excellent', 'fantastic', 'great', 'awesome',
  'incredible', 'best', 'recommend', 'impressed', 'thank', 'helpful',
  'transformed', 'game changer', 'innovative', 'seamless', 'intuitive',
];

const NEGATIVE_KEYWORDS = [
  'frustrated', 'disappointed', 'terrible', 'worst', 'hate', 'awful',
  'unacceptable', 'unresponsive', 'issue', 'problem', 'bug', 'broken',
  'switching', 'alternative', 'competitor', 'cancel', 'refund', 'waste',
];

const THEME_KEYWORDS: Record<string, string[]> = {
  'Customer Support': ['support', 'help', 'response', 'ticket', 'service', 'team'],
  'Product Features': ['feature', 'functionality', 'capability', 'tool', 'ai', 'automation'],
  'Ease of Use': ['easy', 'intuitive', 'simple', 'onboarding', 'learning curve', 'ux'],
  'Pricing': ['price', 'cost', 'value', 'expensive', 'affordable', 'roi', 'worth'],
  'Competition': ['competitor', 'alternative', 'vs', 'compared', 'switch', 'migrate'],
  'Performance': ['fast', 'slow', 'performance', 'speed', 'reliable', 'downtime'],
  'Integration': ['integration', 'connect', 'api', 'sync', 'import', 'export'],
};

// ============================================================================
// Core Analysis
// ============================================================================

/**
 * Analyze sentiment of a single mention
 */
export async function analyzeMentionSentiment(
  content: string,
  platform: string
): Promise<SentimentAnalysisResult> {
  // Try Claude first if available
  if (anthropic) {
    try {
      return await analyzeWithClaude(content, platform);
    } catch (error) {
      console.error('[SocialSentiment] Claude analysis failed:', error);
      // Fall through to basic analysis
    }
  }

  // Fallback to basic keyword analysis
  return analyzeBasic(content);
}

/**
 * Analyze sentiment using Claude AI
 */
async function analyzeWithClaude(
  content: string,
  platform: string
): Promise<SentimentAnalysisResult> {
  const prompt = `Analyze the sentiment of this social media mention about a B2B software product.

Platform: ${platform}
Content: "${content}"

Provide analysis in JSON format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <number from -100 to +100>,
  "confidence": <number from 0 to 1>,
  "themes": [<array of themes like "Customer Support", "Product Features", "Pricing", etc>],
  "emotional_indicators": [<array of detected emotions>],
  "risk_indicators": [<array of concerning phrases if any>]
}

Return ONLY valid JSON.`;

  const response = await anthropic!.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      sentiment: analysis.sentiment || 'neutral',
      score: Math.max(-100, Math.min(100, analysis.score || 0)),
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.7)),
      themes: analysis.themes || [],
      emotional_indicators: analysis.emotional_indicators || [],
      risk_indicators: analysis.risk_indicators || [],
    };
  } catch (error) {
    console.error('[SocialSentiment] Failed to parse Claude response:', error);
    return analyzeBasic(content);
  }
}

/**
 * Basic keyword-based sentiment analysis fallback
 */
function analyzeBasic(content: string): SentimentAnalysisResult {
  const lowerContent = content.toLowerCase();
  let score = 0;
  const emotionalIndicators: string[] = [];
  const riskIndicators: string[] = [];
  const themes: string[] = [];

  // Score based on positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      score += 15;
      emotionalIndicators.push(keyword);
    }
  }

  // Score based on negative keywords
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      score -= 20;
      emotionalIndicators.push(keyword);
      riskIndicators.push(keyword);
    }
  }

  // Identify themes
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        if (!themes.includes(theme)) {
          themes.push(theme);
        }
        break;
      }
    }
  }

  // Clamp score
  score = Math.max(-100, Math.min(100, score));

  // Determine sentiment category
  let sentiment: MentionSentiment = 'neutral';
  if (score >= 20) sentiment = 'positive';
  else if (score <= -20) sentiment = 'negative';

  return {
    sentiment,
    score,
    confidence: 0.6,
    themes,
    emotional_indicators: [...new Set(emotionalIndicators)],
    risk_indicators: [...new Set(riskIndicators)],
  };
}

// ============================================================================
// Batch Analysis
// ============================================================================

/**
 * Analyze multiple mentions in batch
 */
export async function analyzeMentionsBatch(
  mentions: Array<{ id: string; content: string; platform: string }>
): Promise<Map<string, SentimentAnalysisResult>> {
  const results = new Map<string, SentimentAnalysisResult>();

  // Process in parallel with concurrency limit
  const concurrency = 5;
  for (let i = 0; i < mentions.length; i += concurrency) {
    const batch = mentions.slice(i, i + concurrency);
    const analyses = await Promise.all(
      batch.map(async (mention) => {
        const result = await analyzeMentionSentiment(mention.content, mention.platform);
        return { id: mention.id, result };
      })
    );

    for (const { id, result } of analyses) {
      results.set(id, result);
    }
  }

  return results;
}

// ============================================================================
// Theme Aggregation
// ============================================================================

/**
 * Aggregate themes across multiple mentions
 */
export function aggregateThemes(
  mentions: Array<{ themes: string[]; sentiment: MentionSentiment; score: number }>
): MentionTheme[] {
  const themeStats = new Map<string, { count: number; scores: number[]; sentiments: MentionSentiment[] }>();

  for (const mention of mentions) {
    for (const theme of mention.themes) {
      if (!themeStats.has(theme)) {
        themeStats.set(theme, { count: 0, scores: [], sentiments: [] });
      }
      const stats = themeStats.get(theme)!;
      stats.count++;
      stats.scores.push(mention.score);
      stats.sentiments.push(mention.sentiment);
    }
  }

  const themes: MentionTheme[] = [];
  for (const [name, stats] of themeStats) {
    const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;

    // Determine overall sentiment for theme
    const sentimentCounts = {
      positive: stats.sentiments.filter(s => s === 'positive').length,
      neutral: stats.sentiments.filter(s => s === 'neutral').length,
      negative: stats.sentiments.filter(s => s === 'negative').length,
    };

    let sentiment: MentionSentiment = 'neutral';
    if (sentimentCounts.positive > sentimentCounts.negative) sentiment = 'positive';
    else if (sentimentCounts.negative > sentimentCounts.positive) sentiment = 'negative';

    themes.push({
      name,
      count: stats.count,
      sentiment,
      avg_score: Math.round(avgScore),
    });
  }

  return themes.sort((a, b) => b.count - a.count);
}

// ============================================================================
// Response Generation
// ============================================================================

/**
 * Generate response options for a negative mention
 */
export async function generateResponseOptions(
  mention: SocialMention,
  customerName?: string
): Promise<ResponseDraft> {
  const options: ResponseOption[] = [];

  if (anthropic) {
    try {
      const prompt = `Generate 2-3 professional response options for this negative social media mention about our B2B software product.

Platform: ${mention.platform}
Author: ${mention.author}${mention.author_handle ? ` (@${mention.author_handle})` : ''}
Customer: ${customerName || 'Unknown/Unidentified'}
Content: "${mention.content}"

Generate response options in JSON format:
{
  "options": [
    {
      "type": "empathetic" | "direct" | "escalation",
      "text": "<response text appropriate for the platform>",
      "tone": "<brief description of the tone>"
    }
  ]
}

Guidelines:
- Keep responses under 280 characters for Twitter
- Be professional and empathetic
- Offer to move conversation to DM for resolution
- Never be defensive or dismissive

Return ONLY valid JSON.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.options && Array.isArray(parsed.options)) {
          options.push(...parsed.options);
        }
      }
    } catch (error) {
      console.error('[SocialSentiment] Response generation failed:', error);
    }
  }

  // Fallback templates if Claude fails or is not available
  if (options.length === 0) {
    options.push(
      {
        type: 'empathetic',
        text: `Hi ${mention.author.split(' ')[0]}, we're really sorry to hear about your experience. This isn't the level of service we aim to provide. Could you DM us your details? We'd like to personally ensure this gets resolved.`,
        tone: 'Empathetic and action-oriented',
      },
      {
        type: 'direct',
        text: `We hear you and take this seriously. Please DM us your account details so we can escalate this immediately and get it resolved for you today.`,
        tone: 'Direct and responsive',
      }
    );
  }

  return {
    mention_id: mention.id,
    response_options: options,
    recommended: 0, // First option is recommended
  };
}

// ============================================================================
// Risk Detection
// ============================================================================

/**
 * Detect high-risk mentions requiring immediate attention
 */
export function identifyHighRiskMentions(
  mentions: SocialMention[]
): SocialMention[] {
  return mentions.filter(mention => {
    // High follower count + negative sentiment
    if (mention.author_followers && mention.author_followers > 10000 && mention.sentiment === 'negative') {
      return true;
    }

    // High engagement + negative sentiment
    const totalEngagement = mention.engagement.likes + mention.engagement.shares + mention.engagement.comments;
    if (totalEngagement > 50 && mention.sentiment === 'negative') {
      return true;
    }

    // Very negative score
    if (mention.sentiment_score < -50) {
      return true;
    }

    // Contains specific risk keywords
    const lowerContent = mention.content.toLowerCase();
    const highRiskKeywords = ['lawsuit', 'legal', 'cancel', 'switching', 'competitor'];
    if (highRiskKeywords.some(kw => lowerContent.includes(kw))) {
      return true;
    }

    return false;
  });
}

// ============================================================================
// Exports
// ============================================================================

export const socialSentimentAnalyzer = {
  analyzeMentionSentiment,
  analyzeMentionsBatch,
  aggregateThemes,
  generateResponseOptions,
  identifyHighRiskMentions,
};

export default socialSentimentAnalyzer;
