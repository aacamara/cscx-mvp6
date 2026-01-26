import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock specialists module - config must be defined inside the factory
vi.mock('../specialists/index.js', () => {
  const configs = {
    onboarding: {
      id: 'onboarding',
      name: 'Onboarding Specialist',
      description: 'New customer setup',
      keywords: ['onboard', 'kickoff', 'new customer', 'setup', 'getting started'],
      tools: [],
      approvalRequired: []
    },
    adoption: {
      id: 'adoption',
      name: 'Adoption Specialist',
      description: 'Product adoption',
      keywords: ['adoption', 'usage', 'feature', 'training', 'enable'],
      tools: [],
      approvalRequired: []
    },
    renewal: {
      id: 'renewal',
      name: 'Renewal Specialist',
      description: 'Renewals and expansion',
      keywords: ['renewal', 'renew', 'expand', 'upsell', 'contract'],
      daysToRenewal: [0, 90],
      tools: [],
      approvalRequired: []
    },
    risk: {
      id: 'risk',
      name: 'Risk Specialist',
      description: 'At-risk accounts',
      keywords: ['risk', 'at-risk', 'churn', 'cancel', 'unhappy', 'escalate'],
      healthScoreRange: [0, 50],
      tools: [],
      approvalRequired: []
    },
    strategic: {
      id: 'strategic',
      name: 'Strategic CSM',
      description: 'Strategic accounts',
      keywords: ['qbr', 'quarterly', 'executive', 'strategic'],
      tools: [],
      approvalRequired: []
    },
    email: {
      id: 'email',
      name: 'Email Agent',
      description: 'Customer communications',
      keywords: ['email', 'write', 'draft', 'send', 'reply'],
      tools: [],
      approvalRequired: []
    },
    meeting: {
      id: 'meeting',
      name: 'Meeting Agent',
      description: 'Meeting scheduling',
      keywords: ['meeting', 'schedule', 'calendar', 'call', 'book'],
      tools: [],
      approvalRequired: []
    },
    knowledge: {
      id: 'knowledge',
      name: 'Knowledge Agent',
      description: 'Playbook search',
      keywords: ['how to', 'best practice', 'playbook'],
      tools: [],
      approvalRequired: []
    },
    research: {
      id: 'research',
      name: 'Research Agent',
      description: 'Company research',
      keywords: ['research', 'company', 'stakeholder'],
      tools: [],
      approvalRequired: []
    },
    analytics: {
      id: 'analytics',
      name: 'Analytics Agent',
      description: 'Health scoring',
      keywords: ['analytics', 'metrics', 'health score'],
      tools: [],
      approvalRequired: []
    }
  };

  const createMockSpecialist = (type: string) => ({
    id: type,
    name: `${type} Specialist`,
    execute: async () => ({
      response: 'Mock specialist response',
      requiresApproval: false,
      pendingActions: [],
      toolsUsed: []
    })
  });

  return {
    SPECIALIST_CONFIGS: configs,
    getAllSpecialists: () => Object.values(configs),
    createSpecialist: (type: string) => createMockSpecialist(type),
    SpecialistAgent: class {}
  };
});

// Mock Anthropic - used for LLM fallback routing
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => ({
        content: [{ type: 'text', text: '{"specialist": "strategic", "confidence": 0.6, "reasoning": "LLM fallback"}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 }
      })
    };
  }
}));

// Mock the agent tracer with all required methods
vi.mock('../../../services/agentTracer.js', () => ({
  agentTracer: {
    startRun: vi.fn().mockResolvedValue({
      id: 'test-run-id',
      steps: [],
      agentId: 'test',
      agentName: 'Test Agent'
    }),
    endRun: vi.fn().mockResolvedValue(undefined),
    logStep: vi.fn().mockResolvedValue(undefined),
    startStep: vi.fn().mockResolvedValue({ id: 'test-step-id' }),
    endStep: vi.fn().mockResolvedValue(undefined),
    getActiveRuns: vi.fn().mockReturnValue([]),
    getAllRuns: vi.fn().mockReturnValue([])
  },
  StepType: {}
}));

// Mock the approval service
vi.mock('../../../services/approval.js', () => ({
  approvalService: {
    createApproval: vi.fn().mockResolvedValue({ id: 'test-approval-id' }),
    getApproval: vi.fn(),
    approveAction: vi.fn(),
    rejectAction: vi.fn()
  }
}));

// Mock Google services
vi.mock('../../../services/google/calendar.js', () => ({
  calendarService: {
    getTodayEvents: vi.fn().mockResolvedValue([]),
    getUpcomingEvents: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../../services/google/gmail.js', () => ({
  gmailService: {
    listThreads: vi.fn().mockResolvedValue({ threads: [] })
  }
}));

// Import after mocking
import { AgentOrchestrator } from '../orchestrator.js';

// Test customer contexts
const mockContexts = {
  onboarding: {
    userId: 'user-001',
    sessionId: 'session-001',
    customerContext: {
      id: 'test-001',
      name: 'Test Company',
      arr: 100000,
      healthScore: 80,
      status: 'onboarding',
      daysToRenewal: 365
    }
  },
  active: {
    userId: 'user-002',
    sessionId: 'session-002',
    customerContext: {
      id: 'test-002',
      name: 'Active Corp',
      arr: 150000,
      healthScore: 85,
      status: 'active',
      daysToRenewal: 180
    }
  },
  atRisk: {
    userId: 'user-003',
    sessionId: 'session-003',
    customerContext: {
      id: 'test-003',
      name: 'At Risk Inc',
      arr: 200000,
      healthScore: 35,  // Low health score should trigger risk routing
      status: 'active',
      daysToRenewal: 60
    }
  },
  renewingSoon: {
    userId: 'user-004',
    sessionId: 'session-004',
    customerContext: {
      id: 'test-004',
      name: 'Renewing Corp',
      arr: 120000,
      healthScore: 75,
      status: 'active',
      daysToRenewal: 45  // Should trigger renewal routing
    }
  }
};

describe('AgentOrchestrator Integration Tests', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new AgentOrchestrator();
  });

  afterEach(() => {
    orchestrator.reset();
  });

  describe('Keyword-based Routing', () => {
    it('should route to risk agent for churn-related messages', async () => {
      const response = await orchestrator.chat(
        'This customer is at risk of churning and might cancel',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('risk');
    });

    it('should route to risk agent for escalation messages', async () => {
      const response = await orchestrator.chat(
        'Customer has escalated an issue to leadership',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('risk');
    });

    it('should route to renewal agent for renewal messages', async () => {
      const response = await orchestrator.chat(
        'We need to discuss the upcoming renewal and pricing',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('renewal');
    });

    it('should route to renewal agent for expansion messages', async () => {
      const response = await orchestrator.chat(
        'Customer wants to discuss expansion and upsell opportunities',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('renewal');
    });

    it('should route to strategic agent for QBR messages', async () => {
      const response = await orchestrator.chat(
        'Let\'s prepare for the upcoming QBR meeting',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('strategic');
    });

    it('should route to adoption agent for training messages', async () => {
      const response = await orchestrator.chat(
        'We need to schedule feature training for the users',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('adoption');
    });

    it('should route to onboarding agent for kickoff messages', async () => {
      const response = await orchestrator.chat(
        'Let\'s create a kickoff meeting agenda for the new customer',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('onboarding');
    });

    it('should route to email agent for email drafting', async () => {
      const response = await orchestrator.chat(
        'Draft an email to the customer about their subscription',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('email');
    });

    it('should route to meeting agent for scheduling', async () => {
      const response = await orchestrator.chat(
        'Schedule a meeting with the customer for next week',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('meeting');
    });
  });

  describe('Context-based Routing', () => {
    it('should route to risk agent for low health score customers', async () => {
      const response = await orchestrator.chat(
        'How is this customer doing overall?',
        mockContexts.atRisk
      );

      // Low health score (35) should route to risk
      expect(response.specialistUsed).toBe('risk');
    });

    it('should route to renewal agent for customers with upcoming renewal', async () => {
      const response = await orchestrator.chat(
        'What should we focus on with this customer?',
        mockContexts.renewingSoon
      );

      // 45 days to renewal should route to renewal
      expect(response.specialistUsed).toBe('renewal');
    });
  });

  describe('Direct Specialist Access', () => {
    it('should allow direct access to specific specialist', async () => {
      const response = await orchestrator.chatWithSpecialist(
        'General question',
        'analytics',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('analytics');
    });
  });

  describe('Session Management', () => {
    it('should maintain conversation history across messages', async () => {
      await orchestrator.chat('First message about onboarding', mockContexts.active);
      await orchestrator.chat('Second message', mockContexts.active);

      const state = orchestrator.getState();
      expect(state.historyLength).toBe(4); // 2 user + 2 assistant
    });

    it('should reset session properly', async () => {
      await orchestrator.chat('First message', mockContexts.active);
      orchestrator.reset();

      const state = orchestrator.getState();
      expect(state.historyLength).toBe(0);
      expect(state.currentSpecialist).toBeNull();
    });

    it('should list available specialists', () => {
      const state = orchestrator.getState();

      expect(state.availableSpecialists.length).toBeGreaterThanOrEqual(10);
      expect(state.availableSpecialists.map(s => s.id)).toContain('onboarding');
      expect(state.availableSpecialists.map(s => s.id)).toContain('adoption');
      expect(state.availableSpecialists.map(s => s.id)).toContain('renewal');
      expect(state.availableSpecialists.map(s => s.id)).toContain('risk');
      expect(state.availableSpecialists.map(s => s.id)).toContain('strategic');
      expect(state.availableSpecialists.map(s => s.id)).toContain('email');
      expect(state.availableSpecialists.map(s => s.id)).toContain('meeting');
      expect(state.availableSpecialists.map(s => s.id)).toContain('knowledge');
      expect(state.availableSpecialists.map(s => s.id)).toContain('research');
      expect(state.availableSpecialists.map(s => s.id)).toContain('analytics');
    });
  });

  describe('Response Structure', () => {
    it('should return complete response with trace info', async () => {
      const response = await orchestrator.chat(
        'Test message',
        mockContexts.active
      );

      expect(response).toHaveProperty('response');
      expect(response).toHaveProperty('specialistUsed');
      expect(response).toHaveProperty('requiresApproval');
      expect(response).toHaveProperty('pendingActions');
      expect(response).toHaveProperty('toolsUsed');
      expect(response).toHaveProperty('trace');
      expect(response.trace).toHaveProperty('runId');
      expect(response.trace).toHaveProperty('steps');
    });
  });

  describe('Follow-up Message Detection', () => {
    it('should stay with current specialist for follow-up messages', async () => {
      // First message routes to onboarding
      await orchestrator.chat(
        'Let\'s start the kickoff process',
        mockContexts.active
      );

      // Follow-up should stay with same specialist
      const response = await orchestrator.chat(
        'yes, sounds good',
        mockContexts.active
      );

      expect(response.specialistUsed).toBe('onboarding');
    });
  });
});

describe('AgentOrchestrator Edge Cases', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
  });

  afterEach(() => {
    orchestrator.reset();
  });

  it('should handle empty message gracefully', async () => {
    const response = await orchestrator.chat('', mockContexts.active);
    expect(response.specialistUsed).toBeDefined();
  });

  it('should handle missing customer context values', async () => {
    const incompleteContext = {
      userId: 'user-test',
      sessionId: 'session-test',
      customerContext: {
        id: 'test',
        name: 'Test'
        // Missing healthScore, arr, daysToRenewal
      }
    };

    const response = await orchestrator.chat('Test message', incompleteContext);
    expect(response.specialistUsed).toBeDefined();
  });

  it('should prioritize keywords over context-based routing', async () => {
    // Even with low health score context, risk keyword should still win
    const response = await orchestrator.chat(
      'Customer is at risk and unhappy',
      mockContexts.atRisk
    );

    expect(response.specialistUsed).toBe('risk');
  });

  it('should handle case insensitivity in keyword matching', async () => {
    const response = await orchestrator.chat(
      'QBR PREPARATION NEEDED',
      mockContexts.active
    );

    expect(response.specialistUsed).toBe('strategic');
  });
});
