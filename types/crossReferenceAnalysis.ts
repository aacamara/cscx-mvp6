/**
 * Cross-Reference Analysis Types
 * PRD-021: Multi-File Upload Cross-Reference Analysis
 *
 * Types for multi-file upload processing, cross-source correlation detection,
 * unified timeline building, and holistic insight generation.
 */

// ============================================
// FILE PROCESSING TYPES
// ============================================

export type FileType =
  | 'usage_data'
  | 'support_tickets'
  | 'nps_survey'
  | 'meeting_notes'
  | 'invoices'
  | 'contracts'
  | 'emails'
  | 'unknown';

export type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'txt' | 'docx' | 'json';

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  format: FileFormat;
  detectedType: FileType;
  content: string; // base64 for binary, raw text for text files
  uploadedAt: string;
}

export interface FileProcessingResult {
  fileId: string;
  fileName: string;
  type: FileType;
  recordCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  keyMetrics: Record<string, string | number>;
  extractedEvents: TimelineEvent[];
  processingDuration: number;
  errors: string[];
  warnings: string[];
}

export interface MultiFileUploadResponse {
  sessionId: string;
  customerId: string;
  customerName: string;
  filesReceived: number;
  files: FileProcessingResult[];
  totalEvents: number;
  overallDateRange: {
    start: string | null;
    end: string | null;
  };
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

// ============================================
// TIMELINE TYPES
// ============================================

export type EventSource =
  | 'usage'
  | 'support'
  | 'nps'
  | 'meeting'
  | 'invoice'
  | 'contract'
  | 'email'
  | 'system';

export type EventSeverity = 'positive' | 'neutral' | 'warning' | 'critical';

export interface TimelineEvent {
  id: string;
  date: string;
  source: EventSource;
  type: string;
  title: string;
  description: string;
  severity: EventSeverity;
  metrics?: Record<string, string | number>;
  relatedEvents?: string[]; // IDs of related events
  confidence: number; // 0-1
}

export interface UnifiedTimeline {
  customerId: string;
  customerName: string;
  dateRange: {
    start: string;
    end: string;
  };
  events: TimelineEvent[];
  milestones: TimelineMilestone[];
  healthSnapshots: HealthSnapshot[];
}

export interface TimelineMilestone {
  date: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  significance: number; // 0-100
}

export interface HealthSnapshot {
  date: string;
  score: number;
  components: {
    usage: number;
    engagement: number;
    sentiment: number;
    financial: number;
  };
}

// ============================================
// CORRELATION TYPES
// ============================================

export type CorrelationType =
  | 'temporal'    // Events occurring in sequence
  | 'causal'      // One event leading to another
  | 'inverse'     // Negative correlation
  | 'clustering'  // Events occurring together
  | 'anomaly';    // Unexpected pattern breaks

export type CorrelationStrength = 'weak' | 'moderate' | 'strong' | 'very_strong';

export interface Correlation {
  id: string;
  type: CorrelationType;
  strength: CorrelationStrength;
  confidence: number; // 0-1
  sources: EventSource[];
  title: string;
  description: string;
  events: TimelineEvent[];
  chain: CorrelationChainLink[];
  insight: string;
  recommendation?: string;
}

export interface CorrelationChainLink {
  event: string;
  date: string;
  delayDays?: number;
  impact?: string;
}

export interface CorrelationPattern {
  patternId: string;
  name: string;
  description: string;
  frequency: number; // How often this pattern appears
  correlations: Correlation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================
// RISK & INSIGHT TYPES
// ============================================

export type RiskSignalType =
  | 'usage_decline'
  | 'support_spike'
  | 'nps_drop'
  | 'payment_delay'
  | 'engagement_decline'
  | 'sentiment_negative'
  | 'feature_adoption_failure'
  | 'stakeholder_change'
  | 'competitor_mention'
  | 'multi_signal';

export interface RiskSignal {
  type: RiskSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: EventSource | EventSource[];
  title: string;
  description: string;
  evidence: string[];
  detectedAt: string;
  impactScore: number; // 0-100
  urgency: number; // 0-100
}

export interface RootCauseAnalysis {
  primaryIssue: {
    title: string;
    description: string;
    triggeredAt: string;
    sources: EventSource[];
  };
  secondaryIssues: Array<{
    title: string;
    description: string;
    relationship: string;
  }>;
  cascadeChain: CorrelationChainLink[];
  confidenceScore: number;
}

export interface HolisticInsight {
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly' | 'recommendation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sources: EventSource[];
  supportingData: Record<string, string | number>;
  confidence: number;
  actionable: boolean;
  suggestedActions?: string[];
}

// ============================================
// ANALYSIS RESULT TYPES
// ============================================

export interface MultiSignalRiskAssessment {
  signalSources: Array<{
    source: EventSource;
    riskIndicator: string;
    weight: 'low' | 'medium' | 'high' | 'critical';
    score: number;
  }>;
  combinedRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  compoundingFactors: string[];
}

export interface CustomerHealthView {
  customerId: string;
  customerName: string;
  unifiedHealthScore: number;
  category: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  componentScores: {
    usage: number;
    support: number;
    sentiment: number;
    financial: number;
    engagement: number;
  };
  weightedFactors: Array<{
    factor: string;
    weight: number;
    score: number;
    contribution: number;
  }>;
}

export interface ActionRecommendation {
  priority: 'immediate' | 'short_term' | 'medium_term';
  timeframe: string;
  action: string;
  description: string;
  expectedOutcome: string;
  assignedTo?: string;
  relatedCorrelations: string[];
}

export interface CrossReferenceAnalysisResult {
  sessionId: string;
  customerId: string;
  customerName: string;
  analyzedAt: string;
  processingDuration: number;

  // File processing summary
  filesSummary: FileProcessingResult[];

  // Unified timeline
  timeline: UnifiedTimeline;

  // Correlations discovered
  correlations: Correlation[];
  patterns: CorrelationPattern[];

  // Risk assessment
  riskAssessment: MultiSignalRiskAssessment;
  riskSignals: RiskSignal[];
  rootCauseAnalysis: RootCauseAnalysis | null;

  // Customer health
  healthView: CustomerHealthView;

  // Insights and recommendations
  insights: HolisticInsight[];
  recommendations: ActionRecommendation[];

  // Executive summary
  executiveSummary: {
    headline: string;
    keyFindings: string[];
    criticalIssues: string[];
    opportunities: string[];
    nextSteps: string[];
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface MultiFileUploadRequest {
  customerId: string;
  files: Array<{
    fileName: string;
    mimeType: string;
    content: string; // base64 encoded
  }>;
  analyzeCorrelations?: boolean;
}

export interface CrossReferenceRequest {
  sessionId: string;
  options?: {
    correlationThreshold?: number; // 0-1, default 0.5
    maxCorrelations?: number; // default 50
    includeRootCause?: boolean;
    generateRecommendations?: boolean;
  };
}

export interface TimelineRequest {
  customerId: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  sources?: EventSource[];
  limit?: number;
}

export interface CorrelationsRequest {
  customerId: string;
  types?: CorrelationType[];
  minStrength?: CorrelationStrength;
  sources?: EventSource[];
}

// ============================================
// UI STATE TYPES
// ============================================

export interface CrossReferenceAnalysisState {
  // Upload state
  uploading: boolean;
  uploadProgress: number;
  uploadedFiles: UploadedFile[];

  // Processing state
  processing: boolean;
  processingStage: 'idle' | 'parsing' | 'analyzing' | 'correlating' | 'complete';
  processingProgress: number;

  // Results
  sessionId: string | null;
  result: CrossReferenceAnalysisResult | null;

  // Errors
  error: string | null;
  warnings: string[];
}

export interface CorrelationMapNode {
  id: string;
  label: string;
  type: EventSource;
  date: string;
  severity: EventSeverity;
  x?: number;
  y?: number;
}

export interface CorrelationMapEdge {
  id: string;
  source: string;
  target: string;
  type: CorrelationType;
  strength: CorrelationStrength;
  label?: string;
}

export interface CorrelationMapData {
  nodes: CorrelationMapNode[];
  edges: CorrelationMapEdge[];
}

// ============================================
// FILTER TYPES
// ============================================

export interface CrossReferenceFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  sources?: EventSource[];
  correlationTypes?: CorrelationType[];
  minConfidence?: number;
  severityFilter?: EventSeverity[];
  showOnlyCorrelated?: boolean;
}
