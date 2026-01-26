/**
 * Approval Service Agentic Mode Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalService, ActionType } from '../approval.js';

// Mock the agentic mode service
vi.mock('../agentic-mode.js', () => ({
  agenticModeService: {
    getEffectiveConfig: vi.fn(),
  },
}));

import { agenticModeService } from '../agentic-mode.js';

describe('ApprovalService - Agentic Mode Integration', () => {
  let service: ApprovalService;

  beforeEach(() => {
    service = new ApprovalService();
    vi.clearAllMocks();
  });

  describe('shouldAutoApprove', () => {
    describe('when agentic mode is disabled', () => {
      beforeEach(() => {
        (agenticModeService.getEffectiveConfig as any).mockResolvedValue({
          enabled: false,
          maxSteps: 10,
          autoApproveLevel: 'none',
          pauseOnHighRisk: true,
          notifyOnCompletion: true,
        });
      });

      it('should never auto-approve any action', async () => {
        const result = await service.shouldAutoApprove('user-1', 'create_task');
        expect(result.autoApprove).toBe(false);
        expect(result.reason).toContain('disabled');
      });

      it('should not auto-approve even low-risk actions', async () => {
        const result = await service.shouldAutoApprove('user-1', 'other');
        expect(result.autoApprove).toBe(false);
      });
    });

    describe('when agentic mode is enabled with autoApproveLevel: none', () => {
      beforeEach(() => {
        (agenticModeService.getEffectiveConfig as any).mockResolvedValue({
          enabled: true,
          maxSteps: 10,
          autoApproveLevel: 'none',
          pauseOnHighRisk: true,
          notifyOnCompletion: true,
        });
      });

      it('should not auto-approve any action', async () => {
        const result = await service.shouldAutoApprove('user-1', 'create_task');
        expect(result.autoApprove).toBe(false);
        expect(result.reason).toContain('disabled');
      });
    });

    describe('when agentic mode is enabled with autoApproveLevel: low_risk', () => {
      beforeEach(() => {
        (agenticModeService.getEffectiveConfig as any).mockResolvedValue({
          enabled: true,
          maxSteps: 10,
          autoApproveLevel: 'low_risk',
          pauseOnHighRisk: true,
          notifyOnCompletion: true,
        });
      });

      it('should auto-approve low-risk actions like create_task', async () => {
        const result = await service.shouldAutoApprove('user-1', 'create_task');
        expect(result.autoApprove).toBe(true);
        expect(result.reason).toContain('low-risk');
      });

      it('should not auto-approve high-risk actions like send_email', async () => {
        const result = await service.shouldAutoApprove('user-1', 'send_email');
        expect(result.autoApprove).toBe(false);
      });

      it('should not auto-approve medium-risk actions like create_document', async () => {
        const result = await service.shouldAutoApprove('user-1', 'create_document');
        expect(result.autoApprove).toBe(false);
      });
    });

    describe('when agentic mode is enabled with autoApproveLevel: all', () => {
      beforeEach(() => {
        (agenticModeService.getEffectiveConfig as any).mockResolvedValue({
          enabled: true,
          maxSteps: 30,
          autoApproveLevel: 'all',
          pauseOnHighRisk: true, // Still pause on high risk
          notifyOnCompletion: true,
        });
      });

      it('should auto-approve low-risk actions', async () => {
        const result = await service.shouldAutoApprove('user-1', 'create_task');
        expect(result.autoApprove).toBe(true);
      });

      it('should auto-approve medium-risk actions', async () => {
        const result = await service.shouldAutoApprove('user-1', 'create_document');
        expect(result.autoApprove).toBe(true);
      });

      it('should NOT auto-approve high-risk actions when pauseOnHighRisk is true', async () => {
        const result = await service.shouldAutoApprove('user-1', 'send_email');
        expect(result.autoApprove).toBe(false);
        expect(result.reason).toContain('High-risk');
      });

      it('should never auto-approve critical actions', async () => {
        const result = await service.shouldAutoApprove('user-1', 'risk_save_play');
        expect(result.autoApprove).toBe(false);
        expect(result.reason).toContain('Critical');
      });
    });

    describe('when agentic mode is fully autonomous (pauseOnHighRisk: false)', () => {
      beforeEach(() => {
        (agenticModeService.getEffectiveConfig as any).mockResolvedValue({
          enabled: true,
          maxSteps: 50,
          autoApproveLevel: 'all',
          pauseOnHighRisk: false, // Full autonomy
          notifyOnCompletion: false,
        });
      });

      it('should auto-approve high-risk actions', async () => {
        const result = await service.shouldAutoApprove('user-1', 'send_email');
        expect(result.autoApprove).toBe(true);
      });

      it('should auto-approve schedule_meeting', async () => {
        const result = await service.shouldAutoApprove('user-1', 'schedule_meeting');
        expect(result.autoApprove).toBe(true);
      });

      it('should still NOT auto-approve critical actions', async () => {
        const result = await service.shouldAutoApprove('user-1', 'risk_save_play');
        expect(result.autoApprove).toBe(false);
        expect(result.reason).toContain('Critical');
      });
    });
  });

  describe('Risk level classification', () => {
    beforeEach(() => {
      // Enable agentic mode to test risk levels
      (agenticModeService.getEffectiveConfig as any).mockResolvedValue({
        enabled: true,
        maxSteps: 10,
        autoApproveLevel: 'low_risk', // Only low-risk auto-approved
        pauseOnHighRisk: true,
        notifyOnCompletion: true,
      });
    });

    const testCases: { actionType: ActionType; expectedLevel: 'low' | 'medium' | 'high' | 'critical' }[] = [
      // High risk
      { actionType: 'send_email', expectedLevel: 'high' },
      { actionType: 'schedule_meeting', expectedLevel: 'high' },
      { actionType: 'share_document', expectedLevel: 'high' },
      { actionType: 'risk_escalation', expectedLevel: 'high' },

      // Medium risk
      { actionType: 'create_document', expectedLevel: 'medium' },
      { actionType: 'create_spreadsheet', expectedLevel: 'medium' },
      { actionType: 'onboarding_kickoff', expectedLevel: 'medium' },
      { actionType: 'strategic_qbr_prep', expectedLevel: 'medium' },

      // Critical risk
      { actionType: 'risk_save_play', expectedLevel: 'critical' },

      // Low risk
      { actionType: 'create_task', expectedLevel: 'low' },
      { actionType: 'other', expectedLevel: 'low' },
    ];

    testCases.forEach(({ actionType, expectedLevel }) => {
      it(`should classify ${actionType} as ${expectedLevel} risk`, async () => {
        const result = await service.shouldAutoApprove('user-1', actionType);

        if (expectedLevel === 'low') {
          expect(result.autoApprove).toBe(true);
        } else {
          expect(result.autoApprove).toBe(false);
        }
      });
    });
  });
});
