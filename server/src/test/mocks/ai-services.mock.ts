import { vi } from 'vitest';

// Type definitions for contract extraction
export interface MockContractExtraction {
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
    name: string;
    priority: string;
    owner: string;
    status: string;
    due_date: string;
  }>;
  contract_tasks: Array<{
    task: string;
    owner: string;
    due_date: string;
    priority: string;
  }>;
  pricing_terms: Array<{
    item: string;
    amount: number;
    frequency: string;
  }>;
  missing_info: string[];
  next_steps: string;
  confidence_scores: Record<string, number>;
}

export interface MockCompanyResearch {
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

export interface MockOnboardingPlan {
  timeline_days: number;
  phases: Array<{
    name: string;
    description: string;
    tasks: Array<{
      title: string;
      description: string;
      owner: string;
      due_days: number;
      success_criteria: string;
    }>;
    success_metrics: string[];
  }>;
  risk_factors: string[];
  opportunities: string[];
  recommended_touchpoints: string[];
}

// Mock data
export const mockContractExtraction: MockContractExtraction = {
  company_name: 'Test Corporation',
  arr: 150000,
  contract_period: '12 months',
  entitlements: [
    {
      type: 'Enterprise License',
      description: 'Full platform access',
      quantity: '50 users',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      dependencies: 'None'
    }
  ],
  stakeholders: [
    {
      name: 'John Doe',
      role: 'Champion',
      department: 'IT',
      contact: 'john@test.com',
      responsibilities: 'Main POC',
      approval_required: true
    }
  ],
  technical_requirements: [
    {
      name: 'SSO Integration',
      priority: 'High',
      owner: 'IT Team',
      status: 'Pending',
      due_date: '2025-01-15'
    }
  ],
  contract_tasks: [
    {
      task: 'Complete onboarding',
      owner: 'CSM',
      due_date: '2025-01-30',
      priority: 'High'
    }
  ],
  pricing_terms: [
    {
      item: 'Annual License',
      amount: 150000,
      frequency: 'yearly'
    }
  ],
  missing_info: [],
  next_steps: 'Schedule kickoff call',
  confidence_scores: {
    company_name: 0.95,
    arr: 0.90,
    stakeholders: 0.85
  }
};

export const mockCompanyResearch: MockCompanyResearch = {
  company_name: 'Test Corporation',
  domain: 'testcorp.com',
  industry: 'Technology',
  employee_count: 500,
  tech_stack: ['AWS', 'React', 'Node.js'],
  recent_news: ['Series B funding announced'],
  key_initiatives: ['Digital transformation'],
  competitors: ['Competitor Inc'],
  overview: 'A leading technology company focused on enterprise solutions.'
};

export const mockOnboardingPlan: MockOnboardingPlan = {
  timeline_days: 90,
  phases: [
    {
      name: 'Foundation',
      description: 'Initial setup and configuration',
      tasks: [
        {
          title: 'Kickoff Meeting',
          description: 'Initial meeting with stakeholders',
          owner: 'CSM',
          due_days: 5,
          success_criteria: 'All stakeholders aligned'
        }
      ],
      success_metrics: ['First login achieved']
    }
  ],
  risk_factors: ['Stakeholder availability'],
  opportunities: ['Expansion potential'],
  recommended_touchpoints: ['Day 1: Welcome email', 'Day 5: Kickoff']
};

// Mock factory for ClaudeService
export const createClaudeMock = () => ({
  parseContract: vi.fn().mockResolvedValue(mockContractExtraction),
  generateSummary: vi.fn().mockResolvedValue('## Executive Summary\n\nThis contract establishes a partnership with Test Corporation...'),
  researchCompany: vi.fn().mockResolvedValue(mockCompanyResearch),
  createOnboardingPlan: vi.fn().mockResolvedValue(mockOnboardingPlan),
  generate: vi.fn().mockResolvedValue('AI response text'),
  generateForJSON: vi.fn().mockResolvedValue('{}')
});

// Mock factory for GeminiService
export const createGeminiMock = () => ({
  generate: vi.fn().mockResolvedValue('Gemini response text'),
  generateJSON: vi.fn().mockResolvedValue(mockContractExtraction),
  parseDocument: vi.fn().mockResolvedValue(mockContractExtraction)
});

// Mock for LangChain ChatGoogleGenerativeAI
export const createLangChainGeminiMock = () => ({
  invoke: vi.fn().mockResolvedValue({
    content: 'Mocked agent response for customer success inquiry.'
  })
});
