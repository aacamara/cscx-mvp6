/**
 * PRD-090: Feature Adoption Service
 *
 * Main service for feature adoption tracking and enablement.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import type {
  FeatureCatalog,
  FeatureAdoption,
  EnablementIntervention,
  CustomerAdoptionStatus,
  EnablementResources,
  TrainingResource,
  AdoptionStage,
  InterventionType,
} from './types.js';

// Re-export types
export * from './types.js';

// Re-export stall detector
export {
  detectAdoptionStallForCustomer,
  detectAdoptionStallForAllCustomers,
  sendAdoptionStallSlackAlert,
  calculateSeverity,
  getDueDateOffsetHours,
} from './stall-detector.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Feature Catalog Functions
// ============================================

/**
 * Get all features in the catalog
 */
export async function getAllFeatures(): Promise<FeatureCatalog[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('feature_catalog')
    .select('*')
    .order('importance_score', { ascending: false });

  if (error) {
    console.error('[AdoptionService] Failed to get features:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific feature by ID
 */
export async function getFeature(featureId: string): Promise<FeatureCatalog | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('feature_catalog')
    .select('*')
    .eq('feature_id', featureId)
    .single();

  if (error) {
    console.error('[AdoptionService] Failed to get feature:', error);
    return null;
  }

  return data;
}

/**
 * Get enablement resources for a feature
 */
export async function getFeatureResources(featureId: string): Promise<EnablementResources | null> {
  const feature = await getFeature(featureId);
  if (!feature) return null;

  const resources: TrainingResource[] = feature.training_resources || [];

  // Generate suggested outreach based on resources
  let suggestedOutreach = `Hi,\n\nI noticed your team has started exploring ${feature.feature_name} but might not have had a chance to fully dive in yet.`;

  if (resources.length > 0) {
    suggestedOutreach += '\n\nI wanted to share some resources that might help:\n';
    resources.forEach((r, i) => {
      suggestedOutreach += `${i + 1}. ${r.title}${r.duration_minutes ? ` (${r.duration_minutes} min)` : ''}\n`;
    });
  }

  if (feature.tips) {
    suggestedOutreach += `\nTip: ${feature.tips}`;
  }

  suggestedOutreach += '\n\nWould you like to schedule a brief walkthrough? I am happy to help your team get the most out of this feature.';

  return {
    feature,
    resources,
    suggestedOutreach,
  };
}

// ============================================
// Customer Adoption Functions
// ============================================

/**
 * Get feature adoption status for a customer
 */
export async function getCustomerAdoptionStatus(customerId: string): Promise<CustomerAdoptionStatus | null> {
  if (!supabase) return null;

  // Get all feature adoptions for this customer
  const { data: adoptions, error } = await supabase
    .from('feature_adoption')
    .select(`
      *,
      feature_catalog (
        feature_id,
        feature_name,
        category,
        importance_score,
        training_resources
      )
    `)
    .eq('customer_id', customerId)
    .order('usage_score', { ascending: false });

  if (error) {
    console.error('[AdoptionService] Failed to get customer adoption:', error);
    return null;
  }

  if (!adoptions || adoptions.length === 0) {
    return {
      overallAdoptionScore: 0,
      features: [],
      stalledFeatures: [],
      recommendations: ['No features are being tracked yet. Start by activating features for this customer.'],
    };
  }

  // Calculate overall adoption score (weighted by importance)
  let totalWeight = 0;
  let weightedScore = 0;
  const stalledFeatures: FeatureAdoption[] = [];

  const features = adoptions.map((adoption) => {
    const catalog = adoption.feature_catalog;
    const importance = catalog?.importance_score || 50;

    totalWeight += importance;
    weightedScore += adoption.usage_score * importance;

    const isStalled = adoption.stall_detected_at != null && adoption.stage !== 'adopted';
    if (isStalled) {
      stalledFeatures.push(adoption);
    }

    // Calculate days in current stage
    const lastActivity = adoption.last_used_at || adoption.activated_at || adoption.created_at;
    const daysInCurrentStage = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      featureId: adoption.feature_id,
      featureName: catalog?.feature_name || adoption.feature_name,
      stage: adoption.stage as AdoptionStage,
      usageScore: adoption.usage_score,
      lastUsedAt: adoption.last_used_at,
      isStalled,
      daysInCurrentStage,
      trainingResourceCount: catalog?.training_resources?.length || 0,
    };
  });

  const overallAdoptionScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (stalledFeatures.length > 0) {
    recommendations.push(
      `${stalledFeatures.length} feature(s) have stalled adoption. Consider scheduling enablement sessions.`
    );
  }

  const notStartedCount = features.filter(f => f.stage === 'not_started').length;
  if (notStartedCount > 0) {
    recommendations.push(
      `${notStartedCount} feature(s) have not been started. Review if they align with customer use cases.`
    );
  }

  const lowUsageFeatures = features.filter(f => f.usageScore < 30 && f.stage !== 'not_started');
  if (lowUsageFeatures.length > 0) {
    recommendations.push(
      `Focus enablement on: ${lowUsageFeatures.slice(0, 3).map(f => f.featureName).join(', ')}`
    );
  }

  if (overallAdoptionScore >= 70) {
    recommendations.push('Customer has strong overall adoption. Consider discussing advanced features.');
  }

  return {
    overallAdoptionScore,
    features,
    stalledFeatures,
    recommendations,
  };
}

/**
 * Initialize feature adoption tracking for a customer
 */
export async function initializeCustomerAdoption(
  customerId: string,
  featureIds: string[]
): Promise<boolean> {
  if (!supabase) return false;

  // Get feature details
  const { data: features, error: featuresError } = await supabase
    .from('feature_catalog')
    .select('*')
    .in('feature_id', featureIds);

  if (featuresError || !features) {
    console.error('[AdoptionService] Failed to get features:', featuresError);
    return false;
  }

  // Create adoption records
  const adoptionRecords = features.map(feature => ({
    customer_id: customerId,
    feature_id: feature.feature_id,
    feature_name: feature.feature_name,
    activated_at: new Date().toISOString(),
    usage_count: 0,
    usage_score: 0,
    stage: 'not_started',
    expected_adoption_days: feature.expected_adoption_days,
  }));

  const { error: insertError } = await supabase
    .from('feature_adoption')
    .upsert(adoptionRecords, {
      onConflict: 'customer_id,feature_id',
      ignoreDuplicates: true,
    });

  if (insertError) {
    console.error('[AdoptionService] Failed to initialize adoption:', insertError);
    return false;
  }

  return true;
}

/**
 * Update feature adoption from usage event
 */
export async function updateFeatureUsage(
  customerId: string,
  featureId: string,
  usageCount: number = 1
): Promise<FeatureAdoption | null> {
  if (!supabase) return null;

  // Get current adoption record
  const { data: existing, error: fetchError } = await supabase
    .from('feature_adoption')
    .select('*')
    .eq('customer_id', customerId)
    .eq('feature_id', featureId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[AdoptionService] Failed to fetch adoption:', fetchError);
    return null;
  }

  const now = new Date().toISOString();
  const newUsageCount = (existing?.usage_count || 0) + usageCount;

  // Calculate usage score based on usage count and time
  // Simple formula: score = min(100, sqrt(usageCount) * 10)
  const newUsageScore = Math.min(100, Math.round(Math.sqrt(newUsageCount) * 10));

  // Determine new stage
  const activatedAt = existing?.activated_at || now;
  const daysSinceActivation = Math.floor(
    (Date.now() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  let newStage: AdoptionStage;
  if (newUsageScore === 0 && daysSinceActivation > 7) {
    newStage = 'not_started';
  } else if (newUsageScore < 20) {
    newStage = 'started';
  } else if (newUsageScore < 60) {
    newStage = 'engaged';
  } else {
    newStage = 'adopted';
  }

  // Clear stall detection if adoption improves
  const shouldClearStall = existing?.stall_detected_at && newStage === 'adopted';

  const updateData: Record<string, unknown> = {
    customer_id: customerId,
    feature_id: featureId,
    usage_count: newUsageCount,
    usage_score: newUsageScore,
    stage: newStage,
    last_used_at: now,
    activated_at: activatedAt,
  };

  if (shouldClearStall) {
    updateData.stall_detected_at = null;
  }

  // Also update adoption_after_intervention if there was a recent intervention
  if (existing?.intervention_sent_at) {
    const interventionDate = new Date(existing.intervention_sent_at);
    const daysSinceIntervention = Math.floor(
      (Date.now() - interventionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Update if within 30 days of intervention
    if (daysSinceIntervention <= 30) {
      updateData.adoption_after_intervention = newUsageScore;
    }
  }

  const { data, error } = await supabase
    .from('feature_adoption')
    .upsert(updateData, {
      onConflict: 'customer_id,feature_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[AdoptionService] Failed to update adoption:', error);
    return null;
  }

  return data;
}

/**
 * Sync feature adoption from bulk usage events
 */
export async function syncFeatureAdoption(
  customerId: string,
  usageEvents: Array<{ featureId: string; count: number }>
): Promise<boolean> {
  if (!supabase) return false;

  for (const event of usageEvents) {
    await updateFeatureUsage(customerId, event.featureId, event.count);
  }

  return true;
}

// ============================================
// Intervention Functions
// ============================================

/**
 * Record an enablement intervention
 */
export async function recordIntervention(
  adoptionId: string,
  intervention: {
    interventionType: InterventionType;
    details?: string;
    resourcesShared?: TrainingResource[];
    sentBy?: string;
  }
): Promise<EnablementIntervention | null> {
  if (!supabase) return null;

  // Get the adoption record
  const { data: adoption, error: adoptionError } = await supabase
    .from('feature_adoption')
    .select('*')
    .eq('id', adoptionId)
    .single();

  if (adoptionError || !adoption) {
    console.error('[AdoptionService] Failed to get adoption:', adoptionError);
    return null;
  }

  const now = new Date().toISOString();

  // Create intervention record
  const { data: interventionRecord, error: insertError } = await supabase
    .from('enablement_interventions')
    .insert({
      feature_adoption_id: adoptionId,
      customer_id: adoption.customer_id,
      feature_id: adoption.feature_id,
      intervention_type: intervention.interventionType,
      details: intervention.details,
      resources_shared: intervention.resourcesShared || [],
      sent_by: intervention.sentBy,
      sent_at: now,
      adoption_score_before: adoption.usage_score,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[AdoptionService] Failed to record intervention:', insertError);
    return null;
  }

  // Update feature adoption with intervention info
  await supabase
    .from('feature_adoption')
    .update({
      intervention_sent_at: now,
      intervention_type: intervention.interventionType,
    })
    .eq('id', adoptionId);

  return interventionRecord;
}

/**
 * Get intervention history for a feature adoption
 */
export async function getInterventionHistory(
  customerId: string,
  featureId?: string
): Promise<EnablementIntervention[]> {
  if (!supabase) return [];

  let query = supabase
    .from('enablement_interventions')
    .select('*')
    .eq('customer_id', customerId)
    .order('sent_at', { ascending: false });

  if (featureId) {
    query = query.eq('feature_id', featureId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AdoptionService] Failed to get interventions:', error);
    return [];
  }

  return data || [];
}

/**
 * Update intervention effectiveness (called when adoption changes after intervention)
 */
export async function updateInterventionEffectiveness(
  interventionId: string,
  adoptionScoreAfter: number
): Promise<void> {
  if (!supabase) return;

  // Get intervention
  const { data: intervention, error: fetchError } = await supabase
    .from('enablement_interventions')
    .select('*')
    .eq('id', interventionId)
    .single();

  if (fetchError || !intervention) {
    return;
  }

  // Calculate effectiveness score
  const scoreBefore = intervention.adoption_score_before || 0;
  const scoreImprovement = adoptionScoreAfter - scoreBefore;
  // Effectiveness: how much of the gap to 100% was closed
  const gap = 100 - scoreBefore;
  const effectivenessScore = gap > 0 ? Math.round((scoreImprovement / gap) * 100) : 0;

  await supabase
    .from('enablement_interventions')
    .update({
      adoption_score_after: adoptionScoreAfter,
      effectiveness_score: Math.max(0, Math.min(100, effectivenessScore)),
      response_received: adoptionScoreAfter > scoreBefore,
      response_at: adoptionScoreAfter > scoreBefore ? new Date().toISOString() : null,
    })
    .eq('id', interventionId);
}

// ============================================
// Analytics Functions
// ============================================

/**
 * Get aggregated feature adoption analytics
 */
export async function getFeatureAdoptionAnalytics(): Promise<{
  totalCustomers: number;
  avgAdoptionScore: number;
  stalledCount: number;
  byFeature: Array<{
    featureId: string;
    featureName: string;
    avgScore: number;
    adoptedCount: number;
    stalledCount: number;
  }>;
}> {
  if (!supabase) {
    return { totalCustomers: 0, avgAdoptionScore: 0, stalledCount: 0, byFeature: [] };
  }

  const { data, error } = await supabase
    .from('feature_adoption')
    .select(`
      customer_id,
      feature_id,
      feature_name,
      usage_score,
      stage,
      stall_detected_at
    `);

  if (error || !data) {
    console.error('[AdoptionService] Failed to get analytics:', error);
    return { totalCustomers: 0, avgAdoptionScore: 0, stalledCount: 0, byFeature: [] };
  }

  // Aggregate by customer
  const customerScores = new Map<string, number[]>();
  const featureStats = new Map<string, {
    featureName: string;
    scores: number[];
    adoptedCount: number;
    stalledCount: number;
  }>();

  for (const record of data) {
    // Customer scores
    if (!customerScores.has(record.customer_id)) {
      customerScores.set(record.customer_id, []);
    }
    customerScores.get(record.customer_id)!.push(record.usage_score);

    // Feature stats
    if (!featureStats.has(record.feature_id)) {
      featureStats.set(record.feature_id, {
        featureName: record.feature_name,
        scores: [],
        adoptedCount: 0,
        stalledCount: 0,
      });
    }
    const stats = featureStats.get(record.feature_id)!;
    stats.scores.push(record.usage_score);
    if (record.stage === 'adopted') stats.adoptedCount++;
    if (record.stall_detected_at) stats.stalledCount++;
  }

  // Calculate averages
  let totalAvgScore = 0;
  let totalStalled = 0;
  customerScores.forEach(scores => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    totalAvgScore += avg;
  });

  data.forEach(record => {
    if (record.stall_detected_at && record.stage !== 'adopted') {
      totalStalled++;
    }
  });

  const byFeature = Array.from(featureStats.entries()).map(([featureId, stats]) => ({
    featureId,
    featureName: stats.featureName,
    avgScore: Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length),
    adoptedCount: stats.adoptedCount,
    stalledCount: stats.stalledCount,
  }));

  return {
    totalCustomers: customerScores.size,
    avgAdoptionScore: customerScores.size > 0
      ? Math.round(totalAvgScore / customerScores.size)
      : 0,
    stalledCount: totalStalled,
    byFeature: byFeature.sort((a, b) => b.avgScore - a.avgScore),
  };
}

// ============================================
// Service Export
// ============================================

export const featureAdoptionService = {
  getAllFeatures,
  getFeature,
  getFeatureResources,
  getCustomerAdoptionStatus,
  initializeCustomerAdoption,
  updateFeatureUsage,
  syncFeatureAdoption,
  recordIntervention,
  getInterventionHistory,
  updateInterventionEffectiveness,
  getFeatureAdoptionAnalytics,
};

export default featureAdoptionService;
