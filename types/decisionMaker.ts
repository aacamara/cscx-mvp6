/**
 * Decision Maker Analysis Types (PRD-082)
 *
 * Type definitions for decision maker identification and analysis.
 * Enables CSMs to understand who key decision makers are within
 * customer organizations, including influence levels, priorities,
 * and engagement status.
 */

// ============================================
// Core Types
// ============================================

export type DecisionAuthority =
  | 'budget_approval'
  | 'contract_signing'
  | 'technical_approval'
  | 'business_approval'
  | 'legal_approval'
  | 'executive_sponsor'
  | 'influencer';

export type EngagementStatus =
  | 'strong_relationship'
  | 'good_relationship'
  | 'needs_engagement'
  | 'at_risk'
  | 'unknown';

export type InfluenceCategory = 'high' | 'medium' | 'low';

export type DecisionPattern =
  | 'consensus_driven'
  | 'top_down'
  | 'committee_based'
  | 'champion_led'
  | 'unknown';

// ============================================
// Decision Maker Interface
// ============================================

export interface DecisionMaker {
  id: string;
  stakeholderId: string;
  customerId: string;

  // Basic info
  name: string;
  title: string;
  department: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;

  // Decision authority
  decisionAuthority: DecisionAuthority[];
  influenceScore: number; // 0-100
  influenceCategory: InfluenceCategory;

  // Engagement metrics
  engagementScore: number; // 0-100
  engagementStatus: EngagementStatus;
  lastContactDate: string | null;
  daysSinceContact: number | null;
  totalInteractions: number;
  meetingAttendanceRate: number; // 0-100
  emailResponseRate: number; // 0-100

  // Priorities and interests
  knownPriorities: string[];
  communicationPreference: 'email' | 'phone' | 'in_person' | 'slack';

  // Relationship indicators
  isChampion: boolean;
  isExecutiveSponsor: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  relationshipStrength: 'strong' | 'moderate' | 'weak' | 'none';

  // Reporting
  reportsTo?: string;
  directReports: string[];

  // Analysis metadata
  lastAnalyzedAt: string;
  dataConfidence: 'high' | 'medium' | 'low';
}

// ============================================
// Engagement Gap Interface
// ============================================

export interface EngagementGap {
  decisionMakerId: string;
  decisionMakerName: string;
  title: string;
  decisionAuthority: DecisionAuthority[];
  influenceScore: number;
  gapType: 'no_contact' | 'stale_relationship' | 'low_response' | 'missing_executive';
  daysSinceContact: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  suggestedAction: string;
}

// ============================================
// Decision Pattern Analysis
// ============================================

export interface DecisionPatternAnalysis {
  pattern: DecisionPattern;
  confidence: number; // 0-100
  description: string;
  keyIndicators: string[];
  implications: string[];
  recommendations: string[];
}

// ============================================
// Influence Network
// ============================================

export interface InfluenceConnection {
  fromId: string;
  toId: string;
  connectionType: 'reports_to' | 'influences' | 'collaborates_with' | 'blocks';
  strength: 'strong' | 'moderate' | 'weak';
}

export interface InfluenceNetwork {
  nodes: {
    id: string;
    name: string;
    title: string;
    influenceScore: number;
    decisionAuthority: DecisionAuthority[];
    isDecisionMaker: boolean;
    layer: 'executive' | 'management' | 'operational';
  }[];
  connections: InfluenceConnection[];
}

// ============================================
// Engagement Recommendations
// ============================================

export interface EngagementRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  decisionMakerId: string;
  decisionMakerName: string;
  title: string;
  action: string;
  actionType: 'schedule_meeting' | 'send_email' | 'introduction_request' | 'executive_briefing' | 'roi_presentation';
  rationale: string;
  suggestedTimeline: string;
  talkingPoints?: string[];
}

// ============================================
// Decision Maker Analysis Response
// ============================================

export interface DecisionMakerAnalysis {
  customerId: string;
  customerName: string;
  analysisType: 'renewal' | 'expansion' | 'general' | 'risk_mitigation';

  // Summary
  summary: {
    totalDecisionMakers: number;
    coveredDecisionMakers: number;
    coveragePercentage: number;
    averageInfluenceScore: number;
    averageEngagementScore: number;
    hasExecutiveSponsor: boolean;
    hasChampion: boolean;
    singleThreadedRisk: boolean;
  };

  // Decision makers ranked by influence
  decisionMakers: DecisionMaker[];

  // Gaps and risks
  engagementGaps: EngagementGap[];

  // Decision pattern analysis
  decisionPattern: DecisionPatternAnalysis;

  // Influence network visualization data
  influenceNetwork: InfluenceNetwork;

  // Recommended actions
  recommendations: EngagementRecommendation[];

  // Historical context
  historicalOutcomes?: {
    previousRenewals: number;
    successRate: number;
    averageDealCycleLength: number;
    typicalDecisionMakerCount: number;
  };

  // Metadata
  generatedAt: string;
  dataCompleteness: number; // 0-100
  confidenceScore: number; // 0-100
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetDecisionMakersRequest {
  customerId: string;
  analysisType?: 'renewal' | 'expansion' | 'general' | 'risk_mitigation';
  includeHistorical?: boolean;
  refresh?: boolean;
}

export interface RefreshAnalysisRequest {
  customerId: string;
  enrichWithLinkedIn?: boolean;
  enrichWithNews?: boolean;
}

export interface UpdateDecisionMakerRequest {
  stakeholderId: string;
  influenceScore?: number;
  decisionAuthority?: DecisionAuthority[];
  knownPriorities?: string[];
  notes?: string;
}

// ============================================
// API Response Wrapper
// ============================================

export interface DecisionMakerApiResponse {
  success: boolean;
  data?: DecisionMakerAnalysis;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    generatedAt: string;
    responseTimeMs: number;
    decisionMakerCount: number;
    analysisType: string;
  };
}

// ============================================
// Quick Actions
// ============================================

export interface DecisionMakerAction {
  actionId: string;
  label: string;
  icon: string;
  actionType: 'schedule_meeting' | 'generate_roi' | 'view_full_analysis' | 'send_intro_request';
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export interface QuickActionResponse {
  success: boolean;
  action: string;
  message: string;
  nextSteps?: string[];
  data?: Record<string, unknown>;
}
