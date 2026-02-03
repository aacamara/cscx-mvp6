/**
 * Reference Manager Service
 * PRD-043: Reference Request to Customer
 *
 * Handles reference pool management, matching references to prospects,
 * tracking reference calls, and preventing request fatigue.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  generateReferenceRequestEmail,
  generateReferenceSpecificEmail,
  type ReferenceRequestData,
  type ReferenceSpecificData,
} from '../../templates/emails/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export type ReferenceAvailability = 'available' | 'busy' | 'limited' | 'inactive' | 'declined';
export type CallStatus = 'requested' | 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
export type CallOutcome = 'positive' | 'neutral' | 'negative' | 'deal_won' | 'deal_lost';

export interface CustomerReference {
  id: string;
  customerId: string;
  customerName?: string;
  stakeholderName: string;
  stakeholderEmail: string;
  stakeholderTitle?: string;
  isActive: boolean;
  availabilityStatus: ReferenceAvailability;
  maxCallsPerMonth: number;
  currentMonthCalls: number;
  preferredFormat: 'phone' | 'video' | 'either';
  preferredDuration: '15min' | '30min' | '45min' | '60min';
  topics: string[];
  industries: string[];
  totalCallsCompleted: number;
  lastCallDate?: string;
  averageRating?: number;
  enrolledAt: string;
  notes?: string;
}

export interface ReferenceCall {
  id: string;
  referenceId: string;
  customerId: string;
  prospectCompany: string;
  prospectContactName?: string;
  prospectContactEmail?: string;
  prospectIndustry?: string;
  callStatus: CallStatus;
  scheduledAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  callFormat?: 'phone' | 'video';
  referenceRating?: number;
  prospectRating?: number;
  referenceFeedback?: string;
  prospectFeedback?: string;
  outcome?: CallOutcome;
  dealInfluenced: boolean;
  dealValue?: number;
  createdAt: string;
}

export interface ReadinessAssessment {
  eligible: boolean;
  score: number;
  signals: {
    healthScore: { value: number; status: 'good' | 'warning' | 'bad' };
    npsScore?: { value: number; status: 'good' | 'warning' | 'bad' };
    relationshipTenure: { months: number; status: 'good' | 'warning' | 'bad' };
    activeIssues: { count: number; status: 'good' | 'bad' };
    lastReferenceCall?: { daysAgo: number; status: 'good' | 'warning' | 'bad' };
    existingReference?: { isActive: boolean; availability: string };
  };
  champion?: {
    name: string;
    email: string;
    title?: string;
  };
  recommendation: 'proceed' | 'wait' | 'not_recommended';
  reasons: string[];
  wins: string[];
}

export interface ReferencePoolStats {
  totalReferences: number;
  activeReferences: number;
  availableReferences: number;
  totalCallsThisMonth: number;
  totalCallsAllTime: number;
  averageRating: number;
  topIndustries: { industry: string; count: number }[];
  topTopics: { topic: string; count: number }[];
}

export interface MatchCriteria {
  industry?: string;
  companySize?: string;
  topics?: string[];
  preferredFormat?: 'phone' | 'video' | 'either';
  maxDuration?: '15min' | '30min' | '45min' | '60min';
  urgency?: 'standard' | 'high' | 'critical';
}

export interface MatchedReference extends CustomerReference {
  matchScore: number;
  matchReasons: string[];
}

// Constants
const MIN_HEALTH_SCORE = 70;
const MIN_NPS_SCORE = 7;
const MIN_TENURE_MONTHS = 6;
const REFERENCE_COOLDOWN_DAYS = 60; // Days between reference calls for same customer
const MAX_CALLS_PER_MONTH_DEFAULT = 2;

/**
 * Reference Manager Service
 */
export const referenceManagerService = {
  /**
   * Assess customer readiness for reference request
   */
  async assessReadiness(customerId: string): Promise<ReadinessAssessment> {
    const signals: ReadinessAssessment['signals'] = {
      healthScore: { value: 0, status: 'bad' },
      relationshipTenure: { months: 0, status: 'bad' },
      activeIssues: { count: 0, status: 'good' },
    };
    const reasons: string[] = [];
    const wins: string[] = [];
    let score = 0;
    let champion: ReadinessAssessment['champion'] | undefined;

    if (!supabase) {
      return {
        eligible: false,
        score: 0,
        signals,
        recommendation: 'not_recommended',
        reasons: ['Database not configured'],
        wins: [],
      };
    }

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, health_score, arr, created_at, stage')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return {
        eligible: false,
        score: 0,
        signals,
        recommendation: 'not_recommended',
        reasons: ['Customer not found'],
        wins: [],
      };
    }

    // Check health score
    const healthScore = customer.health_score || 0;
    signals.healthScore = {
      value: healthScore,
      status: healthScore >= 80 ? 'good' : healthScore >= MIN_HEALTH_SCORE ? 'warning' : 'bad',
    };
    if (healthScore >= 80) {
      score += 25;
      reasons.push(`Health Score: ${healthScore} (Excellent)`);
    } else if (healthScore >= MIN_HEALTH_SCORE) {
      score += 15;
      reasons.push(`Health Score: ${healthScore} (Good)`);
    } else {
      reasons.push(`Health Score: ${healthScore} (Below threshold)`);
    }

    // Check relationship tenure
    const createdAt = new Date(customer.created_at);
    const tenureMonths = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30));
    signals.relationshipTenure = {
      months: tenureMonths,
      status: tenureMonths >= 24 ? 'good' : tenureMonths >= MIN_TENURE_MONTHS ? 'warning' : 'bad',
    };
    if (tenureMonths >= 24) {
      score += 20;
      const years = Math.floor(tenureMonths / 12);
      reasons.push(`Relationship tenure: ${years}+ year${years > 1 ? 's' : ''}`);
    } else if (tenureMonths >= MIN_TENURE_MONTHS) {
      score += 10;
      reasons.push(`Relationship tenure: ${tenureMonths} months`);
    } else {
      reasons.push(`Relationship tenure: ${tenureMonths} months (Too short)`);
    }

    // Check NPS score
    const { data: npsData } = await supabase
      .from('nps_responses')
      .select('score')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestNps = npsData?.[0]?.score;
    if (latestNps !== undefined) {
      signals.npsScore = {
        value: latestNps,
        status: latestNps >= 9 ? 'good' : latestNps >= MIN_NPS_SCORE ? 'warning' : 'bad',
      };
      if (latestNps >= 9) {
        score += 25;
        reasons.push(`NPS: ${latestNps} (Strong Promoter)`);
      } else if (latestNps >= MIN_NPS_SCORE) {
        score += 10;
        reasons.push(`NPS: ${latestNps} (Passive)`);
      } else {
        reasons.push(`NPS: ${latestNps} (Detractor - not recommended)`);
      }
    }

    // Check for active support issues
    const { count: issueCount } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .in('status', ['open', 'in_progress', 'escalated']);

    signals.activeIssues = {
      count: issueCount || 0,
      status: (issueCount || 0) === 0 ? 'good' : 'bad',
    };
    if ((issueCount || 0) === 0) {
      score += 10;
      reasons.push('No active support issues');
    } else {
      reasons.push(`${issueCount} active support issue${issueCount === 1 ? '' : 's'}`);
    }

    // Check existing reference status
    const { data: existingRef } = await supabase
      .from('customer_references')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .limit(1);

    if (existingRef && existingRef.length > 0) {
      signals.existingReference = {
        isActive: true,
        availability: existingRef[0].availability_status,
      };
      score += 15;
      reasons.push(`Already in reference program (${existingRef[0].availability_status})`);
    }

    // Check last reference call
    const { data: lastCall } = await supabase
      .from('reference_calls')
      .select('completed_at')
      .eq('customer_id', customerId)
      .eq('call_status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (lastCall && lastCall.length > 0 && lastCall[0].completed_at) {
      const lastCallDate = new Date(lastCall[0].completed_at);
      const daysSince = Math.floor((Date.now() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24));
      signals.lastReferenceCall = {
        daysAgo: daysSince,
        status: daysSince >= REFERENCE_COOLDOWN_DAYS * 2 ? 'good' : daysSince >= REFERENCE_COOLDOWN_DAYS ? 'warning' : 'bad',
      };
      if (daysSince >= REFERENCE_COOLDOWN_DAYS) {
        reasons.push(`Last reference call: ${Math.floor(daysSince / 30)} months ago`);
      } else {
        reasons.push(`Recent reference call: ${daysSince} days ago`);
      }
    }

    // Find champion (highest-scoring stakeholder)
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('name, email, role, sentiment_score')
      .eq('customer_id', customerId)
      .order('sentiment_score', { ascending: false })
      .limit(1);

    if (stakeholders && stakeholders.length > 0) {
      champion = {
        name: stakeholders[0].name,
        email: stakeholders[0].email,
        title: stakeholders[0].role,
      };
      reasons.push(`Champion: ${stakeholders[0].name} (${stakeholders[0].role || 'Contact'})`);
    }

    // Get recent wins from QBRs
    const { data: qbrData } = await supabase
      .from('qbrs')
      .select('wins')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (qbrData?.[0]?.wins && Array.isArray(qbrData[0].wins)) {
      wins.push(...qbrData[0].wins.slice(0, 3));
    }

    // Determine eligibility and recommendation
    const eligible = (
      signals.healthScore.status !== 'bad' &&
      signals.relationshipTenure.status !== 'bad' &&
      signals.activeIssues.status === 'good' &&
      (signals.npsScore?.status !== 'bad' || signals.npsScore === undefined) &&
      (signals.lastReferenceCall?.status !== 'bad' || signals.lastReferenceCall === undefined)
    );

    let recommendation: ReadinessAssessment['recommendation'] = 'not_recommended';
    if (eligible && score >= 60) {
      recommendation = 'proceed';
    } else if (eligible && score >= 40) {
      recommendation = 'proceed';
    } else if (signals.activeIssues.count > 0 || (signals.npsScore?.status === 'bad')) {
      recommendation = 'not_recommended';
    } else {
      recommendation = 'wait';
    }

    return {
      eligible,
      score,
      signals,
      champion,
      recommendation,
      reasons,
      wins,
    };
  },

  /**
   * Generate reference request email (general or specific)
   */
  async generateReferenceRequest(
    customerId: string,
    options: {
      stakeholderEmail: string;
      stakeholderName: string;
      stakeholderTitle?: string;
      csmName: string;
      csmEmail: string;
      csmTitle?: string;
      prospect?: ReferenceSpecificData['prospect'];
      callDetails?: Partial<ReferenceSpecificData['callDetails']>;
      urgency?: 'standard' | 'high' | 'critical';
      customMessage?: string;
    }
  ): Promise<{
    success: boolean;
    email?: {
      subject: string;
      bodyHtml: string;
      bodyText: string;
      recipients: string[];
    };
    readiness?: ReadinessAssessment;
    error?: string;
  }> {
    // First assess readiness
    const readiness = await this.assessReadiness(customerId);

    if (!readiness.eligible) {
      return {
        success: false,
        readiness,
        error: `Customer not eligible for reference request: ${readiness.reasons.filter(r => r.includes('Below') || r.includes('Too') || r.includes('active')).join(', ')}`,
      };
    }

    // Get customer details
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, industry, arr, health_score, created_at')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: 'Customer not found' };
    }

    const createdAt = new Date(customer.created_at);
    const durationMonths = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30));

    // Generate appropriate email template
    if (options.prospect) {
      // Specific prospect reference request
      const emailData: ReferenceSpecificData = {
        customer: {
          id: customer.id,
          name: customer.name,
          industry: customer.industry || 'Technology',
          arr: customer.arr || 0,
          healthScore: customer.health_score || 0,
          durationMonths,
        },
        stakeholder: {
          name: options.stakeholderName,
          email: options.stakeholderEmail,
          title: options.stakeholderTitle,
        },
        csm: {
          name: options.csmName,
          email: options.csmEmail,
          title: options.csmTitle,
        },
        prospect: options.prospect,
        callDetails: {
          duration: options.callDetails?.duration || '30 minutes',
          format: options.callDetails?.format || 'either',
          topics: options.callDetails?.topics || [
            'Your experience with our platform',
            'Results and ROI achieved',
            'Implementation journey',
          ],
          proposedDate: options.callDetails?.proposedDate,
        },
        wins: readiness.wins,
        urgency: options.urgency,
        customMessage: options.customMessage,
      };

      const email = generateReferenceSpecificEmail(emailData);
      return { success: true, email, readiness };
    } else {
      // General reference program request
      const emailData: ReferenceRequestData = {
        customer: {
          id: customer.id,
          name: customer.name,
          industry: customer.industry || 'Technology',
          arr: customer.arr || 0,
          healthScore: customer.health_score || 0,
          durationMonths,
        },
        stakeholder: {
          name: options.stakeholderName,
          email: options.stakeholderEmail,
          title: options.stakeholderTitle,
        },
        csm: {
          name: options.csmName,
          email: options.csmEmail,
          title: options.csmTitle,
        },
        wins: readiness.wins,
        referenceProgram: {
          name: 'Customer Reference Program',
          benefits: [
            'Early access to new features and beta programs',
            'Direct input into our product roadmap',
            'Exclusive networking events with other customer leaders',
            'Annual thank-you gift',
          ],
          frequency: 'occasional',
        },
        customMessage: options.customMessage,
      };

      const email = generateReferenceRequestEmail(emailData);
      return { success: true, email, readiness };
    }
  },

  /**
   * Get reference pool with stats
   */
  async getReferencePool(options: {
    activeOnly?: boolean;
    availableOnly?: boolean;
    industry?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    references: CustomerReference[];
    stats: ReferencePoolStats;
    total: number;
  }> {
    if (!supabase) {
      return {
        references: [],
        stats: {
          totalReferences: 0,
          activeReferences: 0,
          availableReferences: 0,
          totalCallsThisMonth: 0,
          totalCallsAllTime: 0,
          averageRating: 0,
          topIndustries: [],
          topTopics: [],
        },
        total: 0,
      };
    }

    const { activeOnly = true, availableOnly = false, industry, limit = 50, offset = 0 } = options;

    // Build query for references
    let query = supabase
      .from('customer_references')
      .select(`
        *,
        customers (id, name, industry)
      `, { count: 'exact' });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (availableOnly) {
      query = query.eq('availability_status', 'available');
    }

    if (industry) {
      query = query.contains('industries', [industry]);
    }

    query = query
      .order('average_rating', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data: referencesData, count, error } = await query;

    if (error) {
      console.error('Error fetching reference pool:', error);
      return {
        references: [],
        stats: {
          totalReferences: 0,
          activeReferences: 0,
          availableReferences: 0,
          totalCallsThisMonth: 0,
          totalCallsAllTime: 0,
          averageRating: 0,
          topIndustries: [],
          topTopics: [],
        },
        total: 0,
      };
    }

    // Get stats
    const { count: totalCount } = await supabase
      .from('customer_references')
      .select('*', { count: 'exact', head: true });

    const { count: activeCount } = await supabase
      .from('customer_references')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: availableCount } = await supabase
      .from('customer_references')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('availability_status', 'available');

    // Get calls stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCallCount } = await supabase
      .from('reference_calls')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    const { data: totalCallsData } = await supabase
      .from('customer_references')
      .select('total_calls_completed');

    const totalCallsAllTime = (totalCallsData || []).reduce(
      (sum, r) => sum + (r.total_calls_completed || 0),
      0
    );

    // Calculate average rating
    const { data: ratingsData } = await supabase
      .from('customer_references')
      .select('average_rating')
      .not('average_rating', 'is', null);

    const ratings = (ratingsData || []).map(r => r.average_rating).filter(r => r !== null);
    const averageRating = ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
      : 0;

    // Aggregate industries and topics
    const industryMap: Record<string, number> = {};
    const topicMap: Record<string, number> = {};

    for (const ref of referencesData || []) {
      for (const ind of ref.industries || []) {
        industryMap[ind] = (industryMap[ind] || 0) + 1;
      }
      for (const topic of ref.topics || []) {
        topicMap[topic] = (topicMap[topic] || 0) + 1;
      }
    }

    const topIndustries = Object.entries(industryMap)
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topTopics = Object.entries(topicMap)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Transform references
    const references: CustomerReference[] = (referencesData || []).map(ref => ({
      id: ref.id,
      customerId: ref.customer_id,
      customerName: ref.customers?.name,
      stakeholderName: ref.stakeholder_name,
      stakeholderEmail: ref.stakeholder_email,
      stakeholderTitle: ref.stakeholder_title,
      isActive: ref.is_active,
      availabilityStatus: ref.availability_status,
      maxCallsPerMonth: ref.max_calls_per_month,
      currentMonthCalls: ref.current_month_calls,
      preferredFormat: ref.preferred_format,
      preferredDuration: ref.preferred_duration,
      topics: ref.topics || [],
      industries: ref.industries || [],
      totalCallsCompleted: ref.total_calls_completed,
      lastCallDate: ref.last_call_date,
      averageRating: ref.average_rating,
      enrolledAt: ref.enrolled_at,
      notes: ref.notes,
    }));

    return {
      references,
      stats: {
        totalReferences: totalCount || 0,
        activeReferences: activeCount || 0,
        availableReferences: availableCount || 0,
        totalCallsThisMonth: monthlyCallCount || 0,
        totalCallsAllTime,
        averageRating,
        topIndustries,
        topTopics,
      },
      total: count || 0,
    };
  },

  /**
   * Match references to a prospect
   */
  async matchReferences(criteria: MatchCriteria): Promise<MatchedReference[]> {
    if (!supabase) {
      return [];
    }

    // Get available references
    let query = supabase
      .from('customer_references')
      .select(`
        *,
        customers (id, name, industry, arr, health_score)
      `)
      .eq('is_active', true)
      .in('availability_status', ['available', 'limited']);

    const { data: references, error } = await query;

    if (error || !references) {
      console.error('Error matching references:', error);
      return [];
    }

    // Score and filter references
    const matchedReferences: MatchedReference[] = [];

    for (const ref of references) {
      let matchScore = 0;
      const matchReasons: string[] = [];

      // Check if under monthly limit
      if (ref.current_month_calls >= ref.max_calls_per_month) {
        continue; // Skip - at capacity
      }

      // Industry match (highest weight)
      if (criteria.industry) {
        const refIndustry = ref.customers?.industry?.toLowerCase() || '';
        const refIndustries = (ref.industries || []).map((i: string) => i.toLowerCase());

        if (refIndustry === criteria.industry.toLowerCase() || refIndustries.includes(criteria.industry.toLowerCase())) {
          matchScore += 40;
          matchReasons.push(`Same industry: ${criteria.industry}`);
        }
      }

      // Topic match
      if (criteria.topics && criteria.topics.length > 0) {
        const refTopics = (ref.topics || []).map((t: string) => t.toLowerCase());
        const matchingTopics = criteria.topics.filter(t => refTopics.includes(t.toLowerCase()));

        if (matchingTopics.length > 0) {
          matchScore += 10 * matchingTopics.length;
          matchReasons.push(`Matching topics: ${matchingTopics.join(', ')}`);
        }
      }

      // Format preference match
      if (criteria.preferredFormat && criteria.preferredFormat !== 'either') {
        if (ref.preferred_format === criteria.preferredFormat || ref.preferred_format === 'either') {
          matchScore += 10;
          matchReasons.push(`Format compatible: ${criteria.preferredFormat}`);
        }
      }

      // Availability bonus
      if (ref.availability_status === 'available') {
        matchScore += 15;
        matchReasons.push('Fully available');
      }

      // Rating bonus
      if (ref.average_rating && ref.average_rating >= 4.5) {
        matchScore += 20;
        matchReasons.push(`High-rated reference: ${ref.average_rating}/5`);
      } else if (ref.average_rating && ref.average_rating >= 4.0) {
        matchScore += 10;
        matchReasons.push(`Good rating: ${ref.average_rating}/5`);
      }

      // Experience bonus (total calls completed)
      if (ref.total_calls_completed >= 5) {
        matchScore += 15;
        matchReasons.push(`Experienced: ${ref.total_calls_completed} calls completed`);
      } else if (ref.total_calls_completed >= 2) {
        matchScore += 5;
        matchReasons.push(`${ref.total_calls_completed} previous calls`);
      }

      // Only include references with at least some match
      if (matchScore > 0 || !criteria.industry) {
        matchedReferences.push({
          id: ref.id,
          customerId: ref.customer_id,
          customerName: ref.customers?.name,
          stakeholderName: ref.stakeholder_name,
          stakeholderEmail: ref.stakeholder_email,
          stakeholderTitle: ref.stakeholder_title,
          isActive: ref.is_active,
          availabilityStatus: ref.availability_status,
          maxCallsPerMonth: ref.max_calls_per_month,
          currentMonthCalls: ref.current_month_calls,
          preferredFormat: ref.preferred_format,
          preferredDuration: ref.preferred_duration,
          topics: ref.topics || [],
          industries: ref.industries || [],
          totalCallsCompleted: ref.total_calls_completed,
          lastCallDate: ref.last_call_date,
          averageRating: ref.average_rating,
          enrolledAt: ref.enrolled_at,
          notes: ref.notes,
          matchScore,
          matchReasons,
        });
      }
    }

    // Sort by match score descending
    return matchedReferences.sort((a, b) => b.matchScore - a.matchScore);
  },

  /**
   * Create a reference call request
   */
  async createReferenceCall(params: {
    referenceId: string;
    prospectCompany: string;
    prospectContactName?: string;
    prospectContactEmail?: string;
    prospectIndustry?: string;
    scheduledAt?: string;
    callFormat?: 'phone' | 'video';
  }): Promise<{ success: boolean; call?: ReferenceCall; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Get reference and verify availability
    const { data: reference, error: refError } = await supabase
      .from('customer_references')
      .select('*, customers (id)')
      .eq('id', params.referenceId)
      .single();

    if (refError || !reference) {
      return { success: false, error: 'Reference not found' };
    }

    if (!reference.is_active) {
      return { success: false, error: 'Reference is not active' };
    }

    if (reference.current_month_calls >= reference.max_calls_per_month) {
      return { success: false, error: 'Reference has reached monthly call limit' };
    }

    // Create the call record
    const { data: call, error: callError } = await supabase
      .from('reference_calls')
      .insert({
        reference_id: params.referenceId,
        customer_id: reference.customer_id,
        prospect_company: params.prospectCompany,
        prospect_contact_name: params.prospectContactName,
        prospect_contact_email: params.prospectContactEmail,
        prospect_industry: params.prospectIndustry,
        call_status: params.scheduledAt ? 'scheduled' : 'requested',
        scheduled_at: params.scheduledAt,
        call_format: params.callFormat,
      })
      .select()
      .single();

    if (callError) {
      return { success: false, error: callError.message };
    }

    // Update current month calls count
    await supabase
      .from('customer_references')
      .update({
        current_month_calls: reference.current_month_calls + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.referenceId);

    return {
      success: true,
      call: {
        id: call.id,
        referenceId: call.reference_id,
        customerId: call.customer_id,
        prospectCompany: call.prospect_company,
        prospectContactName: call.prospect_contact_name,
        prospectContactEmail: call.prospect_contact_email,
        prospectIndustry: call.prospect_industry,
        callStatus: call.call_status,
        scheduledAt: call.scheduled_at,
        completedAt: call.completed_at,
        durationMinutes: call.duration_minutes,
        callFormat: call.call_format,
        referenceRating: call.reference_rating,
        prospectRating: call.prospect_rating,
        referenceFeedback: call.reference_feedback,
        prospectFeedback: call.prospect_feedback,
        outcome: call.outcome,
        dealInfluenced: call.deal_influenced,
        dealValue: call.deal_value,
        createdAt: call.created_at,
      },
    };
  },

  /**
   * Update reference call status
   */
  async updateCallStatus(
    callId: string,
    status: CallStatus,
    metadata?: {
      completedAt?: string;
      durationMinutes?: number;
      referenceRating?: number;
      prospectRating?: number;
      referenceFeedback?: string;
      prospectFeedback?: string;
      outcome?: CallOutcome;
      dealInfluenced?: boolean;
      dealValue?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const updates: Record<string, unknown> = {
      call_status: status,
      updated_at: new Date().toISOString(),
    };

    if (metadata) {
      if (metadata.completedAt) updates.completed_at = metadata.completedAt;
      if (metadata.durationMinutes) updates.duration_minutes = metadata.durationMinutes;
      if (metadata.referenceRating) updates.reference_rating = metadata.referenceRating;
      if (metadata.prospectRating) updates.prospect_rating = metadata.prospectRating;
      if (metadata.referenceFeedback) updates.reference_feedback = metadata.referenceFeedback;
      if (metadata.prospectFeedback) updates.prospect_feedback = metadata.prospectFeedback;
      if (metadata.outcome) updates.outcome = metadata.outcome;
      if (metadata.dealInfluenced !== undefined) updates.deal_influenced = metadata.dealInfluenced;
      if (metadata.dealValue) updates.deal_value = metadata.dealValue;
    }

    const { error } = await supabase
      .from('reference_calls')
      .update(updates)
      .eq('id', callId);

    if (error) {
      return { success: false, error: error.message };
    }

    // If completed, update reference stats
    if (status === 'completed') {
      const { data: call } = await supabase
        .from('reference_calls')
        .select('reference_id')
        .eq('id', callId)
        .single();

      if (call) {
        // Get all completed calls for this reference to recalculate average
        const { data: allCalls } = await supabase
          .from('reference_calls')
          .select('prospect_rating')
          .eq('reference_id', call.reference_id)
          .eq('call_status', 'completed')
          .not('prospect_rating', 'is', null);

        const ratings = (allCalls || []).map(c => c.prospect_rating).filter(r => r !== null);
        const avgRating = ratings.length > 0
          ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 100) / 100
          : null;

        await supabase
          .from('customer_references')
          .update({
            total_calls_completed: ratings.length,
            last_call_date: new Date().toISOString(),
            average_rating: avgRating,
            updated_at: new Date().toISOString(),
          })
          .eq('id', call.reference_id);
      }
    }

    return { success: true };
  },

  /**
   * Get customer reference status
   */
  async getCustomerReferenceStatus(customerId: string): Promise<{
    isReference: boolean;
    reference?: CustomerReference;
    calls: ReferenceCall[];
    stats: {
      totalCalls: number;
      completedCalls: number;
      averageRating: number | null;
      lastCallDate: string | null;
      dealsInfluenced: number;
      totalDealValue: number;
    };
  }> {
    if (!supabase) {
      return {
        isReference: false,
        calls: [],
        stats: {
          totalCalls: 0,
          completedCalls: 0,
          averageRating: null,
          lastCallDate: null,
          dealsInfluenced: 0,
          totalDealValue: 0,
        },
      };
    }

    // Get reference record
    const { data: refData } = await supabase
      .from('customer_references')
      .select('*')
      .eq('customer_id', customerId)
      .limit(1);

    const reference = refData?.[0];

    // Get all calls
    const { data: callsData } = await supabase
      .from('reference_calls')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const calls: ReferenceCall[] = (callsData || []).map(call => ({
      id: call.id,
      referenceId: call.reference_id,
      customerId: call.customer_id,
      prospectCompany: call.prospect_company,
      prospectContactName: call.prospect_contact_name,
      prospectContactEmail: call.prospect_contact_email,
      prospectIndustry: call.prospect_industry,
      callStatus: call.call_status,
      scheduledAt: call.scheduled_at,
      completedAt: call.completed_at,
      durationMinutes: call.duration_minutes,
      callFormat: call.call_format,
      referenceRating: call.reference_rating,
      prospectRating: call.prospect_rating,
      referenceFeedback: call.reference_feedback,
      prospectFeedback: call.prospect_feedback,
      outcome: call.outcome,
      dealInfluenced: call.deal_influenced,
      dealValue: call.deal_value,
      createdAt: call.created_at,
    }));

    // Calculate stats
    const completedCalls = calls.filter(c => c.callStatus === 'completed');
    const ratings = completedCalls.map(c => c.prospectRating).filter((r): r is number => r !== null && r !== undefined);
    const dealsInfluenced = calls.filter(c => c.dealInfluenced).length;
    const totalDealValue = calls
      .filter(c => c.dealInfluenced && c.dealValue)
      .reduce((sum, c) => sum + (c.dealValue || 0), 0);

    return {
      isReference: !!reference,
      reference: reference ? {
        id: reference.id,
        customerId: reference.customer_id,
        stakeholderName: reference.stakeholder_name,
        stakeholderEmail: reference.stakeholder_email,
        stakeholderTitle: reference.stakeholder_title,
        isActive: reference.is_active,
        availabilityStatus: reference.availability_status,
        maxCallsPerMonth: reference.max_calls_per_month,
        currentMonthCalls: reference.current_month_calls,
        preferredFormat: reference.preferred_format,
        preferredDuration: reference.preferred_duration,
        topics: reference.topics || [],
        industries: reference.industries || [],
        totalCallsCompleted: reference.total_calls_completed,
        lastCallDate: reference.last_call_date,
        averageRating: reference.average_rating,
        enrolledAt: reference.enrolled_at,
        notes: reference.notes,
      } : undefined,
      calls,
      stats: {
        totalCalls: calls.length,
        completedCalls: completedCalls.length,
        averageRating: ratings.length > 0
          ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
          : null,
        lastCallDate: completedCalls[0]?.completedAt || null,
        dealsInfluenced,
        totalDealValue,
      },
    };
  },

  /**
   * Enroll customer in reference program
   */
  async enrollInReferenceProgram(params: {
    customerId: string;
    stakeholderName: string;
    stakeholderEmail: string;
    stakeholderTitle?: string;
    preferredFormat?: 'phone' | 'video' | 'either';
    preferredDuration?: '15min' | '30min' | '45min' | '60min';
    topics?: string[];
    industries?: string[];
    maxCallsPerMonth?: number;
    notes?: string;
  }): Promise<{ success: boolean; reference?: CustomerReference; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, industry')
      .eq('id', params.customerId)
      .single();

    if (customerError || !customer) {
      return { success: false, error: 'Customer not found' };
    }

    // Default industries to customer's industry if not specified
    const industries = params.industries || (customer.industry ? [customer.industry] : []);

    const { data, error } = await supabase
      .from('customer_references')
      .upsert({
        customer_id: params.customerId,
        stakeholder_name: params.stakeholderName,
        stakeholder_email: params.stakeholderEmail,
        stakeholder_title: params.stakeholderTitle,
        is_active: true,
        availability_status: 'available',
        preferred_format: params.preferredFormat || 'either',
        preferred_duration: params.preferredDuration || '30min',
        topics: params.topics || [],
        industries,
        max_calls_per_month: params.maxCallsPerMonth || MAX_CALLS_PER_MONTH_DEFAULT,
        notes: params.notes,
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id,stakeholder_email',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Update customer advocacy status
    await supabase
      .from('customers')
      .update({
        advocacy_status: 'reference',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.customerId);

    return {
      success: true,
      reference: {
        id: data.id,
        customerId: data.customer_id,
        stakeholderName: data.stakeholder_name,
        stakeholderEmail: data.stakeholder_email,
        stakeholderTitle: data.stakeholder_title,
        isActive: data.is_active,
        availabilityStatus: data.availability_status,
        maxCallsPerMonth: data.max_calls_per_month,
        currentMonthCalls: data.current_month_calls || 0,
        preferredFormat: data.preferred_format,
        preferredDuration: data.preferred_duration,
        topics: data.topics || [],
        industries: data.industries || [],
        totalCallsCompleted: data.total_calls_completed || 0,
        lastCallDate: data.last_call_date,
        averageRating: data.average_rating,
        enrolledAt: data.enrolled_at,
        notes: data.notes,
      },
    };
  },

  /**
   * Update reference availability
   */
  async updateReferenceAvailability(
    referenceId: string,
    availability: ReferenceAvailability,
    maxCallsPerMonth?: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const updates: Record<string, unknown> = {
      availability_status: availability,
      updated_at: new Date().toISOString(),
    };

    if (availability === 'inactive' || availability === 'declined') {
      updates.is_active = false;
    }

    if (maxCallsPerMonth !== undefined) {
      updates.max_calls_per_month = maxCallsPerMonth;
    }

    const { error } = await supabase
      .from('customer_references')
      .update(updates)
      .eq('id', referenceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  },
};

export default referenceManagerService;
