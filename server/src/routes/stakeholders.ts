/**
 * Stakeholder Routes
 * PRD-088: API endpoints for stakeholder management and champion departure
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { championDepartureService } from '../services/championDeparture.js';
import { triggerEngine } from '../triggers/engine.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Stakeholder CRUD
// ============================================

/**
 * POST /api/stakeholders/bulk
 * Bulk upsert stakeholders for onboarding flow
 * Handles duplicates by email, properly sets is_primary flag
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { customerId, stakeholders } = req.body;

    if (!customerId || !stakeholders || !Array.isArray(stakeholders)) {
      return res.status(400).json({
        error: 'customerId and stakeholders array are required'
      });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    console.log(`[Stakeholders] Bulk upserting ${stakeholders.length} stakeholders for customer ${customerId}`);

    const results: Array<{ id: string; name: string; action: 'created' | 'updated' }> = [];

    for (const stakeholder of stakeholders) {
      if (!stakeholder.name) {
        console.warn('[Stakeholders] Skipping stakeholder without name');
        continue;
      }

      // Check for existing stakeholder by email or name
      let existingId: string | null = null;
      if (stakeholder.email) {
        const { data: existing } = await supabase
          .from('stakeholders')
          .select('id')
          .eq('customer_id', customerId)
          .eq('email', stakeholder.email)
          .maybeSingle();
        existingId = existing?.id || null;
      }

      // If no email match, try by name
      if (!existingId && stakeholder.name) {
        const { data: existing } = await supabase
          .from('stakeholders')
          .select('id')
          .eq('customer_id', customerId)
          .eq('name', stakeholder.name)
          .maybeSingle();
        existingId = existing?.id || null;
      }

      const stakeholderData = {
        customer_id: customerId,
        name: stakeholder.name,
        email: stakeholder.email || null,
        title: stakeholder.title || null,
        role: stakeholder.role || null,
        phone: stakeholder.phone || null,
        linkedin_url: stakeholder.linkedin_url || stakeholder.linkedinUrl || null,
        is_primary: stakeholder.is_primary || stakeholder.isPrimary || false,
        is_champion: stakeholder.is_champion || stakeholder.isChampion || false,
        is_decision_maker: stakeholder.is_decision_maker || stakeholder.isDecisionMaker || false,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        // Update existing stakeholder
        const { error } = await supabase
          .from('stakeholders')
          .update(stakeholderData)
          .eq('id', existingId);

        if (error) {
          console.error('[Stakeholders] Failed to update stakeholder:', error);
          continue;
        }

        results.push({ id: existingId, name: stakeholder.name, action: 'updated' });
        console.log(`[Stakeholders] Updated stakeholder: ${stakeholder.name}`);
      } else {
        // Create new stakeholder
        const { data, error } = await supabase
          .from('stakeholders')
          .insert({
            id: uuidv4(),
            ...stakeholderData,
            engagement_score: 50,
            interaction_count: 0,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (error) {
          console.error('[Stakeholders] Failed to create stakeholder:', error);
          continue;
        }

        results.push({ id: data.id, name: stakeholder.name, action: 'created' });
        console.log(`[Stakeholders] Created stakeholder: ${stakeholder.name}`);
      }
    }

    // Ensure only one is_primary per customer
    const primaryCount = stakeholders.filter(s => s.is_primary || s.isPrimary).length;
    if (primaryCount > 1) {
      // Keep only the first primary, unset others
      const firstPrimary = stakeholders.find(s => s.is_primary || s.isPrimary);
      if (firstPrimary) {
        await supabase
          .from('stakeholders')
          .update({ is_primary: false })
          .eq('customer_id', customerId)
          .neq('name', firstPrimary.name);

        await supabase
          .from('stakeholders')
          .update({ is_primary: true })
          .eq('customer_id', customerId)
          .eq('name', firstPrimary.name);
      }
    }

    res.json({
      success: true,
      count: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      stakeholders: results,
    });
  } catch (error) {
    console.error('Error bulk upserting stakeholders:', error);
    res.status(500).json({ error: 'Failed to bulk upsert stakeholders' });
  }
});

/**
 * GET /api/stakeholders
 * List stakeholders, optionally filtered by customer
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { customerId, status, isChampion, isExecSponsor, limit = '50', offset = '0' } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    let query = supabase
      .from('stakeholders')
      .select('*, customers(id, name)')
      .order('is_champion', { ascending: false })
      .order('is_primary', { ascending: false })
      .order('name')
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (customerId) query = query.eq('customer_id', customerId);
    if (status) query = query.eq('status', status);
    if (isChampion === 'true') query = query.eq('is_champion', true);
    if (isExecSponsor === 'true') query = query.eq('is_exec_sponsor', true);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      stakeholders: data || [],
      total: count,
    });
  } catch (error) {
    console.error('Error listing stakeholders:', error);
    res.status(500).json({ error: 'Failed to list stakeholders' });
  }
});

/**
 * GET /api/stakeholders/:stakeholderId
 * Get stakeholder details
 */
router.get('/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;

    const stakeholder = await championDepartureService.getStakeholder(stakeholderId);

    if (!stakeholder) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }

    res.json({ stakeholder });
  } catch (error) {
    console.error('Error getting stakeholder:', error);
    res.status(500).json({ error: 'Failed to get stakeholder' });
  }
});

/**
 * POST /api/stakeholders
 * Create a new stakeholder
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      name,
      role,
      email,
      phone,
      linkedinUrl,
      isPrimary,
      isChampion,
      isExecSponsor,
      notes,
    } = req.body;

    if (!customerId || !name) {
      return res.status(400).json({ error: 'customerId and name are required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('stakeholders')
      .insert({
        id: uuidv4(),
        customer_id: customerId,
        name,
        role,
        email,
        phone,
        linkedin_url: linkedinUrl,
        is_primary: isPrimary || false,
        is_champion: isChampion || false,
        is_exec_sponsor: isExecSponsor || false,
        status: 'active',
        engagement_score: 50,
        interaction_count: 0,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ stakeholder: data });
  } catch (error) {
    console.error('Error creating stakeholder:', error);
    res.status(500).json({ error: 'Failed to create stakeholder' });
  }
});

/**
 * PATCH /api/stakeholders/:stakeholderId
 * Update stakeholder details
 */
router.patch('/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const updates = req.body;

    const stakeholder = await championDepartureService.updateStakeholder(stakeholderId, updates);

    res.json({ stakeholder });
  } catch (error) {
    console.error('Error updating stakeholder:', error);
    res.status(500).json({ error: 'Failed to update stakeholder' });
  }
});

/**
 * DELETE /api/stakeholders/:stakeholderId
 * Delete a stakeholder
 */
router.delete('/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { error } = await supabase
      .from('stakeholders')
      .delete()
      .eq('id', stakeholderId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stakeholder:', error);
    res.status(500).json({ error: 'Failed to delete stakeholder' });
  }
});

// ============================================
// Champion Departure Endpoints
// ============================================

/**
 * POST /api/stakeholders/:stakeholderId/mark-departed
 * Manually mark a stakeholder as departed (FR-1.6)
 */
router.post('/:stakeholderId/mark-departed', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const { departureDate, newCompany, newRole, reason } = req.body;
    const userId = (req as any).userId;

    const stakeholder = await championDepartureService.markDeparted(
      {
        stakeholderId,
        departureDate: departureDate ? new Date(departureDate) : undefined,
        newCompany,
        newRole,
        reason,
      },
      userId
    );

    // Process through trigger engine to fire any matching triggers
    const triggerEvent = await triggerEngine.processEvent({
      id: uuidv4(),
      type: 'stakeholder_changed',
      customerId: stakeholder.customerId,
      data: {
        stakeholderId,
        changeType: 'departed',
        stakeholderName: stakeholder.name,
        stakeholderRole: stakeholder.role,
        wasChampion: stakeholder.isChampion,
        wasExecSponsor: stakeholder.isExecSponsor,
        newCompany,
        newRole,
      },
      timestamp: new Date(),
    });

    res.json({
      stakeholder,
      triggersMatched: triggerEvent.length,
    });
  } catch (error) {
    console.error('Error marking stakeholder as departed:', error);
    res.status(500).json({ error: 'Failed to mark stakeholder as departed' });
  }
});

/**
 * POST /api/stakeholders/:stakeholderId/mark-champion
 * Mark or unmark a stakeholder as champion
 */
router.post('/:stakeholderId/mark-champion', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const { isChampion } = req.body;

    const stakeholder = await championDepartureService.updateStakeholder(stakeholderId, {
      isChampion: isChampion !== false,
    });

    res.json({ stakeholder });
  } catch (error) {
    console.error('Error updating champion status:', error);
    res.status(500).json({ error: 'Failed to update champion status' });
  }
});

/**
 * POST /api/stakeholders/:stakeholderId/record-interaction
 * Record an interaction with a stakeholder
 */
router.post('/:stakeholderId/record-interaction', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const { interactionType, title, description } = req.body;

    if (!interactionType) {
      return res.status(400).json({ error: 'interactionType is required' });
    }

    await championDepartureService.recordInteraction(
      stakeholderId,
      interactionType,
      title,
      description
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({ error: 'Failed to record interaction' });
  }
});

/**
 * GET /api/stakeholders/:stakeholderId/departure-signals
 * Get departure signals for a stakeholder
 */
router.get('/:stakeholderId/departure-signals', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;

    const signals = await championDepartureService.getDepartureSignals(stakeholderId);

    res.json({ signals });
  } catch (error) {
    console.error('Error getting departure signals:', error);
    res.status(500).json({ error: 'Failed to get departure signals' });
  }
});

/**
 * POST /api/stakeholders/:stakeholderId/departure-signals
 * Record a departure signal for a stakeholder
 */
router.post('/:stakeholderId/departure-signals', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const { signalType, confidence, evidence, evidenceData, customerId } = req.body;

    if (!signalType || confidence === undefined || !customerId) {
      return res.status(400).json({
        error: 'signalType, confidence, and customerId are required',
      });
    }

    const signal = await championDepartureService.recordDepartureSignal({
      stakeholderId,
      customerId,
      signalType,
      confidence,
      evidence: evidence || '',
      evidenceData,
    });

    // Evaluate departure status after recording signal
    const evaluation = await championDepartureService.evaluateChampionStatus(stakeholderId);

    res.status(201).json({
      signal,
      evaluation,
    });
  } catch (error) {
    console.error('Error recording departure signal:', error);
    res.status(500).json({ error: 'Failed to record departure signal' });
  }
});

/**
 * GET /api/stakeholders/:stakeholderId/evaluate-departure
 * Evaluate if a stakeholder has departed based on signals
 */
router.get('/:stakeholderId/evaluate-departure', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;

    const evaluation = await championDepartureService.evaluateChampionStatus(stakeholderId);

    res.json({ evaluation });
  } catch (error) {
    console.error('Error evaluating departure:', error);
    res.status(500).json({ error: 'Failed to evaluate departure' });
  }
});

// ============================================
// Customer Champion Status Endpoints
// ============================================

/**
 * GET /api/customers/:customerId/champion-status
 * Get champion status for a customer (FR-4.x)
 */
router.get('/customers/:customerId/champion-status', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const status = await championDepartureService.getChampionStatus(customerId);

    res.json(status);
  } catch (error) {
    console.error('Error getting champion status:', error);
    res.status(500).json({ error: 'Failed to get champion status' });
  }
});

/**
 * GET /api/customers/:customerId/suggest-champions
 * Get suggested new champion candidates (FR-3.4)
 */
router.get('/customers/:customerId/suggest-champions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit = '5' } = req.query;

    const suggestions = await championDepartureService.suggestNewChampions(
      customerId,
      parseInt(limit as string)
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting champion suggestions:', error);
    res.status(500).json({ error: 'Failed to get champion suggestions' });
  }
});

/**
 * GET /api/customers/:customerId/stakeholders
 * Get all stakeholders for a customer
 */
router.get('/customers/:customerId/stakeholders', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const stakeholders = await championDepartureService.getStakeholders(customerId);

    res.json({ stakeholders });
  } catch (error) {
    console.error('Error getting customer stakeholders:', error);
    res.status(500).json({ error: 'Failed to get customer stakeholders' });
  }
});

/**
 * POST /api/customers/:customerId/draft-outreach
 * Generate multi-threading outreach email drafts (FR-3.3)
 */
router.post('/customers/:customerId/draft-outreach', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { riskSignalId } = req.body;

    const drafts = await championDepartureService.generateOutreachDrafts(
      customerId,
      riskSignalId
    );

    res.json({ drafts });
  } catch (error) {
    console.error('Error generating outreach drafts:', error);
    res.status(500).json({ error: 'Failed to generate outreach drafts' });
  }
});

// ============================================
// Risk Signals
// ============================================

/**
 * GET /api/risk-signals
 * List risk signals
 */
router.get('/risk-signals', async (req: Request, res: Response) => {
  try {
    const { customerId, signalType, severity, resolved, limit = '50', offset = '0' } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    let query = supabase
      .from('risk_signals')
      .select('*, customers(id, name)')
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (customerId) query = query.eq('customer_id', customerId);
    if (signalType) query = query.eq('signal_type', signalType);
    if (severity) query = query.eq('severity', severity);
    if (resolved !== undefined) query = query.eq('resolved', resolved === 'true');

    const { data, error } = await query;

    if (error) throw error;

    res.json({ riskSignals: data || [] });
  } catch (error) {
    console.error('Error listing risk signals:', error);
    res.status(500).json({ error: 'Failed to list risk signals' });
  }
});

/**
 * GET /api/risk-signals/:signalId
 * Get risk signal details
 */
router.get('/risk-signals/:signalId', async (req: Request, res: Response) => {
  try {
    const { signalId } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('risk_signals')
      .select('*, customers(id, name)')
      .eq('id', signalId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Risk signal not found' });
    }

    res.json({ riskSignal: data });
  } catch (error) {
    console.error('Error getting risk signal:', error);
    res.status(500).json({ error: 'Failed to get risk signal' });
  }
});

/**
 * POST /api/risk-signals/:signalId/resolve
 * Resolve a risk signal
 */
router.post('/risk-signals/:signalId/resolve', async (req: Request, res: Response) => {
  try {
    const { signalId } = req.params;
    const { resolutionNotes } = req.body;
    const userId = (req as any).userId;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('risk_signals')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: resolutionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signalId)
      .select()
      .single();

    if (error) throw error;

    res.json({ riskSignal: data });
  } catch (error) {
    console.error('Error resolving risk signal:', error);
    res.status(500).json({ error: 'Failed to resolve risk signal' });
  }
});

// ============================================
// Departure Tasks
// ============================================

/**
 * GET /api/departure-tasks
 * List champion departure response tasks
 */
router.get('/departure-tasks', async (req: Request, res: Response) => {
  try {
    const { customerId, status, priority, limit = '50', offset = '0' } = req.query;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    let query = supabase
      .from('champion_departure_tasks')
      .select('*, customers(id, name), stakeholders(id, name)')
      .order('due_at', { ascending: true })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (customerId) query = query.eq('customer_id', customerId);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    const { data, error } = await query;

    if (error) throw error;

    res.json({ tasks: data || [] });
  } catch (error) {
    console.error('Error listing departure tasks:', error);
    res.status(500).json({ error: 'Failed to list departure tasks' });
  }
});

/**
 * PATCH /api/departure-tasks/:taskId
 * Update a departure task
 */
router.patch('/departure-tasks/:taskId', async (req: Request, res: Response) => {
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
      .from('champion_departure_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    res.json({ task: data });
  } catch (error) {
    console.error('Error updating departure task:', error);
    res.status(500).json({ error: 'Failed to update departure task' });
  }
});

export { router as stakeholderRoutes };
