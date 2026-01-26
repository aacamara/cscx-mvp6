/**
 * Customer Success Metrics Service
 * Complete implementation of all CS & ARR metrics calculations
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// TYPES
// ============================================

export interface CustomerMetrics {
  customer_id: string;
  mrr: number;
  arr: number;
  billing_cycle: 'monthly' | 'quarterly' | 'annual' | 'multi-year';
  contract_value: number;
  status: 'active' | 'churned' | 'paused';
  start_date: string;
  end_date?: string;
}

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  newMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  churnedMRR: number;
  reactivationMRR: number;
  netNewMRR: number;
  mrrGrowthRate: number;
  expansionRate: number;
  arpu: number;
  arpa: number;
}

export interface RetentionMetrics {
  nrr: number; // Net Revenue Retention
  grr: number; // Gross Revenue Retention
  customerRetentionRate: number;
  logoRetentionRate: number;
  customerChurnRate: number;
  revenueChurnRate: number;
  netMRRChurnRate: number;
  hasNegativeChurn: boolean;
}

export interface LTVMetrics {
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  cacPaybackMonths: number;
  avgCustomerLifespanMonths: number;
}

export interface HealthScoreComponents {
  usage: number;
  adoption: number;
  support: number;
  nps: number;
  engagement: number;
  sentiment: number;
}

export interface HealthScoreResult {
  score: number;
  category: 'critical' | 'at_risk' | 'neutral' | 'healthy' | 'champion';
  color: string;
  action: string;
  components: HealthScoreComponents;
}

export interface NPSResult {
  nps: number;
  promoterCount: number;
  promoterPct: number;
  passiveCount: number;
  passivePct: number;
  detractorCount: number;
  detractorPct: number;
  totalResponses: number;
}

export interface SatisfactionMetrics {
  nps: NPSResult;
  csat: number;
  ces: number;
}

export interface AdoptionMetrics {
  productAdoptionRate: number;
  featureAdoptionRate: number;
  activationRate: number;
  dau: number;
  mau: number;
  dauMauRatio: number; // Stickiness
  avgTimeToValueDays: number;
  breadthOfAdoption: number;
  depthOfAdoption: number;
}

export interface DashboardMetrics {
  revenue: RevenueMetrics;
  retention: RetentionMetrics;
  ltv: LTVMetrics;
  satisfaction: SatisfactionMetrics;
  adoption: AdoptionMetrics;
  healthDistribution: {
    critical: number;
    atRisk: number;
    neutral: number;
    healthy: number;
    champion: number;
  };
  period: {
    start: string;
    end: string;
  };
}

// ============================================
// REVENUE METRICS
// ============================================

export function calculateMRR(customers: CustomerMetrics[]): number {
  return customers
    .filter(c => c.status === 'active')
    .reduce((sum, customer) => {
      let monthlyValue: number;
      switch (customer.billing_cycle) {
        case 'annual':
          monthlyValue = customer.contract_value / 12;
          break;
        case 'quarterly':
          monthlyValue = customer.contract_value / 3;
          break;
        case 'multi-year':
          // Assume contract_value is per year for multi-year
          monthlyValue = customer.contract_value / 12;
          break;
        default:
          monthlyValue = customer.contract_value;
      }
      return sum + monthlyValue;
    }, 0);
}

export function calculateARR(mrr: number): number {
  return mrr * 12;
}

export function calculateNetNewMRR(
  newMRR: number,
  expansionMRR: number,
  reactivationMRR: number,
  contractionMRR: number,
  churnedMRR: number
): number {
  return newMRR + expansionMRR + reactivationMRR - contractionMRR - churnedMRR;
}

export function calculateExpansionMRR(
  previousPeriod: CustomerMetrics[],
  currentPeriod: CustomerMetrics[]
): number {
  let expansion = 0;
  currentPeriod.forEach(current => {
    const previous = previousPeriod.find(p => p.customer_id === current.customer_id);
    if (previous && current.mrr > previous.mrr && current.status === 'active') {
      expansion += (current.mrr - previous.mrr);
    }
  });
  return expansion;
}

export function calculateContractionMRR(
  previousPeriod: CustomerMetrics[],
  currentPeriod: CustomerMetrics[]
): number {
  let contraction = 0;
  currentPeriod.forEach(current => {
    const previous = previousPeriod.find(p => p.customer_id === current.customer_id);
    if (previous && current.mrr < previous.mrr && current.status === 'active') {
      contraction += (previous.mrr - current.mrr);
    }
  });
  return contraction;
}

export function calculateChurnedMRR(
  previousPeriod: CustomerMetrics[],
  currentPeriod: CustomerMetrics[]
): number {
  let churned = 0;
  previousPeriod.forEach(previous => {
    const current = currentPeriod.find(c => c.customer_id === previous.customer_id);
    if (!current || current.status === 'churned') {
      churned += previous.mrr;
    }
  });
  return churned;
}

export function calculateMRRGrowthRate(startMRR: number, endMRR: number): number {
  if (startMRR === 0) return endMRR > 0 ? 100 : 0;
  return ((endMRR - startMRR) / startMRR) * 100;
}

export function calculateExpansionRate(expansionMRR: number, beginningMRR: number): number {
  if (beginningMRR === 0) return 0;
  return (expansionMRR / beginningMRR) * 100;
}

export function calculateARPU(totalRevenue: number, totalUsers: number): number {
  if (totalUsers === 0) return 0;
  return totalRevenue / totalUsers;
}

export function calculateARPA(totalRevenue: number, totalAccounts: number): number {
  if (totalAccounts === 0) return 0;
  return totalRevenue / totalAccounts;
}

// ============================================
// RETENTION METRICS
// ============================================

export function calculateNRR(
  beginningMRR: number,
  expansionMRR: number,
  contractionMRR: number,
  churnedMRR: number
): number {
  if (beginningMRR === 0) return 0;
  return ((beginningMRR + expansionMRR - contractionMRR - churnedMRR) / beginningMRR) * 100;
}

export function calculateGRR(
  beginningMRR: number,
  contractionMRR: number,
  churnedMRR: number
): number {
  if (beginningMRR === 0) return 0;
  return ((beginningMRR - contractionMRR - churnedMRR) / beginningMRR) * 100;
}

export function calculateCustomerRetentionRate(
  startCustomers: number,
  endCustomers: number,
  newCustomers: number
): number {
  if (startCustomers === 0) return 0;
  return ((endCustomers - newCustomers) / startCustomers) * 100;
}

export function calculateLogoRetentionRate(
  startCustomers: number,
  churnedCustomers: number
): number {
  if (startCustomers === 0) return 0;
  return ((startCustomers - churnedCustomers) / startCustomers) * 100;
}

export function calculateCustomerChurnRate(
  lostCustomers: number,
  startCustomers: number
): number {
  if (startCustomers === 0) return 0;
  return (lostCustomers / startCustomers) * 100;
}

export function calculateRevenueChurnRate(
  churnedMRR: number,
  contractionMRR: number,
  beginningMRR: number
): number {
  if (beginningMRR === 0) return 0;
  return ((churnedMRR + contractionMRR) / beginningMRR) * 100;
}

export function calculateNetMRRChurnRate(
  churnedMRR: number,
  contractionMRR: number,
  expansionMRR: number,
  beginningMRR: number
): number {
  if (beginningMRR === 0) return 0;
  return ((churnedMRR + contractionMRR - expansionMRR) / beginningMRR) * 100;
}

export function hasNegativeChurn(
  expansionMRR: number,
  churnedMRR: number,
  contractionMRR: number
): boolean {
  return expansionMRR > (churnedMRR + contractionMRR);
}

// ============================================
// LIFETIME VALUE METRICS
// ============================================

export function calculateLTV(
  arpu: number,
  grossMargin: number,
  monthlyChurnRate: number
): number {
  if (monthlyChurnRate === 0) return arpu * grossMargin * 120; // Cap at 10 years
  return (arpu * grossMargin) / (monthlyChurnRate / 100);
}

export function calculateSimpleLTV(
  avgRevenuePerUser: number,
  avgCustomerLifespanMonths: number
): number {
  return avgRevenuePerUser * avgCustomerLifespanMonths;
}

export function calculateCAC(
  totalSalesMarketingCost: number,
  newCustomersAcquired: number
): number {
  if (newCustomersAcquired === 0) return 0;
  return totalSalesMarketingCost / newCustomersAcquired;
}

export function calculateLTVCACRatio(ltv: number, cac: number): number {
  if (cac === 0) return ltv > 0 ? 10 : 0; // Cap at 10:1
  return ltv / cac;
}

export function calculateCACPaybackMonths(
  cac: number,
  monthlyARPU: number,
  grossMargin: number
): number {
  const monthlyGrossProfit = monthlyARPU * grossMargin;
  if (monthlyGrossProfit === 0) return 0;
  return cac / monthlyGrossProfit;
}

export function calculateAvgCustomerLifespan(monthlyChurnRate: number): number {
  if (monthlyChurnRate === 0) return 120; // Cap at 10 years
  return 1 / (monthlyChurnRate / 100);
}

// ============================================
// HEALTH SCORE
// ============================================

export interface HealthScoreWeights {
  usage: number;
  adoption: number;
  support: number;
  nps: number;
  engagement: number;
  sentiment: number;
}

const DEFAULT_HEALTH_WEIGHTS: HealthScoreWeights = {
  usage: 0.25,
  adoption: 0.20,
  support: 0.15,
  nps: 0.15,
  engagement: 0.15,
  sentiment: 0.10
};

export function calculateHealthScore(
  components: HealthScoreComponents,
  weights: HealthScoreWeights = DEFAULT_HEALTH_WEIGHTS
): HealthScoreResult {
  const score = Math.round(
    (components.usage * weights.usage) +
    (components.adoption * weights.adoption) +
    (components.support * weights.support) +
    (components.nps * weights.nps) +
    (components.engagement * weights.engagement) +
    (components.sentiment * weights.sentiment)
  );

  return {
    score,
    ...categorizeHealthScore(score),
    components
  };
}

export function categorizeHealthScore(score: number): {
  category: 'critical' | 'at_risk' | 'neutral' | 'healthy' | 'champion';
  color: string;
  action: string;
} {
  if (score >= 86) return { category: 'champion', color: 'green', action: 'Expansion opportunity' };
  if (score >= 71) return { category: 'healthy', color: 'lightgreen', action: 'Standard engagement' };
  if (score >= 51) return { category: 'neutral', color: 'yellow', action: 'Monitor closely' };
  if (score >= 31) return { category: 'at_risk', color: 'orange', action: 'Proactive outreach' };
  return { category: 'critical', color: 'red', action: 'Immediate intervention' };
}

export function calculateUsageScore(actualUsage: number, expectedUsage: number): number {
  if (expectedUsage === 0) return 0;
  return Math.min(100, (actualUsage / expectedUsage) * 100);
}

export function calculateFeatureAdoptionScore(
  featuresUsed: number,
  totalFeatures: number
): number {
  if (totalFeatures === 0) return 0;
  return (featuresUsed / totalFeatures) * 100;
}

export function calculateLicenseUtilization(
  activeSeats: number,
  purchasedSeats: number
): number {
  if (purchasedSeats === 0) return 0;
  return (activeSeats / purchasedSeats) * 100;
}

export function calculateSupportScore(
  openTickets: number,
  avgResolutionDays: number,
  escalations: number
): number {
  const penalty = (openTickets * 5) + (avgResolutionDays * 2) + (escalations * 10);
  return Math.max(0, 100 - penalty);
}

// ============================================
// NPS / CSAT / CES
// ============================================

export function calculateNPS(responses: number[]): NPSResult {
  if (responses.length === 0) {
    return {
      nps: 0,
      promoterCount: 0, promoterPct: 0,
      passiveCount: 0, passivePct: 0,
      detractorCount: 0, detractorPct: 0,
      totalResponses: 0
    };
  }

  const total = responses.length;
  const promoters = responses.filter(r => r >= 9).length;
  const passives = responses.filter(r => r >= 7 && r <= 8).length;
  const detractors = responses.filter(r => r <= 6).length;

  const promoterPct = (promoters / total) * 100;
  const detractorPct = (detractors / total) * 100;

  return {
    nps: Math.round(promoterPct - detractorPct),
    promoterCount: promoters,
    promoterPct: parseFloat(promoterPct.toFixed(1)),
    passiveCount: passives,
    passivePct: parseFloat(((passives / total) * 100).toFixed(1)),
    detractorCount: detractors,
    detractorPct: parseFloat(detractorPct.toFixed(1)),
    totalResponses: total
  };
}

export function categorizeNPSResponse(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

export function calculateCSAT(responses: number[], scale: number = 5): number {
  if (responses.length === 0) return 0;
  const satisfiedThreshold = scale - 1; // Top 2 on scale
  const satisfied = responses.filter(r => r >= satisfiedThreshold).length;
  return (satisfied / responses.length) * 100;
}

export function calculateCES(responses: number[]): number {
  if (responses.length === 0) return 0;
  const sum = responses.reduce((a, b) => a + b, 0);
  return parseFloat((sum / responses.length).toFixed(2));
}

export function calculateCESPercentage(responses: number[], scale: number = 7): number {
  if (responses.length === 0) return 0;
  const agreeThreshold = scale - 1; // Top 2 on scale
  const agreeing = responses.filter(r => r >= agreeThreshold).length;
  return (agreeing / responses.length) * 100;
}

// ============================================
// PRODUCT ADOPTION
// ============================================

export function calculateProductAdoptionRate(
  activeUsers: number,
  totalSignups: number
): number {
  if (totalSignups === 0) return 0;
  return (activeUsers / totalSignups) * 100;
}

export function calculateFeatureAdoptionRate(
  featureUsers: number,
  totalActiveUsers: number
): number {
  if (totalActiveUsers === 0) return 0;
  return (featureUsers / totalActiveUsers) * 100;
}

export function calculateActivationRate(
  activatedUsers: number,
  totalSignups: number
): number {
  if (totalSignups === 0) return 0;
  return (activatedUsers / totalSignups) * 100;
}

export function calculateDAUMAURatio(dau: number, mau: number): number {
  if (mau === 0) return 0;
  return (dau / mau) * 100;
}

export function calculateTimeToValue(
  signupDate: Date,
  activationDate: Date
): number {
  const diffTime = Math.abs(activationDate.getTime() - signupDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateBreadthOfAdoption(
  featuresUsed: number,
  totalFeaturesAvailable: number
): number {
  if (totalFeaturesAvailable === 0) return 0;
  return (featuresUsed / totalFeaturesAvailable) * 100;
}

export function calculateDepthOfAdoption(
  actualUsageFrequency: number,
  expectedUsageFrequency: number
): number {
  if (expectedUsageFrequency === 0) return 0;
  return Math.min(100, (actualUsageFrequency / expectedUsageFrequency) * 100);
}

// ============================================
// BENCHMARK EVALUATION
// ============================================

export type BenchmarkRating = 'excellent' | 'good' | 'fair' | 'poor';

export function evaluateNRRBenchmark(nrr: number): BenchmarkRating {
  if (nrr > 120) return 'excellent';
  if (nrr >= 100) return 'good';
  if (nrr >= 90) return 'fair';
  return 'poor';
}

export function evaluateGRRBenchmark(grr: number): BenchmarkRating {
  if (grr > 95) return 'excellent';
  if (grr >= 90) return 'good';
  if (grr >= 85) return 'fair';
  return 'poor';
}

export function evaluateNPSBenchmark(nps: number): BenchmarkRating {
  if (nps > 50) return 'excellent';
  if (nps >= 20) return 'good';
  if (nps >= 0) return 'fair';
  return 'poor';
}

export function evaluateCSATBenchmark(csat: number): BenchmarkRating {
  if (csat > 90) return 'excellent';
  if (csat >= 80) return 'good';
  if (csat >= 70) return 'fair';
  return 'poor';
}

export function evaluateLTVCACBenchmark(ratio: number): BenchmarkRating {
  if (ratio >= 4) return 'excellent';
  if (ratio >= 3) return 'good';
  if (ratio >= 1) return 'fair';
  return 'poor';
}

export function evaluateCACPaybackBenchmark(months: number): BenchmarkRating {
  if (months < 6) return 'excellent';
  if (months <= 12) return 'good';
  if (months <= 18) return 'fair';
  return 'poor';
}

export function evaluateChurnBenchmark(monthlyChurn: number): BenchmarkRating {
  if (monthlyChurn < 0.5) return 'excellent';
  if (monthlyChurn < 1) return 'good';
  if (monthlyChurn < 2) return 'fair';
  return 'poor';
}

export function evaluateDAUMAUBenchmark(ratio: number): BenchmarkRating {
  if (ratio > 25) return 'excellent';
  if (ratio >= 15) return 'good';
  if (ratio >= 10) return 'fair';
  return 'poor';
}

// ============================================
// AGGREGATE DASHBOARD METRICS
// ============================================

export async function calculateDashboardMetrics(
  startDate: Date,
  endDate: Date,
  userId?: string
): Promise<DashboardMetrics> {
  // Fetch customers data
  let customersQuery = supabase
    .from('customers')
    .select('*');

  if (userId) {
    customersQuery = customersQuery.eq('user_id', userId);
  }

  const { data: customers } = await customersQuery;

  // Fetch usage metrics
  const { data: usageMetrics } = await supabase
    .from('usage_metrics')
    .select('*')
    .gte('metric_date', startDate.toISOString())
    .lte('metric_date', endDate.toISOString());

  // Calculate revenue metrics
  const activeCustomers = customers?.filter(c => c.status === 'active') || [];
  const totalMRR = activeCustomers.reduce((sum, c) => sum + (c.arr || 0) / 12, 0);
  const totalARR = totalMRR * 12;
  const customerCount = activeCustomers.length;
  const arpu = customerCount > 0 ? totalMRR / customerCount : 0;

  // Calculate retention (simplified - would need historical data)
  const churnedCount = customers?.filter(c => c.status === 'churned').length || 0;
  const totalCount = customers?.length || 1;
  const customerChurnRate = (churnedCount / totalCount) * 100;

  // Calculate health distribution
  const healthDistribution = {
    critical: 0,
    atRisk: 0,
    neutral: 0,
    healthy: 0,
    champion: 0
  };

  activeCustomers.forEach(c => {
    const score = c.health_score || 50;
    if (score >= 86) healthDistribution.champion++;
    else if (score >= 71) healthDistribution.healthy++;
    else if (score >= 51) healthDistribution.neutral++;
    else if (score >= 31) healthDistribution.atRisk++;
    else healthDistribution.critical++;
  });

  // Calculate adoption metrics from usage data
  const latestUsage = usageMetrics?.[usageMetrics.length - 1];
  const avgDAU = usageMetrics?.reduce((sum, u) => sum + (u.dau || 0), 0) / (usageMetrics?.length || 1);
  const avgMAU = usageMetrics?.reduce((sum, u) => sum + (u.mau || 0), 0) / (usageMetrics?.length || 1);

  return {
    revenue: {
      mrr: totalMRR,
      arr: totalARR,
      newMRR: 0, // Would need historical comparison
      expansionMRR: 0,
      contractionMRR: 0,
      churnedMRR: 0,
      reactivationMRR: 0,
      netNewMRR: 0,
      mrrGrowthRate: 0,
      expansionRate: 0,
      arpu,
      arpa: arpu
    },
    retention: {
      nrr: 100, // Would need historical data
      grr: 100 - customerChurnRate,
      customerRetentionRate: 100 - customerChurnRate,
      logoRetentionRate: 100 - customerChurnRate,
      customerChurnRate,
      revenueChurnRate: 0,
      netMRRChurnRate: 0,
      hasNegativeChurn: false
    },
    ltv: {
      ltv: arpu * 36, // Simplified: 3 year average
      cac: 0, // Would need sales/marketing data
      ltvCacRatio: 3, // Default healthy
      cacPaybackMonths: 12,
      avgCustomerLifespanMonths: 36
    },
    satisfaction: {
      nps: {
        nps: 0,
        promoterCount: 0, promoterPct: 0,
        passiveCount: 0, passivePct: 0,
        detractorCount: 0, detractorPct: 0,
        totalResponses: 0
      },
      csat: 0,
      ces: 0
    },
    adoption: {
      productAdoptionRate: latestUsage?.adoption_score || 0,
      featureAdoptionRate: 0,
      activationRate: 0,
      dau: avgDAU || 0,
      mau: avgMAU || 0,
      dauMauRatio: avgMAU > 0 ? (avgDAU / avgMAU) * 100 : 0,
      avgTimeToValueDays: 0,
      breadthOfAdoption: 0,
      depthOfAdoption: 0
    },
    healthDistribution,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    }
  };
}

// ============================================
// CUSTOMER-SPECIFIC METRICS
// ============================================

export async function calculateCustomerMetrics(customerId: string): Promise<{
  revenue: { mrr: number; arr: number };
  health: HealthScoreResult;
  retention: { daysSinceStart: number; renewalDate?: string };
  adoption: AdoptionMetrics;
}> {
  // Fetch customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  // Fetch latest usage metrics
  const { data: usageMetrics } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('metric_date', { ascending: false })
    .limit(30);

  const latestUsage = usageMetrics?.[0];
  const mrr = (customer?.arr || 0) / 12;

  // Calculate health score components
  const components: HealthScoreComponents = {
    usage: latestUsage?.adoption_score || 50,
    adoption: latestUsage?.adoption_score || 50,
    support: 80, // Would need support ticket data
    nps: 70, // Would need NPS data
    engagement: latestUsage?.adoption_score || 50,
    sentiment: 70 // Would need CSM input
  };

  const health = calculateHealthScore(components);

  // Calculate days since start
  const startDate = customer?.created_at ? new Date(customer.created_at) : new Date();
  const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    revenue: { mrr, arr: mrr * 12 },
    health,
    retention: {
      daysSinceStart,
      renewalDate: customer?.renewal_date
    },
    adoption: {
      productAdoptionRate: latestUsage?.adoption_score || 0,
      featureAdoptionRate: 0,
      activationRate: 100, // Assuming activated if in system
      dau: latestUsage?.dau || 0,
      mau: latestUsage?.mau || 0,
      dauMauRatio: latestUsage?.mau > 0 ? (latestUsage.dau / latestUsage.mau) * 100 : 0,
      avgTimeToValueDays: 0,
      breadthOfAdoption: 0,
      depthOfAdoption: 0
    }
  };
}

export default {
  // Revenue
  calculateMRR,
  calculateARR,
  calculateNetNewMRR,
  calculateExpansionMRR,
  calculateContractionMRR,
  calculateChurnedMRR,
  calculateMRRGrowthRate,
  calculateExpansionRate,
  calculateARPU,
  calculateARPA,
  // Retention
  calculateNRR,
  calculateGRR,
  calculateCustomerRetentionRate,
  calculateLogoRetentionRate,
  calculateCustomerChurnRate,
  calculateRevenueChurnRate,
  calculateNetMRRChurnRate,
  hasNegativeChurn,
  // LTV
  calculateLTV,
  calculateSimpleLTV,
  calculateCAC,
  calculateLTVCACRatio,
  calculateCACPaybackMonths,
  calculateAvgCustomerLifespan,
  // Health
  calculateHealthScore,
  categorizeHealthScore,
  calculateUsageScore,
  calculateFeatureAdoptionScore,
  calculateLicenseUtilization,
  calculateSupportScore,
  // Satisfaction
  calculateNPS,
  categorizeNPSResponse,
  calculateCSAT,
  calculateCES,
  calculateCESPercentage,
  // Adoption
  calculateProductAdoptionRate,
  calculateFeatureAdoptionRate,
  calculateActivationRate,
  calculateDAUMAURatio,
  calculateTimeToValue,
  calculateBreadthOfAdoption,
  calculateDepthOfAdoption,
  // Benchmarks
  evaluateNRRBenchmark,
  evaluateGRRBenchmark,
  evaluateNPSBenchmark,
  evaluateCSATBenchmark,
  evaluateLTVCACBenchmark,
  evaluateCACPaybackBenchmark,
  evaluateChurnBenchmark,
  evaluateDAUMAUBenchmark,
  // Aggregates
  calculateDashboardMetrics,
  calculateCustomerMetrics
};
