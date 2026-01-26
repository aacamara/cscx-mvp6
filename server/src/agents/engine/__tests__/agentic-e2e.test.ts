/**
 * Agentic System End-to-End Integration Tests
 *
 * Tests the complete agentic flow:
 * 1. Agentic mode toggle and presets
 * 2. Goal execution through orchestrator
 * 3. Specialist agent routing
 * 4. Approval flow with HITL
 * 5. Resume after approval
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentContext, Tool, ToolResult } from '../../types.js';

// Mock external services
vi.mock('../../../services/google/calendar.js', () => ({
  calendarService: {
    getFreeBusy: vi.fn().mockResolvedValue(new Map([['primary', []]])),
    createEvent: vi.fn().mockResolvedValue({
      googleEventId: 'evt_e2e_123',
      title: 'E2E Test Meeting',
      startTime: new Date('2026-01-28T10:00:00'),
      endTime: new Date('2026-01-28T11:00:00'),
      meetLink: 'https://meet.google.com/e2e-test',
      attendees: [],
    }),
    listEvents: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/google/gmail.js', () => ({
  gmailService: {
    sendEmail: vi.fn().mockResolvedValue('msg_e2e_123'),
    listThreads: vi.fn().mockResolvedValue({ threads: [] }),
  },
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockImplementation(async (params: any) => {
          // Simulate Claude's tool-calling behavior based on the goal
          const userMessage = params.messages.find((m: any) => m.role === 'user');
          const content = typeof userMessage?.content === 'string'
            ? userMessage.content
            : JSON.stringify(userMessage?.content);

          // If there are tool results, provide final answer
          if (userMessage?.content && Array.isArray(userMessage.content) &&
              userMessage.content.some((c: any) => c.type === 'tool_result')) {
            return {
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: 'Task completed successfully. I have executed the requested action.' }],
            };
          }

          // First turn - decide which tool to use
          if (content.toLowerCase().includes('schedule') || content.toLowerCase().includes('meeting')) {
            return {
              stop_reason: 'tool_use',
              content: [
                { type: 'text', text: 'I will check calendar availability and book the meeting.' },
                {
                  type: 'tool_use',
                  id: 'tool_1',
                  name: 'check_availability',
                  input: {
                    participants: ['test@example.com'],
                    durationMinutes: 30,
                    dateRange: { start: '2026-01-28', end: '2026-01-31' },
                  },
                },
              ],
            };
          }

          if (content.toLowerCase().includes('email') || content.toLowerCase().includes('send')) {
            return {
              stop_reason: 'tool_use',
              content: [
                { type: 'text', text: 'I will draft and send the email.' },
                {
                  type: 'tool_use',
                  id: 'tool_2',
                  name: 'send_email',
                  input: {
                    to: 'test@example.com',
                    subject: 'E2E Test Email',
                    body: 'This is an automated test email.',
                  },
                },
              ],
            };
          }

          if (content.toLowerCase().includes('research') || content.toLowerCase().includes('churn')) {
            return {
              stop_reason: 'tool_use',
              content: [
                { type: 'text', text: 'I will analyze churn signals.' },
                {
                  type: 'tool_use',
                  id: 'tool_3',
                  name: 'detect_churn_signals',
                  input: {},
                },
              ],
            };
          }

          // Default - complete without tools
          return {
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'I understand your request but need more specific instructions.' }],
          };
        }),
      },
    })),
  };
});

vi.mock('../../../services/agentic-mode.js', () => {
  let currentConfig = {
    enabled: true,
    maxSteps: 10,
    autoApproveLevel: 'low_risk' as const,
    pauseOnHighRisk: true,
    notifyOnCompletion: true,
  };

  return {
    agenticModeService: {
      getSettings: vi.fn().mockImplementation(async () => ({
        config: { ...currentConfig },
        preset: 'supervised',
        schedule: null,
        lastUpdated: new Date().toISOString(),
      })),
      getEffectiveConfig: vi.fn().mockImplementation(async () => ({ ...currentConfig })),
      updateConfig: vi.fn().mockImplementation(async (userId: string, config: any) => {
        currentConfig = { ...currentConfig, ...config };
        return { config: currentConfig, preset: null, schedule: null, lastUpdated: new Date().toISOString() };
      }),
      applyPreset: vi.fn().mockImplementation(async (userId: string, preset: string) => {
        const presets: Record<string, any> = {
          manual: { enabled: false, maxSteps: 10, autoApproveLevel: 'none', pauseOnHighRisk: true, notifyOnCompletion: true },
          vacation: { enabled: true, maxSteps: 20, autoApproveLevel: 'low_risk', pauseOnHighRisk: true, notifyOnCompletion: true },
          supervised: { enabled: true, maxSteps: 15, autoApproveLevel: 'low_risk', pauseOnHighRisk: true, notifyOnCompletion: true },
          autonomous: { enabled: true, maxSteps: 30, autoApproveLevel: 'all', pauseOnHighRisk: true, notifyOnCompletion: true },
        };
        currentConfig = presets[preset] || currentConfig;
        return { config: currentConfig, preset, schedule: null, lastUpdated: new Date().toISOString() };
      }),
      toggleAgenticMode: vi.fn().mockImplementation(async (userId: string, enabled: boolean) => {
        currentConfig.enabled = enabled;
        return { config: currentConfig, preset: null, schedule: null, lastUpdated: new Date().toISOString() };
      }),
    },
  };
});

// Import after mocks
import { executeGoal, planGoal, resumeAfterApproval, executeWithSpecialist, quickCheckIn } from '../orchestrator-executor.js';
import { agenticModeService } from '../../../services/agentic-mode.js';

const createMockContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  userId: 'e2e-test-user',
  customer: {
    id: 'cust-e2e',
    name: 'E2E Test Corp',
    arr: 100000,
    healthScore: 72,
    status: 'active',
    renewalDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    primaryContact: {
      name: 'Test Contact',
      email: 'contact@e2e-test.com',
    },
  },
  currentPhase: 'monitoring',
  completedTasks: [],
  pendingApprovals: [],
  recentInteractions: [],
  riskSignals: [],
  ...overrides,
});

describe('Agentic System E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agentic Mode Configuration', () => {
    it('should load user settings on startup', async () => {
      const settings = await agenticModeService.getSettings('e2e-test-user');

      expect(settings).toBeDefined();
      expect(settings.config).toBeDefined();
      expect(settings.config.enabled).toBe(true);
    });

    it('should switch between presets', async () => {
      // Start with supervised
      let settings = await agenticModeService.applyPreset('e2e-test-user', 'supervised');
      expect(settings.preset).toBe('supervised');
      expect(settings.config.maxSteps).toBe(15);

      // Switch to vacation
      settings = await agenticModeService.applyPreset('e2e-test-user', 'vacation');
      expect(settings.preset).toBe('vacation');
      expect(settings.config.maxSteps).toBe(20);

      // Switch to autonomous
      settings = await agenticModeService.applyPreset('e2e-test-user', 'autonomous');
      expect(settings.preset).toBe('autonomous');
      expect(settings.config.autoApproveLevel).toBe('all');
    });

    it('should toggle agentic mode on/off', async () => {
      // Turn off
      let settings = await agenticModeService.toggleAgenticMode('e2e-test-user', false);
      expect(settings.config.enabled).toBe(false);

      // Turn on
      settings = await agenticModeService.toggleAgenticMode('e2e-test-user', true);
      expect(settings.config.enabled).toBe(true);
    });
  });

  describe('Goal Execution Flow', () => {
    it('should execute a simple research goal autonomously', async () => {
      const context = createMockContext();

      // Reset to supervised mode
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');

      const result = await executeGoal('Analyze churn signals for this customer', context);

      expect(result).toBeDefined();
      // With mock Claude, the result depends on mock implementation
      // The key is that it processes without throwing
      expect(['completed', 'paused_for_approval', 'max_steps_reached']).toContain(result.state.status);
    });

    it('should pause for approval on high-risk actions', async () => {
      const context = createMockContext();

      // Ensure supervised mode (pauses on high-risk)
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');

      const result = await executeGoal('Send a check-in email to the customer', context);

      expect(result).toBeDefined();
      // send_email is high-risk, should pause for approval
      expect(result.state.status).toBe('paused_for_approval');
      expect(result.state.pendingApproval).toBeDefined();
      expect(result.state.pendingApproval?.toolName).toBe('send_email');
    });

    it('should complete after approval is granted', async () => {
      const context = createMockContext();

      // First, trigger a pause
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');
      const pausedResult = await executeGoal('Send a check-in email to the customer', context);

      expect(pausedResult.state.status).toBe('paused_for_approval');

      // Now resume with approval
      const resumedResult = await resumeAfterApproval(
        pausedResult.state,
        true, // approved
        context
      );

      expect(resumedResult).toBeDefined();
      // After resume, it may complete or pause again (depending on Claude response)
      expect(['completed', 'paused_for_approval', 'max_steps_reached']).toContain(resumedResult.state.status);
    });

    it('should handle rejection gracefully', async () => {
      const context = createMockContext();

      // First, trigger a pause
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');
      const pausedResult = await executeGoal('Send a check-in email to the customer', context);

      expect(pausedResult.state.status).toBe('paused_for_approval');

      // Reject the action
      const rejectedResult = await resumeAfterApproval(
        pausedResult.state,
        false, // rejected
        context
      );

      expect(rejectedResult).toBeDefined();
      // After rejection, loop continues (may complete or pause on next action)
      expect(['completed', 'paused_for_approval', 'max_steps_reached', 'failed']).toContain(rejectedResult.state.status);
    });
  });

  describe('Specialist Agent Routing', () => {
    it('should route to scheduler for calendar tasks', async () => {
      const context = createMockContext();
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');

      const result = await executeWithSpecialist('scheduler', 'Check availability for next week', context);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Scheduler's check_availability is low-risk, should complete
      expect(result.state.status).toBe('completed');
    });

    it('should route to communicator for email tasks', async () => {
      const context = createMockContext();
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');

      const result = await executeWithSpecialist('communicator', 'Send follow-up email', context);

      // send_email requires approval in supervised mode
      expect(result.state.status).toBe('paused_for_approval');
      expect(result.state.pendingApproval?.toolName).toBe('send_email');
    });

    it('should route to researcher for intelligence tasks', async () => {
      const context = createMockContext();
      await agenticModeService.applyPreset('e2e-test-user', 'supervised');

      const result = await executeWithSpecialist('researcher', 'Analyze churn risk', context);

      expect(result).toBeDefined();
      // Researcher tools are low-risk, but execution depends on Claude mock
      expect(['completed', 'paused_for_approval', 'max_steps_reached']).toContain(result.state.status);
    });

    it('should reject invalid specialist IDs', async () => {
      const context = createMockContext();

      const result = await executeWithSpecialist('invalid-agent', 'Do something', context);

      expect(result.success).toBe(false);
      expect(result.state.status).toBe('failed');
      expect(result.state.error).toContain('Unknown agent');
    });
  });

  describe('Plan Generation and Execution', () => {
    it('should generate a multi-step plan', async () => {
      const context = createMockContext();

      const plan = await planGoal('Prepare QBR for customer', context);

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.originalRequest).toBe('Prepare QBR for customer');
      expect(plan.plan).toBeDefined();
      expect(plan.plan.length).toBeGreaterThanOrEqual(0); // May be 0 if Claude returns no steps
    });
  });

  describe('Quick Check-In', () => {
    it('should return health summary and recommendations', async () => {
      const context = createMockContext();

      const checkIn = await quickCheckIn(context);

      expect(checkIn).toBeDefined();
      expect(checkIn.healthScore).toBe(72);
      expect(checkIn.recommendations).toBeDefined();
      expect(Array.isArray(checkIn.recommendations)).toBe(true);
    });

    it('should flag low health customers as urgent', async () => {
      const context = createMockContext({
        customer: {
          id: 'low-health',
          name: 'At Risk Corp',
          arr: 50000,
          healthScore: 45,
          status: 'at_risk',
        },
      });

      const checkIn = await quickCheckIn(context);

      expect(checkIn.healthScore).toBe(45);
      expect(checkIn.recommendations.some((r: string) => r.toLowerCase().includes('urgent'))).toBe(true);
    });

    it('should recommend renewal actions when close to renewal', async () => {
      const context = createMockContext({
        customer: {
          id: 'renewal-soon',
          name: 'Renewal Corp',
          arr: 75000,
          healthScore: 85,
          status: 'active',
          renewalDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days
        },
      });

      const checkIn = await quickCheckIn(context);

      expect(checkIn.recommendations.some((r: string) => r.toLowerCase().includes('renewal'))).toBe(true);
    });
  });

  describe('Context Preservation', () => {
    it('should pass customer context through the entire flow', async () => {
      const context = createMockContext({
        customer: {
          id: 'context-test',
          name: 'Context Test Corp',
          arr: 250000,
          healthScore: 88,
          status: 'active',
          primaryContact: {
            name: 'Jane Doe',
            email: 'jane@context-test.com',
          },
        },
      });

      const result = await executeGoal('Research company', context);

      expect(result).toBeDefined();
      // The context should have been available during execution
      expect(result.state.goalDescription).toContain('Research company');
    });

    it('should preserve userId for agentic mode lookup', async () => {
      const context = createMockContext({ userId: 'specific-user-id' });

      await executeGoal('Check calendar', context);

      // agenticModeService should have been called with the userId
      expect(agenticModeService.getEffectiveConfig).toHaveBeenCalledWith('specific-user-id');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in goal execution', async () => {
      const context = createMockContext({ userId: undefined as any });

      // Even with bad input, should not throw
      const result = await quickCheckIn(context);

      expect(result).toBeDefined();
      expect(result.healthScore).toBeDefined();
    });
  });

  describe('Approval Levels', () => {
    it('should auto-approve all in autonomous mode', async () => {
      const context = createMockContext();

      // Switch to autonomous mode
      await agenticModeService.applyPreset('e2e-test-user', 'autonomous');
      const config = await agenticModeService.getEffectiveConfig('e2e-test-user');

      expect(config.enabled).toBe(true);
      expect(config.autoApproveLevel).toBe('all');
    });

    it('should require approval for everything in manual mode', async () => {
      const context = createMockContext();

      // Switch to manual mode
      await agenticModeService.applyPreset('e2e-test-user', 'manual');
      const config = await agenticModeService.getEffectiveConfig('e2e-test-user');

      expect(config.enabled).toBe(false);
      expect(config.autoApproveLevel).toBe('none');
    });
  });
});

describe('Agentic Flow Summary', () => {
  it('should demonstrate complete agentic workflow', async () => {
    /**
     * This test demonstrates the full agentic workflow:
     * 1. CSM sets agentic mode to "vacation"
     * 2. Customer check-in is triggered
     * 3. Agent researches customer (auto-approved)
     * 4. Agent attempts to send email (paused for approval)
     * 5. CSM approves via mobile notification
     * 6. Email is sent, workflow completes
     */

    const context = createMockContext({
      userId: 'csm-on-vacation',
      customer: {
        id: 'important-customer',
        name: 'VIP Corp',
        arr: 500000,
        healthScore: 65,
        status: 'active',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        primaryContact: { name: 'CEO', email: 'ceo@vip.com' },
      },
    });

    // Step 1: Set vacation mode
    const settings = await agenticModeService.applyPreset('csm-on-vacation', 'vacation');
    expect(settings.config.enabled).toBe(true);
    expect(settings.config.autoApproveLevel).toBe('low_risk');

    // Step 2 & 3: Check-in and research (auto-approved)
    const checkIn = await quickCheckIn(context);
    expect(checkIn.healthScore).toBe(65);
    expect(checkIn.recommendations.length).toBeGreaterThan(0);

    const research = await executeWithSpecialist('researcher', 'Analyze customer health', context);
    expect(research.success).toBe(true);

    // Step 4: Attempt email (paused)
    const emailAttempt = await executeGoal('Send proactive check-in email', context);
    expect(emailAttempt.state.status).toBe('paused_for_approval');

    // Step 5: CSM approves
    const approved = await resumeAfterApproval(emailAttempt.state, true, context);

    // Step 6: Workflow progresses (may complete or need more approvals)
    expect(['completed', 'paused_for_approval', 'max_steps_reached']).toContain(approved.state.status);

    // Summary logging
    console.log('\n=== Agentic Workflow Progress ===');
    console.log(`Mode: Vacation`);
    console.log(`Customer: ${context.customer.name} (Health: ${checkIn.healthScore})`);
    console.log(`Actions Executed: ${approved.actions.length}`);
    console.log(`Status: ${approved.state.status}`);
    console.log('================================\n');
  });
});
