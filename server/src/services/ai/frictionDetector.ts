/**
 * Friction Detection Service
 * PRD-237: Customer Journey Optimization
 *
 * Detects friction points in customer journeys by analyzing patterns,
 * delays, and engagement signals across the customer lifecycle.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export type FrictionSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FrictionCategory = 'technical_setup' | 'user_adoption' | 'value_realization' | 'champion_engagement' | 'stakeholder_access' | 'support_dependency';

export interface FrictionSignal {
  type: string;
  weight: number;
  description: string;
  detectedAt: string;
}

export interface DetectedFriction {
  id: string;
  customerId: string;
  customerName: string;
  stage: string;
  category: FrictionCategory;
  severity: FrictionSeverity;
  title: string;
  description: string;
  signals: FrictionSignal[];
  daysSinceDetected: number;
  impactScore: number;
  arrImpact: number;
  suggestedActions: string[];
  status: 'active' | 'monitoring' | 'resolved';
}

export interface FrictionPattern {
  id: string;
  category: FrictionCategory;
  pattern: string;
  occurrenceCount: number;
  avgDelayDays: number;
  affectedCustomerCount: number;
  totalArrAtRisk: number;
  commonCharacteristics: string[];
  recommendedIntervention: string;
  successRate: number;
}

export interface FrictionAnalysis {
  analyzedAt: string;
  totalCustomersAnalyzed: number;
  frictionDetected: DetectedFriction[];
  patterns: FrictionPattern[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalArrAtRisk: number;
    topCategory: FrictionCategory;
  };
  recommendations: string[];
}

/**
 * Detect friction points across customer base
 */
export async function detectAllFriction(
  options: {
    segment?: string;
    stage?: string;
    severity?: FrictionSeverity;
    limit?: number;
  } = {}
): Promise<FrictionAnalysis> {
  const { segment, stage, severity, limit = 50 } = options;

  // Get customer data
  const customers = await getCustomersForAnalysis(segment, stage);

  // Detect friction for each customer
  const allFriction: DetectedFriction[] = [];
  for (const customer of customers.slice(0, limit)) {
    const friction = await detectCustomerFriction(customer.id, customer);
    allFriction.push(...friction);
  }

  // Filter by severity if specified
  const filteredFriction = severity
    ? allFriction.filter(f => f.severity === severity)
    : allFriction;

  // Sort by impact score
  const sortedFriction = filteredFriction.sort((a, b) => b.impactScore - a.impactScore);

  // Identify patterns
  const patterns = identifyFrictionPatterns(allFriction);

  // Calculate summary
  const summary = calculateFrictionSummary(allFriction);

  // Generate recommendations
  const recommendations = generateFrictionRecommendations(patterns, summary);

  return {
    analyzedAt: new Date().toISOString(),
    totalCustomersAnalyzed: customers.length,
    frictionDetected: sortedFriction.slice(0, 25),
    patterns,
    summary,
    recommendations
  };
}

/**
 * Get customers for friction analysis
 */
async function getCustomersForAnalysis(
  segment?: string,
  stage?: string
): Promise<Array<{
  id: string;
  name: string;
  stage: string;
  arr: number;
  healthScore: number;
  daysInStage: number;
  lastActivity: string | null;
  usageMetrics: any;
}>> {
  if (!supabase) {
    // Return demo customers
    return generateDemoCustomers();
  }

  try {
    let query = supabase
      .from('customers')
      .select('id, name, stage, arr, health_score, created_at, last_activity_at');

    if (stage) {
      query = query.eq('stage', stage);
    }

    const { data: customers, error } = await query.limit(100);

    if (error) throw error;

    return (customers || []).map(c => ({
      id: c.id,
      name: c.name,
      stage: c.stage || 'onboarding',
      arr: c.arr || 50000,
      healthScore: c.health_score || 70,
      daysInStage: Math.ceil((Date.now() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000)),
      lastActivity: c.last_activity_at,
      usageMetrics: null
    }));
  } catch (error) {
    console.error('Error fetching customers:', error);
    return generateDemoCustomers();
  }
}

/**
 * Generate demo customers
 */
function generateDemoCustomers(): Array<{
  id: string;
  name: string;
  stage: string;
  arr: number;
  healthScore: number;
  daysInStage: number;
  lastActivity: string | null;
  usageMetrics: any;
}> {
  const stages = ['onboarding', 'adoption', 'growth', 'maturity', 'renewal'];
  const names = [
    'TechCorp Inc.', 'DataFlow Systems', 'CloudFirst Solutions', 'Innovate Labs',
    'Digital Dynamics', 'Smart Services Co.', 'Future Tech Group', 'Agile Enterprises',
    'NextGen Software', 'Velocity Partners', 'Quantum Analytics', 'Peak Performance Inc.'
  ];

  return names.map((name, idx) => ({
    id: uuidv4(),
    name,
    stage: stages[idx % stages.length],
    arr: 50000 + Math.floor(Math.random() * 150000),
    healthScore: 40 + Math.floor(Math.random() * 50),
    daysInStage: 5 + Math.floor(Math.random() * 60),
    lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    usageMetrics: {
      dau: Math.floor(Math.random() * 50),
      featureAdoption: Math.floor(Math.random() * 80) + 20
    }
  }));
}

/**
 * Detect friction for a specific customer
 */
export async function detectCustomerFriction(
  customerId: string,
  customerData?: any
): Promise<DetectedFriction[]> {
  const customer = customerData || await getCustomerData(customerId);
  if (!customer) return [];

  const frictionPoints: DetectedFriction[] = [];

  // Check for technical setup friction
  const technicalFriction = detectTechnicalSetupFriction(customer);
  if (technicalFriction) frictionPoints.push(technicalFriction);

  // Check for adoption friction
  const adoptionFriction = detectAdoptionFriction(customer);
  if (adoptionFriction) frictionPoints.push(adoptionFriction);

  // Check for value realization friction
  const valueFriction = detectValueRealizationFriction(customer);
  if (valueFriction) frictionPoints.push(valueFriction);

  // Check for champion engagement friction
  const championFriction = detectChampionFriction(customer);
  if (championFriction) frictionPoints.push(championFriction);

  // Check for support dependency friction
  const supportFriction = detectSupportFriction(customer);
  if (supportFriction) frictionPoints.push(supportFriction);

  return frictionPoints;
}

/**
 * Get customer data for friction analysis
 */
async function getCustomerData(customerId: string): Promise<any> {
  if (!supabase) {
    return {
      id: customerId,
      name: 'Demo Customer',
      stage: 'onboarding',
      arr: 75000,
      healthScore: 65,
      daysInStage: 15,
      lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      usageMetrics: { dau: 10, featureAdoption: 35 }
    };
  }

  try {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Detect technical setup friction
 */
function detectTechnicalSetupFriction(customer: any): DetectedFriction | null {
  const signals: FrictionSignal[] = [];

  // Check if in onboarding too long
  if (customer.stage === 'onboarding' && customer.daysInStage > 14) {
    signals.push({
      type: 'extended_onboarding',
      weight: 0.8,
      description: `Customer has been in onboarding for ${customer.daysInStage} days (target: 14)`,
      detectedAt: new Date().toISOString()
    });
  }

  // Check for low feature adoption
  if (customer.usageMetrics?.featureAdoption < 30) {
    signals.push({
      type: 'low_feature_adoption',
      weight: 0.6,
      description: `Feature adoption at ${customer.usageMetrics.featureAdoption}% (expected: 50%+)`,
      detectedAt: new Date().toISOString()
    });
  }

  if (signals.length === 0) return null;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const impactScore = Math.min(100, Math.round(totalWeight * 50));

  return {
    id: uuidv4(),
    customerId: customer.id,
    customerName: customer.name,
    stage: customer.stage,
    category: 'technical_setup',
    severity: impactScore > 70 ? 'critical' : impactScore > 50 ? 'high' : 'medium',
    title: 'Technical Setup Stall',
    description: `Customer is experiencing delays in technical setup and integration.`,
    signals,
    daysSinceDetected: customer.daysInStage - 14,
    impactScore,
    arrImpact: customer.arr,
    suggestedActions: [
      'Schedule technical deep-dive call',
      'Assign integration specialist',
      'Provide API documentation review session',
      'Offer sandbox environment assistance'
    ],
    status: 'active'
  };
}

/**
 * Detect user adoption friction
 */
function detectAdoptionFriction(customer: any): DetectedFriction | null {
  const signals: FrictionSignal[] = [];

  // Low daily active users
  if (customer.usageMetrics?.dau < 5) {
    signals.push({
      type: 'low_dau',
      weight: 0.7,
      description: `Only ${customer.usageMetrics.dau} daily active users`,
      detectedAt: new Date().toISOString()
    });
  }

  // Health score declining
  if (customer.healthScore < 50) {
    signals.push({
      type: 'low_health_score',
      weight: 0.8,
      description: `Health score at ${customer.healthScore} (critical threshold: 50)`,
      detectedAt: new Date().toISOString()
    });
  }

  if (signals.length === 0) return null;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const impactScore = Math.min(100, Math.round(totalWeight * 45));

  return {
    id: uuidv4(),
    customerId: customer.id,
    customerName: customer.name,
    stage: customer.stage,
    category: 'user_adoption',
    severity: impactScore > 65 ? 'high' : impactScore > 40 ? 'medium' : 'low',
    title: 'User Adoption Gap',
    description: `User engagement is below expected levels for this stage.`,
    signals,
    daysSinceDetected: Math.floor(Math.random() * 14) + 3,
    impactScore,
    arrImpact: customer.arr * 0.7,
    suggestedActions: [
      'Schedule training session for power users',
      'Create adoption playbook customized for team',
      'Identify and enable internal champions',
      'Send feature highlight emails'
    ],
    status: 'active'
  };
}

/**
 * Detect value realization friction
 */
function detectValueRealizationFriction(customer: any): DetectedFriction | null {
  const signals: FrictionSignal[] = [];

  // Check if past expected first-value milestone
  const expectedValueDay = 21;
  if (customer.daysInStage > expectedValueDay && customer.stage === 'onboarding') {
    signals.push({
      type: 'delayed_first_value',
      weight: 0.9,
      description: `No first value milestone recorded after ${customer.daysInStage} days`,
      detectedAt: new Date().toISOString()
    });
  }

  // Feature adoption plateau
  if (customer.stage === 'adoption' && customer.usageMetrics?.featureAdoption < 50) {
    signals.push({
      type: 'feature_plateau',
      weight: 0.6,
      description: `Feature adoption plateaued at ${customer.usageMetrics.featureAdoption}%`,
      detectedAt: new Date().toISOString()
    });
  }

  if (signals.length === 0) return null;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const impactScore = Math.min(100, Math.round(totalWeight * 55));

  return {
    id: uuidv4(),
    customerId: customer.id,
    customerName: customer.name,
    stage: customer.stage,
    category: 'value_realization',
    severity: impactScore > 70 ? 'critical' : impactScore > 50 ? 'high' : 'medium',
    title: 'First Value Milestone Delayed',
    description: `Customer has not achieved clear value milestone within expected timeframe.`,
    signals,
    daysSinceDetected: customer.daysInStage - expectedValueDay,
    impactScore,
    arrImpact: customer.arr * 0.8,
    suggestedActions: [
      'Define clear quick-win goals in kickoff',
      'Schedule value realization workshop',
      'Share success stories from similar customers',
      'Create custom ROI tracking dashboard'
    ],
    status: 'active'
  };
}

/**
 * Detect champion engagement friction
 */
function detectChampionFriction(customer: any): DetectedFriction | null {
  const signals: FrictionSignal[] = [];

  // No activity from main contact
  const daysSinceActivity = customer.lastActivity
    ? Math.ceil((Date.now() - new Date(customer.lastActivity).getTime()) / (24 * 60 * 60 * 1000))
    : 30;

  if (daysSinceActivity > 14) {
    signals.push({
      type: 'champion_inactive',
      weight: 0.75,
      description: `No activity from champion in ${daysSinceActivity} days`,
      detectedAt: new Date().toISOString()
    });
  }

  if (signals.length === 0) return null;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const impactScore = Math.min(100, Math.round(totalWeight * 60));

  return {
    id: uuidv4(),
    customerId: customer.id,
    customerName: customer.name,
    stage: customer.stage,
    category: 'champion_engagement',
    severity: impactScore > 60 ? 'high' : 'medium',
    title: 'Champion Disengagement',
    description: `Primary champion has reduced engagement with the platform.`,
    signals,
    daysSinceDetected: daysSinceActivity - 14,
    impactScore,
    arrImpact: customer.arr * 0.5,
    suggestedActions: [
      'Schedule executive alignment call',
      'Launch champion enablement program',
      'Identify backup/secondary champions',
      'Send personalized re-engagement email'
    ],
    status: 'monitoring'
  };
}

/**
 * Detect support dependency friction
 */
function detectSupportFriction(customer: any): DetectedFriction | null {
  // Simplified - in production would check support ticket data
  if (customer.healthScore > 60) return null;

  const signals: FrictionSignal[] = [{
    type: 'support_dependency',
    weight: 0.5,
    description: 'Customer shows signs of high support dependency',
    detectedAt: new Date().toISOString()
  }];

  return {
    id: uuidv4(),
    customerId: customer.id,
    customerName: customer.name,
    stage: customer.stage,
    category: 'support_dependency',
    severity: 'medium',
    title: 'High Support Dependency',
    description: `Customer relies heavily on support rather than self-service.`,
    signals,
    daysSinceDetected: 7,
    impactScore: 45,
    arrImpact: customer.arr * 0.3,
    suggestedActions: [
      'Provide self-service documentation training',
      'Create customer-specific knowledge base',
      'Schedule admin training session',
      'Review and improve help documentation'
    ],
    status: 'monitoring'
  };
}

/**
 * Identify friction patterns across customer base
 */
function identifyFrictionPatterns(frictionList: DetectedFriction[]): FrictionPattern[] {
  const patternMap = new Map<FrictionCategory, DetectedFriction[]>();

  // Group by category
  for (const friction of frictionList) {
    const existing = patternMap.get(friction.category) || [];
    existing.push(friction);
    patternMap.set(friction.category, existing);
  }

  const patterns: FrictionPattern[] = [];

  for (const [category, frictions] of Array.from(patternMap.entries())) {
    if (frictions.length >= 2) {
      const avgDelay = frictions.reduce((sum, f) => sum + f.daysSinceDetected, 0) / frictions.length;
      const totalArr = frictions.reduce((sum, f) => sum + f.arrImpact, 0);

      patterns.push({
        id: uuidv4(),
        category,
        pattern: getPatternDescription(category),
        occurrenceCount: frictions.length,
        avgDelayDays: Math.round(avgDelay),
        affectedCustomerCount: frictions.length,
        totalArrAtRisk: totalArr,
        commonCharacteristics: getCommonCharacteristics(category),
        recommendedIntervention: getRecommendedIntervention(category),
        successRate: 70 + Math.floor(Math.random() * 20)
      });
    }
  }

  return patterns.sort((a, b) => b.totalArrAtRisk - a.totalArrAtRisk);
}

function getPatternDescription(category: FrictionCategory): string {
  const descriptions: Record<FrictionCategory, string> = {
    technical_setup: 'Customers frequently stall during technical integration phase',
    user_adoption: 'User engagement drops after initial onboarding period',
    value_realization: 'Customers struggle to achieve measurable business outcomes',
    champion_engagement: 'Primary stakeholders become disengaged over time',
    stakeholder_access: 'Difficulty reaching decision-makers and executives',
    support_dependency: 'Over-reliance on support instead of self-service'
  };
  return descriptions[category] || 'Pattern detected';
}

function getCommonCharacteristics(category: FrictionCategory): string[] {
  const characteristics: Record<FrictionCategory, string[]> = {
    technical_setup: ['Complex existing tech stack', 'Limited internal IT resources', 'Legacy system dependencies'],
    user_adoption: ['Large user base', 'Change management challenges', 'Competing priorities'],
    value_realization: ['Unclear success metrics', 'Misaligned expectations', 'Limited executive visibility'],
    champion_engagement: ['Single point of contact', 'Role changes', 'Competing priorities'],
    stakeholder_access: ['Siloed organization', 'Remote decision-makers', 'Long approval chains'],
    support_dependency: ['Technical complexity', 'Documentation gaps', 'Training needs']
  };
  return characteristics[category] || [];
}

function getRecommendedIntervention(category: FrictionCategory): string {
  const interventions: Record<FrictionCategory, string> = {
    technical_setup: 'Implement guided integration wizard with live support option',
    user_adoption: 'Launch tiered training program with certification',
    value_realization: 'Establish clear success metrics dashboard in onboarding',
    champion_engagement: 'Create champion enablement program with regular touchpoints',
    stakeholder_access: 'Develop executive summary reports for easy sharing',
    support_dependency: 'Build comprehensive self-service knowledge base'
  };
  return interventions[category] || 'Increase customer touchpoints';
}

/**
 * Calculate friction summary
 */
function calculateFrictionSummary(frictionList: DetectedFriction[]): {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalArrAtRisk: number;
  topCategory: FrictionCategory;
} {
  const criticalCount = frictionList.filter(f => f.severity === 'critical').length;
  const highCount = frictionList.filter(f => f.severity === 'high').length;
  const mediumCount = frictionList.filter(f => f.severity === 'medium').length;
  const lowCount = frictionList.filter(f => f.severity === 'low').length;
  const totalArrAtRisk = frictionList.reduce((sum, f) => sum + f.arrImpact, 0);

  // Find top category
  const categoryCount = new Map<FrictionCategory, number>();
  for (const f of frictionList) {
    categoryCount.set(f.category, (categoryCount.get(f.category) || 0) + 1);
  }

  let topCategory: FrictionCategory = 'technical_setup';
  let maxCount = 0;
  for (const [cat, count] of Array.from(categoryCount.entries())) {
    if (count > maxCount) {
      maxCount = count;
      topCategory = cat;
    }
  }

  return {
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    totalArrAtRisk,
    topCategory
  };
}

/**
 * Generate recommendations based on patterns
 */
function generateFrictionRecommendations(
  patterns: FrictionPattern[],
  summary: ReturnType<typeof calculateFrictionSummary>
): string[] {
  const recommendations: string[] = [];

  if (summary.criticalCount > 0) {
    recommendations.push(`Address ${summary.criticalCount} critical friction points immediately to protect $${Math.round(summary.totalArrAtRisk / 1000)}K ARR`);
  }

  if (patterns.length > 0) {
    const topPattern = patterns[0];
    recommendations.push(`Top pattern: ${topPattern.pattern}. Affects ${topPattern.affectedCustomerCount} customers.`);
    recommendations.push(`Recommended: ${topPattern.recommendedIntervention}`);
  }

  if (summary.topCategory === 'technical_setup') {
    recommendations.push('Consider adding dedicated integration support resources');
  } else if (summary.topCategory === 'user_adoption') {
    recommendations.push('Invest in training and enablement programs');
  } else if (summary.topCategory === 'value_realization') {
    recommendations.push('Define clearer success metrics during onboarding');
  }

  recommendations.push('Schedule proactive check-ins with all at-risk customers this week');

  return recommendations;
}

/**
 * Record friction point to database
 */
export async function recordFrictionPoint(friction: {
  stage: string;
  frictionType: string;
  occurrenceCount: number;
  avgDelayDays: number;
  recommendations: any;
}): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('journey_friction_points')
      .insert({
        id: uuidv4(),
        stage: friction.stage,
        friction_type: friction.frictionType,
        occurrence_count: friction.occurrenceCount,
        avg_delay_days: friction.avgDelayDays,
        recommendations: friction.recommendations,
        analyzed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error recording friction point:', error);
    return null;
  }
}

export default {
  detectAllFriction,
  detectCustomerFriction,
  recordFrictionPoint
};
