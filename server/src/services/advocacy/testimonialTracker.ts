/**
 * Testimonial Tracker Service
 * PRD-037: Feedback/Testimonial Request
 *
 * Handles testimonial request lifecycle, tracking, and request fatigue prevention
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  generateTestimonialRequestEmail,
  generateReviewRequestEmail,
  generateReferenceRequestEmail,
  type TestimonialRequestData,
  type ReviewRequestData,
  type ReferenceRequestData,
} from '../../templates/emails/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export type TestimonialRequestType = 'testimonial' | 'quote' | 'review' | 'case_study' | 'reference' | 'video';
export type TestimonialRequestStatus = 'pending' | 'sent' | 'opened' | 'responded' | 'accepted' | 'declined' | 'completed' | 'expired';
export type TestimonialTrigger = 'high_nps' | 'milestone' | 'health_score' | 'manual' | 'qbr_success';
export type AdvocacyReadiness = 'high' | 'medium' | 'low';

export interface TestimonialRequest {
  id: string;
  customerId: string;
  stakeholderEmail: string;
  stakeholderName: string;
  requestType: TestimonialRequestType;
  requestStatus: TestimonialRequestStatus;
  triggerReason?: TestimonialTrigger;
  sentAt?: string;
  respondedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTestimonial {
  id: string;
  customerId: string;
  requestId?: string;
  testimonialType: 'quote' | 'written_testimonial' | 'video' | 'case_study' | 'review' | 'reference_available';
  title?: string;
  content?: string;
  rating?: number;
  sourcePlatform?: string;
  sourceUrl?: string;
  stakeholderName?: string;
  stakeholderTitle?: string;
  approvedForUse: boolean;
  approvedUseCases: string[];
  receivedAt: string;
}

export interface CustomerReference {
  id: string;
  customerId: string;
  stakeholderName: string;
  stakeholderEmail: string;
  stakeholderTitle?: string;
  isActive: boolean;
  availabilityStatus: 'available' | 'busy' | 'limited' | 'inactive' | 'declined';
  maxCallsPerMonth: number;
  currentMonthCalls: number;
  preferredFormat: 'phone' | 'video' | 'either';
  preferredDuration: '15min' | '30min' | '45min' | '60min';
  topics: string[];
  totalCallsCompleted: number;
  lastCallDate?: string;
  averageRating?: number;
  enrolledAt: string;
}

export interface TimingAssessment {
  eligible: boolean;
  score: number;
  signals: {
    healthScore: { value: number; status: 'good' | 'warning' | 'bad' };
    npsScore?: { value: number; status: 'good' | 'warning' | 'bad' };
    daysSinceRequest: { value: number; status: 'good' | 'warning' | 'bad' };
    recentWin?: { description: string; status: 'good' };
    recentQbr?: { date: string; status: 'good' | 'neutral' };
    pendingRequests: { count: number; status: 'good' | 'bad' };
  };
  recommendation: 'proceed' | 'wait' | 'not_recommended';
  recommendedApproach?: string;
  waitDays?: number;
  reasons: string[];
}

export interface AdvocacyReadyCustomer {
  id: string;
  name: string;
  healthScore: number;
  arr: number;
  latestNpsScore?: number;
  daysSinceRequest: number;
  testimonialCount: number;
  activeReferences: number;
  advocacyReadiness: AdvocacyReadiness;
  advocacyStatus: string;
  wins: string[];
}

// Default cooldown period in days
const DEFAULT_COOLDOWN_DAYS = 180;
const MIN_HEALTH_SCORE = 70;
const MIN_NPS_SCORE = 7;

/**
 * Testimonial Tracker Service
 */
export const testimonialTrackerService = {
  /**
   * Assess timing for a testimonial request
   */
  async assessTiming(customerId: string): Promise<TimingAssessment> {
    const signals: TimingAssessment['signals'] = {
      healthScore: { value: 0, status: 'bad' },
      daysSinceRequest: { value: 999, status: 'good' },
      pendingRequests: { count: 0, status: 'good' },
    };
    const reasons: string[] = [];
    let score = 0;

    if (!supabase) {
      return {
        eligible: false,
        score: 0,
        signals,
        recommendation: 'not_recommended',
        reasons: ['Database not configured'],
      };
    }

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, health_score, arr, last_testimonial_request')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return {
        eligible: false,
        score: 0,
        signals,
        recommendation: 'not_recommended',
        reasons: ['Customer not found'],
      };
    }

    // Check health score
    signals.healthScore = {
      value: customer.health_score || 0,
      status: customer.health_score >= 80 ? 'good' : customer.health_score >= MIN_HEALTH_SCORE ? 'warning' : 'bad',
    };
    if (customer.health_score >= 80) {
      score += 30;
      reasons.push(`Health Score: ${customer.health_score} (Excellent)`);
    } else if (customer.health_score >= MIN_HEALTH_SCORE) {
      score += 15;
      reasons.push(`Health Score: ${customer.health_score} (Good)`);
    } else {
      reasons.push(`Health Score: ${customer.health_score} (Too low)`);
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
        reasons.push(`NPS: ${latestNps} (Promoter)`);
      } else if (latestNps >= MIN_NPS_SCORE) {
        score += 10;
        reasons.push(`NPS: ${latestNps} (Passive)`);
      } else {
        reasons.push(`NPS: ${latestNps} (Too low)`);
      }
    }

    // Check days since last request
    let daysSinceRequest = 999;
    if (customer.last_testimonial_request) {
      const lastRequest = new Date(customer.last_testimonial_request);
      daysSinceRequest = Math.floor((Date.now() - lastRequest.getTime()) / (1000 * 60 * 60 * 24));
    }
    signals.daysSinceRequest = {
      value: daysSinceRequest,
      status: daysSinceRequest >= DEFAULT_COOLDOWN_DAYS ? 'good' : daysSinceRequest >= 90 ? 'warning' : 'bad',
    };
    if (daysSinceRequest >= DEFAULT_COOLDOWN_DAYS) {
      score += 20;
      reasons.push(`No testimonial request in past ${Math.floor(daysSinceRequest / 30)} months`);
    } else if (daysSinceRequest >= 90) {
      score += 5;
      reasons.push(`Last request was ${daysSinceRequest} days ago`);
    } else {
      reasons.push(`Last request was only ${daysSinceRequest} days ago`);
    }

    // Check pending requests
    const { count: pendingCount } = await supabase
      .from('testimonial_requests')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .in('request_status', ['pending', 'sent', 'opened']);

    signals.pendingRequests = {
      count: pendingCount || 0,
      status: (pendingCount || 0) === 0 ? 'good' : 'bad',
    };
    if ((pendingCount || 0) > 0) {
      reasons.push(`Pending request exists`);
    }

    // Check for recent wins (from QBRs)
    const { data: qbrData } = await supabase
      .from('qbrs')
      .select('quarter, year, wins')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (qbrData?.[0]?.wins && qbrData[0].wins.length > 0) {
      const recentWin = qbrData[0].wins[0];
      signals.recentWin = { description: recentWin, status: 'good' };
      score += 15;
      reasons.push(`Recent win: ${recentWin}`);

      signals.recentQbr = {
        date: `${qbrData[0].quarter} ${qbrData[0].year}`,
        status: 'good',
      };
      reasons.push(`Recent positive QBR`);
    }

    // Determine recommendation
    const eligible = (
      signals.healthScore.status !== 'bad' &&
      signals.daysSinceRequest.status !== 'bad' &&
      signals.pendingRequests.count === 0 &&
      (signals.npsScore?.status !== 'bad' || signals.npsScore === undefined)
    );

    let recommendation: TimingAssessment['recommendation'] = 'not_recommended';
    let recommendedApproach: string | undefined;
    let waitDays: number | undefined;

    if (eligible && score >= 60) {
      recommendation = 'proceed';
      recommendedApproach = 'Multi-option request';
    } else if (eligible && score >= 40) {
      recommendation = 'proceed';
      recommendedApproach = 'Low-effort options (quote or review)';
    } else if (signals.daysSinceRequest.value < DEFAULT_COOLDOWN_DAYS) {
      recommendation = 'wait';
      waitDays = DEFAULT_COOLDOWN_DAYS - signals.daysSinceRequest.value;
    } else {
      recommendation = 'not_recommended';
    }

    return {
      eligible,
      score,
      signals,
      recommendation,
      recommendedApproach,
      waitDays,
      reasons,
    };
  },

  /**
   * Create a testimonial request
   */
  async createRequest(params: {
    customerId: string;
    stakeholderEmail: string;
    stakeholderName: string;
    requestType: TestimonialRequestType;
    triggerReason?: TestimonialTrigger;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; request?: TestimonialRequest; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { data, error } = await supabase
      .from('testimonial_requests')
      .insert({
        customer_id: params.customerId,
        stakeholder_email: params.stakeholderEmail,
        stakeholder_name: params.stakeholderName,
        request_type: params.requestType,
        request_status: 'pending',
        trigger_reason: params.triggerReason,
        metadata: params.metadata || {},
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      request: transformTestimonialRequest(data),
    };
  },

  /**
   * Mark request as sent
   */
  async markRequestSent(requestId: string, emailData: {
    subject: string;
    messageId?: string;
    threadId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('testimonial_requests')
      .update({
        request_status: 'sent',
        sent_at: new Date().toISOString(),
        email_subject: emailData.subject,
        email_message_id: emailData.messageId,
        gmail_thread_id: emailData.threadId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Update request status
   */
  async updateRequestStatus(
    requestId: string,
    status: TestimonialRequestStatus,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const updates: Record<string, any> = {
      request_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'responded') {
      updates.responded_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    if (metadata) {
      // Merge with existing metadata
      const { data: existing } = await supabase
        .from('testimonial_requests')
        .select('metadata')
        .eq('id', requestId)
        .single();

      updates.metadata = { ...(existing?.metadata || {}), ...metadata };
    }

    const { error } = await supabase
      .from('testimonial_requests')
      .update(updates)
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Record a received testimonial
   */
  async recordTestimonial(params: {
    customerId: string;
    requestId?: string;
    testimonialType: CustomerTestimonial['testimonialType'];
    title?: string;
    content: string;
    rating?: number;
    sourcePlatform?: string;
    sourceUrl?: string;
    stakeholderName?: string;
    stakeholderTitle?: string;
    approvedUseCases?: string[];
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; testimonial?: CustomerTestimonial; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { data, error } = await supabase
      .from('customer_testimonials')
      .insert({
        customer_id: params.customerId,
        request_id: params.requestId,
        testimonial_type: params.testimonialType,
        title: params.title,
        content: params.content,
        rating: params.rating,
        source_platform: params.sourcePlatform,
        source_url: params.sourceUrl,
        stakeholder_name: params.stakeholderName,
        stakeholder_title: params.stakeholderTitle,
        approved_for_use: false,
        approved_use_cases: params.approvedUseCases || [],
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Update the request status if linked
    if (params.requestId) {
      await this.updateRequestStatus(params.requestId, 'completed');
    }

    return {
      success: true,
      testimonial: transformCustomerTestimonial(data),
    };
  },

  /**
   * Enroll customer in reference program
   */
  async enrollReference(params: {
    customerId: string;
    stakeholderName: string;
    stakeholderEmail: string;
    stakeholderTitle?: string;
    preferredFormat?: 'phone' | 'video' | 'either';
    preferredDuration?: '15min' | '30min' | '45min' | '60min';
    topics?: string[];
    maxCallsPerMonth?: number;
  }): Promise<{ success: boolean; reference?: CustomerReference; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

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
        max_calls_per_month: params.maxCallsPerMonth || 2,
      }, {
        onConflict: 'customer_id,stakeholder_email',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      reference: transformCustomerReference(data),
    };
  },

  /**
   * Get advocacy status for a customer
   */
  async getAdvocacyStatus(customerId: string): Promise<{
    requests: TestimonialRequest[];
    testimonials: CustomerTestimonial[];
    references: CustomerReference[];
    summary: {
      totalRequests: number;
      pendingRequests: number;
      totalTestimonials: number;
      activeReferences: number;
      advocacyStatus: string;
      lastRequestDate?: string;
    };
  }> {
    if (!supabase) {
      return {
        requests: [],
        testimonials: [],
        references: [],
        summary: {
          totalRequests: 0,
          pendingRequests: 0,
          totalTestimonials: 0,
          activeReferences: 0,
          advocacyStatus: 'none',
        },
      };
    }

    // Get requests
    const { data: requestsData } = await supabase
      .from('testimonial_requests')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    // Get testimonials
    const { data: testimonialsData } = await supabase
      .from('customer_testimonials')
      .select('*')
      .eq('customer_id', customerId)
      .order('received_at', { ascending: false });

    // Get references
    const { data: referencesData } = await supabase
      .from('customer_references')
      .select('*')
      .eq('customer_id', customerId);

    // Get customer advocacy status
    const { data: customer } = await supabase
      .from('customers')
      .select('advocacy_status, last_testimonial_request')
      .eq('id', customerId)
      .single();

    const requests = (requestsData || []).map(transformTestimonialRequest);
    const testimonials = (testimonialsData || []).map(transformCustomerTestimonial);
    const references = (referencesData || []).map(transformCustomerReference);

    return {
      requests,
      testimonials,
      references,
      summary: {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => ['pending', 'sent', 'opened'].includes(r.requestStatus)).length,
        totalTestimonials: testimonials.length,
        activeReferences: references.filter(r => r.isActive).length,
        advocacyStatus: customer?.advocacy_status || 'none',
        lastRequestDate: customer?.last_testimonial_request,
      },
    };
  },

  /**
   * Get customers ready for advocacy requests
   */
  async getAdvocacyReadyCustomers(options: {
    minReadiness?: AdvocacyReadiness;
    limit?: number;
  } = {}): Promise<AdvocacyReadyCustomer[]> {
    if (!supabase) {
      return [];
    }

    const { minReadiness = 'medium', limit = 20 } = options;

    // Use the view we created
    let query = supabase
      .from('advocacy_ready_customers')
      .select('*');

    if (minReadiness === 'high') {
      query = query.eq('advocacy_readiness', 'high');
    } else if (minReadiness === 'medium') {
      query = query.in('advocacy_readiness', ['high', 'medium']);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching advocacy ready customers:', error);

      // Fallback query if view doesn't exist
      const { data: fallbackData } = await supabase
        .from('customers')
        .select('id, name, health_score, arr, last_testimonial_request, advocacy_status')
        .gte('health_score', MIN_HEALTH_SCORE)
        .not('stage', 'in', '("churned","at_risk")')
        .order('health_score', { ascending: false })
        .limit(limit);

      if (fallbackData) {
        return fallbackData.map(c => ({
          id: c.id,
          name: c.name,
          healthScore: c.health_score || 0,
          arr: c.arr || 0,
          daysSinceRequest: c.last_testimonial_request
            ? Math.floor((Date.now() - new Date(c.last_testimonial_request).getTime()) / (1000 * 60 * 60 * 24))
            : 999,
          testimonialCount: 0,
          activeReferences: 0,
          advocacyReadiness: c.health_score >= 80 ? 'high' : 'medium',
          advocacyStatus: c.advocacy_status || 'none',
          wins: [],
        }));
      }

      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      healthScore: c.health_score || 0,
      arr: c.arr || 0,
      latestNpsScore: c.latest_nps_score,
      daysSinceRequest: c.days_since_request || 999,
      testimonialCount: c.testimonial_count || 0,
      activeReferences: c.active_references || 0,
      advocacyReadiness: c.advocacy_readiness as AdvocacyReadiness,
      advocacyStatus: c.advocacy_status || 'none',
      wins: [], // Would need to join with QBRs to get this
    }));
  },

  /**
   * Generate testimonial request email
   */
  generateTestimonialEmail(data: TestimonialRequestData) {
    return generateTestimonialRequestEmail(data);
  },

  /**
   * Generate review request email
   */
  generateReviewEmail(data: ReviewRequestData) {
    return generateReviewRequestEmail(data);
  },

  /**
   * Generate reference request email
   */
  generateReferenceEmail(data: ReferenceRequestData) {
    return generateReferenceRequestEmail(data);
  },
};

// Transform functions
function transformTestimonialRequest(data: any): TestimonialRequest {
  return {
    id: data.id,
    customerId: data.customer_id,
    stakeholderEmail: data.stakeholder_email,
    stakeholderName: data.stakeholder_name,
    requestType: data.request_type,
    requestStatus: data.request_status,
    triggerReason: data.trigger_reason,
    sentAt: data.sent_at,
    respondedAt: data.responded_at,
    completedAt: data.completed_at,
    expiresAt: data.expires_at,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformCustomerTestimonial(data: any): CustomerTestimonial {
  return {
    id: data.id,
    customerId: data.customer_id,
    requestId: data.request_id,
    testimonialType: data.testimonial_type,
    title: data.title,
    content: data.content,
    rating: data.rating,
    sourcePlatform: data.source_platform,
    sourceUrl: data.source_url,
    stakeholderName: data.stakeholder_name,
    stakeholderTitle: data.stakeholder_title,
    approvedForUse: data.approved_for_use,
    approvedUseCases: data.approved_use_cases || [],
    receivedAt: data.received_at,
  };
}

function transformCustomerReference(data: any): CustomerReference {
  return {
    id: data.id,
    customerId: data.customer_id,
    stakeholderName: data.stakeholder_name,
    stakeholderEmail: data.stakeholder_email,
    stakeholderTitle: data.stakeholder_title,
    isActive: data.is_active,
    availabilityStatus: data.availability_status,
    maxCallsPerMonth: data.max_calls_per_month,
    currentMonthCalls: data.current_month_calls,
    preferredFormat: data.preferred_format,
    preferredDuration: data.preferred_duration,
    topics: data.topics || [],
    totalCallsCompleted: data.total_calls_completed,
    lastCallDate: data.last_call_date,
    averageRating: data.average_rating,
    enrolledAt: data.enrolled_at,
  };
}

export default testimonialTrackerService;
