/**
 * Usage Pattern Analysis Service
 * PRD-066: Usage Pattern Analysis
 *
 * Provides comprehensive analysis of customer usage patterns including:
 * - Time-based patterns (hourly, daily, weekly)
 * - Feature adoption and stickiness
 * - User segmentation
 * - Engagement metrics
 * - Anomaly detection
 * - Churn risk indicators
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  UsagePatternAnalysis,
  HourlyPattern,
  DailyPattern,
  WeeklyTrend,
  FeatureUsagePattern,
  FeatureAdoptionFunnel,
  UserSegment,
  UserActivityProfile,
  EngagementMetrics,
  UsageAnomaly,
  UsagePrediction,
  ChurnRiskIndicator,
  UsageRecommendation,
  BenchmarkComparison,
} from '../../../../types/usagePatterns.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Day names for patterns
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Feature catalog for adoption tracking
const FEATURE_CATALOG = [
  'dashboard', 'reports', 'analytics', 'integrations', 'api',
  'automations', 'alerts', 'exports', 'collaboration', 'mobile',
  'settings', 'admin', 'search', 'templates', 'workflows'
];

/**
 * Main function to analyze usage patterns for a customer
 */
export async function analyzeUsagePatterns(
  customerId: string,
  options: {
    period?: '7d' | '30d' | '90d' | 'all';
    includeAnomalies?: boolean;
    includePredictions?: boolean;
    includeUserDetails?: boolean;
  } = {}
): Promise<UsagePatternAnalysis> {
  const {
    period = '30d',
    includeAnomalies = true,
    includePredictions = true,
    includeUserDetails = true,
  } = options;

  // Calculate date range
  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Get customer info
  const customer = await getCustomerInfo(customerId);
  const customerName = customer?.name || 'Unknown Customer';

  // Fetch usage events
  const events = await fetchUsageEvents(customerId, startDate, now);

  // Run all analyses in parallel
  const [
    timePatterns,
    featurePatterns,
    userSegmentation,
    engagement,
    anomalies,
    predictions,
    churnIndicators,
  ] = await Promise.all([
    analyzeTimePatterns(events),
    analyzeFeaturePatterns(events, customerId),
    analyzeUserSegmentation(events, customerId, includeUserDetails),
    calculateEngagementMetrics(events, customerId),
    includeAnomalies ? detectAnomalies(events, customerId) : [],
    includePredictions ? generatePredictions(events, customerId) : [],
    calculateChurnIndicators(events, customerId),
  ]);

  // Generate recommendations based on all analyses
  const recommendations = generateRecommendations(
    timePatterns,
    featurePatterns,
    userSegmentation,
    engagement,
    anomalies,
    churnIndicators
  );

  // Calculate summary
  const summary = calculateSummary(engagement, churnIndicators, recommendations);

  return {
    customerId,
    customerName,
    analyzedPeriod: {
      start: startDate.toISOString(),
      end: now.toISOString(),
      days,
    },
    summary,
    timePatterns,
    featurePatterns,
    userSegmentation,
    engagement,
    anomalies,
    predictions,
    churnIndicators,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get customer information
 */
async function getCustomerInfo(customerId: string): Promise<{ name: string; segment?: string } | null> {
  if (!supabase) {
    return { name: 'Demo Customer', segment: 'enterprise' };
  }

  const { data, error } = await supabase
    .from('customers')
    .select('name, segment')
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('Failed to fetch customer info:', error);
    return null;
  }

  return data;
}

/**
 * Fetch usage events from database
 */
async function fetchUsageEvents(
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  event_type: string;
  event_name: string;
  user_id?: string;
  user_email?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}>> {
  if (!supabase) {
    // Return mock data for development
    return generateMockEvents(startDate, endDate);
  }

  const { data, error } = await supabase
    .from('usage_events')
    .select('*')
    .eq('customer_id', customerId)
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Failed to fetch usage events:', error);
    return [];
  }

  return data || [];
}

/**
 * Generate mock events for development
 */
function generateMockEvents(startDate: Date, endDate: Date): Array<{
  event_type: string;
  event_name: string;
  user_id?: string;
  user_email?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}> {
  const events: Array<{
    event_type: string;
    event_name: string;
    user_id?: string;
    user_email?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }> = [];

  const users = [
    { id: 'user-1', email: 'admin@acme.com' },
    { id: 'user-2', email: 'sarah@acme.com' },
    { id: 'user-3', email: 'mike@acme.com' },
    { id: 'user-4', email: 'lisa@acme.com' },
    { id: 'user-5', email: 'john@acme.com' },
  ];

  const features = ['dashboard', 'reports', 'analytics', 'integrations', 'api', 'alerts'];
  const eventTypes = ['login', 'feature_used', 'api_call', 'export', 'search'];

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // More activity on weekdays
    const dayOfWeek = currentDate.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const baseEvents = isWeekday ? 50 : 15;

    // Peak hours (9am-5pm)
    for (let hour = 0; hour < 24; hour++) {
      const isPeakHour = hour >= 9 && hour <= 17;
      const hourlyEvents = isPeakHour ? Math.floor(baseEvents * 0.8) : Math.floor(baseEvents * 0.2);

      for (let i = 0; i < hourlyEvents; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const feature = features[Math.floor(Math.random() * features.length)];

        const eventTime = new Date(currentDate);
        eventTime.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

        events.push({
          event_type: eventType,
          event_name: eventType === 'feature_used' ? feature : eventType,
          user_id: user.id,
          user_email: user.email,
          timestamp: eventTime.toISOString(),
          metadata: { feature, sessionId: `session-${Math.random().toString(36).slice(2, 8)}` },
        });
      }
    }

    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return events;
}

/**
 * Analyze time-based patterns
 */
async function analyzeTimePatterns(events: Array<{
  timestamp: string;
  user_id?: string;
  user_email?: string;
}>): Promise<{
  hourly: HourlyPattern[];
  daily: DailyPattern[];
  weekly: WeeklyTrend[];
  peakUsageTimes: string[];
}> {
  // Hourly patterns
  const hourlyData: { [hour: number]: { events: number[]; users: Set<string>[] } } = {};
  for (let h = 0; h < 24; h++) {
    hourlyData[h] = { events: [], users: [] };
  }

  // Daily patterns
  const dailyData: { [day: number]: { events: number[]; users: Set<string>[] } } = {};
  for (let d = 0; d < 7; d++) {
    dailyData[d] = { events: [], users: [] };
  }

  // Weekly data
  const weeklyData: { [weekStart: string]: { events: number; users: Set<string> } } = {};

  // Process events
  const dateEventCounts: { [date: string]: { [hour: number]: number; users: Set<string> } } = {};

  events.forEach(event => {
    const date = new Date(event.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const userId = event.user_id || event.user_email || 'anonymous';

    // Track by date for aggregation
    if (!dateEventCounts[dateStr]) {
      dateEventCounts[dateStr] = { users: new Set() };
      for (let h = 0; h < 24; h++) {
        dateEventCounts[dateStr][h] = 0;
      }
    }
    dateEventCounts[dateStr][hour]++;
    dateEventCounts[dateStr].users.add(userId);

    // Weekly aggregation
    const weekStart = getWeekStart(date);
    if (!weeklyData[weekStart]) {
      weeklyData[weekStart] = { events: 0, users: new Set() };
    }
    weeklyData[weekStart].events++;
    weeklyData[weekStart].users.add(userId);
  });

  // Aggregate hourly and daily patterns
  Object.entries(dateEventCounts).forEach(([dateStr, data]) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();

    for (let h = 0; h < 24; h++) {
      hourlyData[h].events.push(data[h] || 0);
    }

    const dailyTotal = Object.entries(data)
      .filter(([k]) => k !== 'users')
      .reduce((sum, [, count]) => sum + (count as number), 0);

    dailyData[dayOfWeek].events.push(dailyTotal);
    dailyData[dayOfWeek].users.push(data.users);
  });

  // Calculate hourly patterns
  const hourly: HourlyPattern[] = [];
  let maxHourlyAvg = 0;
  let peakHour = 0;

  for (let h = 0; h < 24; h++) {
    const eventArr = hourlyData[h].events;
    const avgEvents = eventArr.length > 0 ? eventArr.reduce((a, b) => a + b, 0) / eventArr.length : 0;
    const avgUsers = eventArr.length;

    if (avgEvents > maxHourlyAvg) {
      maxHourlyAvg = avgEvents;
      peakHour = h;
    }

    hourly.push({
      hour: h,
      avgEvents: Math.round(avgEvents * 100) / 100,
      avgUsers: Math.round(avgUsers * 100) / 100,
      peakDays: [],
    });
  }

  // Calculate daily patterns
  const daily: DailyPattern[] = DAY_NAMES.map((dayName, i) => {
    const data = dailyData[i];
    const avgEvents = data.events.length > 0
      ? data.events.reduce((a, b) => a + b, 0) / data.events.length
      : 0;
    const avgUsers = data.users.length > 0
      ? data.users.reduce((count, userSet) => count + userSet.size, 0) / data.users.length
      : 0;

    return {
      dayOfWeek: i,
      dayName,
      avgEvents: Math.round(avgEvents),
      avgUsers: Math.round(avgUsers),
      avgSessionDuration: Math.round(15 + Math.random() * 30), // Mock session duration
      isWorkday: i >= 1 && i <= 5,
    };
  });

  // Calculate weekly trends
  const weekStarts = Object.keys(weeklyData).sort();
  const weekly: WeeklyTrend[] = weekStarts.map((weekStart, i) => {
    const data = weeklyData[weekStart];
    const weekEnd = new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const totalUsers = data.users.size;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    let percentChange = 0;

    if (i > 0) {
      const prevWeek = weeklyData[weekStarts[i - 1]];
      percentChange = prevWeek.events > 0
        ? Math.round(((data.events - prevWeek.events) / prevWeek.events) * 100)
        : 0;
      trend = percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable';
    }

    return {
      weekStart,
      weekEnd,
      totalEvents: data.events,
      totalUsers,
      avgEventsPerUser: totalUsers > 0 ? Math.round((data.events / totalUsers) * 10) / 10 : 0,
      trend,
      percentChange,
    };
  });

  // Determine peak usage times
  const peakUsageTimes: string[] = [];
  const peakDays = daily.filter(d => d.isWorkday).sort((a, b) => b.avgEvents - a.avgEvents).slice(0, 3);
  peakDays.forEach(d => {
    peakUsageTimes.push(`${d.dayName} ${peakHour}:00-${(peakHour + 2) % 24}:00`);
  });

  return { hourly, daily, weekly, peakUsageTimes };
}

/**
 * Analyze feature usage patterns
 */
async function analyzeFeaturePatterns(
  events: Array<{
    event_type: string;
    event_name: string;
    user_id?: string;
    user_email?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>,
  customerId: string
): Promise<{
  features: FeatureUsagePattern[];
  adoptionFunnel: FeatureAdoptionFunnel[];
  unusedFeatures: string[];
  decliningFeatures: string[];
}> {
  // Track feature usage
  const featureUsage: { [feature: string]: {
    totalUsage: number;
    users: Set<string>;
    userUsage: { [userId: string]: number };
    timestamps: Date[];
  } } = {};

  // Get unique users count
  const allUsers = new Set<string>();
  events.forEach(e => {
    const userId = e.user_id || e.user_email || 'anonymous';
    allUsers.add(userId);
  });
  const totalUserCount = allUsers.size;

  // Process feature events
  events.filter(e => e.event_type === 'feature_used' || e.metadata?.feature).forEach(event => {
    const feature = event.event_name || (event.metadata?.feature as string) || 'unknown';
    const userId = event.user_id || event.user_email || 'anonymous';

    if (!featureUsage[feature]) {
      featureUsage[feature] = {
        totalUsage: 0,
        users: new Set(),
        userUsage: {},
        timestamps: [],
      };
    }

    featureUsage[feature].totalUsage++;
    featureUsage[feature].users.add(userId);
    featureUsage[feature].userUsage[userId] = (featureUsage[feature].userUsage[userId] || 0) + 1;
    featureUsage[feature].timestamps.push(new Date(event.timestamp));
  });

  // Build feature patterns
  const features: FeatureUsagePattern[] = Object.entries(featureUsage).map(([featureName, data]) => {
    const uniqueUsers = data.users.size;
    const adoptionRate = totalUserCount > 0 ? Math.round((uniqueUsers / totalUserCount) * 100) : 0;

    // Calculate stickiness (users who used feature more than once)
    const repeatUsers = Object.values(data.userUsage).filter(count => count > 1).length;
    const stickiness = uniqueUsers > 0 ? Math.round((repeatUsers / uniqueUsers) * 100) : 0;

    // Determine trend by comparing first half vs second half
    const sortedTimestamps = data.timestamps.sort((a, b) => a.getTime() - b.getTime());
    const midpoint = Math.floor(sortedTimestamps.length / 2);
    const firstHalf = sortedTimestamps.slice(0, midpoint).length;
    const secondHalf = sortedTimestamps.slice(midpoint).length;
    const trend: 'growing' | 'stable' | 'declining' =
      secondHalf > firstHalf * 1.1 ? 'growing' :
      secondHalf < firstHalf * 0.9 ? 'declining' : 'stable';

    return {
      featureName,
      totalUsage: data.totalUsage,
      uniqueUsers,
      avgUsagePerUser: uniqueUsers > 0 ? Math.round((data.totalUsage / uniqueUsers) * 10) / 10 : 0,
      adoptionRate,
      stickiness,
      trend,
      lastUsed: sortedTimestamps.length > 0 ? sortedTimestamps[sortedTimestamps.length - 1].toISOString() : '',
      firstUsed: sortedTimestamps.length > 0 ? sortedTimestamps[0].toISOString() : '',
      recommendedAction: generateFeatureRecommendation(adoptionRate, stickiness, trend),
    };
  }).sort((a, b) => b.totalUsage - a.totalUsage);

  // Build adoption funnel
  const adoptionFunnel: FeatureAdoptionFunnel[] = [];
  const coreFeatures = features.slice(0, 5);

  coreFeatures.forEach(feature => {
    const awarenessCount = Math.round(totalUserCount * 0.9);
    const trialCount = feature.uniqueUsers;
    const adoptionCount = Math.round(feature.uniqueUsers * (feature.stickiness / 100));
    const powerUserCount = Math.round(adoptionCount * 0.2);

    adoptionFunnel.push(
      { stage: 'awareness', featureName: feature.featureName, userCount: awarenessCount, percentage: 90 },
      { stage: 'trial', featureName: feature.featureName, userCount: trialCount, percentage: feature.adoptionRate },
      { stage: 'adoption', featureName: feature.featureName, userCount: adoptionCount, percentage: Math.round(feature.adoptionRate * feature.stickiness / 100) },
      { stage: 'power_user', featureName: feature.featureName, userCount: powerUserCount, percentage: Math.round(feature.adoptionRate * feature.stickiness / 100 * 0.2) }
    );
  });

  // Find unused features
  const usedFeatures = new Set(features.map(f => f.featureName));
  const unusedFeatures = FEATURE_CATALOG.filter(f => !usedFeatures.has(f));

  // Find declining features
  const decliningFeatures = features
    .filter(f => f.trend === 'declining')
    .map(f => f.featureName);

  return { features, adoptionFunnel, unusedFeatures, decliningFeatures };
}

/**
 * Analyze user segmentation
 */
async function analyzeUserSegmentation(
  events: Array<{
    event_type: string;
    event_name: string;
    user_id?: string;
    user_email?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>,
  customerId: string,
  includeUserDetails: boolean
): Promise<{
  segments: UserSegment[];
  topUsers: UserActivityProfile[];
  atRiskUsers: UserActivityProfile[];
}> {
  // Track user activity
  const userActivity: { [userId: string]: {
    email?: string;
    events: number;
    features: Set<string>;
    timestamps: Date[];
    activeDays: Set<string>;
  } } = {};

  events.forEach(event => {
    const userId = event.user_id || event.user_email || 'anonymous';
    const userEmail = event.user_email;

    if (!userActivity[userId]) {
      userActivity[userId] = {
        email: userEmail,
        events: 0,
        features: new Set(),
        timestamps: [],
        activeDays: new Set(),
      };
    }

    userActivity[userId].events++;
    userActivity[userId].timestamps.push(new Date(event.timestamp));
    userActivity[userId].activeDays.add(event.timestamp.split('T')[0]);

    if (event.event_name && event.event_type === 'feature_used') {
      userActivity[userId].features.add(event.event_name);
    }
  });

  // Segment users
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const segments: { [segment: string]: UserActivityProfile[] } = {
    power_user: [],
    regular: [],
    casual: [],
    dormant: [],
    churned: [],
  };

  Object.entries(userActivity).forEach(([userId, data]) => {
    const sortedTimestamps = data.timestamps.sort((a, b) => a.getTime() - b.getTime());
    const lastActive = sortedTimestamps.length > 0 ? sortedTimestamps[sortedTimestamps.length - 1] : null;
    const firstActive = sortedTimestamps.length > 0 ? sortedTimestamps[0] : null;
    const activeDays = data.activeDays.size;
    const avgEventsPerSession = activeDays > 0 ? Math.round((data.events / activeDays) * 10) / 10 : 0;

    // Determine segment
    let segment: UserSegment['segment'];
    if (!lastActive || lastActive < thirtyDaysAgo) {
      segment = 'churned';
    } else if (lastActive < sevenDaysAgo) {
      segment = 'dormant';
    } else if (avgEventsPerSession >= 20 && activeDays >= 15) {
      segment = 'power_user';
    } else if (avgEventsPerSession >= 5 && activeDays >= 5) {
      segment = 'regular';
    } else {
      segment = 'casual';
    }

    // Calculate engagement score
    const recencyScore = lastActive ? Math.max(0, 100 - Math.floor((now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000))) : 0;
    const frequencyScore = Math.min(100, activeDays * 3);
    const intensityScore = Math.min(100, avgEventsPerSession * 5);
    const engagementScore = Math.round((recencyScore * 0.4 + frequencyScore * 0.35 + intensityScore * 0.25));

    const profile: UserActivityProfile = {
      userId,
      userEmail: data.email,
      segment,
      totalEvents: data.events,
      lastActive: lastActive?.toISOString() || '',
      firstActive: firstActive?.toISOString() || '',
      activeDays,
      avgEventsPerSession,
      topFeatures: Array.from(data.features).slice(0, 5),
      engagementScore,
    };

    segments[segment].push(profile);
  });

  // Build segment summaries
  const segmentSummaries: UserSegment[] = [
    'power_user', 'regular', 'casual', 'dormant', 'churned'
  ].map(segmentName => {
    const users = segments[segmentName];
    const count = users.length;
    const totalUsers = Object.keys(userActivity).length;

    return {
      segment: segmentName as UserSegment['segment'],
      count,
      percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0,
      avgEventsPerDay: users.length > 0
        ? Math.round(users.reduce((sum, u) => sum + u.avgEventsPerSession, 0) / users.length * 10) / 10
        : 0,
      avgSessionDuration: 15 + Math.random() * 30, // Mock
      topFeatures: getMostCommonFeatures(users),
      riskLevel: getRiskLevel(segmentName),
    };
  });

  // Get top users and at-risk users
  const allProfiles = Object.values(segments).flat();
  const topUsers = allProfiles
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5);

  const atRiskUsers = allProfiles
    .filter(u => u.segment === 'dormant' || u.segment === 'casual')
    .sort((a, b) => a.engagementScore - b.engagementScore)
    .slice(0, 5);

  return {
    segments: segmentSummaries,
    topUsers: includeUserDetails ? topUsers : [],
    atRiskUsers: includeUserDetails ? atRiskUsers : [],
  };
}

/**
 * Calculate engagement metrics
 */
async function calculateEngagementMetrics(
  events: Array<{
    event_type: string;
    user_id?: string;
    user_email?: string;
    timestamp: string;
  }>,
  customerId: string
): Promise<EngagementMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Calculate DAU/MAU
  const mauUsers = new Set<string>();
  const dauUsers = new Set<string>();
  const returnedUsers = new Set<string>();

  const userFirstSeen: { [userId: string]: Date } = {};

  events.forEach(event => {
    const userId = event.user_id || event.user_email || 'anonymous';
    const timestamp = new Date(event.timestamp);

    mauUsers.add(userId);

    if (timestamp >= sevenDaysAgo) {
      dauUsers.add(userId);
    }

    // Track return rate
    if (!userFirstSeen[userId]) {
      userFirstSeen[userId] = timestamp;
    } else if (timestamp.getTime() - userFirstSeen[userId].getTime() >= 7 * 24 * 60 * 60 * 1000) {
      returnedUsers.add(userId);
    }
  });

  const mau = mauUsers.size;
  const dau = dauUsers.size;
  const dauToMauRatio = mau > 0 ? Math.round((dau / mau) * 100) / 100 : 0;

  // Calculate sessions
  const avgSessionsPerUser = mau > 0 ? Math.round((events.length / mau) / 30 * 10) / 10 : 0;
  const avgSessionDuration = 18 + Math.random() * 15; // Mock

  // Return rate
  const returnRate = mau > 0 ? Math.round((returnedUsers.size / mau) * 100) : 0;

  // Calculate overall engagement score
  const engagementScore = Math.round(
    (dauToMauRatio * 30) +
    (Math.min(avgSessionsPerUser, 5) * 10) +
    (returnRate * 0.4)
  );

  // Determine trend (would need historical data)
  const trend: 'improving' | 'stable' | 'declining' =
    engagementScore >= 70 ? 'improving' :
    engagementScore >= 50 ? 'stable' : 'declining';

  return {
    dauToMauRatio,
    avgSessionsPerUser,
    avgSessionDuration: Math.round(avgSessionDuration),
    returnRate,
    engagementScore: Math.min(100, engagementScore),
    trend,
  };
}

/**
 * Detect usage anomalies
 */
async function detectAnomalies(
  events: Array<{
    event_type: string;
    timestamp: string;
    user_id?: string;
  }>,
  customerId: string
): Promise<UsageAnomaly[]> {
  const anomalies: UsageAnomaly[] = [];

  // Group events by day
  const dailyEvents: { [date: string]: number } = {};
  events.forEach(event => {
    const date = event.timestamp.split('T')[0];
    dailyEvents[date] = (dailyEvents[date] || 0) + 1;
  });

  const values = Object.values(dailyEvents);
  if (values.length < 7) return anomalies;

  // Calculate statistics
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Detect anomalies using z-score
  Object.entries(dailyEvents).forEach(([date, count]) => {
    const zScore = stdDev > 0 ? (count - mean) / stdDev : 0;

    if (Math.abs(zScore) > 2) {
      const isSpike = zScore > 0;
      const severity: UsageAnomaly['severity'] =
        Math.abs(zScore) > 3 ? 'critical' :
        Math.abs(zScore) > 2.5 ? 'high' : 'medium';

      anomalies.push({
        id: `anomaly-${date}`,
        type: isSpike ? 'spike' : 'drop',
        severity,
        metric: 'daily_events',
        expectedValue: Math.round(mean),
        actualValue: count,
        deviationPercent: Math.round(((count - mean) / mean) * 100),
        detectedAt: date,
        description: isSpike
          ? `Unusual spike in activity detected on ${date}`
          : `Significant drop in activity detected on ${date}`,
        recommendation: isSpike
          ? 'Investigate what drove increased engagement - potential expansion opportunity'
          : 'Reach out to understand why activity dropped - potential churn risk',
        dismissed: false,
      });
    }
  });

  return anomalies.slice(0, 5); // Return top 5 anomalies
}

/**
 * Generate usage predictions
 */
async function generatePredictions(
  events: Array<{
    event_type: string;
    timestamp: string;
    user_id?: string;
  }>,
  customerId: string
): Promise<UsagePrediction[]> {
  // Group by week
  const weeklyData: { [week: string]: number } = {};
  events.forEach(event => {
    const week = getWeekStart(new Date(event.timestamp));
    weeklyData[week] = (weeklyData[week] || 0) + 1;
  });

  const weeks = Object.keys(weeklyData).sort();
  if (weeks.length < 4) return [];

  // Simple linear regression for prediction
  const values = weeks.map(w => weeklyData[w]);
  const n = values.length;
  const sumX = values.reduce((sum, _, i) => sum + i, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
  const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Predict next week
  const nextWeekPrediction = Math.round(slope * n + intercept);
  const currentValue = values[values.length - 1];

  const predictions: UsagePrediction[] = [
    {
      metric: 'weekly_events',
      currentValue,
      predictedValue: Math.max(0, nextWeekPrediction),
      confidence: 0.75,
      timeframe: 'next_week',
      factors: slope > 0
        ? ['Positive trend', 'Consistent usage patterns']
        : ['Declining trend', 'May need engagement intervention'],
    },
  ];

  return predictions;
}

/**
 * Calculate churn risk indicators
 */
async function calculateChurnIndicators(
  events: Array<{
    event_type: string;
    timestamp: string;
    user_id?: string;
  }>,
  customerId: string
): Promise<ChurnRiskIndicator[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Recent vs previous period events
  const recentEvents = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo).length;
  const previousEvents = events.filter(e => {
    const date = new Date(e.timestamp);
    return date >= sixtyDaysAgo && date < thirtyDaysAgo;
  }).length;

  const usageDecline = previousEvents > 0
    ? Math.round(((previousEvents - recentEvents) / previousEvents) * 100)
    : 0;

  // Active users
  const recentUsers = new Set(
    events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo)
      .map(e => e.user_id || 'anonymous')
  ).size;

  const previousUsers = new Set(
    events.filter(e => {
      const date = new Date(e.timestamp);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).map(e => e.user_id || 'anonymous')
  ).size;

  const userDecline = previousUsers > 0
    ? Math.round(((previousUsers - recentUsers) / previousUsers) * 100)
    : 0;

  // Calculate days since last activity
  const lastEvent = events.length > 0
    ? new Date(events[events.length - 1].timestamp)
    : null;
  const daysSinceActivity = lastEvent
    ? Math.floor((now.getTime() - lastEvent.getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  const indicators: ChurnRiskIndicator[] = [
    {
      factor: 'Usage Volume Trend',
      weight: 0.35,
      score: Math.max(0, 100 - usageDecline),
      description: usageDecline > 20
        ? `Usage declined ${usageDecline}% vs previous period`
        : 'Usage volume is stable or growing',
      trend: usageDecline > 10 ? 'worsening' : usageDecline < -10 ? 'improving' : 'stable',
    },
    {
      factor: 'Active Users',
      weight: 0.25,
      score: Math.max(0, 100 - userDecline),
      description: userDecline > 20
        ? `Active users declined ${userDecline}%`
        : 'User base is stable or growing',
      trend: userDecline > 10 ? 'worsening' : userDecline < -10 ? 'improving' : 'stable',
    },
    {
      factor: 'Recency',
      weight: 0.25,
      score: Math.max(0, 100 - daysSinceActivity * 10),
      description: daysSinceActivity > 7
        ? `No activity in ${daysSinceActivity} days`
        : 'Recent activity detected',
      trend: daysSinceActivity > 3 ? 'worsening' : 'stable',
    },
    {
      factor: 'Feature Adoption',
      weight: 0.15,
      score: 70, // Would need more detailed analysis
      description: 'Core features are being used',
      trend: 'stable',
    },
  ];

  return indicators;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  timePatterns: Awaited<ReturnType<typeof analyzeTimePatterns>>,
  featurePatterns: Awaited<ReturnType<typeof analyzeFeaturePatterns>>,
  userSegmentation: Awaited<ReturnType<typeof analyzeUserSegmentation>>,
  engagement: EngagementMetrics,
  anomalies: UsageAnomaly[],
  churnIndicators: ChurnRiskIndicator[]
): UsageRecommendation[] {
  const recommendations: UsageRecommendation[] = [];

  // Engagement recommendations
  if (engagement.engagementScore < 50) {
    recommendations.push({
      priority: 'high',
      category: 'engagement',
      title: 'Critical: Low Engagement Score',
      description: `Engagement score is ${engagement.engagementScore}/100, indicating risk of churn.`,
      impact: 'High risk of customer churn without intervention',
      suggestedAction: 'Schedule urgent check-in call to understand blockers and re-engage customer',
      relatedMetric: 'engagementScore',
    });
  }

  // Feature adoption recommendations
  if (featurePatterns.unusedFeatures.length > 5) {
    recommendations.push({
      priority: 'medium',
      category: 'adoption',
      title: 'Multiple Unused Features',
      description: `${featurePatterns.unusedFeatures.length} features have not been used.`,
      impact: 'Customer may not be getting full value from product',
      suggestedAction: `Schedule training session for: ${featurePatterns.unusedFeatures.slice(0, 3).join(', ')}`,
      relatedMetric: 'featureAdoption',
    });
  }

  if (featurePatterns.decliningFeatures.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'retention',
      title: 'Declining Feature Usage',
      description: `Usage declining for: ${featurePatterns.decliningFeatures.join(', ')}`,
      impact: 'Feature abandonment often precedes churn',
      suggestedAction: 'Investigate why these features are being used less and address any issues',
      relatedMetric: 'featureUsage',
    });
  }

  // User segmentation recommendations
  const dormantSegment = userSegmentation.segments.find(s => s.segment === 'dormant');
  if (dormantSegment && dormantSegment.percentage > 15) {
    recommendations.push({
      priority: 'high',
      category: 'retention',
      title: 'High Dormant User Rate',
      description: `${dormantSegment.percentage}% of users are dormant (no activity in 7+ days).`,
      impact: 'Dormant users have higher churn probability',
      suggestedAction: 'Launch re-engagement campaign targeting dormant users',
      relatedMetric: 'dormantUsers',
    });
  }

  // Anomaly-based recommendations
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
  if (criticalAnomalies.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'engagement',
      title: 'Usage Anomalies Detected',
      description: `${criticalAnomalies.length} significant usage anomalies require attention.`,
      impact: 'Unusual patterns may indicate emerging issues',
      suggestedAction: criticalAnomalies[0].recommendation,
      relatedMetric: 'usageAnomalies',
    });
  }

  // Time pattern recommendations
  if (timePatterns.weekly.length > 0) {
    const recentWeeks = timePatterns.weekly.slice(-3);
    const decliningWeeks = recentWeeks.filter(w => w.trend === 'down').length;
    if (decliningWeeks >= 2) {
      recommendations.push({
        priority: 'medium',
        category: 'engagement',
        title: 'Consistent Weekly Decline',
        description: 'Usage has declined for multiple consecutive weeks.',
        impact: 'Sustained decline indicates disengagement',
        suggestedAction: 'Proactively reach out to understand challenges and offer support',
        relatedMetric: 'weeklyTrend',
      });
    }
  }

  // Growth opportunity
  const powerUserSegment = userSegmentation.segments.find(s => s.segment === 'power_user');
  if (powerUserSegment && powerUserSegment.percentage > 20) {
    recommendations.push({
      priority: 'low',
      category: 'growth',
      title: 'Strong Power User Base',
      description: `${powerUserSegment.percentage}% of users are power users.`,
      impact: 'Opportunity for expansion and referrals',
      suggestedAction: 'Consider expansion conversation or request customer reference/case study',
      relatedMetric: 'powerUsers',
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Calculate summary from all analyses
 */
function calculateSummary(
  engagement: EngagementMetrics,
  churnIndicators: ChurnRiskIndicator[],
  recommendations: UsageRecommendation[]
): UsagePatternAnalysis['summary'] {
  // Overall engagement
  const overallEngagement = engagement.engagementScore;

  // Churn risk
  const weightedChurnScore = churnIndicators.reduce((sum, ind) => sum + (ind.score * ind.weight), 0);
  const churnRisk: 'low' | 'medium' | 'high' =
    weightedChurnScore >= 70 ? 'low' :
    weightedChurnScore >= 50 ? 'medium' : 'high';

  // Top insight
  const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
  const topInsight = highPriorityRecs.length > 0
    ? highPriorityRecs[0].title
    : engagement.trend === 'improving'
      ? 'Engagement trending positively'
      : 'Monitor engagement closely';

  return {
    overallEngagement,
    trend: engagement.trend,
    churnRisk,
    topInsight,
  };
}

// Helper functions
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function generateFeatureRecommendation(adoptionRate: number, stickiness: number, trend: string): string {
  if (trend === 'declining') return 'Investigate declining usage and gather feedback';
  if (adoptionRate < 30) return 'Promote feature through training or in-app guidance';
  if (stickiness < 50) return 'Improve onboarding for better retention';
  return 'Continue monitoring - healthy usage pattern';
}

function getMostCommonFeatures(users: UserActivityProfile[]): string[] {
  const featureCounts: { [feature: string]: number } = {};
  users.forEach(u => {
    u.topFeatures.forEach(f => {
      featureCounts[f] = (featureCounts[f] || 0) + 1;
    });
  });
  return Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([feature]) => feature);
}

function getRiskLevel(segment: string): 'low' | 'medium' | 'high' {
  switch (segment) {
    case 'power_user': return 'low';
    case 'regular': return 'low';
    case 'casual': return 'medium';
    case 'dormant': return 'high';
    case 'churned': return 'high';
    default: return 'medium';
  }
}

/**
 * Get benchmark comparison against peers
 */
export async function getBenchmarkComparison(
  customerId: string,
  segment?: string
): Promise<BenchmarkComparison[]> {
  // Mock peer data - in production, would aggregate across customers
  const peerAverages = {
    engagement: 65,
    featureAdoption: 55,
    dauToMau: 0.20,
    returnRate: 72,
  };

  const analysis = await analyzeUsagePatterns(customerId, { period: '30d' });

  return [
    {
      metric: 'Engagement Score',
      customerValue: analysis.engagement.engagementScore,
      peerAverage: peerAverages.engagement,
      segmentAverage: peerAverages.engagement + 5,
      percentile: calculatePercentile(analysis.engagement.engagementScore, peerAverages.engagement),
      rating: getRating(analysis.engagement.engagementScore, peerAverages.engagement),
    },
    {
      metric: 'DAU/MAU Ratio',
      customerValue: analysis.engagement.dauToMauRatio,
      peerAverage: peerAverages.dauToMau,
      segmentAverage: peerAverages.dauToMau + 0.05,
      percentile: calculatePercentile(analysis.engagement.dauToMauRatio * 100, peerAverages.dauToMau * 100),
      rating: getRating(analysis.engagement.dauToMauRatio * 100, peerAverages.dauToMau * 100),
    },
    {
      metric: 'Return Rate',
      customerValue: analysis.engagement.returnRate,
      peerAverage: peerAverages.returnRate,
      segmentAverage: peerAverages.returnRate + 3,
      percentile: calculatePercentile(analysis.engagement.returnRate, peerAverages.returnRate),
      rating: getRating(analysis.engagement.returnRate, peerAverages.returnRate),
    },
  ];
}

function calculatePercentile(value: number, peerAvg: number): number {
  // Simplified percentile calculation
  const ratio = value / peerAvg;
  return Math.min(99, Math.max(1, Math.round(50 * ratio)));
}

function getRating(value: number, peerAvg: number): BenchmarkComparison['rating'] {
  const ratio = value / peerAvg;
  if (ratio >= 1.2) return 'top_performer';
  if (ratio >= 1.0) return 'above_average';
  if (ratio >= 0.8) return 'average';
  return 'below_average';
}

export default {
  analyzeUsagePatterns,
  getBenchmarkComparison,
};
