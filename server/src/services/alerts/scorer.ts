/**
 * Alert Scoring Engine (PRD-221)
 *
 * AI-powered scoring of alerts based on:
 * - Business impact (ARR, health, renewal proximity)
 * - Urgency (time sensitivity, deadlines)
 * - Confidence (signal reliability, noise filtering)
 */

import {
  RawAlert,
  AlertContext,
  AlertScore,
  ScoreFactor,
  DeliveryRecommendation,
  AlertType,
  AlertPreferences,
  DEFAULT_ALERT_PREFERENCES,
} from './types.js';

// ============================================
// Scoring Weights
// ============================================

const WEIGHTS = {
  impact: 0.40,
  urgency: 0.35,
  confidence: 0.25,
};

// ============================================
// Signal Reliability by Alert Type
// ============================================

const SIGNAL_RELIABILITY: Record<AlertType, number> = {
  health_score_drop: 85,
  health_score_critical: 95,
  usage_drop: 80,
  usage_spike: 60,
  renewal_approaching: 100,
  engagement_drop: 75,
  champion_left: 90,
  nps_detractor: 85,
  support_escalation: 95,
  contract_expiring: 100,
  expansion_signal: 70,
  adoption_stalled: 75,
  invoice_overdue: 100,
  stakeholder_inactive: 65,
  custom: 50,
};

// ============================================
// Time Sensitivity by Alert Type
// ============================================

const TIME_SENSITIVITY: Record<AlertType, number> = {
  health_score_drop: 70,
  health_score_critical: 95,
  usage_drop: 60,
  usage_spike: 40,
  renewal_approaching: 85,
  engagement_drop: 55,
  champion_left: 90,
  nps_detractor: 80,
  support_escalation: 100,
  contract_expiring: 90,
  expansion_signal: 30,
  adoption_stalled: 50,
  invoice_overdue: 85,
  stakeholder_inactive: 45,
  custom: 50,
};

// ============================================
// Main Scoring Function
// ============================================

export function scoreAlert(
  alert: RawAlert,
  context: AlertContext,
  preferences: Partial<AlertPreferences> = {}
): AlertScore {
  const prefs = { ...DEFAULT_ALERT_PREFERENCES, ...preferences };
  const factors: ScoreFactor[] = [];

  // Calculate component scores
  const impactScore = calculateImpactScore(alert, context, factors);
  const urgencyScore = calculateUrgencyScore(alert, context, factors);
  const confidenceScore = calculateConfidenceScore(alert, context, factors);

  // Calculate weighted final score
  const finalScore = Math.round(
    impactScore * WEIGHTS.impact +
    urgencyScore * WEIGHTS.urgency +
    confidenceScore * WEIGHTS.confidence
  );

  // Check for filtering conditions
  const { filtered, filterReason } = shouldFilterAlert(alert, context, prefs, finalScore);

  // Determine delivery recommendation
  const deliveryRecommendation = getDeliveryRecommendation(finalScore, filtered, prefs);

  return {
    rawAlertId: alert.id,
    impactScore: Math.round(impactScore),
    urgencyScore: Math.round(urgencyScore),
    confidenceScore: Math.round(confidenceScore),
    finalScore,
    factors,
    deliveryRecommendation,
    filtered,
    filterReason,
  };
}

// ============================================
// Impact Score Calculation
// ============================================

function calculateImpactScore(
  alert: RawAlert,
  context: AlertContext,
  factors: ScoreFactor[]
): number {
  let score = 0;

  // ARR Impact (0-40 points)
  const arrImpact = getARRImpact(context.customer.arr);
  score += arrImpact;
  factors.push({
    factor: 'ARR Value',
    weight: 40,
    value: context.customer.arr,
    contribution: arrImpact,
    explanation: `$${(context.customer.arr / 1000).toFixed(0)}K ARR customer - ${arrImpact >= 30 ? 'high' : arrImpact >= 15 ? 'medium' : 'standard'} priority`,
  });

  // Health Score Impact (0-30 points)
  const healthImpact = getHealthImpact(context.customer.healthScore);
  score += healthImpact;
  factors.push({
    factor: 'Current Health',
    weight: 30,
    value: context.customer.healthScore,
    contribution: healthImpact,
    explanation: `Health score at ${context.customer.healthScore} - ${healthImpact >= 20 ? 'critical zone' : healthImpact >= 10 ? 'warning zone' : 'healthy'}`,
  });

  // Renewal Proximity Impact (0-30 points)
  const renewalImpact = getRenewalImpact(context.customer.daysToRenewal);
  score += renewalImpact;
  if (context.customer.daysToRenewal !== undefined) {
    factors.push({
      factor: 'Renewal Proximity',
      weight: 30,
      value: context.customer.daysToRenewal,
      contribution: renewalImpact,
      explanation: `Renewal in ${context.customer.daysToRenewal} days - ${renewalImpact >= 20 ? 'imminent' : renewalImpact >= 10 ? 'approaching' : 'distant'}`,
    });
  }

  return Math.min(100, score);
}

function getARRImpact(arr: number): number {
  if (arr >= 500000) return 40;      // Enterprise ($500K+)
  if (arr >= 250000) return 35;
  if (arr >= 100000) return 30;
  if (arr >= 50000) return 20;
  if (arr >= 25000) return 15;
  if (arr >= 10000) return 10;
  return 5;
}

function getHealthImpact(healthScore: number): number {
  if (healthScore <= 30) return 30;   // Critical
  if (healthScore <= 50) return 25;
  if (healthScore <= 60) return 20;   // At-risk
  if (healthScore <= 70) return 10;   // Warning
  return 5;                            // Healthy
}

function getRenewalImpact(daysToRenewal?: number): number {
  if (daysToRenewal === undefined) return 5;
  if (daysToRenewal <= 14) return 30;   // Imminent
  if (daysToRenewal <= 30) return 25;
  if (daysToRenewal <= 60) return 20;
  if (daysToRenewal <= 90) return 15;
  if (daysToRenewal <= 180) return 10;
  return 5;
}

// ============================================
// Urgency Score Calculation
// ============================================

function calculateUrgencyScore(
  alert: RawAlert,
  context: AlertContext,
  factors: ScoreFactor[]
): number {
  let score = 0;

  // Base time sensitivity by alert type (0-40 points)
  const timeSensitivity = TIME_SENSITIVITY[alert.type] * 0.4;
  score += timeSensitivity;
  factors.push({
    factor: 'Time Sensitivity',
    weight: 40,
    value: TIME_SENSITIVITY[alert.type],
    contribution: timeSensitivity,
    explanation: `${alert.type.replace(/_/g, ' ')} alerts are ${timeSensitivity >= 30 ? 'highly' : timeSensitivity >= 20 ? 'moderately' : 'less'} time-sensitive`,
  });

  // Deadline proximity (0-30 points)
  if (context.customer.daysToRenewal !== undefined && context.customer.daysToRenewal <= 30) {
    const deadlineUrgency = Math.min(30, 30 - context.customer.daysToRenewal);
    score += deadlineUrgency;
    factors.push({
      factor: 'Deadline Pressure',
      weight: 30,
      value: context.customer.daysToRenewal,
      contribution: deadlineUrgency,
      explanation: `Only ${context.customer.daysToRenewal} days until renewal deadline`,
    });
  }

  // Duplication penalty (0-30 points reduction)
  const recentSimilar = context.recentAlerts.filter(
    a => a.type === alert.type && a.customerId === alert.customerId
  ).length;

  if (recentSimilar > 0) {
    const duplicationPenalty = Math.min(30, recentSimilar * 10);
    score -= duplicationPenalty;
    factors.push({
      factor: 'Recent Duplication',
      weight: -30,
      value: recentSimilar,
      contribution: -duplicationPenalty,
      explanation: `${recentSimilar} similar alert(s) sent recently - reducing urgency`,
    });
  }

  // Change velocity boost (0-20 points)
  if (alert.metricChange) {
    const changeVelocity = Math.abs(alert.metricChange.changePercent);
    const velocityBoost = Math.min(20, changeVelocity / 2);
    score += velocityBoost;
    factors.push({
      factor: 'Change Velocity',
      weight: 20,
      value: changeVelocity,
      contribution: velocityBoost,
      explanation: `${changeVelocity.toFixed(0)}% change indicates ${velocityBoost >= 15 ? 'rapid' : velocityBoost >= 8 ? 'moderate' : 'gradual'} shift`,
    });
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// Confidence Score Calculation
// ============================================

function calculateConfidenceScore(
  alert: RawAlert,
  context: AlertContext,
  factors: ScoreFactor[]
): number {
  let score = 0;

  // Base signal reliability (0-50 points)
  const signalReliability = SIGNAL_RELIABILITY[alert.type] * 0.5;
  score += signalReliability;
  factors.push({
    factor: 'Signal Reliability',
    weight: 50,
    value: SIGNAL_RELIABILITY[alert.type],
    contribution: signalReliability,
    explanation: `${alert.type.replace(/_/g, ' ')} signals are ${signalReliability >= 40 ? 'highly' : signalReliability >= 25 ? 'moderately' : 'less'} reliable`,
  });

  // Change velocity (higher = more confident) (0-25 points)
  if (alert.metricChange) {
    const changePercent = Math.abs(alert.metricChange.changePercent);
    const velocityConfidence = Math.min(25, changePercent / 2);
    score += velocityConfidence;
    factors.push({
      factor: 'Change Magnitude',
      weight: 25,
      value: changePercent,
      contribution: velocityConfidence,
      explanation: `${changePercent.toFixed(0)}% change is ${velocityConfidence >= 20 ? 'significant' : velocityConfidence >= 10 ? 'notable' : 'minor'}`,
    });
  } else {
    score += 15; // Default moderate confidence
  }

  // Noise level adjustment (0-25 points reduction)
  const noiseLevel = calculateNoiseLevel(alert, context);
  const noisePenalty = noiseLevel * 0.25;
  score -= noisePenalty;
  if (noiseLevel > 0) {
    factors.push({
      factor: 'Noise Level',
      weight: -25,
      value: noiseLevel,
      contribution: -noisePenalty,
      explanation: `Signal may be affected by ${noiseLevel >= 60 ? 'high' : noiseLevel >= 30 ? 'moderate' : 'low'} noise factors`,
    });
  }

  return Math.max(0, Math.min(100, score));
}

function calculateNoiseLevel(alert: RawAlert, context: AlertContext): number {
  let noise = 0;

  // Seasonal pattern match
  if (context.seasonalPatterns) {
    const matchingPattern = context.seasonalPatterns.find(
      p => p.metric === alert.metricChange?.metric
    );
    if (matchingPattern && alert.metricChange) {
      const changePercent = Math.abs(alert.metricChange.changePercent);
      if (changePercent <= matchingPattern.expectedVariance) {
        noise += 40; // Change is within expected seasonal variance
      }
    }
  }

  // Already in active playbook/save play
  if (context.hasActiveSavePlay) {
    noise += 30; // Customer already getting attention
  }

  // Recent similar alerts (noise from repetition)
  const recentSimilar = context.recentAlerts.filter(
    a => a.type === alert.type && a.customerId === alert.customerId
  ).length;
  if (recentSimilar >= 3) {
    noise += 30; // Too many similar alerts recently
  }

  return Math.min(100, noise);
}

// ============================================
// Filter Detection
// ============================================

function shouldFilterAlert(
  alert: RawAlert,
  context: AlertContext,
  prefs: AlertPreferences,
  score: number
): { filtered: boolean; filterReason?: string } {
  // Filter minor health score fluctuations
  if (
    prefs.filterMinorHealthChanges &&
    alert.type === 'health_score_drop' &&
    alert.metricChange
  ) {
    const changePoints = Math.abs(alert.metricChange.currentValue - alert.metricChange.previousValue);
    if (changePoints < prefs.minorHealthChangeThreshold) {
      return {
        filtered: true,
        filterReason: `Minor health change (${changePoints} points < ${prefs.minorHealthChangeThreshold} threshold)`,
      };
    }
  }

  // Filter if within seasonal pattern variance
  if (prefs.filterSeasonalPatterns && context.seasonalPatterns && alert.metricChange) {
    const matchingPattern = context.seasonalPatterns.find(
      p => p.metric === alert.metricChange?.metric
    );
    if (matchingPattern) {
      const changePercent = Math.abs(alert.metricChange.changePercent);
      if (changePercent <= matchingPattern.expectedVariance) {
        return {
          filtered: true,
          filterReason: `Change within expected seasonal variance (${changePercent.toFixed(0)}% <= ${matchingPattern.expectedVariance}% expected)`,
        };
      }
    }
  }

  // Filter if customer has active save play
  if (prefs.filterActivePlaybooks && context.hasActiveSavePlay) {
    // Only filter lower-priority alerts for customers with active save plays
    if (score < 75) {
      return {
        filtered: true,
        filterReason: 'Customer has active save play - already receiving focused attention',
      };
    }
  }

  // Filter based on score threshold
  if (score < prefs.suppressThreshold) {
    return {
      filtered: true,
      filterReason: `Score ${score} below suppress threshold (${prefs.suppressThreshold})`,
    };
  }

  return { filtered: false };
}

// ============================================
// Delivery Recommendation
// ============================================

function getDeliveryRecommendation(
  score: number,
  filtered: boolean,
  prefs: AlertPreferences
): DeliveryRecommendation {
  if (filtered) {
    return 'suppress';
  }

  if (score >= prefs.immediateThreshold) {
    return 'immediate';
  }

  if (score >= prefs.digestThreshold) {
    return 'digest';
  }

  return 'suppress';
}

// ============================================
// Batch Scoring
// ============================================

export function scoreAlerts(
  alerts: RawAlert[],
  context: AlertContext,
  preferences?: Partial<AlertPreferences>
): AlertScore[] {
  return alerts.map(alert => scoreAlert(alert, context, preferences));
}

export default {
  scoreAlert,
  scoreAlerts,
};
