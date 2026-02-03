/**
 * Integration Types for Server-Side Services
 * PRD-020: Technical Health Score Types
 */

// ============================================
// INTEGRATION DATA TYPES
// ============================================

export interface IntegrationUsageRecord {
  timestamp: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  statusCode: number;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  integrationName: string;
  integrationType: IntegrationDataType;
  userId?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface WebhookDeliveryRecord {
  timestamp: string;
  webhookId: string;
  webhookName: string;
  eventType: string;
  status: 'delivered' | 'failed' | 'pending' | 'retrying';
  latencyMs?: number;
  httpStatusCode?: number;
  failureReason?: string;
  retryCount: number;
  payload?: Record<string, unknown>;
}

export type IntegrationDataType =
  | 'api'
  | 'webhook'
  | 'salesforce'
  | 'slack'
  | 'custom_api'
  | 'hubspot'
  | 'google'
  | 'zoom';

// ============================================
// PARSED DATA TYPES
// ============================================

export interface ParsedIntegrationData {
  customerId: string;
  customerName: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalApiCalls: number;
    totalWebhookDeliveries: number;
    integrationCount: number;
    integrations: string[];
  };
  apiCalls: IntegrationUsageRecord[];
  webhooks: WebhookDeliveryRecord[];
  parseErrors: string[];
}

// ============================================
// TECHNICAL HEALTH SCORE TYPES
// ============================================

export interface TechnicalHealthScore {
  customerId: string;
  customerName: string;
  overallScore: number;
  targetScore: number;
  trend: 'improving' | 'stable' | 'declining';
  previousScore?: number;
  scoreChange?: number;
  calculatedAt: string;
  components: TechnicalHealthComponents;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface TechnicalHealthComponents {
  apiSuccessRate: ComponentScore;
  latencyScore: ComponentScore;
  errorTrend: ComponentScore;
  webhookReliability: ComponentScore;
  authenticationHealth: ComponentScore;
}

export interface ComponentScore {
  score: number;
  weight: number;
  weightedScore: number;
  status: 'healthy' | 'warning' | 'critical';
  details: string;
  metrics: Record<string, number | string>;
}

// Component weights as per PRD
export const TECHNICAL_HEALTH_WEIGHTS = {
  apiSuccessRate: 0.30,
  latencyScore: 0.20,
  errorTrend: 0.20,
  webhookReliability: 0.15,
  authenticationHealth: 0.15,
} as const;

// ============================================
// INTEGRATION HEALTH BREAKDOWN
// ============================================

export interface IntegrationHealthBreakdown {
  integrationName: string;
  integrationType: IntegrationDataType;
  healthScore: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalCalls: number;
  errorCount: number;
  issues: IntegrationIssue[];
  status: 'healthy' | 'warning' | 'critical';
  slaStatus: 'ok' | 'warning' | 'breach';
  slaTarget?: number;
}

export interface IntegrationIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: IntegrationIssueType;
  title: string;
  description: string;
  affectedEndpoints?: string[];
  impact: string;
  detectedAt: string;
  firstOccurrence: string;
  count: number;
  trend: 'escalating' | 'stable' | 'improving';
}

export type IntegrationIssueType =
  | 'high_error_rate'
  | 'latency_degradation'
  | 'rate_limiting'
  | 'authentication_failure'
  | 'webhook_delivery_failure'
  | 'timeout_spike'
  | 'connection_refused'
  | 'ssl_certificate'
  | 'partial_outage';

// ============================================
// ERROR ANALYSIS TYPES
// ============================================

export interface ErrorAnalysis {
  errorCode: string;
  count: number;
  percentage: number;
  description: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  firstSeen: string;
  lastSeen: string;
  affectedEndpoints: string[];
  rootCauseHypothesis?: string;
}

export interface ErrorTrend {
  week: number;
  weekLabel: string;
  errorRate: number;
  errorCount: number;
  totalCalls: number;
}

// ============================================
// LATENCY ANALYSIS TYPES
// ============================================

export interface LatencyAnalysis {
  integrationName: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  maxMs: number;
  slaTargetMs: number;
  status: 'ok' | 'warning' | 'breach';
  breachPercentage?: number;
}

// ============================================
// WEBHOOK ANALYSIS TYPES
// ============================================

export interface WebhookAnalysis {
  webhookName: string;
  deliverySuccessRate: number;
  targetSuccessRate: number;
  totalDeliveries: number;
  failedDeliveries: number;
  avgRetries: number;
  failuresByReason: WebhookFailureReason[];
  failurePattern?: string;
  peakFailureTime?: string;
}

export interface WebhookFailureReason {
  reason: string;
  count: number;
  percentage: number;
}

// ============================================
// RISK ASSESSMENT TYPES
// ============================================

export interface TechnicalRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: TechnicalRiskFactor[];
  projectedImpact: string[];
  urgency: 'immediate' | 'this_week' | 'short_term' | 'monitor';
}

export interface TechnicalRiskFactor {
  factor: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  trend: 'escalating' | 'stable' | 'improving';
}

// ============================================
// RECOMMENDATION TYPES
// ============================================

export interface TechnicalRecommendation {
  id: string;
  priority: 'immediate' | 'short_term' | 'medium_term';
  category: 'rate_limit' | 'error_investigation' | 'performance' | 'authentication' | 'webhook' | 'architecture';
  title: string;
  description: string;
  expectedImpact: string;
  actionItems: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

// ============================================
// SUPPORT TICKET TYPES
// ============================================

export interface TechnicalSupportTicket {
  id?: string;
  ticketNumber?: string;
  customerId: string;
  customerName: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  subject: string;
  description: string;
  technicalData: TechnicalTicketData;
  recommendedActions: string[];
  createdAt: string;
  createdBy: string;
}

export interface TechnicalTicketData {
  errorRate: number;
  errorRateTrend: string;
  topErrors: ErrorAnalysis[];
  affectedIntegrations: string[];
  businessImpact: string;
  attachedReport?: string;
}

// ============================================
// TECHNICAL CALL TYPES
// ============================================

export interface TechnicalCallSchedule {
  id?: string;
  customerId: string;
  customerName: string;
  meetingTitle: string;
  proposedDate: string;
  duration: number;
  attendees: TechnicalCallAttendee[];
  agenda: string[];
  briefingDocument?: string;
}

export interface TechnicalCallAttendee {
  name: string;
  email: string;
  role: string;
  isRequired: boolean;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface TechnicalHealthResponse {
  success: boolean;
  data: {
    score: TechnicalHealthScore;
    integrations: IntegrationHealthBreakdown[];
    criticalIssues: IntegrationIssue[];
    warningIssues: IntegrationIssue[];
    riskAssessment: TechnicalRiskAssessment;
    recommendations: TechnicalRecommendation[];
    errorAnalysis: {
      topErrors: ErrorAnalysis[];
      errorTrends: ErrorTrend[];
    };
    latencyAnalysis: LatencyAnalysis[];
    webhookAnalysis: WebhookAnalysis[];
  };
  metadata: {
    dataRange: { start: string; end: string };
    totalRecordsAnalyzed: number;
    processingTimeMs: number;
  };
}
