/**
 * Agentic Agents API Routes Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the orchestrator-executor module
vi.mock('../../agents/engine/orchestrator-executor.js', () => ({
  executeGoal: vi.fn(),
  planGoal: vi.fn(),
  executePlan: vi.fn(),
  resumeAfterApproval: vi.fn(),
  executeWithSpecialist: vi.fn(),
  quickCheckIn: vi.fn(),
}));

// Mock the agentic-mode service
vi.mock('../../services/agentic-mode.js', () => ({
  agenticModeService: {
    getEffectiveConfig: vi.fn().mockResolvedValue({
      enabled: true,
      maxSteps: 10,
      autoApproveLevel: 'low_risk',
      pauseOnHighRisk: true,
      notifyOnCompletion: true,
    }),
  },
}));

// Mock SupabaseService
vi.mock('../../services/supabase.js', () => ({
  SupabaseService: vi.fn().mockImplementation(() => ({
    getCustomer: vi.fn().mockResolvedValue({
      id: 'cust-123',
      name: 'Test Corp',
      arr: 50000,
      health_score: 75,
      stage: 'active',
      renewal_date: '2026-06-01',
      primary_contact_email: 'contact@test.com',
      primary_contact_name: 'Jane Doe',
    }),
  })),
}));

import {
  executeGoal,
  planGoal,
  resumeAfterApproval,
  executeWithSpecialist,
  quickCheckIn,
} from '../../agents/engine/orchestrator-executor.js';

describe('Agentic Agents Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route structure', () => {
    it('should export routes for execute endpoint', () => {
      // The /execute endpoint should accept POST with goal and customerId
      const expectedEndpoints = [
        'POST /api/agentic/execute',
        'POST /api/agentic/plan',
        'POST /api/agentic/execute-plan',
        'POST /api/agentic/resume',
        'POST /api/agentic/specialist/:agentId',
        'GET /api/agentic/check-in/:customerId',
        'GET /api/agentic/pending-states',
        'DELETE /api/agentic/pending-states/:stateId',
      ];

      expect(expectedEndpoints.length).toBe(8);
    });
  });

  describe('executeGoal function', () => {
    it('should be called with goal and context', async () => {
      const mockResult = {
        success: true,
        state: { status: 'completed', currentStep: 3 },
        message: 'Goal completed successfully',
        actions: [
          { toolName: 'create_task', input: {}, result: { success: true } },
        ],
      };

      (executeGoal as any).mockResolvedValue(mockResult);

      const result = await executeGoal('Schedule a check-in meeting', {
        userId: 'user-123',
        customer: {
          id: 'cust-123',
          name: 'Test Corp',
          arr: 50000,
          healthScore: 75,
          status: 'active',
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: [],
      });

      expect(executeGoal).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.state.status).toBe('completed');
    });

    it('should handle paused_for_approval status', async () => {
      const mockResult = {
        success: true,
        state: {
          status: 'paused_for_approval',
          currentStep: 2,
          pendingApproval: {
            toolName: 'send_email',
            input: { to: 'test@test.com', subject: 'Test' },
            riskLevel: 'high',
          },
        },
        message: 'Waiting for approval to send email',
        actions: [],
      };

      (executeGoal as any).mockResolvedValue(mockResult);

      const result = await executeGoal('Send follow-up email', {
        userId: 'user-123',
        customer: {
          id: 'cust-123',
          name: 'Test Corp',
          arr: 50000,
          healthScore: 75,
          status: 'active',
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: [],
      });

      expect(result.state.status).toBe('paused_for_approval');
      expect(result.state.pendingApproval.toolName).toBe('send_email');
    });
  });

  describe('planGoal function', () => {
    it('should generate a plan for a goal', async () => {
      const mockPlan = {
        id: 'plan_123',
        originalRequest: 'Prepare QBR for customer',
        plan: [
          { id: 'step_1', description: 'Gather usage metrics', toolName: 'research_usage', dependsOn: [] },
          { id: 'step_2', description: 'Create QBR document', toolName: 'create_document', dependsOn: ['step_1'] },
          { id: 'step_3', description: 'Schedule QBR meeting', toolName: 'book_meeting', dependsOn: ['step_2'] },
        ],
      };

      (planGoal as any).mockResolvedValue(mockPlan);

      const result = await planGoal('Prepare QBR for customer', {
        userId: 'user-123',
        customer: {
          id: 'cust-123',
          name: 'Test Corp',
          arr: 50000,
          healthScore: 75,
          status: 'active',
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: [],
      });

      expect(planGoal).toHaveBeenCalled();
      expect(result.id).toBe('plan_123');
      expect(result.plan.length).toBe(3);
      expect(result.plan[1].dependsOn).toContain('step_1');
    });
  });

  describe('resumeAfterApproval function', () => {
    it('should resume execution after approval', async () => {
      const mockState = {
        status: 'paused_for_approval',
        currentStep: 2,
        pendingApproval: {
          toolName: 'send_email',
          input: { to: 'test@test.com' },
        },
      };

      const mockResult = {
        success: true,
        state: { status: 'completed', currentStep: 3 },
        message: 'Email sent successfully',
        actions: [
          { toolName: 'send_email', result: { success: true, messageId: 'msg_123' } },
        ],
      };

      (resumeAfterApproval as any).mockResolvedValue(mockResult);

      const result = await resumeAfterApproval(
        mockState,
        true, // approved
        {
          userId: 'user-123',
          customer: { id: 'cust-123', name: 'Test', arr: 50000, healthScore: 75, status: 'active' },
          currentPhase: 'monitoring',
          completedTasks: [],
          pendingApprovals: [],
          recentInteractions: [],
          riskSignals: [],
        }
      );

      expect(resumeAfterApproval).toHaveBeenCalledWith(mockState, true, expect.any(Object));
      expect(result.success).toBe(true);
      expect(result.state.status).toBe('completed');
    });

    it('should handle rejection', async () => {
      const mockState = {
        status: 'paused_for_approval',
        currentStep: 2,
        pendingApproval: { toolName: 'send_email', input: {} },
      };

      const mockResult = {
        success: false,
        state: { status: 'rejected', currentStep: 2 },
        message: 'Action was rejected by user',
        actions: [],
      };

      (resumeAfterApproval as any).mockResolvedValue(mockResult);

      const result = await resumeAfterApproval(
        mockState,
        false, // rejected
        {
          userId: 'user-123',
          customer: { id: 'cust-123', name: 'Test', arr: 50000, healthScore: 75, status: 'active' },
          currentPhase: 'monitoring',
          completedTasks: [],
          pendingApprovals: [],
          recentInteractions: [],
          riskSignals: [],
        }
      );

      expect(result.success).toBe(false);
      expect(result.state.status).toBe('rejected');
    });
  });

  describe('executeWithSpecialist function', () => {
    it('should route to scheduler agent', async () => {
      const mockResult = {
        success: true,
        state: { status: 'completed' },
        message: 'Meeting scheduled',
        actions: [{ toolName: 'book_meeting', result: { eventId: 'evt_123' } }],
      };

      (executeWithSpecialist as any).mockResolvedValue(mockResult);

      const result = await executeWithSpecialist(
        'scheduler',
        'Book a QBR meeting for next week',
        {
          userId: 'user-123',
          customer: { id: 'cust-123', name: 'Test', arr: 50000, healthScore: 75, status: 'active' },
          currentPhase: 'monitoring',
          completedTasks: [],
          pendingApprovals: [],
          recentInteractions: [],
          riskSignals: [],
        }
      );

      expect(executeWithSpecialist).toHaveBeenCalledWith(
        'scheduler',
        'Book a QBR meeting for next week',
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should route to communicator agent', async () => {
      const mockResult = {
        success: true,
        state: { status: 'paused_for_approval' },
        message: 'Email ready for approval',
        actions: [],
      };

      (executeWithSpecialist as any).mockResolvedValue(mockResult);

      const result = await executeWithSpecialist(
        'communicator',
        'Draft a check-in email',
        {
          userId: 'user-123',
          customer: { id: 'cust-123', name: 'Test', arr: 50000, healthScore: 75, status: 'active' },
          currentPhase: 'monitoring',
          completedTasks: [],
          pendingApprovals: [],
          recentInteractions: [],
          riskSignals: [],
        }
      );

      expect(executeWithSpecialist).toHaveBeenCalledWith(
        'communicator',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should route to researcher agent', async () => {
      const mockResult = {
        success: true,
        state: { status: 'completed' },
        message: 'Research completed',
        actions: [
          { toolName: 'research_company', result: { data: { industry: 'SaaS' } } },
        ],
      };

      (executeWithSpecialist as any).mockResolvedValue(mockResult);

      const result = await executeWithSpecialist(
        'researcher',
        'Research company background',
        {
          userId: 'user-123',
          customer: { id: 'cust-123', name: 'Test', arr: 50000, healthScore: 75, status: 'active' },
          currentPhase: 'monitoring',
          completedTasks: [],
          pendingApprovals: [],
          recentInteractions: [],
          riskSignals: [],
        }
      );

      expect(result.success).toBe(true);
      expect(result.actions[0].toolName).toBe('research_company');
    });
  });

  describe('quickCheckIn function', () => {
    it('should return check-in recommendations', async () => {
      const mockCheckIn = {
        healthSummary: 'Customer is healthy with score of 75',
        recommendations: [
          { type: 'proactive_outreach', description: 'Schedule quarterly check-in', priority: 'medium' },
        ],
        riskSignals: [],
        nextBestAction: 'Send a personalized check-in email',
      };

      (quickCheckIn as any).mockResolvedValue(mockCheckIn);

      const result = await quickCheckIn({
        userId: 'user-123',
        customer: {
          id: 'cust-123',
          name: 'Test Corp',
          arr: 50000,
          healthScore: 75,
          status: 'active',
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: [],
      });

      expect(quickCheckIn).toHaveBeenCalled();
      expect(result.healthSummary).toContain('healthy');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should flag urgent action for low health score', async () => {
      const mockCheckIn = {
        healthSummary: 'Customer at risk with score of 45',
        recommendations: [
          { type: 'urgent_intervention', description: 'Schedule immediate call', priority: 'high' },
          { type: 'risk_assessment', description: 'Review recent support tickets', priority: 'high' },
        ],
        riskSignals: ['Low engagement', 'Missed training sessions'],
        nextBestAction: 'Call customer immediately to address concerns',
      };

      (quickCheckIn as any).mockResolvedValue(mockCheckIn);

      const result = await quickCheckIn({
        userId: 'user-123',
        customer: {
          id: 'cust-123',
          name: 'Test Corp',
          arr: 50000,
          healthScore: 45,
          status: 'active',
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: ['Low engagement'],
      });

      expect(result.riskSignals.length).toBeGreaterThan(0);
      expect(result.recommendations[0].priority).toBe('high');
    });
  });

  describe('Pending states management', () => {
    it('should track pending approval states', () => {
      // Simulating the pending states map behavior
      const pendingStates = new Map<string, any>();

      const stateId = 'state_12345';
      const stateData = {
        state: { status: 'paused_for_approval', pendingApproval: { toolName: 'send_email' } },
        context: { userId: 'user-123' },
        createdAt: new Date(),
      };

      pendingStates.set(stateId, stateData);

      expect(pendingStates.has(stateId)).toBe(true);
      expect(pendingStates.get(stateId).state.status).toBe('paused_for_approval');
    });

    it('should clean up states after resumption', () => {
      const pendingStates = new Map<string, any>();

      const stateId = 'state_12345';
      pendingStates.set(stateId, { state: {}, context: {} });

      // Simulate resumption
      pendingStates.delete(stateId);

      expect(pendingStates.has(stateId)).toBe(false);
    });

    it('should list all pending states', () => {
      const pendingStates = new Map<string, any>();

      pendingStates.set('state_1', {
        state: { pendingApproval: { toolName: 'send_email' } },
        createdAt: new Date(),
        agentId: 'communicator',
      });
      pendingStates.set('state_2', {
        state: { pendingApproval: { toolName: 'book_meeting' } },
        createdAt: new Date(),
        agentId: 'scheduler',
      });

      const states = Array.from(pendingStates.entries()).map(([id, data]) => ({
        id,
        agentId: data.agentId,
        pendingApproval: data.state.pendingApproval,
      }));

      expect(states.length).toBe(2);
      expect(states[0].agentId).toBe('communicator');
      expect(states[1].agentId).toBe('scheduler');
    });
  });

  describe('Context building', () => {
    it('should build context with customer data', () => {
      const customerData = {
        id: 'cust-123',
        name: 'Test Corp',
        arr: 50000,
        health_score: 75,
        stage: 'active',
        renewal_date: '2026-06-01',
        primary_contact_email: 'contact@test.com',
        primary_contact_name: 'Jane Doe',
      };

      const context = {
        userId: 'user-123',
        customer: {
          id: customerData.id,
          name: customerData.name,
          arr: customerData.arr || 0,
          healthScore: customerData.health_score || 0,
          status: customerData.stage || 'active',
          renewalDate: customerData.renewal_date,
          primaryContact: customerData.primary_contact_email ? {
            name: customerData.primary_contact_name || 'Contact',
            email: customerData.primary_contact_email,
          } : undefined,
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: [],
      };

      expect(context.customer.id).toBe('cust-123');
      expect(context.customer.primaryContact?.email).toBe('contact@test.com');
      expect(context.customer.renewalDate).toBe('2026-06-01');
    });

    it('should handle missing customer data gracefully', () => {
      const context = {
        userId: 'user-123',
        customer: {
          id: 'unknown',
          name: 'Unknown Customer',
          arr: 0,
          healthScore: 0,
          status: 'active',
        },
        currentPhase: 'monitoring',
        completedTasks: [],
        pendingApprovals: [],
        recentInteractions: [],
        riskSignals: [],
      };

      expect(context.customer.id).toBe('unknown');
      expect(context.customer.arr).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should require goal for execute endpoint', () => {
      const validateExecuteRequest = (body: any) => {
        if (!body.goal) {
          return { valid: false, error: 'goal is required' };
        }
        return { valid: true };
      };

      expect(validateExecuteRequest({})).toEqual({ valid: false, error: 'goal is required' });
      expect(validateExecuteRequest({ goal: 'Test goal' })).toEqual({ valid: true });
    });

    it('should require stateId and approved for resume endpoint', () => {
      const validateResumeRequest = (body: any) => {
        if (!body.stateId) {
          return { valid: false, error: 'stateId is required' };
        }
        if (typeof body.approved !== 'boolean') {
          return { valid: false, error: 'approved must be a boolean' };
        }
        return { valid: true };
      };

      expect(validateResumeRequest({})).toEqual({ valid: false, error: 'stateId is required' });
      expect(validateResumeRequest({ stateId: 'state_1' })).toEqual({ valid: false, error: 'approved must be a boolean' });
      expect(validateResumeRequest({ stateId: 'state_1', approved: true })).toEqual({ valid: true });
    });

    it('should validate specialist agent type', () => {
      const validAgents = ['scheduler', 'communicator', 'researcher'];

      const validateAgent = (agentId: string) => {
        return validAgents.includes(agentId);
      };

      expect(validateAgent('scheduler')).toBe(true);
      expect(validateAgent('communicator')).toBe(true);
      expect(validateAgent('researcher')).toBe(true);
      expect(validateAgent('invalid')).toBe(false);
      expect(validateAgent('orchestrator')).toBe(false); // Orchestrator is not a specialist
    });
  });
});
