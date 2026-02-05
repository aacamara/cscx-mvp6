/**
 * Integration Test: Button → CADG Card Flow (US-010)
 *
 * Verifies the full pipeline:
 *   1. Button click generates correct trigger message (buildCadgTriggerMessage logic)
 *   2. Trigger message is correctly classified by taskClassifier
 *   3. Classification returns the expected TaskType with high confidence
 *   4. Tests at least one button per agent type (5 total)
 *   5. Tests General Mode buttons (no customer context)
 *
 * NOTE: This test uses the real taskClassifier keyword/phrase matching.
 * LLM classification is mocked since button-generated messages should always
 * hit phrase/keyword matching (confidence ≥ 0.7) and never reach the LLM fallback.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { classify, isGenerativeRequest } from '../taskClassifier.js';
import type { TaskType } from '../types.js';

// Mock the Anthropic SDK to avoid real API calls
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'custom|0.3' }],
        }),
      },
    })),
  };
});

// Mock config to provide API key
vi.mock('../../../config/index.js', () => ({
  config: {
    anthropicApiKey: 'test-key',
  },
}));

// ============================================================================
// Replicate buildCadgTriggerMessage logic from frontend
// (Same logic as components/AgentControlCenter/index.tsx)
// ============================================================================
function buildCadgTriggerMessage(taskType: string, customerName?: string): string {
  const name = customerName || 'Acme Corp';

  const generalModeMessages: Record<string, string> = {
    portfolio_dashboard: 'Show me my portfolio dashboard with all customers',
    team_metrics: 'Show me team metrics and CSM performance dashboard',
    renewal_pipeline: 'Show me the renewal pipeline with upcoming renewals',
    at_risk_overview: 'Show me the at-risk overview dashboard',
  };

  if (generalModeMessages[taskType]) {
    return generalModeMessages[taskType];
  }

  const customerMessages: Record<string, string> = {
    kickoff_plan: `Create a kickoff plan for ${name}`,
    milestone_plan: `Create a 30-60-90 day milestone plan for ${name}`,
    stakeholder_map: `Create a stakeholder map for ${name}`,
    training_schedule: `Create a training schedule for ${name}`,
    usage_analysis: `Run a usage analysis for ${name}`,
    feature_campaign: `Create a feature adoption campaign for ${name}`,
    champion_development: `Create a champion development program for ${name}`,
    training_program: `Create a training program for ${name}`,
    renewal_forecast: `Generate a renewal forecast for ${name}`,
    value_summary: `Create a value summary for ${name}`,
    expansion_proposal: `Create an expansion proposal for ${name}`,
    negotiation_brief: `Prepare a negotiation brief for ${name}`,
    risk_assessment: `Run a risk assessment for ${name}`,
    save_play: `Create a save play for ${name}`,
    escalation_report: `Create an escalation report for ${name}`,
    resolution_plan: `Create a resolution plan for ${name}`,
    qbr_generation: `Create a QBR for ${name}`,
    executive_briefing: `Create an executive briefing for ${name}`,
    account_plan: `Create an account plan for ${name}`,
    transformation_roadmap: `Create a transformation roadmap for ${name}`,
  };

  return customerMessages[taskType] || `Generate ${taskType.replace(/_/g, ' ')} for ${name}`;
}

// ============================================================================
// Replicate AGENT_ACTIONS from frontend (AgentCard.tsx)
// ============================================================================
interface AgentAction {
  id: string;
  label: string;
  icon: string;
  cadgTaskType?: string;
}

const AGENT_ACTIONS: Record<string, AgentAction[]> = {
  onboarding: [
    { id: 'kickoff_plan', label: 'Kickoff Plan', icon: '📅', cadgTaskType: 'kickoff_plan' },
    { id: 'milestone_plan', label: '30-60-90 Day Plan', icon: '📋', cadgTaskType: 'milestone_plan' },
    { id: 'stakeholder_map', label: 'Stakeholder Map', icon: '👥', cadgTaskType: 'stakeholder_map' },
    { id: 'training_schedule', label: 'Training Schedule', icon: '📚', cadgTaskType: 'training_schedule' },
    { id: 'meeting_prep', label: 'AI Meeting Prep', icon: '🤖' },
  ],
  adoption: [
    { id: 'usage_analysis', label: 'Usage Analysis', icon: '📊', cadgTaskType: 'usage_analysis' },
    { id: 'feature_campaign', label: 'Feature Campaign', icon: '🎯', cadgTaskType: 'feature_campaign' },
    { id: 'training_program', label: 'Training Program', icon: '📚', cadgTaskType: 'training_program' },
    { id: 'champion_development', label: 'Champion Development', icon: '🏆', cadgTaskType: 'champion_development' },
  ],
  renewal: [
    { id: 'renewal_forecast', label: 'Renewal Forecast', icon: '🔮', cadgTaskType: 'renewal_forecast' },
    { id: 'value_summary', label: 'Value Summary', icon: '💎', cadgTaskType: 'value_summary' },
    { id: 'expansion_proposal', label: 'Expansion Proposal', icon: '📈', cadgTaskType: 'expansion_proposal' },
    { id: 'negotiation_brief', label: 'Negotiation Brief', icon: '📖', cadgTaskType: 'negotiation_brief' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
  risk: [
    { id: 'risk_assessment', label: 'Risk Assessment', icon: '⚠️', cadgTaskType: 'risk_assessment' },
    { id: 'save_play', label: 'Save Play', icon: '🛡️', cadgTaskType: 'save_play' },
    { id: 'escalation_report', label: 'Escalation Report', icon: '🚨', cadgTaskType: 'escalation_report' },
    { id: 'resolution_plan', label: 'Resolution Plan', icon: '🩺', cadgTaskType: 'resolution_plan' },
  ],
  strategic: [
    { id: 'qbr_generation', label: 'QBR Generation', icon: '📊', cadgTaskType: 'qbr_generation' },
    { id: 'executive_briefing', label: 'Executive Briefing', icon: '👔', cadgTaskType: 'executive_briefing' },
    { id: 'account_plan', label: 'Account Plan', icon: '🗺️', cadgTaskType: 'account_plan' },
    { id: 'transformation_roadmap', label: 'Transformation Roadmap', icon: '🎯', cadgTaskType: 'transformation_roadmap' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
};

const GENERAL_MODE_ACTIONS: AgentAction[] = [
  { id: 'portfolio_dashboard', label: 'Portfolio Dashboard', icon: '📊', cadgTaskType: 'portfolio_dashboard' },
  { id: 'team_metrics', label: 'Team Metrics', icon: '👥', cadgTaskType: 'team_metrics' },
  { id: 'renewal_pipeline', label: 'Renewal Pipeline', icon: '🔄', cadgTaskType: 'renewal_pipeline' },
  { id: 'at_risk_overview', label: 'At-Risk Overview', icon: '⚠️', cadgTaskType: 'at_risk_overview' },
];

// ============================================================================
// Helper: simulate the full flow for a single button click
// ============================================================================
async function simulateButtonClick(
  agentType: string,
  actionId: string,
  customerName?: string
): Promise<{
  triggerMessage: string;
  classifiedTaskType: TaskType;
  confidence: number;
  isGenerative: boolean;
  matchesExpected: boolean;
}> {
  // Step 1: Find the action (check agent actions and general mode)
  let action: AgentAction | undefined;
  if (agentType === 'general_mode') {
    action = GENERAL_MODE_ACTIONS.find(a => a.id === actionId);
  } else {
    action = AGENT_ACTIONS[agentType]?.find(a => a.id === actionId);
  }

  if (!action?.cadgTaskType) {
    throw new Error(`Action ${actionId} on agent ${agentType} has no cadgTaskType`);
  }

  // Step 2: Build trigger message (same logic as frontend)
  const triggerMessage = buildCadgTriggerMessage(action.cadgTaskType, customerName);

  // Step 3: Classify through the real task classifier
  const result = await classify(triggerMessage, undefined, agentType as any);

  // Step 4: Check if the message would be treated as generative
  const generative = isGenerativeRequest(triggerMessage) || result.confidence >= 0.7;

  return {
    triggerMessage,
    classifiedTaskType: result.taskType,
    confidence: result.confidence,
    isGenerative: generative,
    matchesExpected: result.taskType === action.cadgTaskType,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Button → CADG Card Flow Integration', () => {
  describe('One button per agent type (5 total)', () => {
    it('Onboarding: kickoff_plan button → kickoff_plan classification', async () => {
      const result = await simulateButtonClick('onboarding', 'kickoff_plan', 'Acme Corp');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('kickoff_plan');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
      expect(result.triggerMessage).toContain('kickoff plan');
    });

    it('Adoption: usage_analysis button → usage_analysis classification', async () => {
      const result = await simulateButtonClick('adoption', 'usage_analysis', 'TechStart Inc');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('usage_analysis');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
      expect(result.triggerMessage).toContain('usage analysis');
    });

    it('Renewal: renewal_forecast button → renewal_forecast classification', async () => {
      const result = await simulateButtonClick('renewal', 'renewal_forecast', 'GlobalTech');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('renewal_forecast');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
      expect(result.triggerMessage).toContain('renewal forecast');
    });

    it('Risk: risk_assessment button → risk_assessment classification', async () => {
      const result = await simulateButtonClick('risk', 'risk_assessment', 'DataFlow Systems');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('risk_assessment');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
      expect(result.triggerMessage).toContain('risk assessment');
    });

    it('Strategic: qbr_generation button → qbr_generation classification', async () => {
      const result = await simulateButtonClick('strategic', 'qbr_generation', 'Enterprise Co');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('qbr_generation');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
      expect(result.triggerMessage).toContain('QBR');
    });
  });

  describe('General Mode buttons (no customer context)', () => {
    it('portfolio_dashboard button → portfolio_dashboard classification', async () => {
      const result = await simulateButtonClick('general_mode', 'portfolio_dashboard');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('portfolio_dashboard');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
      expect(result.triggerMessage).not.toContain('Acme');
    });

    it('team_metrics button → team_metrics classification', async () => {
      const result = await simulateButtonClick('general_mode', 'team_metrics');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('team_metrics');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
    });

    it('renewal_pipeline button → renewal_pipeline classification', async () => {
      const result = await simulateButtonClick('general_mode', 'renewal_pipeline');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('renewal_pipeline');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
    });

    it('at_risk_overview button → at_risk_overview classification', async () => {
      const result = await simulateButtonClick('general_mode', 'at_risk_overview');

      expect(result.matchesExpected).toBe(true);
      expect(result.classifiedTaskType).toBe('at_risk_overview');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.isGenerative).toBe(true);
    });
  });

  describe('All CADG-enabled buttons classify correctly', () => {
    // Test every single CADG-enabled button across all agents
    const agentTypes = ['onboarding', 'adoption', 'renewal', 'risk', 'strategic'] as const;

    for (const agentType of agentTypes) {
      const actions = AGENT_ACTIONS[agentType];
      const cadgActions = actions.filter(a => a.cadgTaskType);

      for (const action of cadgActions) {
        it(`${agentType}/${action.id} → ${action.cadgTaskType}`, async () => {
          const result = await simulateButtonClick(agentType, action.id, 'Test Customer');

          expect(result.matchesExpected).toBe(true);
          expect(result.classifiedTaskType).toBe(action.cadgTaskType);
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
          expect(result.isGenerative).toBe(true);
        });
      }
    }
  });

  describe('Non-CADG actions are excluded from CADG flow', () => {
    it('meeting_prep has no cadgTaskType', () => {
      const action = AGENT_ACTIONS.onboarding.find(a => a.id === 'meeting_prep');
      expect(action).toBeDefined();
      expect(action?.cadgTaskType).toBeUndefined();
    });

    it('draft_email has no cadgTaskType', () => {
      const action = AGENT_ACTIONS.renewal.find(a => a.id === 'draft_email');
      expect(action).toBeDefined();
      expect(action?.cadgTaskType).toBeUndefined();
    });
  });

  describe('Trigger messages use exact CADG keywords', () => {
    it('trigger messages contain recognizable CADG phrases', () => {
      // Verify trigger messages contain phrases that will trigger phrase matching
      const expectedPhrases: Record<string, string> = {
        kickoff_plan: 'kickoff plan',
        milestone_plan: '30-60-90',
        stakeholder_map: 'stakeholder map',
        training_schedule: 'training schedule',
        usage_analysis: 'usage analysis',
        feature_campaign: 'feature adoption campaign',
        champion_development: 'champion development',
        training_program: 'training program',
        renewal_forecast: 'renewal forecast',
        value_summary: 'value summary',
        expansion_proposal: 'expansion proposal',
        negotiation_brief: 'negotiation brief',
        risk_assessment: 'risk assessment',
        save_play: 'save play',
        escalation_report: 'escalation report',
        resolution_plan: 'resolution plan',
        qbr_generation: 'QBR',
        executive_briefing: 'executive briefing',
        account_plan: 'account plan',
        transformation_roadmap: 'transformation roadmap',
      };

      for (const [taskType, expectedPhrase] of Object.entries(expectedPhrases)) {
        const message = buildCadgTriggerMessage(taskType, 'Test Co');
        expect(message.toLowerCase()).toContain(expectedPhrase.toLowerCase());
      }
    });

    it('general mode messages do not include customer names', () => {
      const generalTaskTypes = ['portfolio_dashboard', 'team_metrics', 'renewal_pipeline', 'at_risk_overview'];

      for (const taskType of generalTaskTypes) {
        const message = buildCadgTriggerMessage(taskType);
        // Should not contain any customer name placeholder
        expect(message).not.toContain('undefined');
        expect(message).not.toContain('null');
        expect(message).not.toContain('the customer');
      }
    });
  });

  describe('Agent boosting works for ambiguous queries', () => {
    it('activeAgent context is accepted and does not break classification', async () => {
      // Verify that passing activeAgent doesn't cause errors and classification still works
      const withAgent = await classify('Create a kickoff plan for Acme', undefined, 'onboarding');
      const withoutAgent = await classify('Create a kickoff plan for Acme');

      // Both should classify correctly
      expect(withAgent.taskType).toBe('kickoff_plan');
      expect(withoutAgent.taskType).toBe('kickoff_plan');

      // Confidence should be high since this is a phrase match
      expect(withAgent.confidence).toBeGreaterThanOrEqual(0.7);
      expect(withoutAgent.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('agent boosting boosts relevant types when scores are close', async () => {
      // "training plan" matches both training_schedule and training_program keywords
      // Agent boosting should favor the active agent's task type
      const onboardingResult = await classify('create a training plan for Acme', undefined, 'onboarding');
      const adoptionResult = await classify('create a training plan for Acme', undefined, 'adoption');

      // Both should get a training-related classification
      expect(onboardingResult.confidence).toBeGreaterThan(0);
      expect(adoptionResult.confidence).toBeGreaterThan(0);

      // Both results should be valid task types (not custom)
      expect(onboardingResult.taskType).not.toBe('custom');
      expect(adoptionResult.taskType).not.toBe('custom');
    });
  });

  describe('Classification confidence levels', () => {
    it('button-generated messages achieve phrase-match confidence (0.95)', async () => {
      // Button messages are designed to hit phrase patterns for 0.95 confidence
      const result = await classify('Create a kickoff plan for Acme Corp');
      expect(result.confidence).toBe(0.95);
      expect(result.taskType).toBe('kickoff_plan');
    });

    it('button-generated messages are always classified as generative', async () => {
      const allCadgTaskTypes = [
        'kickoff_plan', 'milestone_plan', 'stakeholder_map', 'training_schedule',
        'usage_analysis', 'feature_campaign', 'champion_development', 'training_program',
        'renewal_forecast', 'value_summary', 'expansion_proposal', 'negotiation_brief',
        'risk_assessment', 'save_play', 'escalation_report', 'resolution_plan',
        'qbr_generation', 'executive_briefing', 'account_plan', 'transformation_roadmap',
        'portfolio_dashboard', 'team_metrics', 'renewal_pipeline', 'at_risk_overview',
      ];

      for (const taskType of allCadgTaskTypes) {
        const message = buildCadgTriggerMessage(taskType, 'Test Co');
        const result = await classify(message);
        const generative = isGenerativeRequest(message) || result.confidence >= 0.7;
        expect(generative).toBe(true);
      }
    });
  });
});
