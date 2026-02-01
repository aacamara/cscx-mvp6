/**
 * Plan Persistence Service
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Manages execution plans in the database:
 * - Create plans
 * - Retrieve plans
 * - Update plan status
 * - Approve plans with modifications
 */

import {
  ExecutionPlan,
  PlanStatus,
  PlanModification,
  AggregatedContext,
  ExecutionPlanRow,
  TaskType,
} from './types.js';

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * Create a new execution plan in the database
 */
export async function createPlan(
  plan: ExecutionPlan,
  userId: string,
  customerId: string | null,
  userQuery: string,
  contextSummary?: Partial<AggregatedContext>
): Promise<{ planId: string; success: boolean; error?: string }> {
  if (!supabase) {
    return { planId: plan.planId, success: false, error: 'Database not configured' };
  }

  try {
    const { error } = await supabase
      .from('execution_plans')
      .insert({
        id: plan.planId,
        user_id: userId,
        customer_id: customerId,
        task_type: plan.taskType,
        user_query: userQuery,
        plan_json: plan,
        context_summary: contextSummary || null,
        status: 'pending',
      });

    if (error) {
      console.error('[planService] Create error:', error);
      return { planId: plan.planId, success: false, error: error.message };
    }

    return { planId: plan.planId, success: true };
  } catch (error) {
    console.error('[planService] Create exception:', error);
    return {
      planId: plan.planId,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create plan',
    };
  }
}

/**
 * Retrieve an execution plan by ID
 */
export async function getPlan(planId: string): Promise<{
  plan: ExecutionPlanRow | null;
  success: boolean;
  error?: string;
}> {
  if (!supabase) {
    return { plan: null, success: false, error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('execution_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      console.error('[planService] Get error:', error);
      return { plan: null, success: false, error: error.message };
    }

    return { plan: data as ExecutionPlanRow, success: true };
  } catch (error) {
    console.error('[planService] Get exception:', error);
    return {
      plan: null,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plan',
    };
  }
}

/**
 * Update the status of an execution plan
 */
export async function updatePlanStatus(
  planId: string,
  status: PlanStatus,
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const updateData: Partial<ExecutionPlanRow> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('execution_plans')
      .update(updateData)
      .eq('id', planId);

    if (error) {
      console.error('[planService] Update status error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[planService] Update status exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status',
    };
  }
}

/**
 * Approve a plan for execution with optional modifications
 */
export async function approvePlan(
  planId: string,
  userId: string,
  modifications?: PlanModification[]
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const { error } = await supabase
      .from('execution_plans')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId,
        modifications: modifications || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    if (error) {
      console.error('[planService] Approve error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[planService] Approve exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve plan',
    };
  }
}

/**
 * Reject a plan
 */
export async function rejectPlan(
  planId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const { error } = await supabase
      .from('execution_plans')
      .update({
        status: 'rejected',
        error_message: reason || 'Rejected by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    if (error) {
      console.error('[planService] Reject error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[planService] Reject exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject plan',
    };
  }
}

/**
 * Get plans for a user
 */
export async function getUserPlans(
  userId: string,
  options?: {
    status?: PlanStatus;
    customerId?: string;
    limit?: number;
  }
): Promise<{ plans: ExecutionPlanRow[]; success: boolean; error?: string }> {
  if (!supabase) {
    return { plans: [], success: false, error: 'Database not configured' };
  }

  try {
    let query = supabase
      .from('execution_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[planService] Get user plans error:', error);
      return { plans: [], success: false, error: error.message };
    }

    return { plans: data as ExecutionPlanRow[], success: true };
  } catch (error) {
    console.error('[planService] Get user plans exception:', error);
    return {
      plans: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plans',
    };
  }
}

/**
 * Get pending plans requiring approval
 */
export async function getPendingPlans(
  userId: string
): Promise<{ plans: ExecutionPlanRow[]; success: boolean; error?: string }> {
  return getUserPlans(userId, { status: 'pending', limit: 10 });
}

/**
 * Apply modifications to a plan
 */
export function applyModifications(
  plan: ExecutionPlan,
  modifications: PlanModification[]
): ExecutionPlan {
  const modifiedPlan = { ...plan };

  for (const mod of modifications) {
    // Handle section modifications
    if (mod.field.startsWith('structure.sections')) {
      const sectionIndex = parseInt(mod.field.split('[')[1]?.split(']')[0] || '-1');
      if (sectionIndex >= 0 && modifiedPlan.structure.sections[sectionIndex]) {
        // Apply modification to section
        const subField = mod.field.split('.').pop();
        if (subField && subField !== 'sections') {
          (modifiedPlan.structure.sections[sectionIndex] as any)[subField] = mod.newValue;
        }
      }
    }

    // Handle destination modifications
    if (mod.field.startsWith('destination')) {
      const subField = mod.field.split('.').pop();
      if (subField) {
        (modifiedPlan.destination as any)[subField] = mod.newValue;
      }
    }

    // Handle other top-level modifications
    if (mod.field === 'taskType' && typeof mod.newValue === 'string') {
      modifiedPlan.taskType = mod.newValue as TaskType;
    }
  }

  return modifiedPlan;
}

export const planService = {
  createPlan,
  getPlan,
  updatePlanStatus,
  approvePlan,
  rejectPlan,
  getUserPlans,
  getPendingPlans,
  applyModifications,
};
