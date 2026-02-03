/**
 * Onboarding Milestones Service (PRD - Onboarding Data Persistence)
 *
 * Manages onboarding milestones tracking:
 * - Initializes onboarding progress and milestones for new customers
 * - Tracks key milestones: kickoff_completed, training_scheduled, first_login, adoption_milestone
 * - Calculates days_from_start for reporting
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export interface OnboardingProgressInit {
  customerId: string;
  customerName: string;
  segment?: string;
  csmId?: string;
  csmName?: string;
  targetCompletionDays?: number;
}

export interface MilestoneDefinition {
  name: string;
  description: string;
  category: 'kickoff' | 'setup' | 'training' | 'adoption' | 'value';
  targetDaysFromStart: number;
}

export interface MilestoneRecord {
  id: string;
  onboardingId: string;
  customerId: string;
  name: string;
  description: string;
  category: string;
  targetDate: string | null;
  actualDate: string | null;
  status: 'pending' | 'completed' | 'missed' | 'skipped';
  daysFromStart: number | null;
  createdAt: string;
}

export interface OnboardingProgress {
  id: string;
  customerId: string;
  currentStage: string;
  overallStatus: string;
  startedAt: string;
  targetCompletion: string | null;
  progressPct: number;
  milestones: MilestoneRecord[];
}

// ============================================
// Default Milestone Definitions
// ============================================

const DEFAULT_MILESTONES: MilestoneDefinition[] = [
  {
    name: 'kickoff_completed',
    description: 'Kickoff meeting completed with key stakeholders',
    category: 'kickoff',
    targetDaysFromStart: 7,
  },
  {
    name: 'training_scheduled',
    description: 'Initial training sessions scheduled for end users',
    category: 'training',
    targetDaysFromStart: 14,
  },
  {
    name: 'first_login',
    description: 'First user login recorded in the system',
    category: 'adoption',
    targetDaysFromStart: 21,
  },
  {
    name: 'adoption_milestone',
    description: 'Key adoption threshold reached (e.g., 3+ active users)',
    category: 'adoption',
    targetDaysFromStart: 30,
  },
];

// ============================================
// Service Functions
// ============================================

/**
 * Initialize onboarding progress and milestones for a new customer
 * Creates:
 * - customer_onboarding_progress record
 * - onboarding_milestones records for key milestones
 *
 * The database trigger will automatically create stage progress records
 */
export async function initializeOnboardingProgress(
  data: OnboardingProgressInit
): Promise<OnboardingProgress | null> {
  if (!supabase) {
    console.log('[Milestones] Supabase not configured, skipping onboarding progress initialization');
    return null;
  }

  try {
    console.log(`[Milestones] Initializing onboarding progress for customer ${data.customerId}`);

    const startedAt = new Date();
    const targetDays = data.targetCompletionDays || 60;
    const targetCompletion = new Date(startedAt.getTime() + targetDays * 24 * 60 * 60 * 1000);

    // Create onboarding progress record
    const { data: progress, error: progressError } = await supabase
      .from('customer_onboarding_progress')
      .insert({
        customer_id: data.customerId,
        current_stage: 'contract_signed',
        overall_status: 'in_progress',
        started_at: startedAt.toISOString(),
        target_completion: targetCompletion.toISOString(),
        progress_pct: 0,
        csm_id: data.csmId || null,
        csm_name: data.csmName || null,
        segment: data.segment || null,
        notes: `Onboarding initiated for ${data.customerName}`,
        metadata: {
          customer_name: data.customerName,
          initialized_at: startedAt.toISOString(),
        },
      })
      .select('id')
      .single();

    if (progressError) {
      // Check if it's a duplicate - customer might already have onboarding progress
      if (progressError.code === '23505') {
        console.log(`[Milestones] Onboarding progress already exists for customer ${data.customerId}`);
        const { data: existing } = await supabase
          .from('customer_onboarding_progress')
          .select('id')
          .eq('customer_id', data.customerId)
          .single();

        if (existing) {
          // Just initialize milestones for existing progress
          await createMilestones(existing.id, data.customerId, startedAt);
          return getOnboardingProgress(data.customerId);
        }
      }
      console.error('[Milestones] Failed to create onboarding progress:', progressError);
      return null;
    }

    const onboardingId = progress.id;
    console.log(`[Milestones] Created onboarding progress ${onboardingId}`);

    // Create milestone records
    await createMilestones(onboardingId, data.customerId, startedAt);

    // Log event
    await logOnboardingEvent(onboardingId, data.customerId, 'onboarding_started', {
      customer_name: data.customerName,
      target_completion: targetCompletion.toISOString(),
    });

    return getOnboardingProgress(data.customerId);
  } catch (err) {
    console.error('[Milestones] Error initializing onboarding progress:', err);
    return null;
  }
}

/**
 * Create milestone records for an onboarding
 */
async function createMilestones(
  onboardingId: string,
  customerId: string,
  startedAt: Date
): Promise<void> {
  if (!supabase) return;

  console.log(`[Milestones] Creating ${DEFAULT_MILESTONES.length} milestones for onboarding ${onboardingId}`);

  for (const milestone of DEFAULT_MILESTONES) {
    const targetDate = new Date(startedAt.getTime() + milestone.targetDaysFromStart * 24 * 60 * 60 * 1000);

    try {
      await supabase.from('onboarding_milestones').insert({
        onboarding_id: onboardingId,
        customer_id: customerId,
        name: milestone.name,
        description: milestone.description,
        category: milestone.category,
        target_date: targetDate.toISOString().split('T')[0],
        status: 'pending',
        on_track: true,
        metadata: {
          target_days_from_start: milestone.targetDaysFromStart,
        },
      });
      console.log(`[Milestones] Created milestone: ${milestone.name}`);
    } catch (err) {
      console.error(`[Milestones] Failed to create milestone ${milestone.name}:`, err);
    }
  }
}

/**
 * Mark a milestone as completed
 * Calculates days_from_start automatically
 */
export async function completeMilestone(
  customerId: string,
  milestoneName: string,
  notes?: string
): Promise<MilestoneRecord | null> {
  if (!supabase) {
    console.log('[Milestones] Supabase not configured');
    return null;
  }

  try {
    // Get the onboarding progress to calculate days_from_start
    const { data: progress } = await supabase
      .from('customer_onboarding_progress')
      .select('id, started_at')
      .eq('customer_id', customerId)
      .single();

    if (!progress) {
      console.error(`[Milestones] No onboarding progress found for customer ${customerId}`);
      return null;
    }

    const now = new Date();
    const startedAt = new Date(progress.started_at);
    const daysFromStart = Math.floor((now.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000));

    // Update the milestone
    const { data: milestone, error } = await supabase
      .from('onboarding_milestones')
      .update({
        actual_date: now.toISOString().split('T')[0],
        status: 'completed',
        notes: notes || null,
        metadata: {
          days_from_start: daysFromStart,
          completed_at: now.toISOString(),
        },
        updated_at: now.toISOString(),
      })
      .eq('onboarding_id', progress.id)
      .eq('name', milestoneName)
      .select('*')
      .single();

    if (error) {
      console.error(`[Milestones] Failed to complete milestone ${milestoneName}:`, error);
      return null;
    }

    console.log(`[Milestones] Completed milestone: ${milestoneName} (${daysFromStart} days from start)`);

    // Log event
    await logOnboardingEvent(progress.id, customerId, 'milestone_achieved', {
      milestone_name: milestoneName,
      days_from_start: daysFromStart,
    });

    // Update overall progress percentage
    await updateProgressPercentage(progress.id);

    return {
      id: milestone.id,
      onboardingId: milestone.onboarding_id,
      customerId: milestone.customer_id,
      name: milestone.name,
      description: milestone.description,
      category: milestone.category,
      targetDate: milestone.target_date,
      actualDate: milestone.actual_date,
      status: milestone.status,
      daysFromStart,
      createdAt: milestone.created_at,
    };
  } catch (err) {
    console.error('[Milestones] Error completing milestone:', err);
    return null;
  }
}

/**
 * Get onboarding progress with milestones for a customer
 */
export async function getOnboardingProgress(
  customerId: string
): Promise<OnboardingProgress | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data: progress } = await supabase
      .from('customer_onboarding_progress')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (!progress) {
      return null;
    }

    const { data: milestones } = await supabase
      .from('onboarding_milestones')
      .select('*')
      .eq('onboarding_id', progress.id)
      .order('created_at', { ascending: true });

    const startedAt = new Date(progress.started_at);
    const now = new Date();

    return {
      id: progress.id,
      customerId: progress.customer_id,
      currentStage: progress.current_stage,
      overallStatus: progress.overall_status,
      startedAt: progress.started_at,
      targetCompletion: progress.target_completion,
      progressPct: progress.progress_pct,
      milestones: (milestones || []).map(m => {
        const actualDate = m.actual_date ? new Date(m.actual_date) : null;
        const daysFromStart = actualDate
          ? Math.floor((actualDate.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000))
          : null;

        return {
          id: m.id,
          onboardingId: m.onboarding_id,
          customerId: m.customer_id,
          name: m.name,
          description: m.description,
          category: m.category,
          targetDate: m.target_date,
          actualDate: m.actual_date,
          status: m.status,
          daysFromStart,
          createdAt: m.created_at,
        };
      }),
    };
  } catch (err) {
    console.error('[Milestones] Error getting onboarding progress:', err);
    return null;
  }
}

/**
 * Get milestone report with days_from_start for all milestones
 */
export async function getMilestoneReport(
  customerId: string
): Promise<{
  customerId: string;
  daysInOnboarding: number;
  milestones: Array<{
    name: string;
    status: string;
    targetDaysFromStart: number;
    actualDaysFromStart: number | null;
    variance: number | null; // negative = ahead of schedule
    onTrack: boolean;
  }>;
} | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data: progress } = await supabase
      .from('customer_onboarding_progress')
      .select('id, started_at')
      .eq('customer_id', customerId)
      .single();

    if (!progress) {
      return null;
    }

    const { data: milestones } = await supabase
      .from('onboarding_milestones')
      .select('*')
      .eq('onboarding_id', progress.id)
      .order('created_at', { ascending: true });

    const startedAt = new Date(progress.started_at);
    const now = new Date();
    const daysInOnboarding = Math.floor((now.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000));

    return {
      customerId,
      daysInOnboarding,
      milestones: (milestones || []).map(m => {
        const targetDaysFromStart = m.metadata?.target_days_from_start || 0;
        const actualDate = m.actual_date ? new Date(m.actual_date) : null;
        const actualDaysFromStart = actualDate
          ? Math.floor((actualDate.getTime() - startedAt.getTime()) / (24 * 60 * 60 * 1000))
          : null;

        const variance = actualDaysFromStart !== null
          ? actualDaysFromStart - targetDaysFromStart
          : null;

        // On track if completed within 3 days of target, or pending and before target
        const onTrack = m.status === 'completed'
          ? (variance !== null && variance <= 3)
          : (m.status === 'pending' && daysInOnboarding <= targetDaysFromStart + 3);

        return {
          name: m.name,
          status: m.status,
          targetDaysFromStart,
          actualDaysFromStart,
          variance,
          onTrack,
        };
      }),
    };
  } catch (err) {
    console.error('[Milestones] Error getting milestone report:', err);
    return null;
  }
}

/**
 * Update progress percentage based on completed milestones
 */
async function updateProgressPercentage(onboardingId: string): Promise<void> {
  if (!supabase) return;

  try {
    // Count completed milestones
    const { count: completedCount } = await supabase
      .from('onboarding_milestones')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_id', onboardingId)
      .eq('status', 'completed');

    const { count: totalCount } = await supabase
      .from('onboarding_milestones')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_id', onboardingId);

    if (totalCount && totalCount > 0) {
      const progressPct = Math.round(((completedCount || 0) / totalCount) * 100);

      await supabase
        .from('customer_onboarding_progress')
        .update({
          progress_pct: progressPct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', onboardingId);

      console.log(`[Milestones] Updated progress to ${progressPct}%`);
    }
  } catch (err) {
    console.error('[Milestones] Error updating progress percentage:', err);
  }
}

/**
 * Log an onboarding event
 */
async function logOnboardingEvent(
  onboardingId: string,
  customerId: string,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('onboarding_events').insert({
      onboarding_id: onboardingId,
      customer_id: customerId,
      event_type: eventType,
      event_description: getEventDescription(eventType, eventData),
      actor_type: 'system',
      event_data: eventData || {},
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Milestones] Error logging event:', err);
  }
}

/**
 * Get human-readable description for event types
 */
function getEventDescription(eventType: string, data?: Record<string, unknown>): string {
  switch (eventType) {
    case 'onboarding_started':
      return `Onboarding initiated for ${data?.customer_name || 'customer'}`;
    case 'milestone_achieved':
      return `Milestone '${data?.milestone_name}' completed (${data?.days_from_start} days from start)`;
    case 'stage_entered':
      return `Entered stage: ${data?.stage}`;
    case 'stage_completed':
      return `Completed stage: ${data?.stage}`;
    default:
      return eventType;
  }
}

// ============================================
// Exports
// ============================================

export default {
  initializeOnboardingProgress,
  completeMilestone,
  getOnboardingProgress,
  getMilestoneReport,
};
