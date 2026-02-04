/**
 * Data Aggregation Helpers
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Shared helper functions for aggregating customer data from multiple sources.
 * Used by all CADG generators to ensure consistent data access patterns.
 */

import {
  TaskType,
  AggregatedContext,
  Customer360,
  HealthTrend,
  EngagementMetrics,
  RiskSignal,
  Interaction,
  RenewalForecast,
  PlaybookMatch,
  ArtifactType,
} from './types.js';

import { knowledgeService } from '../knowledge.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================================================
// Types for Data Helpers
// ============================================================================

/**
 * Aggregated customer context for document generation
 */
export interface CustomerContext {
  customer360: Customer360;
  healthTrends: HealthTrend[];
  engagementMetrics: EngagementMetrics;
  riskSignals: RiskSignal[];
  interactionHistory: Interaction[];
  renewalForecast: RenewalForecast | null;
  stakeholders: Stakeholder[];
  contracts: ContractInfo[];
}

/**
 * Stakeholder information for stakeholder maps and communications
 */
export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  role: 'champion' | 'sponsor' | 'blocker' | 'evaluator' | 'user' | 'executive';
  influenceLevel: 'high' | 'medium' | 'low';
  engagementLevel: 'high' | 'medium' | 'low';
  lastContactDate?: string;
  notes?: string;
}

/**
 * Contract information for renewal and negotiation
 */
export interface ContractInfo {
  id: string;
  startDate: string;
  endDate: string;
  value: number;
  terms?: string;
  autoRenew: boolean;
  paymentTerms?: string;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
}

/**
 * Portfolio-level context for General Mode cards
 */
export interface PortfolioContext {
  totalCustomers: number;
  totalArr: number;
  healthDistribution: {
    healthy: number;
    atRisk: number;
    critical: number;
  };
  renewalPipeline: RenewalPipelineItem[];
  atRiskCustomers: AtRiskCustomer[];
  teamMetrics: TeamMetrics;
  csms: CSMInfo[];
}

/**
 * Renewal pipeline item for portfolio views
 */
export interface RenewalPipelineItem {
  customerId: string;
  customerName: string;
  arr: number;
  renewalDate: string;
  daysUntilRenewal: number;
  probability: number;
  owner: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * At-risk customer summary
 */
export interface AtRiskCustomer {
  customerId: string;
  customerName: string;
  arr: number;
  healthScore: number;
  riskLevel: 'medium' | 'high' | 'critical';
  primaryRiskFactor: string;
  owner: string;
  hasSavePlay: boolean;
}

/**
 * Team-level metrics
 */
export interface TeamMetrics {
  avgHealthScore: number;
  avgNps: number;
  renewalRate: number;
  expansionRate: number;
  churnRate: number;
  openTickets: number;
  activitiesThisWeek: number;
}

/**
 * CSM information for team views
 */
export interface CSMInfo {
  id: string;
  name: string;
  email: string;
  customerCount: number;
  totalArr: number;
  avgHealthScore: number;
}

/**
 * Playbook type for filtering
 */
export type PlaybookType =
  | 'onboarding'
  | 'adoption'
  | 'renewal'
  | 'risk'
  | 'expansion'
  | 'qbr'
  | 'escalation'
  | 'save_play'
  | 'training'
  | 'communication';

/**
 * Document data structure for Google Workspace
 */
export interface DocumentData {
  title: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
}

/**
 * Document section for Google Docs/Slides
 */
export interface DocumentSection {
  heading: string;
  content: string;
  style?: 'title' | 'subtitle' | 'heading1' | 'heading2' | 'heading3' | 'body' | 'bullet';
  data?: Record<string, unknown>;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  createdAt: string;
  createdBy: string;
  customerId?: string;
  customerName?: string;
  taskType: TaskType;
  sourcesUsed: string[];
}

// ============================================================================
// Customer Context Aggregation
// ============================================================================

/**
 * Aggregates comprehensive customer context from all data sources
 * This is the main helper for customer-specific CADG cards
 */
export async function aggregateCustomerContext(params: {
  customerId: string;
  userId: string;
  includeStakeholders?: boolean;
  includeContracts?: boolean;
  healthTrendDays?: number;
  interactionLimit?: number;
}): Promise<CustomerContext> {
  const {
    customerId,
    userId,
    includeStakeholders = true,
    includeContracts = true,
    healthTrendDays = 90,
    interactionLimit = 50,
  } = params;

  if (!supabase) {
    return getEmptyCustomerContext();
  }

  // Fetch all data in parallel
  const [
    customerResult,
    healthResult,
    activitiesResult,
    stakeholdersResult,
    contractsResult,
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('health_scores')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false })
      .limit(healthTrendDays),
    supabase.from('agent_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(interactionLimit),
    includeStakeholders
      ? supabase.from('customer_contacts')
          .select('*')
          .eq('customer_id', customerId)
          .order('influence_level', { ascending: false })
      : Promise.resolve({ data: null }),
    includeContracts
      ? supabase.from('contracts')
          .select('*')
          .eq('customer_id', customerId)
          .order('end_date', { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const customer = customerResult.data;
  const healthScores = healthResult.data || [];
  const activities = activitiesResult.data || [];
  const stakeholdersData = stakeholdersResult.data || [];
  const contractsData = contractsResult.data || [];

  // Build customer 360
  const customer360: Customer360 = customer ? {
    id: customer.id,
    name: customer.name,
    arr: customer.arr || 0,
    tier: customer.tier || determineTier(customer.arr),
    status: customer.status || 'active',
    healthScore: customer.health_score || 0,
    npsScore: customer.nps_score,
    industryCode: customer.industry,
    renewalDate: customer.renewal_date,
  } : getEmptyCustomer360(customerId);

  // Build health trends
  const healthTrends: HealthTrend[] = healthScores.map(h => ({
    date: h.recorded_at,
    score: h.score,
    components: h.components || {},
  }));

  // Build engagement metrics
  const engagementMetrics: EngagementMetrics = customer ? {
    dauMau: customer.dau_mau || 0,
    featureAdoption: customer.product_adoption || 0,
    loginFrequency: customer.login_frequency || 0,
    lastActivityDays: customer.last_activity_days || 0,
  } : getEmptyEngagementMetrics();

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

  // Build stakeholders
  const stakeholders: Stakeholder[] = stakeholdersData.map(s => ({
    id: s.id,
    name: s.name,
    title: s.title || '',
    email: s.email || '',
    phone: s.phone,
    role: mapStakeholderRole(s.role),
    influenceLevel: mapLevel(s.influence_level),
    engagementLevel: mapLevel(s.engagement_level),
    lastContactDate: s.last_contact_date,
    notes: s.notes,
  }));

  // Build contracts
  const contracts: ContractInfo[] = contractsData.map(c => ({
    id: c.id,
    startDate: c.start_date,
    endDate: c.end_date,
    value: c.total_value || 0,
    terms: c.terms,
    autoRenew: c.auto_renew || false,
    paymentTerms: c.payment_terms,
    status: c.status || 'active',
  }));

  return {
    customer360,
    healthTrends,
    engagementMetrics,
    riskSignals,
    interactionHistory,
    renewalForecast,
    stakeholders,
    contracts,
  };
}

// ============================================================================
// Portfolio Context Aggregation (General Mode)
// ============================================================================

/**
 * Aggregates portfolio-level context for General Mode cards
 * Works without a specific customer - uses userId to get all assigned customers
 */
export async function aggregatePortfolioContext(params: {
  userId: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  healthFilter?: ('healthy' | 'atRisk' | 'critical')[];
  ownerFilter?: string[];
}): Promise<PortfolioContext> {
  const {
    userId,
    dateRangeStart,
    dateRangeEnd,
    healthFilter,
    ownerFilter,
  } = params;

  if (!supabase) {
    return getEmptyPortfolioContext();
  }

  // Build customer query with filters
  let customerQuery = supabase
    .from('customers')
    .select('*');

  // Filter by owner if not admin (would need role check in production)
  if (ownerFilter && ownerFilter.length > 0) {
    customerQuery = customerQuery.in('owner_id', ownerFilter);
  }

  const { data: customers, error: customersError } = await customerQuery;

  if (customersError || !customers) {
    console.error('[dataHelpers] Portfolio query error:', customersError);
    return getEmptyPortfolioContext();
  }

  // Apply health filter if specified
  let filteredCustomers = customers;
  if (healthFilter && healthFilter.length > 0) {
    filteredCustomers = customers.filter(c => {
      const health = c.health_score || 0;
      if (healthFilter.includes('healthy') && health >= 70) return true;
      if (healthFilter.includes('atRisk') && health >= 40 && health < 70) return true;
      if (healthFilter.includes('critical') && health < 40) return true;
      return false;
    });
  }

  // Calculate totals
  const totalCustomers = filteredCustomers.length;
  const totalArr = filteredCustomers.reduce((sum, c) => sum + (c.arr || 0), 0);

  // Calculate health distribution
  const healthDistribution = {
    healthy: filteredCustomers.filter(c => (c.health_score || 0) >= 70).length,
    atRisk: filteredCustomers.filter(c => {
      const h = c.health_score || 0;
      return h >= 40 && h < 70;
    }).length,
    critical: filteredCustomers.filter(c => (c.health_score || 0) < 40).length,
  };

  // Build renewal pipeline
  const now = new Date();
  const renewalPipeline: RenewalPipelineItem[] = filteredCustomers
    .filter(c => c.renewal_date)
    .map(c => {
      const renewalDate = new Date(c.renewal_date);
      const daysUntilRenewal = Math.floor(
        (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        customerId: c.id,
        customerName: c.name,
        arr: c.arr || 0,
        renewalDate: c.renewal_date,
        daysUntilRenewal,
        probability: calculateRenewalProbability(c),
        owner: c.owner_name || 'Unassigned',
        riskLevel: getRiskLevel(c.health_score || 0),
      };
    })
    .filter(r => {
      // Filter by date range if specified
      if (dateRangeStart && r.renewalDate < dateRangeStart) return false;
      if (dateRangeEnd && r.renewalDate > dateRangeEnd) return false;
      return true;
    })
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

  // Build at-risk customers list
  const atRiskCustomers: AtRiskCustomer[] = filteredCustomers
    .filter(c => (c.health_score || 0) < 70)
    .map(c => ({
      customerId: c.id,
      customerName: c.name,
      arr: c.arr || 0,
      healthScore: c.health_score || 0,
      riskLevel: getAtRiskLevel(c.health_score || 0),
      primaryRiskFactor: getPrimaryRiskFactor(c),
      owner: c.owner_name || 'Unassigned',
      hasSavePlay: c.has_save_play || false,
    }))
    .sort((a, b) => a.healthScore - b.healthScore);

  // Calculate team metrics
  const teamMetrics: TeamMetrics = {
    avgHealthScore: filteredCustomers.length > 0
      ? Math.round(filteredCustomers.reduce((sum, c) => sum + (c.health_score || 0), 0) / filteredCustomers.length)
      : 0,
    avgNps: filteredCustomers.length > 0
      ? Math.round(filteredCustomers.reduce((sum, c) => sum + (c.nps_score || 0), 0) / filteredCustomers.length)
      : 0,
    renewalRate: 85, // Would be calculated from historical data
    expansionRate: 15, // Would be calculated from historical data
    churnRate: 5, // Would be calculated from historical data
    openTickets: filteredCustomers.reduce((sum, c) => sum + (c.open_tickets || 0), 0),
    activitiesThisWeek: 0, // Would be calculated from activities table
  };

  // Get CSM info (would need users table in production)
  const csms: CSMInfo[] = [];
  const ownerGroups = new Map<string, typeof filteredCustomers>();
  for (const customer of filteredCustomers) {
    const ownerId = customer.owner_id || 'unassigned';
    if (!ownerGroups.has(ownerId)) {
      ownerGroups.set(ownerId, []);
    }
    ownerGroups.get(ownerId)!.push(customer);
  }

  Array.from(ownerGroups.entries()).forEach(([ownerId, ownerCustomers]) => {
    if (ownerId !== 'unassigned') {
      csms.push({
        id: ownerId,
        name: ownerCustomers[0]?.owner_name || 'Unknown',
        email: '', // Would come from users table
        customerCount: ownerCustomers.length,
        totalArr: ownerCustomers.reduce((sum, c) => sum + (c.arr || 0), 0),
        avgHealthScore: Math.round(
          ownerCustomers.reduce((sum, c) => sum + (c.health_score || 0), 0) / ownerCustomers.length
        ),
      });
    }
  });

  return {
    totalCustomers,
    totalArr,
    healthDistribution,
    renewalPipeline,
    atRiskCustomers,
    teamMetrics,
    csms,
  };
}

// ============================================================================
// Knowledge Base Helpers
// ============================================================================

/**
 * Gets playbooks filtered by type from the knowledge base
 */
export async function getPlaybooksByType(params: {
  type: PlaybookType;
  userId: string;
  customerId?: string;
  limit?: number;
}): Promise<PlaybookMatch[]> {
  const { type, userId, customerId, limit = 5 } = params;

  // Map playbook type to search keywords
  const typeKeywords: Record<PlaybookType, string[]> = {
    onboarding: ['onboarding', 'kickoff', 'implementation', 'launch', 'welcome'],
    adoption: ['adoption', 'usage', 'feature', 'activation', 'engagement'],
    renewal: ['renewal', 'retention', 'contract', 'negotiation', 'pricing'],
    risk: ['risk', 'churn', 'save', 'rescue', 'retention', 'warning'],
    expansion: ['expansion', 'upsell', 'cross-sell', 'growth', 'upgrade'],
    qbr: ['qbr', 'quarterly business review', 'business review', 'executive'],
    escalation: ['escalation', 'issue', 'resolution', 'crisis', 'urgent'],
    save_play: ['save play', 'save', 'rescue', 'turnaround', 'recovery'],
    training: ['training', 'enablement', 'education', 'learning', 'workshop'],
    communication: ['communication', 'email', 'outreach', 'message', 'template'],
  };

  const keywords = typeKeywords[type] || [type];
  const searchQuery = keywords.join(' ');

  try {
    const results = await knowledgeService.search(searchQuery, {
      limit,
      threshold: 0.5,
      category: 'playbooks',
      userId,
      customerId,
    });

    return results.map(r => ({
      id: r.id,
      title: r.documentTitle,
      content: r.content,
      relevanceScore: r.similarity,
      category: (r.metadata?.category as string) || 'playbooks',
    }));
  } catch (error) {
    console.error('[dataHelpers] Playbook search error:', error);
    return [];
  }
}

// ============================================================================
// Document Formatting Helpers
// ============================================================================

/**
 * Formats aggregated data for Google Docs/Slides/Sheets
 * Prepares data structure that can be used by document templates
 */
export function formatDataForDocument(params: {
  taskType: TaskType;
  context: AggregatedContext | CustomerContext | PortfolioContext;
  userId: string;
  customerId?: string;
}): DocumentData {
  const { taskType, context, userId, customerId } = params;

  // Determine document title based on task type
  const titleMap: Partial<Record<TaskType, string>> = {
    kickoff_plan: 'Kickoff Plan',
    milestone_plan: '30-60-90 Day Plan',
    stakeholder_map: 'Stakeholder Map',
    training_schedule: 'Training Schedule',
    usage_analysis: 'Usage Analysis Report',
    feature_campaign: 'Feature Adoption Campaign',
    champion_development: 'Champion Development Plan',
    training_program: 'Training Program',
    renewal_forecast: 'Renewal Forecast',
    value_summary: 'Value Summary',
    expansion_proposal: 'Expansion Proposal',
    negotiation_brief: 'Negotiation Brief',
    risk_assessment: 'Risk Assessment',
    save_play: 'Save Play',
    escalation_report: 'Escalation Report',
    resolution_plan: 'Resolution Plan',
    executive_briefing: 'Executive Briefing',
    account_plan: 'Account Plan',
    transformation_roadmap: 'Transformation Roadmap',
    portfolio_dashboard: 'Portfolio Dashboard',
    team_metrics: 'Team Metrics',
    renewal_pipeline: 'Renewal Pipeline',
    at_risk_overview: 'At-Risk Overview',
    qbr_generation: 'Quarterly Business Review',
  };

  const title = titleMap[taskType] || 'Document';
  const customerName = getCustomerNameFromContext(context);

  // Build sections based on task type
  const sections = buildDocumentSections(taskType, context);

  // Build metadata
  const metadata: DocumentMetadata = {
    createdAt: new Date().toISOString(),
    createdBy: userId,
    customerId,
    customerName,
    taskType,
    sourcesUsed: getSourcesFromContext(context),
  };

  return {
    title: customerName ? `${customerName} - ${title}` : title,
    sections,
    metadata,
  };
}

// ============================================================================
// Private Helper Functions
// ============================================================================

function getEmptyCustomerContext(): CustomerContext {
  return {
    customer360: getEmptyCustomer360(''),
    healthTrends: [],
    engagementMetrics: getEmptyEngagementMetrics(),
    riskSignals: [],
    interactionHistory: [],
    renewalForecast: null,
    stakeholders: [],
    contracts: [],
  };
}

function getEmptyCustomer360(customerId: string): Customer360 {
  return {
    id: customerId,
    name: 'Unknown Customer',
    arr: 0,
    tier: 'smb',
    status: 'active',
    healthScore: 0,
  };
}

function getEmptyEngagementMetrics(): EngagementMetrics {
  return {
    dauMau: 0,
    featureAdoption: 0,
    loginFrequency: 0,
    lastActivityDays: 0,
  };
}

function getEmptyPortfolioContext(): PortfolioContext {
  return {
    totalCustomers: 0,
    totalArr: 0,
    healthDistribution: { healthy: 0, atRisk: 0, critical: 0 },
    renewalPipeline: [],
    atRiskCustomers: [],
    teamMetrics: {
      avgHealthScore: 0,
      avgNps: 0,
      renewalRate: 0,
      expansionRate: 0,
      churnRate: 0,
      openTickets: 0,
      activitiesThisWeek: 0,
    },
    csms: [],
  };
}

function determineTier(arr: number): string {
  if (arr >= 500000) return 'enterprise';
  if (arr >= 200000) return 'strategic';
  if (arr >= 50000) return 'commercial';
  return 'smb';
}

function generateRiskSignals(customer: Record<string, unknown> | null): RiskSignal[] {
  if (!customer) return [];

  const signals: RiskSignal[] = [];
  const now = new Date();
  const healthScore = (customer.health_score as number) || 0;
  const lastActivityDays = (customer.last_activity_days as number) || 0;
  const npsScore = customer.nps_score as number | undefined;
  const openTickets = (customer.open_tickets as number) || 0;
  const paymentStatus = customer.payment_status as string | undefined;

  if (healthScore < 40) {
    signals.push({
      type: 'churn',
      severity: 'critical',
      description: `Health score critically low at ${healthScore}%`,
      detectedAt: now.toISOString(),
      recommendation: 'Immediate executive escalation and intervention',
    });
  } else if (healthScore < 60) {
    signals.push({
      type: 'churn',
      severity: 'high',
      description: `Health score concerning at ${healthScore}%`,
      detectedAt: now.toISOString(),
      recommendation: 'Schedule strategic review with stakeholders',
    });
  }

  if (lastActivityDays > 14) {
    signals.push({
      type: 'engagement',
      severity: lastActivityDays > 30 ? 'high' : 'medium',
      description: `No activity in ${lastActivityDays} days`,
      detectedAt: now.toISOString(),
      recommendation: 'Proactive outreach to understand situation',
    });
  }

  if (npsScore !== undefined && npsScore < 0) {
    signals.push({
      type: 'sentiment',
      severity: npsScore < -30 ? 'critical' : 'high',
      description: `Negative NPS score: ${npsScore}`,
      detectedAt: now.toISOString(),
      recommendation: 'Address feedback and rebuild relationship',
    });
  }

  if (openTickets > 3) {
    signals.push({
      type: 'support',
      severity: openTickets > 5 ? 'high' : 'medium',
      description: `${openTickets} open support tickets`,
      detectedAt: now.toISOString(),
      recommendation: 'Coordinate with support for resolution',
    });
  }

  if (paymentStatus === 'overdue') {
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

function mapStakeholderRole(role: string): Stakeholder['role'] {
  const mapping: Record<string, Stakeholder['role']> = {
    champion: 'champion',
    sponsor: 'sponsor',
    blocker: 'blocker',
    evaluator: 'evaluator',
    user: 'user',
    executive: 'executive',
    admin: 'user',
    decision_maker: 'sponsor',
  };
  return mapping[role?.toLowerCase()] || 'user';
}

function mapLevel(level: string | number | undefined): 'high' | 'medium' | 'low' {
  if (typeof level === 'number') {
    if (level >= 7) return 'high';
    if (level >= 4) return 'medium';
    return 'low';
  }
  if (typeof level === 'string') {
    const l = level.toLowerCase();
    if (l === 'high' || l === 'h') return 'high';
    if (l === 'medium' || l === 'med' || l === 'm') return 'medium';
  }
  return 'low';
}

function calculateRenewalProbability(customer: Record<string, unknown>): number {
  let probability = 70;
  const healthScore = (customer.health_score as number) || 0;
  const npsScore = customer.nps_score as number | undefined;
  const lastActivityDays = (customer.last_activity_days as number) || 0;

  if (healthScore >= 80) probability += 15;
  else if (healthScore >= 60) probability += 5;
  else if (healthScore < 40) probability -= 30;
  else probability -= 15;

  if (npsScore !== undefined) {
    if (npsScore >= 50) probability += 10;
    else if (npsScore < 0) probability -= 20;
  }

  if (lastActivityDays > 30) probability -= 15;
  else if (lastActivityDays <= 7) probability += 5;

  return Math.max(0, Math.min(100, probability));
}

function generateRecommendedActions(
  customer: Record<string, unknown>,
  risks: RiskSignal[]
): string[] {
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

  const healthScore = (customer.health_score as number) || 0;
  if (risks.length === 0 && healthScore >= 80) {
    actions.push('Explore expansion opportunities');
    actions.push('Request referral or case study participation');
  }

  return actions.length > 0 ? actions : ['Continue regular engagement cadence'];
}

function getRiskLevel(healthScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (healthScore >= 70) return 'low';
  if (healthScore >= 50) return 'medium';
  if (healthScore >= 30) return 'high';
  return 'critical';
}

/**
 * Gets risk level for at-risk customers (excludes 'low' since they're already at risk)
 */
function getAtRiskLevel(healthScore: number): 'medium' | 'high' | 'critical' {
  if (healthScore >= 50) return 'medium';
  if (healthScore >= 30) return 'high';
  return 'critical';
}

function getPrimaryRiskFactor(customer: Record<string, unknown>): string {
  const healthScore = (customer.health_score as number) || 0;
  const lastActivityDays = (customer.last_activity_days as number) || 0;
  const npsScore = customer.nps_score as number | undefined;
  const openTickets = (customer.open_tickets as number) || 0;

  if (healthScore < 40) return 'Critical health score';
  if (lastActivityDays > 30) return 'No recent activity';
  if (npsScore !== undefined && npsScore < 0) return 'Negative NPS';
  if (openTickets > 5) return 'High support volume';
  if (healthScore < 60) return 'Declining health';
  return 'Multiple minor factors';
}

function getCustomerNameFromContext(
  context: AggregatedContext | CustomerContext | PortfolioContext
): string | undefined {
  if ('customer360' in context && context.customer360) {
    return context.customer360.name;
  }
  if ('platformData' in context && context.platformData?.customer360) {
    return context.platformData.customer360.name;
  }
  return undefined;
}

function getSourcesFromContext(
  context: AggregatedContext | CustomerContext | PortfolioContext
): string[] {
  const sources: string[] = [];

  if ('customer360' in context) {
    sources.push('customer_360');
    if (context.healthTrends?.length > 0) sources.push('health_trends');
    if (context.engagementMetrics) sources.push('engagement_metrics');
    if (context.riskSignals?.length > 0) sources.push('risk_signals');
    if (context.renewalForecast) sources.push('renewal_forecast');
    if (context.interactionHistory?.length > 0) sources.push('interaction_history');
    if (context.stakeholders?.length > 0) sources.push('stakeholders');
    if (context.contracts?.length > 0) sources.push('contracts');
  } else if ('platformData' in context) {
    if (context.platformData?.customer360) sources.push('customer_360');
    if (context.platformData?.healthTrends?.length > 0) sources.push('health_trends');
    if (context.platformData?.engagementMetrics) sources.push('engagement_metrics');
    if (context.platformData?.riskSignals?.length > 0) sources.push('risk_signals');
    if (context.platformData?.renewalForecast) sources.push('renewal_forecast');
    if (context.platformData?.interactionHistory?.length > 0) sources.push('interaction_history');
    if (context.knowledge?.playbooks?.length > 0) sources.push('knowledge_base');
  } else if ('totalCustomers' in context) {
    sources.push('portfolio_data');
    if (context.renewalPipeline?.length > 0) sources.push('renewal_pipeline');
    if (context.atRiskCustomers?.length > 0) sources.push('at_risk_customers');
    if (context.csms?.length > 0) sources.push('team_data');
  }

  return sources;
}

function buildDocumentSections(
  taskType: TaskType,
  context: AggregatedContext | CustomerContext | PortfolioContext
): DocumentSection[] {
  const sections: DocumentSection[] = [];

  // Common header
  sections.push({
    heading: 'Overview',
    content: `Generated on ${new Date().toLocaleDateString()}`,
    style: 'subtitle',
  });

  // Task-specific sections
  switch (taskType) {
    case 'kickoff_plan':
      sections.push(
        { heading: 'Meeting Objectives', content: 'To be completed', style: 'heading1' },
        { heading: 'Agenda', content: 'To be completed', style: 'heading1' },
        { heading: 'Attendees', content: 'To be completed', style: 'heading1' },
        { heading: 'Success Criteria', content: 'To be completed', style: 'heading1' },
        { heading: 'Next Steps', content: 'To be completed', style: 'heading1' }
      );
      break;

    case 'milestone_plan':
      sections.push(
        { heading: 'First 30 Days', content: 'To be completed', style: 'heading1' },
        { heading: '30-60 Days', content: 'To be completed', style: 'heading1' },
        { heading: '60-90 Days', content: 'To be completed', style: 'heading1' },
        { heading: 'Success Metrics', content: 'To be completed', style: 'heading1' }
      );
      break;

    case 'risk_assessment':
    case 'save_play':
      sections.push(
        { heading: 'Risk Summary', content: 'To be completed', style: 'heading1' },
        { heading: 'Root Causes', content: 'To be completed', style: 'heading1' },
        { heading: 'Mitigation Actions', content: 'To be completed', style: 'heading1' },
        { heading: 'Timeline', content: 'To be completed', style: 'heading1' }
      );
      break;

    case 'renewal_forecast':
    case 'value_summary':
      sections.push(
        { heading: 'Executive Summary', content: 'To be completed', style: 'heading1' },
        { heading: 'Value Delivered', content: 'To be completed', style: 'heading1' },
        { heading: 'ROI Analysis', content: 'To be completed', style: 'heading1' },
        { heading: 'Recommendations', content: 'To be completed', style: 'heading1' }
      );
      break;

    default:
      sections.push(
        { heading: 'Summary', content: 'To be completed', style: 'heading1' },
        { heading: 'Details', content: 'To be completed', style: 'heading1' },
        { heading: 'Next Steps', content: 'To be completed', style: 'heading1' }
      );
  }

  return sections;
}

// ============================================================================
// Exports
// ============================================================================

export const dataHelpers = {
  aggregateCustomerContext,
  aggregatePortfolioContext,
  getPlaybooksByType,
  formatDataForDocument,
};

export default dataHelpers;
