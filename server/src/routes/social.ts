/**
 * Social Mention Routes (PRD-019)
 *
 * API endpoints for social mention sentiment tracking:
 * - POST /api/social/mentions/upload - Upload mention data
 * - GET /api/social/sentiment - Overall sentiment metrics
 * - GET /api/social/:customerId/mentions - Customer mentions
 * - POST /api/social/mentions/:id/respond - Track response
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { mentionParser } from '../services/social/mentionParser.js';
import { socialSentimentAnalyzer } from '../services/social/sentimentAnalyzer.js';
import { customerMatcher } from '../services/social/customerMatcher.js';
import {
  SocialMention,
  SocialPlatform,
  MentionSentiment,
  SocialSentimentSummary,
  PlatformBreakdown,
  AdvocateOpportunity,
} from '../../../types/socialMention.js';
import crypto from 'crypto';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Initialize Supabase
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Demo user ID for development
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

const getUserId = (req: Request): string | null => {
  if ((req as any).userId) return (req as any).userId;
  if (config.nodeEnv === 'development') return DEMO_USER_ID;
  return null;
};

// ============================================================================
// POST /api/social/mentions/upload
// Upload social mention data from CSV
// ============================================================================
router.post('/mentions/upload', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { file_content, file_name, source_tool } = req.body;

    if (!file_content) {
      return res.status(400).json({ error: 'file_content is required' });
    }

    // Parse CSV
    const { uploadId, result, mentions: parsedMentions } = mentionParser.processUpload(
      file_content,
      file_name || 'upload.csv',
      source_tool
    );

    if (parsedMentions.length === 0) {
      return res.status(400).json({
        error: 'No valid mentions found in CSV',
        details: result,
      });
    }

    // Analyze sentiment for all mentions
    const sentimentResults = await socialSentimentAnalyzer.analyzeMentionsBatch(
      parsedMentions.map(m => ({
        id: m.id,
        content: m.content,
        platform: m.platform,
      }))
    );

    // Match mentions to customers
    const processedMentions: SocialMention[] = [];
    for (const parsed of parsedMentions) {
      const sentiment = sentimentResults.get(parsed.id);

      const mention: SocialMention = {
        id: parsed.id,
        platform: parsed.platform,
        author: parsed.author,
        author_handle: parsed.author_handle,
        author_followers: parsed.author_followers,
        author_verified: parsed.author_verified,
        content: parsed.content,
        posted_at: parsed.posted_at,
        engagement: parsed.engagement,
        sentiment: sentiment?.sentiment || 'neutral',
        sentiment_score: sentiment?.score || 0,
        themes: sentiment?.themes || [],
        requires_response: sentiment ? sentiment.score < -20 : false,
        response_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      processedMentions.push(mention);
    }

    // Try to match customers
    const customerMatches = await customerMatcher.matchMentionsBatch(processedMentions);
    for (const mention of processedMentions) {
      const match = customerMatches.get(mention.id);
      if (match) {
        mention.customer_id = match.customer_id;
        mention.customer_name = match.customer_name;
        mention.match_confidence = match.confidence;
      }
    }

    // Store mentions in database
    if (supabase) {
      const { error } = await supabase.from('social_mentions').insert(
        processedMentions.map(m => ({
          id: m.id,
          upload_id: uploadId,
          platform: m.platform,
          author: m.author,
          author_handle: m.author_handle,
          author_followers: m.author_followers,
          author_verified: m.author_verified,
          content: m.content,
          posted_at: m.posted_at,
          engagement: m.engagement,
          sentiment: m.sentiment,
          sentiment_score: m.sentiment_score,
          themes: m.themes,
          customer_id: m.customer_id,
          match_confidence: m.match_confidence,
          requires_response: m.requires_response,
          response_status: m.response_status,
          created_at: m.created_at,
          updated_at: m.updated_at,
        }))
      );

      if (error) {
        console.error('[Social] Failed to store mentions:', error);
      }
    }

    // Generate summary
    const summary = generateSummary(uploadId, processedMentions);

    res.json({
      success: true,
      upload_id: uploadId,
      result,
      summary,
    });
  } catch (error) {
    console.error('[Social] Upload error:', error);
    res.status(500).json({
      error: 'Failed to process upload',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// GET /api/social/sentiment
// Get overall sentiment metrics
// ============================================================================
router.get('/sentiment', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string) || 30;
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();

    if (!supabase) {
      return res.json(getDefaultMetrics());
    }

    // Get mentions from database
    const { data: mentions } = await supabase
      .from('social_mentions')
      .select('*')
      .gte('posted_at', startDate)
      .order('posted_at', { ascending: false });

    if (!mentions || mentions.length === 0) {
      return res.json(getDefaultMetrics());
    }

    // Calculate metrics
    const totalMentions = mentions.length;
    const sentimentBreakdown = {
      positive: mentions.filter(m => m.sentiment === 'positive').length,
      neutral: mentions.filter(m => m.sentiment === 'neutral').length,
      negative: mentions.filter(m => m.sentiment === 'negative').length,
    };

    const avgScore = mentions.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / totalMentions;

    // Platform breakdown
    const platformStats = new Map<SocialPlatform, PlatformBreakdown>();
    for (const mention of mentions) {
      if (!platformStats.has(mention.platform)) {
        platformStats.set(mention.platform, {
          platform: mention.platform,
          total: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          avg_engagement: 0,
        });
      }
      const stats = platformStats.get(mention.platform)!;
      stats.total++;
      if (mention.sentiment === 'positive') stats.positive++;
      else if (mention.sentiment === 'neutral') stats.neutral++;
      else stats.negative++;
    }

    // Response rate
    const requiresResponse = mentions.filter(m => m.requires_response);
    const responded = requiresResponse.filter(m => m.response_status === 'responded');
    const responseRate = requiresResponse.length > 0
      ? (responded.length / requiresResponse.length) * 100
      : 100;

    res.json({
      overall_sentiment_score: Math.round(avgScore),
      total_mentions: totalMentions,
      date_range: {
        start: startDate,
        end: new Date().toISOString(),
      },
      sentiment_breakdown: {
        ...sentimentBreakdown,
        positive_pct: Math.round((sentimentBreakdown.positive / totalMentions) * 100),
        neutral_pct: Math.round((sentimentBreakdown.neutral / totalMentions) * 100),
        negative_pct: Math.round((sentimentBreakdown.negative / totalMentions) * 100),
      },
      platform_breakdown: Array.from(platformStats.values()),
      response_rate: Math.round(responseRate),
      requires_attention: mentions.filter(m => m.requires_response && m.response_status === 'pending').length,
    });
  } catch (error) {
    console.error('[Social] Get sentiment error:', error);
    res.status(500).json({
      error: 'Failed to get sentiment metrics',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// GET /api/social/mentions
// Get all mentions with filters
// ============================================================================
router.get('/mentions', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      customer_id,
      platform,
      sentiment,
      requires_response,
      date_from,
      date_to,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    if (!supabase) {
      return res.json({ mentions: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } });
    }

    let query = supabase
      .from('social_mentions')
      .select('*', { count: 'exact' })
      .order('posted_at', { ascending: false });

    if (customer_id) query = query.eq('customer_id', customer_id);
    if (platform) query = query.eq('platform', platform);
    if (sentiment) query = query.eq('sentiment', sentiment);
    if (requires_response === 'true') query = query.eq('requires_response', true);
    if (date_from) query = query.gte('posted_at', date_from);
    if (date_to) query = query.lte('posted_at', date_to);

    query = query.range(offset, offset + limitNum - 1);

    const { data: mentions, count } = await query;

    res.json({
      mentions: mentions || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    console.error('[Social] Get mentions error:', error);
    res.status(500).json({
      error: 'Failed to get mentions',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// GET /api/social/customer/:customerId/mentions
// Get mentions for a specific customer
// ============================================================================
router.get('/customer/:customerId/mentions', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { customerId } = req.params;
    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);

    if (!supabase) {
      return res.json({ mentions: [], customer_id: customerId });
    }

    const { data: mentions } = await supabase
      .from('social_mentions')
      .select('*')
      .eq('customer_id', customerId)
      .order('posted_at', { ascending: false })
      .limit(limitNum);

    // Get sentiment summary for customer
    const allMentions = mentions || [];
    const sentimentSummary = {
      total: allMentions.length,
      positive: allMentions.filter(m => m.sentiment === 'positive').length,
      neutral: allMentions.filter(m => m.sentiment === 'neutral').length,
      negative: allMentions.filter(m => m.sentiment === 'negative').length,
      avg_score: allMentions.length > 0
        ? Math.round(allMentions.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / allMentions.length)
        : 0,
    };

    res.json({
      customer_id: customerId,
      mentions: allMentions,
      sentiment_summary: sentimentSummary,
    });
  } catch (error) {
    console.error('[Social] Get customer mentions error:', error);
    res.status(500).json({
      error: 'Failed to get customer mentions',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// POST /api/social/mentions/:id/match
// Match a mention to a customer
// ============================================================================
router.post('/mentions/:id/match', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { author_info } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get the mention
    const { data: mention } = await supabase
      .from('social_mentions')
      .select('*')
      .eq('id', id)
      .single();

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    // Find matches
    const matches = await customerMatcher.matchMentionToCustomer(mention, author_info);

    res.json({
      mention_id: id,
      matches,
      best_match: matches.length > 0 ? matches[0] : null,
    });
  } catch (error) {
    console.error('[Social] Match error:', error);
    res.status(500).json({
      error: 'Failed to match mention',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// POST /api/social/mentions/:id/confirm-match
// Confirm a customer match
// ============================================================================
router.post('/mentions/:id/confirm-match', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    const success = await customerMatcher.confirmCustomerMatch(id, customer_id);

    if (success) {
      res.json({ success: true, mention_id: id, customer_id });
    } else {
      res.status(500).json({ error: 'Failed to confirm match' });
    }
  } catch (error) {
    console.error('[Social] Confirm match error:', error);
    res.status(500).json({
      error: 'Failed to confirm match',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// POST /api/social/mentions/:id/draft-response
// Generate response drafts for a mention
// ============================================================================
router.post('/mentions/:id/draft-response', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get the mention
    const { data: mention } = await supabase
      .from('social_mentions')
      .select('*')
      .eq('id', id)
      .single();

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    // Get customer name if matched
    let customerName: string | undefined;
    if (mention.customer_id) {
      let custQuery = supabase
        .from('customers')
        .select('name');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customer } = await custQuery
        .eq('id', mention.customer_id)
        .single();
      customerName = customer?.name;
    }

    // Generate response options
    const draft = await socialSentimentAnalyzer.generateResponseOptions(mention, customerName);

    res.json({
      mention_id: id,
      mention_content: mention.content,
      draft,
    });
  } catch (error) {
    console.error('[Social] Draft response error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// POST /api/social/mentions/:id/respond
// Track response to a mention
// ============================================================================
router.post('/mentions/:id/respond', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { response_sent, response_text } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const responseStatus = response_sent ? 'responded' : 'ignored';

    const { error } = await supabase
      .from('social_mentions')
      .update({
        response_status: responseStatus,
        response_text: response_text || null,
        responded_at: response_sent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update response status' });
    }

    res.json({
      success: true,
      mention_id: id,
      response_status: responseStatus,
    });
  } catch (error) {
    console.error('[Social] Respond error:', error);
    res.status(500).json({
      error: 'Failed to track response',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// GET /api/social/advocates
// Get advocate opportunities
// ============================================================================
router.get('/advocates', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!supabase) {
      return res.json({ advocates: [] });
    }

    // Get positive mentions with customers
    const { data: mentions } = await supabase
      .from('social_mentions')
      .select('*')
      .eq('sentiment', 'positive')
      .not('customer_id', 'is', null)
      .gte('sentiment_score', 50)
      .order('author_followers', { ascending: false })
      .limit(50);

    if (!mentions || mentions.length === 0) {
      return res.json({ advocates: [] });
    }

    const advocates = await customerMatcher.identifyAdvocates(mentions);

    res.json({ advocates });
  } catch (error) {
    console.error('[Social] Get advocates error:', error);
    res.status(500).json({
      error: 'Failed to get advocates',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// GET /api/social/high-risk
// Get high-risk mentions requiring attention
// ============================================================================
router.get('/high-risk', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!supabase) {
      return res.json({ high_risk_mentions: [] });
    }

    // Get recent negative mentions
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: mentions } = await supabase
      .from('social_mentions')
      .select('*')
      .eq('sentiment', 'negative')
      .eq('response_status', 'pending')
      .gte('posted_at', sevenDaysAgo)
      .order('sentiment_score', { ascending: true })
      .limit(50);

    if (!mentions || mentions.length === 0) {
      return res.json({ high_risk_mentions: [] });
    }

    // Identify high-risk mentions
    const highRisk = socialSentimentAnalyzer.identifyHighRiskMentions(mentions);

    res.json({
      high_risk_mentions: highRisk,
      total_pending_negative: mentions.length,
    });
  } catch (error) {
    console.error('[Social] Get high-risk error:', error);
    res.status(500).json({
      error: 'Failed to get high-risk mentions',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// GET /api/social/themes
// Get aggregated themes
// ============================================================================
router.get('/themes', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string) || 30;
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();

    if (!supabase) {
      return res.json({ themes: [] });
    }

    const { data: mentions } = await supabase
      .from('social_mentions')
      .select('themes, sentiment, sentiment_score')
      .gte('posted_at', startDate);

    if (!mentions || mentions.length === 0) {
      return res.json({ themes: [] });
    }

    const themes = socialSentimentAnalyzer.aggregateThemes(
      mentions.map(m => ({
        themes: m.themes || [],
        sentiment: m.sentiment as MentionSentiment,
        score: m.sentiment_score || 0,
      }))
    );

    res.json({ themes });
  } catch (error) {
    console.error('[Social] Get themes error:', error);
    res.status(500).json({
      error: 'Failed to get themes',
      message: (error as Error).message,
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateSummary(uploadId: string, mentions: SocialMention[]): SocialSentimentSummary {
  const dates = mentions.map(m => new Date(m.posted_at).getTime());

  // Platform breakdown
  const platformStats = new Map<SocialPlatform, PlatformBreakdown>();
  for (const mention of mentions) {
    if (!platformStats.has(mention.platform)) {
      platformStats.set(mention.platform, {
        platform: mention.platform,
        total: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        avg_engagement: 0,
      });
    }
    const stats = platformStats.get(mention.platform)!;
    stats.total++;
    if (mention.sentiment === 'positive') stats.positive++;
    else if (mention.sentiment === 'neutral') stats.neutral++;
    else stats.negative++;
  }

  // Sentiment breakdown
  const sentimentBreakdown = {
    positive: mentions.filter(m => m.sentiment === 'positive').length,
    neutral: mentions.filter(m => m.sentiment === 'neutral').length,
    negative: mentions.filter(m => m.sentiment === 'negative').length,
    positive_pct: 0,
    neutral_pct: 0,
    negative_pct: 0,
  };
  sentimentBreakdown.positive_pct = Math.round((sentimentBreakdown.positive / mentions.length) * 100);
  sentimentBreakdown.neutral_pct = Math.round((sentimentBreakdown.neutral / mentions.length) * 100);
  sentimentBreakdown.negative_pct = Math.round((sentimentBreakdown.negative / mentions.length) * 100);

  // Calculate sentiment score
  const sentimentScore = Math.round(
    mentions.reduce((sum, m) => sum + m.sentiment_score, 0) / mentions.length
  );

  // Aggregate themes
  const themes = socialSentimentAnalyzer.aggregateThemes(mentions);

  // Top positive mentions
  const topPositive = mentions
    .filter(m => m.sentiment === 'positive')
    .sort((a, b) => b.sentiment_score - a.sentiment_score)
    .slice(0, 3);

  // Negative mentions requiring attention
  const negativeMentions = mentions
    .filter(m => m.sentiment === 'negative')
    .sort((a, b) => a.sentiment_score - b.sentiment_score);

  // Advocate opportunities
  const advocateOpportunities: AdvocateOpportunity[] = topPositive
    .filter(m => m.customer_id)
    .map(m => ({
      customer_id: m.customer_id!,
      customer_name: m.customer_name || 'Unknown',
      advocate_name: m.author,
      advocate_handle: m.author_handle,
      platform: m.platform,
      followers: m.author_followers || 0,
      mention_id: m.id,
      content_preview: m.content.slice(0, 100),
      opportunity_type: 'amplify' as const,
    }));

  // Unmatched high-impact mentions
  const unmatchedHighImpact = mentions
    .filter(m => !m.customer_id && (m.author_followers || 0) > 1000)
    .slice(0, 5);

  return {
    upload_id: uploadId,
    total_mentions: mentions.length,
    date_range: {
      start: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : new Date().toISOString(),
      end: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : new Date().toISOString(),
    },
    platform_breakdown: Array.from(platformStats.values()),
    sentiment_breakdown: sentimentBreakdown,
    sentiment_score: sentimentScore,
    sentiment_trend: 'stable',
    trend_change: 0,
    themes,
    top_positive: topPositive,
    negative_mentions: negativeMentions,
    advocate_opportunities: advocateOpportunities,
    unmatched_high_impact: unmatchedHighImpact,
  };
}

function getDefaultMetrics() {
  return {
    overall_sentiment_score: 0,
    total_mentions: 0,
    date_range: {
      start: new Date().toISOString(),
      end: new Date().toISOString(),
    },
    sentiment_breakdown: {
      positive: 0,
      neutral: 0,
      negative: 0,
      positive_pct: 0,
      neutral_pct: 0,
      negative_pct: 0,
    },
    platform_breakdown: [],
    response_rate: 100,
    requires_attention: 0,
  };
}

export default router;
