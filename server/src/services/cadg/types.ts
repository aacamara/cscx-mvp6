/**
 * Context-Aware Agentic Document Generation (CADG) Types
 *
 * This module defines all types for the CADG system, which enables intelligent
 * artifact generation with plan approval and context aggregation.
 */

// ============================================================================
// Task Types
// ============================================================================

export type TaskType =
  // Onboarding Specialist Cards
  | 'kickoff_plan'
  | 'milestone_plan'
  | 'stakeholder_map'
  | 'training_schedule'
  // Adoption Specialist Cards
  | 'usage_analysis'
  | 'feature_campaign'
  | 'champion_development'
  | 'training_program'
  // Renewal Specialist Cards
  | 'renewal_forecast'
  | 'value_summary'
  | 'expansion_proposal'
  | 'negotiation_brief'
  // Risk Specialist Cards
  | 'risk_assessment'
  | 'save_play'
  | 'escalation_report'
  | 'resolution_plan'
  // Strategic CSM Cards
  | 'qbr_generation'
  | 'executive_briefing'
  | 'account_plan'
  | 'transformation_roadmap'
  // General Mode Cards (portfolio-level, no customer required)
  | 'portfolio_dashboard'
  | 'team_metrics'
  | 'renewal_pipeline'
  | 'at_risk_overview'
  // Legacy/existing types
  | 'data_analysis'
  | 'presentation_creation'
  | 'document_creation'
  | 'email_drafting'
  | 'meeting_prep'
  | 'transcription_summary'
  | 'health_analysis'
  | 'expansion_planning'
  | 'custom';

export type PlanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';

export type ArtifactType =
  | 'slides'
  | 'docs'
  | 'sheets'
  | 'email'
  | 'chat';

export type OutputFormat =
  | 'google_slides'
  | 'google_docs'
  | 'google_sheets'
  | 'pdf'
  | 'markdown'
  | 'html';

// ============================================================================
// Capability Types
// ============================================================================

export type CapabilityCategory =
  | 'document_generation'
  | 'data_analysis'
  | 'communication'
  | 'scheduling'
  | 'research'
  | 'risk_management'
  | 'expansion'
  | 'onboarding'
  | 'renewal'
  | 'reporting'
  | 'integration'
  | 'workflow';

export interface CapabilityInput {
  name: string;
  type: 'string' | 'uuid' | 'number' | 'boolean' | 'string[]' | 'object';
  source: 'user' | 'context' | 'platform';
  required: boolean;
  description?: string;
}

export interface CapabilityOutput {
  type: ArtifactType;
  format: OutputFormat;
  description: string;
}

export interface CapabilityExecution {
  service: string;
  method: string;
  requiresApproval: boolean;
  estimatedDuration: string;
}

export interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;

  // How users ask for this
  triggerPatterns: string[];
  keywords: string[];
  examplePrompts: string[];

  // What's needed
  requiredInputs: CapabilityInput[];

  // What it produces
  outputs: CapabilityOutput[];

  // How to execute
  execution: CapabilityExecution;

  // Related capabilities
  relatedCapabilities: string[];
  prerequisites: string[];

  enabled: boolean;
}

// ============================================================================
// Methodology Types
// ============================================================================

export interface MethodologyStep {
  order: number;
  name: string;
  description: string;
  actions: string[];
  dataNeeded: string[];
  tips: string[];
}

export interface MethodologyTemplate {
  name: string;
  format: string;
  content: string;
}

export interface MethodologyExample {
  scenario: string;
  input: Record<string, unknown>;
  output: string;
}

export interface Methodology {
  id: string;
  name: string;
  category: string;
  applicableTo: string[]; // Capability IDs

  steps: MethodologyStep[];
  qualityCriteria: string[];
  commonMistakes: string[];
  templates: MethodologyTemplate[];
  examples: MethodologyExample[];
}

// ============================================================================
// Context Aggregation Types
// ============================================================================

export interface PlaybookMatch {
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
  category: string;
}

export interface TemplateMatch {
  id: string;
  name: string;
  format: string;
  relevanceScore: number;
}

export interface BestPracticeMatch {
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
}

export interface Customer360 {
  id: string;
  name: string;
  arr: number;
  tier: string;
  status: string;
  healthScore: number;
  npsScore?: number;
  industryCode?: string;
  renewalDate?: string;
}

export interface HealthTrend {
  date: string;
  score: number;
  components: {
    engagement?: number;
    adoption?: number;
    support?: number;
    payment?: number;
  };
}

export interface EngagementMetrics {
  dauMau: number;
  featureAdoption: number;
  loginFrequency: number;
  lastActivityDays: number;
}

export interface RiskSignal {
  type: 'churn' | 'engagement' | 'sentiment' | 'support' | 'payment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  recommendation: string;
}

export interface Interaction {
  id: string;
  type: 'meeting' | 'email' | 'call' | 'ticket' | 'note';
  date: string;
  summary: string;
  participants?: string[];
  outcome?: string;
}

export interface RenewalForecast {
  probability: number;
  expansionPotential: number;
  riskFactors: string[];
  recommendedActions: string[];
  daysUntilRenewal: number;
}

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  createdAt: string;
  modifiedAt: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  participants: string[];
  date: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
}

export interface PreviousArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  createdAt: string;
  driveUrl?: string;
}

export interface AggregatedContext {
  // Knowledge base results
  knowledge: {
    playbooks: PlaybookMatch[];
    templates: TemplateMatch[];
    bestPractices: BestPracticeMatch[];
  };

  // Platform data
  platformData: {
    customer360: Customer360 | null;
    healthTrends: HealthTrend[];
    engagementMetrics: EngagementMetrics | null;
    riskSignals: RiskSignal[];
    interactionHistory: Interaction[];
    renewalForecast: RenewalForecast | null;
  };

  // External sources
  externalSources: {
    driveDocuments: DriveDocument[];
    emailThreads: EmailThread[];
    calendarEvents: CalendarEvent[];
    previousArtifacts: PreviousArtifact[];
  };

  // Metadata
  metadata: {
    sourcesSearched: string[];
    relevanceScores: Record<string, number>;
    gatheringDurationMs: number;
  };
}

// ============================================================================
// Execution Plan Types
// ============================================================================

export interface PlanInput {
  title: string;
  relevance: number;
  usage: string; // How it will be used
}

export interface PlanDataSource {
  source: string;
  dataPoints: string[];
  usage: string;
}

export interface PlanExternalSource {
  type: 'drive' | 'email' | 'calendar';
  name: string;
  usage: string;
}

export interface PlanSection {
  name: string;
  description: string;
  dataSources: string[];
}

export interface PlanAction {
  step: number;
  action: string;
  requiresApproval: boolean;
}

export interface PlanDestination {
  primary: string; // e.g., "Google Slides in customer folder"
  secondary?: string; // e.g., "PDF copy"
  chatPreview: boolean;
}

export interface ExecutionPlan {
  planId: string;
  taskType: TaskType;

  // What we're using
  inputs: {
    knowledgeBase: PlanInput[];
    platformData: PlanDataSource[];
    externalSources: PlanExternalSource[];
  };

  // How we'll structure the output
  structure: {
    sections: PlanSection[];
    outputFormat: ArtifactType;
    estimatedLength: string;
  };

  // What actions we'll take
  actions: PlanAction[];

  // Where output goes
  destination: PlanDestination;
}

// ============================================================================
// Generated Artifact Types
// ============================================================================

export interface ArtifactStorage {
  driveFileId?: string;
  driveUrl?: string;
  localPath?: string;
}

export interface ArtifactMetadata {
  generatedAt: Date;
  planId: string;
  customerId: string;
  sourcesUsed: string[];
  generationDurationMs: number;
}

export interface GeneratedArtifact {
  artifactId: string;
  type: ArtifactType;

  // Content
  content: string | Buffer;
  preview: string; // Markdown preview for chat

  // Storage
  storage: ArtifactStorage;

  // Metadata
  metadata: ArtifactMetadata;
}

// ============================================================================
// Service Types
// ============================================================================

export interface TaskClassificationResult {
  taskType: TaskType;
  confidence: number;
  suggestedMethodology: string | null;
  requiredSources: string[];
}

export interface CapabilityMatchResult {
  capability: Capability | null;
  confidence: number;
  methodology: Methodology | null;
  relevantKnowledge: PlaybookMatch[];
}

export interface PlanApprovalResult {
  planId: string;
  status: PlanStatus;
  modifications?: PlanModification[];
  approvedBy?: string;
  approvedAt?: Date;
}

export interface PlanModification {
  field: string;
  originalValue: unknown;
  newValue: unknown;
  reason?: string;
}

// ============================================================================
// Database Types (for Supabase queries)
// ============================================================================

export interface ExecutionPlanRow {
  id: string;
  user_id: string;
  customer_id: string | null;
  task_type: TaskType;
  user_query: string;
  plan_json: ExecutionPlan;
  context_summary: Partial<AggregatedContext> | null;
  status: PlanStatus;
  approved_at: string | null;
  approved_by: string | null;
  modifications: PlanModification[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedArtifactRow {
  id: string;
  plan_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  artifact_type: ArtifactType;
  title: string;
  drive_file_id: string | null;
  drive_url: string | null;
  preview_markdown: string | null;
  content_hash: string | null;
  sources_used: string[] | null;
  generation_duration_ms: number | null;
  created_at: string;
}

export interface CapabilityRow {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string | null;
  trigger_patterns: string[];
  keywords: string[];
  example_prompts: string[];
  required_inputs: CapabilityInput[];
  outputs: CapabilityOutput[];
  execution: CapabilityExecution;
  related_capabilities: string[];
  prerequisites: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MethodologyRow {
  id: string;
  name: string;
  category: string;
  applicable_to: string[];
  steps: MethodologyStep[];
  quality_criteria: string[];
  common_mistakes: string[];
  templates: MethodologyTemplate[];
  examples: MethodologyExample[];
  created_at: string;
  updated_at: string;
}
