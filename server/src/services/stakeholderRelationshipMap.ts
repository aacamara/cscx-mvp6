/**
 * Stakeholder Relationship Map Service
 * PRD-063: Provides visual mapping of stakeholder relationships, org charts,
 * and multi-threading analysis for customer accounts.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Types
// ============================================

export type StakeholderRole = 'champion' | 'sponsor' | 'influencer' | 'user' | 'detractor' | 'blocker';
export type InfluenceLevel = 'high' | 'medium' | 'low';
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'unknown';
export type EngagementLevel = 'high' | 'medium' | 'low' | 'none';
export type RelationshipType = 'reports_to' | 'collaborates_with' | 'influences' | 'blocks';
export type RelationshipStrength = 'strong' | 'moderate' | 'weak';
export type ViewMode = 'org_chart' | 'influence_map' | 'engagement_view';

export interface Stakeholder {
  id: string;
  customerId: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;

  // Relationship attributes
  stakeholderRole: StakeholderRole;
  influenceLevel: InfluenceLevel;
  decisionMaker: boolean;
  budgetAuthority: boolean;

  // Engagement tracking
  sentiment: SentimentType;
  engagementLevel: EngagementLevel;
  lastContactDate: Date | null;
  preferredChannel: 'email' | 'phone' | 'slack' | 'in_person';

  // Organizational
  reportsTo?: string;
  directReports?: string[];

  // Status
  status: 'active' | 'departed' | 'on_leave';
  departureDate?: Date;
  notes?: string;

  // Legacy fields
  isChampion: boolean;
  isExecSponsor: boolean;
  isPrimary: boolean;
  engagementScore: number;
  interactionCount: number;
}

export interface StakeholderRelationship {
  id: string;
  fromId: string;
  toId: string;
  relationshipType: RelationshipType;
  strength: RelationshipStrength;
  notes?: string;
}

export interface MultiThreadingScore {
  score: number;
  hasChampion: boolean;
  hasExecSponsor: boolean;
  decisionMakersCovered: number;
  totalDecisionMakers: number;
  departmentsCovered: number;
  totalDepartments: number;
  avgSentimentScore: number;
  engagementGapCount: number;
}

export interface CoverageSummary {
  totalStakeholders: number;
  decisionMakers: number;
  decisionMakersCovered: boolean;
  execSponsor: number;
  execSponsorCovered: boolean;
  champions: number;
  championCovered: boolean;
  blockers: number;
  engagementGaps: number;
  departmentsCovered: string[];
  departmentsMissing: string[];
}

export interface StakeholderMapData {
  customerId: string;
  customerName: string;
  lastUpdated: Date;
  coverageSummary: CoverageSummary;
  multiThreadingScore: MultiThreadingScore;
  stakeholders: Stakeholder[];
  relationships: StakeholderRelationship[];
  recommendations: string[];
  riskContacts: Stakeholder[];
  championsAndSponsors: Stakeholder[];
  engagementGaps: Stakeholder[];
}

export interface RelationshipAction {
  contact: string;
  contactId: string;
  goal: string;
  nextStep: string;
  dueDate?: string;
}

// ============================================
// Service Implementation
// ============================================

class StakeholderRelationshipMapService {

  /**
   * Get the full stakeholder map for a customer
   */
  async getStakeholderMap(
    customerId: string,
    viewMode: ViewMode = 'org_chart',
    includeFormer: boolean = false
  ): Promise<StakeholderMapData | null> {
    if (!supabase) {
      console.warn('[StakeholderMap] Database not available, returning mock data');
      return this.getMockStakeholderMap(customerId);
    }

    try {
      // Fetch customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        console.error('[StakeholderMap] Customer not found:', customerId);
        return null;
      }

      // Fetch stakeholders
      let stakeholderQuery = supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId);

      if (!includeFormer) {
        stakeholderQuery = stakeholderQuery.eq('status', 'active');
      }

      const { data: stakeholdersRaw, error: stakeholderError } = await stakeholderQuery;

      if (stakeholderError) {
        console.error('[StakeholderMap] Error fetching stakeholders:', stakeholderError);
        return null;
      }

      const stakeholders: Stakeholder[] = (stakeholdersRaw || []).map(this.mapStakeholder);

      // Build direct reports map
      const directReportsMap = new Map<string, string[]>();
      stakeholders.forEach(s => {
        if (s.reportsTo) {
          const reports = directReportsMap.get(s.reportsTo) || [];
          reports.push(s.id);
          directReportsMap.set(s.reportsTo, reports);
        }
      });
      stakeholders.forEach(s => {
        s.directReports = directReportsMap.get(s.id) || [];
      });

      // Fetch relationships
      const stakeholderIds = stakeholders.map(s => s.id);
      let relationships: StakeholderRelationship[] = [];

      if (stakeholderIds.length > 0) {
        const { data: relationsRaw, error: relError } = await supabase
          .from('stakeholder_relationships')
          .select('*')
          .or(`from_stakeholder_id.in.(${stakeholderIds.join(',')}),to_stakeholder_id.in.(${stakeholderIds.join(',')})`);

        if (!relError && relationsRaw) {
          relationships = relationsRaw.map(r => ({
            id: r.id,
            fromId: r.from_stakeholder_id,
            toId: r.to_stakeholder_id,
            relationshipType: r.relationship_type,
            strength: r.strength,
            notes: r.notes,
          }));
        }
      }

      // Calculate multi-threading score
      const multiThreadingScore = await this.calculateMultiThreadingScore(customerId);

      // Calculate coverage summary
      const coverageSummary = this.calculateCoverageSummary(stakeholders, customerId);

      // Identify risk contacts (blockers, detractors, negative sentiment)
      const riskContacts = stakeholders.filter(s =>
        s.stakeholderRole === 'blocker' ||
        s.stakeholderRole === 'detractor' ||
        s.sentiment === 'negative'
      );

      // Champions and sponsors
      const championsAndSponsors = stakeholders.filter(s =>
        s.stakeholderRole === 'champion' ||
        s.stakeholderRole === 'sponsor' ||
        s.isChampion ||
        s.isExecSponsor
      );

      // Engagement gaps (no contact in 30+ days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const engagementGaps = stakeholders.filter(s =>
        !s.lastContactDate || new Date(s.lastContactDate) < thirtyDaysAgo
      ).filter(s =>
        s.decisionMaker || s.isChampion || s.isExecSponsor || s.influenceLevel === 'high'
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        stakeholders,
        multiThreadingScore,
        coverageSummary,
        riskContacts,
        engagementGaps
      );

      return {
        customerId,
        customerName: customer.name,
        lastUpdated: new Date(),
        coverageSummary,
        multiThreadingScore,
        stakeholders,
        relationships,
        recommendations,
        riskContacts,
        championsAndSponsors,
        engagementGaps,
      };
    } catch (error) {
      console.error('[StakeholderMap] Error getting stakeholder map:', error);
      return null;
    }
  }

  /**
   * Calculate multi-threading score for a customer
   */
  async calculateMultiThreadingScore(customerId: string): Promise<MultiThreadingScore> {
    if (!supabase) {
      return {
        score: 65,
        hasChampion: true,
        hasExecSponsor: true,
        decisionMakersCovered: 2,
        totalDecisionMakers: 3,
        departmentsCovered: 3,
        totalDepartments: 5,
        avgSentimentScore: 70,
        engagementGapCount: 2,
      };
    }

    try {
      // Use the database function
      const { data, error } = await supabase.rpc('calculate_multi_threading_score', {
        p_customer_id: customerId,
      });

      if (error || !data || data.length === 0) {
        console.error('[StakeholderMap] Error calculating score:', error);
        // Fall back to manual calculation
        return this.calculateScoreManually(customerId);
      }

      const result = data[0];
      return {
        score: result.score,
        hasChampion: result.has_champion,
        hasExecSponsor: result.has_exec_sponsor,
        decisionMakersCovered: result.decision_makers_covered,
        totalDecisionMakers: result.total_decision_makers,
        departmentsCovered: result.departments_covered,
        totalDepartments: result.total_departments,
        avgSentimentScore: result.avg_sentiment_score,
        engagementGapCount: result.engagement_gap_count,
      };
    } catch (error) {
      console.error('[StakeholderMap] Error calculating multi-threading score:', error);
      return this.calculateScoreManually(customerId);
    }
  }

  /**
   * Manual score calculation fallback
   */
  private async calculateScoreManually(customerId: string): Promise<MultiThreadingScore> {
    if (!supabase) {
      return {
        score: 50,
        hasChampion: false,
        hasExecSponsor: false,
        decisionMakersCovered: 0,
        totalDecisionMakers: 0,
        departmentsCovered: 0,
        totalDepartments: 5,
        avgSentimentScore: 50,
        engagementGapCount: 0,
      };
    }

    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    if (!stakeholders || stakeholders.length === 0) {
      return {
        score: 0,
        hasChampion: false,
        hasExecSponsor: false,
        decisionMakersCovered: 0,
        totalDecisionMakers: 0,
        departmentsCovered: 0,
        totalDepartments: 5,
        avgSentimentScore: 0,
        engagementGapCount: 0,
      };
    }

    const hasChampion = stakeholders.some(s => s.is_champion || s.stakeholder_role === 'champion');
    const hasExecSponsor = stakeholders.some(s => s.is_exec_sponsor || s.stakeholder_role === 'sponsor');
    const decisionMakers = stakeholders.filter(s => s.decision_maker);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const decisionMakersCovered = decisionMakers.filter(s =>
      s.last_contact_at && new Date(s.last_contact_at) >= thirtyDaysAgo
    ).length;
    const departments = new Set(stakeholders.map(s => s.department).filter(Boolean));

    let avgSentiment = 50;
    const sentimentStakeholders = stakeholders.filter(s => s.sentiment);
    if (sentimentStakeholders.length > 0) {
      const sentimentScores = sentimentStakeholders.map(s => {
        switch (s.sentiment) {
          case 'positive': return 100;
          case 'neutral': return 50;
          case 'negative': return 0;
          default: return 50;
        }
      });
      avgSentiment = Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length);
    }

    const keyStakeholders = stakeholders.filter(s =>
      s.decision_maker || s.is_champion || s.is_exec_sponsor
    );
    const engagementGaps = keyStakeholders.filter(s =>
      !s.last_contact_at || new Date(s.last_contact_at) < thirtyDaysAgo
    ).length;

    // Calculate score
    let score = 0;
    if (hasChampion) score += 20;
    if (hasExecSponsor) score += 20;
    if (decisionMakers.length > 0) {
      score += Math.round((decisionMakersCovered / decisionMakers.length) * 20);
    } else {
      score += 20;
    }
    score += Math.round((Math.min(departments.size, 5) / 5) * 20);
    score += Math.round(avgSentiment / 10);
    if (engagementGaps === 0) {
      score += 10;
    } else {
      score += Math.max(10 - engagementGaps * 2, 0);
    }

    return {
      score: Math.min(score, 100),
      hasChampion,
      hasExecSponsor,
      decisionMakersCovered,
      totalDecisionMakers: decisionMakers.length,
      departmentsCovered: departments.size,
      totalDepartments: 5,
      avgSentimentScore: avgSentiment,
      engagementGapCount: engagementGaps,
    };
  }

  /**
   * Calculate coverage summary
   */
  private calculateCoverageSummary(stakeholders: Stakeholder[], customerId: string): CoverageSummary {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const champions = stakeholders.filter(s =>
      s.stakeholderRole === 'champion' || s.isChampion
    );
    const sponsors = stakeholders.filter(s =>
      s.stakeholderRole === 'sponsor' || s.isExecSponsor
    );
    const decisionMakers = stakeholders.filter(s => s.decisionMaker);
    const blockers = stakeholders.filter(s =>
      s.stakeholderRole === 'blocker' || s.stakeholderRole === 'detractor'
    );

    const keyStakeholders = stakeholders.filter(s =>
      s.decisionMaker || s.isChampion || s.isExecSponsor || s.influenceLevel === 'high'
    );
    const engagementGaps = keyStakeholders.filter(s =>
      !s.lastContactDate || new Date(s.lastContactDate) < thirtyDaysAgo
    ).length;

    const allDepartments = ['Engineering', 'Product', 'Operations', 'Finance', 'Sales', 'Marketing', 'HR'];
    const coveredDepartments = [...new Set(stakeholders.map(s => s.department).filter(Boolean))];
    const missingDepartments = allDepartments.filter(d =>
      !coveredDepartments.some(cd => cd.toLowerCase() === d.toLowerCase())
    );

    return {
      totalStakeholders: stakeholders.length,
      decisionMakers: decisionMakers.length,
      decisionMakersCovered: decisionMakers.length > 0,
      execSponsor: sponsors.length,
      execSponsorCovered: sponsors.length > 0,
      champions: champions.length,
      championCovered: champions.length > 0,
      blockers: blockers.length,
      engagementGaps,
      departmentsCovered: coveredDepartments,
      departmentsMissing: missingDepartments,
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    stakeholders: Stakeholder[],
    score: MultiThreadingScore,
    coverage: CoverageSummary,
    riskContacts: Stakeholder[],
    engagementGaps: Stakeholder[]
  ): string[] {
    const recommendations: string[] = [];

    // Champion recommendation
    if (!score.hasChampion) {
      recommendations.push('Identify and cultivate a champion within the organization');
    } else if (coverage.champions === 1) {
      recommendations.push('Identify secondary champion to reduce single-threaded risk');
    }

    // Exec sponsor recommendation
    if (!score.hasExecSponsor) {
      recommendations.push('Establish executive sponsorship for strategic alignment');
    }

    // Risk contacts
    riskContacts.forEach(contact => {
      if (contact.stakeholderRole === 'blocker') {
        recommendations.push(`Address blocker concerns with ${contact.name} (${contact.title})`);
      } else if (contact.sentiment === 'negative') {
        recommendations.push(`Re-engage ${contact.name} to improve sentiment`);
      }
    });

    // Engagement gaps
    engagementGaps.slice(0, 3).forEach(contact => {
      const daysSinceContact = contact.lastContactDate
        ? Math.floor((Date.now() - new Date(contact.lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
        : 'unknown';
      recommendations.push(`Schedule follow-up with ${contact.name} (${daysSinceContact} days since last contact)`);
    });

    // Department coverage
    if (coverage.departmentsMissing.length > 0) {
      const missing = coverage.departmentsMissing.slice(0, 2).join(', ');
      recommendations.push(`Explore contacts in ${missing} department(s)`);
    }

    // Score-based recommendations
    if (score.score < 50) {
      recommendations.push('Critical: Significantly expand stakeholder coverage to reduce churn risk');
    } else if (score.score < 70) {
      recommendations.push('Build deeper multi-threading across the organization');
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Create or update a stakeholder relationship
   */
  async createRelationship(
    fromId: string,
    toId: string,
    relationshipType: RelationshipType,
    strength: RelationshipStrength = 'moderate',
    notes?: string
  ): Promise<StakeholderRelationship | null> {
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('stakeholder_relationships')
        .upsert({
          from_stakeholder_id: fromId,
          to_stakeholder_id: toId,
          relationship_type: relationshipType,
          strength,
          notes,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'from_stakeholder_id,to_stakeholder_id,relationship_type',
        })
        .select()
        .single();

      if (error) {
        console.error('[StakeholderMap] Error creating relationship:', error);
        return null;
      }

      return {
        id: data.id,
        fromId: data.from_stakeholder_id,
        toId: data.to_stakeholder_id,
        relationshipType: data.relationship_type,
        strength: data.strength,
        notes: data.notes,
      };
    } catch (error) {
      console.error('[StakeholderMap] Error creating relationship:', error);
      return null;
    }
  }

  /**
   * Delete a stakeholder relationship
   */
  async deleteRelationship(relationshipId: string): Promise<boolean> {
    if (!supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('stakeholder_relationships')
        .delete()
        .eq('id', relationshipId);

      if (error) {
        console.error('[StakeholderMap] Error deleting relationship:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[StakeholderMap] Error deleting relationship:', error);
      return false;
    }
  }

  /**
   * Update stakeholder fields
   */
  async updateStakeholder(
    stakeholderId: string,
    updates: Partial<{
      stakeholderRole: StakeholderRole;
      influenceLevel: InfluenceLevel;
      decisionMaker: boolean;
      budgetAuthority: boolean;
      sentiment: SentimentType;
      preferredChannel: 'email' | 'phone' | 'slack' | 'in_person';
      reportsTo: string | null;
      department: string;
      title: string;
      notes: string;
    }>
  ): Promise<Stakeholder | null> {
    if (!supabase) {
      return null;
    }

    try {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.stakeholderRole !== undefined) dbUpdates.stakeholder_role = updates.stakeholderRole;
      if (updates.influenceLevel !== undefined) dbUpdates.influence_level = updates.influenceLevel;
      if (updates.decisionMaker !== undefined) dbUpdates.decision_maker = updates.decisionMaker;
      if (updates.budgetAuthority !== undefined) dbUpdates.budget_authority = updates.budgetAuthority;
      if (updates.sentiment !== undefined) dbUpdates.sentiment = updates.sentiment;
      if (updates.preferredChannel !== undefined) dbUpdates.preferred_channel = updates.preferredChannel;
      if (updates.reportsTo !== undefined) dbUpdates.reports_to = updates.reportsTo;
      if (updates.department !== undefined) dbUpdates.department = updates.department;
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      // Sync champion/sponsor flags
      if (updates.stakeholderRole === 'champion') {
        dbUpdates.is_champion = true;
        dbUpdates.is_exec_sponsor = false;
      } else if (updates.stakeholderRole === 'sponsor') {
        dbUpdates.is_exec_sponsor = true;
        dbUpdates.is_champion = false;
      }

      const { data, error } = await supabase
        .from('stakeholders')
        .update(dbUpdates)
        .eq('id', stakeholderId)
        .select()
        .single();

      if (error) {
        console.error('[StakeholderMap] Error updating stakeholder:', error);
        return null;
      }

      return this.mapStakeholder(data);
    } catch (error) {
      console.error('[StakeholderMap] Error updating stakeholder:', error);
      return null;
    }
  }

  /**
   * Get suggested relationship actions for a customer
   */
  async getRelationshipActions(customerId: string): Promise<RelationshipAction[]> {
    const map = await this.getStakeholderMap(customerId);
    if (!map) return [];

    const actions: RelationshipAction[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Action for engagement gaps
    map.engagementGaps.forEach(contact => {
      const daysSinceContact = contact.lastContactDate
        ? Math.floor((Date.now() - new Date(contact.lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let goal = 'Maintain relationship';
      if (contact.isExecSponsor) goal = 'Maintain exec sponsorship';
      else if (contact.isChampion) goal = 'Keep champion engaged';
      else if (contact.decisionMaker) goal = 'Ensure decision maker alignment';

      actions.push({
        contact: contact.name,
        contactId: contact.id,
        goal,
        nextStep: daysSinceContact && daysSinceContact > 60
          ? 'Re-engage urgently'
          : 'Schedule quarterly call',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    });

    // Action for risk contacts
    map.riskContacts.forEach(contact => {
      if (contact.stakeholderRole === 'blocker') {
        actions.push({
          contact: contact.name,
          contactId: contact.id,
          goal: 'Convert blocker to neutral',
          nextStep: 'Share value report, address concerns',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      } else if (contact.sentiment === 'negative') {
        actions.push({
          contact: contact.name,
          contactId: contact.id,
          goal: 'Improve sentiment',
          nextStep: 'Schedule ROI review meeting',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      }
    });

    // New contact action for missing departments
    if (map.coverageSummary.departmentsMissing.length > 0) {
      const dept = map.coverageSummary.departmentsMissing[0];
      const champion = map.championsAndSponsors[0];
      if (champion) {
        actions.push({
          contact: `${dept} TBD`,
          contactId: '',
          goal: 'New contact',
          nextStep: `Get intro from ${champion.name}`,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      }
    }

    return actions.slice(0, 10);
  }

  /**
   * Map database row to Stakeholder type
   */
  private mapStakeholder(row: any): Stakeholder {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const lastContact = row.last_contact_at ? new Date(row.last_contact_at) : null;

    let engagementLevel: EngagementLevel = 'none';
    if (lastContact) {
      const daysSince = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 7) engagementLevel = 'high';
      else if (daysSince <= 30) engagementLevel = 'medium';
      else if (daysSince <= 60) engagementLevel = 'low';
    }

    return {
      id: row.id,
      customerId: row.customer_id,
      name: row.name,
      title: row.title || row.role || '',
      department: row.department || '',
      email: row.email || '',
      phone: row.phone,
      linkedinUrl: row.linkedin_url,
      stakeholderRole: row.stakeholder_role || 'user',
      influenceLevel: row.influence_level || 'medium',
      decisionMaker: row.decision_maker || false,
      budgetAuthority: row.budget_authority || false,
      sentiment: row.sentiment || 'unknown',
      engagementLevel,
      lastContactDate: lastContact,
      preferredChannel: row.preferred_channel || 'email',
      reportsTo: row.reports_to,
      status: row.status || 'active',
      departureDate: row.departure_detected_at ? new Date(row.departure_detected_at) : undefined,
      notes: row.notes,
      isChampion: row.is_champion || false,
      isExecSponsor: row.is_exec_sponsor || false,
      isPrimary: row.is_primary || false,
      engagementScore: row.engagement_score || 50,
      interactionCount: row.interaction_count || 0,
    };
  }

  /**
   * Mock data for development without database
   */
  private getMockStakeholderMap(customerId: string): StakeholderMapData {
    const mockStakeholders: Stakeholder[] = [
      {
        id: '1',
        customerId,
        name: 'Tom Williams',
        title: 'CEO',
        department: 'Executive',
        email: 'tom.williams@company.com',
        stakeholderRole: 'sponsor',
        influenceLevel: 'high',
        decisionMaker: true,
        budgetAuthority: true,
        sentiment: 'neutral',
        engagementLevel: 'low',
        lastContactDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        preferredChannel: 'email',
        status: 'active',
        isChampion: false,
        isExecSponsor: true,
        isPrimary: false,
        engagementScore: 60,
        interactionCount: 4,
      },
      {
        id: '2',
        customerId,
        name: 'Sarah Chen',
        title: 'VP Operations',
        department: 'Operations',
        email: 'sarah.chen@company.com',
        stakeholderRole: 'champion',
        influenceLevel: 'high',
        decisionMaker: true,
        budgetAuthority: false,
        sentiment: 'positive',
        engagementLevel: 'high',
        lastContactDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        preferredChannel: 'email',
        reportsTo: '1',
        status: 'active',
        isChampion: true,
        isExecSponsor: false,
        isPrimary: true,
        engagementScore: 90,
        interactionCount: 15,
      },
      {
        id: '3',
        customerId,
        name: 'Mike Lee',
        title: 'VP Engineering',
        department: 'Engineering',
        email: 'mike.lee@company.com',
        stakeholderRole: 'user',
        influenceLevel: 'high',
        decisionMaker: false,
        budgetAuthority: false,
        sentiment: 'positive',
        engagementLevel: 'medium',
        lastContactDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        preferredChannel: 'slack',
        reportsTo: '1',
        status: 'active',
        isChampion: false,
        isExecSponsor: false,
        isPrimary: false,
        engagementScore: 75,
        interactionCount: 8,
      },
      {
        id: '4',
        customerId,
        name: 'Jane Doe',
        title: 'CFO',
        department: 'Finance',
        email: 'jane.doe@company.com',
        stakeholderRole: 'blocker',
        influenceLevel: 'high',
        decisionMaker: true,
        budgetAuthority: true,
        sentiment: 'negative',
        engagementLevel: 'low',
        lastContactDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        preferredChannel: 'email',
        reportsTo: '1',
        status: 'active',
        isChampion: false,
        isExecSponsor: false,
        isPrimary: false,
        engagementScore: 30,
        interactionCount: 2,
      },
      {
        id: '5',
        customerId,
        name: 'Bob Smith',
        title: 'Operations Manager',
        department: 'Operations',
        email: 'bob.smith@company.com',
        stakeholderRole: 'user',
        influenceLevel: 'medium',
        decisionMaker: false,
        budgetAuthority: false,
        sentiment: 'positive',
        engagementLevel: 'medium',
        lastContactDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        preferredChannel: 'email',
        reportsTo: '2',
        status: 'active',
        isChampion: false,
        isExecSponsor: false,
        isPrimary: false,
        engagementScore: 70,
        interactionCount: 6,
      },
    ];

    // Set direct reports
    mockStakeholders.forEach(s => {
      s.directReports = mockStakeholders
        .filter(child => child.reportsTo === s.id)
        .map(child => child.id);
    });

    return {
      customerId,
      customerName: 'Acme Corp',
      lastUpdated: new Date(),
      coverageSummary: {
        totalStakeholders: 5,
        decisionMakers: 2,
        decisionMakersCovered: true,
        execSponsor: 1,
        execSponsorCovered: true,
        champions: 1,
        championCovered: true,
        blockers: 1,
        engagementGaps: 2,
        departmentsCovered: ['Executive', 'Operations', 'Engineering', 'Finance'],
        departmentsMissing: ['Marketing', 'HR', 'Sales'],
      },
      multiThreadingScore: {
        score: 65,
        hasChampion: true,
        hasExecSponsor: true,
        decisionMakersCovered: 2,
        totalDecisionMakers: 3,
        departmentsCovered: 4,
        totalDepartments: 7,
        avgSentimentScore: 62,
        engagementGapCount: 2,
      },
      stakeholders: mockStakeholders,
      relationships: [
        { id: 'r1', fromId: '2', toId: '1', relationshipType: 'reports_to', strength: 'strong' },
        { id: 'r2', fromId: '3', toId: '1', relationshipType: 'reports_to', strength: 'moderate' },
        { id: 'r3', fromId: '4', toId: '1', relationshipType: 'reports_to', strength: 'moderate' },
        { id: 'r4', fromId: '5', toId: '2', relationshipType: 'reports_to', strength: 'strong' },
        { id: 'r5', fromId: '2', toId: '3', relationshipType: 'collaborates_with', strength: 'moderate' },
        { id: 'r6', fromId: '4', toId: '2', relationshipType: 'blocks', strength: 'weak' },
      ],
      recommendations: [
        'Identify secondary champion in Engineering',
        'Schedule CFO relationship-building meeting',
        'Explore Marketing department contact',
        'Schedule quarterly alignment call with Tom Williams',
        'Address CFO concerns about ROI',
      ],
      riskContacts: [mockStakeholders[3]],
      championsAndSponsors: [mockStakeholders[0], mockStakeholders[1]],
      engagementGaps: [mockStakeholders[0], mockStakeholders[3]],
    };
  }
}

export const stakeholderRelationshipMapService = new StakeholderRelationshipMapService();
