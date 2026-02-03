/**
 * Journey Optimization Service
 * PRD-237: Customer Journey Optimization
 *
 * AI-powered analysis of customer journeys to identify optimization opportunities,
 * predict friction points, and recommend interventions to improve time-to-value.
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

// Types
export type JourneyStage = 'prospect' | 'onboarding' | 'adoption' | 'growth' | 'maturity' | 'renewal' | 'at_risk' | 'churned';
export type FrictionType = 'technical' | 'adoption' | 'engagement' | 'support' | 'business' | 'stakeholder';
export type InterventionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface JourneyStageMetrics {
  stage: JourneyStage;
  avgDurationDays: number;
  targetDurationDays: number;
  successRate: number;
  customersInStage: number;
  stallRate: number;
  topFrictionPoints: string[];
}

export interface FrictionPoint {
  id: string;
  stage: JourneyStage;
  frictionType: FrictionType;
  title: string;
  description: string;
  occurrenceRate: number;
  avgDelayDays: number;
  impactScore: number;
  rootCause: string;
  recommendations: string[];
  affectedCustomers: number;
  arrAtRisk: number;
}

export interface OptimalPath {
  stages: Array<{
    name: JourneyStage;
    targetDay: number;
    keyMilestones: string[];
    successIndicators: string[];
  }>;
  totalDays: number;
  description: string;
}

export interface InterventionRecommendation {
  id: string;
  frictionPointId: string;
  intervention: string;
  description: string;
  expectedImpact: {
    timeReduction: number;
    retentionImprovement: number;
    npsImprovement: number;
  };
  effort: 'low' | 'medium' | 'high';
  priority: InterventionPriority;
  category: FrictionType;
  implementationSteps: string[];
}

export interface JourneyOptimizationAnalysis {
  segmentName: string;
  analyzedAt: string;
  customersAnalyzed: number;
  currentPerformance: {
    avgTimeToValue: number;
    targetTimeToValue: number;
    gap: number;
    gapPercentage: number;
  };
  stageMetrics: JourneyStageMetrics[];
  frictionPoints: FrictionPoint[];
  optimalPath: OptimalPath;
  interventions: InterventionRecommendation[];
  projectedImpact: {
    timeToValueReduction: number;
    retentionImprovement: number;
    npsImprovement: number;
  };
  cohortComparison: {
    bestPerforming: {
      segment: string;
      avgTimeToValue: number;
      characteristics: string[];
    };
    worstPerforming: {
      segment: string;
      avgTimeToValue: number;
      issues: string[];
    };
  };
  executiveSummary: string;
}

export interface JourneySimulation {
  scenario: string;
  currentState: {
    avgTimeToValue: number;
    stageDistribution: Record<JourneyStage, number>;
    frictionImpact: number;
  };
  proposedChanges: string[];
  projectedOutcome: {
    avgTimeToValue: number;
    timeReduction: number;
    percentageImprovement: number;
    stageDistribution: Record<JourneyStage, number>;
  };
  riskFactors: string[];
  implementationTimeline: string;
  confidence: number;
}

/**
 * Analyze customer journey to identify optimization opportunities
 */
export async function analyzeJourneyOptimization(
  segment?: string,
  options: {
    includeCohortComparison?: boolean;
    predictionHorizon?: number;
  } = {}
): Promise<JourneyOptimizationAnalysis> {
  const { includeCohortComparison = true, predictionHorizon = 90 } = options;

  // Gather journey data
  const journeyData = await gatherJourneyData(segment);

  // Calculate stage metrics
  const stageMetrics = calculateStageMetrics(journeyData);

  // Detect friction points
  const frictionPoints = await detectFrictionPoints(journeyData, stageMetrics);

  // Generate optimal path
  const optimalPath = generateOptimalPath(stageMetrics);

  // Generate AI-powered recommendations
  const aiAnalysis = await generateAIJourneyAnalysis(journeyData, stageMetrics, frictionPoints);

  // Calculate projected impact
  const projectedImpact = calculateProjectedImpact(frictionPoints, aiAnalysis.interventions);

  // Get cohort comparison
  const cohortComparison = includeCohortComparison
    ? await generateCohortComparison()
    : {
        bestPerforming: { segment: 'Enterprise', avgTimeToValue: 21, characteristics: ['Dedicated onboarding', 'Executive sponsorship'] },
        worstPerforming: { segment: 'SMB', avgTimeToValue: 45, issues: ['Self-service gaps', 'Limited support'] }
      };

  return {
    segmentName: segment || 'All Customers',
    analyzedAt: new Date().toISOString(),
    customersAnalyzed: journeyData.totalCustomers,
    currentPerformance: {
      avgTimeToValue: journeyData.avgTimeToValue,
      targetTimeToValue: 21,
      gap: journeyData.avgTimeToValue - 21,
      gapPercentage: Math.round(((journeyData.avgTimeToValue - 21) / 21) * 100)
    },
    stageMetrics,
    frictionPoints,
    optimalPath,
    interventions: aiAnalysis.interventions,
    projectedImpact,
    cohortComparison,
    executiveSummary: aiAnalysis.executiveSummary
  };
}

/**
 * Gather journey data from database
 */
async function gatherJourneyData(segment?: string): Promise<{
  totalCustomers: number;
  avgTimeToValue: number;
  stageDistribution: Record<JourneyStage, number>;
  journeyEvents: Array<{
    customerId: string;
    stage: JourneyStage;
    enteredAt: string;
    exitedAt: string | null;
    durationDays: number;
    successScore: number;
  }>;
  milestones: Array<{
    customerId: string;
    milestone: string;
    achievedAt: string;
    targetDays: number;
    actualDays: number;
  }>;
}> {
  // Default demo data
  let data = {
    totalCustomers: 234,
    avgTimeToValue: 32,
    stageDistribution: {
      prospect: 15,
      onboarding: 45,
      adoption: 78,
      growth: 52,
      maturity: 28,
      renewal: 12,
      at_risk: 4,
      churned: 0
    } as Record<JourneyStage, number>,
    journeyEvents: [] as Array<{
      customerId: string;
      stage: JourneyStage;
      enteredAt: string;
      exitedAt: string | null;
      durationDays: number;
      successScore: number;
    }>,
    milestones: [] as Array<{
      customerId: string;
      milestone: string;
      achievedAt: string;
      targetDays: number;
      actualDays: number;
    }>
  };

  if (!supabase) {
    // Generate mock journey events
    data.journeyEvents = generateMockJourneyEvents();
    data.milestones = generateMockMilestones();
    return data;
  }

  try {
    // Get customer stage distribution
    const { data: customers } = await supabase
      .from('customers')
      .select('id, stage, health_score, created_at, onboarding_completed_at');

    if (customers) {
      data.totalCustomers = customers.length;

      // Calculate stage distribution
      const distribution: Record<JourneyStage, number> = {
        prospect: 0,
        onboarding: 0,
        adoption: 0,
        growth: 0,
        maturity: 0,
        renewal: 0,
        at_risk: 0,
        churned: 0
      };

      for (const customer of customers) {
        const stage = (customer.stage as JourneyStage) || 'onboarding';
        if (stage in distribution) {
          distribution[stage]++;
        }
      }

      data.stageDistribution = distribution;

      // Calculate average time to value
      const completedCustomers = customers.filter(c => c.onboarding_completed_at);
      if (completedCustomers.length > 0) {
        const totalDays = completedCustomers.reduce((sum, c) => {
          const created = new Date(c.created_at);
          const completed = new Date(c.onboarding_completed_at);
          return sum + Math.ceil((completed.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
        }, 0);
        data.avgTimeToValue = Math.round(totalDays / completedCustomers.length);
      }
    }

    // Get journey stage data
    const { data: stages } = await supabase
      .from('journey_stages')
      .select('*')
      .order('entered_at', { ascending: true });

    if (stages) {
      data.journeyEvents = stages.map(s => ({
        customerId: s.customer_id,
        stage: s.stage as JourneyStage,
        enteredAt: s.entered_at,
        exitedAt: s.exited_at,
        durationDays: s.duration_days || 0,
        successScore: s.success_score || 50
      }));
    } else {
      data.journeyEvents = generateMockJourneyEvents();
    }

    // Get milestone data
    const { data: milestones } = await supabase
      .from('customer_milestones')
      .select('customer_id, milestone_type, achieved_at, metadata');

    if (milestones) {
      data.milestones = milestones.map(m => ({
        customerId: m.customer_id,
        milestone: m.milestone_type,
        achievedAt: m.achieved_at,
        targetDays: (m.metadata as any)?.target_days || 14,
        actualDays: (m.metadata as any)?.actual_days || 21
      }));
    } else {
      data.milestones = generateMockMilestones();
    }

  } catch (error) {
    console.error('Error gathering journey data:', error);
    data.journeyEvents = generateMockJourneyEvents();
    data.milestones = generateMockMilestones();
  }

  return data;
}

/**
 * Generate mock journey events for demo
 */
function generateMockJourneyEvents(): Array<{
  customerId: string;
  stage: JourneyStage;
  enteredAt: string;
  exitedAt: string | null;
  durationDays: number;
  successScore: number;
}> {
  const events = [];
  const stages: JourneyStage[] = ['prospect', 'onboarding', 'adoption', 'growth', 'maturity'];

  for (let i = 0; i < 50; i++) {
    const customerId = uuidv4();
    let currentDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);

    for (const stage of stages) {
      const duration = Math.floor(Math.random() * 30) + 5;
      const enteredAt = new Date(currentDate);
      currentDate = new Date(currentDate.getTime() + duration * 24 * 60 * 60 * 1000);

      events.push({
        customerId,
        stage,
        enteredAt: enteredAt.toISOString(),
        exitedAt: currentDate.toISOString(),
        durationDays: duration,
        successScore: Math.floor(Math.random() * 40) + 60
      });
    }
  }

  return events;
}

/**
 * Generate mock milestones for demo
 */
function generateMockMilestones(): Array<{
  customerId: string;
  milestone: string;
  achievedAt: string;
  targetDays: number;
  actualDays: number;
}> {
  const milestones = [];
  const milestoneTypes = ['first_login', 'integration_complete', 'first_value', 'champion_identified', 'team_onboarded'];

  for (let i = 0; i < 100; i++) {
    const milestone = milestoneTypes[Math.floor(Math.random() * milestoneTypes.length)];
    const targetDays = milestone === 'first_login' ? 1 : milestone === 'integration_complete' ? 7 : 14;
    const actualDays = targetDays + Math.floor(Math.random() * 10) - 3;

    milestones.push({
      customerId: uuidv4(),
      milestone,
      achievedAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
      targetDays,
      actualDays: Math.max(1, actualDays)
    });
  }

  return milestones;
}

/**
 * Calculate metrics for each journey stage
 */
function calculateStageMetrics(journeyData: Awaited<ReturnType<typeof gatherJourneyData>>): JourneyStageMetrics[] {
  const stages: JourneyStage[] = ['prospect', 'onboarding', 'adoption', 'growth', 'maturity', 'renewal'];
  const targetDurations: Record<JourneyStage, number> = {
    prospect: 7,
    onboarding: 14,
    adoption: 30,
    growth: 60,
    maturity: 90,
    renewal: 30,
    at_risk: 0,
    churned: 0
  };

  return stages.map(stage => {
    const stageEvents = journeyData.journeyEvents.filter(e => e.stage === stage);
    const avgDuration = stageEvents.length > 0
      ? Math.round(stageEvents.reduce((sum, e) => sum + e.durationDays, 0) / stageEvents.length)
      : targetDurations[stage];

    const successCount = stageEvents.filter(e => e.successScore >= 70).length;
    const stallCount = stageEvents.filter(e => e.durationDays > targetDurations[stage] * 1.5).length;

    return {
      stage,
      avgDurationDays: avgDuration,
      targetDurationDays: targetDurations[stage],
      successRate: stageEvents.length > 0 ? Math.round((successCount / stageEvents.length) * 100) : 75,
      customersInStage: journeyData.stageDistribution[stage] || 0,
      stallRate: stageEvents.length > 0 ? Math.round((stallCount / stageEvents.length) * 100) : 15,
      topFrictionPoints: getFrictionPointsForStage(stage)
    };
  });
}

/**
 * Get common friction points for a stage
 */
function getFrictionPointsForStage(stage: JourneyStage): string[] {
  const frictionByStage: Record<JourneyStage, string[]> = {
    prospect: ['Unclear value proposition', 'Long sales cycle'],
    onboarding: ['Complex API integration', 'Unclear success criteria', 'Resource constraints'],
    adoption: ['Feature discovery gaps', 'Training needs', 'Workflow integration'],
    growth: ['Scaling challenges', 'New user onboarding', 'Advanced feature adoption'],
    maturity: ['Value plateau', 'Champion departure', 'Competitive pressure'],
    renewal: ['Budget constraints', 'Stakeholder changes', 'ROI validation'],
    at_risk: ['Declining engagement', 'Support escalations', 'Executive disconnect'],
    churned: ['Failed renewal', 'Business closure', 'Competitor switch']
  };

  return frictionByStage[stage] || [];
}

/**
 * Detect friction points in the journey
 */
async function detectFrictionPoints(
  journeyData: Awaited<ReturnType<typeof gatherJourneyData>>,
  stageMetrics: JourneyStageMetrics[]
): Promise<FrictionPoint[]> {
  const frictionPoints: FrictionPoint[] = [];

  // Identify stages with high stall rates
  for (const metric of stageMetrics) {
    if (metric.stallRate > 20) {
      const delayDays = metric.avgDurationDays - metric.targetDurationDays;

      frictionPoints.push({
        id: uuidv4(),
        stage: metric.stage,
        frictionType: getFrictionType(metric.stage),
        title: `${formatStageName(metric.stage)} Stall`,
        description: `${metric.stallRate}% of customers stall at the ${metric.stage} stage.`,
        occurrenceRate: metric.stallRate / 100,
        avgDelayDays: delayDays > 0 ? delayDays : 0,
        impactScore: calculateImpactScore(metric.stallRate, delayDays, metric.customersInStage),
        rootCause: getRootCause(metric.stage, metric.topFrictionPoints),
        recommendations: getRecommendations(metric.stage, metric.topFrictionPoints),
        affectedCustomers: Math.round(metric.customersInStage * (metric.stallRate / 100)),
        arrAtRisk: Math.round(metric.customersInStage * (metric.stallRate / 100) * 50000)
      });
    }
  }

  // Identify milestone delays
  const milestoneGroups = groupMilestonesByType(journeyData.milestones);
  for (const [milestone, instances] of Object.entries(milestoneGroups)) {
    const delayedCount = instances.filter(m => m.actualDays > m.targetDays).length;
    const delayRate = (delayedCount / instances.length) * 100;

    if (delayRate > 25) {
      const avgDelay = instances.reduce((sum, m) => sum + Math.max(0, m.actualDays - m.targetDays), 0) / instances.length;

      frictionPoints.push({
        id: uuidv4(),
        stage: getStageForMilestone(milestone),
        frictionType: 'adoption',
        title: `Delayed ${formatMilestoneName(milestone)}`,
        description: `${Math.round(delayRate)}% of customers miss the target for ${formatMilestoneName(milestone)}.`,
        occurrenceRate: delayRate / 100,
        avgDelayDays: Math.round(avgDelay),
        impactScore: calculateImpactScore(delayRate, avgDelay, instances.length),
        rootCause: `Customers struggle to achieve ${formatMilestoneName(milestone)} within expected timeframe.`,
        recommendations: getMilestoneRecommendations(milestone),
        affectedCustomers: delayedCount,
        arrAtRisk: delayedCount * 40000
      });
    }
  }

  // Sort by impact score
  return frictionPoints.sort((a, b) => b.impactScore - a.impactScore).slice(0, 5);
}

function getFrictionType(stage: JourneyStage): FrictionType {
  const typeMap: Record<JourneyStage, FrictionType> = {
    prospect: 'business',
    onboarding: 'technical',
    adoption: 'adoption',
    growth: 'engagement',
    maturity: 'stakeholder',
    renewal: 'business',
    at_risk: 'support',
    churned: 'business'
  };
  return typeMap[stage] || 'adoption';
}

function formatStageName(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, ' ');
}

function formatMilestoneName(milestone: string): string {
  return milestone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function calculateImpactScore(stallRate: number, delayDays: number, affected: number): number {
  return Math.min(100, Math.round((stallRate * 0.4) + (delayDays * 2) + (affected * 0.5)));
}

function getRootCause(stage: JourneyStage, frictionPoints: string[]): string {
  if (frictionPoints.length > 0) {
    return `Primary cause: ${frictionPoints[0]}`;
  }
  return `Insufficient support and resources at the ${stage} stage.`;
}

function getRecommendations(stage: JourneyStage, frictionPoints: string[]): string[] {
  const baseRecs: Record<JourneyStage, string[]> = {
    prospect: ['Clarify value proposition', 'Streamline evaluation process'],
    onboarding: ['Add integration wizard', 'Offer office hours support', 'Define clear quick-win goals'],
    adoption: ['Create feature discovery tours', 'Schedule training sessions', 'Share best practices'],
    growth: ['Provide scaling documentation', 'Offer advanced training', 'Connect with power users'],
    maturity: ['Schedule QBRs', 'Develop champion program', 'Share roadmap updates'],
    renewal: ['Present ROI summary', 'Engage executive sponsors', 'Address concerns early'],
    at_risk: ['Escalate to leadership', 'Create save plan', 'Increase touchpoints'],
    churned: ['Conduct exit interview', 'Document lessons learned']
  };

  return baseRecs[stage] || ['Increase customer touchpoints', 'Provide additional resources'];
}

function getStageForMilestone(milestone: string): JourneyStage {
  const milestoneStages: Record<string, JourneyStage> = {
    first_login: 'onboarding',
    integration_complete: 'onboarding',
    first_value: 'adoption',
    champion_identified: 'adoption',
    team_onboarded: 'growth'
  };
  return milestoneStages[milestone] || 'adoption';
}

function getMilestoneRecommendations(milestone: string): string[] {
  const recs: Record<string, string[]> = {
    first_login: ['Send reminder emails', 'Offer onboarding call'],
    integration_complete: ['Provide integration support', 'Create setup guides'],
    first_value: ['Define clear success metrics', 'Schedule value review call'],
    champion_identified: ['Champion enablement program', 'Provide advocacy resources'],
    team_onboarded: ['Team training sessions', 'Create user guides']
  };
  return recs[milestone] || ['Provide additional support'];
}

function groupMilestonesByType(milestones: Array<{ milestone: string; actualDays: number; targetDays: number }>): Record<string, Array<{ actualDays: number; targetDays: number }>> {
  const grouped: Record<string, Array<{ actualDays: number; targetDays: number }>> = {};
  for (const m of milestones) {
    if (!grouped[m.milestone]) {
      grouped[m.milestone] = [];
    }
    grouped[m.milestone].push({ actualDays: m.actualDays, targetDays: m.targetDays });
  }
  return grouped;
}

/**
 * Generate optimal journey path
 */
function generateOptimalPath(stageMetrics: JourneyStageMetrics[]): OptimalPath {
  let cumulativeDay = 0;
  const stages = stageMetrics.map(metric => {
    const targetDay = cumulativeDay + metric.targetDurationDays;
    cumulativeDay = targetDay;

    return {
      name: metric.stage,
      targetDay,
      keyMilestones: getKeyMilestones(metric.stage),
      successIndicators: getSuccessIndicators(metric.stage)
    };
  });

  return {
    stages,
    totalDays: cumulativeDay,
    description: `Optimal path: ${stages.map(s => `${formatStageName(s.name)} (Day ${s.targetDay})`).join(' -> ')}`
  };
}

function getKeyMilestones(stage: JourneyStage): string[] {
  const milestones: Record<JourneyStage, string[]> = {
    prospect: ['Initial contact', 'Demo completed'],
    onboarding: ['Kickoff meeting', 'Technical setup', 'First quick win'],
    adoption: ['Core features activated', 'Team trained', 'Champion identified'],
    growth: ['Expanded usage', 'Additional teams onboarded', 'Advanced features adopted'],
    maturity: ['Full adoption', 'Strategic partnership', 'Reference customer'],
    renewal: ['ROI validated', 'Contract renewed'],
    at_risk: ['Save plan initiated'],
    churned: []
  };
  return milestones[stage] || [];
}

function getSuccessIndicators(stage: JourneyStage): string[] {
  const indicators: Record<JourneyStage, string[]> = {
    prospect: ['Engaged stakeholders', 'Clear use case'],
    onboarding: ['Login within 48h', 'Integration complete', 'First value achieved'],
    adoption: ['70%+ feature adoption', 'Regular engagement', 'Positive feedback'],
    growth: ['Usage growth >20%', 'Team expansion', 'Feature requests'],
    maturity: ['High health score', 'Executive sponsorship', 'Advocacy activities'],
    renewal: ['Early commitment', 'Expansion discussion'],
    at_risk: ['Engagement improvement', 'Issue resolution'],
    churned: []
  };
  return indicators[stage] || [];
}

/**
 * Generate AI-powered journey analysis
 */
async function generateAIJourneyAnalysis(
  journeyData: Awaited<ReturnType<typeof gatherJourneyData>>,
  stageMetrics: JourneyStageMetrics[],
  frictionPoints: FrictionPoint[]
): Promise<{
  interventions: InterventionRecommendation[];
  executiveSummary: string;
}> {
  if (!anthropic) {
    return generateRuleBasedAnalysis(stageMetrics, frictionPoints);
  }

  const prompt = buildJourneyAnalysisPrompt(journeyData, stageMetrics, frictionPoints);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return parseAIJourneyResponse(content.text, frictionPoints);
    }
  } catch (error) {
    console.error('Error generating AI journey analysis:', error);
  }

  return generateRuleBasedAnalysis(stageMetrics, frictionPoints);
}

function buildJourneyAnalysisPrompt(
  journeyData: Awaited<ReturnType<typeof gatherJourneyData>>,
  stageMetrics: JourneyStageMetrics[],
  frictionPoints: FrictionPoint[]
): string {
  return `You are a Customer Success expert analyzing customer journey data. Generate actionable recommendations to optimize the customer journey.

JOURNEY DATA:
- Total Customers: ${journeyData.totalCustomers}
- Average Time-to-Value: ${journeyData.avgTimeToValue} days (Target: 21 days)
- Gap: ${journeyData.avgTimeToValue - 21} days (+${Math.round(((journeyData.avgTimeToValue - 21) / 21) * 100)}%)

STAGE METRICS:
${stageMetrics.map(m => `- ${m.stage}: ${m.avgDurationDays} days (target: ${m.targetDurationDays}), ${m.stallRate}% stall rate, ${m.customersInStage} customers`).join('\n')}

FRICTION POINTS:
${frictionPoints.map(f => `- ${f.title} (${f.stage}): ${f.description} Impact: ${f.impactScore}/100`).join('\n')}

Generate your analysis in this JSON format:
{
  "executiveSummary": "2-3 sentence summary of the analysis and key recommendations",
  "interventions": [
    {
      "frictionPointId": "id of the friction point this addresses",
      "intervention": "Name of intervention",
      "description": "Detailed description",
      "expectedImpact": {
        "timeReduction": 5,
        "retentionImprovement": 8,
        "npsImprovement": 12
      },
      "effort": "low|medium|high",
      "priority": "critical|high|medium|low",
      "category": "technical|adoption|engagement|support|business|stakeholder",
      "implementationSteps": ["Step 1", "Step 2"]
    }
  ]
}

Generate 3-5 prioritized interventions. Be specific and actionable.`;
}

function parseAIJourneyResponse(
  responseText: string,
  frictionPoints: FrictionPoint[]
): { interventions: InterventionRecommendation[]; executiveSummary: string } {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      executiveSummary: parsed.executiveSummary || 'Journey analysis complete.',
      interventions: (parsed.interventions || []).map((i: any, idx: number) => ({
        id: uuidv4(),
        frictionPointId: i.frictionPointId || frictionPoints[idx]?.id || '',
        intervention: i.intervention || 'Intervention',
        description: i.description || '',
        expectedImpact: {
          timeReduction: i.expectedImpact?.timeReduction || 5,
          retentionImprovement: i.expectedImpact?.retentionImprovement || 5,
          npsImprovement: i.expectedImpact?.npsImprovement || 5
        },
        effort: i.effort || 'medium',
        priority: i.priority || 'medium',
        category: i.category || 'adoption',
        implementationSteps: i.implementationSteps || []
      }))
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return generateRuleBasedAnalysis([], frictionPoints);
  }
}

function generateRuleBasedAnalysis(
  stageMetrics: JourneyStageMetrics[],
  frictionPoints: FrictionPoint[]
): { interventions: InterventionRecommendation[]; executiveSummary: string } {
  const interventions: InterventionRecommendation[] = frictionPoints.slice(0, 4).map((fp, idx) => ({
    id: uuidv4(),
    frictionPointId: fp.id,
    intervention: `Address ${fp.title}`,
    description: `Implement targeted improvements to resolve ${fp.description}`,
    expectedImpact: {
      timeReduction: Math.round(fp.avgDelayDays * 0.6),
      retentionImprovement: Math.round(fp.impactScore * 0.1),
      npsImprovement: Math.round(fp.impactScore * 0.12)
    },
    effort: fp.impactScore > 70 ? 'high' : fp.impactScore > 40 ? 'medium' : 'low',
    priority: idx === 0 ? 'critical' : idx === 1 ? 'high' : 'medium',
    category: fp.frictionType,
    implementationSteps: fp.recommendations
  }));

  const executiveSummary = frictionPoints.length > 0
    ? `Analysis identified ${frictionPoints.length} key friction points causing an average ${frictionPoints[0]?.avgDelayDays || 5}-day delay in time-to-value. Top priority: ${frictionPoints[0]?.title || 'onboarding improvements'}. Implementing recommended interventions could reduce time-to-value by up to 25%.`
    : 'Journey analysis complete. Customer journey is performing within expected parameters.';

  return { interventions, executiveSummary };
}

/**
 * Calculate projected impact of interventions
 */
function calculateProjectedImpact(
  frictionPoints: FrictionPoint[],
  interventions: InterventionRecommendation[]
): { timeToValueReduction: number; retentionImprovement: number; npsImprovement: number } {
  const totalTimeReduction = interventions.reduce((sum, i) => sum + i.expectedImpact.timeReduction, 0);
  const totalRetention = interventions.reduce((sum, i) => sum + i.expectedImpact.retentionImprovement, 0);
  const totalNps = interventions.reduce((sum, i) => sum + i.expectedImpact.npsImprovement, 0);

  return {
    timeToValueReduction: Math.min(totalTimeReduction, 15),
    retentionImprovement: Math.min(totalRetention, 15),
    npsImprovement: Math.min(totalNps, 20)
  };
}

/**
 * Generate cohort comparison
 */
async function generateCohortComparison(): Promise<{
  bestPerforming: { segment: string; avgTimeToValue: number; characteristics: string[] };
  worstPerforming: { segment: string; avgTimeToValue: number; issues: string[] };
}> {
  // In production, this would query actual cohort data
  return {
    bestPerforming: {
      segment: 'Enterprise with Dedicated CSM',
      avgTimeToValue: 18,
      characteristics: [
        'Dedicated onboarding resources',
        'Executive sponsorship from day 1',
        'Clear success criteria defined'
      ]
    },
    worstPerforming: {
      segment: 'SMB Self-Service',
      avgTimeToValue: 42,
      issues: [
        'Limited onboarding support',
        'Unclear next steps after signup',
        'No proactive health monitoring'
      ]
    }
  };
}

/**
 * Simulate journey changes
 */
export async function simulateJourneyChanges(
  proposedChanges: string[],
  segment?: string
): Promise<JourneySimulation> {
  const journeyData = await gatherJourneyData(segment);
  const stageMetrics = calculateStageMetrics(journeyData);

  // Calculate current friction impact
  const currentFrictionImpact = stageMetrics.reduce((sum, m) => sum + (m.avgDurationDays - m.targetDurationDays), 0);

  // Estimate improvement (simplified - in production would use ML)
  const improvementFactor = 0.25 + (proposedChanges.length * 0.05);
  const projectedTimeToValue = Math.round(journeyData.avgTimeToValue * (1 - improvementFactor));

  const projectedDistribution: Record<JourneyStage, number> = { ...journeyData.stageDistribution };
  // Move some customers forward through better journey
  if (projectedDistribution.onboarding > 0 && projectedDistribution.adoption) {
    const moveCount = Math.round(projectedDistribution.onboarding * 0.1);
    projectedDistribution.onboarding -= moveCount;
    projectedDistribution.adoption += moveCount;
  }

  return {
    scenario: `Implementing: ${proposedChanges.join(', ')}`,
    currentState: {
      avgTimeToValue: journeyData.avgTimeToValue,
      stageDistribution: journeyData.stageDistribution,
      frictionImpact: currentFrictionImpact
    },
    proposedChanges,
    projectedOutcome: {
      avgTimeToValue: projectedTimeToValue,
      timeReduction: journeyData.avgTimeToValue - projectedTimeToValue,
      percentageImprovement: Math.round(improvementFactor * 100),
      stageDistribution: projectedDistribution
    },
    riskFactors: [
      'Implementation timeline may vary',
      'Results depend on consistent execution',
      'External factors may impact outcomes'
    ],
    implementationTimeline: `${proposedChanges.length * 2}-${proposedChanges.length * 4} weeks`,
    confidence: 75
  };
}

export default {
  analyzeJourneyOptimization,
  simulateJourneyChanges
};
