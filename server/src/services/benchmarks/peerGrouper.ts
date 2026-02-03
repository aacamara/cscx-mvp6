/**
 * Peer Grouper Service
 * PRD-023: Benchmark Data Upload -> Peer Comparison
 *
 * Groups customers into peer cohorts based on various dimensions
 * (segment, industry, size, custom criteria) for benchmark comparison.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import type {
  PeerGroup,
  PeerGroupDimension,
  PeerGroupSummary,
  PeerGroupRequest,
} from '../../../../types/benchmark.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Segment definitions for automatic grouping
const SEGMENT_DEFINITIONS = {
  enterprise: { arrMin: 100000, label: 'Enterprise (>$100K ARR)' },
  'mid-market': { arrMin: 25000, arrMax: 100000, label: 'Mid-Market ($25K-$100K ARR)' },
  smb: { arrMax: 25000, label: 'SMB (<$25K ARR)' },
};

export interface CustomerForGrouping {
  id: string;
  name: string;
  arr: number;
  segment?: string;
  industry?: string;
  healthScore?: number;
}

class PeerGrouperService {
  /**
   * Create peer groups based on specified dimension
   */
  async createPeerGroups(
    customers: CustomerForGrouping[],
    request: PeerGroupRequest
  ): Promise<PeerGroup[]> {
    switch (request.dimension) {
      case 'segment':
        return this.groupBySegment(customers);
      case 'industry':
        return this.groupByIndustry(customers);
      case 'size':
        return this.groupBySize(customers);
      case 'custom':
        return this.groupByCustomCriteria(customers, request.criteria);
      default:
        return this.groupBySegment(customers);
    }
  }

  /**
   * Group customers by segment (Enterprise, Mid-Market, SMB)
   */
  private groupBySegment(customers: CustomerForGrouping[]): PeerGroup[] {
    const groups: PeerGroup[] = [];

    // Enterprise
    const enterpriseCustomers = customers.filter(c => c.arr >= 100000);
    if (enterpriseCustomers.length > 0) {
      groups.push({
        id: 'segment-enterprise',
        name: 'Enterprise (>$100K ARR)',
        dimension: 'segment',
        criteria: { segments: ['Enterprise'], arrMin: 100000 },
        customerCount: enterpriseCustomers.length,
        customerIds: enterpriseCustomers.map(c => c.id),
      });
    }

    // Mid-Market
    const midMarketCustomers = customers.filter(c => c.arr >= 25000 && c.arr < 100000);
    if (midMarketCustomers.length > 0) {
      groups.push({
        id: 'segment-mid-market',
        name: 'Mid-Market ($25K-$100K ARR)',
        dimension: 'segment',
        criteria: { segments: ['Mid-Market'], arrMin: 25000, arrMax: 100000 },
        customerCount: midMarketCustomers.length,
        customerIds: midMarketCustomers.map(c => c.id),
      });
    }

    // SMB
    const smbCustomers = customers.filter(c => c.arr < 25000);
    if (smbCustomers.length > 0) {
      groups.push({
        id: 'segment-smb',
        name: 'SMB (<$25K ARR)',
        dimension: 'segment',
        criteria: { segments: ['SMB'], arrMax: 25000 },
        customerCount: smbCustomers.length,
        customerIds: smbCustomers.map(c => c.id),
      });
    }

    return groups;
  }

  /**
   * Group customers by industry
   */
  private groupByIndustry(customers: CustomerForGrouping[]): PeerGroup[] {
    const industryMap = new Map<string, CustomerForGrouping[]>();

    customers.forEach(c => {
      const industry = c.industry || 'Unknown';
      if (!industryMap.has(industry)) {
        industryMap.set(industry, []);
      }
      industryMap.get(industry)!.push(c);
    });

    return Array.from(industryMap.entries()).map(([industry, members]) => ({
      id: `industry-${industry.toLowerCase().replace(/\s+/g, '-')}`,
      name: industry,
      dimension: 'industry' as PeerGroupDimension,
      criteria: { industries: [industry] },
      customerCount: members.length,
      customerIds: members.map(c => c.id),
    }));
  }

  /**
   * Group customers by company size (based on ARR brackets)
   */
  private groupBySize(customers: CustomerForGrouping[]): PeerGroup[] {
    const brackets = [
      { id: 'size-micro', name: 'Micro (<$10K)', min: 0, max: 10000 },
      { id: 'size-small', name: 'Small ($10K-$50K)', min: 10000, max: 50000 },
      { id: 'size-medium', name: 'Medium ($50K-$150K)', min: 50000, max: 150000 },
      { id: 'size-large', name: 'Large ($150K-$500K)', min: 150000, max: 500000 },
      { id: 'size-enterprise', name: 'Enterprise (>$500K)', min: 500000, max: Infinity },
    ];

    return brackets
      .map(bracket => {
        const members = customers.filter(
          c => c.arr >= bracket.min && c.arr < bracket.max
        );
        if (members.length === 0) return null;

        return {
          id: bracket.id,
          name: bracket.name,
          dimension: 'size' as PeerGroupDimension,
          criteria: {
            arrMin: bracket.min,
            arrMax: bracket.max === Infinity ? undefined : bracket.max,
          },
          customerCount: members.length,
          customerIds: members.map(c => c.id),
        };
      })
      .filter((g): g is PeerGroup => g !== null);
  }

  /**
   * Group customers by custom criteria
   */
  private groupByCustomCriteria(
    customers: CustomerForGrouping[],
    criteria?: PeerGroupRequest['criteria']
  ): PeerGroup[] {
    if (!criteria) {
      return this.groupBySegment(customers);
    }

    let filteredCustomers = [...customers];

    // Filter by specific customer IDs
    if (criteria.customerIds && criteria.customerIds.length > 0) {
      filteredCustomers = filteredCustomers.filter(c =>
        criteria.customerIds!.includes(c.id)
      );
    }

    // Filter by segments
    if (criteria.segments && criteria.segments.length > 0) {
      filteredCustomers = filteredCustomers.filter(c =>
        c.segment && criteria.segments!.some(
          s => s.toLowerCase() === c.segment!.toLowerCase()
        )
      );
    }

    // Filter by industries
    if (criteria.industries && criteria.industries.length > 0) {
      filteredCustomers = filteredCustomers.filter(c =>
        c.industry && criteria.industries!.some(
          i => i.toLowerCase() === c.industry!.toLowerCase()
        )
      );
    }

    // Filter by ARR range
    if (criteria.arrMin !== undefined) {
      filteredCustomers = filteredCustomers.filter(c => c.arr >= criteria.arrMin!);
    }
    if (criteria.arrMax !== undefined) {
      filteredCustomers = filteredCustomers.filter(c => c.arr < criteria.arrMax!);
    }

    if (filteredCustomers.length === 0) {
      return [];
    }

    return [
      {
        id: `custom-${Date.now()}`,
        name: this.generateCustomGroupName(criteria),
        dimension: 'custom',
        criteria,
        customerCount: filteredCustomers.length,
        customerIds: filteredCustomers.map(c => c.id),
      },
    ];
  }

  /**
   * Generate a descriptive name for custom peer group
   */
  private generateCustomGroupName(criteria: PeerGroupRequest['criteria']): string {
    const parts: string[] = [];

    if (criteria?.segments?.length) {
      parts.push(criteria.segments.join(', '));
    }
    if (criteria?.industries?.length) {
      parts.push(criteria.industries.join(', '));
    }
    if (criteria?.arrMin || criteria?.arrMax) {
      const min = criteria.arrMin ? `$${(criteria.arrMin / 1000).toFixed(0)}K` : '';
      const max = criteria.arrMax ? `$${(criteria.arrMax / 1000).toFixed(0)}K` : '';
      if (min && max) {
        parts.push(`${min}-${max} ARR`);
      } else if (min) {
        parts.push(`>${min} ARR`);
      } else if (max) {
        parts.push(`<${max} ARR`);
      }
    }

    return parts.length > 0 ? parts.join(' - ') : 'Custom Peer Group';
  }

  /**
   * Get peer group summaries with aggregated metrics
   */
  async getPeerGroupSummaries(
    peerGroups: PeerGroup[],
    customerData: Map<string, CustomerForGrouping>
  ): Promise<PeerGroupSummary[]> {
    return peerGroups.map(group => {
      const members = group.customerIds
        .map(id => customerData.get(id))
        .filter((c): c is CustomerForGrouping => c !== undefined);

      const totalArr = members.reduce((sum, c) => sum + c.arr, 0);
      const avgHealth = members.length > 0
        ? Math.round(members.reduce((sum, c) => sum + (c.healthScore || 70), 0) / members.length)
        : 0;

      return {
        id: group.id,
        name: group.name,
        customerCount: members.length,
        avgHealthScore: avgHealth,
        totalArr,
      };
    });
  }

  /**
   * Fetch customers from database for peer grouping
   */
  async fetchCustomersForGrouping(): Promise<CustomerForGrouping[]> {
    if (!supabase) {
      return this.getMockCustomers();
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, arr, segment, industry, health_score');

    if (error || !data) {
      console.error('Failed to fetch customers for grouping:', error);
      return [];
    }

    return data.map(c => ({
      id: c.id,
      name: c.name,
      arr: c.arr || 0,
      segment: c.segment,
      industry: c.industry,
      healthScore: c.health_score,
    }));
  }

  /**
   * Save peer group configuration
   */
  async savePeerGroup(userId: string, peerGroup: PeerGroup): Promise<PeerGroup> {
    if (!supabase) {
      return peerGroup;
    }

    const { data, error } = await supabase
      .from('peer_groups')
      .insert({
        id: peerGroup.id,
        name: peerGroup.name,
        dimension: peerGroup.dimension,
        criteria: peerGroup.criteria,
        customer_count: peerGroup.customerCount,
        customer_ids: peerGroup.customerIds,
        created_by: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save peer group: ${error.message}`);
    }

    return this.mapDbToPeerGroup(data);
  }

  /**
   * List saved peer groups
   */
  async listPeerGroups(userId?: string): Promise<PeerGroup[]> {
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from('peer_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('created_by', userId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(this.mapDbToPeerGroup);
  }

  /**
   * Get peer group by ID
   */
  async getPeerGroup(peerGroupId: string): Promise<PeerGroup | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('peer_groups')
      .select('*')
      .eq('id', peerGroupId)
      .single();

    if (error || !data) return null;
    return this.mapDbToPeerGroup(data);
  }

  /**
   * Delete peer group
   */
  async deletePeerGroup(peerGroupId: string): Promise<boolean> {
    if (!supabase) return true;

    const { error } = await supabase
      .from('peer_groups')
      .delete()
      .eq('id', peerGroupId);

    return !error;
  }

  /**
   * Map database row to PeerGroup type
   */
  private mapDbToPeerGroup(data: any): PeerGroup {
    return {
      id: data.id,
      name: data.name,
      dimension: data.dimension,
      criteria: data.criteria || {},
      customerCount: data.customer_count,
      customerIds: data.customer_ids || [],
    };
  }

  /**
   * Get mock customers for development
   */
  getMockCustomers(): CustomerForGrouping[] {
    return [
      { id: '1', name: 'TechCorp', arr: 180000, segment: 'Enterprise', industry: 'Technology', healthScore: 92 },
      { id: '2', name: 'DataPro', arr: 145000, segment: 'Enterprise', industry: 'Data', healthScore: 88 },
      { id: '3', name: 'CloudMax', arr: 210000, segment: 'Enterprise', industry: 'Cloud', healthScore: 85 },
      { id: '4', name: 'OldCorp', arr: 125000, segment: 'Enterprise', industry: 'Manufacturing', healthScore: 42 },
      { id: '5', name: 'Acme Corp', arr: 65000, segment: 'Mid-Market', industry: 'SaaS', healthScore: 72 },
      { id: '6', name: 'BetaInc', arr: 55000, segment: 'Mid-Market', industry: 'FinTech', healthScore: 78 },
      { id: '7', name: 'GrowthCo', arr: 48000, segment: 'Mid-Market', industry: 'E-commerce', healthScore: 81 },
      { id: '8', name: 'LegacyCo', arr: 72000, segment: 'Mid-Market', industry: 'Retail', healthScore: 38 },
      { id: '9', name: 'SmallBiz', arr: 18000, segment: 'SMB', industry: 'Services', healthScore: 45 },
      { id: '10', name: 'StartupXYZ', arr: 22000, segment: 'SMB', industry: 'Tech', healthScore: 68 },
      { id: '11', name: 'MicroCo', arr: 8000, segment: 'SMB', industry: 'Consulting', healthScore: 75 },
      { id: '12', name: 'AgencyPro', arr: 15000, segment: 'SMB', industry: 'Marketing', healthScore: 82 },
    ];
  }
}

// Singleton instance
export const peerGrouper = new PeerGrouperService();
export default peerGrouper;
