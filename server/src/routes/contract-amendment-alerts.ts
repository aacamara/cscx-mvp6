/**
 * Contract Amendment Alert API Routes
 * PRD-108: Contract Amendment Needed
 *
 * API endpoints for contract amendment alert detection, listing, and management.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  contractAmendmentAlertDetector,
  contractAmendmentSlackAlerts,
  type DetectedAmendmentNeed,
} from '../services/contractAmendmentAlert/index.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

// Initialize Supabase
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

interface AlertRecord {
  id: string;
  customer_id: string;
  trigger_type: string;
  priority: string;
  status: string;
  situation: Record<string, any>;
  contract: Record<string, any>;
  customer_context: Record<string, any>;
  impact: Record<string, any>;
  options: any[];
  detected_at: string;
  notified_at?: string;
  resolved_at?: string;
  dismissed_at?: string;
  dismissed_by?: string;
  dismiss_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// GET /api/contract-amendment-alerts - List alerts
// ============================================

router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      status = 'all',
      priority = 'all',
      triggerType = 'all',
      csmId,
      dateFrom,
      dateTo,
      limit = '20',
      offset = '0',
      sortBy = 'detected_at',
      sortOrder = 'desc',
    } = req.query;

    // If no database, return detected alerts from detector
    if (!supabase) {
      const detectedAlerts = customerId
        ? await contractAmendmentAlertDetector.detectForCustomer(customerId as string)
        : await contractAmendmentAlertDetector.detectAll();

      const transformed = detectedAlerts.map(transformDetectedToAlert);

      return res.json({
        success: true,
        data: {
          alerts: transformed.slice(Number(offset), Number(offset) + Number(limit)),
          summary: calculateSummary(transformed),
          pagination: {
            total: transformed.length,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: transformed.length > Number(offset) + Number(limit),
          },
        },
        meta: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 0,
        },
      });
    }

    // Build query
    let query = supabase
      .from('contract_amendment_alerts')
      .select(`
        *,
        customers (
          id,
          name,
          arr,
          health_score,
          csm_id
        )
      `);

    // Apply filters
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (triggerType !== 'all') {
      query = query.eq('trigger_type', triggerType);
    }
    if (csmId) {
      query = query.eq('customers.csm_id', csmId);
    }
    if (dateFrom) {
      query = query.gte('detected_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('detected_at', dateTo);
    }

    // Apply sorting
    const order = sortOrder === 'asc' ? { ascending: true } : { ascending: false };
    query = query.order(sortBy as string, order);

    // Apply pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: alerts, error, count } = await query;

    if (error) {
      throw error;
    }

    const transformed = (alerts || []).map(transformDbToAlert);

    res.json({
      success: true,
      data: {
        alerts: transformed,
        summary: calculateSummary(transformed),
        pagination: {
          total: count || transformed.length,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: (count || 0) > Number(offset) + Number(limit),
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 0,
      },
    });
  } catch (error) {
    console.error('Error listing contract amendment alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list alerts',
      },
    });
  }
});

// ============================================
// GET /api/contract-amendment-alerts/detect - Run detection
// ============================================

router.get('/detect', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.query;

    const detectedAlerts = customerId
      ? await contractAmendmentAlertDetector.detectForCustomer(customerId as string)
      : await contractAmendmentAlertDetector.detectAll();

    const transformed = detectedAlerts.map(transformDetectedToAlert);

    res.json({
      success: true,
      data: {
        alerts: transformed,
        count: transformed.length,
        totalEstimatedMonthlyValue: transformed.reduce(
          (sum, a) => sum + a.impact.estimatedMonthlyValue,
          0
        ),
        totalEstimatedAnnualValue: transformed.reduce(
          (sum, a) => sum + a.impact.estimatedAnnualValue,
          0
        ),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 0,
      },
    });
  } catch (error) {
    console.error('Error detecting contract amendment needs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to detect amendments',
      },
    });
  }
});

// ============================================
// GET /api/contract-amendment-alerts/:id - Get alert details
// ============================================

router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      // Return mock data for development
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found (no database connection)',
        },
      });
    }

    const { data: alert, error } = await supabase
      .from('contract_amendment_alerts')
      .select(`
        *,
        customers (
          id,
          name,
          arr,
          health_score,
          csm_id
        )
      `)
      .eq('id', id)
      .single();

    if (error || !alert) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Alert not found',
        },
      });
    }

    res.json({
      success: true,
      data: transformDbToAlert(alert),
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 0,
      },
    });
  } catch (error) {
    console.error('Error getting contract amendment alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get alert',
      },
    });
  }
});

// ============================================
// POST /api/contract-amendment-alerts/:id/notify - Send notification
// ============================================

router.post('/:id/notify', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { channel = 'slack', channelId, userId } = req.body;

    // Get the alert data
    let alertData: any;

    if (supabase) {
      const { data: alert, error } = await supabase
        .from('contract_amendment_alerts')
        .select(`
          *,
          customers (
            id,
            name,
            arr,
            health_score,
            csm_id
          )
        `)
        .eq('id', id)
        .single();

      if (error || !alert) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
        });
      }

      alertData = transformDbToAlert(alert);
    } else {
      // Use mock data
      const detected = await contractAmendmentAlertDetector.detectAll();
      alertData = transformDetectedToAlert(detected[0]);
    }

    // Send Slack notification
    if (channel === 'slack' && userId && channelId) {
      await contractAmendmentSlackAlerts.sendCsmAlert(
        userId,
        channelId,
        alertData as DetectedAmendmentNeed
      );
    }

    // Update alert status
    if (supabase) {
      await supabase
        .from('contract_amendment_alerts')
        .update({
          status: 'notified',
          notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    res.json({
      success: true,
      data: {
        alertId: id,
        channel,
        notifiedAt: new Date().toISOString(),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 0,
      },
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to send notification',
      },
    });
  }
});

// ============================================
// PATCH /api/contract-amendment-alerts/:id - Update alert
// ============================================

router.patch('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, dismissReason } = req.body;

    if (!supabase) {
      return res.json({
        success: true,
        data: { id, status, notes },
        meta: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 0,
        },
      });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
      if (status === 'dismissed') {
        updateData.dismissed_at = new Date().toISOString();
        updateData.dismissed_by = req.userId;
        if (dismissReason) {
          updateData.dismiss_reason = dismissReason;
        }
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data: updated, error } = await supabase
      .from('contract_amendment_alerts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: transformDbToAlert(updated),
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 0,
      },
    });
  } catch (error) {
    console.error('Error updating contract amendment alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update alert',
      },
    });
  }
});

// ============================================
// GET /api/contract-amendment-alerts/customer/:customerId - Get alerts for customer
// ============================================

router.get('/customer/:customerId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Detect current amendment needs
    const detectedAlerts = await contractAmendmentAlertDetector.detectForCustomer(customerId);
    const transformed = detectedAlerts.map(transformDetectedToAlert);

    res.json({
      success: true,
      data: {
        alerts: transformed,
        count: transformed.length,
        hasAmendmentNeeds: transformed.length > 0,
        highestPriority: transformed[0]?.priority || null,
        totalEstimatedMonthlyValue: transformed.reduce(
          (sum, a) => sum + a.impact.estimatedMonthlyValue,
          0
        ),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 0,
      },
    });
  } catch (error) {
    console.error('Error getting customer amendment alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get customer alerts',
      },
    });
  }
});

// ============================================
// Helpers
// ============================================

function transformDetectedToAlert(detected: DetectedAmendmentNeed): any {
  return {
    id: `detected-${detected.customerId}-${detected.triggerType}-${Date.now()}`,
    customerId: detected.customerId,
    customerName: detected.customerName,
    triggerType: detected.triggerType,
    priority: detected.priority,
    status: 'detected',
    situation: {
      description: detected.details.description,
      details: detected.details,
      firstDetectedAt: detected.detectedAt,
      persistedDays: 0,
    },
    contract: detected.contract,
    customerContext: detected.customerContext,
    impact: {
      estimatedMonthlyValue: detected.estimatedMonthlyValue,
      estimatedAnnualValue: detected.estimatedAnnualValue,
      urgencyScore: calculateUrgencyScore(detected),
    },
    options: detected.recommendedOptions.map(opt => ({
      id: opt.id,
      title: opt.title,
      description: opt.description,
      estimatedMonthlyValue: opt.estimatedValue / 12,
      estimatedAnnualValue: opt.estimatedValue,
      isRecommended: opt.isRecommended,
      pros: [],
      cons: [],
      nextSteps: [],
    })),
    recommendedOptionId: detected.recommendedOptions.find(o => o.isRecommended)?.id,
    actions: [],
    detectedAt: detected.detectedAt,
    createdBy: 'system',
  };
}

function transformDbToAlert(record: AlertRecord & { customers?: any }): any {
  return {
    id: record.id,
    customerId: record.customer_id,
    customerName: record.customers?.name || 'Unknown',
    triggerType: record.trigger_type,
    priority: record.priority,
    status: record.status,
    situation: record.situation,
    contract: record.contract,
    customerContext: record.customer_context,
    impact: record.impact,
    options: record.options,
    detectedAt: record.detected_at,
    notifiedAt: record.notified_at,
    resolvedAt: record.resolved_at,
    dismissedAt: record.dismissed_at,
    dismissedBy: record.dismissed_by,
    dismissReason: record.dismiss_reason,
    notes: record.notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function calculateSummary(alerts: any[]): any {
  const summary = {
    total: alerts.length,
    byStatus: {
      detected: 0,
      notified: 0,
      in_progress: 0,
      resolved: 0,
      dismissed: 0,
    } as Record<string, number>,
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    } as Record<string, number>,
    byTriggerType: {} as Record<string, number>,
    totalEstimatedMonthlyValue: 0,
    totalEstimatedAnnualValue: 0,
    avgDaysOpen: 0,
    criticalCount: 0,
  };

  let totalDaysOpen = 0;
  let openCount = 0;

  for (const alert of alerts) {
    // By status
    if (summary.byStatus[alert.status] !== undefined) {
      summary.byStatus[alert.status]++;
    }

    // By priority
    if (summary.byPriority[alert.priority] !== undefined) {
      summary.byPriority[alert.priority]++;
    }

    // By trigger type
    summary.byTriggerType[alert.triggerType] = (summary.byTriggerType[alert.triggerType] || 0) + 1;

    // Totals
    summary.totalEstimatedMonthlyValue += alert.impact?.estimatedMonthlyValue || 0;
    summary.totalEstimatedAnnualValue += alert.impact?.estimatedAnnualValue || 0;

    // Critical count
    if (alert.priority === 'critical') {
      summary.criticalCount++;
    }

    // Days open
    if (!alert.resolvedAt && !alert.dismissedAt) {
      const detected = new Date(alert.detectedAt);
      const now = new Date();
      const daysOpen = Math.floor((now.getTime() - detected.getTime()) / (1000 * 60 * 60 * 24));
      totalDaysOpen += daysOpen;
      openCount++;
    }
  }

  summary.avgDaysOpen = openCount > 0 ? Math.round(totalDaysOpen / openCount) : 0;

  return summary;
}

function calculateUrgencyScore(detected: DetectedAmendmentNeed): number {
  let score = 50; // Base score

  // Priority weight
  switch (detected.priority) {
    case 'critical':
      score += 30;
      break;
    case 'high':
      score += 20;
      break;
    case 'medium':
      score += 10;
      break;
  }

  // Renewal proximity
  const daysToRenewal = detected.contract.daysUntilRenewal;
  if (daysToRenewal <= 30) {
    score += 20;
  } else if (daysToRenewal <= 60) {
    score += 10;
  } else if (daysToRenewal <= 90) {
    score += 5;
  }

  // Health score (lower health = higher urgency)
  if (detected.customerContext.healthScore < 50) {
    score -= 10; // Lower urgency for at-risk accounts (different approach needed)
  }

  return Math.min(100, Math.max(0, score));
}

export { router as contractAmendmentAlertRoutes };
