/**
 * Executive Change Routes
 * PRD-095: API endpoints for executive change detection and management
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import {
  executiveChangeService,
  ExecutiveChangeType,
  DetectionSource,
} from '../services/executiveChange.js';
import { triggerEngine } from '../triggers/engine.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Executive Change CRUD
// ============================================

/**
 * GET /api/executive-changes
 * List executive changes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      changeType,
      status,
      limit = '50',
      offset = '0',
    } = req.query;

    const result = await executiveChangeService.listExecutiveChanges({
      customerId: customerId as string,
      changeType: changeType as ExecutiveChangeType,
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing executive changes:', error);
    res.status(500).json({ error: 'Failed to list executive changes' });
  }
});

/**
 * GET /api/executive-changes/:changeId
 * Get executive change details
 */
router.get('/:changeId', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;

    const change = await executiveChangeService.getExecutiveChange(changeId);

    if (!change) {
      return res.status(404).json({ error: 'Executive change not found' });
    }

    // Get impact assessment
    const assessment = await executiveChangeService.assessImpact(change, change.customerId);

    res.json({
      change,
      assessment,
    });
  } catch (error) {
    console.error('Error getting executive change:', error);
    res.status(500).json({ error: 'Failed to get executive change' });
  }
});

/**
 * POST /api/executive-changes
 * Create a new executive change record
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      stakeholderId,
      changeType,
      executiveName,
      newTitle,
      previousTitle,
      previousCompany,
      linkedinUrl,
      background,
      source,
      metadata,
    } = req.body;

    if (!customerId || !changeType || !executiveName || !newTitle || !source) {
      return res.status(400).json({
        error: 'customerId, changeType, executiveName, newTitle, and source are required',
      });
    }

    // Validate change type
    const validChangeTypes: ExecutiveChangeType[] = ['new_hire', 'departure', 'promotion', 'title_change'];
    if (!validChangeTypes.includes(changeType)) {
      return res.status(400).json({
        error: `Invalid changeType. Must be one of: ${validChangeTypes.join(', ')}`,
      });
    }

    // Create executive change
    const change = await executiveChangeService.createExecutiveChange({
      customerId,
      stakeholderId,
      changeType,
      executiveName,
      newTitle,
      previousTitle,
      previousCompany,
      linkedinUrl,
      background,
      source,
      metadata,
    });

    // Create response tasks
    await executiveChangeService.createResponseTasks(change, customerId);

    // Process through trigger engine
    const triggerEvent = await triggerEngine.processEvent({
      id: uuidv4(),
      type: 'executive_change_detected',
      customerId,
      data: {
        changeId: change.id,
        changeType,
        executiveName,
        newTitle,
        previousTitle,
        previousCompany,
        source,
      },
      timestamp: new Date(),
    });

    // Get impact assessment
    const assessment = await executiveChangeService.assessImpact(change, customerId);

    res.status(201).json({
      change,
      assessment,
      triggersMatched: triggerEvent.length,
    });
  } catch (error) {
    console.error('Error creating executive change:', error);
    res.status(500).json({ error: 'Failed to create executive change' });
  }
});

/**
 * PATCH /api/executive-changes/:changeId
 * Update executive change status
 */
router.patch('/:changeId', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const { status, metadata } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['pending', 'acknowledged', 'outreach_sent', 'meeting_scheduled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const change = await executiveChangeService.updateStatus(changeId, status, metadata);

    res.json({ change });
  } catch (error) {
    console.error('Error updating executive change:', error);
    res.status(500).json({ error: 'Failed to update executive change' });
  }
});

// ============================================
// Executive Research Endpoints
// ============================================

/**
 * POST /api/executive-changes/:changeId/research
 * Research executive background
 */
router.post('/:changeId/research', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;

    const change = await executiveChangeService.getExecutiveChange(changeId);
    if (!change) {
      return res.status(404).json({ error: 'Executive change not found' });
    }

    // Get customer name for context
    let companyName = 'Unknown';
    if (supabase) {
      let researchCustQuery = supabase.from('customers').select('name');
      researchCustQuery = applyOrgFilter(researchCustQuery, req);
      const { data: customer } = await researchCustQuery
        .eq('id', change.customerId)
        .single();
      if (customer) companyName = customer.name;
    }

    // Research executive
    const background = await executiveChangeService.researchExecutive(
      change.executiveName,
      companyName,
      change.linkedinUrl
    );

    // Update change with background
    if (supabase) {
      await supabase
        .from('executive_changes')
        .update({
          background,
          updated_at: new Date().toISOString(),
        })
        .eq('id', changeId);
    }

    res.json({
      background,
      message: 'Executive research complete',
    });
  } catch (error) {
    console.error('Error researching executive:', error);
    res.status(500).json({ error: 'Failed to research executive' });
  }
});

/**
 * GET /api/executive-changes/:changeId/connections
 * Find shared connections
 */
router.get('/:changeId/connections', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const userId = (req as any).userId;

    const change = await executiveChangeService.getExecutiveChange(changeId);
    if (!change) {
      return res.status(404).json({ error: 'Executive change not found' });
    }

    const connections = await executiveChangeService.findSharedConnections(
      change.executiveName,
      change.linkedinUrl,
      userId
    );

    res.json({ connections });
  } catch (error) {
    console.error('Error finding connections:', error);
    res.status(500).json({ error: 'Failed to find connections' });
  }
});

// ============================================
// Outreach Endpoints
// ============================================

/**
 * POST /api/executive-changes/:changeId/draft-outreach
 * Generate introduction email draft
 */
router.post('/:changeId/draft-outreach', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const { csmName } = req.body;

    const change = await executiveChangeService.getExecutiveChange(changeId);
    if (!change) {
      return res.status(404).json({ error: 'Executive change not found' });
    }

    const draft = await executiveChangeService.generateOutreachDraft(
      change,
      change.customerId,
      csmName
    );

    res.json({ draft });
  } catch (error) {
    console.error('Error generating outreach draft:', error);
    res.status(500).json({ error: 'Failed to generate outreach draft' });
  }
});

/**
 * POST /api/executive-changes/:changeId/mark-outreach-sent
 * Mark outreach as sent
 */
router.post('/:changeId/mark-outreach-sent', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const { emailDetails } = req.body;

    const change = await executiveChangeService.markOutreachSent(changeId, emailDetails);

    res.json({ change });
  } catch (error) {
    console.error('Error marking outreach sent:', error);
    res.status(500).json({ error: 'Failed to mark outreach sent' });
  }
});

// ============================================
// Impact Assessment Endpoint
// ============================================

/**
 * GET /api/executive-changes/:changeId/impact
 * Get impact assessment for executive change
 */
router.get('/:changeId/impact', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;

    const change = await executiveChangeService.getExecutiveChange(changeId);
    if (!change) {
      return res.status(404).json({ error: 'Executive change not found' });
    }

    const assessment = await executiveChangeService.assessImpact(change, change.customerId);

    res.json({ assessment });
  } catch (error) {
    console.error('Error assessing impact:', error);
    res.status(500).json({ error: 'Failed to assess impact' });
  }
});

// ============================================
// Customer Executive Changes
// ============================================

/**
 * GET /api/customers/:customerId/executive-changes
 * Get executive changes for a customer
 */
router.get('/customers/:customerId/executive-changes', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const changes = await executiveChangeService.getRecentExecutiveChanges(customerId);

    res.json({ changes });
  } catch (error) {
    console.error('Error getting customer executive changes:', error);
    res.status(500).json({ error: 'Failed to get customer executive changes' });
  }
});

/**
 * POST /api/customers/:customerId/detect-executive-changes
 * Trigger executive change detection for a customer
 */
router.post('/customers/:customerId/detect-executive-changes', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { source = 'manual' } = req.body;

    // TODO: Integrate with LinkedIn Sales Navigator, data enrichment APIs
    // For now, return placeholder response

    res.json({
      message: 'Executive change detection initiated',
      customerId,
      source,
      status: 'processing',
    });
  } catch (error) {
    console.error('Error detecting executive changes:', error);
    res.status(500).json({ error: 'Failed to detect executive changes' });
  }
});

// ============================================
// Signal Recording
// ============================================

/**
 * POST /api/executive-changes/signals
 * Record an executive change signal
 */
router.post('/signals', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      stakeholderId,
      signalType,
      executiveName,
      newTitle,
      previousTitle,
      rawData,
      confidence,
    } = req.body;

    if (!customerId || !signalType || !executiveName || confidence === undefined) {
      return res.status(400).json({
        error: 'customerId, signalType, executiveName, and confidence are required',
      });
    }

    const signal = await executiveChangeService.recordChangeSignal({
      customerId,
      stakeholderId,
      signalType,
      executiveName,
      newTitle,
      previousTitle,
      rawData: rawData || {},
      confidence,
    });

    res.status(201).json({ signal });
  } catch (error) {
    console.error('Error recording executive change signal:', error);
    res.status(500).json({ error: 'Failed to record executive change signal' });
  }
});

// ============================================
// Slack Alert
// ============================================

/**
 * POST /api/executive-changes/:changeId/send-slack-alert
 * Send Slack alert for executive change
 */
router.post('/:changeId/send-slack-alert', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const change = await executiveChangeService.getExecutiveChange(changeId);
    if (!change) {
      return res.status(404).json({ error: 'Executive change not found' });
    }

    await executiveChangeService.sendSlackAlert(userId, change, change.customerId);

    res.json({ message: 'Slack alert sent' });
  } catch (error) {
    console.error('Error sending Slack alert:', error);
    res.status(500).json({ error: 'Failed to send Slack alert' });
  }
});

// ============================================
// Task Management
// ============================================

/**
 * GET /api/executive-change-tasks
 * List executive change response tasks
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { customerId, status, priority, limit = '50', offset = '0' } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    let query = supabase
      .from('executive_change_tasks')
      .select('*, customers(id, name), executive_changes(id, executive_name, new_title)');
    query = applyOrgFilter(query, req);
    query = query
      .order('due_at', { ascending: true })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (customerId) query = query.eq('customer_id', customerId);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    const { data, error } = await query;

    if (error) throw error;

    res.json({ tasks: data || [] });
  } catch (error) {
    console.error('Error listing executive change tasks:', error);
    res.status(500).json({ error: 'Failed to list executive change tasks' });
  }
});

/**
 * PATCH /api/executive-change-tasks/:taskId
 * Update an executive change task
 */
router.patch('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status, assignedTo } = req.body;
    const userId = (req as any).userId;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = userId;
      }
    }
    if (assignedTo) updates.assigned_to = assignedTo;

    const { data, error } = await supabase
      .from('executive_change_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    res.json({ task: data });
  } catch (error) {
    console.error('Error updating executive change task:', error);
    res.status(500).json({ error: 'Failed to update executive change task' });
  }
});

export { router as executiveChangeRoutes };
