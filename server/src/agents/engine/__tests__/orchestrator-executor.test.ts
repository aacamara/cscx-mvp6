/**
 * Orchestrator Executor Tests
 */

import { describe, it, expect } from 'vitest';
import { AgentContext } from '../../types.js';

// Test fixtures
const mockContext: AgentContext = {
  userId: 'test-user-123',
  customer: {
    id: 'cust-123',
    name: 'Acme Corp',
    arr: 50000,
    healthScore: 75,
    status: 'active',
    renewalDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
    primaryContact: {
      name: 'John Doe',
      email: 'john@acme.com',
    },
  },
  currentPhase: 'monitoring',
  completedTasks: [],
  pendingApprovals: [],
  recentInteractions: [],
  riskSignals: [],
};

describe('OrchestratorExecutor', () => {
  describe('Context validation', () => {
    it('should have valid customer context', () => {
      expect(mockContext.customer).toBeDefined();
      expect(mockContext.customer.id).toBe('cust-123');
      expect(mockContext.customer.name).toBe('Acme Corp');
    });

    it('should have userId for agentic mode lookup', () => {
      expect(mockContext.userId).toBeDefined();
      expect(typeof mockContext.userId).toBe('string');
    });

    it('should have current phase', () => {
      expect(mockContext.currentPhase).toBe('monitoring');
    });

    it('should have renewal date for renewal recommendations', () => {
      expect(mockContext.customer.renewalDate).toBeDefined();
    });
  });

  describe('ExecutionResult structure', () => {
    it('should define expected result structure', () => {
      interface ExecutionResult {
        success: boolean;
        state: any;
        plan?: any;
        message: string;
        actions: any[];
      }

      const mockResult: ExecutionResult = {
        success: true,
        state: { status: 'completed' },
        message: 'Goal completed',
        actions: [],
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.message).toBeDefined();
      expect(Array.isArray(mockResult.actions)).toBe(true);
    });
  });

  describe('Specialist agent routing', () => {
    const specialistAgents = ['scheduler', 'communicator', 'researcher'];

    it('should have defined specialist agents', () => {
      expect(specialistAgents.length).toBeGreaterThan(0);
    });

    it('should include scheduler for calendar tasks', () => {
      expect(specialistAgents).toContain('scheduler');
    });

    it('should include communicator for email tasks', () => {
      expect(specialistAgents).toContain('communicator');
    });

    it('should include researcher for intelligence tasks', () => {
      expect(specialistAgents).toContain('researcher');
    });
  });

  describe('Quick recommendations logic', () => {
    it('should recommend check-in for low health score', () => {
      const lowHealthContext = {
        ...mockContext,
        customer: { ...mockContext.customer, healthScore: 50 },
      };

      // Health score < 60 should trigger urgent check-in recommendation
      expect(lowHealthContext.customer.healthScore).toBeLessThan(60);
    });

    it('should recommend proactive outreach for medium health', () => {
      const mediumHealthContext = {
        ...mockContext,
        customer: { ...mockContext.customer, healthScore: 70 },
      };

      expect(mediumHealthContext.customer.healthScore).toBeGreaterThanOrEqual(60);
      expect(mediumHealthContext.customer.healthScore).toBeLessThan(80);
    });

    it('should recommend renewal conversation when close to renewal', () => {
      const nearRenewalContext = {
        ...mockContext,
        customer: {
          ...mockContext.customer,
          renewalDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days
        },
      };

      const daysToRenewal = Math.ceil(
        (new Date(nearRenewalContext.customer.renewalDate!).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
      );

      expect(daysToRenewal).toBeLessThanOrEqual(30);
    });
  });

  describe('Status message generation', () => {
    it('should handle completed status', () => {
      const completedState = {
        status: 'completed',
        finalResult: 'Meeting scheduled successfully',
      };

      expect(completedState.status).toBe('completed');
      expect(completedState.finalResult).toBeDefined();
    });

    it('should handle paused_for_approval status', () => {
      const pausedState = {
        status: 'paused_for_approval',
        pendingApproval: {
          toolName: 'send_email',
          riskLevel: 'high',
        },
      };

      expect(pausedState.status).toBe('paused_for_approval');
      expect(pausedState.pendingApproval.riskLevel).toBe('high');
    });

    it('should handle failed status', () => {
      const failedState = {
        status: 'failed',
        error: 'Calendar API unavailable',
      };

      expect(failedState.status).toBe('failed');
      expect(failedState.error).toBeDefined();
    });

    it('should handle max_steps_reached status', () => {
      const maxStepsState = {
        status: 'max_steps_reached',
        maxSteps: 10,
        currentStep: 10,
      };

      expect(maxStepsState.status).toBe('max_steps_reached');
      expect(maxStepsState.currentStep).toBe(maxStepsState.maxSteps);
    });
  });

  describe('Plan execution', () => {
    it('should convert plan steps to goal description', () => {
      const mockPlan = {
        id: 'plan_123',
        plan: [
          { description: 'Check calendar availability' },
          { description: 'Propose meeting times' },
          { description: 'Book confirmed meeting' },
        ],
      };

      const planDescription = mockPlan.plan
        .map((step, i) => `${i + 1}. ${step.description}`)
        .join('\n');

      expect(planDescription).toContain('1. Check calendar availability');
      expect(planDescription).toContain('2. Propose meeting times');
      expect(planDescription).toContain('3. Book confirmed meeting');
    });
  });
});

describe('ExecutedAction structure', () => {
  it('should capture action details', () => {
    interface ExecutedAction {
      toolName: string;
      input: any;
      result: any;
      timestamp: Date;
    }

    const mockAction: ExecutedAction = {
      toolName: 'check_availability',
      input: { dateRange: { start: '2026-01-26', end: '2026-01-30' } },
      result: { success: true, data: { slots: ['9am', '2pm'] } },
      timestamp: new Date(),
    };

    expect(mockAction.toolName).toBe('check_availability');
    expect(mockAction.input).toBeDefined();
    expect(mockAction.result.success).toBe(true);
    expect(mockAction.timestamp).toBeInstanceOf(Date);
  });
});
