/**
 * Billing Routes
 * PRD-092: Invoice Overdue - Collections Alert
 *
 * API endpoints for billing data, overdue detection, and collections workflow
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  overdueDetector,
  invoiceOverdueSlackAlerts,
  CustomerBillingOverview,
  InvoiceOverdueAlert,
  CollectionsAction,
  OverdueCheckResult,
  getSeverityFromDays,
} from '../services/billing/index.js';
import { collectionsCoordinator } from '../services/billing/collections-coordinator.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Customer Billing Endpoints (FR-1.1 - FR-1.5)
// ============================================

/**
 * GET /api/customers/:customerId/billing/overdue
 * Get overdue invoices and billing overview for a customer
 */
router.get('/customers/:customerId/billing/overdue', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const overview = await overdueDetector.getCustomerBillingOverview(customerId);

    res.json({
      totalOutstanding: overview.total_outstanding,
      invoices: overview.overdue_invoices,
      paymentHistory: overview.payment_history,
      isFirstTimeOverdue: overview.is_first_time_overdue,
      oldestOverdueDays: overview.oldest_overdue_days,
      overdueInvoiceCount: overview.overdue_invoice_count,
      healthScore: overview.health_score,
      openSupportTickets: overview.open_support_tickets,
    });
  } catch (error) {
    console.error('Error fetching customer billing overview:', error);
    res.status(500).json({
      error: {
        code: 'BILLING_ERROR',
        message: 'Failed to fetch customer billing overview',
      },
    });
  }
});

/**
 * GET /api/customers/:customerId/billing/invoices
 * Get all invoices for a customer
 */
router.get('/customers/:customerId/billing/invoices', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { status, limit = '50' } = req.query;

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' },
      });
    }

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('due_date', { ascending: false })
      .limit(parseInt(limit as string));

    if (status) {
      query = query.eq('status', status);
    }

    const { data: invoices, error } = await query;

    if (error) throw error;

    res.json({ invoices: invoices || [] });
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({
      error: {
        code: 'BILLING_ERROR',
        message: 'Failed to fetch customer invoices',
      },
    });
  }
});

// ============================================
// Overdue Check Endpoints (FR-2.1 - FR-2.4)
// ============================================

/**
 * POST /api/billing/check-overdue
 * Manual trigger to check overdue invoices
 * Can be scoped to a specific customer or run for all customers
 */
router.post('/check-overdue', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;
    const userId = (req as any).userId || 'system';

    let results: OverdueCheckResult[];

    if (customerId) {
      // Check specific customer
      results = await overdueDetector.checkCustomerOverdue(customerId);
    } else {
      // Check all customers
      results = await overdueDetector.checkAllOverdue();
    }

    // Process new alerts - send notifications
    const newAlerts = results.filter((r) => r.is_new_alert && r.alert);
    for (const result of newAlerts) {
      if (result.alert) {
        await collectionsCoordinator.processNewAlert(userId, result.alert);
      }
    }

    res.json({
      success: true,
      checked: results.length,
      newAlerts: newAlerts.length,
      results: results.map((r) => ({
        customerId: r.customer_id,
        customerName: r.customer_name,
        invoiceNumber: r.invoice_number,
        amount: r.amount,
        daysOverdue: r.days_overdue,
        severity: r.severity,
        isNewAlert: r.is_new_alert,
        alertId: r.alert?.id,
      })),
    });
  } catch (error) {
    console.error('Error checking overdue invoices:', error);
    res.status(500).json({
      error: {
        code: 'CHECK_OVERDUE_ERROR',
        message: 'Failed to check overdue invoices',
      },
    });
  }
});

// ============================================
// Alert Management Endpoints (FR-3.1 - FR-3.4)
// ============================================

/**
 * GET /api/billing/alerts
 * Get pending overdue alerts for the current CSM
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { status, severity, customerId } = req.query;

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' },
      });
    }

    let query = supabase
      .from('invoice_overdue_alerts')
      .select(`
        *,
        invoices (invoice_number, amount, due_date, status),
        customers (id, name, arr, health_score)
      `)
      .order('days_overdue', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['pending', 'acknowledged', 'in_progress']);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    res.json({ alerts: alerts || [] });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: {
        code: 'ALERT_ERROR',
        message: 'Failed to fetch overdue alerts',
      },
    });
  }
});

/**
 * GET /api/billing/alerts/:alertId
 * Get details for a specific alert
 */
router.get('/alerts/:alertId', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' },
      });
    }

    const { data: alert, error } = await supabase
      .from('invoice_overdue_alerts')
      .select(`
        *,
        invoices (
          id,
          invoice_number,
          amount,
          due_date,
          status,
          description,
          line_items
        ),
        customers (
          id,
          name,
          arr,
          health_score,
          stage
        )
      `)
      .eq('id', alertId)
      .single();

    if (error || !alert) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      });
    }

    // Get collections actions for this alert
    const { data: actions } = await supabase
      .from('collections_actions')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false });

    res.json({
      alert,
      actions: actions || [],
    });
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({
      error: {
        code: 'ALERT_ERROR',
        message: 'Failed to fetch alert details',
      },
    });
  }
});

/**
 * POST /api/billing/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const userId = (req as any).userId || 'unknown';

    await overdueDetector.acknowledgeAlert(alertId, userId);

    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      error: {
        code: 'ALERT_ERROR',
        message: 'Failed to acknowledge alert',
      },
    });
  }
});

/**
 * POST /api/billing/alerts/:alertId/resolve
 * Resolve an alert with resolution type and notes
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolutionType, notes } = req.body;
    const userId = (req as any).userId || 'unknown';

    if (!resolutionType) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Resolution type is required',
        },
      });
    }

    await overdueDetector.resolveAlert(alertId, userId, resolutionType, notes);

    res.json({ success: true, message: 'Alert resolved' });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      error: {
        code: 'ALERT_ERROR',
        message: 'Failed to resolve alert',
      },
    });
  }
});

/**
 * POST /api/billing/alerts/:alertId/escalate
 * Escalate an alert to finance team
 */
router.post('/alerts/:alertId/escalate', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;
    const userId = (req as any).userId || 'system';

    await collectionsCoordinator.escalateToFinance(userId, alertId, notes);

    res.json({ success: true, message: 'Alert escalated to finance' });
  } catch (error) {
    console.error('Error escalating alert:', error);
    res.status(500).json({
      error: {
        code: 'ESCALATION_ERROR',
        message: 'Failed to escalate alert',
      },
    });
  }
});

// ============================================
// Collections Actions Endpoints
// ============================================

/**
 * POST /api/billing/alerts/:alertId/actions
 * Log a collections action
 */
router.post('/alerts/:alertId/actions', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { actionType, description, outcome, nextStep, nextActionDate } = req.body;
    const userId = (req as any).userId || 'unknown';

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' },
      });
    }

    // Get alert to extract invoice and customer IDs
    const { data: alert, error: alertError } = await supabase
      .from('invoice_overdue_alerts')
      .select('customer_id, invoice_id')
      .eq('id', alertId)
      .single();

    if (alertError || !alert) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      });
    }

    // Create action record
    const { data: action, error } = await supabase
      .from('collections_actions')
      .insert({
        alert_id: alertId,
        customer_id: alert.customer_id,
        invoice_id: alert.invoice_id,
        action_type: actionType,
        action_by: 'csm',
        performed_by: userId,
        description,
        outcome,
        next_step: nextStep,
        next_action_date: nextActionDate,
      })
      .select()
      .single();

    if (error) throw error;

    // Update alert status to in_progress if it was pending
    await supabase
      .from('invoice_overdue_alerts')
      .update({ status: 'in_progress' })
      .eq('id', alertId)
      .eq('status', 'pending');

    res.status(201).json({ action });
  } catch (error) {
    console.error('Error logging action:', error);
    res.status(500).json({
      error: {
        code: 'ACTION_ERROR',
        message: 'Failed to log collections action',
      },
    });
  }
});

/**
 * GET /api/billing/alerts/:alertId/actions
 * Get actions for an alert
 */
router.get('/alerts/:alertId/actions', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' },
      });
    }

    const { data: actions, error } = await supabase
      .from('collections_actions')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ actions: actions || [] });
  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({
      error: {
        code: 'ACTION_ERROR',
        message: 'Failed to fetch collections actions',
      },
    });
  }
});

// ============================================
// Slack Integration Endpoints
// ============================================

/**
 * POST /api/billing/alerts/:alertId/send-slack
 * Send or resend Slack notification for an alert
 */
router.post('/alerts/:alertId/send-slack', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { channel } = req.body;
    const userId = (req as any).userId || 'system';

    await collectionsCoordinator.sendSlackAlert(userId, alertId, channel);

    res.json({ success: true, message: 'Slack notification sent' });
  } catch (error) {
    console.error('Error sending Slack alert:', error);
    res.status(500).json({
      error: {
        code: 'SLACK_ERROR',
        message: 'Failed to send Slack notification',
      },
    });
  }
});

// ============================================
// Summary & Dashboard Endpoints
// ============================================

/**
 * GET /api/billing/summary
 * Get billing summary for dashboard
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' },
      });
    }

    // Get alert counts by severity
    const { data: alertCounts } = await supabase
      .from('invoice_overdue_alerts')
      .select('severity')
      .in('status', ['pending', 'acknowledged', 'in_progress']);

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    (alertCounts || []).forEach((a: { severity: string }) => {
      if (a.severity in severityCounts) {
        severityCounts[a.severity as keyof typeof severityCounts]++;
      }
    });

    // Get total outstanding
    const { data: outstandingData } = await supabase
      .from('invoices')
      .select('amount, amount_paid')
      .eq('status', 'overdue');

    const totalOverdue = (outstandingData || []).reduce(
      (sum: number, i: { amount: number; amount_paid: number }) => sum + (i.amount - i.amount_paid),
      0
    );

    // Get customers with overdue invoices
    const { count: customersWithOverdue } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .gt('overdue_invoice_count', 0);

    res.json({
      totalOverdue,
      alertCounts: {
        total:
          severityCounts.critical +
          severityCounts.high +
          severityCounts.medium +
          severityCounts.low,
        ...severityCounts,
      },
      customersWithOverdue: customersWithOverdue || 0,
    });
  } catch (error) {
    console.error('Error fetching billing summary:', error);
    res.status(500).json({
      error: {
        code: 'SUMMARY_ERROR',
        message: 'Failed to fetch billing summary',
      },
    });
  }
});

export { router as billingRoutes };
