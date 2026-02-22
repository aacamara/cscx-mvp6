/**
 * Meeting Intelligence Routes
 * API endpoints for meeting analysis and insights
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { meetingIntelligenceService } from '../services/meeting-intelligence/index.js';
import { parseTranscript } from '../services/meeting-intelligence/processors.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Analysis Routes
// ============================================

/**
 * POST /api/meeting-intelligence/analyze
 * Analyze a meeting transcript
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const {
      transcript,
      title,
      format,
      customerId,
      customerName,
      startTime,
      participants,
    } = req.body;

    if (!transcript || !title) {
      return res.status(400).json({ error: 'transcript and title are required' });
    }

    const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Parse transcript
    const parsedTranscript = parseTranscript(transcript, meetingId, title, format);

    // Add additional metadata
    if (startTime) {
      parsedTranscript.startTime = new Date(startTime);
    }
    if (participants) {
      parsedTranscript.participants = participants;
    }

    // Analyze
    const analysis = await meetingIntelligenceService.analyzeMeeting(
      parsedTranscript,
      { customerId, customerName }
    );

    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing meeting:', error);
    res.status(500).json({ error: 'Failed to analyze meeting' });
  }
});

/**
 * GET /api/meeting-intelligence/analyses
 * List meeting analyses
 */
router.get('/analyses', async (req: Request, res: Response) => {
  try {
    const { customerId, limit = '20', offset = '0' } = req.query;

    let query = supabase
      .from('meeting_analyses')
      .select(`
        *,
        customers (id, name)
      `)
      .order('analyzed_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ analyses: data });
  } catch (error) {
    console.error('Error listing analyses:', error);
    res.status(500).json({ error: 'Failed to list analyses' });
  }
});

/**
 * GET /api/meeting-intelligence/analyses/:analysisId
 * Get analysis details
 */
router.get('/analyses/:analysisId', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;

    const { data, error } = await supabase
      .from('meeting_analyses')
      .select(`
        *,
        customers (id, name)
      `)
      .eq('id', analysisId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Parse JSON fields
    const analysis = {
      ...data,
      actionItems: typeof data.action_items === 'string' ? JSON.parse(data.action_items) : data.action_items,
      commitments: typeof data.commitments === 'string' ? JSON.parse(data.commitments) : data.commitments,
      followUps: typeof data.follow_ups === 'string' ? JSON.parse(data.follow_ups) : data.follow_ups,
      riskSignals: typeof data.risk_signals === 'string' ? JSON.parse(data.risk_signals) : data.risk_signals,
      expansionSignals: typeof data.expansion_signals === 'string' ? JSON.parse(data.expansion_signals) : data.expansion_signals,
      stakeholderInsights: typeof data.stakeholder_insights === 'string' ? JSON.parse(data.stakeholder_insights) : data.stakeholder_insights,
      competitorMentions: typeof data.competitor_mentions === 'string' ? JSON.parse(data.competitor_mentions) : data.competitor_mentions,
    };

    res.json({ analysis });
  } catch (error) {
    console.error('Error getting analysis:', error);
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

/**
 * DELETE /api/meeting-intelligence/analyses/:analysisId
 * Delete an analysis
 */
router.delete('/analyses/:analysisId', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;

    const { error } = await supabase
      .from('meeting_analyses')
      .delete()
      .eq('id', analysisId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

// ============================================
// Customer Insights Routes
// ============================================

/**
 * GET /api/meeting-intelligence/customers/:customerId/summary
 * Get meeting intelligence summary for a customer
 */
router.get('/customers/:customerId/summary', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { days = '90' } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));

    // Get all analyses for customer
    const { data: analyses, error } = await supabase
      .from('meeting_analyses')
      .select('*')
      .eq('customer_id', customerId)
      .gte('analyzed_at', cutoffDate.toISOString())
      .order('analyzed_at', { ascending: false });

    if (error) throw error;

    if (!analyses || analyses.length === 0) {
      return res.json({
        customerId,
        meetingCount: 0,
        summary: null,
      });
    }

    // Aggregate insights
    const allActionItems: any[] = [];
    const allRiskSignals: any[] = [];
    const allExpansionSignals: any[] = [];
    const allCompetitorMentions: any[] = [];
    let totalSentimentScore = 0;

    for (const analysis of analyses) {
      const actionItems = typeof analysis.action_items === 'string'
        ? JSON.parse(analysis.action_items) : analysis.action_items || [];
      const riskSignals = typeof analysis.risk_signals === 'string'
        ? JSON.parse(analysis.risk_signals) : analysis.risk_signals || [];
      const expansionSignals = typeof analysis.expansion_signals === 'string'
        ? JSON.parse(analysis.expansion_signals) : analysis.expansion_signals || [];
      const competitorMentions = typeof analysis.competitor_mentions === 'string'
        ? JSON.parse(analysis.competitor_mentions) : analysis.competitor_mentions || [];

      allActionItems.push(...actionItems);
      allRiskSignals.push(...riskSignals);
      allExpansionSignals.push(...expansionSignals);
      allCompetitorMentions.push(...competitorMentions);
      totalSentimentScore += analysis.sentiment_score || 0;
    }

    // Calculate highest risk level
    const riskLevelOrder = ['low', 'medium', 'high', 'critical'];
    const highestRiskLevel = analyses.reduce(
      (highest, a) =>
        riskLevelOrder.indexOf(a.risk_level) > riskLevelOrder.indexOf(highest)
          ? a.risk_level
          : highest,
      'low'
    );

    // Calculate expansion potential
    const expansionLevelOrder = ['none', 'low', 'medium', 'high'];
    const highestExpansion = analyses.reduce(
      (highest, a) =>
        expansionLevelOrder.indexOf(a.expansion_potential) > expansionLevelOrder.indexOf(highest)
          ? a.expansion_potential
          : highest,
      'none'
    );

    res.json({
      customerId,
      meetingCount: analyses.length,
      periodDays: parseInt(days as string),
      summary: {
        averageSentiment: totalSentimentScore / analyses.length,
        overallRiskLevel: highestRiskLevel,
        riskMeetingCount: analyses.filter(a => a.risk_level !== 'low').length,
        expansionPotential: highestExpansion,
        expansionMeetingCount: analyses.filter(a => a.expansion_potential !== 'none').length,
        openActionItems: allActionItems.filter(a => a.status !== 'completed').length,
        totalActionItems: allActionItems.length,
        competitorMentionCount: allCompetitorMentions.length,
        uniqueCompetitors: [...new Set(allCompetitorMentions.map(c => c.competitor))],
      },
      recentRisks: allRiskSignals.slice(0, 5),
      recentExpansionSignals: allExpansionSignals.slice(0, 5),
      recentMeetings: analyses.slice(0, 5).map(a => ({
        id: a.id,
        meetingId: a.meeting_id,
        summary: a.summary,
        sentiment: a.overall_sentiment,
        riskLevel: a.risk_level,
        analyzedAt: a.analyzed_at,
      })),
    });
  } catch (error) {
    console.error('Error getting customer summary:', error);
    res.status(500).json({ error: 'Failed to get customer summary' });
  }
});

/**
 * GET /api/meeting-intelligence/customers/:customerId/risks
 * Get risk analysis for a customer
 */
router.get('/customers/:customerId/risks', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const summary = await meetingIntelligenceService.getRiskSummary(customerId);
    res.json(summary);
  } catch (error) {
    console.error('Error getting risk summary:', error);
    res.status(500).json({ error: 'Failed to get risk summary' });
  }
});

/**
 * GET /api/meeting-intelligence/customers/:customerId/action-items
 * Get action items from customer meetings
 */
router.get('/customers/:customerId/action-items', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { status, owner, limit = '50' } = req.query;

    const { data: analyses, error } = await supabase
      .from('meeting_analyses')
      .select('id, meeting_id, summary, action_items, analyzed_at')
      .eq('customer_id', customerId)
      .order('analyzed_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    // Extract and flatten action items
    let allActionItems: any[] = [];

    for (const analysis of analyses || []) {
      const items = typeof analysis.action_items === 'string'
        ? JSON.parse(analysis.action_items) : analysis.action_items || [];

      allActionItems.push(...items.map((item: any) => ({
        ...item,
        meetingId: analysis.meeting_id,
        meetingSummary: analysis.summary,
        meetingDate: analysis.analyzed_at,
      })));
    }

    // Filter by status if specified
    if (status) {
      allActionItems = allActionItems.filter(item => item.status === status);
    }

    // Filter by owner if specified
    if (owner) {
      allActionItems = allActionItems.filter(item => item.owner === owner);
    }

    res.json({
      customerId,
      actionItems: allActionItems,
      total: allActionItems.length,
    });
  } catch (error) {
    console.error('Error getting action items:', error);
    res.status(500).json({ error: 'Failed to get action items' });
  }
});

// ============================================
// Aggregate Analytics
// ============================================

/**
 * GET /api/meeting-intelligence/stats
 * Get overall meeting intelligence statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));

    const { data: analyses, error } = await supabase
      .from('meeting_analyses')
      .select('overall_sentiment, risk_level, expansion_potential, confidence')
      .gte('analyzed_at', cutoffDate.toISOString());

    if (error) throw error;

    if (!analyses || analyses.length === 0) {
      return res.json({
        totalMeetings: 0,
        period: { days: parseInt(days as string) },
      });
    }

    // Aggregate stats
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const expansionCounts = { none: 0, low: 0, medium: 0, high: 0 };
    let totalConfidence = 0;

    for (const analysis of analyses) {
      if (analysis.overall_sentiment) {
        sentimentCounts[analysis.overall_sentiment as keyof typeof sentimentCounts]++;
      }
      if (analysis.risk_level) {
        riskCounts[analysis.risk_level as keyof typeof riskCounts]++;
      }
      if (analysis.expansion_potential) {
        expansionCounts[analysis.expansion_potential as keyof typeof expansionCounts]++;
      }
      totalConfidence += analysis.confidence || 0;
    }

    res.json({
      totalMeetings: analyses.length,
      period: { days: parseInt(days as string), from: cutoffDate.toISOString() },
      sentimentDistribution: sentimentCounts,
      riskDistribution: riskCounts,
      expansionDistribution: expansionCounts,
      averageConfidence: totalConfidence / analyses.length,
      atRiskMeetings: riskCounts.high + riskCounts.critical,
      expansionOpportunities: expansionCounts.medium + expansionCounts.high,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/meeting-intelligence/trending-risks
 * Get trending risk signals across all customers
 */
router.get('/trending-risks', async (req: Request, res: Response) => {
  try {
    const { days = '14', limit = '10' } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));

    const { data: analyses, error } = await supabase
      .from('meeting_analyses')
      .select('customer_id, risk_signals, risk_level, analyzed_at')
      .gte('analyzed_at', cutoffDate.toISOString())
      .neq('risk_level', 'low')
      .order('analyzed_at', { ascending: false });

    if (error) throw error;

    // Aggregate risk types
    const riskTypeCounts: Record<string, number> = {};
    const risksWithContext: any[] = [];

    for (const analysis of analyses || []) {
      const signals = typeof analysis.risk_signals === 'string'
        ? JSON.parse(analysis.risk_signals) : analysis.risk_signals || [];

      for (const signal of signals) {
        riskTypeCounts[signal.type] = (riskTypeCounts[signal.type] || 0) + 1;
        risksWithContext.push({
          ...signal,
          customerId: analysis.customer_id,
          meetingDate: analysis.analyzed_at,
        });
      }
    }

    // Sort by frequency
    const trendingTypes = Object.entries(riskTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit as string))
      .map(([type, count]) => ({ type, count }));

    res.json({
      period: { days: parseInt(days as string) },
      trendingRiskTypes: trendingTypes,
      recentRisks: risksWithContext.slice(0, 20),
      totalAtRiskMeetings: analyses?.length || 0,
    });
  } catch (error) {
    console.error('Error getting trending risks:', error);
    res.status(500).json({ error: 'Failed to get trending risks' });
  }
});

export default router;
