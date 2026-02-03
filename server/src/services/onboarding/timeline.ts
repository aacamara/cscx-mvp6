/**
 * Onboarding Timeline Service (PRD - Onboarding Data Persistence)
 *
 * Creates timeline entries during onboarding for agent context:
 * - Customer created
 * - Contract uploaded
 * - Stakeholders added
 * - Onboarding milestones
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

export type OnboardingSource = 'manual' | 'import' | 'csv' | 'api' | 'contract_upload';

export type TimelineEntryType = 'update' | 'call' | 'in_person' | 'email' | 'milestone';

export interface TimelineEntry {
  id: string;
  customerId: string;
  type: TimelineEntryType;
  subject: string;
  content: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateTimelineEntryParams {
  customerId: string;
  userId?: string;
  type: TimelineEntryType;
  subject: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Service Functions
// ============================================

/**
 * Create a timeline entry
 */
export async function createTimelineEntry(
  params: CreateTimelineEntryParams
): Promise<TimelineEntry | null> {
  if (!supabase) {
    console.log('[Timeline] Supabase not configured, skipping timeline entry');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('timeline_activities')
      .insert({
        customer_id: params.customerId,
        user_id: params.userId || null,
        type: params.type,
        subject: params.subject,
        content: params.content || null,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Timeline] Failed to create timeline entry:', error);
      return null;
    }

    console.log(`[Timeline] Created entry: ${params.subject}`);

    return {
      id: data.id,
      customerId: data.customer_id,
      type: data.type,
      subject: data.subject,
      content: data.content,
      metadata: data.metadata,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('[Timeline] Error creating timeline entry:', err);
    return null;
  }
}

/**
 * Record customer created event
 */
export async function recordCustomerCreated(
  customerId: string,
  customerName: string,
  source: OnboardingSource,
  metadata?: Record<string, unknown>
): Promise<TimelineEntry | null> {
  return createTimelineEntry({
    customerId,
    type: 'milestone',
    subject: 'Customer Created',
    content: `New customer "${customerName}" was created via ${formatSource(source)}.`,
    metadata: {
      event_type: 'customer_created',
      onboarding_source: source,
      customer_name: customerName,
      ...metadata,
    },
  });
}

/**
 * Record contract uploaded event
 */
export async function recordContractUploaded(
  customerId: string,
  contractId: string,
  contractValue: number | null,
  source: OnboardingSource,
  metadata?: Record<string, unknown>
): Promise<TimelineEntry | null> {
  const valueStr = contractValue ? ` (ARR: $${contractValue.toLocaleString()})` : '';

  return createTimelineEntry({
    customerId,
    type: 'milestone',
    subject: 'Contract Uploaded',
    content: `Contract was uploaded and processed${valueStr} via ${formatSource(source)}.`,
    metadata: {
      event_type: 'contract_uploaded',
      onboarding_source: source,
      contract_id: contractId,
      contract_value: contractValue,
      ...metadata,
    },
  });
}

/**
 * Record stakeholders added event
 */
export async function recordStakeholdersAdded(
  customerId: string,
  stakeholders: Array<{ name: string; email?: string; role?: string }>,
  source: OnboardingSource,
  metadata?: Record<string, unknown>
): Promise<TimelineEntry | null> {
  const names = stakeholders.map(s => s.name).join(', ');
  const primaryStakeholder = stakeholders[0];

  return createTimelineEntry({
    customerId,
    type: 'update',
    subject: 'Stakeholders Added',
    content: `${stakeholders.length} stakeholder(s) added: ${names}. Primary contact: ${primaryStakeholder?.name || 'None'}.`,
    metadata: {
      event_type: 'stakeholders_added',
      onboarding_source: source,
      stakeholder_count: stakeholders.length,
      stakeholders: stakeholders.map(s => ({
        name: s.name,
        email: s.email || null,
        role: s.role || null,
      })),
      primary_contact: primaryStakeholder?.name || null,
      ...metadata,
    },
  });
}

/**
 * Record onboarding milestone achieved
 */
export async function recordOnboardingMilestone(
  customerId: string,
  milestoneName: string,
  milestoneDescription: string,
  daysFromStart: number | null,
  metadata?: Record<string, unknown>
): Promise<TimelineEntry | null> {
  const daysStr = daysFromStart !== null ? ` (${daysFromStart} days from start)` : '';

  return createTimelineEntry({
    customerId,
    type: 'milestone',
    subject: `Milestone: ${formatMilestoneName(milestoneName)}`,
    content: `${milestoneDescription}${daysStr}.`,
    metadata: {
      event_type: 'onboarding_milestone',
      milestone_name: milestoneName,
      days_from_start: daysFromStart,
      ...metadata,
    },
  });
}

/**
 * Record onboarding workspace created
 */
export async function recordWorkspaceCreated(
  customerId: string,
  customerName: string,
  driveRootId: string,
  sheetId: string,
  source: OnboardingSource
): Promise<TimelineEntry | null> {
  return createTimelineEntry({
    customerId,
    type: 'milestone',
    subject: 'Onboarding Workspace Created',
    content: `Google Workspace folders and tracking sheet created for ${customerName}.`,
    metadata: {
      event_type: 'workspace_created',
      onboarding_source: source,
      drive_root_id: driveRootId,
      sheet_id: sheetId,
    },
  });
}

/**
 * Record health score calculated
 */
export async function recordHealthScoreCalculated(
  customerId: string,
  overallScore: number,
  components: { product: number; risk: number; outcomes: number; voice: number; engagement: number }
): Promise<TimelineEntry | null> {
  const status = overallScore >= 70 ? 'healthy' : overallScore >= 50 ? 'at risk' : 'critical';

  return createTimelineEntry({
    customerId,
    type: 'update',
    subject: 'Initial Health Score Calculated',
    content: `Initial health score: ${overallScore} (${status}). PROVE breakdown: P=${components.product}, R=${components.risk}, O=${components.outcomes}, V=${components.voice}, E=${components.engagement}.`,
    metadata: {
      event_type: 'health_score_calculated',
      overall_score: overallScore,
      status,
      components,
    },
  });
}

/**
 * Get timeline entries for a customer
 */
export async function getTimelineEntries(
  customerId: string,
  limit: number = 50
): Promise<TimelineEntry[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('timeline_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Timeline] Failed to get timeline entries:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      customerId: d.customer_id,
      type: d.type,
      subject: d.subject,
      content: d.content,
      metadata: d.metadata,
      createdAt: d.created_at,
    }));
  } catch (err) {
    console.error('[Timeline] Error getting timeline entries:', err);
    return [];
  }
}

/**
 * Get onboarding-specific timeline entries for agent context
 */
export async function getOnboardingTimeline(
  customerId: string
): Promise<TimelineEntry[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('timeline_activities')
      .select('*')
      .eq('customer_id', customerId)
      .or('metadata->>event_type.in.(customer_created,contract_uploaded,stakeholders_added,onboarding_milestone,workspace_created,health_score_calculated)')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Timeline] Failed to get onboarding timeline:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      customerId: d.customer_id,
      type: d.type,
      subject: d.subject,
      content: d.content,
      metadata: d.metadata,
      createdAt: d.created_at,
    }));
  } catch (err) {
    console.error('[Timeline] Error getting onboarding timeline:', err);
    return [];
  }
}

// ============================================
// Helper Functions
// ============================================

function formatSource(source: OnboardingSource): string {
  switch (source) {
    case 'manual':
      return 'manual entry';
    case 'import':
      return 'data import';
    case 'csv':
      return 'CSV upload';
    case 'api':
      return 'API integration';
    case 'contract_upload':
      return 'contract upload';
    default:
      return source;
  }
}

function formatMilestoneName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// Exports
// ============================================

export default {
  createTimelineEntry,
  recordCustomerCreated,
  recordContractUploaded,
  recordStakeholdersAdded,
  recordOnboardingMilestone,
  recordWorkspaceCreated,
  recordHealthScoreCalculated,
  getTimelineEntries,
  getOnboardingTimeline,
};
