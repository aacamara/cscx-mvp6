/**
 * Specialist Agent Integration Tests
 * Tests that all specialists work correctly with the agentic loop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentContext, Tool, ToolResult } from '../../types.js';

// Mock the Google services
vi.mock('../../../services/google/calendar.js', () => ({
  calendarService: {
    getFreeBusy: vi.fn().mockResolvedValue(new Map([
      ['primary', [
        { start: new Date('2026-01-26T10:00:00'), end: new Date('2026-01-26T11:00:00') },
      ]]
    ])),
    createEvent: vi.fn().mockResolvedValue({
      googleEventId: 'evt_123',
      title: 'QBR Meeting',
      startTime: new Date('2026-01-27T14:00:00'),
      endTime: new Date('2026-01-27T15:00:00'),
      meetLink: 'https://meet.google.com/xxx-yyyy-zzz',
      attendees: [{ email: 'contact@customer.com' }],
    }),
    listEvents: vi.fn().mockResolvedValue([
      {
        googleEventId: 'evt_456',
        title: 'Customer Check-in',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        meetLink: 'https://meet.google.com/abc-def-ghi',
        attendees: [{ email: 'contact@customer.com' }],
      },
    ]),
  },
}));

vi.mock('../../../services/google/gmail.js', () => ({
  gmailService: {
    sendEmail: vi.fn().mockResolvedValue('msg_123'),
    listThreads: vi.fn().mockResolvedValue({
      threads: [
        {
          id: 'thread_1',
          subject: 'RE: Product Onboarding',
          snippet: 'Thanks for the update...',
          participants: ['csm@company.com', 'contact@customer.com'],
          messageCount: 5,
          lastMessageAt: new Date().toISOString(),
          isUnread: false,
        },
      ],
    }),
  },
}));

// Import after mocks are set up
import { SchedulerAgent } from '../../specialists/scheduler.js';
import { CommunicatorAgent } from '../../specialists/communicator.js';
import { ResearcherAgent } from '../../specialists/researcher.js';

const mockContext: AgentContext = {
  userId: 'user-123',
  customer: {
    id: 'cust-123',
    name: 'Test Corp',
    arr: 75000,
    healthScore: 72,
    status: 'active',
    renewalDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    primaryContact: {
      name: 'Jane Smith',
      email: 'jane@testcorp.com',
    },
  },
  currentPhase: 'monitoring',
  completedTasks: [],
  pendingApprovals: [],
  recentInteractions: [],
  riskSignals: [],
};

describe('Specialist Agent Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SchedulerAgent', () => {
    it('should have all required tools', () => {
      expect(SchedulerAgent.tools.length).toBeGreaterThanOrEqual(4);
      const toolNames = SchedulerAgent.tools.map(t => t.name);
      expect(toolNames).toContain('check_availability');
      expect(toolNames).toContain('propose_meeting');
      expect(toolNames).toContain('book_meeting');
      expect(toolNames).toContain('get_todays_meetings');
    });

    it('should execute check_availability with real service', async () => {
      const tool = SchedulerAgent.tools.find(t => t.name === 'check_availability');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        participants: ['jane@testcorp.com'],
        durationMinutes: 30,
        dateRange: {
          start: '2026-01-26',
          end: '2026-01-30',
        },
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.availableSlots).toBeDefined();
      expect(Array.isArray(result.data?.availableSlots)).toBe(true);
    });

    it('should execute book_meeting with real service', async () => {
      const tool = SchedulerAgent.tools.find(t => t.name === 'book_meeting');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        title: 'QBR Meeting',
        participants: ['jane@testcorp.com'],
        slot: {
          start: '2026-01-27T14:00:00Z',
          end: '2026-01-27T15:00:00Z',
        },
        includeGoogleMeet: true,
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.eventId).toBe('evt_123');
      expect(result.data?.meetLink).toBeDefined();
    });

    it('should execute get_todays_meetings with real service', async () => {
      const tool = SchedulerAgent.tools.find(t => t.name === 'get_todays_meetings');
      expect(tool).toBeDefined();

      const result = await tool!.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.meetings).toBeDefined();
      expect(Array.isArray(result.data?.meetings)).toBe(true);
    });

    it('should mark high-risk tools as requiring approval', () => {
      const bookMeeting = SchedulerAgent.tools.find(t => t.name === 'book_meeting');
      expect(bookMeeting?.requiresApproval).toBe(true);

      const proposeMeeting = SchedulerAgent.tools.find(t => t.name === 'propose_meeting');
      expect(proposeMeeting?.requiresApproval).toBe(true);
    });

    it('should allow low-risk tools without approval', () => {
      const checkAvailability = SchedulerAgent.tools.find(t => t.name === 'check_availability');
      expect(checkAvailability?.requiresApproval).toBe(false);

      const getTodaysMeetings = SchedulerAgent.tools.find(t => t.name === 'get_todays_meetings');
      expect(getTodaysMeetings?.requiresApproval).toBe(false);
    });
  });

  describe('CommunicatorAgent', () => {
    it('should have all required tools', () => {
      expect(CommunicatorAgent.tools.length).toBeGreaterThanOrEqual(4);
      const toolNames = CommunicatorAgent.tools.map(t => t.name);
      expect(toolNames).toContain('draft_email');
      expect(toolNames).toContain('send_email');
      expect(toolNames).toContain('get_email_history');
      expect(toolNames).toContain('search_emails');
    });

    it('should execute draft_email with context', async () => {
      const tool = CommunicatorAgent.tools.find(t => t.name === 'draft_email');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        to: 'jane@testcorp.com',
        purpose: 'check-in',
        keyPoints: ['Review Q4 progress', 'Discuss upcoming renewal'],
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.subject).toContain('Test Corp');
      expect(result.data?.body).toContain('Review Q4 progress');
    });

    it('should execute send_email with real service', async () => {
      const tool = CommunicatorAgent.tools.find(t => t.name === 'send_email');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        to: 'jane@testcorp.com',
        subject: 'Quick Check-in',
        body: 'Hi Jane, just wanted to touch base...',
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.messageId).toBe('msg_123');
      expect(result.data?.status).toBe('sent');
    });

    it('should execute get_email_history with real service', async () => {
      const tool = CommunicatorAgent.tools.find(t => t.name === 'get_email_history');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        customerEmail: 'jane@testcorp.com',
        limit: 5,
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.threads).toBeDefined();
      expect(Array.isArray(result.data?.threads)).toBe(true);
    });

    it('should execute search_emails with real service', async () => {
      const tool = CommunicatorAgent.tools.find(t => t.name === 'search_emails');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        query: 'renewal',
        from: 'jane@testcorp.com',
        limit: 10,
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.results).toBeDefined();
      expect(result.data?.query).toContain('from:jane@testcorp.com');
    });

    it('should mark email sending as requiring approval', () => {
      const sendEmail = CommunicatorAgent.tools.find(t => t.name === 'send_email');
      expect(sendEmail?.requiresApproval).toBe(true);

      const draftEmail = CommunicatorAgent.tools.find(t => t.name === 'draft_email');
      expect(draftEmail?.requiresApproval).toBe(true);
    });
  });

  describe('ResearcherAgent', () => {
    it('should have all required tools', () => {
      expect(ResearcherAgent.tools.length).toBeGreaterThanOrEqual(4);
      const toolNames = ResearcherAgent.tools.map(t => t.name);
      expect(toolNames).toContain('research_company');
      expect(toolNames).toContain('analyze_usage_patterns');
      expect(toolNames).toContain('detect_churn_signals');
      expect(toolNames).toContain('find_expansion_opportunities');
    });

    it('should execute research_company', async () => {
      const tool = ResearcherAgent.tools.find(t => t.name === 'research_company');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        companyName: 'Test Corp',
        researchAreas: ['financials', 'news'],
        depth: 'standard',
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.companyName).toBe('Test Corp');
      expect(result.data?.keyInsights).toBeDefined();
    });

    it('should execute analyze_usage_patterns with context', async () => {
      const tool = ResearcherAgent.tools.find(t => t.name === 'analyze_usage_patterns');
      expect(tool).toBeDefined();

      const result = await tool!.execute({
        timeRange: '30d',
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.overallAdoption).toBeDefined();
      expect(result.data?.topFeatures).toBeDefined();
    });

    it('should execute detect_churn_signals with health score context', async () => {
      const tool = ResearcherAgent.tools.find(t => t.name === 'detect_churn_signals');
      expect(tool).toBeDefined();

      const result = await tool!.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.riskLevel).toBe('medium'); // healthScore 72 = medium
      expect(result.data?.churnProbability).toBeLessThan(0.5);
    });

    it('should return high risk for low health customers', async () => {
      const lowHealthContext: AgentContext = {
        ...mockContext,
        customer: {
          ...mockContext.customer,
          healthScore: 45,
        },
      };

      const tool = ResearcherAgent.tools.find(t => t.name === 'detect_churn_signals');
      const result = await tool!.execute({}, lowHealthContext);

      expect(result.success).toBe(true);
      expect(result.data?.riskLevel).toBe('high');
      expect(result.data?.churnProbability).toBeGreaterThan(0.5);
    });

    it('should find expansion opportunities based on ARR', async () => {
      const tool = ResearcherAgent.tools.find(t => t.name === 'find_expansion_opportunities');
      expect(tool).toBeDefined();

      const result = await tool!.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.currentArr).toBe(75000);
      expect(result.data?.expansionPotential).toBe(22500); // 30% of ARR
      expect(result.data?.opportunities.length).toBeGreaterThan(0);
    });

    it('should not require approval for research tools', () => {
      for (const tool of ResearcherAgent.tools) {
        expect(tool.requiresApproval).toBe(false);
      }
    });
  });

  describe('Cross-Agent Workflow', () => {
    it('should support a typical check-in workflow', async () => {
      // Step 1: Research customer status
      const detectChurn = ResearcherAgent.tools.find(t => t.name === 'detect_churn_signals');
      const churnResult = await detectChurn!.execute({}, mockContext);
      expect(churnResult.success).toBe(true);

      // Step 2: Check calendar for meeting
      const checkAvail = SchedulerAgent.tools.find(t => t.name === 'check_availability');
      const availResult = await checkAvail!.execute({
        participants: ['jane@testcorp.com'],
        durationMinutes: 30,
        dateRange: { start: '2026-01-27', end: '2026-01-31' },
      }, mockContext);
      expect(availResult.success).toBe(true);

      // Step 3: Draft check-in email
      const draftEmail = CommunicatorAgent.tools.find(t => t.name === 'draft_email');
      const draftResult = await draftEmail!.execute({
        to: 'jane@testcorp.com',
        purpose: 'check-in',
        keyPoints: [
          `Review health score: ${mockContext.customer.healthScore}`,
          `Discuss renewal in ${90} days`,
        ],
      }, mockContext);
      expect(draftResult.success).toBe(true);
    });

    it('should support a renewal preparation workflow', async () => {
      // Step 1: Find expansion opportunities
      const findExpansion = ResearcherAgent.tools.find(t => t.name === 'find_expansion_opportunities');
      const expansionResult = await findExpansion!.execute({}, mockContext);
      expect(expansionResult.success).toBe(true);

      // Step 2: Get email history to understand relationship
      const getHistory = CommunicatorAgent.tools.find(t => t.name === 'get_email_history');
      const historyResult = await getHistory!.execute({
        customerEmail: 'jane@testcorp.com',
        limit: 10,
      }, mockContext);
      expect(historyResult.success).toBe(true);

      // Step 3: Schedule renewal meeting
      const bookMeeting = SchedulerAgent.tools.find(t => t.name === 'book_meeting');
      const meetingResult = await bookMeeting!.execute({
        title: 'Renewal Discussion - Test Corp',
        participants: ['jane@testcorp.com'],
        slot: { start: '2026-01-28T10:00:00Z', end: '2026-01-28T11:00:00Z' },
        includeGoogleMeet: true,
      }, mockContext);
      expect(meetingResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing userId gracefully', async () => {
      const contextWithoutUser: AgentContext = {
        ...mockContext,
        userId: undefined as any,
      };

      const tool = SchedulerAgent.tools.find(t => t.name === 'check_availability');
      const result = await tool!.execute({
        participants: ['test@test.com'],
        durationMinutes: 30,
        dateRange: { start: '2026-01-26', end: '2026-01-30' },
      }, contextWithoutUser);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User ID required');
    });

    it('should handle missing email fields', async () => {
      const tool = CommunicatorAgent.tools.find(t => t.name === 'send_email');
      const result = await tool!.execute({
        // Missing required fields
      }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires');
    });
  });

  describe('Tool Schema Validation', () => {
    it('all tools should have valid input schemas', () => {
      const allAgents = [SchedulerAgent, CommunicatorAgent, ResearcherAgent];

      for (const agent of allAgents) {
        for (const tool of agent.tools) {
          expect(tool.inputSchema).toBeDefined();
          expect(tool.inputSchema.type).toBe('object');
          expect(tool.inputSchema.properties).toBeDefined();
        }
      }
    });

    it('all tools should have descriptions', () => {
      const allAgents = [SchedulerAgent, CommunicatorAgent, ResearcherAgent];

      for (const agent of allAgents) {
        for (const tool of agent.tools) {
          expect(tool.description).toBeDefined();
          expect(tool.description.length).toBeGreaterThan(10);
        }
      }
    });

    it('all tools should have execute functions', () => {
      const allAgents = [SchedulerAgent, CommunicatorAgent, ResearcherAgent];

      for (const agent of allAgents) {
        for (const tool of agent.tools) {
          expect(typeof tool.execute).toBe('function');
        }
      }
    });
  });
});
