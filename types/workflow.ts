/**
 * CSCX.AI Workflow Types
 * Unified onboarding workflow state machine
 */

// ============================================
// Workflow Phases
// ============================================

export type OnboardingPhase =
  | 'upload'           // Contract upload
  | 'parsing'          // AI extracting data
  | 'review'           // Human reviews extracted data
  | 'enriching'        // AI gathering additional intelligence
  | 'planning'         // AI generating onboarding plan
  | 'plan_review'      // Human reviews plan
  | 'executing'        // Agents actively working
  | 'monitoring'       // Ongoing monitoring post-onboarding
  | 'completed';       // Onboarding complete

// Phase transitions allowed
export const phaseTransitions: Record<OnboardingPhase, OnboardingPhase[]> = {
  'upload': ['parsing'],
  'parsing': ['review'],
  'review': ['enriching', 'planning'], // Can skip enrichment
  'enriching': ['planning'],
  'planning': ['plan_review'],
  'plan_review': ['executing', 'planning'], // Can regenerate plan
  'executing': ['monitoring', 'completed'],
  'monitoring': ['completed'],
  'completed': []
};

// ============================================
// Workflow State
// ============================================

export interface WorkflowState {
  phase: OnboardingPhase;
  previousPhase: OnboardingPhase | null;
  startedAt: Date;
  phaseStartedAt: Date;
  error: string | null;

  // Data collected at each phase
  contract?: ContractData;
  research?: CompanyResearch;
  plan?: OnboardingPlan;

  // Execution tracking
  completedTasks: string[];
  pendingApprovals: string[];
  activeAgents: string[];
}

// ============================================
// Contract Data
// ============================================

export interface ContractData {
  company_name: string;
  arr: number;
  contract_period?: string;
  entitlements?: Array<{
    description: string;
    quantity?: number;
    category?: string;
  }>;
  stakeholders?: Array<{
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }>;
  technical_requirements?: Array<{
    requirement: string;
    priority?: 'high' | 'medium' | 'low';
    status?: string;
  }>;
  contract_tasks?: Array<{
    task: string;
    owner?: string;
    status?: string;
  }>;
  pricing_terms?: {
    basePrice?: number;
    discounts?: string[];
    paymentTerms?: string;
  };
  missing_info?: string[];
  next_steps?: string[];
}

// ============================================
// Company Research
// ============================================

export interface CompanyResearch {
  company_name: string;
  summary?: string;
  industry?: string;
  headquarters?: string;
  employee_count?: number;
  funding?: {
    total?: number;
    lastRound?: string;
    investors?: string[];
  };
  leadership?: Array<{
    name: string;
    title: string;
    linkedIn?: string;
  }>;
  recentNews?: Array<{
    title: string;
    date: string;
    source: string;
    url?: string;
  }>;
  competitors?: string[];
  techStack?: string[];
  riskSignals?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

// ============================================
// Onboarding Plan
// ============================================

export interface OnboardingPlan {
  timeline_days: number;
  phases: Array<{
    name: string;
    days: string;
    description?: string;
    tasks: Array<{
      task: string;
      owner: string;
      status: 'pending' | 'in_progress' | 'completed' | 'blocked';
      dueDate?: string;
      dependencies?: string[];
    }>;
    milestones?: Array<{
      name: string;
      description: string;
      targetDate?: string;
    }>;
  }>;
  successCriteria?: string[];
  risks?: Array<{
    risk: string;
    mitigation: string;
  }>;
}

// ============================================
// Customer Context (for agents)
// ============================================

export interface CustomerContext {
  id?: string;
  name: string;
  arr: number;
  healthScore?: number;
  status?: 'active' | 'onboarding' | 'at_risk' | 'churned';
  products?: string[];
  stakeholders?: string[];
  contractPeriod?: string;
  technicalRequirements?: string[];
  tasks?: Array<{ task: string; status?: string }>;
  missingInfo?: string[];
  renewalDate?: string;
  csmName?: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
}

// ============================================
// Phase Metadata
// ============================================

export interface PhaseMetadata {
  phase: OnboardingPhase;
  title: string;
  description: string;
  icon: string;
  color: string;
  estimatedTime?: string;
}

export const phaseMetadata: Record<OnboardingPhase, PhaseMetadata> = {
  upload: {
    phase: 'upload',
    title: 'Upload Contract',
    description: 'Upload a PDF or paste contract text',
    icon: '📄',
    color: 'blue',
    estimatedTime: '< 1 min'
  },
  parsing: {
    phase: 'parsing',
    title: 'Analyzing',
    description: 'AI is extracting key information',
    icon: '🔍',
    color: 'yellow',
    estimatedTime: '10-30 sec'
  },
  review: {
    phase: 'review',
    title: 'Review Data',
    description: 'Review and correct extracted data',
    icon: '✅',
    color: 'green',
  },
  enriching: {
    phase: 'enriching',
    title: 'Gathering Intel',
    description: 'Researching company and stakeholders',
    icon: '🔎',
    color: 'purple',
    estimatedTime: '15-30 sec'
  },
  planning: {
    phase: 'planning',
    title: 'Creating Plan',
    description: 'Generating 30-60-90 day plan',
    icon: '📋',
    color: 'blue',
    estimatedTime: '10-20 sec'
  },
  plan_review: {
    phase: 'plan_review',
    title: 'Review Plan',
    description: 'Review and customize onboarding plan',
    icon: '📝',
    color: 'green',
  },
  executing: {
    phase: 'executing',
    title: 'Executing',
    description: 'Agents are actively working',
    icon: '🚀',
    color: 'cscx-accent',
  },
  monitoring: {
    phase: 'monitoring',
    title: 'Monitoring',
    description: 'Watching for risks and opportunities',
    icon: '📊',
    color: 'teal',
  },
  completed: {
    phase: 'completed',
    title: 'Complete',
    description: 'Onboarding successfully completed',
    icon: '🎉',
    color: 'green',
  }
};

// ============================================
// Workflow Actions
// ============================================

export type WorkflowAction =
  | { type: 'START_UPLOAD' }
  | { type: 'START_PARSING'; payload: { contract: File | string } }
  | { type: 'PARSING_COMPLETE'; payload: { data: ContractData } }
  | { type: 'PARSING_ERROR'; payload: { error: string } }
  | { type: 'START_ENRICHING' }
  | { type: 'ENRICHING_COMPLETE'; payload: { research: CompanyResearch } }
  | { type: 'START_PLANNING' }
  | { type: 'PLANNING_COMPLETE'; payload: { plan: OnboardingPlan } }
  | { type: 'APPROVE_PLAN' }
  | { type: 'REGENERATE_PLAN' }
  | { type: 'START_EXECUTION' }
  | { type: 'TASK_COMPLETED'; payload: { taskId: string } }
  | { type: 'ENTER_MONITORING' }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'RESET' };

// ============================================
// Workflow Reducer
// ============================================

export const workflowReducer = (
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState => {
  const now = new Date();

  switch (action.type) {
    case 'START_UPLOAD':
      return {
        ...state,
        phase: 'upload',
        previousPhase: state.phase,
        phaseStartedAt: now,
        error: null
      };

    case 'START_PARSING':
      return {
        ...state,
        phase: 'parsing',
        previousPhase: state.phase,
        phaseStartedAt: now,
        error: null
      };

    case 'PARSING_COMPLETE':
      return {
        ...state,
        phase: 'review',
        previousPhase: 'parsing',
        phaseStartedAt: now,
        contract: action.payload.data,
        error: null
      };

    case 'PARSING_ERROR':
      return {
        ...state,
        error: action.payload.error
      };

    case 'START_ENRICHING':
      return {
        ...state,
        phase: 'enriching',
        previousPhase: state.phase,
        phaseStartedAt: now
      };

    case 'ENRICHING_COMPLETE':
      return {
        ...state,
        phase: 'planning',
        previousPhase: 'enriching',
        phaseStartedAt: now,
        research: action.payload.research
      };

    case 'START_PLANNING':
      return {
        ...state,
        phase: 'planning',
        previousPhase: state.phase,
        phaseStartedAt: now
      };

    case 'PLANNING_COMPLETE':
      return {
        ...state,
        phase: 'plan_review',
        previousPhase: 'planning',
        phaseStartedAt: now,
        plan: action.payload.plan
      };

    case 'APPROVE_PLAN':
      return {
        ...state,
        phase: 'executing',
        previousPhase: 'plan_review',
        phaseStartedAt: now
      };

    case 'REGENERATE_PLAN':
      return {
        ...state,
        phase: 'planning',
        previousPhase: 'plan_review',
        phaseStartedAt: now,
        plan: undefined
      };

    case 'START_EXECUTION':
      return {
        ...state,
        phase: 'executing',
        previousPhase: state.phase,
        phaseStartedAt: now,
        activeAgents: ['orchestrator']
      };

    case 'TASK_COMPLETED':
      return {
        ...state,
        completedTasks: [...state.completedTasks, action.payload.taskId]
      };

    case 'ENTER_MONITORING':
      return {
        ...state,
        phase: 'monitoring',
        previousPhase: 'executing',
        phaseStartedAt: now
      };

    case 'COMPLETE_ONBOARDING':
      return {
        ...state,
        phase: 'completed',
        previousPhase: state.phase,
        phaseStartedAt: now,
        activeAgents: []
      };

    case 'RESET':
      return {
        phase: 'upload',
        previousPhase: null,
        startedAt: now,
        phaseStartedAt: now,
        error: null,
        completedTasks: [],
        pendingApprovals: [],
        activeAgents: []
      };

    default:
      return state;
  }
};

// ============================================
// Initial State
// ============================================

export const initialWorkflowState: WorkflowState = {
  phase: 'upload',
  previousPhase: null,
  startedAt: new Date(),
  phaseStartedAt: new Date(),
  error: null,
  completedTasks: [],
  pendingApprovals: [],
  activeAgents: []
};
