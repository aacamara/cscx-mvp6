/**
 * Segment Analysis Service
 * PRD-175: Customer Segmentation Analysis
 *
 * Provides:
 * - Multi-dimensional customer segmentation
 * - Segment profile generation
 * - Segment performance comparison
 * - Movement tracking between segments
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES (matching frontend types)
// ============================================

export interface SegmentCriteria {
  attribute: string;
  operator: 'equals' | 'greater' | 'less' | 'between' | 'in' | 'not_equals';
  value: string | number | string[] | number[] | { min: number; max: number };
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  criteria: SegmentCriteria[];
  customer_count: number;
  total_arr: number;
  is_dynamic: boolean;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface SegmentProfile {
  segment: Segment;
  demographics: {
    avg_arr: number;
    median_arr: number;
    avg_company_size: number;
    top_industries: Array<{ name: string; count: number; pct: number }>;
    avg_tenure_months: number;
    tenure_distribution: {
      under_6_months: number;
      six_to_12_months: number;
      one_to_2_years: number;
      over_2_years: number;
    };
  };
  performance: {
    avg_health_score: number;
    health_distribution: { healthy: number; warning: number; critical: number };
    avg_adoption_score: number;
    nrr: number;
    gross_retention: number;
    churn_rate: number;
    expansion_rate: number;
  };
  engagement: {
    avg_meetings_per_quarter: number;
    avg_email_response_rate: number;
    avg_time_to_respond_hours: number;
    support_ticket_rate: number;
    avg_nps_score: number | null;
    feature_adoption_rate: number;
  };
  recommendations: string[];
  characteristics: string[];
  top_customers: Array<{ id: string; name: string; arr: number; health_score: number }>;
}

export interface SegmentMovement {
  customer_id: string;
  customer_name: string;
  from_segment: string;
  to_segment: string;
  movement_type: 'upgrade' | 'downgrade' | 'lateral';
  arr: number;
  moved_at: string;
}

// ============================================
// PREDEFINED SEGMENTS (ARR-based tiers)
// ============================================

const PREDEFINED_SEGMENTS: Segment[] = [
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Large accounts with ARR > $100K',
    criteria: [{ attribute: 'arr', operator: 'greater', value: 100000 }],
    customer_count: 0,
    total_arr: 0,
    is_dynamic: true,
    color: '#3b82f6',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'mid-market',
    name: 'Mid-Market',
    description: 'Mid-size accounts with ARR $25K-$100K',
    criteria: [{ attribute: 'arr', operator: 'between', value: { min: 25000, max: 100000 } }],
    customer_count: 0,
    total_arr: 0,
    is_dynamic: true,
    color: '#10b981',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'smb',
    name: 'SMB',
    description: 'Small accounts with ARR < $25K',
    criteria: [{ attribute: 'arr', operator: 'less', value: 25000 }],
    customer_count: 0,
    total_arr: 0,
    is_dynamic: true,
    color: '#f59e0b',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'high-growth',
    name: 'High-Growth',
    description: 'Fast-expanding accounts (expansion > 20%)',
    criteria: [{ attribute: 'expansion_rate', operator: 'greater', value: 20 }],
    customer_count: 0,
    total_arr: 0,
    is_dynamic: true,
    color: '#8b5cf6',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function evaluateCriteria(customer: any, criteria: SegmentCriteria): boolean {
  const value = customer[criteria.attribute];
  if (value === undefined || value === null) return false;

  switch (criteria.operator) {
    case 'equals':
      return value === criteria.value;
    case 'not_equals':
      return value !== criteria.value;
    case 'greater':
      return typeof value === 'number' && value > (criteria.value as number);
    case 'less':
      return typeof value === 'number' && value < (criteria.value as number);
    case 'between':
      if (typeof value === 'number' && typeof criteria.value === 'object' && 'min' in criteria.value) {
        const range = criteria.value as { min: number; max: number };
        return value >= range.min && value <= range.max;
      }
      return false;
    case 'in':
      return Array.isArray(criteria.value) && (criteria.value as Array<string | number>).includes(value);
    default:
      return false;
  }
}

function assignCustomerToSegment(customer: any, segments: Segment[]): string | null {
  for (const segment of segments) {
    const matchesAll = segment.criteria.every(c => evaluateCriteria(customer, c));
    if (matchesAll) return segment.id;
  }
  return null;
}

function calculateTenureMonths(createdAt: string | null): number {
  if (!createdAt) return 12; // Default
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
}

function generateRecommendations(profile: Partial<SegmentProfile>): string[] {
  const recommendations: string[] = [];
  const perf = profile.performance;
  const eng = profile.engagement;

  if (perf) {
    if (perf.churn_rate > 10) {
      recommendations.push('Implement proactive risk detection and intervention playbooks');
    }
    if (perf.avg_health_score < 60) {
      recommendations.push('Increase touchpoint frequency and schedule health check-ins');
    }
    if (perf.nrr < 100) {
      recommendations.push('Focus on value realization and expansion opportunities');
    }
    if (perf.health_distribution.critical > 20) {
      recommendations.push('Prioritize critical accounts with dedicated save plays');
    }
  }

  if (eng) {
    if (eng.avg_meetings_per_quarter < 2) {
      recommendations.push('Schedule quarterly business reviews to increase engagement');
    }
    if (eng.support_ticket_rate > 3) {
      recommendations.push('Review common support issues for proactive outreach');
    }
    if (eng.feature_adoption_rate < 50) {
      recommendations.push('Provide targeted training to improve feature adoption');
    }
  }

  return recommendations.length > 0 ? recommendations : ['Continue current engagement strategy'];
}

function generateCharacteristics(segment: Segment, customers: any[]): string[] {
  const characteristics: string[] = [];
  const totalArr = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
  const avgHealth = customers.reduce((sum, c) => sum + (c.health_score || 70), 0) / Math.max(customers.length, 1);

  if (segment.name === 'Enterprise') {
    characteristics.push('Highest retention and longest sales cycles');
    characteristics.push('Require executive engagement and strategic QBRs');
    characteristics.push('Value dedicated technical resources');
  } else if (segment.name === 'Mid-Market') {
    characteristics.push('Growing accounts with expansion potential');
    characteristics.push('Responsive to proactive outreach');
    characteristics.push('Benefit from structured onboarding programs');
  } else if (segment.name === 'SMB') {
    characteristics.push('High volume, lower touch model');
    characteristics.push('Self-service adoption preferred');
    characteristics.push('Quick time-to-value critical');
  } else if (segment.name === 'High-Growth') {
    characteristics.push('Fast-expanding with strong product-market fit');
    characteristics.push('High engagement and feature adoption');
    characteristics.push('Prime candidates for case studies and references');
  }

  if (avgHealth >= 75) {
    characteristics.push('Overall healthy customer base');
  } else if (avgHealth < 50) {
    characteristics.push('Requires immediate attention to health scores');
  }

  return characteristics;
}

// ============================================
// MAIN SERVICE FUNCTIONS
// ============================================

/**
 * Get all segments with customer counts and ARR
 */
export async function getSegments(): Promise<Segment[]> {
  let customers: any[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, arr, health_score, industry, created_at, stage');

    if (!error && data) {
      customers = data;
    }
  } else {
    // Mock data for development
    customers = getMockCustomers();
  }

  // Calculate segment statistics
  const segments = PREDEFINED_SEGMENTS.map(segment => {
    // Add expansion_rate to customers for high-growth segment
    const customersWithExpansion = customers.map(c => ({
      ...c,
      expansion_rate: Math.random() * 40 // Mock expansion rate
    }));

    const segmentCustomers = customersWithExpansion.filter(c =>
      segment.criteria.every(criteria => evaluateCriteria(c, criteria))
    );

    return {
      ...segment,
      customer_count: segmentCustomers.length,
      total_arr: segmentCustomers.reduce((sum, c) => sum + (c.arr || 0), 0),
      updated_at: new Date().toISOString()
    };
  });

  return segments;
}

/**
 * Get segment overview statistics
 */
export async function getSegmentOverview(): Promise<{
  total_customers: number;
  total_arr: number;
  segment_count: number;
  unassigned_customers: number;
  unassigned_arr: number;
}> {
  let customers: any[] = [];

  if (supabase) {
    const { data } = await supabase
      .from('customers')
      .select('id, arr');

    customers = data || [];
  } else {
    customers = getMockCustomers();
  }

  const segments = await getSegments();
  const assignedCustomerIds = new Set<string>();

  // Track assigned customers
  customers.forEach(c => {
    const customersWithExpansion = { ...c, expansion_rate: Math.random() * 40 };
    for (const segment of segments) {
      if (segment.criteria.every(criteria => evaluateCriteria(customersWithExpansion, criteria))) {
        assignedCustomerIds.add(c.id);
        break;
      }
    }
  });

  const unassigned = customers.filter(c => !assignedCustomerIds.has(c.id));

  return {
    total_customers: customers.length,
    total_arr: customers.reduce((sum, c) => sum + (c.arr || 0), 0),
    segment_count: segments.length,
    unassigned_customers: unassigned.length,
    unassigned_arr: unassigned.reduce((sum, c) => sum + (c.arr || 0), 0)
  };
}

/**
 * Get detailed profile for a specific segment
 */
export async function getSegmentProfile(segmentId: string): Promise<SegmentProfile | null> {
  const segments = await getSegments();
  const segment = segments.find(s => s.id === segmentId);

  if (!segment) return null;

  let customers: any[] = [];

  if (supabase) {
    const { data } = await supabase
      .from('customers')
      .select('*');

    customers = data || [];
  } else {
    customers = getMockCustomers();
  }

  // Add expansion_rate for filtering
  const customersWithExpansion = customers.map(c => ({
    ...c,
    expansion_rate: Math.random() * 40,
    tenure_months: calculateTenureMonths(c.created_at)
  }));

  // Filter to segment
  const segmentCustomers = customersWithExpansion.filter(c =>
    segment.criteria.every(criteria => evaluateCriteria(c, criteria))
  );

  if (segmentCustomers.length === 0) {
    return createEmptyProfile(segment);
  }

  // Calculate demographics
  const arrValues = segmentCustomers.map(c => c.arr || 0).sort((a, b) => a - b);
  const medianArr = arrValues[Math.floor(arrValues.length / 2)] || 0;

  // Industry breakdown
  const industryCount: Record<string, number> = {};
  segmentCustomers.forEach(c => {
    const industry = c.industry || 'Unknown';
    industryCount[industry] = (industryCount[industry] || 0) + 1;
  });
  const topIndustries = Object.entries(industryCount)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / segmentCustomers.length) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Tenure distribution
  const tenureDistribution = {
    under_6_months: segmentCustomers.filter(c => c.tenure_months < 6).length,
    six_to_12_months: segmentCustomers.filter(c => c.tenure_months >= 6 && c.tenure_months < 12).length,
    one_to_2_years: segmentCustomers.filter(c => c.tenure_months >= 12 && c.tenure_months < 24).length,
    over_2_years: segmentCustomers.filter(c => c.tenure_months >= 24).length
  };

  // Health distribution
  const healthDistribution = {
    healthy: segmentCustomers.filter(c => (c.health_score || 70) >= 70).length,
    warning: segmentCustomers.filter(c => (c.health_score || 70) >= 40 && (c.health_score || 70) < 70).length,
    critical: segmentCustomers.filter(c => (c.health_score || 70) < 40).length
  };

  const demographics = {
    avg_arr: Math.round(segmentCustomers.reduce((sum, c) => sum + (c.arr || 0), 0) / segmentCustomers.length),
    median_arr: medianArr,
    avg_company_size: Math.round(segmentCustomers.reduce((sum, c) => sum + (c.company_size || 100), 0) / segmentCustomers.length),
    top_industries: topIndustries,
    avg_tenure_months: Math.round(segmentCustomers.reduce((sum, c) => sum + c.tenure_months, 0) / segmentCustomers.length),
    tenure_distribution: tenureDistribution
  };

  const performance = {
    avg_health_score: Math.round(segmentCustomers.reduce((sum, c) => sum + (c.health_score || 70), 0) / segmentCustomers.length),
    health_distribution: healthDistribution,
    avg_adoption_score: Math.round(50 + Math.random() * 40), // Mock
    nrr: Math.round(95 + Math.random() * 25), // Mock 95-120%
    gross_retention: Math.round(85 + Math.random() * 15), // Mock 85-100%
    churn_rate: Math.round(2 + Math.random() * 15), // Mock 2-17%
    expansion_rate: Math.round(5 + Math.random() * 25) // Mock 5-30%
  };

  const engagement = {
    avg_meetings_per_quarter: Math.round((1 + Math.random() * 5) * 10) / 10,
    avg_email_response_rate: Math.round(40 + Math.random() * 50),
    avg_time_to_respond_hours: Math.round(4 + Math.random() * 44),
    support_ticket_rate: Math.round((0.5 + Math.random() * 4) * 10) / 10,
    avg_nps_score: Math.round(30 + Math.random() * 50),
    feature_adoption_rate: Math.round(30 + Math.random() * 60)
  };

  const profile: SegmentProfile = {
    segment: { ...segment, customer_count: segmentCustomers.length },
    demographics,
    performance,
    engagement,
    recommendations: generateRecommendations({ performance, engagement }),
    characteristics: generateCharacteristics(segment, segmentCustomers),
    top_customers: segmentCustomers
      .sort((a, b) => (b.arr || 0) - (a.arr || 0))
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        arr: c.arr || 0,
        health_score: c.health_score || 70
      }))
  };

  return profile;
}

/**
 * Get customers in a specific segment
 */
export async function getSegmentCustomers(segmentId: string): Promise<any[]> {
  const segments = await getSegments();
  const segment = segments.find(s => s.id === segmentId);

  if (!segment) return [];

  let customers: any[] = [];

  if (supabase) {
    const { data } = await supabase
      .from('customers')
      .select('*');

    customers = data || [];
  } else {
    customers = getMockCustomers();
  }

  // Add calculated fields and filter
  const customersWithExpansion = customers.map(c => ({
    ...c,
    expansion_rate: Math.random() * 40,
    tenure_months: calculateTenureMonths(c.created_at)
  }));

  return customersWithExpansion
    .filter(c => segment.criteria.every(criteria => evaluateCriteria(c, criteria)))
    .map(c => ({
      id: c.id,
      name: c.name,
      arr: c.arr || 0,
      health_score: c.health_score || 70,
      industry: c.industry || 'Unknown',
      tenure_months: c.tenure_months,
      renewal_date: c.renewal_date || null,
      days_to_renewal: c.renewal_date ? Math.ceil((new Date(c.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
      stage: c.stage || 'active',
      company_size: c.company_size || null,
      risk_level: (c.health_score || 70) >= 70 ? 'low' : (c.health_score || 70) >= 40 ? 'medium' : 'high'
    }));
}

/**
 * Get segment comparison data
 */
export async function getSegmentComparison(): Promise<{
  segments: Array<{
    segment_id: string;
    segment_name: string;
    customer_count: number;
    total_arr: number;
    avg_health_score: number;
    nrr: number;
    churn_rate: number;
    avg_tenure_months: number;
    risk_count: number;
  }>;
  metrics: Array<{
    name: string;
    unit: string;
    segments: Record<string, number>;
    best_performer: string;
    worst_performer: string;
  }>;
}> {
  const segments = await getSegments();
  const profiles: SegmentProfile[] = [];

  for (const segment of segments) {
    const profile = await getSegmentProfile(segment.id);
    if (profile) profiles.push(profile);
  }

  const segmentData = profiles.map(p => ({
    segment_id: p.segment.id,
    segment_name: p.segment.name,
    customer_count: p.segment.customer_count,
    total_arr: p.segment.total_arr,
    avg_health_score: p.performance.avg_health_score,
    nrr: p.performance.nrr,
    churn_rate: p.performance.churn_rate,
    avg_tenure_months: p.demographics.avg_tenure_months,
    risk_count: p.performance.health_distribution.critical
  }));

  // Build metrics comparison
  const metrics = [
    { name: 'Avg Health Score', unit: 'pts', getValue: (p: SegmentProfile) => p.performance.avg_health_score },
    { name: 'NRR', unit: '%', getValue: (p: SegmentProfile) => p.performance.nrr },
    { name: 'Churn Rate', unit: '%', getValue: (p: SegmentProfile) => p.performance.churn_rate, lowerIsBetter: true },
    { name: 'Avg ARR', unit: '$', getValue: (p: SegmentProfile) => p.demographics.avg_arr },
    { name: 'Avg Tenure', unit: 'months', getValue: (p: SegmentProfile) => p.demographics.avg_tenure_months },
    { name: 'Feature Adoption', unit: '%', getValue: (p: SegmentProfile) => p.engagement.feature_adoption_rate }
  ].map(m => {
    const segmentValues: Record<string, number> = {};
    let bestValue = m.lowerIsBetter ? Infinity : -Infinity;
    let worstValue = m.lowerIsBetter ? -Infinity : Infinity;
    let bestPerformer = '';
    let worstPerformer = '';

    profiles.forEach(p => {
      const value = m.getValue(p);
      segmentValues[p.segment.name] = value;

      if (m.lowerIsBetter) {
        if (value < bestValue) { bestValue = value; bestPerformer = p.segment.name; }
        if (value > worstValue) { worstValue = value; worstPerformer = p.segment.name; }
      } else {
        if (value > bestValue) { bestValue = value; bestPerformer = p.segment.name; }
        if (value < worstValue) { worstValue = value; worstPerformer = p.segment.name; }
      }
    });

    return {
      name: m.name,
      unit: m.unit,
      segments: segmentValues,
      best_performer: bestPerformer,
      worst_performer: worstPerformer
    };
  });

  return { segments: segmentData, metrics };
}

/**
 * Get recent segment movements
 */
export async function getSegmentMovements(period: '7d' | '30d' | '90d' | 'quarter' = '30d'): Promise<{
  period: string;
  movements: SegmentMovement[];
  summary: {
    upgrades: number;
    downgrades: number;
    lateral: number;
    arr_upgraded: number;
    arr_downgraded: number;
  };
}> {
  // In production, this would query segment_movements table
  // For now, generate mock movements

  const movements: SegmentMovement[] = [
    {
      customer_id: '1',
      customer_name: 'TechStart Inc',
      from_segment: 'SMB',
      to_segment: 'Mid-Market',
      movement_type: 'upgrade',
      arr: 45000,
      moved_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      customer_id: '2',
      customer_name: 'DataFlow Corp',
      from_segment: 'SMB',
      to_segment: 'Mid-Market',
      movement_type: 'upgrade',
      arr: 38000,
      moved_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      customer_id: '3',
      customer_name: 'GlobalTech Solutions',
      from_segment: 'Mid-Market',
      to_segment: 'Enterprise',
      movement_type: 'upgrade',
      arr: 125000,
      moved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      customer_id: '4',
      customer_name: 'SmallBiz Co',
      from_segment: 'Mid-Market',
      to_segment: 'SMB',
      movement_type: 'downgrade',
      arr: 18000,
      moved_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      customer_id: '5',
      customer_name: 'Innovation Labs',
      from_segment: 'Mid-Market',
      to_segment: 'Enterprise',
      movement_type: 'upgrade',
      arr: 110000,
      moved_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const upgrades = movements.filter(m => m.movement_type === 'upgrade');
  const downgrades = movements.filter(m => m.movement_type === 'downgrade');
  const lateral = movements.filter(m => m.movement_type === 'lateral');

  return {
    period,
    movements,
    summary: {
      upgrades: upgrades.length,
      downgrades: downgrades.length,
      lateral: lateral.length,
      arr_upgraded: upgrades.reduce((sum, m) => sum + m.arr, 0),
      arr_downgraded: downgrades.reduce((sum, m) => sum + m.arr, 0)
    }
  };
}

/**
 * Create a custom segment
 */
export async function createSegment(data: {
  name: string;
  description?: string;
  criteria: SegmentCriteria[];
  is_dynamic: boolean;
  color?: string;
}): Promise<Segment> {
  const segment: Segment = {
    id: `custom-${Date.now()}`,
    name: data.name,
    description: data.description,
    criteria: data.criteria,
    customer_count: 0,
    total_arr: 0,
    is_dynamic: data.is_dynamic,
    color: data.color || '#6366f1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // In production, save to database
  if (supabase) {
    await supabase.from('customer_segments').insert({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      criteria: segment.criteria,
      is_dynamic: segment.is_dynamic,
      color: segment.color,
      created_at: segment.created_at,
      updated_at: segment.updated_at
    });
  }

  return segment;
}

// ============================================
// HELPER: Empty Profile
// ============================================

function createEmptyProfile(segment: Segment): SegmentProfile {
  return {
    segment,
    demographics: {
      avg_arr: 0,
      median_arr: 0,
      avg_company_size: 0,
      top_industries: [],
      avg_tenure_months: 0,
      tenure_distribution: { under_6_months: 0, six_to_12_months: 0, one_to_2_years: 0, over_2_years: 0 }
    },
    performance: {
      avg_health_score: 0,
      health_distribution: { healthy: 0, warning: 0, critical: 0 },
      avg_adoption_score: 0,
      nrr: 100,
      gross_retention: 100,
      churn_rate: 0,
      expansion_rate: 0
    },
    engagement: {
      avg_meetings_per_quarter: 0,
      avg_email_response_rate: 0,
      avg_time_to_respond_hours: 0,
      support_ticket_rate: 0,
      avg_nps_score: null,
      feature_adoption_rate: 0
    },
    recommendations: ['Add customers to this segment to generate recommendations'],
    characteristics: [],
    top_customers: []
  };
}

// ============================================
// MOCK DATA
// ============================================

function getMockCustomers(): any[] {
  return [
    { id: '1', name: 'Acme Corporation', arr: 120000, health_score: 85, industry: 'Technology', renewal_date: '2026-06-15', stage: 'active', company_size: 2500, created_at: '2023-06-01' },
    { id: '2', name: 'TechStart Inc', arr: 65000, health_score: 48, industry: 'SaaS', renewal_date: '2026-02-28', stage: 'at_risk', company_size: 150, created_at: '2024-01-15' },
    { id: '3', name: 'GlobalTech Solutions', arr: 280000, health_score: 92, industry: 'Enterprise', renewal_date: '2026-09-01', stage: 'active', company_size: 5000, created_at: '2022-03-10' },
    { id: '4', name: 'DataFlow Inc', arr: 95000, health_score: 35, industry: 'Data', renewal_date: '2026-03-15', stage: 'at_risk', company_size: 300, created_at: '2024-06-01' },
    { id: '5', name: 'CloudNine Systems', arr: 150000, health_score: 78, industry: 'Cloud', renewal_date: '2026-05-20', stage: 'active', company_size: 800, created_at: '2023-09-01' },
    { id: '6', name: 'MegaCorp Industries', arr: 340000, health_score: 72, industry: 'Manufacturing', renewal_date: '2026-08-10', stage: 'active', company_size: 12000, created_at: '2021-01-15' },
    { id: '7', name: 'StartupX', arr: 18000, health_score: 61, industry: 'Startup', renewal_date: '2026-04-01', stage: 'onboarding', company_size: 25, created_at: '2025-07-01' },
    { id: '8', name: 'Enterprise Plus', arr: 520000, health_score: 88, industry: 'Enterprise', renewal_date: '2026-12-15', stage: 'active', company_size: 8000, created_at: '2020-06-01' },
    { id: '9', name: 'SmallBiz Co', arr: 12000, health_score: 55, industry: 'SMB', renewal_date: '2026-03-30', stage: 'active', company_size: 15, created_at: '2025-01-10' },
    { id: '10', name: 'Innovation Labs', arr: 175000, health_score: 82, industry: 'R&D', renewal_date: '2026-07-25', stage: 'active', company_size: 400, created_at: '2023-04-01' },
    { id: '11', name: 'FinTech Pro', arr: 45000, health_score: 67, industry: 'Finance', renewal_date: '2026-05-10', stage: 'active', company_size: 120, created_at: '2024-03-15' },
    { id: '12', name: 'HealthCare Plus', arr: 230000, health_score: 75, industry: 'Healthcare', renewal_date: '2026-11-01', stage: 'active', company_size: 3500, created_at: '2022-08-20' }
  ];
}

export default {
  getSegments,
  getSegmentOverview,
  getSegmentProfile,
  getSegmentCustomers,
  getSegmentComparison,
  getSegmentMovements,
  createSegment
};
