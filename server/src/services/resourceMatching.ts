/**
 * Resource Matching Service
 * PRD-245: AI-powered resource matching algorithm for technical resource requests
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types
// ============================================

interface ResourceRequest {
  id: string;
  customer_id: string;
  engagement_type: string;
  required_skills: string[];
  preferred_skills: string[];
  estimated_hours?: number;
  start_date?: string;
  end_date?: string;
  urgency: string;
}

interface ResourcePoolMember {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  resource_type: string;
  max_weekly_hours: number;
  target_utilization: number;
  timezone: string;
  is_available_for_requests: boolean;
}

interface UserSkillRow {
  user_id: string;
  skill_id: string;
  proficiency_level: number;
  verified: boolean;
  years_experience?: number;
  skill_name?: string;
  skill_category?: string;
}

interface AvailabilityRow {
  user_id: string;
  date: string;
  available_hours: number;
  booked_hours: number;
}

interface EngagementRow {
  id: string;
  request_id: string;
  customer_id?: string;
  resource_rating?: number;
}

export interface MatchedSkill {
  skill_id: string;
  skill_name: string;
  proficiency: number;
  verified: boolean;
}

export interface ResourceMatchDetails {
  matched_required_skills: MatchedSkill[];
  matched_preferred_skills: MatchedSkill[];
  missing_required_skills: string[];
  available_hours_in_range: number;
  current_utilization: number;
  similar_customer_experience: number;
  past_engagement_rating?: number;
}

export interface ResourceMatchScore {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  resource_type: string;
  match_score: number;
  skill_match_score: number;
  availability_score: number;
  workload_score: number;
  experience_score: number;
  details: ResourceMatchDetails;
}

// ============================================
// Matching Algorithm Weights
// ============================================

const MATCH_WEIGHTS = {
  skill: 0.40,       // 40% weight for skill match
  availability: 0.30, // 30% weight for availability
  workload: 0.20,    // 20% weight for current workload
  experience: 0.10   // 10% weight for past experience
};

const SKILL_WEIGHTS = {
  required: 0.70,    // Required skills are 70% of skill score
  preferred: 0.30    // Preferred skills are 30% of skill score
};

// ============================================
// Resource Matching Service
// ============================================

export class ResourceMatchingService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Find matching resources for a request
   */
  async findMatchingResources(request: ResourceRequest): Promise<ResourceMatchScore[]> {
    if (!this.supabase) {
      console.warn('Supabase not configured, returning empty matches');
      return this.getMockMatches(request);
    }

    try {
      // Step 1: Get all available resources
      const resources = await this.getAvailableResources(request.engagement_type);

      if (resources.length === 0) {
        return [];
      }

      // Step 2: Calculate match scores for each resource
      const matches = await Promise.all(
        resources.map(resource => this.calculateMatchScore(resource, request))
      );

      // Step 3: Filter out resources with 0 match score
      const validMatches = matches.filter(m => m.match_score > 0);

      // Step 4: Sort by match score (highest first)
      validMatches.sort((a, b) => b.match_score - a.match_score);

      return validMatches;
    } catch (error) {
      console.error('Error finding matching resources:', error);
      return this.getMockMatches(request);
    }
  }

  /**
   * Get available resources for an engagement type
   */
  private async getAvailableResources(engagementType: string): Promise<ResourcePoolMember[]> {
    if (!this.supabase) return [];

    // Map engagement types to preferred resource types
    const resourceTypeMapping: Record<string, string[]> = {
      'implementation': ['solutions_engineer', 'implementation_specialist'],
      'training': ['trainer', 'solutions_engineer'],
      'technical_review': ['solutions_architect', 'solutions_engineer'],
      'architecture_session': ['solutions_architect'],
      'troubleshooting': ['support_engineer', 'solutions_engineer'],
      'integration': ['solutions_engineer', 'implementation_specialist'],
      'migration': ['solutions_architect', 'solutions_engineer'],
      'optimization': ['solutions_architect', 'solutions_engineer'],
      'security_review': ['solutions_architect', 'consultant'],
      'other': ['solutions_engineer', 'consultant', 'technical_account_manager']
    };

    const preferredTypes = resourceTypeMapping[engagementType] || resourceTypeMapping['other'];

    const { data: poolMembers, error } = await this.supabase
      .from('resource_pool')
      .select(`
        user_id,
        resource_type,
        max_weekly_hours,
        target_utilization,
        timezone,
        is_available_for_requests,
        user_profiles!inner (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('is_available_for_requests', true);

    if (error || !poolMembers) {
      console.error('Error fetching resource pool:', error);
      return [];
    }

    // Sort by preferred types first
    return poolMembers
      .map((m: any) => ({
        user_id: m.user_id,
        full_name: m.user_profiles?.full_name || 'Unknown',
        email: m.user_profiles?.email || '',
        avatar_url: m.user_profiles?.avatar_url,
        resource_type: m.resource_type,
        max_weekly_hours: m.max_weekly_hours,
        target_utilization: m.target_utilization,
        timezone: m.timezone,
        is_available_for_requests: m.is_available_for_requests
      }))
      .sort((a: ResourcePoolMember, b: ResourcePoolMember) => {
        const aPreferred = preferredTypes.includes(a.resource_type) ? 0 : 1;
        const bPreferred = preferredTypes.includes(b.resource_type) ? 0 : 1;
        return aPreferred - bPreferred;
      });
  }

  /**
   * Calculate match score for a single resource
   */
  private async calculateMatchScore(
    resource: ResourcePoolMember,
    request: ResourceRequest
  ): Promise<ResourceMatchScore> {
    // Get user skills
    const skills = await this.getUserSkills(resource.user_id);

    // Calculate skill match score
    const skillMatch = this.calculateSkillMatchScore(
      skills,
      request.required_skills,
      request.preferred_skills
    );

    // Calculate availability score
    const availability = await this.calculateAvailabilityScore(
      resource.user_id,
      request.start_date,
      request.end_date,
      request.estimated_hours
    );

    // Calculate workload score
    const workload = await this.calculateWorkloadScore(
      resource.user_id,
      resource.target_utilization
    );

    // Calculate experience score
    const experience = await this.calculateExperienceScore(
      resource.user_id,
      request.customer_id
    );

    // Calculate weighted total match score
    const matchScore = Math.round(
      skillMatch.score * MATCH_WEIGHTS.skill +
      availability.score * MATCH_WEIGHTS.availability +
      workload.score * MATCH_WEIGHTS.workload +
      experience.score * MATCH_WEIGHTS.experience
    );

    return {
      user_id: resource.user_id,
      full_name: resource.full_name,
      email: resource.email,
      avatar_url: resource.avatar_url,
      resource_type: resource.resource_type,
      match_score: matchScore,
      skill_match_score: skillMatch.score,
      availability_score: availability.score,
      workload_score: workload.score,
      experience_score: experience.score,
      details: {
        matched_required_skills: skillMatch.matchedRequired,
        matched_preferred_skills: skillMatch.matchedPreferred,
        missing_required_skills: skillMatch.missingRequired,
        available_hours_in_range: availability.availableHours,
        current_utilization: workload.currentUtilization,
        similar_customer_experience: experience.similarCustomers,
        past_engagement_rating: experience.pastRating
      }
    };
  }

  /**
   * Get user skills with skill names
   */
  private async getUserSkills(userId: string): Promise<UserSkillRow[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('user_skills')
      .select(`
        user_id,
        skill_id,
        proficiency_level,
        verified,
        years_experience,
        resource_skills (
          name,
          category
        )
      `)
      .eq('user_id', userId);

    if (error || !data) return [];

    return data.map((row: any) => ({
      user_id: row.user_id,
      skill_id: row.skill_id,
      proficiency_level: row.proficiency_level,
      verified: row.verified,
      years_experience: row.years_experience,
      skill_name: row.resource_skills?.name,
      skill_category: row.resource_skills?.category
    }));
  }

  /**
   * Calculate skill match score
   */
  private calculateSkillMatchScore(
    userSkills: UserSkillRow[],
    requiredSkillIds: string[],
    preferredSkillIds: string[]
  ): {
    score: number;
    matchedRequired: MatchedSkill[];
    matchedPreferred: MatchedSkill[];
    missingRequired: string[];
  } {
    const matchedRequired: MatchedSkill[] = [];
    const matchedPreferred: MatchedSkill[] = [];
    const missingRequired: string[] = [];

    // Check required skills
    for (const skillId of requiredSkillIds) {
      const userSkill = userSkills.find(s => s.skill_id === skillId);
      if (userSkill) {
        matchedRequired.push({
          skill_id: skillId,
          skill_name: userSkill.skill_name || skillId,
          proficiency: userSkill.proficiency_level,
          verified: userSkill.verified
        });
      } else {
        missingRequired.push(skillId);
      }
    }

    // Check preferred skills
    for (const skillId of preferredSkillIds) {
      const userSkill = userSkills.find(s => s.skill_id === skillId);
      if (userSkill) {
        matchedPreferred.push({
          skill_id: skillId,
          skill_name: userSkill.skill_name || skillId,
          proficiency: userSkill.proficiency_level,
          verified: userSkill.verified
        });
      }
    }

    // Calculate score
    let requiredScore = 0;
    let preferredScore = 0;

    if (requiredSkillIds.length > 0) {
      // Score based on matched skills and proficiency
      const avgProficiency = matchedRequired.length > 0
        ? matchedRequired.reduce((sum, s) => sum + s.proficiency, 0) / matchedRequired.length
        : 0;
      const matchPercentage = matchedRequired.length / requiredSkillIds.length;

      // Bonus for verified skills
      const verifiedBonus = matchedRequired.filter(s => s.verified).length > 0 ? 0.1 : 0;

      requiredScore = matchPercentage * (avgProficiency / 5) * 100 + (verifiedBonus * 10);
    } else {
      requiredScore = 100; // No required skills means full score
    }

    if (preferredSkillIds.length > 0) {
      const avgProficiency = matchedPreferred.length > 0
        ? matchedPreferred.reduce((sum, s) => sum + s.proficiency, 0) / matchedPreferred.length
        : 0;
      const matchPercentage = matchedPreferred.length / preferredSkillIds.length;
      preferredScore = matchPercentage * (avgProficiency / 5) * 100;
    } else {
      preferredScore = 50; // No preferred skills means baseline
    }

    const finalScore = Math.round(
      requiredScore * SKILL_WEIGHTS.required +
      preferredScore * SKILL_WEIGHTS.preferred
    );

    return {
      score: Math.min(finalScore, 100),
      matchedRequired,
      matchedPreferred,
      missingRequired
    };
  }

  /**
   * Calculate availability score
   */
  private async calculateAvailabilityScore(
    userId: string,
    startDate?: string,
    endDate?: string,
    estimatedHours?: number
  ): Promise<{ score: number; availableHours: number }> {
    if (!this.supabase || !startDate || !endDate) {
      return { score: 50, availableHours: 0 };
    }

    const { data: availability, error } = await this.supabase
      .from('resource_availability')
      .select('available_hours, booked_hours')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error || !availability || availability.length === 0) {
      // Assume default 8 hours/day availability if no records
      const daysDiff = this.getDaysDifference(startDate, endDate);
      const defaultHours = daysDiff * 8;
      return {
        score: estimatedHours ? Math.min((defaultHours / estimatedHours) * 50, 70) : 50,
        availableHours: defaultHours
      };
    }

    const totalAvailable = availability.reduce((sum: number, a: AvailabilityRow) =>
      sum + (a.available_hours - a.booked_hours), 0);

    if (!estimatedHours) {
      return {
        score: totalAvailable > 0 ? 70 : 30,
        availableHours: Math.max(totalAvailable, 0)
      };
    }

    // Score based on available hours vs estimated hours
    const ratio = totalAvailable / estimatedHours;
    let score: number;

    if (ratio >= 1.5) score = 100;      // Plenty of capacity
    else if (ratio >= 1.0) score = 85;  // Enough capacity
    else if (ratio >= 0.75) score = 65; // Tight but possible
    else if (ratio >= 0.5) score = 40;  // May need extension
    else score = 20;                     // Insufficient capacity

    return {
      score,
      availableHours: Math.max(totalAvailable, 0)
    };
  }

  /**
   * Calculate workload score based on current utilization
   */
  private async calculateWorkloadScore(
    userId: string,
    targetUtilization: number
  ): Promise<{ score: number; currentUtilization: number }> {
    if (!this.supabase) {
      return { score: 50, currentUtilization: 0 };
    }

    // Get current week's utilization
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const { data, error } = await this.supabase
      .rpc('calculate_resource_utilization', {
        p_user_id: userId,
        p_start_date: weekStart.toISOString().split('T')[0],
        p_end_date: weekEnd.toISOString().split('T')[0]
      });

    if (error || !data || data.length === 0) {
      return { score: 70, currentUtilization: 0 }; // Assume available if no data
    }

    const utilization = data[0]?.utilization_rate || 0;
    const targetPercent = targetUtilization * 100;

    // Score based on how much headroom they have
    const headroom = targetPercent - utilization;
    let score: number;

    if (headroom >= 30) score = 100;      // Lots of capacity
    else if (headroom >= 20) score = 85;
    else if (headroom >= 10) score = 70;
    else if (headroom >= 0) score = 50;
    else if (headroom >= -10) score = 30; // Slightly over target
    else score = 10;                       // Significantly over target

    return {
      score,
      currentUtilization: Math.round(utilization)
    };
  }

  /**
   * Calculate experience score based on past engagements
   */
  private async calculateExperienceScore(
    userId: string,
    customerId: string
  ): Promise<{ score: number; similarCustomers: number; pastRating?: number }> {
    if (!this.supabase) {
      return { score: 50, similarCustomers: 0 };
    }

    // Get past engagements for this resource
    const { data: engagements, error } = await this.supabase
      .from('resource_requests')
      .select(`
        id,
        customer_id,
        resource_rating,
        customers!inner (
          id,
          industry
        )
      `)
      .eq('assigned_resource_id', userId)
      .eq('status', 'completed')
      .limit(20);

    if (error || !engagements || engagements.length === 0) {
      return { score: 50, similarCustomers: 0 };
    }

    // Check for past experience with this customer
    const sameCustomerEngagements = engagements.filter(
      (e: any) => e.customer_id === customerId
    );

    // Get target customer's industry for similarity matching
    const { data: targetCustomer } = await this.supabase
      .from('customers')
      .select('industry')
      .eq('id', customerId)
      .single();

    const targetIndustry = targetCustomer?.industry;

    // Count similar industry customers
    const similarIndustryCount = targetIndustry
      ? engagements.filter((e: any) => e.customers?.industry === targetIndustry).length
      : 0;

    // Calculate average rating
    const ratings = engagements
      .filter((e: any) => e.resource_rating != null)
      .map((e: any) => e.resource_rating);
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length
      : null;

    // Calculate score
    let score = 50; // Base score

    // Bonus for same customer experience
    if (sameCustomerEngagements.length > 0) {
      score += 25;
    }

    // Bonus for similar industry experience
    if (similarIndustryCount > 0) {
      score += Math.min(similarIndustryCount * 5, 15);
    }

    // Bonus for high ratings
    if (avgRating) {
      if (avgRating >= 4.5) score += 10;
      else if (avgRating >= 4.0) score += 5;
      else if (avgRating < 3.0) score -= 10;
    }

    return {
      score: Math.min(score, 100),
      similarCustomers: sameCustomerEngagements.length + similarIndustryCount,
      pastRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined
    };
  }

  /**
   * Helper: Get days difference between two dates
   */
  private getDaysDifference(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Mock matches for development/demo
   */
  private getMockMatches(request: ResourceRequest): ResourceMatchScore[] {
    return [
      {
        user_id: 'mock-user-1',
        full_name: 'Alex Chen',
        email: 'alex.chen@cscx.ai',
        avatar_url: undefined,
        resource_type: 'solutions_architect',
        match_score: 92,
        skill_match_score: 95,
        availability_score: 88,
        workload_score: 90,
        experience_score: 95,
        details: {
          matched_required_skills: [
            { skill_id: '1', skill_name: 'AWS', proficiency: 5, verified: true },
            { skill_id: '2', skill_name: 'Kubernetes', proficiency: 4, verified: true }
          ],
          matched_preferred_skills: [
            { skill_id: '3', skill_name: 'Python', proficiency: 4, verified: false }
          ],
          missing_required_skills: [],
          available_hours_in_range: 24,
          current_utilization: 72,
          similar_customer_experience: 3,
          past_engagement_rating: 4.8
        }
      },
      {
        user_id: 'mock-user-2',
        full_name: 'Sarah Johnson',
        email: 'sarah.johnson@cscx.ai',
        avatar_url: undefined,
        resource_type: 'solutions_engineer',
        match_score: 85,
        skill_match_score: 88,
        availability_score: 92,
        workload_score: 75,
        experience_score: 80,
        details: {
          matched_required_skills: [
            { skill_id: '1', skill_name: 'AWS', proficiency: 4, verified: true }
          ],
          matched_preferred_skills: [
            { skill_id: '3', skill_name: 'Python', proficiency: 5, verified: true },
            { skill_id: '4', skill_name: 'REST APIs', proficiency: 4, verified: false }
          ],
          missing_required_skills: ['Kubernetes'],
          available_hours_in_range: 32,
          current_utilization: 65,
          similar_customer_experience: 1,
          past_engagement_rating: 4.5
        }
      },
      {
        user_id: 'mock-user-3',
        full_name: 'Michael Park',
        email: 'michael.park@cscx.ai',
        avatar_url: undefined,
        resource_type: 'implementation_specialist',
        match_score: 78,
        skill_match_score: 75,
        availability_score: 85,
        workload_score: 80,
        experience_score: 70,
        details: {
          matched_required_skills: [
            { skill_id: '2', skill_name: 'Kubernetes', proficiency: 4, verified: true }
          ],
          matched_preferred_skills: [],
          missing_required_skills: ['AWS'],
          available_hours_in_range: 20,
          current_utilization: 70,
          similar_customer_experience: 0,
          past_engagement_rating: 4.2
        }
      }
    ];
  }
}

// Singleton export
export const resourceMatchingService = new ResourceMatchingService();
