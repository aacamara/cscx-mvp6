/**
 * Feedback Routing Types
 *
 * PRD-128: Feedback Received → Routing
 *
 * Types for automated feedback categorization, routing, and lifecycle management.
 */

// ============================================
// Enums and Constants
// ============================================

export type FeedbackSource =
  | 'survey'       // NPS/CSAT surveys
  | 'widget'       // In-app feedback widgets
  | 'support'      // Support ticket comments
  | 'meeting'      // Meeting transcript extraction
  | 'email'        // Email sentiment analysis
  | 'social';      // Social media mentions

export type FeedbackType =
  | 'feature_request'
  | 'bug'
  | 'praise'
  | 'complaint'
  | 'suggestion';

export type FeedbackCategory =
  | 'product'
  | 'support'
  | 'pricing'
  | 'ux'
  | 'documentation'
  | 'performance'
  | 'onboarding'
  | 'other';

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';

export type FeedbackUrgency = 'immediate' | 'soon' | 'backlog';

export type FeedbackImpact = 'high' | 'medium' | 'low';

export type FeedbackStatus =
  | 'received'
  | 'routed'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed';

// ============================================
// Core Types
// ============================================

/**
 * AI-powered classification of feedback
 */
export interface FeedbackClassification {
  type: FeedbackType;
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
  urgency: FeedbackUrgency;
  impact: FeedbackImpact;
  confidence: number; // 0-1 confidence score
  themes: string[];   // Key themes extracted
  keywords: string[]; // Important keywords
  suggestedActions: string[];
}

/**
 * Routing information for feedback
 */
export interface FeedbackRouting {
  primaryTeam: string;
  secondaryTeams: string[];
  assignedTo: string | null;
  assignedToEmail: string | null;
  routedAt: Date | null;
  routingRule: string | null; // Which rule triggered routing
  escalated: boolean;
  escalatedTo: string | null;
  escalatedAt: Date | null;
}

/**
 * Acknowledgment tracking
 */
export interface FeedbackAcknowledgment {
  sent: boolean;
  sentAt: Date | null;
  method: 'email' | 'slack' | 'in_app' | null;
  draftContent: string | null;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
}

/**
 * Resolution tracking
 */
export interface FeedbackResolution {
  resolvedAt: Date | null;
  outcome: 'implemented' | 'fixed' | 'wont_fix' | 'duplicate' | 'planned' | null;
  outcomeDetails: string | null;
  customerNotified: boolean;
  notifiedAt: Date | null;
  externalTicketId: string | null; // Jira/Linear ticket
  externalTicketUrl: string | null;
}

/**
 * Main CustomerFeedback entity
 */
export interface CustomerFeedback {
  id: string;
  customerId: string;
  customerName?: string;
  source: FeedbackSource;
  sourceId: string | null;       // ID from source system
  sourceUrl: string | null;      // Link to original feedback
  submittedBy: {
    email: string;
    name: string | null;
    role: string | null;
    isKeyStakeholder: boolean;
  };
  content: string;
  rawContent: string | null;     // Original unprocessed content
  classification: FeedbackClassification;
  routing: FeedbackRouting;
  status: FeedbackStatus;
  acknowledgment: FeedbackAcknowledgment;
  resolution: FeedbackResolution;
  csmNotified: boolean;
  csmNotifiedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Routing Rules
// ============================================

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  priority: number; // Lower = higher priority
  enabled: boolean;
  conditions: RoutingCondition[];
  conditionLogic: 'AND' | 'OR';
  routing: {
    primaryTeam: string;
    secondaryTeams: string[];
    assignTo?: string; // Optional specific person
  };
  notifyCSM: boolean;
  autoAcknowledge: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingCondition {
  field: 'type' | 'category' | 'sentiment' | 'urgency' | 'impact' | 'source' | 'customer_tier' | 'arr' | 'keywords';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | string[] | number;
}

// ============================================
// Team Definitions
// ============================================

export interface FeedbackTeam {
  id: string;
  name: string;
  slackChannel?: string;
  email?: string;
  members: TeamMember[];
  feedbackTypes: FeedbackType[];
  categories: FeedbackCategory[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isLead: boolean;
}

// Default teams
export const DEFAULT_TEAMS: FeedbackTeam[] = [
  {
    id: 'product',
    name: 'Product Team',
    feedbackTypes: ['feature_request', 'suggestion'],
    categories: ['product', 'ux'],
    members: [],
  },
  {
    id: 'engineering',
    name: 'Engineering',
    feedbackTypes: ['bug'],
    categories: ['performance'],
    members: [],
  },
  {
    id: 'support',
    name: 'Support Lead',
    feedbackTypes: ['complaint'],
    categories: ['support'],
    members: [],
  },
  {
    id: 'sales',
    name: 'Sales/Finance',
    feedbackTypes: ['complaint', 'suggestion'],
    categories: ['pricing'],
    members: [],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    feedbackTypes: ['praise'],
    categories: [],
    members: [],
  },
  {
    id: 'design',
    name: 'Design Team',
    feedbackTypes: ['suggestion', 'complaint'],
    categories: ['ux', 'documentation'],
    members: [],
  },
  {
    id: 'customer_success',
    name: 'Customer Success',
    feedbackTypes: ['complaint', 'praise'],
    categories: ['onboarding', 'support'],
    members: [],
  },
];

// ============================================
// Analytics & Reporting
// ============================================

export interface FeedbackAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  totals: {
    received: number;
    routed: number;
    acknowledged: number;
    resolved: number;
    pending: number;
  };
  byType: Record<FeedbackType, number>;
  byCategory: Record<FeedbackCategory, number>;
  bySentiment: Record<FeedbackSentiment, number>;
  bySource: Record<FeedbackSource, number>;
  byTeam: Record<string, number>;
  averages: {
    timeToRoute: number;      // minutes
    timeToAcknowledge: number; // hours
    timeToResolve: number;    // days
    classificationConfidence: number;
  };
  trends: {
    volumeTrend: 'increasing' | 'stable' | 'decreasing';
    sentimentTrend: 'improving' | 'stable' | 'declining';
  };
  topThemes: Array<{
    theme: string;
    count: number;
    sentiment: FeedbackSentiment;
  }>;
}

export interface FeedbackReport {
  id: string;
  title: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  analytics: FeedbackAnalytics;
  insights: string[];
  recommendations: string[];
  generatedAt: Date;
  generatedBy: 'system' | 'manual';
}

// ============================================
// Input Types
// ============================================

export interface CreateFeedbackInput {
  customerId: string;
  source: FeedbackSource;
  sourceId?: string;
  sourceUrl?: string;
  submittedBy: {
    email: string;
    name?: string;
    role?: string;
  };
  content: string;
  rawContent?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateFeedbackInput {
  status?: FeedbackStatus;
  assignedTo?: string;
  routing?: Partial<FeedbackRouting>;
  resolution?: Partial<FeedbackResolution>;
  metadata?: Record<string, unknown>;
}

export interface FeedbackListQuery {
  customerId?: string;
  status?: FeedbackStatus | FeedbackStatus[];
  type?: FeedbackType | FeedbackType[];
  category?: FeedbackCategory | FeedbackCategory[];
  sentiment?: FeedbackSentiment;
  source?: FeedbackSource;
  team?: string;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'urgency' | 'impact';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Event Types
// ============================================

export interface FeedbackEvent {
  id: string;
  feedbackId: string;
  type: 'created' | 'classified' | 'routed' | 'acknowledged' | 'status_changed' | 'resolved' | 'escalated' | 'comment_added';
  data: Record<string, unknown>;
  performedBy: string | null;
  createdAt: Date;
}

export interface FeedbackComment {
  id: string;
  feedbackId: string;
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  internal: boolean; // Internal note vs customer-visible
  createdAt: Date;
}
