/**
 * Stakeholder Relationship Map Types (PRD-063)
 *
 * Type definitions for the stakeholder relationship mapping feature.
 * Provides comprehensive stakeholder tracking with relationships,
 * influence levels, sentiment, and engagement metrics.
 */

// ============================================
// Core Stakeholder Types
// ============================================

export type StakeholderRole =
  | 'champion'
  | 'sponsor'
  | 'influencer'
  | 'user'
  | 'detractor'
  | 'blocker';

export type InfluenceLevel = 'high' | 'medium' | 'low';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'unknown';

export type EngagementLevel = 'high' | 'medium' | 'low' | 'none';

export type PreferredChannel = 'email' | 'phone' | 'slack' | 'in_person';

export type StakeholderStatus = 'active' | 'departed' | 'on_leave';

export type RelationshipType =
  | 'reports_to'
  | 'collaborates_with'
  | 'influences'
  | 'blocks';

export type RelationshipStrength = 'strong' | 'moderate' | 'weak';

export type ViewMode = 'org_chart' | 'influence_map' | 'engagement_view';

// ============================================
// Stakeholder Interface
// ============================================

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
  role: StakeholderRole;
  influenceLevel: InfluenceLevel;
  decisionMaker: boolean;
  budgetAuthority: boolean;

  // Engagement tracking
  sentiment: Sentiment;
  engagementLevel: EngagementLevel;
  lastContactDate: string | null;
  preferredChannel: PreferredChannel;

  // Organizational
  reportsTo?: string; // stakeholder ID
  directReports?: string[]; // stakeholder IDs

  // Status
  status: StakeholderStatus;
  departureDate?: string;
  notes: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Relationship Interface
// ============================================

export interface StakeholderRelationship {
  id: string;
  fromId: string;
  toId: string;
  relationshipType: RelationshipType;
  strength: RelationshipStrength;
  customerId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Coverage Summary
// ============================================

export interface CoverageSummary {
  totalStakeholders: number;
  decisionMakers: {
    count: number;
    covered: boolean;
  };
  executiveSponsor: {
    exists: boolean;
    name?: string;
  };
  champion: {
    exists: boolean;
    count: number;
    names: string[];
  };
  blockersDetractors: {
    count: number;
    warning: boolean;
  };
  engagementGaps: {
    count: number;
    stakeholders: string[];
    thresholdDays: number;
  };
  departmentsCoverage: {
    covered: string[];
    missing: string[];
    coverageRatio: string;
  };
}

// ============================================
// Multi-Threading Score
// ============================================

export interface MultiThreadingScore {
  score: number;
  maxScore: number;
  breakdown: {
    hasChampion: { score: number; achieved: boolean };
    hasExecSponsor: { score: number; achieved: boolean };
    decisionMakerCoverage: { score: number; ratio: string };
    departmentCoverage: { score: number; ratio: string };
    avgSentiment: { score: number; value: string };
    noEngagementGaps: { score: number; achieved: boolean };
  };
  analysis: string;
  recommendations: string[];
}

// ============================================
// Relationship Actions
// ============================================

export interface RelationshipAction {
  contact: string;
  contactId: string;
  relationshipGoal: string;
  nextStep: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
}

// ============================================
// Stakeholder Map Response
// ============================================

export interface StakeholderMapData {
  customerId: string;
  customerName: string;
  lastUpdated: string;
  viewMode: ViewMode;
  stakeholders: Stakeholder[];
  relationships: StakeholderRelationship[];
  coverageSummary: CoverageSummary;
  multiThreadingScore: MultiThreadingScore;
  keyRelationships: {
    championsAndSponsors: Stakeholder[];
    riskContacts: Stakeholder[];
  };
  relationshipActions: RelationshipAction[];
  orgChart?: OrgChartNode;
}

// ============================================
// Org Chart Types
// ============================================

export interface OrgChartNode {
  stakeholder: Stakeholder;
  children: OrgChartNode[];
  level: number;
}

// ============================================
// Influence Map Types
// ============================================

export interface InfluenceMapLayer {
  level: 'decision_makers' | 'high' | 'medium' | 'low';
  stakeholders: Stakeholder[];
}

export interface InfluenceMapData {
  layers: InfluenceMapLayer[];
  legend: {
    champion: string;
    positive: string;
    neutral: string;
    negative: string;
  };
}

// ============================================
// Engagement View Types
// ============================================

export interface EngagementViewRow {
  stakeholder: Stakeholder;
  lastContact: string | null;
  daysSinceContact: number | null;
  contactFrequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'rare' | 'never';
  sentiment: Sentiment;
  actionNeeded: string | null;
  priority: 'high' | 'medium' | 'low' | 'none';
}

export interface EngagementViewData {
  rows: EngagementViewRow[];
  summary: {
    totalGaps: number;
    highPriorityActions: number;
    averageDaysSinceContact: number;
  };
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetStakeholderMapRequest {
  customerId: string;
  viewMode?: ViewMode;
  includeFormer?: boolean;
}

export interface CreateRelationshipRequest {
  fromId: string;
  toId: string;
  relationshipType: RelationshipType;
  strength?: RelationshipStrength;
}

export interface UpdateStakeholderRequest {
  name?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  role?: StakeholderRole;
  influenceLevel?: InfluenceLevel;
  decisionMaker?: boolean;
  budgetAuthority?: boolean;
  sentiment?: Sentiment;
  engagementLevel?: EngagementLevel;
  preferredChannel?: PreferredChannel;
  reportsTo?: string | null;
  status?: StakeholderStatus;
  departureDate?: string | null;
  notes?: string;
}

export interface CreateStakeholderRequest {
  customerId: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  role: StakeholderRole;
  influenceLevel: InfluenceLevel;
  decisionMaker?: boolean;
  budgetAuthority?: boolean;
  sentiment?: Sentiment;
  engagementLevel?: EngagementLevel;
  preferredChannel?: PreferredChannel;
  reportsTo?: string;
  notes?: string;
}

// ============================================
// API Response Wrapper
// ============================================

export interface StakeholderMapApiResponse {
  success: boolean;
  data?: StakeholderMapData;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    generatedAt: string;
    responseTimeMs: number;
    stakeholderCount: number;
    viewMode: ViewMode;
  };
}
