/**
 * Feature Request Prioritization Types
 * PRD-016: Feature Request List Prioritization Scoring
 *
 * Types for parsing, grouping, scoring, and reporting feature requests
 */

// ============================================
// Input Types
// ============================================

export interface RawFeatureRequest {
  customer: string;
  customerEmail?: string;
  customerId?: string;
  request: string;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  context?: string;
  source?: 'survey' | 'call' | 'ticket' | 'email' | 'meeting' | 'other';
  submittedAt?: string;
  submittedBy?: string;
}

export interface ParsedFeatureRequest extends RawFeatureRequest {
  id: string;
  customerId: string;
  customerName: string;
  arr: number;
  segment: 'enterprise' | 'mid-market' | 'smb' | 'startup';
  healthScore?: number;
  renewalDate?: string;
  requestNormalized: string;
}

// ============================================
// Grouping Types
// ============================================

export interface FeatureRequestGroup {
  id: string;
  title: string;
  description: string;
  category: FeatureCategory;
  requests: ParsedFeatureRequest[];
  customerCount: number;
  totalArr: number;
  avgUrgency: number;
  keywords: string[];
  createdAt: Date;
}

export type FeatureCategory =
  | 'security'
  | 'integrations'
  | 'reporting'
  | 'api'
  | 'mobile'
  | 'performance'
  | 'ui_ux'
  | 'automation'
  | 'compliance'
  | 'other';

export interface GroupingResult {
  originalCount: number;
  groupedCount: number;
  groups: FeatureRequestGroup[];
  ungrouped: ParsedFeatureRequest[];
  processingTimeMs: number;
}

// ============================================
// Scoring Types
// ============================================

export interface PriorityScore {
  groupId: string;
  title: string;
  description: string;
  overallScore: number;
  breakdown: ScoreBreakdown;
  customerCount: number;
  totalArrImpact: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  competitiveContext?: CompetitiveContext;
  requestingCustomers: CustomerRequestSummary[];
  quotes: CustomerQuote[];
  recommendation: string;
  rank: number;
}

export interface ScoreBreakdown {
  arrImpact: ComponentScore;       // 30% weight
  customerCount: ComponentScore;   // 20% weight
  urgency: ComponentScore;         // 20% weight
  competitive: ComponentScore;     // 15% weight
  strategic: ComponentScore;       // 15% weight
}

export interface ComponentScore {
  raw: number;
  normalized: number;  // 0-100
  weight: number;
  weighted: number;
}

export interface CompetitiveContext {
  competitors: CompetitorStatus[];
  isTableStakes: boolean;
  marketTrend: 'emerging' | 'growing' | 'mature' | 'declining';
}

export interface CompetitorStatus {
  name: string;
  hasFeature: boolean;
  quality?: 'basic' | 'standard' | 'advanced';
}

export interface CustomerRequestSummary {
  customerId: string;
  customerName: string;
  arr: number;
  urgency: string;
  context?: string;
  segment: string;
}

export interface CustomerQuote {
  customerId: string;
  customerName: string;
  quote: string;
  speaker?: string;
  source: string;
  date?: string;
}

// ============================================
// Scoring Configuration
// ============================================

export const SCORE_WEIGHTS = {
  arrImpact: 0.30,
  customerCount: 0.20,
  urgency: 0.20,
  competitive: 0.15,
  strategic: 0.15,
} as const;

export const URGENCY_SCORES: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

// ============================================
// Report Types
// ============================================

export interface ProductTeamReport {
  id: string;
  title: string;
  generatedAt: Date;
  generatedBy: string;
  period: {
    start: string;
    end: string;
  };
  summary: ReportSummary;
  priority1Requests: PriorityScore[];
  priority2Requests: PriorityScore[];
  priority3Requests: PriorityScore[];
  themes: ReportTheme[];
  customersAtRisk: CustomerRiskSummary[];
  discussionPoints: string[];
  exportFormats: ('pdf' | 'xlsx' | 'json')[];
}

export interface ReportSummary {
  totalRequests: number;
  uniqueRequests: number;
  totalCustomers: number;
  totalArrImpacted: number;
  avgPriorityScore: number;
  topCategory: FeatureCategory;
  urgentCount: number;
}

export interface ReportTheme {
  name: string;
  description: string;
  requestCount: number;
  arrImpact: number;
  trend: 'growing' | 'stable' | 'declining';
}

export interface CustomerRiskSummary {
  customerId: string;
  customerName: string;
  arr: number;
  primaryRequest: string;
  riskLevel: 'high' | 'medium' | 'low';
  riskReason: string;
  daysToRenewal?: number;
}

// ============================================
// Upload and Processing Types
// ============================================

export interface FeatureRequestUploadResult {
  success: boolean;
  uploadId: string;
  fileName: string;
  totalRequests: number;
  matchedCustomers: number;
  unmatchedCustomers: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  parsedRequests: ParsedFeatureRequest[];
  processingTimeMs: number;
}

export interface FeatureRequestScoreResult {
  success: boolean;
  uploadId: string;
  scoredAt: Date;
  totalScored: number;
  prioritizedList: PriorityScore[];
  matrix: PrioritizationMatrix;
  processingTimeMs: number;
}

export interface PrioritizationMatrix {
  quadrants: {
    highUrgencyHighArr: PriorityScore[];
    highUrgencyLowArr: PriorityScore[];
    lowUrgencyHighArr: PriorityScore[];
    lowUrgencyLowArr: PriorityScore[];
  };
  avgArrThreshold: number;
  avgUrgencyThreshold: number;
}

// ============================================
// Database Models
// ============================================

export interface FeatureRequestUpload {
  id: string;
  userId: string;
  fileName: string;
  status: 'pending' | 'parsing' | 'parsed' | 'grouping' | 'grouped' | 'scoring' | 'scored' | 'failed';
  totalRequests: number;
  uniqueGroups: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureRequestRecord {
  id: string;
  uploadId: string;
  customerId: string;
  customerName: string;
  requestText: string;
  normalizedText: string;
  groupId?: string;
  urgency: string;
  source: string;
  context?: string;
  arr: number;
  segment: string;
  createdAt: Date;
}

export interface FeatureGroupRecord {
  id: string;
  uploadId: string;
  title: string;
  description: string;
  category: FeatureCategory;
  keywords: string[];
  requestCount: number;
  customerCount: number;
  totalArr: number;
  priorityScore?: number;
  priorityRank?: number;
  createdAt: Date;
}
