/**
 * CSCX.AI Customer Lifetime Value (CLV) Service
 * PRD-173: Customer Lifetime Value Report
 *
 * Business logic for calculating CLV, tracking trends, and identifying value drivers.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types (matching frontend types/clv.ts)
// ============================================

interface Customer {
  id: string;
  name: string;
  arr: number;
  health_score: number;
  segment?: string;
  stage?: string;
  created_at: string;
  renewal_date?: string;
  churn_probability?: number;
  expansion_probability?: number;
}

interface CLVComponents {
  current_arr: number;
  estimated_lifetime_months: number;
  expansion_rate: number;
  gross_margin: number;
  discount_rate: number;
}

interface CustomerCLV {
  customer_id: string;
  customer_name: string;
  historical: {
    total_revenue: number;
    months_as_customer: number;
  };
  current: {
    arr: number;
    monthly_revenue: number;
  };
  predicted: {
    remaining_lifetime_months: number;
    churn_probability: number;
    expansion_probability: number;
    predicted_clv: number;
    clv_range: { low: number; high: number };
  };
  total_clv: number;
  clv_tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  clv_percentile: number;
  segment: string;
}

interface CLVTierSummary {
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  customer_count: number;
  total_clv: number;
  avg_clv: number;
  total_arr: number;
  pct_of_portfolio: number;
}

interface CLVSummary {
  total_clv: number;
  total_customers: number;
  avg_clv: number;
  median_clv: number;
  clv_cac_ratio: number;
  clv_change_yoy: number;
  clv_change_percent: number;
  tiers: CLVTierSummary[];
}

interface CLVDistributionBucket {
  range_label: string;
  min: number;
  max: number;
  count: number;
  total_clv: number;
  pct_of_total: number;
}

interface CLVDistribution {
  buckets: CLVDistributionBucket[];
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

interface CLVTrend {
  period: string;
  period_label: string;
  avg_clv: number;
  total_clv: number;
  customer_count: number;
  new_customers_clv: number;
  churned_customers_clv: number;
}

interface CLVDriver {
  factor: string;
  impact: number;
  description: string;
  direction: 'positive' | 'negative';
}

interface CLVHistory {
  date: string;
  clv: number;
  arr: number;
  churn_probability: number;
}

// CLV tier thresholds
const CLV_TIER_THRESHOLDS = {
  platinum: 500000,
  gold: 200000,
  silver: 50000,
  bronze: 0
};

// Default assumptions for CLV calculation
const CLV_DEFAULTS = {
  gross_margin: 0.70,           // 70% gross margin
  discount_rate: 0.10,          // 10% annual discount rate
  base_lifetime_months: 48,     // 4 years base lifetime
  expansion_rate_base: 0.05,    // 5% annual expansion
  cac: 35000                    // Average customer acquisition cost
};

// ============================================
// Service Class
// ============================================

class CLVService {
  private supabase: SupabaseClient | null = null;

  // Mock customer data for development
  private mockCustomers: Customer[] = [
    { id: '1', name: 'MegaCorp', arr: 340000, health_score: 92, segment: 'enterprise', stage: 'active', created_at: '2022-01-15', churn_probability: 0.08, expansion_probability: 0.35 },
    { id: '2', name: 'Acme Inc', arr: 120000, health_score: 85, segment: 'enterprise', stage: 'active', created_at: '2022-06-01', churn_probability: 0.12, expansion_probability: 0.28 },
    { id: '3', name: 'TechStart', arr: 85000, health_score: 78, segment: 'mid-market', stage: 'active', created_at: '2023-02-15', churn_probability: 0.15, expansion_probability: 0.22 },
    { id: '4', name: 'GlobalRetail', arr: 250000, health_score: 88, segment: 'enterprise', stage: 'active', created_at: '2022-03-01', churn_probability: 0.10, expansion_probability: 0.30 },
    { id: '5', name: 'DataFlow Systems', arr: 95000, health_score: 65, segment: 'mid-market', stage: 'active', created_at: '2023-05-01', churn_probability: 0.25, expansion_probability: 0.15 },
    { id: '6', name: 'CloudNine Solutions', arr: 75000, health_score: 72, segment: 'mid-market', stage: 'active', created_at: '2023-08-15', churn_probability: 0.20, expansion_probability: 0.18 },
    { id: '7', name: 'Enterprise Plus', arr: 220000, health_score: 95, segment: 'enterprise', stage: 'active', created_at: '2021-09-01', churn_probability: 0.05, expansion_probability: 0.40 },
    { id: '8', name: 'StartupXYZ', arr: 45000, health_score: 80, segment: 'smb', stage: 'active', created_at: '2024-01-15', churn_probability: 0.18, expansion_probability: 0.25 },
    { id: '9', name: 'Innovate Labs', arr: 130000, health_score: 90, segment: 'mid-market', stage: 'active', created_at: '2022-11-01', churn_probability: 0.09, expansion_probability: 0.32 },
    { id: '10', name: 'SmallBiz Pro', arr: 28000, health_score: 75, segment: 'smb', stage: 'active', created_at: '2024-03-01', churn_probability: 0.22, expansion_probability: 0.12 },
    { id: '11', name: 'QuickServe', arr: 18000, health_score: 68, segment: 'smb', stage: 'active', created_at: '2024-06-01', churn_probability: 0.28, expansion_probability: 0.10 },
    { id: '12', name: 'MegaEnterprise', arr: 450000, health_score: 94, segment: 'enterprise', stage: 'active', created_at: '2021-06-01', churn_probability: 0.04, expansion_probability: 0.38 },
  ];

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // CLV Calculation Methods
  // ============================================

  /**
   * Calculate CLV using the formula:
   * CLV = (Monthly Revenue x Gross Margin x Avg Lifetime Months) x (1 + Expansion Rate) x Discount Factor
   */
  private calculateCLV(components: CLVComponents): number {
    const monthlyValue = (components.current_arr / 12) * components.gross_margin;
    const lifetime = components.estimated_lifetime_months;
    const expansion = 1 + components.expansion_rate;

    // Apply NPV discount factor for multi-year projection
    const annualDiscount = 1 / (1 + components.discount_rate);
    const years = lifetime / 12;
    const discountFactor = years > 0 ? (1 - Math.pow(annualDiscount, years)) / (1 - annualDiscount) / years : 1;

    return Math.round(monthlyValue * lifetime * expansion * discountFactor);
  }

  /**
   * Estimate remaining customer lifetime based on health score and churn probability
   */
  private estimateRemainingLifetime(
    healthScore: number,
    churnProbability: number,
    monthsAsCustomer: number
  ): number {
    // Base lifetime adjusted by health score (higher health = longer lifetime)
    const healthFactor = healthScore / 100;
    const baseRemaining = CLV_DEFAULTS.base_lifetime_months * healthFactor;

    // Adjust for churn probability (higher churn = shorter lifetime)
    const churnAdjustment = 1 - (churnProbability * 2); // Max 50% reduction for high churn

    // Account for customer tenure (loyal customers tend to stay longer)
    const tenureFactor = Math.min(1.2, 1 + (monthsAsCustomer / 60) * 0.2);

    return Math.round(Math.max(6, baseRemaining * churnAdjustment * tenureFactor));
  }

  /**
   * Assign CLV tier based on total CLV
   */
  private assignCLVTier(clv: number): 'platinum' | 'gold' | 'silver' | 'bronze' {
    if (clv >= CLV_TIER_THRESHOLDS.platinum) return 'platinum';
    if (clv >= CLV_TIER_THRESHOLDS.gold) return 'gold';
    if (clv >= CLV_TIER_THRESHOLDS.silver) return 'silver';
    return 'bronze';
  }

  /**
   * Calculate segment from ARR
   */
  private getSegmentFromARR(arr: number): string {
    if (arr >= 100000) return 'enterprise';
    if (arr >= 25000) return 'mid-market';
    return 'smb';
  }

  /**
   * Calculate months since a date
   */
  private monthsSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (30 * 24 * 60 * 60 * 1000));
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async getCustomers(filters?: { segment?: string; tier?: string; min_clv?: number }): Promise<Customer[]> {
    if (this.supabase) {
      try {
        let query = this.supabase.from('customers').select('*').neq('stage', 'churned');

        if (filters?.segment) {
          if (filters.segment === 'enterprise') {
            query = query.gte('arr', 100000);
          } else if (filters.segment === 'mid-market') {
            query = query.gte('arr', 25000).lt('arr', 100000);
          } else if (filters.segment === 'smb') {
            query = query.lt('arr', 25000);
          }
        }

        const { data, error } = await query.order('arr', { ascending: false });

        if (error) throw error;

        return (data || []).map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          health_score: c.health_score || 70,
          segment: this.getSegmentFromARR(c.arr || 0),
          stage: c.stage || 'active',
          created_at: c.created_at,
          renewal_date: c.renewal_date,
          churn_probability: c.churn_probability || 0.15,
          expansion_probability: c.expansion_probability || 0.20
        }));
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
      }
    }

    // Return mock data (filtered)
    let customers = [...this.mockCustomers];
    if (filters?.segment) {
      customers = customers.filter(c => c.segment === filters.segment);
    }
    return customers;
  }

  // ============================================
  // Main Service Methods
  // ============================================

  /**
   * Calculate CLV for a single customer
   */
  async calculateCustomerCLV(customerId: string): Promise<CustomerCLV | null> {
    const customers = await this.getCustomers();
    const customer = customers.find(c => c.id === customerId);

    if (!customer) return null;

    return this.buildCustomerCLV(customer, customers);
  }

  /**
   * Build CustomerCLV object from customer data
   */
  private buildCustomerCLV(customer: Customer, allCustomers: Customer[]): CustomerCLV {
    const monthsAsCustomer = this.monthsSince(customer.created_at);
    const churnProbability = customer.churn_probability || 0.15;
    const expansionProbability = customer.expansion_probability || 0.20;

    // Calculate historical value (ARR * months / 12)
    const historicalRevenue = Math.round((customer.arr / 12) * monthsAsCustomer);

    // Estimate remaining lifetime
    const remainingLifetime = this.estimateRemainingLifetime(
      customer.health_score,
      churnProbability,
      monthsAsCustomer
    );

    // Calculate expansion rate from probability
    const expansionRate = expansionProbability * 0.3; // Max 9% annual expansion at 30% probability

    // Calculate predicted CLV
    const components: CLVComponents = {
      current_arr: customer.arr,
      estimated_lifetime_months: remainingLifetime,
      expansion_rate: expansionRate,
      gross_margin: CLV_DEFAULTS.gross_margin,
      discount_rate: CLV_DEFAULTS.discount_rate
    };

    const predictedCLV = this.calculateCLV(components);

    // Calculate CLV range (80% confidence interval)
    const clvLow = Math.round(predictedCLV * 0.7);
    const clvHigh = Math.round(predictedCLV * 1.4);

    // Total CLV = historical + predicted
    const totalCLV = historicalRevenue + predictedCLV;

    // Calculate percentile
    const allCLVs = allCustomers.map(c => {
      const months = this.monthsSince(c.created_at);
      const hist = Math.round((c.arr / 12) * months);
      const remaining = this.estimateRemainingLifetime(c.health_score, c.churn_probability || 0.15, months);
      const pred = this.calculateCLV({
        current_arr: c.arr,
        estimated_lifetime_months: remaining,
        expansion_rate: (c.expansion_probability || 0.20) * 0.3,
        gross_margin: CLV_DEFAULTS.gross_margin,
        discount_rate: CLV_DEFAULTS.discount_rate
      });
      return hist + pred;
    }).sort((a, b) => a - b);

    const rank = allCLVs.filter(v => v < totalCLV).length;
    const percentile = Math.round((rank / allCLVs.length) * 100);

    return {
      customer_id: customer.id,
      customer_name: customer.name,
      historical: {
        total_revenue: historicalRevenue,
        months_as_customer: monthsAsCustomer
      },
      current: {
        arr: customer.arr,
        monthly_revenue: Math.round(customer.arr / 12)
      },
      predicted: {
        remaining_lifetime_months: remainingLifetime,
        churn_probability: churnProbability,
        expansion_probability: expansionProbability,
        predicted_clv: predictedCLV,
        clv_range: { low: clvLow, high: clvHigh }
      },
      total_clv: totalCLV,
      clv_tier: this.assignCLVTier(totalCLV),
      clv_percentile: percentile,
      segment: customer.segment || this.getSegmentFromARR(customer.arr)
    };
  }

  /**
   * Get complete CLV report
   */
  async getCLVReport(query: {
    segment?: string;
    tier?: string;
    min_clv?: number;
    sort_by?: string;
    sort_order?: string;
    search?: string;
  } = {}): Promise<{
    summary: CLVSummary;
    customers: CustomerCLV[];
    distribution: CLVDistribution;
    trends: CLVTrend[];
    top_drivers: CLVDriver[];
  }> {
    const customers = await this.getCustomers({ segment: query.segment });

    // Calculate CLV for all customers
    let customerCLVs = customers.map(c => this.buildCustomerCLV(c, customers));

    // Apply tier filter
    if (query.tier) {
      customerCLVs = customerCLVs.filter(c => c.clv_tier === query.tier);
    }

    // Apply min CLV filter
    if (query.min_clv) {
      customerCLVs = customerCLVs.filter(c => c.total_clv >= query.min_clv!);
    }

    // Apply search filter
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      customerCLVs = customerCLVs.filter(c =>
        c.customer_name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sortBy = query.sort_by || 'clv';
    const sortOrder = query.sort_order || 'desc';
    customerCLVs.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'clv':
          comparison = a.total_clv - b.total_clv;
          break;
        case 'arr':
          comparison = a.current.arr - b.current.arr;
          break;
        case 'name':
          comparison = a.customer_name.localeCompare(b.customer_name);
          break;
        default:
          comparison = a.total_clv - b.total_clv;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Build summary
    const summary = this.buildSummary(customerCLVs);

    // Build distribution
    const distribution = this.buildDistribution(customerCLVs);

    // Build trends (mock for now)
    const trends = this.buildTrends();

    // Build top drivers
    const topDrivers = this.buildTopDrivers();

    return {
      summary,
      customers: customerCLVs,
      distribution,
      trends,
      top_drivers: topDrivers
    };
  }

  /**
   * Build summary statistics
   */
  private buildSummary(customerCLVs: CustomerCLV[]): CLVSummary {
    const totalCLV = customerCLVs.reduce((sum, c) => sum + c.total_clv, 0);
    const totalCustomers = customerCLVs.length;
    const avgCLV = totalCustomers > 0 ? Math.round(totalCLV / totalCustomers) : 0;

    // Calculate median
    const sortedCLVs = [...customerCLVs].sort((a, b) => a.total_clv - b.total_clv);
    const medianCLV = totalCustomers > 0
      ? sortedCLVs[Math.floor(totalCustomers / 2)].total_clv
      : 0;

    // CLV/CAC ratio
    const clvCacRatio = Math.round((avgCLV / CLV_DEFAULTS.cac) * 10) / 10;

    // Year-over-year change (mock: +12%)
    const clvChangeYOY = Math.round(avgCLV * 0.12);
    const clvChangePercent = 12;

    // Build tier summaries
    const tiers: CLVTierSummary[] = [
      { tier: 'platinum', customer_count: 0, total_clv: 0, avg_clv: 0, total_arr: 0, pct_of_portfolio: 0 },
      { tier: 'gold', customer_count: 0, total_clv: 0, avg_clv: 0, total_arr: 0, pct_of_portfolio: 0 },
      { tier: 'silver', customer_count: 0, total_clv: 0, avg_clv: 0, total_arr: 0, pct_of_portfolio: 0 },
      { tier: 'bronze', customer_count: 0, total_clv: 0, avg_clv: 0, total_arr: 0, pct_of_portfolio: 0 }
    ];

    customerCLVs.forEach(c => {
      const tierData = tiers.find(t => t.tier === c.clv_tier)!;
      tierData.customer_count++;
      tierData.total_clv += c.total_clv;
      tierData.total_arr += c.current.arr;
    });

    tiers.forEach(t => {
      t.avg_clv = t.customer_count > 0 ? Math.round(t.total_clv / t.customer_count) : 0;
      t.pct_of_portfolio = totalCLV > 0 ? Math.round((t.total_clv / totalCLV) * 100) : 0;
    });

    return {
      total_clv: totalCLV,
      total_customers: totalCustomers,
      avg_clv: avgCLV,
      median_clv: medianCLV,
      clv_cac_ratio: clvCacRatio,
      clv_change_yoy: clvChangeYOY,
      clv_change_percent: clvChangePercent,
      tiers
    };
  }

  /**
   * Build CLV distribution buckets
   */
  private buildDistribution(customerCLVs: CustomerCLV[]): CLVDistribution {
    const buckets: CLVDistributionBucket[] = [
      { range_label: '$1M+', min: 1000000, max: Infinity, count: 0, total_clv: 0, pct_of_total: 0 },
      { range_label: '$500K-$1M', min: 500000, max: 1000000, count: 0, total_clv: 0, pct_of_total: 0 },
      { range_label: '$200K-$500K', min: 200000, max: 500000, count: 0, total_clv: 0, pct_of_total: 0 },
      { range_label: '$50K-$200K', min: 50000, max: 200000, count: 0, total_clv: 0, pct_of_total: 0 },
      { range_label: '<$50K', min: 0, max: 50000, count: 0, total_clv: 0, pct_of_total: 0 }
    ];

    const totalCLV = customerCLVs.reduce((sum, c) => sum + c.total_clv, 0);

    customerCLVs.forEach(c => {
      const bucket = buckets.find(b => c.total_clv >= b.min && c.total_clv < b.max);
      if (bucket) {
        bucket.count++;
        bucket.total_clv += c.total_clv;
      }
    });

    buckets.forEach(b => {
      b.pct_of_total = totalCLV > 0 ? Math.round((b.total_clv / totalCLV) * 100) : 0;
    });

    // Calculate percentiles
    const sortedCLVs = customerCLVs.map(c => c.total_clv).sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const idx = Math.floor((p / 100) * sortedCLVs.length);
      return sortedCLVs[Math.min(idx, sortedCLVs.length - 1)] || 0;
    };

    return {
      buckets,
      percentiles: {
        p25: getPercentile(25),
        p50: getPercentile(50),
        p75: getPercentile(75),
        p90: getPercentile(90)
      }
    };
  }

  /**
   * Build CLV trends (mock data)
   */
  private buildTrends(): CLVTrend[] {
    const trends: CLVTrend[] = [];
    const now = new Date();
    const baseCLV = 48000000; // $48M total CLV

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      // Simulate ~2% monthly growth
      const growthFactor = 1 + ((11 - i) * 0.02);
      const variance = 0.98 + Math.random() * 0.04;
      const totalCLV = Math.round(baseCLV * growthFactor * variance);
      const customerCount = 260 + Math.round((11 - i) * 0.5);

      trends.push({
        period: date.toISOString().split('T')[0],
        period_label: monthLabel,
        avg_clv: Math.round(totalCLV / customerCount),
        total_clv: totalCLV,
        customer_count: customerCount,
        new_customers_clv: Math.round(totalCLV * 0.03 * Math.random()),
        churned_customers_clv: Math.round(totalCLV * 0.02 * Math.random())
      });
    }

    return trends;
  }

  /**
   * Build top CLV drivers
   */
  private buildTopDrivers(): CLVDriver[] {
    return [
      {
        factor: 'Customer Tenure',
        impact: 45000,
        description: '+$45K per year of tenure',
        direction: 'positive'
      },
      {
        factor: 'Product Adoption',
        impact: 30000,
        description: '+$30K per additional feature adopted',
        direction: 'positive'
      },
      {
        factor: 'Executive Sponsor Engagement',
        impact: 25000,
        description: '+$25K with active exec sponsor',
        direction: 'positive'
      },
      {
        factor: 'QBR Completion',
        impact: 15000,
        description: '+$15K for regular QBR attendance',
        direction: 'positive'
      },
      {
        factor: 'Support Ticket Volume',
        impact: -12000,
        description: '-$12K per high-severity ticket',
        direction: 'negative'
      },
      {
        factor: 'Usage Decline',
        impact: -20000,
        description: '-$20K for >20% usage drop',
        direction: 'negative'
      }
    ];
  }

  /**
   * Get detailed CLV for a specific customer
   */
  async getCustomerCLVDetail(customerId: string): Promise<{
    clv: CustomerCLV;
    drivers: CLVDriver[];
    history: CLVHistory[];
    recommendations: string[];
    comparison: {
      segment_avg: number;
      portfolio_avg: number;
      vs_segment: number;
      vs_portfolio: number;
    };
  } | null> {
    const customers = await this.getCustomers();
    const customer = customers.find(c => c.id === customerId);

    if (!customer) return null;

    const customerCLV = this.buildCustomerCLV(customer, customers);

    // Calculate segment and portfolio averages
    const segmentCustomers = customers.filter(c => c.segment === customer.segment);
    const segmentCLVs = segmentCustomers.map(c => this.buildCustomerCLV(c, customers));
    const segmentAvg = segmentCLVs.length > 0
      ? Math.round(segmentCLVs.reduce((sum, c) => sum + c.total_clv, 0) / segmentCLVs.length)
      : 0;

    const allCLVs = customers.map(c => this.buildCustomerCLV(c, customers));
    const portfolioAvg = allCLVs.length > 0
      ? Math.round(allCLVs.reduce((sum, c) => sum + c.total_clv, 0) / allCLVs.length)
      : 0;

    // Build customer-specific drivers
    const drivers: CLVDriver[] = [
      {
        factor: 'Health Score',
        impact: Math.round((customer.health_score / 100) * 50000),
        description: `Health score of ${customer.health_score} contributes to retention`,
        direction: 'positive'
      },
      {
        factor: 'Tenure',
        impact: Math.round((this.monthsSince(customer.created_at) / 12) * 45000),
        description: `${Math.round(this.monthsSince(customer.created_at) / 12)} years as customer`,
        direction: 'positive'
      },
      {
        factor: 'Expansion Potential',
        impact: Math.round((customer.expansion_probability || 0.20) * customer.arr * 2),
        description: `${Math.round((customer.expansion_probability || 0.20) * 100)}% expansion probability`,
        direction: 'positive'
      }
    ];

    // Generate CLV history (last 12 months)
    const history: CLVHistory[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // Simulate slight CLV growth over time
      const growthFactor = 1 + ((11 - i) * 0.01);
      history.push({
        date: date.toISOString().split('T')[0],
        clv: Math.round(customerCLV.total_clv * growthFactor / 1.11),
        arr: customer.arr,
        churn_probability: customer.churn_probability || 0.15
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (customer.health_score < 70) {
      recommendations.push('Schedule health review meeting to address declining engagement');
    }
    if ((customer.expansion_probability || 0) > 0.25) {
      recommendations.push('High expansion potential - schedule account planning session');
    }
    if ((customer.churn_probability || 0) > 0.20) {
      recommendations.push('Elevated churn risk - implement retention playbook');
    }
    if (this.monthsSince(customer.created_at) > 24) {
      recommendations.push('Long-tenured customer - consider executive business review');
    }
    if (customerCLV.clv_tier === 'platinum') {
      recommendations.push('Platinum tier - ensure executive sponsor relationship is strong');
    }

    return {
      clv: customerCLV,
      drivers,
      history,
      recommendations,
      comparison: {
        segment_avg: segmentAvg,
        portfolio_avg: portfolioAvg,
        vs_segment: customerCLV.total_clv - segmentAvg,
        vs_portfolio: customerCLV.total_clv - portfolioAvg
      }
    };
  }

  /**
   * Get CLV cohort analysis
   */
  async getCLVCohortAnalysis(dimension: string = 'signup_quarter'): Promise<{
    dimension: string;
    cohorts: Array<{
      cohort_name: string;
      cohort_period: string;
      customer_count: number;
      avg_clv: number;
      total_clv: number;
      avg_lifetime_months: number;
      retention_rate: number;
    }>;
  }> {
    const customers = await this.getCustomers();
    const customerCLVs = customers.map(c => ({
      ...this.buildCustomerCLV(c, customers),
      created_at: c.created_at,
      segment: c.segment
    }));

    // Group by quarter
    const cohorts = new Map<string, typeof customerCLVs>();

    customerCLVs.forEach(c => {
      const date = new Date(c.created_at);
      const quarter = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;

      if (!cohorts.has(quarter)) {
        cohorts.set(quarter, []);
      }
      cohorts.get(quarter)!.push(c);
    });

    const result = Array.from(cohorts.entries()).map(([period, members]) => {
      const totalCLV = members.reduce((sum, m) => sum + m.total_clv, 0);
      const avgLifetime = members.reduce((sum, m) => sum + m.historical.months_as_customer, 0) / members.length;

      return {
        cohort_name: period,
        cohort_period: period,
        customer_count: members.length,
        avg_clv: Math.round(totalCLV / members.length),
        total_clv: totalCLV,
        avg_lifetime_months: Math.round(avgLifetime),
        retention_rate: 85 + Math.random() * 10 // Mock retention rate
      };
    });

    // Sort by period
    result.sort((a, b) => {
      const [aQ, aY] = a.cohort_period.split(' ');
      const [bQ, bY] = b.cohort_period.split(' ');
      return parseInt(aY) - parseInt(bY) || parseInt(aQ.slice(1)) - parseInt(bQ.slice(1));
    });

    return {
      dimension,
      cohorts: result
    };
  }
}

// Export singleton instance
export const clvService = new CLVService();
