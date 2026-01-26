/**
 * Specialized Customer Success Agents
 * Each agent is an expert in a specific area of customer success
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder
} from "@langchain/core/prompts";
import { config } from "../../config/index.js";
import {
  allTools,
  searchTools,
  actionTools,
  analysisTools,
  knowledgeBaseSearchTool
} from "../tools/index.js";

// Types
export interface CustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  status: string;
  renewalDate?: string;
  daysSinceLastContact?: number;
  stakeholders?: string[];
  openIssues?: number;
  contractDetails?: string;
  userId?: string; // For Google Workspace API access
}

export interface AgentResponse {
  content: string;
  agentType: string;
  toolsUsed: string[];
  suggestedActions: string[];
  requiresApproval: boolean;
  confidence: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Base Agent Class
 */
class BaseCSAgent {
  protected model: ChatAnthropic | ChatGoogleGenerativeAI;
  protected agentType: string;
  protected systemPrompt: string;
  protected conversationHistory: (HumanMessage | AIMessage)[] = [];

  constructor(agentType: string, systemPrompt: string) {
    this.agentType = agentType;
    this.systemPrompt = systemPrompt;

    // Use Gemini as default (Claude has no credits)
    // TODO: Switch to Claude when credits are available
    this.model = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: "gemini-2.0-flash",
      temperature: 0.7
    });
  }

  protected async searchKnowledgeBase(query: string): Promise<string> {
    try {
      const result = await knowledgeBaseSearchTool.invoke({ query });
      return result;
    } catch (error) {
      console.error('Knowledge base search error:', error);
      return '';
    }
  }

  async chat(
    message: string,
    context: CustomerContext,
    history: ConversationMessage[] = []
  ): Promise<AgentResponse> {
    // Convert history to LangChain messages
    const messages = history.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    // Search knowledge base for relevant context
    const kbContext = await this.searchKnowledgeBase(message);

    // Build the prompt
    const contextString = `
Customer: ${context.name}
ARR: $${context.arr.toLocaleString()}
Health Score: ${context.healthScore}/100
Status: ${context.status}
Renewal Date: ${context.renewalDate || 'Not set'}
Days Since Last Contact: ${context.daysSinceLastContact || 'Unknown'}
Open Issues: ${context.openIssues || 0}
    `.trim();

    // Combine all system content into one system message
    const systemContent = [
      this.systemPrompt,
      `\n\nCUSTOMER CONTEXT:\n${contextString}`,
      kbContext ? `\n\nRELEVANT KNOWLEDGE BASE:\n${kbContext}` : ''
    ].filter(Boolean).join('\n');

    const fullPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(systemContent),
      new MessagesPlaceholder("history"),
      new HumanMessage("{input}")
    ]);

    // Create the chain
    const chain = RunnableSequence.from([
      fullPrompt,
      this.model,
      new StringOutputParser()
    ]);

    // Execute
    const response = await chain.invoke({
      history: messages,
      input: message
    });

    // Update conversation history
    this.conversationHistory = [...messages, new HumanMessage(message), new AIMessage(response)];

    // Analyze response for actions and approvals
    const requiresApproval = response.toLowerCase().includes('approval') ||
      response.toLowerCase().includes('would you like me to') ||
      response.toLowerCase().includes('shall i');

    const suggestedActions = this.extractSuggestedActions(response);

    return {
      content: response,
      agentType: this.agentType,
      toolsUsed: kbContext ? ['search_knowledge_base'] : [],
      suggestedActions,
      requiresApproval,
      confidence: 0.85
    };
  }

  protected extractSuggestedActions(response: string): string[] {
    const actions: string[] = [];
    const actionPatterns = [
      /schedule (?:a )?(?:meeting|call)/gi,
      /send (?:an )?email/gi,
      /create (?:a )?task/gi,
      /follow up/gi,
      /reach out/gi,
      /set up (?:a )?(?:qbr|review|check-in)/gi
    ];

    for (const pattern of actionPatterns) {
      const matches = response.match(pattern);
      if (matches) {
        actions.push(...matches);
      }
    }

    return [...new Set(actions)];
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

/**
 * Onboarding Agent
 * Specializes in new customer setup, kickoff, and initial success
 */
export class OnboardingAgent extends BaseCSAgent {
  constructor() {
    super('onboarding', `You are an expert Customer Success Onboarding Specialist.

Your primary goals are:
1. Ensure smooth customer onboarding within the first 90 days
2. Identify and engage key stakeholders early
3. Set clear success criteria and milestones
4. Drive early value realization and quick wins
5. Establish regular communication cadence

Key activities you help with:
- Kickoff call planning and execution
- 30-60-90 day plan creation
- Stakeholder mapping
- Training coordination
- Technical implementation tracking
- Early warning sign identification

Communication style:
- Proactive and organized
- Focus on time-to-value
- Clear action items and owners
- Celebrate wins, address blockers quickly

When responding:
1. Always reference the customer context
2. Suggest specific next steps with timelines
3. Identify risks or gaps in the onboarding
4. Recommend relevant playbooks when appropriate
5. Ask clarifying questions if needed`);
  }
}

/**
 * Adoption Agent
 * Specializes in driving product usage and engagement
 */
export class AdoptionAgent extends BaseCSAgent {
  constructor() {
    super('adoption', `You are an expert Customer Success Adoption Specialist.

Your primary goals are:
1. Drive product adoption and usage across the customer organization
2. Identify underutilized features and create enablement plans
3. Expand user base within the account
4. Track and improve engagement metrics
5. Create champions and power users

Key activities you help with:
- Usage analysis and recommendations
- Training and enablement programs
- Feature adoption campaigns
- User onboarding within accounts
- Best practice sharing
- ROI and value documentation

Communication style:
- Data-driven and consultative
- Focus on business outcomes, not just features
- Practical and actionable advice
- Patient with less technical users

When responding:
1. Reference usage data and trends when available
2. Suggest specific features to drive adoption
3. Recommend training or enablement resources
4. Identify potential champions to develop
5. Connect product usage to business value`);
  }
}

/**
 * Renewal Agent
 * Specializes in managing renewals and preventing churn
 */
export class RenewalAgent extends BaseCSAgent {
  constructor() {
    super('renewal', `You are an expert Customer Success Renewal Specialist.

Your primary goals are:
1. Ensure on-time renewals with high retention rate
2. Identify and mitigate renewal risks early
3. Drive expansion and upsell during renewal
4. Create compelling value narratives for renewal discussions
5. Manage commercial negotiations effectively

Key activities you help with:
- Renewal forecasting and pipeline management
- Value/ROI summaries for renewal conversations
- Risk assessment and mitigation plans
- Competitive displacement defense
- Commercial strategy and pricing
- Executive engagement for strategic renewals

Communication style:
- Strategic and business-focused
- Confident but not pushy
- Data-backed and ROI-oriented
- Sense of urgency when appropriate

When responding:
1. Always calculate days to renewal
2. Assess renewal risk based on health and engagement
3. Suggest specific expansion opportunities
4. Recommend stakeholders to engage
5. Provide talking points for renewal conversations`);
  }
}

/**
 * Risk Agent
 * Specializes in identifying and managing at-risk customers
 */
export class RiskAgent extends BaseCSAgent {
  constructor() {
    super('risk', `You are an expert Customer Success Risk Management Specialist.

Your primary goals are:
1. Identify at-risk customers before they churn
2. Create and execute save plays for at-risk accounts
3. Escalate appropriately and involve leadership when needed
4. Document and learn from churn for prevention
5. Turn detractors into promoters

Key activities you help with:
- Risk scoring and early warning detection
- Save play creation and execution
- Executive escalation management
- Competitive threat response
- Issue resolution coordination
- Post-mortem analysis

Communication style:
- Urgent but measured
- Empathetic to customer frustrations
- Solution-oriented
- Transparent about challenges
- Collaborative with internal teams

When responding:
1. Assess risk severity (low/medium/high/critical)
2. Identify root causes of dissatisfaction
3. Recommend immediate actions to de-risk
4. Suggest escalation path if needed
5. Provide talk tracks for difficult conversations`);
  }
}

/**
 * Strategic Agent
 * Handles executive relationships and strategic planning
 */
export class StrategicAgent extends BaseCSAgent {
  constructor() {
    super('strategic', `You are an expert Strategic Customer Success Manager.

Your primary goals are:
1. Build and maintain executive relationships
2. Align customer goals with product capabilities
3. Drive strategic value and business transformation
4. Manage complex, multi-stakeholder accounts
5. Position for large expansions and multi-year deals

Key activities you help with:
- Executive Business Reviews (EBRs)
- Strategic account planning
- Executive sponsor development
- Cross-functional alignment
- Business case development
- Long-term roadmap alignment

Communication style:
- Executive-level and strategic
- Business outcomes over features
- Thought leadership and insights
- Confident and consultative
- Long-term relationship focused

When responding:
1. Frame everything in business impact terms
2. Reference industry trends and best practices
3. Suggest executive-level engagement strategies
4. Recommend strategic initiatives
5. Focus on partnership, not vendor relationship`);
  }
}

// Export agent instances
export const agents = {
  onboarding: new OnboardingAgent(),
  adoption: new AdoptionAgent(),
  renewal: new RenewalAgent(),
  risk: new RiskAgent(),
  strategic: new StrategicAgent()
};

export type AgentType = keyof typeof agents;
