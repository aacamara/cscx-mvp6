/**
 * PRD-071: White Space Analysis Types
 *
 * Types for analyzing untapped opportunities within customer accounts:
 * - Product white space (unpurchased products, feature upgrades)
 * - User white space (unused licenses, department expansion)
 * - Use case white space (unrealized workflows, integrations)
 */

// ============================================
// Confidence and Scoring Types
// ============================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type OpportunityType =
  | 'unpurchased_product'
  | 'feature_upgrade'
  | 'add_on_module'
  | 'tier_upgrade'
  | 'unused_licenses'
  | 'seat_expansion'
  | 'department_expansion'
  | 'team_expansion'
  | 'unrealized_use_case'
  | 'adjacent_workflow'
  | 'integration_opportunity';

export type OpportunityCategory = 'products' | 'users' | 'use_cases';

export type FocusArea = 'products' | 'users' | 'use_cases' | 'all';

// ============================================
// Product White Space Types
// ============================================

export interface ProductCatalogItem {
  id: string;
  name: string;
  description: string;
  annualPrice: number;
  category: 'core' | 'module' | 'add_on' | 'premium' | 'support';
  tier?: string;
  features?: string[];
}

export interface PurchasedProduct {
  productId: string;
  productName: string;
  annualValue: number;
  purchaseDate: string;
  status: 'active' | 'pending' | 'expiring';
}

export interface ProductOpportunity {
  product: ProductCatalogItem;
  opportunityType: 'unpurchased_product' | 'feature_upgrade' | 'add_on_module' | 'tier_upgrade';
  potentialValue: number;
  confidence: ConfidenceLevel;
  relevanceScore: number;
  signals: ProductSignal[];
  whyItFits: string[];
  approach: string[];
}

export interface ProductSignal {
  type: 'meeting' | 'feature_request' | 'usage_pattern' | 'competitor' | 'support_ticket';
  source: string;
  content: string;
  date: string;
}

export interface ProductWhiteSpace {
  currentProducts: PurchasedProduct[];
  availableProducts: ProductCatalogItem[];
  opportunities: ProductOpportunity[];
  totalPotentialValue: number;
}

// ============================================
// User White Space Types
// ============================================

export interface LicenseUtilization {
  type: string;
  licensed: number;
  active: number;
  utilization: number;
  available: number;
}

export interface DepartmentPenetration {
  department: string;
  isUsing: boolean;
  status: 'active' | 'partial' | 'not_using';
  potentialUsers: number;
  potentialValue: number;
  champion?: string;
  championRelationship?: string;
}

export interface UserOpportunity {
  department: string;
  potentialUsers: number;
  potentialValue: number;
  confidence: ConfidenceLevel;
  relevanceScore: number;
  opportunityType: 'unused_licenses' | 'seat_expansion' | 'department_expansion' | 'team_expansion';
  signals: UserSignal[];
  whyItFits: string[];
  approach: string[];
}

export interface UserSignal {
  type: 'qbr_mention' | 'champion_connection' | 'workflow_overlap' | 'org_change';
  source: string;
  content: string;
  date?: string;
}

export interface UserWhiteSpace {
  licenseUtilization: LicenseUtilization[];
  departmentPenetration: DepartmentPenetration[];
  opportunities: UserOpportunity[];
  totalPotentialValue: number;
  licenseSummary: {
    totalLicensed: number;
    totalActive: number;
    overallUtilization: number;
  };
}

// ============================================
// Use Case White Space Types
// ============================================

export interface UseCase {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredProducts?: string[];
  potentialValue: number;
}

export interface UseCaseAdoption {
  useCase: UseCase;
  isAdopted: boolean;
  adoptionLevel: 'active' | 'partial' | 'not_adopted';
  peerAdoptionPercent: number;
}

export interface UseCaseOpportunity {
  useCase: UseCase;
  peerAdoptionPercent: number;
  potentialValue: number;
  confidence: ConfidenceLevel;
  relevanceScore: number;
  opportunityType: 'unrealized_use_case' | 'adjacent_workflow' | 'integration_opportunity';
  signals: UseCaseSignal[];
  whyItFits: string[];
  approach: string[];
  relatedProducts?: string[];
}

export interface UseCaseSignal {
  type: 'data_flow' | 'feature_usage' | 'integration_potential' | 'peer_comparison';
  source: string;
  content: string;
  date?: string;
}

export interface UseCaseWhiteSpace {
  realizedUseCases: UseCaseAdoption[];
  unrealizedUseCases: UseCaseAdoption[];
  opportunities: UseCaseOpportunity[];
  totalPotentialValue: number;
}

// ============================================
// Combined White Space Analysis Types
// ============================================

export interface WhiteSpaceOpportunity {
  id: string;
  category: OpportunityCategory;
  type: OpportunityType;
  name: string;
  description: string;
  potentialValue: number;
  confidence: ConfidenceLevel;
  relevanceScore: number;
  signals: string[];
  nextSteps: string[];
  whyItFits?: string[];
}

export interface ExpansionProposalItem {
  item: string;
  annualValue: number;
  discount: number;
  netValue: number;
  category: OpportunityCategory;
}

export interface ExpansionProposal {
  items: ExpansionProposalItem[];
  totalAnnualValue: number;
  totalNetValue: number;
  valueProposition: string[];
  timeline: {
    q1: string[];
    q2: string[];
    q3?: string[];
    q4?: string[];
  };
}

export interface PeerComparison {
  metric: string;
  customerHas: boolean;
  peerPercent: number;
  gap: 'under_penetrated' | 'on_par' | 'above_average';
}

export interface WhiteSpaceCategories {
  products: ProductWhiteSpace;
  users: UserWhiteSpace;
  useCases: UseCaseWhiteSpace;
}

export interface WhiteSpaceSummary {
  category: OpportunityCategory;
  opportunityCount: number;
  potentialValue: number;
  readiness: 'high' | 'medium' | 'low';
}

export interface WhiteSpaceAnalysis {
  customerId: string;
  customerName: string;
  generatedAt: string;
  totalPotentialValue: number;
  summary: WhiteSpaceSummary[];
  categories: WhiteSpaceCategories;
  prioritizedOpportunities: WhiteSpaceOpportunity[];
  expansionProposal: ExpansionProposal;
  peerComparison: PeerComparison[];
  recommendations: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface WhiteSpaceRequest {
  customerId: string;
  focusArea?: FocusArea;
}

export interface WhiteSpaceResponse {
  success: boolean;
  data: WhiteSpaceAnalysis;
  meta: {
    generatedAt: string;
    responseTimeMs: number;
    focusArea: FocusArea;
    opportunityCount: number;
  };
}

export interface WhiteSpaceFilters {
  focusArea: FocusArea;
  minConfidence: ConfidenceLevel | 'all';
  minValue: number;
  sortBy: 'value' | 'confidence' | 'relevance';
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_WHITE_SPACE_FILTERS: WhiteSpaceFilters = {
  focusArea: 'all',
  minConfidence: 'all',
  minValue: 0,
  sortBy: 'relevance',
  sortOrder: 'desc',
};

// ============================================
// Opportunity Scoring Types
// ============================================

export interface OpportunityScoringWeights {
  productFit: number;      // Does it fit their use case?
  signalStrength: number;  // Have they indicated interest?
  peerAdoption: number;    // Do similar customers have it?
  championAlignment: number; // Does champion support this?
  timingFit: number;       // Is timing right?
}

export const DEFAULT_SCORING_WEIGHTS: OpportunityScoringWeights = {
  productFit: 0.30,
  signalStrength: 0.25,
  peerAdoption: 0.20,
  championAlignment: 0.15,
  timingFit: 0.10,
};

// ============================================
// Export Helpers
// ============================================

export interface WhiteSpaceExportOptions {
  format: 'csv' | 'pdf' | 'json';
  includeDetails: boolean;
  includeProposal: boolean;
  includePeerComparison: boolean;
}
