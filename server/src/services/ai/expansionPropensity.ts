/**
 * Expansion Propensity Modeling Service
 * PRD-238: AI-Powered Expansion Propensity Scoring
 *
 * Predicts which customers are most likely to expand based on:
 * - Usage patterns and trends
 * - Engagement signals
 * - Success metrics
 * - Business context
 * - Historical expansion data
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// ============================================
// Types
// ============================================

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ContributingFactor {
  factor: string;
  description: string;
  weight: number;
  category: 'usage' | 'engagement' | 'health' | 'business' | 'stakeholder' | 'cohort';
  signal: 'positive' | 'negative' | 'neutral';
}

export interface RecommendedProduct {
  name: string;
  reason: string;
  estimatedValue: number;
  confidence: number;
}

export interface ExpansionApproach {
  champion: string | null;
  entryPoint: string;
  timing: string;
  talkingPoints: string[];
}

export interface PropensityScore {
  id: string;
  customerId: string;
  customerName: string;
  propensityScore: number; // 0-100
  confidence: ConfidenceLevel;
  confidenceValue: number; // 0-1
  contributingFactors: ContributingFactor[];
  recommendedProducts: RecommendedProduct[];
  estimatedValue: number;
  approach: ExpansionApproach;
  calculatedAt: string;
  scoreBreakdown: {
    usage: number;
    engagement: number;
    health: number;
    business: number;
    stakeholder: number;
    cohort: number;
  };
  primarySignal: string;
  currentState: {
    arr: number;
    plan: string;
    healthScore: number;
    activeUsers: number;
    contractedSeats: number;
    daysToRenewal: number | null;
    usageCapacity: number; // percentage of capacity used
  };
}

export interface PropensityRanking {
  rank: number;
  customer: PropensityScore;
}

export interface PortfolioPropensityStats {
  totalCustomers: number;
  avgPropensity: number;
  highPropensityCount: number;
  totalEstimatedValue: number;
  topOpportunities: PropensityRanking[];
  distribution: {
    veryHigh: number; // 80-100
    high: number;     // 60-80
    medium: number;   // 40-60
    low: number;      // 20-40
    veryLow: number;  // 0-20
  };
  lastRefreshed: string;
}

// ============================================
// Weights for propensity calculation
// ============================================

const PROPENSITY_WEIGHTS = {
  usage: 0.30,       // Usage at capacity
  engagement: 0.20,  // Engagement quality
  health: 0.20,      // Customer health
  business: 0.15,    // Business factors
  stakeholder: 0.10, // Stakeholder relationships
  cohort: 0.05,      // Similar customer behavior
};

// ============================================
// Main Functions
// ============================================

/**
 * Calculate expansion propensity score for a single customer
 */
export async function calculatePropensity(customerId: string): Promise<PropensityScore> {
  // Gather customer data
  const customerData = await gatherCustomerData(customerId);

  // Calculate component scores
  const usageScore = await calculateUsageScore(customerId, customerData);
  const engagementScore = await calculateEngagementScore(customerId, customerData);
  const healthScore = customerData.healthScore || 70;
  const businessScore = await calculateBusinessScore(customerId, customerData);
  const stakeholderScore = await calculateStakeholderScore(customerId, customerData);
  const cohortScore = await calculateCohortScore(customerId, customerData);

  const scoreBreakdown = {
    usage: usageScore,
    engagement: engagementScore,
    health: healthScore,
    business: businessScore,
    stakeholder: stakeholderScore,
    cohort: cohortScore,
  };

  // Calculate weighted propensity score
  const propensityScore = Math.round(
    usageScore * PROPENSITY_WEIGHTS.usage +
    engagementScore * PROPENSITY_WEIGHTS.engagement +
    healthScore * PROPENSITY_WEIGHTS.health +
    businessScore * PROPENSITY_WEIGHTS.business +
    stakeholderScore * PROPENSITY_WEIGHTS.stakeholder +
    cohortScore * PROPENSITY_WEIGHTS.cohort
  );

  // Collect contributing factors
  const contributingFactors = collectContributingFactors(scoreBreakdown, customerData);

  // Determine confidence level
  const { confidence, confidenceValue } = calculateConfidence(scoreBreakdown, customerData);

  // Generate recommendations using AI if available
  const aiAnalysis = await generateAIRecommendations(customerData, scoreBreakdown, contributingFactors);

  // Calculate estimated expansion value
  const estimatedValue = estimateExpansionValue(customerData, propensityScore);

  // Determine primary signal
  const primarySignal = determinePrimarySignal(contributingFactors);

  const result: PropensityScore = {
    id: uuidv4(),
    customerId,
    customerName: customerData.name,
    propensityScore: Math.max(0, Math.min(100, propensityScore)),
    confidence,
    confidenceValue,
    contributingFactors,
    recommendedProducts: aiAnalysis.recommendedProducts,
    estimatedValue,
    approach: aiAnalysis.approach,
    calculatedAt: new Date().toISOString(),
    scoreBreakdown,
    primarySignal,
    currentState: {
      arr: customerData.arr,
      plan: customerData.plan || 'Standard',
      healthScore: customerData.healthScore,
      activeUsers: customerData.activeUsers,
      contractedSeats: customerData.contractedSeats,
      daysToRenewal: customerData.daysToRenewal,
      usageCapacity: customerData.usageCapacity,
    },
  };

  // Store in database
  await storePropensityScore(result);

  return result;
}

/**
 * Batch calculate propensity for all active customers
 */
export async function calculatePropensityBatch(
  options: {
    minScore?: number;
    limit?: number;
  } = {}
): Promise<PropensityScore[]> {
  const { minScore = 0, limit = 100 } = options;

  // Get all active customers
  const customers = await getActiveCustomers();
  const results: PropensityScore[] = [];

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < customers.length && results.length < limit; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(c => calculatePropensity(c.id).catch(err => {
        console.error(`Error calculating propensity for ${c.id}:`, err);
        return null;
      }))
    );

    for (const result of batchResults) {
      if (result && result.propensityScore >= minScore) {
        results.push(result);
      }
    }
  }

  // Sort by propensity score descending
  return results.sort((a, b) => b.propensityScore - a.propensityScore);
}

/**
 * Get top expansion opportunities ranked by propensity
 */
export async function getTopExpansionOpportunities(
  limit: number = 10
): Promise<PropensityRanking[]> {
  const scores = await calculatePropensityBatch({ minScore: 60, limit });

  return scores.map((customer, index) => ({
    rank: index + 1,
    customer,
  }));
}

/**
 * Get portfolio-wide propensity statistics
 */
export async function getPortfolioPropensityStats(): Promise<PortfolioPropensityStats> {
  const allScores = await calculatePropensityBatch({ minScore: 0 });

  const distribution = {
    veryHigh: 0,
    high: 0,
    medium: 0,
    low: 0,
    veryLow: 0,
  };

  let totalValue = 0;
  let totalPropensity = 0;

  for (const score of allScores) {
    totalPropensity += score.propensityScore;
    totalValue += score.estimatedValue;

    if (score.propensityScore >= 80) distribution.veryHigh++;
    else if (score.propensityScore >= 60) distribution.high++;
    else if (score.propensityScore >= 40) distribution.medium++;
    else if (score.propensityScore >= 20) distribution.low++;
    else distribution.veryLow++;
  }

  const topOpportunities = allScores.slice(0, 10).map((customer, index) => ({
    rank: index + 1,
    customer,
  }));

  return {
    totalCustomers: allScores.length,
    avgPropensity: Math.round(totalPropensity / Math.max(allScores.length, 1)),
    highPropensityCount: distribution.veryHigh + distribution.high,
    totalEstimatedValue: totalValue,
    topOpportunities,
    distribution,
    lastRefreshed: new Date().toISOString(),
  };
}

/**
 * Get customer's expansion propensity score (from cache or fresh)
 */
export async function getCustomerPropensity(
  customerId: string,
  forceRefresh: boolean = false
): Promise<PropensityScore> {
  if (!forceRefresh) {
    // Try to get cached score (less than 24 hours old)
    const cached = await getCachedPropensity(customerId);
    if (cached) return cached;
  }

  return calculatePropensity(customerId);
}

// ============================================
// Score Calculation Helpers
// ============================================

/**
 * Calculate usage-based propensity score (higher = more likely to expand)
 */
async function calculateUsageScore(customerId: string, data: CustomerData): Promise<number> {
  let score = 50; // Base score

  // Usage capacity - higher is better for expansion
  if (data.usageCapacity >= 95) score += 35;
  else if (data.usageCapacity >= 85) score += 25;
  else if (data.usageCapacity >= 70) score += 15;
  else if (data.usageCapacity < 40) score -= 15;

  // Seat utilization
  const seatUtilization = data.activeUsers / Math.max(data.contractedSeats, 1);
  if (seatUtilization >= 1.0) score += 20; // Over seats
  else if (seatUtilization >= 0.9) score += 15;
  else if (seatUtilization >= 0.75) score += 10;
  else if (seatUtilization < 0.5) score -= 10;

  // Usage trend
  if (data.usageTrend > 0.15) score += 15;
  else if (data.usageTrend > 0.05) score += 8;
  else if (data.usageTrend < -0.1) score -= 15;

  // Feature diversity - using more features = higher value realized
  if (data.uniqueFeaturesUsed >= 10) score += 10;
  else if (data.uniqueFeaturesUsed >= 6) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate engagement-based propensity score
 */
async function calculateEngagementScore(customerId: string, data: CustomerData): Promise<number> {
  let score = 50;

  // Executive engagement
  if (data.hasExecutiveEngagement) score += 20;

  // Champion activity
  if (data.hasActiveChampion) score += 15;

  // Recent expansion discussions
  if (data.hasExpansionMentions) score += 20;

  // Meeting frequency
  if (data.recentMeetingCount >= 3) score += 10;
  else if (data.recentMeetingCount >= 1) score += 5;
  else score -= 10;

  // Response rate
  if (data.responseRate >= 0.8) score += 10;
  else if (data.responseRate < 0.3) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate business context score
 */
async function calculateBusinessScore(customerId: string, data: CustomerData): Promise<number> {
  let score = 50;

  // ARR tier - larger customers have more expansion potential
  if (data.arr >= 200000) score += 20;
  else if (data.arr >= 100000) score += 15;
  else if (data.arr >= 50000) score += 10;
  else if (data.arr < 10000) score -= 5;

  // Contract timing - renewals are expansion opportunities
  if (data.daysToRenewal !== null) {
    if (data.daysToRenewal <= 90 && data.daysToRenewal > 30) score += 15;
    else if (data.daysToRenewal <= 30) score += 10; // Urgent, less time to expand
  }

  // Growth trajectory
  if (data.companyGrowthSignals) score += 15;

  // Current plan tier - lower tiers have more upsell room
  if (data.plan === 'Basic' || data.plan === 'Starter') score += 15;
  else if (data.plan === 'Standard' || data.plan === 'Professional') score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate stakeholder relationship score
 */
async function calculateStakeholderScore(customerId: string, data: CustomerData): Promise<number> {
  let score = 50;

  // Multi-threading
  if (data.stakeholderCount >= 5) score += 20;
  else if (data.stakeholderCount >= 3) score += 10;
  else if (data.stakeholderCount <= 1) score -= 15;

  // Executive sponsor
  if (data.hasExecutiveSponsor) score += 15;

  // Champion promotion
  if (data.championPromotion) score += 15;

  // New stakeholders (indicates expansion of internal adoption)
  if (data.newStakeholdersAdded) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate cohort-based score (how similar customers behaved)
 */
async function calculateCohortScore(customerId: string, data: CustomerData): Promise<number> {
  // Default to 60 - slightly optimistic baseline
  let score = 60;

  // In production, this would query historical expansion data
  // for customers with similar characteristics
  if (data.industry) {
    // Simulate cohort analysis
    const industryExpansionRates: Record<string, number> = {
      'Technology': 75,
      'Healthcare': 70,
      'Finance': 68,
      'Retail': 55,
      'Manufacturing': 50,
    };
    score = industryExpansionRates[data.industry] || 60;
  }

  // Adjust based on company size cohort
  if (data.employeeCount >= 1000) score += 10;
  else if (data.employeeCount >= 500) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// Data Gathering
// ============================================

interface CustomerData {
  id: string;
  name: string;
  arr: number;
  plan: string | null;
  healthScore: number;
  activeUsers: number;
  contractedSeats: number;
  usageCapacity: number;
  usageTrend: number;
  uniqueFeaturesUsed: number;
  daysToRenewal: number | null;
  industry: string | null;
  employeeCount: number;
  stakeholderCount: number;
  recentMeetingCount: number;
  responseRate: number;
  hasExecutiveEngagement: boolean;
  hasActiveChampion: boolean;
  hasExecutiveSponsor: boolean;
  hasExpansionMentions: boolean;
  championPromotion: boolean;
  newStakeholdersAdded: boolean;
  companyGrowthSignals: boolean;
}

async function gatherCustomerData(customerId: string): Promise<CustomerData> {
  // Default data structure
  const defaultData: CustomerData = {
    id: customerId,
    name: 'Unknown Customer',
    arr: 50000,
    plan: 'Standard',
    healthScore: 70,
    activeUsers: 25,
    contractedSeats: 30,
    usageCapacity: 75,
    usageTrend: 0.05,
    uniqueFeaturesUsed: 6,
    daysToRenewal: 90,
    industry: null,
    employeeCount: 200,
    stakeholderCount: 3,
    recentMeetingCount: 2,
    responseRate: 0.65,
    hasExecutiveEngagement: false,
    hasActiveChampion: true,
    hasExecutiveSponsor: false,
    hasExpansionMentions: false,
    championPromotion: false,
    newStakeholdersAdded: false,
    companyGrowthSignals: false,
  };

  if (!supabase) {
    // Return demo data with some variation
    return {
      ...defaultData,
      usageCapacity: Math.round(60 + Math.random() * 35),
      healthScore: Math.round(55 + Math.random() * 40),
      hasExpansionMentions: Math.random() > 0.7,
    };
  }

  try {
    // Fetch customer basic info
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) return defaultData;

    // Calculate days to renewal
    let daysToRenewal: number | null = null;
    if (customer.renewal_date) {
      daysToRenewal = Math.ceil(
        (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
    }

    // Fetch usage metrics
    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(2);

    let usageCapacity = 70;
    let usageTrend = 0;
    let uniqueFeaturesUsed = 6;
    let activeUsers = customer.active_users || 25;

    if (metrics && metrics.length > 0) {
      const current = metrics[0];
      const previous = metrics[1];

      activeUsers = current.mau || activeUsers;
      uniqueFeaturesUsed = current.unique_features_used || 6;

      // Calculate usage capacity (seats used vs contracted)
      const contractedSeats = customer.contracted_seats || 50;
      usageCapacity = Math.round((activeUsers / contractedSeats) * 100);

      // Calculate trend
      if (previous && previous.total_events > 0) {
        usageTrend = (current.total_events - previous.total_events) / previous.total_events;
      }
    }

    // Check for expansion mentions in recent communications
    const { data: expansionMentions } = await supabase
      .from('agent_activity_log')
      .select('result_data')
      .eq('customer_id', customerId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    const hasExpansionMentions = expansionMentions?.some(a => {
      const text = JSON.stringify(a.result_data || '').toLowerCase();
      return text.includes('expand') || text.includes('additional seats') ||
             text.includes('upgrade') || text.includes('enterprise');
    }) || false;

    // Get stakeholder info
    const { data: contracts } = await supabase
      .from('contracts')
      .select('extracted_data')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1);

    let stakeholderCount = 2;
    let hasExecutiveSponsor = false;

    if (contracts && contracts[0]?.extracted_data) {
      const extracted = contracts[0].extracted_data as { stakeholders?: Array<{ role?: string }> };
      stakeholderCount = extracted.stakeholders?.length || 2;
      hasExecutiveSponsor = extracted.stakeholders?.some(s =>
        s.role?.toLowerCase().includes('exec') ||
        s.role?.toLowerCase().includes('vp') ||
        s.role?.toLowerCase().includes('director')
      ) || false;
    }

    return {
      id: customerId,
      name: customer.name || 'Unknown',
      arr: customer.arr || 50000,
      plan: customer.plan || 'Standard',
      healthScore: customer.health_score || 70,
      activeUsers,
      contractedSeats: customer.contracted_seats || 50,
      usageCapacity,
      usageTrend,
      uniqueFeaturesUsed,
      daysToRenewal,
      industry: customer.industry || null,
      employeeCount: customer.employee_count || 200,
      stakeholderCount,
      recentMeetingCount: 2, // Would query meetings table
      responseRate: 0.65,
      hasExecutiveEngagement: hasExecutiveSponsor,
      hasActiveChampion: stakeholderCount >= 2,
      hasExecutiveSponsor,
      hasExpansionMentions,
      championPromotion: false,
      newStakeholdersAdded: false,
      companyGrowthSignals: customer.growth_signals || false,
    };
  } catch (error) {
    console.error('Error gathering customer data:', error);
    return defaultData;
  }
}

async function getActiveCustomers(): Promise<Array<{ id: string; name: string }>> {
  if (!supabase) {
    // Return demo customers
    return [
      { id: 'demo-1', name: 'TechFlow Inc' },
      { id: 'demo-2', name: 'DataDrive Co' },
      { id: 'demo-3', name: 'CloudFirst' },
      { id: 'demo-4', name: 'Nexus Corp' },
      { id: 'demo-5', name: 'Acme Corp' },
    ];
  }

  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .neq('stage', 'churned')
    .order('arr', { ascending: false });

  return data || [];
}

// ============================================
// Analysis Helpers
// ============================================

function collectContributingFactors(
  scores: Record<string, number>,
  data: CustomerData
): ContributingFactor[] {
  const factors: ContributingFactor[] = [];

  // Usage factors
  if (data.usageCapacity >= 90) {
    factors.push({
      factor: 'Usage at capacity',
      description: `Usage at ${data.usageCapacity}% of license capacity`,
      weight: 35,
      category: 'usage',
      signal: 'positive',
    });
  } else if (data.usageCapacity >= 75) {
    factors.push({
      factor: 'High usage',
      description: `Usage at ${data.usageCapacity}% of capacity`,
      weight: 20,
      category: 'usage',
      signal: 'positive',
    });
  }

  // Health score factor
  if (scores.health >= 80) {
    factors.push({
      factor: 'Excellent health score',
      description: `Health score of ${scores.health}/100`,
      weight: 20,
      category: 'health',
      signal: 'positive',
    });
  } else if (scores.health < 50) {
    factors.push({
      factor: 'Low health score',
      description: `Health score of ${scores.health}/100 may indicate issues`,
      weight: -15,
      category: 'health',
      signal: 'negative',
    });
  }

  // Engagement factors
  if (data.hasExpansionMentions) {
    factors.push({
      factor: 'Expansion discussions',
      description: 'Customer has mentioned expansion in recent conversations',
      weight: 18,
      category: 'engagement',
      signal: 'positive',
    });
  }

  if (data.hasExecutiveEngagement) {
    factors.push({
      factor: 'Executive engagement',
      description: 'Active executive-level engagement',
      weight: 12,
      category: 'engagement',
      signal: 'positive',
    });
  }

  // Stakeholder factors
  if (data.championPromotion) {
    factors.push({
      factor: 'Champion promotion',
      description: 'Internal champion was recently promoted',
      weight: 15,
      category: 'stakeholder',
      signal: 'positive',
    });
  }

  if (data.stakeholderCount >= 5) {
    factors.push({
      factor: 'Deep multi-threading',
      description: `${data.stakeholderCount} active stakeholders engaged`,
      weight: 10,
      category: 'stakeholder',
      signal: 'positive',
    });
  }

  // Business factors
  if (data.daysToRenewal !== null && data.daysToRenewal <= 90 && data.daysToRenewal > 0) {
    factors.push({
      factor: 'Upcoming renewal',
      description: `Renewal in ${data.daysToRenewal} days - ideal expansion timing`,
      weight: 12,
      category: 'business',
      signal: 'positive',
    });
  }

  if (data.companyGrowthSignals) {
    factors.push({
      factor: 'Company growth',
      description: 'Company showing growth indicators',
      weight: 10,
      category: 'business',
      signal: 'positive',
    });
  }

  // Cohort factors
  if (scores.cohort >= 70) {
    factors.push({
      factor: 'Cohort expansion pattern',
      description: 'Similar customers in this cohort expanded at high rate',
      weight: 9,
      category: 'cohort',
      signal: 'positive',
    });
  }

  // Sort by weight descending
  return factors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

function calculateConfidence(
  scores: Record<string, number>,
  data: CustomerData
): { confidence: ConfidenceLevel; confidenceValue: number } {
  let confidenceValue = 0.5; // Base confidence

  // More data points = higher confidence
  if (data.activeUsers > 0) confidenceValue += 0.1;
  if (data.recentMeetingCount > 0) confidenceValue += 0.1;
  if (data.stakeholderCount >= 3) confidenceValue += 0.1;
  if (data.uniqueFeaturesUsed >= 5) confidenceValue += 0.1;

  // Score consistency increases confidence
  const scoreValues = Object.values(scores);
  const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
  const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scoreValues.length;

  if (Math.sqrt(variance) < 15) confidenceValue += 0.15; // Consistent scores

  // Cap at 0.95
  confidenceValue = Math.min(0.95, confidenceValue);

  const confidence: ConfidenceLevel =
    confidenceValue >= 0.75 ? 'high' :
    confidenceValue >= 0.5 ? 'medium' : 'low';

  return { confidence, confidenceValue };
}

function estimateExpansionValue(data: CustomerData, propensityScore: number): number {
  // Base expansion estimate is 30-50% of current ARR
  const baseMultiplier = 0.3 + (propensityScore / 100) * 0.2;
  const baseExpansion = data.arr * baseMultiplier;

  // Adjust based on capacity constraints
  const capacityMultiplier = data.usageCapacity >= 90 ? 1.5 :
                             data.usageCapacity >= 75 ? 1.2 : 1.0;

  return Math.round(baseExpansion * capacityMultiplier);
}

function determinePrimarySignal(factors: ContributingFactor[]): string {
  if (factors.length === 0) return 'General expansion potential';
  return factors[0].description;
}

// ============================================
// AI-Powered Recommendations
// ============================================

async function generateAIRecommendations(
  data: CustomerData,
  scores: Record<string, number>,
  factors: ContributingFactor[]
): Promise<{
  recommendedProducts: RecommendedProduct[];
  approach: ExpansionApproach;
}> {
  // Default recommendations
  const defaultRecommendations = generateRuleBasedRecommendations(data, scores, factors);

  if (!anthropic) {
    return defaultRecommendations;
  }

  try {
    const prompt = buildRecommendationPrompt(data, scores, factors);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return parseAIRecommendations(content.text, data);
    }
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
  }

  return defaultRecommendations;
}

function buildRecommendationPrompt(
  data: CustomerData,
  scores: Record<string, number>,
  factors: ContributingFactor[]
): string {
  return `You are a Customer Success expansion strategist. Analyze this customer's data and provide expansion recommendations.

CUSTOMER DATA:
- Name: ${data.name}
- Current ARR: $${data.arr.toLocaleString()}
- Plan: ${data.plan || 'Standard'}
- Health Score: ${data.healthScore}/100
- Industry: ${data.industry || 'Unknown'}
- Active Users: ${data.activeUsers}
- Contracted Seats: ${data.contractedSeats}
- Usage Capacity: ${data.usageCapacity}%
- Days to Renewal: ${data.daysToRenewal ?? 'Unknown'}

PROPENSITY SCORES:
- Usage: ${scores.usage}/100
- Engagement: ${scores.engagement}/100
- Health: ${scores.health}/100
- Business: ${scores.business}/100
- Stakeholder: ${scores.stakeholder}/100

TOP SIGNALS:
${factors.slice(0, 5).map(f => `- ${f.factor}: ${f.description} (+${f.weight} pts)`).join('\n')}

Provide expansion recommendations in this JSON format:
{
  "recommendedProducts": [
    {
      "name": "Product name",
      "reason": "Why this product fits",
      "estimatedValue": 25000,
      "confidence": 0.8
    }
  ],
  "approach": {
    "champion": "Name/role of internal champion to leverage or null",
    "entryPoint": "Recommended conversation starter",
    "timing": "Best timing recommendation",
    "talkingPoints": ["Point 1", "Point 2", "Point 3"]
  }
}`;
}

function parseAIRecommendations(
  text: string,
  data: CustomerData
): { recommendedProducts: RecommendedProduct[]; approach: ExpansionApproach } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      recommendedProducts: parsed.recommendedProducts || [],
      approach: {
        champion: parsed.approach?.champion || null,
        entryPoint: parsed.approach?.entryPoint || 'Capacity planning discussion',
        timing: parsed.approach?.timing || 'This quarter',
        talkingPoints: parsed.approach?.talkingPoints || ['Discuss current usage', 'Review growth plans'],
      },
    };
  } catch (error) {
    console.error('Error parsing AI recommendations:', error);
    return generateRuleBasedRecommendations(data, {}, []);
  }
}

function generateRuleBasedRecommendations(
  data: CustomerData,
  scores: Record<string, number>,
  factors: ContributingFactor[]
): { recommendedProducts: RecommendedProduct[]; approach: ExpansionApproach } {
  const recommendedProducts: RecommendedProduct[] = [];

  // Seat expansion if at capacity
  if (data.usageCapacity >= 80) {
    const additionalSeats = Math.ceil(data.contractedSeats * 0.5);
    recommendedProducts.push({
      name: `Additional ${additionalSeats} Seats`,
      reason: 'Usage approaching capacity - team likely needs more seats',
      estimatedValue: additionalSeats * 1000,
      confidence: 0.85,
    });
  }

  // Plan upgrade if on lower tier
  if (data.plan === 'Basic' || data.plan === 'Starter') {
    recommendedProducts.push({
      name: 'Professional Plan Upgrade',
      reason: 'Unlocks advanced features for growing teams',
      estimatedValue: Math.round(data.arr * 0.5),
      confidence: 0.7,
    });
  }

  // Enterprise upgrade for large accounts
  if (data.arr >= 100000 && data.plan !== 'Enterprise') {
    recommendedProducts.push({
      name: 'Enterprise Plan',
      reason: 'Dedicated support and enterprise features for strategic accounts',
      estimatedValue: Math.round(data.arr * 0.8),
      confidence: 0.65,
    });
  }

  return {
    recommendedProducts: recommendedProducts.slice(0, 3),
    approach: {
      champion: data.hasActiveChampion ? 'Primary contact' : null,
      entryPoint: data.usageCapacity >= 90
        ? 'Capacity planning conversation'
        : data.daysToRenewal && data.daysToRenewal <= 90
          ? 'Renewal discussion'
          : 'Quarterly business review',
      timing: data.daysToRenewal && data.daysToRenewal <= 60 ? 'Immediate' : 'This quarter',
      talkingPoints: [
        'Review current usage patterns and growth trajectory',
        'Discuss upcoming team or project expansions',
        'Explore additional use cases and features',
      ],
    },
  };
}

// ============================================
// Storage Functions
// ============================================

async function storePropensityScore(score: PropensityScore): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('expansion_propensity').upsert({
      id: score.id,
      customer_id: score.customerId,
      propensity_score: score.propensityScore,
      confidence: score.confidenceValue,
      contributing_factors: score.contributingFactors,
      recommended_products: score.recommendedProducts,
      estimated_value: score.estimatedValue,
      calculated_at: score.calculatedAt,
    }, {
      onConflict: 'customer_id',
    });
  } catch (error) {
    console.error('Error storing propensity score:', error);
  }
}

async function getCachedPropensity(customerId: string): Promise<PropensityScore | null> {
  if (!supabase) return null;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('expansion_propensity')
      .select('*')
      .eq('customer_id', customerId)
      .gte('calculated_at', oneDayAgo)
      .single();

    if (!data) return null;

    // Fetch customer name
    const { data: customer } = await supabase
      .from('customers')
      .select('name, arr, plan, health_score, contracted_seats, active_users, renewal_date')
      .eq('id', customerId)
      .single();

    // Reconstruct the score object
    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: customer?.name || 'Unknown',
      propensityScore: data.propensity_score,
      confidence: data.confidence >= 0.75 ? 'high' : data.confidence >= 0.5 ? 'medium' : 'low',
      confidenceValue: data.confidence,
      contributingFactors: data.contributing_factors || [],
      recommendedProducts: data.recommended_products || [],
      estimatedValue: data.estimated_value,
      approach: {
        champion: null,
        entryPoint: 'Capacity planning discussion',
        timing: 'This quarter',
        talkingPoints: [],
      },
      calculatedAt: data.calculated_at,
      scoreBreakdown: {
        usage: 70,
        engagement: 65,
        health: customer?.health_score || 70,
        business: 70,
        stakeholder: 60,
        cohort: 60,
      },
      primarySignal: (data.contributing_factors as ContributingFactor[])?.[0]?.description || 'General expansion potential',
      currentState: {
        arr: customer?.arr || 0,
        plan: customer?.plan || 'Standard',
        healthScore: customer?.health_score || 70,
        activeUsers: customer?.active_users || 0,
        contractedSeats: customer?.contracted_seats || 0,
        daysToRenewal: customer?.renewal_date
          ? Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : null,
        usageCapacity: 75,
      },
    };
  } catch (error) {
    console.error('Error fetching cached propensity:', error);
    return null;
  }
}

// ============================================
// Exports
// ============================================

export default {
  calculatePropensity,
  calculatePropensityBatch,
  getTopExpansionOpportunities,
  getPortfolioPropensityStats,
  getCustomerPropensity,
};
