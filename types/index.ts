/**
 * CSCX.AI Types - Barrel Export
 * Re-exports all types from type definition files
 * Note: Some types are overridden here to match server responses
 */

// Re-export workflow types (excluding conflicting ones)
export {
  OnboardingPhase,
  phaseTransitions,
  WorkflowState,
  ContractData,
  phaseMetadata,
  PhaseMetadata,
  WorkflowAction,
  workflowReducer,
  initialWorkflowState,
  CustomerContext,
} from './workflow';

// Re-export all agent types
export * from './agents';

// Re-export all workspace agent types (includes EmailDraft, etc.)
// But exclude conflicting ones like OnboardingPlan, MeetingAgenda
export {
  WorkspaceConnection,
  ServiceStatus,
  EmailThread,
  EmailParticipant,
  EmailDraft,
  EmailAttachment,
  EmailPurpose,
  EmailTemplate,
  EmailLabel,
  CalendarEvent,
  EventAttendee,
  EventReminder,
  RecurrenceRule,
  MeetingType,
  AvailabilitySlot,
  MeetingProposal,
  DriveDocument,
  DocumentCategory,
  FilePermission,
  CustomerFolder,
  FolderStructure,
  GoogleDoc,
  DocComment,
  SuggestedEdit,
  DocTemplate,
  DocTemplateType,
  DocCreateRequest,
  GoogleSheet,
  SheetTab,
  SheetData,
  SheetCreateRequest,
  SheetTabConfig,
  SheetFormatting,
  ConditionalFormat,
  GoogleSlides,
  Slide,
  SlideLayout,
  SlideElement,
  SlidesCreateRequest,
  SlideConfig,
  MeetingPlatform,
  MeetingRecording,
  MeetingParticipant,
  MeetingTranscript,
  TranscriptSegment,
  MeetingSummary,
  ActionItem,
  CustomerSignal,
  VoiceConfig,
  TranscriptionRequest,
  TranscriptionResult,
  SpeechSynthesisRequest,
  MeetingBot,
  MeetingBotCapability,
  HealthScore,
  HealthSignals,
  UsageSignal,
  EngagementSignal,
  SupportSignal,
  NPSSignal,
  ContractSignal,
  StakeholderSignal,
  HealthFactor,
  HealthScoreAlert,
  QBRPackage,
  QBRSection,
  QBRSectionType,
  QBRGenerateRequest,
  RenewalPlaybook,
  RenewalStage,
  RenewalAction,
  RenewalReminder,
  OnboardingMilestone,
  OnboardingStakeholder,
  SuccessMetric,
  OnboardingResource,
  AppsScript,
  ScriptTrigger,
  TriggerType,
  TriggerConfig,
  ScriptTemplate,
  CustomerKnowledge,
  CustomerContact,
  ContractInfo,
  CustomerInteraction,
  RiskEntry,
  OpportunityEntry,
  TimelineEntry,
  KnowledgeEntryType,
  CustomerInsight,
  WorkspaceAction,
  DocEditOperation,
  SlideEditOperation,
  ActionResult,
  WorkspacePreference,
  AgentMemory,
  AgentAction,
  LearnedPattern,
  SessionContext,
  PendingApproval,
  ConversationEntry,
  QuickAction,
  QuickActionCategory,
  CSM_QUICK_ACTIONS,
  WorkspaceContext,
  WorkflowExecution,
  WorkflowStep,
  WorkflowTemplate,
  WorkflowDefinition,
  WorkflowTrigger,
} from './workspaceAgent';

// Re-export agent builder types
export * from './agentBuilder';

// Re-export knowledge base types
export * from './knowledgeBase';

// ============================================
// Frontend types matching server responses
// These MUST match server/src/services/claude.ts
// ============================================

/**
 * Input for contract parsing
 */
export interface ContractInput {
  type: 'text' | 'file';
  content: string;
  mimeType?: string;
  fileName?: string;
}

/**
 * Extracted contract data from AI parsing
 * Matches server/src/services/claude.ts ContractExtraction
 */
export interface ContractExtraction {
  company_name: string;
  arr: number;
  contract_period: string;
  entitlements: Array<{
    type: string;
    description: string;
    quantity: string;
    start_date: string;
    end_date: string;
    dependencies: string;
  }>;
  stakeholders: Array<{
    name: string;
    role: string;
    department: string;
    contact: string;
    responsibilities: string;
    approval_required: boolean;
  }>;
  technical_requirements: Array<{
    requirement: string;
    type: string;
    priority: 'High' | 'Medium' | 'Low';
    owner: string;
    status: string;
    due_date: string;
  }>;
  contract_tasks: Array<{
    task: string;
    description: string;
    assigned_agent: string;
    priority: 'High' | 'Medium' | 'Low';
    dependencies: string;
    due_date: string;
  }>;
  pricing_terms: Array<{
    item: string;
    description: string;
    quantity: string;
    unit_price: string;
    total: string;
    payment_terms: string;
  }>;
  missing_info: string[];
  next_steps: string;
  confidence_scores?: Record<string, number>;
}

/**
 * Company research data
 * Matches server/src/services/claude.ts CompanyResearch
 */
export interface CompanyResearch {
  company_name: string;
  domain: string;
  industry: string;
  employee_count: number;
  tech_stack: string[];
  recent_news: string[];
  key_initiatives: string[];
  competitors: string[];
  overview: string;
}

/**
 * Onboarding plan structure
 * Matches server/src/services/claude.ts OnboardingPlan
 */
export interface OnboardingPlan {
  timeline_days: number;
  phases: Array<{
    name: string;
    days?: string;
    description?: string;
    tasks: Array<{
      task: string;
      title?: string;
      description?: string;
      owner: string;
      due_days?: number;
      status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
      dueDate?: string;
      dependencies?: string[];
      success_criteria?: string;
    }>;
    success_metrics?: string[];
    milestones?: Array<{
      name: string;
      description: string;
      targetDate?: string;
    }>;
  }>;
  risk_factors?: string[];
  opportunities?: string[];
  recommended_touchpoints?: string[];
  successCriteria?: string[];
  risks?: Array<{
    risk: string;
    mitigation: string;
  }>;
}

/**
 * Onboarding phase detail (for plan view)
 */
export interface OnboardingPhaseDetail {
  name: string;
  days?: string;
  description?: string;
  tasks: OnboardingTask[];
  milestones?: Array<{
    name: string;
    description: string;
    targetDate?: string;
  }>;
}

/**
 * Onboarding task
 */
export interface OnboardingTask {
  task: string;
  title?: string;
  description?: string;
  owner: string;
  due_days?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dueDate?: string;
  dependencies?: string[];
  success_criteria?: string;
}

/**
 * Stakeholder from contract
 */
export interface Stakeholder {
  name: string;
  role: string;
  department?: string;
  contact?: string;
  email?: string;
  phone?: string;
  responsibilities?: string;
  approval_required?: boolean;
  is_decision_maker?: boolean;
  notes?: string;
}

/**
 * Contract entitlement
 */
export interface Entitlement {
  type?: string;
  name?: string;
  description?: string;
  quantity?: number | string;
  unit?: string;
  limit?: string;
  start_date?: string;
  end_date?: string;
  dependencies?: string;
}

/**
 * Technical requirement from contract
 */
export interface TechnicalRequirement {
  requirement: string;
  type?: string;
  category?: string;
  priority?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low';
  owner?: string;
  status?: string;
  due_date?: string;
  notes?: string;
}

/**
 * Pricing line item
 */
export interface PricingItem {
  item: string;
  description?: string;
  quantity?: string;
  unit_price?: string;
  total?: string;
  amount?: number;
  frequency?: string;
  payment_terms?: string;
  discount?: number;
}

/**
 * Meeting agenda
 */
export interface MeetingAgenda {
  title?: string;
  meeting_title?: string;
  duration?: number;
  presenter?: string;
  notes?: string;
  items?: string[];
  objectives?: string[];
  agenda_items?: Array<{
    topic: string;
    duration?: number;
    presenter?: string;
  }>;
}
