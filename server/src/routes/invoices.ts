/**
 * Invoice Notification Routes
 * PRD-125: Invoice Generated -> CSM Notification
 *
 * API endpoints for invoice webhook processing, notification management,
 * and CSM dashboard access.
 */

import { Router, Request, Response } from 'express';
import { invoiceService } from '../services/invoice.js';
import {
  StripeInvoiceWebhook,
  ChargebeeInvoiceWebhook,
  ManualInvoiceUpload,
  InvoiceNotificationFilters,
} from '../types/invoice.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Webhook Endpoints
// ============================================

/**
 * POST /api/webhooks/billing/invoice
 * Universal invoice webhook endpoint
 * Accepts webhooks from Stripe, Chargebee, or Salesforce
 */
router.post('/webhooks/billing/invoice', async (req: Request, res: Response) => {
  try {
    const source = req.headers['x-billing-source'] as string || req.body.source;

    if (!source) {
      return res.status(400).json({
        success: false,
        error: 'Missing billing source. Set x-billing-source header or source field.',
      });
    }

    let notification;

    switch (source.toLowerCase()) {
      case 'stripe':
        const stripeData = req.body as StripeInvoiceWebhook;
        if (!stripeData.id || !stripeData.customer) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Stripe webhook payload',
          });
        }
        notification = await invoiceService.processStripeWebhook(stripeData);
        break;

      case 'chargebee':
        const chargebeeData = req.body as ChargebeeInvoiceWebhook;
        if (!chargebeeData.id || !chargebeeData.customer_id) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Chargebee webhook payload',
          });
        }
        notification = await invoiceService.processChargebeeWebhook(chargebeeData);
        break;

      case 'salesforce':
        // Salesforce billing integration would map to a similar structure
        return res.status(501).json({
          success: false,
          error: 'Salesforce billing integration not yet implemented',
        });

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported billing source: ${source}`,
        });
    }

    res.status(201).json({
      success: true,
      notification,
      message: 'Invoice notification created and CSM notified',
    });
  } catch (error) {
    console.error('[Invoice Routes] Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process invoice webhook',
    });
  }
});

/**
 * POST /api/invoices/manual
 * Manual invoice upload endpoint
 */
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const data = req.body as ManualInvoiceUpload;

    // Validate required fields
    if (!data.customerId || !data.customerName || !data.amount || !data.currency || !data.dueDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerId, customerName, amount, currency, dueDate',
      });
    }

    // Validate amount
    if (typeof data.amount !== 'number' || data.amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number',
      });
    }

    // Validate date
    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid due date format',
      });
    }

    const notification = await invoiceService.processManualUpload(data);

    res.status(201).json({
      success: true,
      notification,
      message: 'Manual invoice notification created',
    });
  } catch (error) {
    console.error('[Invoice Routes] Manual upload error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process manual invoice upload',
    });
  }
});

// ============================================
// CSM Notification Endpoints
// ============================================

/**
 * GET /api/invoices/csm/:csmId/pending
 * Get pending invoices for a CSM
 */
router.get('/csm/:csmId/pending', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;

    const notifications = await invoiceService.getPendingForCSM(csmId);

    res.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('[Invoice Routes] Get pending error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending invoices',
    });
  }
});

/**
 * GET /api/invoices/csm/:csmId
 * Get all notifications for a CSM with filters and pagination
 */
router.get('/csm/:csmId', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;
    const {
      status,
      customerId,
      minAmount,
      maxAmount,
      hasRiskFlags,
      acknowledged,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query;

    const filters: InvoiceNotificationFilters = {};

    if (status) filters.status = status as any;
    if (customerId) filters.customerId = customerId as string;
    if (minAmount) filters.minAmount = parseFloat(minAmount as string);
    if (maxAmount) filters.maxAmount = parseFloat(maxAmount as string);
    if (hasRiskFlags !== undefined) filters.hasRiskFlags = hasRiskFlags === 'true';
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;

    const result = await invoiceService.getNotificationsForCSM(
      csmId,
      filters,
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Invoice Routes] Get CSM notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoice notifications',
    });
  }
});

/**
 * GET /api/invoices/csm/:csmId/dashboard
 * Get invoice dashboard for a CSM
 */
router.get('/csm/:csmId/dashboard', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;

    const dashboard = await invoiceService.getDashboard(csmId);

    res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error('[Invoice Routes] Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoice dashboard',
    });
  }
});

// ============================================
// Customer Invoice Endpoints
// ============================================

/**
 * GET /api/invoices/customer/:customerId
 * Get all invoices for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const notifications = await invoiceService.getNotificationsForCustomer(customerId);

    res.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('[Invoice Routes] Get customer invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer invoices',
    });
  }
});

// ============================================
// Individual Invoice Endpoints
// ============================================

/**
 * GET /api/invoices/:invoiceId
 * Get a specific invoice notification
 */
router.get('/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const notification = await invoiceService.getNotificationById(invoiceId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Invoice notification not found',
      });
    }

    // Get related invoices for context
    const relatedInvoices = await invoiceService.getNotificationsForCustomer(notification.customerId);

    res.json({
      success: true,
      notification,
      relatedInvoices: relatedInvoices.filter(n => n.id !== notification.id).slice(0, 5),
    });
  } catch (error) {
    console.error('[Invoice Routes] Get invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoice notification',
    });
  }
});

/**
 * PUT /api/invoices/:invoiceId/acknowledge
 * Acknowledge an invoice notification
 */
router.put('/:invoiceId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { actionTaken } = req.body;

    const notification = await invoiceService.acknowledgeNotification(invoiceId, actionTaken);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Invoice notification not found',
      });
    }

    res.json({
      success: true,
      notification,
      message: 'Notification acknowledged',
    });
  } catch (error) {
    console.error('[Invoice Routes] Acknowledge error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge notification',
    });
  }
});

/**
 * PUT /api/invoices/:invoiceId/status
 * Update invoice payment status
 */
router.put('/:invoiceId/status', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { status, paymentDate } = req.body;

    if (!status || !['pending', 'paid', 'overdue', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: pending, paid, overdue, failed',
      });
    }

    const notification = await invoiceService.updateInvoiceStatus(
      invoiceId,
      status,
      paymentDate ? new Date(paymentDate) : undefined
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Invoice notification not found',
      });
    }

    res.json({
      success: true,
      notification,
      message: `Invoice status updated to ${status}`,
    });
  } catch (error) {
    console.error('[Invoice Routes] Update status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update invoice status',
    });
  }
});

// ============================================
// Preferences Endpoints
// ============================================

/**
 * GET /api/invoices/preferences/:csmId
 * Get notification preferences for a CSM
 */
router.get('/preferences/:csmId', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;

    const preferences = await invoiceService.getPreferences(csmId);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('[Invoice Routes] Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification preferences',
    });
  }
});

/**
 * PUT /api/invoices/preferences/:csmId
 * Update notification preferences for a CSM
 */
router.put('/preferences/:csmId', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;
    const preferences = req.body;

    await invoiceService.updatePreferences({
      csmId,
      ...preferences,
    });

    res.json({
      success: true,
      message: 'Preferences updated',
    });
  } catch (error) {
    console.error('[Invoice Routes] Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences',
    });
  }
});

// ============================================
// Admin/System Endpoints
// ============================================

/**
 * POST /api/invoices/check-overdue
 * Check for and mark overdue invoices (called by scheduler)
 */
router.post('/check-overdue', async (req: Request, res: Response) => {
  try {
    const overdueCount = await invoiceService.checkOverdueInvoices();

    res.json({
      success: true,
      overdueCount,
      message: `Marked ${overdueCount} invoice(s) as overdue`,
    });
  } catch (error) {
    console.error('[Invoice Routes] Check overdue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check overdue invoices',
    });
  }
});

/**
 * POST /api/invoices/seed-demo
 * Seed demo data for testing
 */
router.post('/seed-demo', async (req: Request, res: Response) => {
  try {
    await invoiceService.seedDemoData();

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
    });
  } catch (error) {
    console.error('[Invoice Routes] Seed demo error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed demo data',
    });
  }
});

export default router;
