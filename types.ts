
export enum WorkflowState {
    Idle,
    Parsing,
    Generating,
    Ready,
    Error,
}

export interface ContractInput {
    type: 'text' | 'file';
    content: string; // raw text or base64 string (without data URI prefix)
    mimeType?: string;
    fileName?: string; // For display purposes
}

export interface Entitlement {
    type?: string;
    description: string;
    quantity?: string | number;
    start_date?: string;
    end_date?: string;
    dependencies?: string;
    category?: string;
}

export interface Stakeholder {
    name: string;
    role: string;
    department?: string;
    contact?: string;
    email?: string;
    phone?: string;
    responsibilities?: string;
    approval_required?: boolean;
}

export interface TechnicalRequirement {
    requirement: string;
    type?: string;
    priority?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low';
    owner?: string;
    status?: string;
    due_date?: string;
}

export type AgentType = 'Provisioning Agent' | 'Finance Agent' | 'Compliance Agent' | 'Onboarding Agent' | 'Success Agent' | string;

export interface ContractTask {
    task: string;
    description?: string;
    owner?: string;
    assigned_agent?: AgentType;
    priority?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low';
    dependencies?: string;
    due_date?: string;
    status?: string;
}

export interface PricingItem {
    item?: string;
    description?: string;
    quantity?: string;
    unit_price?: string;
    total?: string;
    payment_terms?: string;
    basePrice?: number;
    discounts?: string[];
    paymentTerms?: string;
}

export interface ContractExtraction {
    company_name: string;
    arr: number;
    contract_period?: string;
    entitlements?: Entitlement[];
    stakeholders?: Stakeholder[];
    technical_requirements?: TechnicalRequirement[];
    contract_tasks?: ContractTask[];
    pricing_terms?: PricingItem[] | PricingItem;
    missing_info?: string[];
    next_steps?: string | string[];
}

export interface CompanyResearch {
    company_name: string;
    domain?: string;
    industry?: string;
    employee_count?: number;
    tech_stack?: string[];
    recent_news?: string[];
    key_initiatives?: string[];
    competitors?: string[];
    overview?: string;
    summary?: string;
    headquarters?: string;
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
    techStack?: string[];
    riskSignals?: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
    }>;
}

export interface OnboardingTask {
    title?: string;
    task?: string;
    description?: string;
    owner?: 'CSM' | 'AE' | 'SA' | 'Customer' | string;
    due_days?: number;
    dueDate?: string;
    success_criteria?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | string;
    dependencies?: string[];
}

export interface OnboardingPhase {
    name: string;
    days?: string;
    description?: string;
    tasks: OnboardingTask[];
    success_metrics?: string[];
    milestones?: Array<{
        name: string;
        description: string;
        targetDate?: string;
    }>;
}

export interface OnboardingPlan {
    timeline_days: number;
    phases: OnboardingPhase[];
    risk_factors?: string[];
    opportunities?: string[];
    recommended_touchpoints?: string[];
    successCriteria?: string[];
    risks?: Array<{
        risk: string;
        mitigation: string;
    }>;
}

export interface EmailDraft {
    stakeholderName: string;
    subject: string;
    body: string;
    variables: Record<string, string>;
    ai_suggestions: string[];
    tone: string;
    status: 'draft' | 'sent';
}

export interface AgendaItem {
    time: string;
    topic: string;
    owner: string;
}

export interface MeetingAgenda {
    meeting_title: string;
    objectives: string[];
    agenda_items: AgendaItem[];
    pre_read_materials: string[];
    discussion_questions: string[];
    expected_outcomes: string[];
}
