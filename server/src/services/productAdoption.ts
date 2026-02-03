/**
 * Product Adoption Service (PRD-064)
 *
 * Provides comprehensive product adoption metrics for customer accounts,
 * including feature utilization, user engagement, adoption trends,
 * and comparison to similar customers.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { ClaudeService } from './claude.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// =============================================================================
// TYPES
// =============================================================================

export interface UserMetrics {
  dau: number;
  wau: number;
  mau: number;
  licensedUsers: number;
  activatedUsers: number;
  userActivationRate: number;
  powerUsers: number;
  powerUserPercentage: number;
  dormantUsers: number;
  dormantUserPercentage: number;
  avgLoginFrequency: number;
  avgSessionDuration: number;
  userHealthBreakdown: {
    active: number;
    engaged: number;
    atRisk: number;
    dormant: number;
  };
  trends: {
    dauChange: number;
    wauChange: number;
    mauChange: number;
    activationChange: number;
  };
}

export interface FeatureAdoption {
  featureId: string;
  featureName: string;
  category: 'core' | 'advanced' | 'power';
  isAdopted: boolean;
  usagePercentage: number;
  usersCount: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  peerUsage: number;
  timeToAdoptDays: number | null;
  lastUsed: string | null;
}

export interface EngagementMetrics {
  actionsPerSession: number;
  apiUsage: {
    current: number;
    limit: number;
    utilizationPercentage: number;
  };
  integrationsUsed: number;
  integrationsAvailable: number;
  contentCreated: {
    reports: number;
    dashboards: number;
    automations: number;
    total: number;
    trend: 'growing' | 'stable' | 'declining';
  };
  collaborationRate: number;
}

export interface EntitlementUsage {
  name: string;
  used: number;
  entitled: number;
  utilizationPercentage: number;
  unit: string;
}

export interface PeerComparison {
  metric: string;
  customerValue: number;
  peerAverage: number;
  percentile: number;
  comparison: 'above' | 'average' | 'below';
}

export interface Recommendation {
  id: string;
  type: 'immediate' | 'value_demonstration';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  metric: string;
  impact: string;
  actions: Array<{
    label: string;
    type: 'schedule_training' | 'send_guide' | 'export_list' | 'share_link' | 'generate_report' | 'create_campaign';
  }>;
}

export interface UsagePattern {
  dayOfWeek: string;
  hour: number;
  intensity: number;
}

export interface AdoptionMilestone {
  date: string;
  milestone: string;
  description: string;
}

export interface TrendData {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  adoptionScore: number;
}

export interface ProductAdoptionDashboard {
  customerId: string;
  customerName: string;
  generatedAt: string;
  period: string;
  adoptionScore: number;
  adoptionScoreTrend: number;
  adoptionCategory: 'excellent' | 'good' | 'fair' | 'poor';
  userMetrics: UserMetrics;
  featureAdoption: FeatureAdoption[];
  featureAdoptionSummary: {
    coreFeaturesAdopted: number;
    coreFeaturesTotal: number;
    advancedFeaturesAdopted: number;
    advancedFeaturesTotal: number;
    powerFeaturesAdopted: number;
    powerFeaturesTotal: number;
    overallBreadth: number;
    featureStickiness: number;
  };
  engagementMetrics: EngagementMetrics;
  entitlementUsage: EntitlementUsage[];
  peerComparison: PeerComparison[];
  usagePatterns: UsagePattern[];
  adoptionMilestones: AdoptionMilestone[];
  trends: TrendData[];
  recommendations: Recommendation[];
  unusedFeatures: Array<{
    featureName: string;
    peerUsage: number;
    valueProp: string;
  }>;
  valueSummary: {
    estimatedHoursSaved: number;
    topBenefit: string;
    topBenefitImpact: string;
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ProductAdoptionService {
  private claude: ClaudeService;

  constructor() {
    this.claude = new ClaudeService();
  }

  /**
   * Generate comprehensive product adoption dashboard for a customer
   */
  async generateDashboard(
    customerId: string,
    period: '7d' | '30d' | '90d' | 'all' = '30d',
    comparison: 'peers' | 'segment' | 'all_customers' = 'peers'
  ): Promise<ProductAdoptionDashboard | null> {
    if (!supabase) {
      return this.generateMockDashboard(customerId, period);
    }

    // Fetch all data in parallel for performance
    const [
      customerData,
      usageMetrics,
      usageEvents,
      entitlements,
      contracts,
      peerData
    ] = await Promise.all([
      this.fetchCustomerData(customerId),
      this.fetchUsageMetrics(customerId, period),
      this.fetchUsageEvents(customerId, period),
      this.fetchEntitlements(customerId),
      this.fetchContracts(customerId),
      this.fetchPeerData(customerId, comparison)
    ]);

    if (!customerData) {
      return null;
    }

    // Calculate metrics
    const userMetrics = this.calculateUserMetrics(usageMetrics, usageEvents, entitlements);
    const featureAdoption = this.calculateFeatureAdoption(usageEvents, peerData);
    const engagementMetrics = this.calculateEngagementMetrics(usageEvents, entitlements);
    const entitlementUsage = this.calculateEntitlementUsage(usageMetrics, entitlements, contracts);
    const peerComparison = this.calculatePeerComparison(userMetrics, featureAdoption, engagementMetrics, peerData);
    const usagePatterns = this.calculateUsagePatterns(usageEvents);
    const adoptionMilestones = this.extractAdoptionMilestones(usageEvents);
    const trends = this.calculateTrends(usageMetrics, period);

    // Calculate adoption score
    const adoptionScore = this.calculateAdoptionScore(userMetrics, featureAdoption, engagementMetrics, entitlementUsage, trends);

    // Generate AI recommendations
    const recommendations = await this.generateRecommendations(
      customerData,
      userMetrics,
      featureAdoption,
      peerComparison,
      adoptionScore
    );

    // Identify unused features
    const unusedFeatures = this.identifyUnusedFeatures(featureAdoption, peerData);

    // Calculate value summary
    const valueSummary = this.calculateValueSummary(featureAdoption, engagementMetrics);

    // Feature adoption summary
    const featureAdoptionSummary = this.summarizeFeatureAdoption(featureAdoption);

    return {
      customerId,
      customerName: customerData.name,
      generatedAt: new Date().toISOString(),
      period,
      adoptionScore: adoptionScore.score,
      adoptionScoreTrend: adoptionScore.trend,
      adoptionCategory: adoptionScore.category,
      userMetrics,
      featureAdoption,
      featureAdoptionSummary,
      engagementMetrics,
      entitlementUsage,
      peerComparison,
      usagePatterns,
      adoptionMilestones,
      trends,
      recommendations,
      unusedFeatures,
      valueSummary
    };
  }

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================

  private async fetchCustomerData(customerId: string) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async fetchUsageMetrics(customerId: string, period: string) {
    if (!supabase) return [];

    const startDate = this.getStartDate(period);

    const { data, error } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .gte('period_start', startDate.toISOString())
      .order('period_end', { ascending: false });

    if (error) {
      console.error('Error fetching usage metrics:', error);
      return [];
    }

    return data || [];
  }

  private async fetchUsageEvents(customerId: string, period: string) {
    if (!supabase) return [];

    const startDate = this.getStartDate(period);

    const { data, error } = await supabase
      .from('usage_events')
      .select('*')
      .eq('customer_id', customerId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('Error fetching usage events:', error);
      return [];
    }

    return data || [];
  }

  private async fetchEntitlements(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('entitlements')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching entitlements:', error);
      return [];
    }

    return data || [];
  }

  private async fetchContracts(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }

    return data || [];
  }

  private async fetchPeerData(customerId: string, comparison: string) {
    if (!supabase) return { avgDau: 0, avgMau: 0, avgFeatureAdoption: {}, avgAdoptionScore: 0 };

    // First get the customer's segment
    const { data: customer } = await supabase
      .from('customers')
      .select('industry, segment, arr')
      .eq('id', customerId)
      .single();

    if (!customer) return { avgDau: 0, avgMau: 0, avgFeatureAdoption: {}, avgAdoptionScore: 0 };

    // Build peer filter based on comparison type
    let peerQuery = supabase
      .from('customers')
      .select('id')
      .neq('id', customerId)
      .eq('status', 'active');

    if (comparison === 'peers') {
      // Similar industry and ARR range
      peerQuery = peerQuery
        .eq('industry', customer.industry)
        .gte('arr', customer.arr * 0.5)
        .lte('arr', customer.arr * 2);
    } else if (comparison === 'segment') {
      peerQuery = peerQuery.eq('segment', customer.segment);
    }

    const { data: peers } = await peerQuery.limit(50);

    if (!peers || peers.length === 0) {
      return { avgDau: 0, avgMau: 0, avgFeatureAdoption: {}, avgAdoptionScore: 68 };
    }

    // Get peer metrics
    const peerIds = peers.map(p => p.id);
    const { data: peerMetrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .in('customer_id', peerIds)
      .order('calculated_at', { ascending: false });

    // Calculate peer averages
    const latestPeerMetrics = new Map();
    peerMetrics?.forEach(m => {
      if (!latestPeerMetrics.has(m.customer_id)) {
        latestPeerMetrics.set(m.customer_id, m);
      }
    });

    const peerMetricsList = Array.from(latestPeerMetrics.values());
    const avgDau = peerMetricsList.reduce((sum, m) => sum + (m.dau || 0), 0) / (peerMetricsList.length || 1);
    const avgMau = peerMetricsList.reduce((sum, m) => sum + (m.mau || 0), 0) / (peerMetricsList.length || 1);

    // Calculate average feature adoption
    const featureUsageCounts: Record<string, number[]> = {};
    peerMetricsList.forEach(m => {
      if (m.feature_breakdown) {
        Object.entries(m.feature_breakdown).forEach(([feature, count]) => {
          if (!featureUsageCounts[feature]) {
            featureUsageCounts[feature] = [];
          }
          featureUsageCounts[feature].push(count as number);
        });
      }
    });

    const avgFeatureAdoption: Record<string, number> = {};
    Object.entries(featureUsageCounts).forEach(([feature, counts]) => {
      avgFeatureAdoption[feature] = counts.reduce((a, b) => a + b, 0) / counts.length;
    });

    return {
      avgDau,
      avgMau,
      avgFeatureAdoption,
      avgAdoptionScore: 68, // Industry average baseline
      peerCount: peerMetricsList.length
    };
  }

  private getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'all':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  // ===========================================================================
  // METRIC CALCULATIONS
  // ===========================================================================

  private calculateUserMetrics(usageMetrics: any[], usageEvents: any[], entitlements: any[]): UserMetrics {
    const latestMetrics = usageMetrics[0] || {};
    const previousMetrics = usageMetrics[1] || {};

    // Get licensed users from entitlements
    const userEntitlement = entitlements.find((e: any) => e.type === 'users' || e.type === 'seats');
    const licensedUsers = userEntitlement?.limit || 200;

    // Calculate unique users
    const uniqueUsers = new Set(usageEvents.map((e: any) => e.user_id || e.user_email).filter(Boolean));
    const mau = latestMetrics.mau || uniqueUsers.size;
    const activatedUsers = mau;

    // Categorize user activity
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const userLastActive = new Map<string, Date>();
    usageEvents.forEach((e: any) => {
      const userId = e.user_id || e.user_email;
      if (userId) {
        const eventDate = new Date(e.timestamp);
        const current = userLastActive.get(userId);
        if (!current || eventDate > current) {
          userLastActive.set(userId, eventDate);
        }
      }
    });

    let activeCount = 0;
    let engagedCount = 0;
    let atRiskCount = 0;
    let dormantCount = 0;

    userLastActive.forEach((lastActive) => {
      if (lastActive >= sevenDaysAgo) {
        activeCount++;
      } else if (lastActive >= fourteenDaysAgo) {
        engagedCount++;
      } else if (lastActive >= thirtyDaysAgo) {
        atRiskCount++;
      } else {
        dormantCount++;
      }
    });

    // Calculate power users (top 20% by activity)
    const userActivityCounts = new Map<string, number>();
    usageEvents.forEach((e: any) => {
      const userId = e.user_id || e.user_email;
      if (userId) {
        userActivityCounts.set(userId, (userActivityCounts.get(userId) || 0) + 1);
      }
    });

    const activityValues = Array.from(userActivityCounts.values()).sort((a, b) => b - a);
    const powerUserThreshold = activityValues[Math.floor(activityValues.length * 0.2)] || 0;
    const powerUsers = activityValues.filter(v => v >= powerUserThreshold).length;

    // Calculate trends
    const dauChange = previousMetrics.dau ? ((latestMetrics.dau - previousMetrics.dau) / previousMetrics.dau) * 100 : 0;
    const wauChange = previousMetrics.wau ? ((latestMetrics.wau - previousMetrics.wau) / previousMetrics.wau) * 100 : 0;
    const mauChange = previousMetrics.mau ? ((mau - previousMetrics.mau) / previousMetrics.mau) * 100 : 0;

    return {
      dau: latestMetrics.dau || activeCount,
      wau: latestMetrics.wau || activeCount + engagedCount,
      mau,
      licensedUsers,
      activatedUsers,
      userActivationRate: (activatedUsers / licensedUsers) * 100,
      powerUsers,
      powerUserPercentage: (powerUsers / Math.max(mau, 1)) * 100,
      dormantUsers: dormantCount,
      dormantUserPercentage: (dormantCount / Math.max(mau, 1)) * 100,
      avgLoginFrequency: latestMetrics.total_logins ? latestMetrics.total_logins / Math.max(mau, 1) / 4 : 3.5,
      avgSessionDuration: 25, // Default, would need session data
      userHealthBreakdown: {
        active: activeCount,
        engaged: engagedCount,
        atRisk: atRiskCount,
        dormant: dormantCount
      },
      trends: {
        dauChange: Math.round(dauChange),
        wauChange: Math.round(wauChange),
        mauChange: Math.round(mauChange),
        activationChange: 0
      }
    };
  }

  private calculateFeatureAdoption(usageEvents: any[], peerData: any): FeatureAdoption[] {
    // Define standard features
    const featureDefinitions = [
      { id: 'dashboard', name: 'Dashboard', category: 'core' as const },
      { id: 'reports', name: 'Reports', category: 'core' as const },
      { id: 'alerts', name: 'Alerts', category: 'core' as const },
      { id: 'api', name: 'API', category: 'advanced' as const },
      { id: 'analytics', name: 'Analytics', category: 'advanced' as const },
      { id: 'automations', name: 'Automations', category: 'power' as const },
      { id: 'integrations', name: 'Integrations', category: 'advanced' as const },
      { id: 'mobile', name: 'Mobile App', category: 'power' as const }
    ];

    // Count feature usage
    const featureUsage = new Map<string, Set<string>>();
    const featureLastUsed = new Map<string, Date>();

    usageEvents.forEach((event: any) => {
      const feature = event.event_name || event.metadata?.feature;
      if (feature) {
        const featureKey = feature.toLowerCase();
        if (!featureUsage.has(featureKey)) {
          featureUsage.set(featureKey, new Set());
        }
        const userId = event.user_id || event.user_email;
        if (userId) {
          featureUsage.get(featureKey)!.add(userId);
        }

        const eventDate = new Date(event.timestamp);
        const currentLast = featureLastUsed.get(featureKey);
        if (!currentLast || eventDate > currentLast) {
          featureLastUsed.set(featureKey, eventDate);
        }
      }
    });

    // Calculate unique users total
    const totalUsers = new Set<string>();
    usageEvents.forEach((event: any) => {
      const userId = event.user_id || event.user_email;
      if (userId) totalUsers.add(userId);
    });
    const totalUserCount = totalUsers.size || 1;

    return featureDefinitions.map(def => {
      const users = featureUsage.get(def.id) || new Set();
      const usersCount = users.size;
      const usagePercentage = (usersCount / totalUserCount) * 100;
      const peerUsage = peerData.avgFeatureAdoption?.[def.id] || this.getDefaultPeerUsage(def.id);
      const lastUsed = featureLastUsed.get(def.id);

      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (usagePercentage < 10) healthStatus = 'critical';
      else if (usagePercentage < 30) healthStatus = 'warning';

      return {
        featureId: def.id,
        featureName: def.name,
        category: def.category,
        isAdopted: usagePercentage >= 10,
        usagePercentage: Math.round(usagePercentage),
        usersCount,
        healthStatus,
        peerUsage: Math.round(peerUsage),
        timeToAdoptDays: null,
        lastUsed: lastUsed?.toISOString() || null
      };
    });
  }

  private getDefaultPeerUsage(featureId: string): number {
    const defaults: Record<string, number> = {
      dashboard: 85,
      reports: 70,
      alerts: 55,
      api: 35,
      analytics: 65,
      automations: 58,
      integrations: 45,
      mobile: 42
    };
    return defaults[featureId] || 50;
  }

  private calculateEngagementMetrics(usageEvents: any[], entitlements: any[]): EngagementMetrics {
    // Calculate actions per session
    const sessions = new Map<string, number>();
    usageEvents.forEach((event: any) => {
      const sessionKey = `${event.user_id || event.user_email}_${new Date(event.timestamp).toDateString()}`;
      sessions.set(sessionKey, (sessions.get(sessionKey) || 0) + 1);
    });
    const sessionCounts = Array.from(sessions.values());
    const actionsPerSession = sessionCounts.length > 0
      ? sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length
      : 15;

    // API usage
    const apiEvents = usageEvents.filter((e: any) => e.event_type === 'api_call');
    const apiEntitlement = entitlements.find((e: any) => e.type === 'api_calls');
    const apiLimit = apiEntitlement?.limit || 10000;
    const dailyApiUsage = apiEvents.length / 30;

    // Integration usage
    const integrationEvents = usageEvents.filter((e: any) =>
      e.event_type === 'integration_used' || e.event_name?.includes('integration')
    );
    const uniqueIntegrations = new Set(integrationEvents.map((e: any) => e.metadata?.integration || e.event_name));

    // Content created
    const contentEvents = usageEvents.filter((e: any) =>
      e.event_type === 'content_created' || e.event_name?.includes('create')
    );
    const reports = contentEvents.filter((e: any) => e.metadata?.type === 'report').length;
    const dashboards = contentEvents.filter((e: any) => e.metadata?.type === 'dashboard').length;
    const automations = contentEvents.filter((e: any) => e.metadata?.type === 'automation').length;

    // Collaboration rate
    const collaborationEvents = usageEvents.filter((e: any) =>
      e.event_type === 'collaboration' || e.metadata?.shared
    );
    const collaborationRate = (collaborationEvents.length / Math.max(sessionCounts.length, 1)) * 100;

    return {
      actionsPerSession: Math.round(actionsPerSession),
      apiUsage: {
        current: Math.round(dailyApiUsage),
        limit: apiLimit,
        utilizationPercentage: Math.round((dailyApiUsage / apiLimit) * 100)
      },
      integrationsUsed: uniqueIntegrations.size,
      integrationsAvailable: 10, // Default
      contentCreated: {
        reports,
        dashboards,
        automations,
        total: reports + dashboards + automations,
        trend: (reports + dashboards + automations) > 5 ? 'growing' : 'stable'
      },
      collaborationRate: Math.round(collaborationRate)
    };
  }

  private calculateEntitlementUsage(usageMetrics: any[], entitlements: any[], contracts: any[]): EntitlementUsage[] {
    const latestMetrics = usageMetrics[0] || {};

    const result: EntitlementUsage[] = [];

    // Users/Seats
    const userEntitlement = entitlements.find((e: any) => e.type === 'users' || e.type === 'seats');
    if (userEntitlement) {
      result.push({
        name: 'Users',
        used: latestMetrics.mau || 0,
        entitled: userEntitlement.limit,
        utilizationPercentage: Math.round((latestMetrics.mau || 0) / userEntitlement.limit * 100),
        unit: 'users'
      });
    }

    // API Calls
    const apiEntitlement = entitlements.find((e: any) => e.type === 'api_calls');
    if (apiEntitlement) {
      result.push({
        name: 'API Calls/day',
        used: latestMetrics.api_calls || 0,
        entitled: apiEntitlement.limit,
        utilizationPercentage: Math.round((latestMetrics.api_calls || 0) / apiEntitlement.limit * 100),
        unit: 'calls'
      });
    }

    // Storage
    const storageEntitlement = entitlements.find((e: any) => e.type === 'storage');
    if (storageEntitlement) {
      result.push({
        name: 'Storage (GB)',
        used: latestMetrics.storage_used || 0,
        entitled: storageEntitlement.limit,
        utilizationPercentage: Math.round((latestMetrics.storage_used || 0) / storageEntitlement.limit * 100),
        unit: 'GB'
      });
    }

    // Integrations
    const integrationCount = latestMetrics.unique_features_used || 3;
    result.push({
      name: 'Integrations',
      used: integrationCount,
      entitled: -1, // Unlimited
      utilizationPercentage: -1,
      unit: 'integrations'
    });

    return result;
  }

  private calculatePeerComparison(
    userMetrics: UserMetrics,
    featureAdoption: FeatureAdoption[],
    engagementMetrics: EngagementMetrics,
    peerData: any
  ): PeerComparison[] {
    const comparisons: PeerComparison[] = [];

    // Adoption Score
    const featureBreadth = featureAdoption.filter(f => f.isAdopted).length / featureAdoption.length * 100;
    comparisons.push({
      metric: 'Feature Breadth',
      customerValue: Math.round(featureBreadth),
      peerAverage: 52,
      percentile: this.calculatePercentile(featureBreadth, 52, 15),
      comparison: featureBreadth > 57 ? 'above' : featureBreadth > 47 ? 'average' : 'below'
    });

    // User Activation
    comparisons.push({
      metric: 'User Activation',
      customerValue: Math.round(userMetrics.userActivationRate),
      peerAverage: 78,
      percentile: this.calculatePercentile(userMetrics.userActivationRate, 78, 12),
      comparison: userMetrics.userActivationRate > 85 ? 'above' : userMetrics.userActivationRate > 70 ? 'average' : 'below'
    });

    // API Usage
    const apiUsageLevel = engagementMetrics.apiUsage.utilizationPercentage > 50 ? 'High' : 'Medium';
    comparisons.push({
      metric: 'API Usage',
      customerValue: engagementMetrics.apiUsage.utilizationPercentage,
      peerAverage: 45,
      percentile: this.calculatePercentile(engagementMetrics.apiUsage.utilizationPercentage, 45, 20),
      comparison: engagementMetrics.apiUsage.utilizationPercentage > 55 ? 'above' : engagementMetrics.apiUsage.utilizationPercentage > 35 ? 'average' : 'below'
    });

    // Engagement Depth
    comparisons.push({
      metric: 'Actions per Session',
      customerValue: engagementMetrics.actionsPerSession,
      peerAverage: 15,
      percentile: this.calculatePercentile(engagementMetrics.actionsPerSession, 15, 5),
      comparison: engagementMetrics.actionsPerSession > 18 ? 'above' : engagementMetrics.actionsPerSession > 12 ? 'average' : 'below'
    });

    return comparisons;
  }

  private calculatePercentile(value: number, mean: number, stdDev: number): number {
    const zScore = (value - mean) / stdDev;
    // Approximate percentile from z-score
    const percentile = 50 + (zScore * 30);
    return Math.min(99, Math.max(1, Math.round(percentile)));
  }

  private calculateUsagePatterns(usageEvents: any[]): UsagePattern[] {
    const patterns: UsagePattern[] = [];
    const hourlyUsage = new Map<string, number>();

    usageEvents.forEach((event: any) => {
      const date = new Date(event.timestamp);
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      const hour = date.getHours();
      const key = `${day}_${hour}`;
      hourlyUsage.set(key, (hourlyUsage.get(key) || 0) + 1);
    });

    const maxUsage = Math.max(...Array.from(hourlyUsage.values()), 1);

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
      for (let hour = 8; hour <= 18; hour++) {
        const key = `${day}_${hour}`;
        const count = hourlyUsage.get(key) || 0;
        patterns.push({
          dayOfWeek: day,
          hour,
          intensity: Math.round((count / maxUsage) * 100)
        });
      }
    });

    return patterns;
  }

  private extractAdoptionMilestones(usageEvents: any[]): AdoptionMilestone[] {
    const milestones: AdoptionMilestone[] = [];
    const featureFirstUse = new Map<string, Date>();

    // Sort events by date ascending
    const sortedEvents = [...usageEvents].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedEvents.forEach((event: any) => {
      const feature = event.event_name || event.metadata?.feature;
      if (feature && !featureFirstUse.has(feature)) {
        featureFirstUse.set(feature, new Date(event.timestamp));
        milestones.push({
          date: event.timestamp,
          milestone: `${feature} adopted`,
          description: `First use of ${feature} feature`
        });
      }
    });

    return milestones.slice(-10); // Return last 10 milestones
  }

  private calculateTrends(usageMetrics: any[], period: string): TrendData[] {
    return usageMetrics.slice(0, 30).map((metric: any) => ({
      date: metric.period_end || metric.calculated_at,
      dau: metric.dau || 0,
      wau: metric.wau || 0,
      mau: metric.mau || 0,
      adoptionScore: this.calculateSimpleAdoptionScore(metric)
    })).reverse();
  }

  private calculateSimpleAdoptionScore(metric: any): number {
    const userUtilization = (metric.mau || 0) / 200 * 25;
    const featureBreadth = (metric.unique_features_used || 0) / 8 * 25;
    const engagement = Math.min(25, (metric.total_events || 0) / 1000 * 25);
    return Math.round(userUtilization + featureBreadth + engagement + 25);
  }

  // ===========================================================================
  // ADOPTION SCORE CALCULATION (Per PRD-064 formula)
  // ===========================================================================

  private calculateAdoptionScore(
    userMetrics: UserMetrics,
    featureAdoption: FeatureAdoption[],
    engagementMetrics: EngagementMetrics,
    entitlementUsage: EntitlementUsage[],
    trends: TrendData[]
  ): { score: number; trend: number; category: 'excellent' | 'good' | 'fair' | 'poor' } {
    // User Activation (25%)
    const userActivation = Math.min(100, userMetrics.userActivationRate);

    // Feature Breadth (25%)
    const adoptedFeatures = featureAdoption.filter(f => f.isAdopted).length;
    const totalFeatures = featureAdoption.length;
    const featureBreadth = (adoptedFeatures / totalFeatures) * 100;

    // Engagement Depth (20%) - normalized to 100
    const engagementDepth = Math.min(100, (engagementMetrics.actionsPerSession / 30) * 100);

    // Usage Trend (15%) - calculated from trend data
    let usageTrend = 50; // Baseline
    if (trends.length >= 2) {
      const recentAvg = trends.slice(-7).reduce((s, t) => s + t.mau, 0) / 7;
      const olderAvg = trends.slice(0, 7).reduce((s, t) => s + t.mau, 0) / Math.min(7, trends.length);
      if (olderAvg > 0) {
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        usageTrend = Math.min(100, Math.max(0, 50 + change));
      }
    }

    // Entitlement Utilization (15%)
    const userEntitlement = entitlementUsage.find(e => e.name === 'Users');
    const entitlementUtilization = userEntitlement?.utilizationPercentage || 50;

    // Calculate weighted score (per PRD-064)
    const score = Math.round(
      userActivation * 0.25 +
      featureBreadth * 0.25 +
      engagementDepth * 0.20 +
      usageTrend * 0.15 +
      entitlementUtilization * 0.15
    );

    // Calculate trend
    let trend = 0;
    if (trends.length >= 14) {
      const recent = trends.slice(-7).reduce((s, t) => s + t.adoptionScore, 0) / 7;
      const older = trends.slice(-14, -7).reduce((s, t) => s + t.adoptionScore, 0) / 7;
      trend = Math.round(recent - older);
    }

    // Categorize
    let category: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (score >= 80) category = 'excellent';
    else if (score >= 60) category = 'good';
    else if (score >= 40) category = 'fair';

    return { score, trend, category };
  }

  // ===========================================================================
  // AI RECOMMENDATIONS
  // ===========================================================================

  private async generateRecommendations(
    customer: any,
    userMetrics: UserMetrics,
    featureAdoption: FeatureAdoption[],
    peerComparison: PeerComparison[],
    adoptionScore: { score: number; trend: number; category: string }
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Dormant users recommendation
    if (userMetrics.dormantUsers > 0) {
      recommendations.push({
        id: 're-engage-dormant',
        type: 'immediate',
        title: 'Re-engage Dormant Users',
        description: `${userMetrics.dormantUsers} users haven't logged in 30+ days`,
        priority: userMetrics.dormantUserPercentage > 15 ? 'high' : 'medium',
        metric: 'dormant_users',
        impact: `Potential to recover ${userMetrics.dormantUsers} inactive users`,
        actions: [
          { label: 'Create Re-engagement Campaign', type: 'create_campaign' },
          { label: 'Export List', type: 'export_list' }
        ]
      });
    }

    // Underutilized features
    const underutilizedFeatures = featureAdoption.filter(f =>
      !f.isAdopted && f.peerUsage > 40
    );

    underutilizedFeatures.forEach((feature, index) => {
      if (index < 2) { // Limit to top 2
        recommendations.push({
          id: `feature-${feature.featureId}`,
          type: 'immediate',
          title: `${feature.featureName} Feature Training`,
          description: `Only ${feature.usagePercentage}% adoption vs ${feature.peerUsage}% peer average`,
          priority: feature.peerUsage > 60 ? 'high' : 'medium',
          metric: 'feature_adoption',
          impact: `Potential ${Math.round(feature.peerUsage - feature.usagePercentage)}% adoption improvement`,
          actions: [
            { label: 'Schedule Training Session', type: 'schedule_training' },
            { label: 'Send Self-Service Guide', type: 'send_guide' }
          ]
        });
      }
    });

    // User activation recommendation
    if (userMetrics.userActivationRate < 80) {
      recommendations.push({
        id: 'improve-activation',
        type: 'immediate',
        title: 'Improve User Activation',
        description: `${Math.round(100 - userMetrics.userActivationRate)}% of licensed users never logged in`,
        priority: userMetrics.userActivationRate < 60 ? 'high' : 'medium',
        metric: 'user_activation',
        impact: `Opportunity to activate ${userMetrics.licensedUsers - userMetrics.activatedUsers} additional users`,
        actions: [
          { label: 'Send Onboarding Campaign', type: 'create_campaign' },
          { label: 'Schedule Training', type: 'schedule_training' }
        ]
      });
    }

    // Value demonstration
    recommendations.push({
      id: 'value-report',
      type: 'value_demonstration',
      title: 'Generate Adoption Report for Customer',
      description: 'Share adoption progress and ROI metrics with stakeholders',
      priority: 'low',
      metric: 'adoption_score',
      impact: 'Demonstrate value and justify continued investment',
      actions: [
        { label: 'Generate Adoption Report', type: 'generate_report' }
      ]
    });

    return recommendations;
  }

  private identifyUnusedFeatures(featureAdoption: FeatureAdoption[], peerData: any): Array<{
    featureName: string;
    peerUsage: number;
    valueProp: string;
  }> {
    const valueProps: Record<string, string> = {
      analytics: '30% efficiency gain',
      automations: '5hrs/week saved',
      mobile: 'Faster response time',
      api: 'Custom integrations',
      integrations: 'Unified workflows'
    };

    return featureAdoption
      .filter(f => !f.isAdopted && f.peerUsage > 30)
      .map(f => ({
        featureName: f.featureName,
        peerUsage: f.peerUsage,
        valueProp: valueProps[f.featureId] || 'Improved productivity'
      }))
      .slice(0, 5);
  }

  private calculateValueSummary(featureAdoption: FeatureAdoption[], engagementMetrics: EngagementMetrics): {
    estimatedHoursSaved: number;
    topBenefit: string;
    topBenefitImpact: string;
  } {
    // Estimate hours saved based on features used
    const adoptedFeatures = featureAdoption.filter(f => f.isAdopted).length;
    const estimatedHoursSaved = adoptedFeatures * 15 + engagementMetrics.contentCreated.total * 2;

    // Determine top benefit
    const topFeature = featureAdoption
      .filter(f => f.isAdopted)
      .sort((a, b) => b.usagePercentage - a.usagePercentage)[0];

    return {
      estimatedHoursSaved,
      topBenefit: topFeature?.featureName || 'Dashboard',
      topBenefitImpact: topFeature?.featureName === 'reports' ? 'reduced reporting time by 60%' : 'streamlined daily workflows'
    };
  }

  private summarizeFeatureAdoption(featureAdoption: FeatureAdoption[]): {
    coreFeaturesAdopted: number;
    coreFeaturesTotal: number;
    advancedFeaturesAdopted: number;
    advancedFeaturesTotal: number;
    powerFeaturesAdopted: number;
    powerFeaturesTotal: number;
    overallBreadth: number;
    featureStickiness: number;
  } {
    const core = featureAdoption.filter(f => f.category === 'core');
    const advanced = featureAdoption.filter(f => f.category === 'advanced');
    const power = featureAdoption.filter(f => f.category === 'power');

    const coreAdopted = core.filter(f => f.isAdopted).length;
    const advancedAdopted = advanced.filter(f => f.isAdopted).length;
    const powerAdopted = power.filter(f => f.isAdopted).length;

    const totalAdopted = coreAdopted + advancedAdopted + powerAdopted;
    const overallBreadth = (totalAdopted / featureAdoption.length) * 100;

    // Feature stickiness = features used repeatedly
    const stickyFeatures = featureAdoption.filter(f => f.usagePercentage > 20).length;
    const featureStickiness = (stickyFeatures / featureAdoption.length) * 100;

    return {
      coreFeaturesAdopted: coreAdopted,
      coreFeaturesTotal: core.length,
      advancedFeaturesAdopted: advancedAdopted,
      advancedFeaturesTotal: advanced.length,
      powerFeaturesAdopted: powerAdopted,
      powerFeaturesTotal: power.length,
      overallBreadth: Math.round(overallBreadth),
      featureStickiness: Math.round(featureStickiness)
    };
  }

  // ===========================================================================
  // MOCK DATA FOR DEMO
  // ===========================================================================

  private generateMockDashboard(customerId: string, period: string): ProductAdoptionDashboard {
    const now = new Date();

    return {
      customerId,
      customerName: 'Acme Corp',
      generatedAt: now.toISOString(),
      period,
      adoptionScore: 72,
      adoptionScoreTrend: 5,
      adoptionCategory: 'good',
      userMetrics: {
        dau: 89,
        wau: 128,
        mau: 145,
        licensedUsers: 200,
        activatedUsers: 145,
        userActivationRate: 73,
        powerUsers: 18,
        powerUserPercentage: 12,
        dormantUsers: 10,
        dormantUserPercentage: 7,
        avgLoginFrequency: 3.5,
        avgSessionDuration: 25,
        userHealthBreakdown: {
          active: 89,
          engaged: 28,
          atRisk: 18,
          dormant: 10
        },
        trends: {
          dauChange: 12,
          wauChange: 8,
          mauChange: 5,
          activationChange: 3
        }
      },
      featureAdoption: [
        { featureId: 'dashboard', featureName: 'Dashboard', category: 'core', isAdopted: true, usagePercentage: 89, usersCount: 129, healthStatus: 'healthy', peerUsage: 85, timeToAdoptDays: 2, lastUsed: now.toISOString() },
        { featureId: 'reports', featureName: 'Reports', category: 'core', isAdopted: true, usagePercentage: 72, usersCount: 104, healthStatus: 'healthy', peerUsage: 70, timeToAdoptDays: 5, lastUsed: now.toISOString() },
        { featureId: 'alerts', featureName: 'Alerts', category: 'core', isAdopted: true, usagePercentage: 45, usersCount: 65, healthStatus: 'healthy', peerUsage: 55, timeToAdoptDays: 14, lastUsed: now.toISOString() },
        { featureId: 'api', featureName: 'API', category: 'advanced', isAdopted: true, usagePercentage: 15, usersCount: 22, healthStatus: 'warning', peerUsage: 35, timeToAdoptDays: 21, lastUsed: now.toISOString() },
        { featureId: 'analytics', featureName: 'Analytics', category: 'advanced', isAdopted: false, usagePercentage: 8, usersCount: 12, healthStatus: 'critical', peerUsage: 65, timeToAdoptDays: null, lastUsed: null },
        { featureId: 'automations', featureName: 'Automations', category: 'power', isAdopted: false, usagePercentage: 3, usersCount: 4, healthStatus: 'critical', peerUsage: 58, timeToAdoptDays: null, lastUsed: null },
        { featureId: 'integrations', featureName: 'Integrations', category: 'advanced', isAdopted: true, usagePercentage: 25, usersCount: 36, healthStatus: 'warning', peerUsage: 45, timeToAdoptDays: 30, lastUsed: now.toISOString() },
        { featureId: 'mobile', featureName: 'Mobile App', category: 'power', isAdopted: false, usagePercentage: 0, usersCount: 0, healthStatus: 'critical', peerUsage: 42, timeToAdoptDays: null, lastUsed: null }
      ],
      featureAdoptionSummary: {
        coreFeaturesAdopted: 3,
        coreFeaturesTotal: 3,
        advancedFeaturesAdopted: 2,
        advancedFeaturesTotal: 3,
        powerFeaturesAdopted: 0,
        powerFeaturesTotal: 2,
        overallBreadth: 58,
        featureStickiness: 63
      },
      engagementMetrics: {
        actionsPerSession: 18,
        apiUsage: {
          current: 8500,
          limit: 10000,
          utilizationPercentage: 85
        },
        integrationsUsed: 3,
        integrationsAvailable: 10,
        contentCreated: {
          reports: 45,
          dashboards: 12,
          automations: 3,
          total: 60,
          trend: 'growing'
        },
        collaborationRate: 22
      },
      entitlementUsage: [
        { name: 'Users', used: 145, entitled: 200, utilizationPercentage: 73, unit: 'users' },
        { name: 'API Calls/day', used: 8500, entitled: 10000, utilizationPercentage: 85, unit: 'calls' },
        { name: 'Storage (GB)', used: 42, entitled: 100, utilizationPercentage: 42, unit: 'GB' },
        { name: 'Integrations', used: 3, entitled: -1, utilizationPercentage: -1, unit: 'integrations' }
      ],
      peerComparison: [
        { metric: 'Adoption Score', customerValue: 72, peerAverage: 68, percentile: 65, comparison: 'above' },
        { metric: 'Feature Breadth', customerValue: 58, peerAverage: 52, percentile: 70, comparison: 'above' },
        { metric: 'User Activation', customerValue: 73, peerAverage: 78, percentile: 45, comparison: 'below' },
        { metric: 'API Usage', customerValue: 85, peerAverage: 45, percentile: 80, comparison: 'above' }
      ],
      usagePatterns: [
        { dayOfWeek: 'Mon', hour: 9, intensity: 45 },
        { dayOfWeek: 'Mon', hour: 10, intensity: 78 },
        { dayOfWeek: 'Mon', hour: 11, intensity: 92 },
        { dayOfWeek: 'Tue', hour: 9, intensity: 65 },
        { dayOfWeek: 'Tue', hour: 10, intensity: 95 },
        { dayOfWeek: 'Tue', hour: 11, intensity: 100 },
        { dayOfWeek: 'Wed', hour: 9, intensity: 55 },
        { dayOfWeek: 'Wed', hour: 10, intensity: 88 },
        { dayOfWeek: 'Wed', hour: 11, intensity: 90 },
        { dayOfWeek: 'Thu', hour: 9, intensity: 60 },
        { dayOfWeek: 'Thu', hour: 10, intensity: 92 },
        { dayOfWeek: 'Thu', hour: 11, intensity: 95 },
        { dayOfWeek: 'Fri', hour: 9, intensity: 40 },
        { dayOfWeek: 'Fri', hour: 10, intensity: 65 },
        { dayOfWeek: 'Fri', hour: 11, intensity: 70 }
      ],
      adoptionMilestones: [
        { date: new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000).toISOString(), milestone: 'Core features adopted', description: 'Dashboard and Reports in use' },
        { date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), milestone: 'API integration completed', description: 'First API call made' },
        { date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(), milestone: 'First custom report created', description: 'User-generated report' }
      ],
      trends: this.generateMockTrends(30),
      recommendations: [
        {
          id: 're-engage-dormant',
          type: 'immediate',
          title: 'Re-engage Dormant Users',
          description: '10 users inactive >30 days',
          priority: 'medium',
          metric: 'dormant_users',
          impact: 'Potential to recover 10 inactive users',
          actions: [
            { label: 'Create Re-engagement Campaign', type: 'create_campaign' },
            { label: 'Export List', type: 'export_list' }
          ]
        },
        {
          id: 'analytics-training',
          type: 'immediate',
          title: 'Analytics Feature Training',
          description: 'Only 8% adoption vs 65% peer avg',
          priority: 'high',
          metric: 'feature_adoption',
          impact: '30% efficiency gain potential',
          actions: [
            { label: 'Schedule Training Session', type: 'schedule_training' },
            { label: 'Send Self-Service Guide', type: 'send_guide' }
          ]
        },
        {
          id: 'mobile-adoption',
          type: 'immediate',
          title: 'Mobile Adoption',
          description: '0% usage of mobile app',
          priority: 'medium',
          metric: 'feature_adoption',
          impact: 'Faster response time for users',
          actions: [
            { label: 'Share App Download Links', type: 'share_link' }
          ]
        }
      ],
      unusedFeatures: [
        { featureName: 'Analytics', peerUsage: 65, valueProp: '30% efficiency gain' },
        { featureName: 'Automations', peerUsage: 58, valueProp: '5hrs/week saved' },
        { featureName: 'Mobile App', peerUsage: 42, valueProp: 'Faster response' }
      ],
      valueSummary: {
        estimatedHoursSaved: 120,
        topBenefit: 'Dashboard',
        topBenefitImpact: 'reduced reporting time by 60%'
      }
    };
  }

  private generateMockTrends(days: number): TrendData[] {
    const trends: TrendData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayVariation = Math.sin(i * 0.5) * 10;
      const trendGrowth = (days - i) * 0.3;

      trends.push({
        date: date.toISOString().split('T')[0],
        dau: Math.round(75 + dayVariation + trendGrowth),
        wau: Math.round(115 + dayVariation + trendGrowth),
        mau: Math.round(135 + trendGrowth),
        adoptionScore: Math.round(65 + trendGrowth * 0.3)
      });
    }

    return trends;
  }
}

export const productAdoptionService = new ProductAdoptionService();
