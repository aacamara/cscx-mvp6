/**
 * PRD-129: Reference Needed -> Match + Request
 * Service for reference matching, eligibility assessment, and request coordination
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// TYPES
// ============================================

export type ReferenceRequestType = 'sales' | 'marketing' | 'analyst' | 'other';
export type ReferenceRequestStatus =
  | 'pending_match'
  | 'pending_approval'
  | 'pending_request'
  | 'awaiting_response'
  | 'scheduled'
  | 'completed'
  | 'cancelled';
export type ReferenceFormat = 'call' | 'case_study' | 'video' | 'any';
export type CSMApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ReferenceRequirements {
  industry: string[];
  useCase: string[];
  companySize: string;
  features: string[];
  geography: string[];
  format: ReferenceFormat;
}

interface RequestSubmitter {
  id: string;
  name: string;
  email: string;
  team?: string;
  dealId?: string;
  dealName?: string;
}

interface EligibilityFactor {
  factor: string;
  status: 'pass' | 'warning' | 'fail';
  value: string | number;
  threshold?: string | number;
  weight: number;
  description: string;
}

interface ReferenceMatch {
  id: string;
  requestId: string;
  customerId: string;
  customerName: string;
  matchScore: number;
  matchReasons: string[];
  eligibilityScore: number;
  eligibilityFactors: EligibilityFactor[];
  lastReferenceDate: string | null;
  referenceCount: number;
  csmApproval: CSMApprovalStatus;
  csmId?: string;
  csmName?: string;
  csmNotes: string | null;
  approvedAt?: string;
  createdAt: string;
}

interface ReferenceRequest {
  id: string;
  requestType: ReferenceRequestType;
  requestedBy: RequestSubmitter;
  requirements: ReferenceRequirements;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  context?: string;
  matches: ReferenceMatch[];
  status: ReferenceRequestStatus;
  selectedMatchId: string | null;
  outcome: ReferenceOutcome | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface ReferenceOutcome {
  status: 'completed' | 'cancelled' | 'no_response';
  completedDate?: string;
  format?: ReferenceFormat;
  feedbackFromRequester?: string;
  feedbackFromCustomer?: string;
  impactOnDeal?: string;
  qualityScore?: number;
  notes?: string;
}

interface CustomerReferenceProfile {
  customerId: string;
  customerName: string;
  isWilling: boolean;
  willingnessLastUpdated?: string;
  preferredFormats: ReferenceFormat[];
  topicsComfortable: string[];
  topicsToAvoid?: string[];
  availabilityNotes: string;
  preferredContactMethod?: 'email' | 'phone' | 'slack';
  preferredTimezone?: string;
  referenceCount: number;
  lastReferenceDate: string | null;
  maxReferencesPerQuarter: number;
  referencesThisQuarter: number;
  npsScore: number | null;
  healthScore: number | null;
  industry: string;
  companySize: string;
  useCases: string[];
  features: string[];
  geography: string;
  contractStatus: 'active' | 'churning' | 'churned' | 'trial';
  relationshipStrength: number;
  recentSupportIssues: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateRequestInput {
  requestType: ReferenceRequestType;
  requestedBy: RequestSubmitter;
  requirements: ReferenceRequirements;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  context?: string;
}

interface ReferenceRequestDraft {
  matchId: string;
  customerId: string;
  customerName: string;
  contactEmail: string;
  contactName: string;
  subject: string;
  body: string;
  requesterContext: string;
  timeCommitment: string;
  incentive?: string;
}

// ============================================
// CONSTANTS
// ============================================

const ELIGIBILITY_THRESHOLDS = {
  healthScore: 75,
  npsPromoter: 9,
  maxRecentSupportIssues: 0,
  minRelationshipStrength: 60,
  maxReferencesPerQuarter: 2,
};

const MATCH_WEIGHTS = {
  industry: 25,
  useCase: 20,
  companySize: 15,
  features: 15,
  geography: 10,
  referenceHistory: 15,
};

// ============================================
// SUPABASE CLIENT
// ============================================

const supabase: SupabaseClient | null =
  config.supabaseUrl && config.supabaseServiceKey
    ? createClient(config.supabaseUrl, config.supabaseServiceKey)
    : null;

// Claude client for AI-powered email generation
const anthropic = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateMatchId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate match score between requirements and customer profile
 */
function calculateMatchScore(
  requirements: ReferenceRequirements,
  profile: CustomerReferenceProfile
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Industry match (25%)
  const industryMatch = requirements.industry.some(
    ind => profile.industry.toLowerCase().includes(ind.toLowerCase())
  );
  if (industryMatch) {
    score += MATCH_WEIGHTS.industry;
    reasons.push(`Industry match: ${profile.industry}`);
  }

  // Use case match (20%)
  const useCaseMatches = requirements.useCase.filter(uc =>
    profile.useCases.some(puc => puc.toLowerCase().includes(uc.toLowerCase()))
  );
  if (useCaseMatches.length > 0) {
    const useCaseScore = (useCaseMatches.length / requirements.useCase.length) * MATCH_WEIGHTS.useCase;
    score += useCaseScore;
    reasons.push(`Use case matches: ${useCaseMatches.join(', ')}`);
  }

  // Company size match (15%)
  if (requirements.companySize === profile.companySize || requirements.companySize === 'any') {
    score += MATCH_WEIGHTS.companySize;
    reasons.push(`Company size: ${profile.companySize}`);
  }

  // Features match (15%)
  const featureMatches = requirements.features.filter(f =>
    profile.features.some(pf => pf.toLowerCase().includes(f.toLowerCase()))
  );
  if (featureMatches.length > 0) {
    const featureScore = (featureMatches.length / Math.max(requirements.features.length, 1)) * MATCH_WEIGHTS.features;
    score += featureScore;
    reasons.push(`Feature matches: ${featureMatches.join(', ')}`);
  }

  // Geography match (10%)
  const geoMatch = requirements.geography.some(
    geo => profile.geography.toLowerCase().includes(geo.toLowerCase())
  );
  if (geoMatch || requirements.geography.length === 0) {
    score += MATCH_WEIGHTS.geography;
    reasons.push(`Geography: ${profile.geography}`);
  }

  // Reference history (15%) - Penalize if overused
  const referencesPenalty = Math.min(profile.referencesThisQuarter / profile.maxReferencesPerQuarter, 1);
  const historyScore = MATCH_WEIGHTS.referenceHistory * (1 - referencesPenalty);
  score += historyScore;
  if (profile.referenceCount === 0) {
    reasons.push('New reference (not previously used)');
  } else if (referencesPenalty < 0.5) {
    reasons.push('Available for references this quarter');
  }

  return { score: Math.round(score), reasons };
}

/**
 * Assess customer eligibility for reference
 */
function assessEligibility(profile: CustomerReferenceProfile): {
  score: number;
  factors: EligibilityFactor[];
  isEligible: boolean;
} {
  const factors: EligibilityFactor[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // Health Score (weight: 25)
  const healthWeight = 25;
  totalWeight += healthWeight;
  if (profile.healthScore !== null) {
    const healthPass = profile.healthScore >= ELIGIBILITY_THRESHOLDS.healthScore;
    weightedScore += healthPass ? healthWeight : (profile.healthScore / 100) * healthWeight * 0.5;
    factors.push({
      factor: 'Health Score',
      status: healthPass ? 'pass' : profile.healthScore >= 60 ? 'warning' : 'fail',
      value: profile.healthScore,
      threshold: ELIGIBILITY_THRESHOLDS.healthScore,
      weight: healthWeight,
      description: healthPass ? 'Customer is healthy' : 'Health score below threshold',
    });
  } else {
    factors.push({
      factor: 'Health Score',
      status: 'warning',
      value: 'N/A',
      threshold: ELIGIBILITY_THRESHOLDS.healthScore,
      weight: healthWeight,
      description: 'Health score not available',
    });
  }

  // NPS Score (weight: 20)
  const npsWeight = 20;
  totalWeight += npsWeight;
  if (profile.npsScore !== null) {
    const npsPass = profile.npsScore >= ELIGIBILITY_THRESHOLDS.npsPromoter;
    weightedScore += npsPass ? npsWeight : profile.npsScore >= 7 ? npsWeight * 0.5 : 0;
    factors.push({
      factor: 'NPS Score',
      status: npsPass ? 'pass' : profile.npsScore >= 7 ? 'warning' : 'fail',
      value: profile.npsScore,
      threshold: `${ELIGIBILITY_THRESHOLDS.npsPromoter}-10 (Promoter)`,
      weight: npsWeight,
      description: npsPass ? 'Customer is a promoter' : 'Customer is not a promoter',
    });
  } else {
    factors.push({
      factor: 'NPS Score',
      status: 'warning',
      value: 'N/A',
      threshold: `${ELIGIBILITY_THRESHOLDS.npsPromoter}-10`,
      weight: npsWeight,
      description: 'NPS score not available',
    });
  }

  // Contract Status (weight: 20)
  const contractWeight = 20;
  totalWeight += contractWeight;
  const contractPass = profile.contractStatus === 'active';
  weightedScore += contractPass ? contractWeight : 0;
  factors.push({
    factor: 'Contract Status',
    status: contractPass ? 'pass' : 'fail',
    value: profile.contractStatus,
    threshold: 'active',
    weight: contractWeight,
    description: contractPass ? 'Active customer' : 'Customer not active',
  });

  // Recent Support Issues (weight: 15)
  const supportWeight = 15;
  totalWeight += supportWeight;
  const supportPass = profile.recentSupportIssues <= ELIGIBILITY_THRESHOLDS.maxRecentSupportIssues;
  weightedScore += supportPass ? supportWeight : profile.recentSupportIssues <= 2 ? supportWeight * 0.5 : 0;
  factors.push({
    factor: 'Recent Support Issues',
    status: supportPass ? 'pass' : profile.recentSupportIssues <= 2 ? 'warning' : 'fail',
    value: profile.recentSupportIssues,
    threshold: ELIGIBILITY_THRESHOLDS.maxRecentSupportIssues,
    weight: supportWeight,
    description: supportPass ? 'No recent issues' : `${profile.recentSupportIssues} recent issues`,
  });

  // Relationship Strength (weight: 10)
  const relationshipWeight = 10;
  totalWeight += relationshipWeight;
  const relationshipPass = profile.relationshipStrength >= ELIGIBILITY_THRESHOLDS.minRelationshipStrength;
  weightedScore += relationshipPass ? relationshipWeight : (profile.relationshipStrength / 100) * relationshipWeight;
  factors.push({
    factor: 'Relationship Strength',
    status: relationshipPass ? 'pass' : profile.relationshipStrength >= 40 ? 'warning' : 'fail',
    value: profile.relationshipStrength,
    threshold: ELIGIBILITY_THRESHOLDS.minRelationshipStrength,
    weight: relationshipWeight,
    description: relationshipPass ? 'Strong relationship' : 'Relationship needs strengthening',
  });

  // Reference Willingness (weight: 10)
  const willingWeight = 10;
  totalWeight += willingWeight;
  weightedScore += profile.isWilling ? willingWeight : 0;
  factors.push({
    factor: 'Reference Willingness',
    status: profile.isWilling ? 'pass' : 'fail',
    value: profile.isWilling ? 'Yes' : 'No',
    threshold: 'Yes',
    weight: willingWeight,
    description: profile.isWilling ? 'Customer is willing' : 'Customer has not indicated willingness',
  });

  const eligibilityScore = Math.round((weightedScore / totalWeight) * 100);
  const isEligible =
    profile.isWilling &&
    profile.contractStatus === 'active' &&
    (profile.healthScore === null || profile.healthScore >= ELIGIBILITY_THRESHOLDS.healthScore) &&
    profile.recentSupportIssues <= ELIGIBILITY_THRESHOLDS.maxRecentSupportIssues;

  return { score: eligibilityScore, factors, isEligible };
}

// ============================================
// IN-MEMORY STORAGE (fallback)
// ============================================

const inMemoryRequests: Map<string, ReferenceRequest> = new Map();
const inMemoryProfiles: Map<string, CustomerReferenceProfile> = new Map();

// Seed some demo profiles
function seedDemoProfiles(): void {
  const demoProfiles: CustomerReferenceProfile[] = [
    {
      customerId: 'cust_001',
      customerName: 'Acme Corporation',
      isWilling: true,
      preferredFormats: ['call', 'case_study'],
      topicsComfortable: ['ROI', 'Implementation', 'Support quality'],
      availabilityNotes: 'Available Tuesdays and Thursdays',
      referenceCount: 3,
      lastReferenceDate: '2025-11-15',
      maxReferencesPerQuarter: 2,
      referencesThisQuarter: 0,
      npsScore: 9,
      healthScore: 85,
      industry: 'Technology',
      companySize: 'enterprise',
      useCases: ['Customer Success', 'Analytics', 'Automation'],
      features: ['Health Scores', 'NPS Surveys', 'QBR Templates'],
      geography: 'North America',
      contractStatus: 'active',
      relationshipStrength: 80,
      recentSupportIssues: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      customerId: 'cust_002',
      customerName: 'TechStart Inc',
      isWilling: true,
      preferredFormats: ['call'],
      topicsComfortable: ['Onboarding', 'Time to value'],
      availabilityNotes: 'Morning availability only',
      referenceCount: 1,
      lastReferenceDate: '2025-09-20',
      maxReferencesPerQuarter: 2,
      referencesThisQuarter: 0,
      npsScore: 10,
      healthScore: 92,
      industry: 'SaaS',
      companySize: 'mid-market',
      useCases: ['Onboarding', 'Customer Health'],
      features: ['Onboarding Tracker', 'Health Scores'],
      geography: 'North America',
      contractStatus: 'active',
      relationshipStrength: 90,
      recentSupportIssues: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      customerId: 'cust_003',
      customerName: 'Global Finance Ltd',
      isWilling: true,
      preferredFormats: ['case_study', 'video'],
      topicsComfortable: ['Security', 'Compliance', 'Enterprise features'],
      availabilityNotes: 'Requires 2 weeks notice',
      referenceCount: 5,
      lastReferenceDate: '2025-12-01',
      maxReferencesPerQuarter: 2,
      referencesThisQuarter: 1,
      npsScore: 8,
      healthScore: 78,
      industry: 'Financial Services',
      companySize: 'enterprise',
      useCases: ['Risk Management', 'Renewal Tracking'],
      features: ['Risk Dashboard', 'Renewal Forecasting', 'SSO'],
      geography: 'Europe',
      contractStatus: 'active',
      relationshipStrength: 75,
      recentSupportIssues: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      customerId: 'cust_004',
      customerName: 'HealthCare Plus',
      isWilling: false,
      preferredFormats: ['call'],
      topicsComfortable: [],
      availabilityNotes: '',
      referenceCount: 0,
      lastReferenceDate: null,
      maxReferencesPerQuarter: 2,
      referencesThisQuarter: 0,
      npsScore: 7,
      healthScore: 65,
      industry: 'Healthcare',
      companySize: 'enterprise',
      useCases: ['Customer Health'],
      features: ['Health Scores'],
      geography: 'North America',
      contractStatus: 'active',
      relationshipStrength: 55,
      recentSupportIssues: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      customerId: 'cust_005',
      customerName: 'Retail Dynamics',
      isWilling: true,
      preferredFormats: ['video', 'case_study'],
      topicsComfortable: ['Growth story', 'Product adoption', 'Team efficiency'],
      availabilityNotes: 'Flexible schedule',
      referenceCount: 2,
      lastReferenceDate: '2025-08-10',
      maxReferencesPerQuarter: 3,
      referencesThisQuarter: 0,
      npsScore: 10,
      healthScore: 88,
      industry: 'Retail',
      companySize: 'mid-market',
      useCases: ['Adoption Tracking', 'Renewal Management'],
      features: ['Adoption Dashboard', 'Renewal Tracker', 'Email Automation'],
      geography: 'Asia Pacific',
      contractStatus: 'active',
      relationshipStrength: 85,
      recentSupportIssues: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  demoProfiles.forEach(profile => {
    inMemoryProfiles.set(profile.customerId, profile);
  });
}

// Seed on module load
seedDemoProfiles();

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Create a new reference request and trigger matching
 */
export async function createReferenceRequest(input: CreateRequestInput): Promise<{
  request: ReferenceRequest;
  matches: ReferenceMatch[];
}> {
  const requestId = generateId();
  const now = new Date().toISOString();

  const request: ReferenceRequest = {
    id: requestId,
    requestType: input.requestType,
    requestedBy: input.requestedBy,
    requirements: input.requirements,
    urgency: input.urgency || 'medium',
    dueDate: input.dueDate,
    context: input.context,
    matches: [],
    status: 'pending_match',
    selectedMatchId: null,
    outcome: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  // Find and score matches
  const matches = await findMatches(request);
  request.matches = matches;
  request.status = matches.length > 0 ? 'pending_approval' : 'pending_match';

  // Store in database or in-memory
  if (supabase) {
    const { error } = await supabase.from('reference_requests').insert({
      id: request.id,
      request_type: request.requestType,
      requested_by: request.requestedBy,
      requirements: request.requirements,
      urgency: request.urgency,
      due_date: request.dueDate,
      context: request.context,
      status: request.status,
      selected_match_id: null,
      outcome: null,
      created_at: request.createdAt,
      updated_at: request.updatedAt,
      completed_at: null,
    });

    if (error) {
      console.error('[ReferenceMatch] Error creating request:', error);
      throw new Error('Failed to create reference request');
    }

    // Store matches
    for (const match of matches) {
      await supabase.from('reference_matches').insert({
        id: match.id,
        request_id: match.requestId,
        customer_id: match.customerId,
        customer_name: match.customerName,
        match_score: match.matchScore,
        match_reasons: match.matchReasons,
        eligibility_score: match.eligibilityScore,
        eligibility_factors: match.eligibilityFactors,
        last_reference_date: match.lastReferenceDate,
        reference_count: match.referenceCount,
        csm_approval: match.csmApproval,
        csm_notes: null,
        created_at: match.createdAt,
      });
    }
  } else {
    inMemoryRequests.set(request.id, request);
  }

  return { request, matches };
}

/**
 * Find matching customers for a reference request
 */
async function findMatches(request: ReferenceRequest): Promise<ReferenceMatch[]> {
  const profiles = await getEligibleProfiles();
  const matches: ReferenceMatch[] = [];

  for (const profile of profiles) {
    // Calculate match score
    const { score: matchScore, reasons: matchReasons } = calculateMatchScore(
      request.requirements,
      profile
    );

    // Assess eligibility
    const { score: eligibilityScore, factors: eligibilityFactors, isEligible } = assessEligibility(profile);

    // Only include if minimally eligible and has some match
    if (matchScore >= 20 && (isEligible || eligibilityScore >= 60)) {
      matches.push({
        id: generateMatchId(),
        requestId: request.id,
        customerId: profile.customerId,
        customerName: profile.customerName,
        matchScore,
        matchReasons,
        eligibilityScore,
        eligibilityFactors,
        lastReferenceDate: profile.lastReferenceDate,
        referenceCount: profile.referenceCount,
        csmApproval: 'pending',
        csmNotes: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Sort by combined score (match + eligibility)
  matches.sort((a, b) => {
    const scoreA = a.matchScore * 0.6 + a.eligibilityScore * 0.4;
    const scoreB = b.matchScore * 0.6 + b.eligibilityScore * 0.4;
    return scoreB - scoreA;
  });

  // Return top 10 matches
  return matches.slice(0, 10);
}

/**
 * Get eligible customer profiles
 */
async function getEligibleProfiles(): Promise<CustomerReferenceProfile[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('customer_reference_profiles')
      .select('*')
      .eq('contract_status', 'active');

    if (error) {
      console.error('[ReferenceMatch] Error fetching profiles:', error);
      return [];
    }

    return (data || []).map(row => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      isWilling: row.is_willing,
      willingnessLastUpdated: row.willingness_last_updated,
      preferredFormats: row.preferred_formats || [],
      topicsComfortable: row.topics_comfortable || [],
      topicsToAvoid: row.topics_to_avoid,
      availabilityNotes: row.availability_notes || '',
      preferredContactMethod: row.preferred_contact_method,
      preferredTimezone: row.preferred_timezone,
      referenceCount: row.reference_count || 0,
      lastReferenceDate: row.last_reference_date,
      maxReferencesPerQuarter: row.max_references_per_quarter || 2,
      referencesThisQuarter: row.references_this_quarter || 0,
      npsScore: row.nps_score,
      healthScore: row.health_score,
      industry: row.industry || '',
      companySize: row.company_size || '',
      useCases: row.use_cases || [],
      features: row.features || [],
      geography: row.geography || '',
      contractStatus: row.contract_status,
      relationshipStrength: row.relationship_strength || 50,
      recentSupportIssues: row.recent_support_issues || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Return in-memory profiles
  return Array.from(inMemoryProfiles.values());
}

/**
 * Get a reference request by ID
 */
export async function getReferenceRequestById(requestId: string): Promise<ReferenceRequest | null> {
  if (supabase) {
    const { data: requestData, error: requestError } = await supabase
      .from('reference_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      return null;
    }

    const { data: matchesData } = await supabase
      .from('reference_matches')
      .select('*')
      .eq('request_id', requestId)
      .order('match_score', { ascending: false });

    const matches: ReferenceMatch[] = (matchesData || []).map(row => ({
      id: row.id,
      requestId: row.request_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      matchScore: row.match_score,
      matchReasons: row.match_reasons || [],
      eligibilityScore: row.eligibility_score,
      eligibilityFactors: row.eligibility_factors || [],
      lastReferenceDate: row.last_reference_date,
      referenceCount: row.reference_count,
      csmApproval: row.csm_approval,
      csmId: row.csm_id,
      csmName: row.csm_name,
      csmNotes: row.csm_notes,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    }));

    return {
      id: requestData.id,
      requestType: requestData.request_type,
      requestedBy: requestData.requested_by,
      requirements: requestData.requirements,
      urgency: requestData.urgency,
      dueDate: requestData.due_date,
      context: requestData.context,
      matches,
      status: requestData.status,
      selectedMatchId: requestData.selected_match_id,
      outcome: requestData.outcome,
      createdAt: requestData.created_at,
      updatedAt: requestData.updated_at,
      completedAt: requestData.completed_at,
    };
  }

  return inMemoryRequests.get(requestId) || null;
}

/**
 * List reference requests with filters
 */
export async function listReferenceRequests(filters: {
  status?: ReferenceRequestStatus | ReferenceRequestStatus[];
  requestType?: ReferenceRequestType;
  requestedById?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{ requests: ReferenceRequest[]; total: number }> {
  const { limit = 50, offset = 0, sortOrder = 'desc' } = filters;

  if (supabase) {
    let query = supabase.from('reference_requests').select('*', { count: 'exact' });

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.requestType) {
      query = query.eq('request_type', filters.requestType);
    }

    if (filters.requestedById) {
      query = query.eq('requested_by->>id', filters.requestedById);
    }

    query = query.order('created_at', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ReferenceMatch] Error listing requests:', error);
      throw new Error('Failed to list reference requests');
    }

    // Fetch matches for each request
    const requests: ReferenceRequest[] = [];
    for (const row of data || []) {
      const { data: matchesData } = await supabase
        .from('reference_matches')
        .select('*')
        .eq('request_id', row.id);

      const matches: ReferenceMatch[] = (matchesData || []).map(m => ({
        id: m.id,
        requestId: m.request_id,
        customerId: m.customer_id,
        customerName: m.customer_name,
        matchScore: m.match_score,
        matchReasons: m.match_reasons || [],
        eligibilityScore: m.eligibility_score,
        eligibilityFactors: m.eligibility_factors || [],
        lastReferenceDate: m.last_reference_date,
        referenceCount: m.reference_count,
        csmApproval: m.csm_approval,
        csmId: m.csm_id,
        csmName: m.csm_name,
        csmNotes: m.csm_notes,
        approvedAt: m.approved_at,
        createdAt: m.created_at,
      }));

      requests.push({
        id: row.id,
        requestType: row.request_type,
        requestedBy: row.requested_by,
        requirements: row.requirements,
        urgency: row.urgency,
        dueDate: row.due_date,
        context: row.context,
        matches,
        status: row.status,
        selectedMatchId: row.selected_match_id,
        outcome: row.outcome,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      });
    }

    return { requests, total: count || 0 };
  }

  // In-memory fallback
  const allRequests = Array.from(inMemoryRequests.values());
  let filtered = allRequests;

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filtered = filtered.filter(r => filters.status!.includes(r.status));
    } else {
      filtered = filtered.filter(r => r.status === filters.status);
    }
  }

  if (filters.requestType) {
    filtered = filtered.filter(r => r.requestType === filters.requestType);
  }

  filtered.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const total = filtered.length;
  const requests = filtered.slice(offset, offset + limit);

  return { requests, total };
}

/**
 * Get matches for a reference request
 */
export async function getRequestMatches(requestId: string): Promise<{
  request: ReferenceRequest | null;
  matches: ReferenceMatch[];
  stats: {
    totalCustomersScanned: number;
    eligibleCustomers: number;
    topMatchScore: number;
    averageMatchScore: number;
    generatedAt: string;
  };
}> {
  const request = await getReferenceRequestById(requestId);

  if (!request) {
    return {
      request: null,
      matches: [],
      stats: {
        totalCustomersScanned: 0,
        eligibleCustomers: 0,
        topMatchScore: 0,
        averageMatchScore: 0,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const allProfiles = await getEligibleProfiles();
  const matches = request.matches;

  const stats = {
    totalCustomersScanned: allProfiles.length,
    eligibleCustomers: matches.length,
    topMatchScore: matches.length > 0 ? Math.max(...matches.map(m => m.matchScore)) : 0,
    averageMatchScore:
      matches.length > 0
        ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length)
        : 0,
    generatedAt: new Date().toISOString(),
  };

  return { request, matches, stats };
}

/**
 * Approve or reject a match
 */
export async function updateMatchApproval(
  matchId: string,
  csmId: string,
  csmName: string,
  approved: boolean,
  notes?: string
): Promise<{ success: boolean; match?: ReferenceMatch; message?: string }> {
  const now = new Date().toISOString();

  if (supabase) {
    const { data: matchData, error: fetchError } = await supabase
      .from('reference_matches')
      .select('*, reference_requests!inner(*)')
      .eq('id', matchId)
      .single();

    if (fetchError || !matchData) {
      return { success: false, message: 'Match not found' };
    }

    const { error: updateError } = await supabase
      .from('reference_matches')
      .update({
        csm_approval: approved ? 'approved' : 'rejected',
        csm_id: csmId,
        csm_name: csmName,
        csm_notes: notes || null,
        approved_at: now,
      })
      .eq('id', matchId);

    if (updateError) {
      return { success: false, message: 'Failed to update match' };
    }

    // Check if any match is approved to update request status
    const { data: allMatches } = await supabase
      .from('reference_matches')
      .select('csm_approval')
      .eq('request_id', matchData.request_id);

    const hasApproved = (allMatches || []).some(m => m.csm_approval === 'approved');
    if (hasApproved) {
      await supabase
        .from('reference_requests')
        .update({ status: 'pending_request', updated_at: now })
        .eq('id', matchData.request_id);
    }

    return {
      success: true,
      match: {
        ...matchData,
        csmApproval: approved ? 'approved' : 'rejected',
        csmId,
        csmName,
        csmNotes: notes || null,
        approvedAt: now,
      },
    };
  }

  // In-memory fallback
  for (const request of inMemoryRequests.values()) {
    const match = request.matches.find(m => m.id === matchId);
    if (match) {
      match.csmApproval = approved ? 'approved' : 'rejected';
      match.csmId = csmId;
      match.csmName = csmName;
      match.csmNotes = notes || null;
      match.approvedAt = now;

      // Update request status if we have an approved match
      if (approved) {
        request.status = 'pending_request';
      }
      request.updatedAt = now;

      return { success: true, match };
    }
  }

  return { success: false, message: 'Match not found' };
}

/**
 * Generate a personalized reference request email draft
 */
export async function generateRequestDraft(
  matchId: string,
  requesterContext?: string,
  incentive?: string
): Promise<{ success: boolean; draft?: ReferenceRequestDraft; error?: string }> {
  // Find the match
  let match: ReferenceMatch | null = null;
  let request: ReferenceRequest | null = null;
  let profile: CustomerReferenceProfile | null = null;

  if (supabase) {
    const { data: matchData } = await supabase
      .from('reference_matches')
      .select('*, reference_requests!inner(*)')
      .eq('id', matchId)
      .single();

    if (matchData) {
      match = {
        id: matchData.id,
        requestId: matchData.request_id,
        customerId: matchData.customer_id,
        customerName: matchData.customer_name,
        matchScore: matchData.match_score,
        matchReasons: matchData.match_reasons || [],
        eligibilityScore: matchData.eligibility_score,
        eligibilityFactors: matchData.eligibility_factors || [],
        lastReferenceDate: matchData.last_reference_date,
        referenceCount: matchData.reference_count,
        csmApproval: matchData.csm_approval,
        csmNotes: matchData.csm_notes,
        createdAt: matchData.created_at,
      };

      request = {
        id: matchData.reference_requests.id,
        requestType: matchData.reference_requests.request_type,
        requestedBy: matchData.reference_requests.requested_by,
        requirements: matchData.reference_requests.requirements,
        urgency: matchData.reference_requests.urgency,
        dueDate: matchData.reference_requests.due_date,
        context: matchData.reference_requests.context,
        matches: [],
        status: matchData.reference_requests.status,
        selectedMatchId: matchData.reference_requests.selected_match_id,
        outcome: matchData.reference_requests.outcome,
        createdAt: matchData.reference_requests.created_at,
        updatedAt: matchData.reference_requests.updated_at,
        completedAt: matchData.reference_requests.completed_at,
      };

      const { data: profileData } = await supabase
        .from('customer_reference_profiles')
        .select('*')
        .eq('customer_id', matchData.customer_id)
        .single();

      if (profileData) {
        profile = {
          customerId: profileData.customer_id,
          customerName: profileData.customer_name,
          isWilling: profileData.is_willing,
          preferredFormats: profileData.preferred_formats || [],
          topicsComfortable: profileData.topics_comfortable || [],
          availabilityNotes: profileData.availability_notes || '',
          referenceCount: profileData.reference_count || 0,
          lastReferenceDate: profileData.last_reference_date,
          maxReferencesPerQuarter: profileData.max_references_per_quarter || 2,
          referencesThisQuarter: profileData.references_this_quarter || 0,
          npsScore: profileData.nps_score,
          healthScore: profileData.health_score,
          industry: profileData.industry || '',
          companySize: profileData.company_size || '',
          useCases: profileData.use_cases || [],
          features: profileData.features || [],
          geography: profileData.geography || '',
          contractStatus: profileData.contract_status,
          relationshipStrength: profileData.relationship_strength || 50,
          recentSupportIssues: profileData.recent_support_issues || 0,
          createdAt: profileData.created_at,
          updatedAt: profileData.updated_at,
        };
      }
    }
  } else {
    // In-memory fallback
    for (const req of inMemoryRequests.values()) {
      const m = req.matches.find(m => m.id === matchId);
      if (m) {
        match = m;
        request = req;
        profile = inMemoryProfiles.get(m.customerId) || null;
        break;
      }
    }
  }

  if (!match || !request || !profile) {
    return { success: false, error: 'Match not found' };
  }

  // Determine time commitment based on format
  const formatTimeCommitments: Record<ReferenceFormat, string> = {
    call: '30-45 minutes',
    case_study: '1-2 hours over several sessions',
    video: '2-3 hours for filming',
    any: 'varies based on format',
  };

  const timeCommitment = formatTimeCommitments[request.requirements.format];

  // Generate email using Claude if available
  if (anthropic) {
    try {
      const prompt = `Generate a personalized reference request email for a customer.

Customer Details:
- Name: ${profile.customerName}
- Industry: ${profile.industry}
- Topics they're comfortable discussing: ${profile.topicsComfortable.join(', ') || 'general product usage'}

Request Details:
- Requester: ${request.requestedBy.name} from ${request.requestedBy.team || 'Sales'}
- Request type: ${request.requestType}
- Format needed: ${request.requirements.format}
- Use cases of interest: ${request.requirements.useCase.join(', ')}
- Additional context: ${requesterContext || request.context || 'N/A'}

Time commitment: ${timeCommitment}
${incentive ? `Incentive offered: ${incentive}` : ''}

Write a warm, professional email asking if they'd be willing to serve as a reference. The email should:
1. Thank them for being a valued customer
2. Briefly explain what we're asking
3. Mention the time commitment
4. Make it easy to say yes or no
5. Be under 200 words

Return ONLY the email body, no subject line or signature.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const emailBody =
        response.content[0].type === 'text' ? response.content[0].text : 'Error generating email';

      return {
        success: true,
        draft: {
          matchId,
          customerId: profile.customerId,
          customerName: profile.customerName,
          contactEmail: `contact@${profile.customerName.toLowerCase().replace(/\s+/g, '')}.com`,
          contactName: 'Customer Contact',
          subject: `Reference Request - ${request.requestedBy.name} from ${request.requestedBy.team || 'our Sales team'}`,
          body: emailBody,
          requesterContext: requesterContext || request.context || '',
          timeCommitment,
          incentive,
        },
      };
    } catch (error) {
      console.error('[ReferenceMatch] Error generating email with Claude:', error);
      // Fall through to default template
    }
  }

  // Default template if Claude not available
  const defaultBody = `Hi,

I hope this message finds you well! As one of our valued customers at ${profile.customerName}, we'd love to ask for your help.

${request.requestedBy.name} from ${request.requestedBy.team || 'our team'} is looking for a reference for a prospective customer who is evaluating our platform. Given your experience with ${profile.useCases.slice(0, 2).join(' and ') || 'our product'}, we thought you'd be a perfect fit.

The commitment would be approximately ${timeCommitment}.${incentive ? ` As a thank you, we'd like to offer ${incentive}.` : ''}

Would you be open to this? No pressure at all - we completely understand if the timing isn't right.

Looking forward to hearing from you!

Best regards`;

  return {
    success: true,
    draft: {
      matchId,
      customerId: profile.customerId,
      customerName: profile.customerName,
      contactEmail: `contact@${profile.customerName.toLowerCase().replace(/\s+/g, '')}.com`,
      contactName: 'Customer Contact',
      subject: `Reference Request - ${request.requestedBy.name}`,
      body: defaultBody,
      requesterContext: requesterContext || request.context || '',
      timeCommitment,
      incentive,
    },
  };
}

/**
 * Send reference request (mark as sent)
 */
export async function sendReferenceRequest(
  matchId: string,
  csmId: string
): Promise<{ success: boolean; message?: string }> {
  const now = new Date().toISOString();

  if (supabase) {
    const { data: matchData, error: fetchError } = await supabase
      .from('reference_matches')
      .select('request_id')
      .eq('id', matchId)
      .single();

    if (fetchError || !matchData) {
      return { success: false, message: 'Match not found' };
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('reference_requests')
      .update({
        status: 'awaiting_response',
        selected_match_id: matchId,
        updated_at: now,
      })
      .eq('id', matchData.request_id);

    if (updateError) {
      return { success: false, message: 'Failed to update request status' };
    }

    return { success: true };
  }

  // In-memory fallback
  for (const request of inMemoryRequests.values()) {
    const match = request.matches.find(m => m.id === matchId);
    if (match) {
      request.status = 'awaiting_response';
      request.selectedMatchId = matchId;
      request.updatedAt = now;
      return { success: true };
    }
  }

  return { success: false, message: 'Match not found' };
}

/**
 * Update reference response (accepted, declined, no_response)
 */
export async function updateReferenceResponse(
  requestId: string,
  response: 'accepted' | 'declined' | 'no_response',
  scheduledDate?: string,
  notes?: string
): Promise<{ success: boolean; request?: ReferenceRequest; message?: string }> {
  const now = new Date().toISOString();
  let newStatus: ReferenceRequestStatus;

  switch (response) {
    case 'accepted':
      newStatus = scheduledDate ? 'scheduled' : 'awaiting_response';
      break;
    case 'declined':
    case 'no_response':
      newStatus = 'cancelled';
      break;
    default:
      newStatus = 'awaiting_response';
  }

  if (supabase) {
    const { error } = await supabase
      .from('reference_requests')
      .update({
        status: newStatus,
        outcome:
          response === 'declined' || response === 'no_response'
            ? { status: response === 'declined' ? 'cancelled' : 'no_response', notes }
            : null,
        updated_at: now,
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, message: 'Failed to update response' };
    }

    const request = await getReferenceRequestById(requestId);
    return { success: true, request: request || undefined };
  }

  // In-memory fallback
  const request = inMemoryRequests.get(requestId);
  if (request) {
    request.status = newStatus;
    if (response === 'declined' || response === 'no_response') {
      request.outcome = {
        status: response === 'declined' ? 'cancelled' : 'no_response',
        notes,
      };
    }
    request.updatedAt = now;
    return { success: true, request };
  }

  return { success: false, message: 'Request not found' };
}

/**
 * Complete a reference request
 */
export async function completeReferenceRequest(
  requestId: string,
  outcome: Omit<ReferenceOutcome, 'status' | 'completedDate'>
): Promise<{ success: boolean; request?: ReferenceRequest; message?: string }> {
  const now = new Date().toISOString();

  const fullOutcome: ReferenceOutcome = {
    ...outcome,
    status: 'completed',
    completedDate: now,
  };

  if (supabase) {
    const { data: requestData, error: fetchError } = await supabase
      .from('reference_requests')
      .select('selected_match_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !requestData) {
      return { success: false, message: 'Request not found' };
    }

    // Update request
    const { error } = await supabase
      .from('reference_requests')
      .update({
        status: 'completed',
        outcome: fullOutcome,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, message: 'Failed to complete request' };
    }

    // Update customer profile if we have a selected match
    if (requestData.selected_match_id) {
      const { data: matchData } = await supabase
        .from('reference_matches')
        .select('customer_id')
        .eq('id', requestData.selected_match_id)
        .single();

      if (matchData) {
        await supabase.rpc('increment_reference_count', {
          p_customer_id: matchData.customer_id,
        });
      }
    }

    const request = await getReferenceRequestById(requestId);
    return { success: true, request: request || undefined };
  }

  // In-memory fallback
  const request = inMemoryRequests.get(requestId);
  if (request) {
    request.status = 'completed';
    request.outcome = fullOutcome;
    request.completedAt = now;
    request.updatedAt = now;

    // Update profile reference count
    if (request.selectedMatchId) {
      const match = request.matches.find(m => m.id === request.selectedMatchId);
      if (match) {
        const profile = inMemoryProfiles.get(match.customerId);
        if (profile) {
          profile.referenceCount += 1;
          profile.lastReferenceDate = now;
          profile.referencesThisQuarter += 1;
        }
      }
    }

    return { success: true, request };
  }

  return { success: false, message: 'Request not found' };
}

/**
 * Get customer reference profile
 */
export async function getCustomerReferenceProfile(
  customerId: string
): Promise<CustomerReferenceProfile | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('customer_reference_profiles')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      customerId: data.customer_id,
      customerName: data.customer_name,
      isWilling: data.is_willing,
      willingnessLastUpdated: data.willingness_last_updated,
      preferredFormats: data.preferred_formats || [],
      topicsComfortable: data.topics_comfortable || [],
      topicsToAvoid: data.topics_to_avoid,
      availabilityNotes: data.availability_notes || '',
      preferredContactMethod: data.preferred_contact_method,
      preferredTimezone: data.preferred_timezone,
      referenceCount: data.reference_count || 0,
      lastReferenceDate: data.last_reference_date,
      maxReferencesPerQuarter: data.max_references_per_quarter || 2,
      referencesThisQuarter: data.references_this_quarter || 0,
      npsScore: data.nps_score,
      healthScore: data.health_score,
      industry: data.industry || '',
      companySize: data.company_size || '',
      useCases: data.use_cases || [],
      features: data.features || [],
      geography: data.geography || '',
      contractStatus: data.contract_status,
      relationshipStrength: data.relationship_strength || 50,
      recentSupportIssues: data.recent_support_issues || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  return inMemoryProfiles.get(customerId) || null;
}

/**
 * Update customer reference profile
 */
export async function updateCustomerReferenceProfile(
  customerId: string,
  updates: Partial<CustomerReferenceProfile>
): Promise<{ success: boolean; profile?: CustomerReferenceProfile; message?: string }> {
  const now = new Date().toISOString();

  if (supabase) {
    const updateData: Record<string, unknown> = { updated_at: now };

    if (updates.isWilling !== undefined) {
      updateData.is_willing = updates.isWilling;
      updateData.willingness_last_updated = now;
    }
    if (updates.preferredFormats) updateData.preferred_formats = updates.preferredFormats;
    if (updates.topicsComfortable) updateData.topics_comfortable = updates.topicsComfortable;
    if (updates.topicsToAvoid) updateData.topics_to_avoid = updates.topicsToAvoid;
    if (updates.availabilityNotes) updateData.availability_notes = updates.availabilityNotes;
    if (updates.preferredContactMethod) updateData.preferred_contact_method = updates.preferredContactMethod;
    if (updates.preferredTimezone) updateData.preferred_timezone = updates.preferredTimezone;
    if (updates.maxReferencesPerQuarter !== undefined)
      updateData.max_references_per_quarter = updates.maxReferencesPerQuarter;

    const { error } = await supabase
      .from('customer_reference_profiles')
      .update(updateData)
      .eq('customer_id', customerId);

    if (error) {
      return { success: false, message: 'Failed to update profile' };
    }

    const profile = await getCustomerReferenceProfile(customerId);
    return { success: true, profile: profile || undefined };
  }

  // In-memory fallback
  const profile = inMemoryProfiles.get(customerId);
  if (profile) {
    Object.assign(profile, updates, { updatedAt: now });
    if (updates.isWilling !== undefined) {
      profile.willingnessLastUpdated = now;
    }
    return { success: true, profile };
  }

  return { success: false, message: 'Profile not found' };
}

/**
 * Get reference analytics
 */
export async function getReferenceAnalytics(period: number = 90): Promise<{
  summary: {
    totalRequests: number;
    completedRequests: number;
    acceptanceRate: number;
    averageTimeToComplete: number;
  };
  byType: { type: ReferenceRequestType; count: number; completed: number }[];
  byFormat: { format: ReferenceFormat; count: number }[];
  topReferences: { customerId: string; customerName: string; count: number }[];
  recentActivity: { date: string; requests: number; completions: number }[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  if (supabase) {
    // Fetch requests in period
    const { data: requests } = await supabase
      .from('reference_requests')
      .select('*')
      .gte('created_at', startDate.toISOString());

    const allRequests = requests || [];
    const completed = allRequests.filter(r => r.status === 'completed');
    const accepted = allRequests.filter(r => ['completed', 'scheduled'].includes(r.status));

    // Calculate average time to complete
    const completionTimes = completed
      .filter(r => r.completed_at && r.created_at)
      .map(r => {
        const created = new Date(r.created_at).getTime();
        const completedAt = new Date(r.completed_at).getTime();
        return (completedAt - created) / (1000 * 60 * 60 * 24); // days
      });

    const avgTime =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

    // By type
    const byTypeMap = new Map<ReferenceRequestType, { count: number; completed: number }>();
    for (const r of allRequests) {
      const existing = byTypeMap.get(r.request_type) || { count: 0, completed: 0 };
      existing.count++;
      if (r.status === 'completed') existing.completed++;
      byTypeMap.set(r.request_type, existing);
    }

    // By format
    const byFormatMap = new Map<ReferenceFormat, number>();
    for (const r of allRequests) {
      const format = r.requirements?.format || 'any';
      byFormatMap.set(format, (byFormatMap.get(format) || 0) + 1);
    }

    // Top references
    const { data: topRefs } = await supabase
      .from('customer_reference_profiles')
      .select('customer_id, customer_name, reference_count')
      .gt('reference_count', 0)
      .order('reference_count', { ascending: false })
      .limit(5);

    return {
      summary: {
        totalRequests: allRequests.length,
        completedRequests: completed.length,
        acceptanceRate: allRequests.length > 0 ? (accepted.length / allRequests.length) * 100 : 0,
        averageTimeToComplete: Math.round(avgTime * 10) / 10,
      },
      byType: Array.from(byTypeMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        completed: data.completed,
      })),
      byFormat: Array.from(byFormatMap.entries()).map(([format, count]) => ({ format, count })),
      topReferences: (topRefs || []).map(r => ({
        customerId: r.customer_id,
        customerName: r.customer_name,
        count: r.reference_count,
      })),
      recentActivity: [], // Would need date grouping query
    };
  }

  // In-memory fallback
  const allRequests = Array.from(inMemoryRequests.values()).filter(
    r => new Date(r.createdAt) >= startDate
  );
  const completed = allRequests.filter(r => r.status === 'completed');
  const accepted = allRequests.filter(r => ['completed', 'scheduled'].includes(r.status));

  return {
    summary: {
      totalRequests: allRequests.length,
      completedRequests: completed.length,
      acceptanceRate: allRequests.length > 0 ? (accepted.length / allRequests.length) * 100 : 0,
      averageTimeToComplete: 5.2, // Mock
    },
    byType: [
      { type: 'sales', count: 3, completed: 2 },
      { type: 'marketing', count: 1, completed: 1 },
    ],
    byFormat: [
      { format: 'call', count: 3 },
      { format: 'case_study', count: 1 },
    ],
    topReferences: Array.from(inMemoryProfiles.values())
      .filter(p => p.referenceCount > 0)
      .sort((a, b) => b.referenceCount - a.referenceCount)
      .slice(0, 5)
      .map(p => ({
        customerId: p.customerId,
        customerName: p.customerName,
        count: p.referenceCount,
      })),
    recentActivity: [],
  };
}
