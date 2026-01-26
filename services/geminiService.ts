/**
 * API Service for CSCX.AI
 * This service calls the backend API which uses Claude for AI operations.
 * Previously used Gemini directly from the frontend - now proxied through backend.
 */

import {
    ContractExtraction,
    CompanyResearch,
    OnboardingPlan,
    EmailDraft,
    MeetingAgenda,
    Entitlement,
    Stakeholder,
    ContractInput,
} from '../types';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Parse a contract document (text or file)
 * Calls the backend which uses Claude for parsing
 */
export const parseContract = async (input: ContractInput): Promise<ContractExtraction> => {
    try {
        const response = await fetch(`${API_URL}/api/contracts/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: input.type,
                content: input.content,
                mimeType: input.mimeType,
                fileName: input.fileName
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to parse contract');
        }

        const data = await response.json();
        return data.contractData as ContractExtraction;
    } catch (error) {
        console.error('Contract parsing error:', error);
        throw error;
    }
};

/**
 * Parse contract and get all insights (summary, research, plan)
 * Returns full parsed result from backend
 */
export const parseContractFull = async (input: ContractInput): Promise<{
    contractData: ContractExtraction;
    summary: string;
    research: CompanyResearch;
    plan: OnboardingPlan;
    confidence: number;
}> => {
    try {
        const response = await fetch(`${API_URL}/api/contracts/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: input.type,
                content: input.content,
                mimeType: input.mimeType,
                fileName: input.fileName
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to parse contract');
        }

        const data = await response.json();

        // Handle research being returned as array from backend
        const research = Array.isArray(data.research) ? data.research[0] : data.research;

        return {
            ...data,
            research
        };
    } catch (error) {
        console.error('Contract parsing error:', error);
        throw error;
    }
};

/**
 * Upload a contract file directly
 * Uses FormData for multipart upload
 */
export const uploadContract = async (file: File): Promise<{
    id: string;
    contractData: ContractExtraction;
    summary: string;
    research: CompanyResearch;
    plan: OnboardingPlan;
    confidence: number;
}> => {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/api/contracts/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to upload contract');
        }

        return await response.json();
    } catch (error) {
        console.error('Contract upload error:', error);
        throw error;
    }
};

/**
 * Generate executive summary for parsed contract
 * Calls backend Claude API
 */
export const generateSummary = async (extraction: ContractExtraction): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/api/contracts/summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ extraction })
        });

        if (!response.ok) {
            // Fallback: generate locally formatted summary
            return generateLocalSummary(extraction);
        }

        const data = await response.json();
        return data.summary;
    } catch (error) {
        console.error('Summary generation error:', error);
        // Fallback to local summary
        return generateLocalSummary(extraction);
    }
};

/**
 * Local fallback summary generator
 */
const generateLocalSummary = (extraction: ContractExtraction): string => {
    const entitlements = extraction.entitlements?.map(e => `- ${e.type}: ${e.quantity}`).join('\n') || 'None listed';
    const stakeholders = extraction.stakeholders?.map(s => `- ${s.name} (${s.role})`).join('\n') || 'None listed';

    return `## Key Details
- **Company:** ${extraction.company_name}
- **ARR:** $${extraction.arr?.toLocaleString()}
- **Contract Period:** ${extraction.contract_period}

## Entitlements
${entitlements}

## Key Stakeholders
${stakeholders}

## Next Steps
${extraction.next_steps || 'Review contract details and schedule kickoff meeting.'}

## Risk Factors
${extraction.missing_info?.length > 0 ? extraction.missing_info.map(m => `- ${m}`).join('\n') : 'No critical issues identified.'}`;
};

/**
 * Research company information
 * Calls backend Claude API
 */
export const researchCompany = async (companyName: string): Promise<CompanyResearch> => {
    try {
        const response = await fetch(`${API_URL}/api/research/company`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ companyName })
        });

        if (!response.ok) {
            // Return placeholder data
            return generatePlaceholderResearch(companyName);
        }

        const data = await response.json();
        return data.research;
    } catch (error) {
        console.error('Company research error:', error);
        return generatePlaceholderResearch(companyName);
    }
};

/**
 * Placeholder company research when API unavailable
 */
const generatePlaceholderResearch = (companyName: string): CompanyResearch => ({
    company_name: companyName,
    domain: `${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    industry: 'Technology',
    employee_count: 500,
    tech_stack: ['Cloud Infrastructure', 'Modern SaaS Stack', 'API Integrations'],
    recent_news: ['Expanding into new markets', 'Digital transformation initiatives'],
    key_initiatives: ['Customer experience improvement', 'Operational efficiency'],
    competitors: ['Industry leaders in their space'],
    overview: `${companyName} is a growing company focused on innovation and customer success.`
});

/**
 * Create onboarding plan
 * Calls backend Claude API
 */
export const createOnboardingPlan = async (
    accountData: { name: string; arr: number },
    entitlements: Entitlement[],
    stakeholders: Stakeholder[],
    timelineDays: number = 90
): Promise<OnboardingPlan> => {
    try {
        const response = await fetch(`${API_URL}/api/plans/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accountData,
                entitlements,
                stakeholders,
                timelineDays
            })
        });

        if (!response.ok) {
            // Return default plan structure
            return generateDefaultPlan(accountData, entitlements, stakeholders, timelineDays);
        }

        const data = await response.json();
        return data.plan;
    } catch (error) {
        console.error('Plan generation error:', error);
        return generateDefaultPlan(accountData, entitlements, stakeholders, timelineDays);
    }
};

/**
 * Default plan when API unavailable
 */
const generateDefaultPlan = (
    accountData: { name: string; arr: number },
    entitlements: Entitlement[],
    stakeholders: Stakeholder[],
    timelineDays: number
): OnboardingPlan => ({
    timeline_days: timelineDays,
    phases: [
        {
            name: 'Foundation (Days 1-30)',
            description: 'Establish relationship and complete initial setup',
            tasks: [
                {
                    title: 'Kickoff Meeting',
                    description: `Schedule and conduct kickoff meeting with ${accountData.name}`,
                    owner: 'CSM',
                    due_days: 5,
                    success_criteria: 'All key stakeholders attend, next steps defined'
                },
                {
                    title: 'Technical Setup',
                    description: 'Complete initial technical configuration',
                    owner: 'SA',
                    due_days: 14,
                    success_criteria: 'Core integrations working'
                },
                {
                    title: 'Initial Training',
                    description: 'Conduct training for primary users',
                    owner: 'CSM',
                    due_days: 21,
                    success_criteria: 'Users can perform basic operations'
                }
            ],
            success_metrics: ['First login within 7 days', 'Technical setup complete']
        },
        {
            name: 'Adoption (Days 31-60)',
            description: 'Drive usage and value realization',
            tasks: [
                {
                    title: 'Value Check-in',
                    description: 'Review progress and address any blockers',
                    owner: 'CSM',
                    due_days: 45,
                    success_criteria: 'Customer confirms value being delivered'
                },
                {
                    title: 'Advanced Training',
                    description: 'Train on advanced features',
                    owner: 'CSM',
                    due_days: 50,
                    success_criteria: 'Power users identified and trained'
                }
            ],
            success_metrics: ['50% of users active', 'First success metric achieved']
        },
        {
            name: 'Optimization (Days 61-90)',
            description: 'Expand usage and identify growth opportunities',
            tasks: [
                {
                    title: 'QBR Preparation',
                    description: 'Prepare for first quarterly business review',
                    owner: 'CSM',
                    due_days: 80,
                    success_criteria: 'ROI metrics documented'
                },
                {
                    title: 'Expansion Discussion',
                    description: 'Discuss additional use cases',
                    owner: 'AE',
                    due_days: 85,
                    success_criteria: 'Expansion opportunities identified'
                }
            ],
            success_metrics: ['Customer satisfaction score >8', 'Expansion pipeline generated']
        }
    ],
    risk_factors: [
        'Stakeholder availability for meetings',
        'Technical integration complexity',
        'Change management within customer organization'
    ],
    opportunities: [
        `Expand ${entitlements[0]?.type || 'product'} usage across teams`,
        'Cross-sell additional products',
        'Case study potential based on success'
    ],
    recommended_touchpoints: [
        'Day 1: Welcome email',
        'Day 5: Kickoff meeting',
        'Day 14: Technical check-in',
        'Day 30: First month review',
        'Day 60: Mid-quarter check-in',
        'Day 90: QBR'
    ]
});

/**
 * Generate welcome email
 * Calls backend Claude API
 */
export const generateWelcomeEmail = async (
    stakeholder: Stakeholder,
    account: { name: string; arr: number },
    research_data: CompanyResearch
): Promise<Omit<EmailDraft, 'stakeholderName' | 'status'>> => {
    try {
        const response = await fetch(`${API_URL}/api/emails/welcome`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stakeholder,
                account,
                research_data
            })
        });

        if (!response.ok) {
            return generateDefaultWelcomeEmail(stakeholder, account);
        }

        const data = await response.json();
        return data.email;
    } catch (error) {
        console.error('Email generation error:', error);
        return generateDefaultWelcomeEmail(stakeholder, account);
    }
};

/**
 * Default welcome email when API unavailable
 */
const generateDefaultWelcomeEmail = (
    stakeholder: Stakeholder,
    account: { name: string; arr: number }
): Omit<EmailDraft, 'stakeholderName' | 'status'> => ({
    subject: `Welcome to CSCX.AI - Let's Get Started, ${account.name}!`,
    body: `Hi {{stakeholder_name}},

Welcome to CSCX.AI! We're thrilled to have {{company_name}} on board.

I'm your dedicated Customer Success Manager, and I'm here to ensure you get maximum value from our platform.

Here's what happens next:
1. I'll reach out to schedule our kickoff meeting
2. We'll discuss your goals and success criteria
3. We'll create a personalized onboarding plan

In the meantime, feel free to explore our getting started guide.

Looking forward to partnering with you!

Best regards,
Your CSCX.AI Team`,
    variables: {
        stakeholder_name: stakeholder.name,
        company_name: account.name
    },
    ai_suggestions: [
        'Add specific product features based on their entitlements',
        'Reference their industry for personalization',
        'Include calendar link for easy scheduling'
    ],
    tone: 'Professional and warm'
});

/**
 * Create kickoff meeting agenda
 * Calls backend Claude API
 */
export const createKickoffAgenda = async (
    account: { name: string; arr: number },
    attendees: string[]
): Promise<MeetingAgenda> => {
    try {
        const response = await fetch(`${API_URL}/api/meetings/agenda`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                account,
                attendees,
                meetingType: 'kickoff'
            })
        });

        if (!response.ok) {
            return generateDefaultKickoffAgenda(account, attendees);
        }

        const data = await response.json();
        return data.agenda;
    } catch (error) {
        console.error('Agenda generation error:', error);
        return generateDefaultKickoffAgenda(account, attendees);
    }
};

/**
 * Default kickoff agenda when API unavailable
 */
const generateDefaultKickoffAgenda = (
    account: { name: string; arr: number },
    attendees: string[]
): MeetingAgenda => ({
    meeting_title: `${account.name} Kickoff Meeting`,
    objectives: [
        'Introduce the CSCX.AI team and understand your team structure',
        'Align on success criteria and key metrics',
        'Review the 90-day onboarding plan',
        'Establish communication cadence'
    ],
    agenda_items: [
        { time: '0-10 min', topic: 'Introductions and agenda overview', owner: 'CSM' },
        { time: '10-25 min', topic: 'Customer goals and success criteria', owner: 'Customer' },
        { time: '25-40 min', topic: 'Product overview and roadmap alignment', owner: 'CSM' },
        { time: '40-50 min', topic: 'Technical requirements and integration planning', owner: 'SA' },
        { time: '50-60 min', topic: 'Next steps and action items', owner: 'CSM' }
    ],
    pre_read_materials: [
        'Product overview deck',
        'Getting started guide',
        'Integration documentation'
    ],
    discussion_questions: [
        'What does success look like for your team in 90 days?',
        'Who are the key stakeholders we should involve?',
        'What integrations are most critical for your workflow?',
        'Are there any upcoming deadlines we should be aware of?'
    ],
    expected_outcomes: [
        'Agreed success criteria documented',
        'Initial training sessions scheduled',
        'Technical setup timeline confirmed',
        'Communication plan established'
    ]
});

// ============================================
// Onboarding Workspace Creation
// ============================================

export interface OnboardingWorkspaceResult {
    customerId: string;
    driveRootId: string;
    driveFolders: {
        root: string;
        onboarding: string;
        meetings: string;
        qbrs: string;
        contracts: string;
        reports: string;
    };
    sheetId: string;
    sheetUrl: string;
    contractFileId?: string;
}

/**
 * Create Google Workspace for new customer onboarding
 * Creates Drive folder structure and Sheets tracker
 */
export const createOnboardingWorkspace = async (
    userId: string,
    customerName: string,
    contractData: ContractExtraction,
    originalDocument?: {
        fileName: string;
        mimeType: string;
        content: string; // base64
    },
    contractId?: string
): Promise<OnboardingWorkspaceResult> => {
    try {
        const response = await fetch(`${API_URL}/api/onboarding/workspace`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
            },
            body: JSON.stringify({
                contractId,
                customerName,
                contractData,
                originalDocument,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create onboarding workspace');
        }

        return await response.json();
    } catch (error) {
        console.error('Onboarding workspace creation error:', error);
        throw error;
    }
};
