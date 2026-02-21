/**
 * Context Aggregation Engine
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Orchestrates gathering context from all data sources:
 * - Knowledge base (playbooks, templates, best practices)
 * - Platform data (customer 360, health, engagement, risk)
 * - External sources (Drive, Gmail, Calendar)
 */

import {
  TaskType,
  AggregatedContext,
  PlaybookMatch,
  TemplateMatch,
  BestPracticeMatch,
  Customer360,
  HealthTrend,
  EngagementMetrics,
  RiskSignal,
  Interaction,
  RenewalForecast,
  DriveDocument,
  EmailThread,
  CalendarEvent,
  PreviousArtifact,
} from './types.js';

import { knowledgeService } from '../knowledge.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// Task-specific search keywords
const TASK_KEYWORDS: Record<TaskType, string[]> = {
  // Onboarding Specialist Cards
  kickoff_plan: ['kickoff', 'kick-off', 'onboarding', 'welcome', 'start', 'implementation', 'launch'],
  milestone_plan: ['30-60-90', 'milestone', 'timeline', 'phases', 'onboarding plan', 'implementation'],
  stakeholder_map: ['stakeholder', 'contacts', 'org chart', 'decision maker', 'champion', 'sponsor'],
  training_schedule: ['training', 'schedule', 'sessions', 'learning', 'enablement', 'workshops'],
  // Adoption Specialist Cards
  usage_analysis: ['usage', 'adoption', 'metrics', 'analytics', 'engagement', 'product usage'],
  feature_campaign: ['feature', 'campaign', 'adoption', 'rollout', 'enablement', 'activation'],
  champion_development: ['champion', 'advocate', 'power user', 'super user', 'internal champion'],
  training_program: ['training program', 'curriculum', 'learning path', 'certification', 'modules'],
  // Renewal Specialist Cards
  renewal_forecast: ['renewal', 'forecast', 'prediction', 'probability', 'likelihood', 'renewal risk'],
  value_summary: ['value', 'roi', 'impact', 'outcomes', 'results', 'success', 'benefits'],
  expansion_proposal: ['expansion', 'upsell', 'cross-sell', 'growth', 'upgrade', 'proposal'],
  negotiation_brief: ['negotiation', 'pricing', 'terms', 'contract', 'leverage', 'counter'],
  // Risk Specialist Cards
  risk_assessment: ['risk', 'churn', 'warning signs', 'mitigation', 'assessment', 'health'],
  save_play: ['save', 'retention', 'churn prevention', 'rescue', 'turnaround', 'recovery'],
  escalation_report: ['escalation', 'issue', 'problem', 'critical', 'urgent', 'resolution'],
  resolution_plan: ['resolution', 'action plan', 'fix', 'remediation', 'improvement', 'corrective'],
  // Strategic CSM Cards
  qbr_generation: ['qbr', 'quarterly business review', 'business review', 'executive summary', 'metrics review'],
  executive_briefing: ['executive', 'briefing', 'summary', 'leadership', 'c-suite', 'board'],
  account_plan: ['account plan', 'strategy', 'objectives', 'goals', 'roadmap', 'strategic'],
  transformation_roadmap: ['transformation', 'roadmap', 'digital', 'change', 'evolution', 'journey'],
  // General Mode Cards (portfolio-level)
  portfolio_dashboard: ['portfolio', 'dashboard', 'overview', 'book of business', 'all customers'],
  team_metrics: ['team', 'metrics', 'performance', 'kpi', 'csm metrics', 'team performance'],
  renewal_pipeline: ['pipeline', 'renewals', 'upcoming', 'forecast', 'renewal calendar'],
  at_risk_overview: ['at risk', 'risk overview', 'churn risk', 'health', 'portfolio health'],
  // Legacy/existing types
  data_analysis: ['analysis', 'metrics', 'trends', 'data', 'reporting', 'insights'],
  presentation_creation: ['presentation', 'deck', 'slides', 'executive briefing'],
  document_creation: ['document', 'plan', 'proposal', 'summary', 'report'],
  email_drafting: ['email', 'communication', 'outreach', 'follow-up', 'message'],
  meeting_prep: ['meeting prep', 'agenda', 'talking points', 'pre-meeting', 'call prep'],
  transcription_summary: ['meeting notes', 'summary', 'transcript', 'action items', 'recap'],
  health_analysis: ['health score', 'health analysis', 'risk', 'churn', 'engagement'],
  expansion_planning: ['expansion', 'upsell', 'cross-sell', 'growth', 'opportunity'],
  custom: [],
};

/**
 * Aggregates context from all data sources for a task
 */
export async function aggregateContext(params: {
  taskType: TaskType;
  customerId: string | null;
  userQuery: string;
  userId: string;
  organizationId?: string | null;
}): Promise<AggregatedContext> {
  const { taskType, customerId, userQuery, userId, organizationId } = params;
  const startTime = Date.now();
  const sourcesSearched: string[] = [];
  const relevanceScores: Record<string, number> = {};

  // Run all context gathering in parallel
  const [
    knowledgeResults,
    platformData,
    externalSources,
  ] = await Promise.all([
    gatherKnowledgeContext(taskType, userQuery, userId, customerId),
    customerId ? gatherPlatformData(customerId, userId, organizationId) : getEmptyPlatformData(),
    customerId ? gatherExternalSources(customerId, userId, taskType, organizationId) : getEmptyExternalSources(),
  ]);

  // Track sources searched
  sourcesSearched.push('knowledge_base', 'customer_database');
  if (customerId) {
    sourcesSearched.push('google_drive', 'gmail', 'google_calendar', 'artifacts');
  }

  // Calculate relevance scores
  for (const playbook of knowledgeResults.playbooks) {
    relevanceScores[`playbook:${playbook.id}`] = playbook.relevanceScore;
  }
  for (const template of knowledgeResults.templates) {
    relevanceScores[`template:${template.id}`] = template.relevanceScore;
  }

  const gatheringDurationMs = Date.now() - startTime;

  return {
    knowledge: knowledgeResults,
    platformData,
    externalSources,
    metadata: {
      sourcesSearched,
      relevanceScores,
      gatheringDurationMs,
    },
  };
}

/**
 * Gathers knowledge base context (playbooks, templates, best practices)
 */
async function gatherKnowledgeContext(
  taskType: TaskType,
  userQuery: string,
  userId: string,
  customerId: string | null
): Promise<{
  playbooks: PlaybookMatch[];
  templates: TemplateMatch[];
  bestPractices: BestPracticeMatch[];
}> {
  const keywords = TASK_KEYWORDS[taskType] || [];
  const searchQuery = `${userQuery} ${keywords.join(' ')}`;

  // Search for playbooks
  const playbookResults = await searchKnowledge(searchQuery, {
    category: 'playbooks',
    userId,
    customerId,
    limit: 5,
  });

  // Search for templates
  const templateResults = await searchKnowledge(`${taskType} template ${userQuery}`, {
    category: 'templates',
    userId,
    customerId,
    limit: 3,
  });

  // Search for best practices
  const bestPracticeResults = await searchKnowledge(searchQuery, {
    category: 'best-practices',
    userId,
    customerId,
    limit: 5,
  });

  return {
    playbooks: playbookResults.map(r => ({
      id: r.id,
      title: r.documentTitle,
      content: r.content,
      relevanceScore: r.similarity,
      category: r.metadata?.category || 'playbooks',
    })),
    templates: templateResults.map(r => ({
      id: r.id,
      name: r.documentTitle,
      format: r.metadata?.format || 'text',
      relevanceScore: r.similarity,
    })),
    bestPractices: bestPracticeResults.map(r => ({
      id: r.id,
      title: r.documentTitle,
      content: r.content,
      relevanceScore: r.similarity,
    })),
  };
}

/**
 * Wrapper for knowledge service search
 */
async function searchKnowledge(
  query: string,
  options: {
    category?: string;
    userId: string;
    customerId: string | null;
    limit?: number;
  }
): Promise<any[]> {
  try {
    const results = await knowledgeService.search(query, {
      limit: options.limit || 5,
      threshold: 0.5,
      category: options.category,
      userId: options.userId,
      customerId: options.customerId || undefined,
    });
    return results;
  } catch (error) {
    console.error('[contextAggregator] Knowledge search error:', error);
    return [];
  }
}

/**
 * Gathers platform data (customer 360, health, engagement, etc.)
 */
async function gatherPlatformData(
  customerId: string,
  userId: string,
  organizationId?: string | null
): Promise<AggregatedContext['platformData']> {
  if (!supabase) {
    return getEmptyPlatformData();
  }

  // Build org-filtered queries
  let customerQuery = supabase.from('customers').select('*').eq('id', customerId);
  if (organizationId) customerQuery = customerQuery.eq('organization_id', organizationId);

  let healthQuery = supabase.from('health_scores')
    .select('*')
    .eq('customer_id', customerId)
    .order('recorded_at', { ascending: false })
    .limit(90);
  if (organizationId) healthQuery = healthQuery.eq('organization_id', organizationId);

  let activityQuery = supabase.from('agent_activity_log')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (organizationId) activityQuery = activityQuery.eq('organization_id', organizationId);

  // Fetch all platform data in parallel
  const [
    customerResult,
    healthResult,
    activitiesResult,
  ] = await Promise.all([
    customerQuery.single(),
    healthQuery,
    activityQuery,
  ]);

  const customer = customerResult.data;
  const healthScores = healthResult.data || [];
  const activities = activitiesResult.data || [];

  // Build customer 360
  const customer360: Customer360 | null = customer ? {
    id: customer.id,
    name: customer.name,
    arr: customer.arr || 0,
    tier: customer.tier || determineTier(customer.arr),
    status: customer.status || 'active',
    healthScore: customer.health_score || 0,
    npsScore: customer.nps_score,
    industryCode: customer.industry,
    renewalDate: customer.renewal_date,
  } : null;

  // Build health trends
  const healthTrends: HealthTrend[] = healthScores.map(h => ({
    date: h.recorded_at,
    score: h.score,
    components: h.components || {},
  }));

  // Build engagement metrics
  const engagementMetrics: EngagementMetrics | null = customer ? {
    dauMau: customer.dau_mau || 0,
    featureAdoption: customer.product_adoption || 0,
    loginFrequency: customer.login_frequency || 0,
    lastActivityDays: customer.last_activity_days || 0,
  } : null;

  // Build risk signals
  const riskSignals: RiskSignal[] = generateRiskSignals(customer);

  // Build interaction history
  const interactionHistory: Interaction[] = activities.map(a => ({
    id: a.id,
    type: mapActivityType(a.action_type),
    date: a.created_at,
    summary: a.action_data?.summary || a.action_type,
    participants: a.action_data?.participants || [],
    outcome: a.result_data?.status,
  }));

  // Build renewal forecast
  const renewalForecast: RenewalForecast | null = customer?.renewal_date ? {
    probability: calculateRenewalProbability(customer),
    expansionPotential: customer.expansion_potential || 0,
    riskFactors: riskSignals.map(r => r.description),
    recommendedActions: generateRecommendedActions(customer, riskSignals),
    daysUntilRenewal: Math.floor(
      (new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
  } : null;

  return {
    customer360,
    healthTrends,
    engagementMetrics,
    riskSignals,
    interactionHistory,
    renewalForecast,
  };
}

/**
 * Gathers external sources (Drive, Gmail, Calendar)
 */
async function gatherExternalSources(
  customerId: string,
  userId: string,
  taskType: TaskType,
  organizationId?: string | null
): Promise<AggregatedContext['externalSources']> {
  // Fetch previous artifacts from database
  const previousArtifacts = await fetchPreviousArtifacts(customerId, taskType, organizationId);

  // Note: In production, these would call Google APIs via the workspace service
  // For now, we return empty arrays as placeholders
  const driveDocuments: DriveDocument[] = [];
  const emailThreads: EmailThread[] = [];
  const calendarEvents: CalendarEvent[] = [];

  return {
    driveDocuments,
    emailThreads,
    calendarEvents,
    previousArtifacts,
  };
}

/**
 * Fetches previous artifacts for this customer
 */
async function fetchPreviousArtifacts(
  customerId: string,
  taskType: TaskType,
  organizationId?: string | null
): Promise<PreviousArtifact[]> {
  if (!supabase) {
    return [];
  }

  try {
    let query = supabase
      .from('generated_artifacts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query
      .limit(10);

    if (error || !data) {
      return [];
    }

    return data.map(a => ({
      id: a.id,
      type: a.artifact_type,
      title: a.title,
      createdAt: a.created_at,
      driveUrl: a.drive_url,
    }));
  } catch (error) {
    console.error('[contextAggregator] Error fetching artifacts:', error);
    return [];
  }
}

/**
 * Helper functions
 */

function getEmptyPlatformData(): AggregatedContext['platformData'] {
  return {
    customer360: null,
    healthTrends: [],
    engagementMetrics: null,
    riskSignals: [],
    interactionHistory: [],
    renewalForecast: null,
  };
}

function getEmptyExternalSources(): AggregatedContext['externalSources'] {
  return {
    driveDocuments: [],
    emailThreads: [],
    calendarEvents: [],
    previousArtifacts: [],
  };
}

function determineTier(arr: number): string {
  if (arr >= 500000) return 'enterprise';
  if (arr >= 200000) return 'strategic';
  if (arr >= 50000) return 'commercial';
  return 'smb';
}

function generateRiskSignals(customer: any): RiskSignal[] {
  if (!customer) return [];

  const signals: RiskSignal[] = [];
  const now = new Date();

  // Health score risk
  if (customer.health_score < 40) {
    signals.push({
      type: 'churn',
      severity: 'critical',
      description: `Health score critically low at ${customer.health_score}%`,
      detectedAt: now.toISOString(),
      recommendation: 'Immediate executive escalation and intervention',
    });
  } else if (customer.health_score < 60) {
    signals.push({
      type: 'churn',
      severity: 'high',
      description: `Health score concerning at ${customer.health_score}%`,
      detectedAt: now.toISOString(),
      recommendation: 'Schedule strategic review with stakeholders',
    });
  }

  // Engagement risk
  if (customer.last_activity_days > 14) {
    signals.push({
      type: 'engagement',
      severity: customer.last_activity_days > 30 ? 'high' : 'medium',
      description: `No activity in ${customer.last_activity_days} days`,
      detectedAt: now.toISOString(),
      recommendation: 'Proactive outreach to understand situation',
    });
  }

  // Sentiment risk (NPS)
  if (customer.nps_score !== undefined && customer.nps_score < 0) {
    signals.push({
      type: 'sentiment',
      severity: customer.nps_score < -30 ? 'critical' : 'high',
      description: `Negative NPS score: ${customer.nps_score}`,
      detectedAt: now.toISOString(),
      recommendation: 'Address feedback and rebuild relationship',
    });
  }

  // Support risk
  if (customer.open_tickets > 3) {
    signals.push({
      type: 'support',
      severity: customer.open_tickets > 5 ? 'high' : 'medium',
      description: `${customer.open_tickets} open support tickets`,
      detectedAt: now.toISOString(),
      recommendation: 'Coordinate with support for resolution',
    });
  }

  // Payment risk
  if (customer.payment_status === 'overdue') {
    signals.push({
      type: 'payment',
      severity: 'high',
      description: 'Payment is overdue',
      detectedAt: now.toISOString(),
      recommendation: 'Coordinate with finance on collections',
    });
  }

  return signals;
}

function mapActivityType(actionType: string): Interaction['type'] {
  const mapping: Record<string, Interaction['type']> = {
    'send_email': 'email',
    'draft_email': 'email',
    'book_meeting': 'meeting',
    'create_meeting': 'meeting',
    'support_ticket': 'ticket',
    'call': 'call',
    'internal_note': 'note',
  };
  return mapping[actionType] || 'note';
}

function calculateRenewalProbability(customer: any): number {
  let probability = 70; // Base probability

  // Health score impact
  if (customer.health_score >= 80) probability += 15;
  else if (customer.health_score >= 60) probability += 5;
  else if (customer.health_score < 40) probability -= 30;
  else probability -= 15;

  // NPS impact
  if (customer.nps_score !== undefined) {
    if (customer.nps_score >= 50) probability += 10;
    else if (customer.nps_score < 0) probability -= 20;
  }

  // Engagement impact
  if (customer.last_activity_days > 30) probability -= 15;
  else if (customer.last_activity_days <= 7) probability += 5;

  return Math.max(0, Math.min(100, probability));
}

function generateRecommendedActions(customer: any, risks: RiskSignal[]): string[] {
  const actions: string[] = [];

  if (risks.some(r => r.type === 'churn' && r.severity === 'critical')) {
    actions.push('Schedule executive sponsor call within 48 hours');
    actions.push('Create save play with specific value proposition');
  }

  if (risks.some(r => r.type === 'engagement')) {
    actions.push('Send personalized check-in email');
    actions.push('Review product usage data for drop-off points');
  }

  if (risks.some(r => r.type === 'sentiment')) {
    actions.push('Address NPS feedback directly');
    actions.push('Create action plan for top concerns');
  }

  if (risks.length === 0 && customer.health_score >= 80) {
    actions.push('Explore expansion opportunities');
    actions.push('Request referral or case study participation');
  }

  return actions.length > 0 ? actions : ['Continue regular engagement cadence'];
}

export const contextAggregator = {
  aggregateContext,
};
