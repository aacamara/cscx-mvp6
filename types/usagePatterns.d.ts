/**
 * Usage Pattern Analysis Types
 * PRD-066: Usage Pattern Analysis
 */
export interface HourlyPattern {
    hour: number;
    avgEvents: number;
    avgUsers: number;
    peakDays: string[];
}
export interface DailyPattern {
    dayOfWeek: number;
    dayName: string;
    avgEvents: number;
    avgUsers: number;
    avgSessionDuration: number;
    isWorkday: boolean;
}
export interface WeeklyTrend {
    weekStart: string;
    weekEnd: string;
    totalEvents: number;
    totalUsers: number;
    avgEventsPerUser: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
}
export interface FeatureUsagePattern {
    featureName: string;
    totalUsage: number;
    uniqueUsers: number;
    avgUsagePerUser: number;
    adoptionRate: number;
    stickiness: number;
    trend: 'growing' | 'stable' | 'declining';
    lastUsed: string;
    firstUsed: string;
    recommendedAction?: string;
}
export interface FeatureAdoptionFunnel {
    stage: 'awareness' | 'trial' | 'adoption' | 'power_user';
    featureName: string;
    userCount: number;
    percentage: number;
}
export interface UserSegment {
    segment: 'power_user' | 'regular' | 'casual' | 'dormant' | 'churned';
    count: number;
    percentage: number;
    avgEventsPerDay: number;
    avgSessionDuration: number;
    topFeatures: string[];
    riskLevel: 'low' | 'medium' | 'high';
}
export interface UserActivityProfile {
    userId: string;
    userEmail?: string;
    segment: UserSegment['segment'];
    totalEvents: number;
    lastActive: string;
    firstActive: string;
    activeDays: number;
    avgEventsPerSession: number;
    topFeatures: string[];
    engagementScore: number;
}
export interface EngagementMetrics {
    dauToMauRatio: number;
    avgSessionsPerUser: number;
    avgSessionDuration: number;
    returnRate: number;
    engagementScore: number;
    trend: 'improving' | 'stable' | 'declining';
}
export interface UsageAnomaly {
    id: string;
    type: 'spike' | 'drop' | 'pattern_change' | 'feature_abandonment';
    severity: 'low' | 'medium' | 'high' | 'critical';
    metric: string;
    expectedValue: number;
    actualValue: number;
    deviationPercent: number;
    detectedAt: string;
    description: string;
    recommendation: string;
    dismissed: boolean;
}
export interface UsagePrediction {
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: string;
    factors: string[];
}
export interface ChurnRiskIndicator {
    factor: string;
    weight: number;
    score: number;
    description: string;
    trend: 'improving' | 'stable' | 'worsening';
}
export interface UsagePatternAnalysis {
    customerId: string;
    customerName: string;
    analyzedPeriod: {
        start: string;
        end: string;
        days: number;
    };
    summary: {
        overallEngagement: number;
        trend: 'improving' | 'stable' | 'declining';
        churnRisk: 'low' | 'medium' | 'high';
        topInsight: string;
    };
    timePatterns: {
        hourly: HourlyPattern[];
        daily: DailyPattern[];
        weekly: WeeklyTrend[];
        peakUsageTimes: string[];
    };
    featurePatterns: {
        features: FeatureUsagePattern[];
        adoptionFunnel: FeatureAdoptionFunnel[];
        unusedFeatures: string[];
        decliningFeatures: string[];
    };
    userSegmentation: {
        segments: UserSegment[];
        topUsers: UserActivityProfile[];
        atRiskUsers: UserActivityProfile[];
    };
    engagement: EngagementMetrics;
    anomalies: UsageAnomaly[];
    predictions: UsagePrediction[];
    churnIndicators: ChurnRiskIndicator[];
    recommendations: UsageRecommendation[];
    generatedAt: string;
}
export interface UsageRecommendation {
    priority: 'high' | 'medium' | 'low';
    category: 'engagement' | 'adoption' | 'retention' | 'growth';
    title: string;
    description: string;
    impact: string;
    suggestedAction: string;
    relatedMetric: string;
}
export interface UsagePatternRequest {
    customerId: string;
    period?: '7d' | '30d' | '90d' | 'all';
    includeAnomalies?: boolean;
    includePredictions?: boolean;
    includeUserDetails?: boolean;
}
export interface UsagePatternResponse {
    success: boolean;
    data: UsagePatternAnalysis;
    cached?: boolean;
    cacheExpiry?: string;
}
export interface UsageComparison {
    customerId: string;
    customerName: string;
    metrics: {
        engagement: number;
        featureAdoption: number;
        activityFrequency: number;
    };
}
export interface BenchmarkComparison {
    metric: string;
    customerValue: number;
    peerAverage: number;
    segmentAverage: number;
    percentile: number;
    rating: 'below_average' | 'average' | 'above_average' | 'top_performer';
}
//# sourceMappingURL=usagePatterns.d.ts.map