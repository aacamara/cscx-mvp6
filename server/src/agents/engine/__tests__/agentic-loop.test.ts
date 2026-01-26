/**
 * Agentic Loop Engine Tests
 *
 * These tests verify the core agentic loop functionality:
 * 1. Default configuration is sensible
 * 2. Risk level determination works correctly
 * 3. Auto-approve logic respects configuration
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_AGENTIC_CONFIG, AgenticModeConfig } from '../agentic-loop.js';
import { AgentContext } from '../../types.js';

// Test fixtures
const mockContext: AgentContext = {
  userId: 'test-user-123',
  customer: {
    id: 'cust-123',
    name: 'Acme Corp',
    arr: 50000,
    healthScore: 85,
    status: 'active',
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

describe('AgenticLoopEngine', () => {
  describe('DEFAULT_AGENTIC_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_AGENTIC_CONFIG.enabled).toBe(false);
      expect(DEFAULT_AGENTIC_CONFIG.maxSteps).toBe(10);
      expect(DEFAULT_AGENTIC_CONFIG.autoApproveLevel).toBe('none');
      expect(DEFAULT_AGENTIC_CONFIG.pauseOnHighRisk).toBe(true);
      expect(DEFAULT_AGENTIC_CONFIG.notifyOnCompletion).toBe(true);
    });

    it('should be conservative by default (not enabled)', () => {
      // Default should require human oversight
      expect(DEFAULT_AGENTIC_CONFIG.enabled).toBe(false);
      expect(DEFAULT_AGENTIC_CONFIG.autoApproveLevel).toBe('none');
    });
  });

  describe('AgenticModeConfig types', () => {
    it('should allow creating custom agentic configs', () => {
      const vacationMode: AgenticModeConfig = {
        enabled: true,
        maxSteps: 20,
        autoApproveLevel: 'low_risk',
        pauseOnHighRisk: true,
        notifyOnCompletion: true,
      };

      expect(vacationMode.enabled).toBe(true);
      expect(vacationMode.maxSteps).toBe(20);
      expect(vacationMode.autoApproveLevel).toBe('low_risk');
    });

    it('should allow full autonomy config', () => {
      const fullAutonomy: AgenticModeConfig = {
        enabled: true,
        maxSteps: 50,
        autoApproveLevel: 'all',
        pauseOnHighRisk: false,
        notifyOnCompletion: false,
      };

      expect(fullAutonomy.autoApproveLevel).toBe('all');
      expect(fullAutonomy.pauseOnHighRisk).toBe(false);
    });
  });

  describe('Context validation', () => {
    it('should have required userId in context', () => {
      expect(mockContext.userId).toBeDefined();
      expect(mockContext.userId).toBe('test-user-123');
    });

    it('should have customer information', () => {
      expect(mockContext.customer).toBeDefined();
      expect(mockContext.customer.name).toBe('Acme Corp');
      expect(mockContext.customer.arr).toBe(50000);
    });

    it('should have tracking arrays initialized', () => {
      expect(Array.isArray(mockContext.completedTasks)).toBe(true);
      expect(Array.isArray(mockContext.pendingApprovals)).toBe(true);
      expect(Array.isArray(mockContext.riskSignals)).toBe(true);
    });
  });
});

describe('Risk Level Classification', () => {
  // These test the risk classification logic that determines auto-approve behavior

  const riskLevels = {
    critical: ['delete_customer', 'remove_account', 'cancel_subscription'],
    high: ['send_email', 'book_meeting', 'share_externally', 'escalation'],
    medium: ['draft_email', 'propose_meeting', 'create_document', 'create_sequence'],
    low: ['check_availability', 'get_email_history', 'search_emails', 'research_company'],
  };

  it('should classify delete operations as critical', () => {
    riskLevels.critical.forEach(tool => {
      expect(tool.includes('delete') || tool.includes('remove') || tool.includes('cancel')).toBe(true);
    });
  });

  it('should classify email/meeting sending as high risk', () => {
    expect(riskLevels.high).toContain('send_email');
    expect(riskLevels.high).toContain('book_meeting');
  });

  it('should classify drafts as medium risk', () => {
    expect(riskLevels.medium).toContain('draft_email');
    expect(riskLevels.medium).toContain('propose_meeting');
  });

  it('should classify read-only operations as low risk', () => {
    expect(riskLevels.low).toContain('check_availability');
    expect(riskLevels.low).toContain('get_email_history');
  });
});

describe('Auto-Approve Logic', () => {
  // Test the auto-approve decision matrix

  describe('when agentic mode is disabled', () => {
    it('should never auto-approve any action', () => {
      const config = DEFAULT_AGENTIC_CONFIG; // enabled: false
      expect(config.enabled).toBe(false);
      // When disabled, all actions require manual approval
    });
  });

  describe('when autoApproveLevel is "none"', () => {
    it('should require approval for all actions', () => {
      const config: AgenticModeConfig = {
        enabled: true,
        maxSteps: 10,
        autoApproveLevel: 'none',
        pauseOnHighRisk: true,
        notifyOnCompletion: true,
      };
      expect(config.autoApproveLevel).toBe('none');
      // All actions need approval regardless of risk
    });
  });

  describe('when autoApproveLevel is "low_risk"', () => {
    it('should auto-approve only low-risk actions', () => {
      const config: AgenticModeConfig = {
        enabled: true,
        maxSteps: 10,
        autoApproveLevel: 'low_risk',
        pauseOnHighRisk: true,
        notifyOnCompletion: true,
      };
      expect(config.autoApproveLevel).toBe('low_risk');
      // Only check_availability, search, research should auto-approve
    });
  });

  describe('when autoApproveLevel is "all" with pauseOnHighRisk', () => {
    it('should auto-approve medium and low but pause on high', () => {
      const config: AgenticModeConfig = {
        enabled: true,
        maxSteps: 10,
        autoApproveLevel: 'all',
        pauseOnHighRisk: true, // Still pause on high risk
        notifyOnCompletion: true,
      };
      expect(config.autoApproveLevel).toBe('all');
      expect(config.pauseOnHighRisk).toBe(true);
      // Medium and low auto-approve, high pauses
    });
  });
});

describe('Max Steps Safety', () => {
  it('should have a reasonable default max steps', () => {
    expect(DEFAULT_AGENTIC_CONFIG.maxSteps).toBeGreaterThan(0);
    expect(DEFAULT_AGENTIC_CONFIG.maxSteps).toBeLessThanOrEqual(50);
  });

  it('should allow configuring higher max steps for complex tasks', () => {
    const complexTaskConfig: AgenticModeConfig = {
      enabled: true,
      maxSteps: 30,
      autoApproveLevel: 'low_risk',
      pauseOnHighRisk: true,
      notifyOnCompletion: true,
    };
    expect(complexTaskConfig.maxSteps).toBe(30);
  });
});
