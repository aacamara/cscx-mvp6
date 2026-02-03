/**
 * Template Library Service (PRD-256)
 *
 * Manages meeting prep templates and scheduled meeting preps with:
 * - Template CRUD operations
 * - Scheduled meeting prep management
 * - Auto-generation of prep documents
 * - Agenda building and topic submissions
 * - Action item tracking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export type MeetingType = '1on1' | 'team_sync' | 'pipeline_review' | 'qbr_planning' | 'custom';
export type MeetingPrepStatus = 'scheduled' | 'generated' | 'sent' | 'in_progress' | 'completed';
export type TopicPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TemplateSection {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface AgendaItem {
  topic: string;
  duration_minutes: number;
  notes?: string;
  linked_customer_id?: string;
}

export interface MeetingPrepTemplate {
  id: string;
  name: string;
  description?: string;
  meeting_type: MeetingType;
  created_by_user_id?: string;
  sections: TemplateSection[];
  default_agenda: AgendaItem[];
  generate_hours_before: number;
  send_to_attendees: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PrepDocument {
  meeting_title: string;
  meeting_date: string;
  attendees: Array<{ user_id: string; name: string; role?: string }>;
  sections: Array<{
    name: string;
    type: string;
    data: unknown;
  }>;
  suggested_agenda: AgendaItem[];
  previous_action_items: ActionItem[];
}

export interface ScheduledMeetingPrep {
  id: string;
  template_id?: string;
  organizer_user_id?: string;
  meeting_title: string;
  meeting_date: Date;
  calendar_event_id?: string;
  attendees: string[];
  prep_document?: PrepDocument;
  generated_at?: Date;
  agenda: AgendaItem[];
  agenda_finalized: boolean;
  status: MeetingPrepStatus;
  sent_at?: Date;
  meeting_notes?: string;
  action_items: ActionItem[];
  effectiveness_rating?: number;
  skip_recommended: boolean;
  skip_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TopicSubmission {
  id: string;
  meeting_prep_id: string;
  submitted_by_user_id?: string;
  topic: string;
  description?: string;
  customer_id?: string;
  priority: TopicPriority;
  added_to_agenda: boolean;
  submitted_at: Date;
}

export interface ActionItem {
  id: string;
  meeting_prep_id: string;
  description: string;
  owner_user_id?: string;
  customer_id?: string;
  due_date?: Date;
  status: ActionItemStatus;
  completed_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTemplateParams {
  name: string;
  description?: string;
  meeting_type: MeetingType;
  sections: TemplateSection[];
  default_agenda?: AgendaItem[];
  generate_hours_before?: number;
  send_to_attendees?: boolean;
  created_by_user_id?: string;
}

export interface CreateMeetingPrepParams {
  template_id?: string;
  organizer_user_id?: string;
  meeting_title: string;
  meeting_date: Date;
  calendar_event_id?: string;
  attendees: string[];
}

// ============================================
// Service Implementation
// ============================================

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory store for demo mode
const inMemoryTemplates: Map<string, MeetingPrepTemplate> = new Map();
const inMemoryMeetingPreps: Map<string, ScheduledMeetingPrep> = new Map();
const inMemoryTopics: Map<string, TopicSubmission> = new Map();
const inMemoryActionItems: Map<string, ActionItem> = new Map();

// Initialize with default templates for demo mode
function initializeDefaultTemplates() {
  if (inMemoryTemplates.size > 0) return;

  const defaultTemplates: Omit<MeetingPrepTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      name: '1:1 Meeting',
      description: 'Standard template for manager-CSM 1:1 meetings',
      meeting_type: '1on1',
      sections: [
        { name: 'Portfolio Overview', type: 'metrics_summary', config: { metrics: ['health_score_avg', 'arr_total', 'at_risk_count'] } },
        { name: 'Accounts Needing Attention', type: 'accounts_needing_attention', config: { limit: 5 } },
        { name: 'Recent Wins', type: 'recent_wins', config: { days: 7 } },
        { name: 'Open Action Items', type: 'open_action_items', config: {} }
      ],
      default_agenda: [
        { topic: 'Review previous action items', duration_minutes: 5 },
        { topic: 'Portfolio health check', duration_minutes: 10 },
        { topic: 'Accounts needing attention', duration_minutes: 15 },
        { topic: 'Wins and accomplishments', duration_minutes: 5 },
        { topic: 'Development and support needed', duration_minutes: 10 },
        { topic: 'New action items', duration_minutes: 5 }
      ],
      generate_hours_before: 24,
      send_to_attendees: true,
      is_default: true,
      is_active: true,
      created_by_user_id: undefined
    },
    {
      name: 'Team Sync',
      description: 'Weekly team sync meeting for entire CS team',
      meeting_type: 'team_sync',
      sections: [
        { name: 'Team Metrics', type: 'team_metrics', config: { metrics: ['total_arr', 'at_risk_arr', 'renewals_this_month', 'avg_health_score'] } },
        { name: 'Escalations', type: 'open_escalations', config: {} },
        { name: 'Upcoming Renewals', type: 'upcoming_renewals', config: { days: 14 } },
        { name: 'Team Wins', type: 'team_wins', config: { days: 7 } }
      ],
      default_agenda: [
        { topic: 'Metrics review', duration_minutes: 10 },
        { topic: 'Escalation updates', duration_minutes: 10 },
        { topic: 'Renewal pipeline', duration_minutes: 15 },
        { topic: 'Team wins and shoutouts', duration_minutes: 5 },
        { topic: 'Process improvements', duration_minutes: 10 },
        { topic: 'Open floor', duration_minutes: 10 }
      ],
      generate_hours_before: 24,
      send_to_attendees: true,
      is_default: true,
      is_active: true,
      created_by_user_id: undefined
    },
    {
      name: 'Pipeline Review',
      description: 'Renewal pipeline review with leadership',
      meeting_type: 'pipeline_review',
      sections: [
        { name: 'Pipeline Summary', type: 'pipeline_summary', config: { months: 3 } },
        { name: 'At Risk Renewals', type: 'at_risk_renewals', config: {} },
        { name: 'Expansion Opportunities', type: 'expansion_opportunities', config: {} },
        { name: 'Forecast vs Actuals', type: 'forecast_comparison', config: {} }
      ],
      default_agenda: [
        { topic: 'Pipeline overview', duration_minutes: 10 },
        { topic: 'At-risk accounts deep dive', duration_minutes: 20 },
        { topic: 'Expansion opportunities', duration_minutes: 15 },
        { topic: 'Forecast updates', duration_minutes: 10 },
        { topic: 'Resource needs', duration_minutes: 5 }
      ],
      generate_hours_before: 24,
      send_to_attendees: true,
      is_default: true,
      is_active: true,
      created_by_user_id: undefined
    },
    {
      name: 'QBR Planning',
      description: 'Quarterly business review planning session',
      meeting_type: 'qbr_planning',
      sections: [
        { name: 'Quarter Performance', type: 'quarter_metrics', config: {} },
        { name: 'Goal Achievement', type: 'goal_tracking', config: {} },
        { name: 'Customer Feedback Summary', type: 'feedback_summary', config: {} },
        { name: 'Next Quarter Priorities', type: 'strategic_priorities', config: {} }
      ],
      default_agenda: [
        { topic: 'Quarter performance review', duration_minutes: 15 },
        { topic: 'Goal achievement analysis', duration_minutes: 15 },
        { topic: 'Key learnings and feedback', duration_minutes: 15 },
        { topic: 'Next quarter goals', duration_minutes: 20 },
        { topic: 'Resource planning', duration_minutes: 10 },
        { topic: 'Action items', duration_minutes: 5 }
      ],
      generate_hours_before: 24,
      send_to_attendees: true,
      is_default: true,
      is_active: true,
      created_by_user_id: undefined
    }
  ];

  defaultTemplates.forEach(t => {
    const id = uuidv4();
    inMemoryTemplates.set(id, {
      ...t,
      id,
      created_at: new Date(),
      updated_at: new Date()
    });
  });
}

// ============================================
// Template Operations
// ============================================

export async function getTemplates(meetingType?: MeetingType): Promise<MeetingPrepTemplate[]> {
  if (supabase) {
    let query = supabase
      .from('meeting_prep_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

    if (meetingType) {
      query = query.eq('meeting_type', meetingType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Demo mode
  initializeDefaultTemplates();
  let templates = Array.from(inMemoryTemplates.values()).filter(t => t.is_active);
  if (meetingType) {
    templates = templates.filter(t => t.meeting_type === meetingType);
  }
  return templates.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getTemplateById(id: string): Promise<MeetingPrepTemplate | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_prep_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  initializeDefaultTemplates();
  return inMemoryTemplates.get(id) || null;
}

export async function createTemplate(params: CreateTemplateParams): Promise<MeetingPrepTemplate> {
  const template: MeetingPrepTemplate = {
    id: uuidv4(),
    name: params.name,
    description: params.description,
    meeting_type: params.meeting_type,
    sections: params.sections,
    default_agenda: params.default_agenda || [],
    generate_hours_before: params.generate_hours_before ?? 24,
    send_to_attendees: params.send_to_attendees ?? true,
    created_by_user_id: params.created_by_user_id,
    is_default: false,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_prep_templates')
      .insert(template)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  inMemoryTemplates.set(template.id, template);
  return template;
}

export async function updateTemplate(
  id: string,
  updates: Partial<Omit<MeetingPrepTemplate, 'id' | 'created_at'>>
): Promise<MeetingPrepTemplate | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_prep_templates')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  const template = inMemoryTemplates.get(id);
  if (!template) return null;

  const updated = { ...template, ...updates, updated_at: new Date() };
  inMemoryTemplates.set(id, updated);
  return updated;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  if (supabase) {
    // Soft delete
    const { error } = await supabase
      .from('meeting_prep_templates')
      .update({ is_active: false, updated_at: new Date() })
      .eq('id', id);

    return !error;
  }

  const template = inMemoryTemplates.get(id);
  if (!template) return false;
  template.is_active = false;
  return true;
}

// ============================================
// Meeting Prep Operations
// ============================================

export async function getMeetingPreps(
  userId?: string,
  options?: { status?: MeetingPrepStatus; upcoming?: boolean; limit?: number }
): Promise<ScheduledMeetingPrep[]> {
  if (supabase) {
    let query = supabase
      .from('scheduled_meeting_preps')
      .select('*')
      .order('meeting_date', { ascending: true });

    if (userId) {
      query = query.or(`organizer_user_id.eq.${userId},attendees.cs.{${userId}}`);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.upcoming) {
      query = query.gte('meeting_date', new Date().toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Demo mode
  let preps = Array.from(inMemoryMeetingPreps.values());
  if (userId) {
    preps = preps.filter(p => p.organizer_user_id === userId || p.attendees.includes(userId));
  }
  if (options?.status) {
    preps = preps.filter(p => p.status === options.status);
  }
  if (options?.upcoming) {
    preps = preps.filter(p => new Date(p.meeting_date) >= new Date());
  }
  preps.sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());
  if (options?.limit) {
    preps = preps.slice(0, options.limit);
  }
  return preps;
}

export async function getMeetingPrepById(id: string): Promise<ScheduledMeetingPrep | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('scheduled_meeting_preps')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  return inMemoryMeetingPreps.get(id) || null;
}

export async function createMeetingPrep(params: CreateMeetingPrepParams): Promise<ScheduledMeetingPrep> {
  // Get template if provided
  let agenda: AgendaItem[] = [];
  if (params.template_id) {
    const template = await getTemplateById(params.template_id);
    if (template) {
      agenda = template.default_agenda;
    }
  }

  const prep: ScheduledMeetingPrep = {
    id: uuidv4(),
    template_id: params.template_id,
    organizer_user_id: params.organizer_user_id,
    meeting_title: params.meeting_title,
    meeting_date: params.meeting_date,
    calendar_event_id: params.calendar_event_id,
    attendees: params.attendees,
    prep_document: undefined,
    generated_at: undefined,
    agenda,
    agenda_finalized: false,
    status: 'scheduled',
    sent_at: undefined,
    meeting_notes: undefined,
    action_items: [],
    effectiveness_rating: undefined,
    skip_recommended: false,
    skip_reason: undefined,
    created_at: new Date(),
    updated_at: new Date()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('scheduled_meeting_preps')
      .insert(prep)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  inMemoryMeetingPreps.set(prep.id, prep);
  return prep;
}

export async function updateMeetingPrep(
  id: string,
  updates: Partial<Omit<ScheduledMeetingPrep, 'id' | 'created_at'>>
): Promise<ScheduledMeetingPrep | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('scheduled_meeting_preps')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  const prep = inMemoryMeetingPreps.get(id);
  if (!prep) return null;

  const updated = { ...prep, ...updates, updated_at: new Date() };
  inMemoryMeetingPreps.set(id, updated);
  return updated;
}

export async function deleteMeetingPrep(id: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('scheduled_meeting_preps')
      .delete()
      .eq('id', id);

    return !error;
  }

  return inMemoryMeetingPreps.delete(id);
}

// ============================================
// Prep Document Generation
// ============================================

export async function generatePrepDocument(prepId: string): Promise<ScheduledMeetingPrep | null> {
  const prep = await getMeetingPrepById(prepId);
  if (!prep) return null;

  const template = prep.template_id ? await getTemplateById(prep.template_id) : null;
  const sections: PrepDocument['sections'] = [];

  // Generate sections based on template
  if (template) {
    for (const sectionConfig of template.sections) {
      const sectionData = await generateSectionData(sectionConfig, prep.attendees);
      sections.push({
        name: sectionConfig.name,
        type: sectionConfig.type,
        data: sectionData
      });
    }
  }

  // Get previous action items
  const previousActionItems = await getOpenActionItemsForAttendees(prep.attendees);

  // Get topic submissions
  const topicSubmissions = await getTopicSubmissions(prepId);
  const submittedAgendaItems: AgendaItem[] = topicSubmissions
    .filter(t => !t.added_to_agenda)
    .map(t => ({
      topic: t.topic,
      duration_minutes: 5,
      notes: t.description,
      linked_customer_id: t.customer_id
    }));

  const prepDocument: PrepDocument = {
    meeting_title: prep.meeting_title,
    meeting_date: prep.meeting_date.toISOString(),
    attendees: prep.attendees.map(uid => ({ user_id: uid, name: `User ${uid.slice(0, 8)}` })),
    sections,
    suggested_agenda: [...prep.agenda, ...submittedAgendaItems],
    previous_action_items: previousActionItems
  };

  return updateMeetingPrep(prepId, {
    prep_document: prepDocument,
    generated_at: new Date(),
    status: 'generated'
  });
}

async function generateSectionData(
  sectionConfig: TemplateSection,
  attendeeIds: string[]
): Promise<unknown> {
  // Generate demo data based on section type
  switch (sectionConfig.type) {
    case 'metrics_summary':
      return {
        health_score_avg: 75,
        arr_total: 2500000,
        at_risk_count: 3,
        total_customers: 45,
        renewals_this_month: 8
      };

    case 'accounts_needing_attention':
      return [
        { customer_name: 'Acme Corp', health_score: 45, risk_reason: 'Low engagement', arr: 150000 },
        { customer_name: 'TechStart Inc', health_score: 52, risk_reason: 'Support escalation', arr: 85000 },
        { customer_name: 'Global Solutions', health_score: 58, risk_reason: 'Renewal in 30 days', arr: 220000 }
      ];

    case 'recent_wins':
      return [
        { customer_name: 'DataDrive LLC', win_type: 'Expansion', details: 'Added 50 seats', date: new Date().toISOString() },
        { customer_name: 'CloudFirst', win_type: 'Renewal', details: 'Multi-year renewal signed', date: new Date().toISOString() }
      ];

    case 'open_escalations':
      return [
        { customer_name: 'Enterprise Co', severity: 'high', description: 'Integration issue affecting reports', days_open: 5 }
      ];

    case 'upcoming_renewals':
      const days = (sectionConfig.config?.days as number) || 30;
      return [
        { customer_name: 'FastGrow Inc', renewal_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), arr: 125000, health_score: 82 },
        { customer_name: 'SmartTech', renewal_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), arr: 95000, health_score: 68 }
      ];

    case 'team_metrics':
      return {
        total_arr: 5200000,
        at_risk_arr: 450000,
        renewals_this_month: 12,
        avg_health_score: 72,
        nps_score: 42
      };

    case 'team_wins':
      return [
        { csm_name: 'Sarah Chen', win: 'Closed $500K expansion with Enterprise Co' },
        { csm_name: 'Mike Johnson', win: 'Successfully saved at-risk renewal worth $200K' }
      ];

    case 'pipeline_summary':
      return {
        total_pipeline: 8500000,
        at_risk: 1200000,
        on_track: 6800000,
        expansion_pipeline: 500000,
        months: sectionConfig.config?.months || 3
      };

    case 'at_risk_renewals':
      return [
        { customer_name: 'Legacy Systems', arr: 350000, risk_level: 'high', main_concern: 'Champion departed' },
        { customer_name: 'Regional Bank', arr: 180000, risk_level: 'medium', main_concern: 'Budget constraints' }
      ];

    case 'expansion_opportunities':
      return [
        { customer_name: 'Growing Startup', current_arr: 50000, opportunity: 150000, product: 'Enterprise Tier', probability: 0.7 },
        { customer_name: 'Scale Corp', current_arr: 200000, opportunity: 100000, product: 'Add-on Module', probability: 0.85 }
      ];

    default:
      return {};
  }
}

// ============================================
// Topic Submissions
// ============================================

export async function getTopicSubmissions(meetingPrepId: string): Promise<TopicSubmission[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_topic_submissions')
      .select('*')
      .eq('meeting_prep_id', meetingPrepId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  return Array.from(inMemoryTopics.values())
    .filter(t => t.meeting_prep_id === meetingPrepId)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
}

export async function submitTopic(
  meetingPrepId: string,
  topic: string,
  options?: {
    submitted_by_user_id?: string;
    description?: string;
    customer_id?: string;
    priority?: TopicPriority;
  }
): Promise<TopicSubmission> {
  const submission: TopicSubmission = {
    id: uuidv4(),
    meeting_prep_id: meetingPrepId,
    submitted_by_user_id: options?.submitted_by_user_id,
    topic,
    description: options?.description,
    customer_id: options?.customer_id,
    priority: options?.priority || 'normal',
    added_to_agenda: false,
    submitted_at: new Date()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_topic_submissions')
      .insert(submission)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  inMemoryTopics.set(submission.id, submission);
  return submission;
}

export async function deleteTopicSubmission(id: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('meeting_topic_submissions')
      .delete()
      .eq('id', id);

    return !error;
  }

  return inMemoryTopics.delete(id);
}

// ============================================
// Action Items
// ============================================

export async function createActionItem(
  meetingPrepId: string,
  description: string,
  options?: {
    owner_user_id?: string;
    customer_id?: string;
    due_date?: Date;
  }
): Promise<ActionItem> {
  const actionItem: ActionItem = {
    id: uuidv4(),
    meeting_prep_id: meetingPrepId,
    description,
    owner_user_id: options?.owner_user_id,
    customer_id: options?.customer_id,
    due_date: options?.due_date,
    status: 'pending',
    completed_at: undefined,
    notes: undefined,
    created_at: new Date(),
    updated_at: new Date()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .insert(actionItem)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  inMemoryActionItems.set(actionItem.id, actionItem);
  return actionItem;
}

export async function getActionItems(
  meetingPrepId?: string,
  options?: { status?: ActionItemStatus; owner_user_id?: string }
): Promise<ActionItem[]> {
  if (supabase) {
    let query = supabase
      .from('meeting_action_items')
      .select('*')
      .order('due_date', { ascending: true });

    if (meetingPrepId) {
      query = query.eq('meeting_prep_id', meetingPrepId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.owner_user_id) {
      query = query.eq('owner_user_id', options.owner_user_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  let items = Array.from(inMemoryActionItems.values());
  if (meetingPrepId) {
    items = items.filter(i => i.meeting_prep_id === meetingPrepId);
  }
  if (options?.status) {
    items = items.filter(i => i.status === options.status);
  }
  if (options?.owner_user_id) {
    items = items.filter(i => i.owner_user_id === options.owner_user_id);
  }
  return items.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}

export async function updateActionItem(
  id: string,
  updates: Partial<Omit<ActionItem, 'id' | 'meeting_prep_id' | 'created_at'>>
): Promise<ActionItem | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  const item = inMemoryActionItems.get(id);
  if (!item) return null;

  const updated = { ...item, ...updates, updated_at: new Date() };
  inMemoryActionItems.set(id, updated);
  return updated;
}

export async function completeActionItem(id: string): Promise<ActionItem | null> {
  return updateActionItem(id, {
    status: 'completed',
    completed_at: new Date()
  });
}

async function getOpenActionItemsForAttendees(attendeeIds: string[]): Promise<ActionItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .select('*')
      .in('owner_user_id', attendeeIds)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    if (error) return [];
    return data || [];
  }

  return Array.from(inMemoryActionItems.values())
    .filter(i => i.status === 'pending' && attendeeIds.includes(i.owner_user_id || ''))
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
}

// ============================================
// Meeting Completion
// ============================================

export async function completeMeeting(
  prepId: string,
  options?: {
    notes?: string;
    effectiveness_rating?: number;
    action_items?: Array<{
      description: string;
      owner_user_id?: string;
      customer_id?: string;
      due_date?: Date;
    }>;
  }
): Promise<ScheduledMeetingPrep | null> {
  // Create action items
  if (options?.action_items) {
    for (const item of options.action_items) {
      await createActionItem(prepId, item.description, {
        owner_user_id: item.owner_user_id,
        customer_id: item.customer_id,
        due_date: item.due_date
      });
    }
  }

  return updateMeetingPrep(prepId, {
    status: 'completed',
    meeting_notes: options?.notes,
    effectiveness_rating: options?.effectiveness_rating
  });
}

// ============================================
// Export Service
// ============================================

export const templateLibraryService = {
  // Templates
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,

  // Meeting Preps
  getMeetingPreps,
  getMeetingPrepById,
  createMeetingPrep,
  updateMeetingPrep,
  deleteMeetingPrep,
  generatePrepDocument,
  completeMeeting,

  // Topics
  getTopicSubmissions,
  submitTopic,
  deleteTopicSubmission,

  // Action Items
  createActionItem,
  getActionItems,
  updateActionItem,
  completeActionItem
};

export default templateLibraryService;
