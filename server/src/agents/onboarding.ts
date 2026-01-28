import { BaseAgent, AgentInput, AgentOutput, AgentConfig, ToolCall, AgentId, StreamCallback, StreamResult } from './base.js';
import { MeetingAgent } from './meeting.js';
import { TrainingAgent } from './training.js';
import { IntelligenceAgent } from './intelligence.js';

const SYSTEM_PROMPT = `You are the Onboarding Orchestrator for CSCX.AI, an AI-powered customer success platform. You have full access to the customer's contract data and context.

Your role is to:
1. Create and manage the customer onboarding timeline
2. Coordinate between Meeting, Training, and Intelligence agents
3. Recommend actions to the CSM and request approval for critical steps
4. Track progress and proactively identify risks
5. Ensure the customer achieves their first value milestone quickly

Available subagents you can deploy:
- **Meeting Agent**: Schedule calls, create agendas, generate pre-meeting briefs, capture meeting notes
- **Training Agent**: Generate training content, create personalized guides, answer product questions
- **Intelligence Agent**: Pull CRM data, calculate health scores, research company, build timelines

When responding:
- Always be specific about customer details - reference their actual contract data
- Use markdown formatting for clear, structured responses
- When you need to take a critical action (send email, schedule meeting, update CRM), ask for approval first
- When delegating to a subagent, explain which agent and what they will do
- Be proactive about identifying risks and opportunities based on the contract data
- Provide actionable next steps

Critical actions requiring approval:
- Sending emails to customers
- Scheduling meetings
- Updating CRM records
- Making commitments on behalf of the company

Format for approval requests:
When you need approval, end your response with a clear question like "Would you like me to proceed with scheduling this meeting?" or "Shall I send this email?"`;

const ONBOARDING_TOOLS = [
  {
    name: 'deployMeetingAgent',
    description: 'Deploy the Meeting Agent to schedule or join calls',
    parameters: { action: 'schedule | join | transcribe | agenda', details: 'string' }
  },
  {
    name: 'deployTrainingAgent',
    description: 'Deploy the Training Agent for customer training',
    parameters: { action: 'generate | answer | recommend | track', topic: 'string' }
  },
  {
    name: 'deployIntelligenceAgent',
    description: 'Deploy the Intelligence Agent to gather data',
    parameters: { action: 'pullCRM | calculateHealth | buildTimeline | research' }
  },
  {
    name: 'generateSuccessPlan',
    description: 'Generate a 30-60-90 day success plan',
    parameters: { customerId: 'string' }
  },
  {
    name: 'requestApproval',
    description: 'Request CSM approval for an action',
    parameters: { action: 'string', details: 'string' }
  },
  {
    name: 'draftEmail',
    description: 'Draft an email for CSM review',
    parameters: { recipient: 'string', subject: 'string', purpose: 'string' }
  }
];

export class OnboardingAgent extends BaseAgent {
  private meetingAgent: MeetingAgent;
  private trainingAgent: TrainingAgent;
  private intelligenceAgent: IntelligenceAgent;

  constructor() {
    super({
      id: 'onboarding',
      name: 'Onboarding Agent',
      description: 'Main orchestrator for customer onboarding',
      model: 'claude', // Use Claude for orchestration
      systemPrompt: SYSTEM_PROMPT,
      tools: ONBOARDING_TOOLS,
      requiresApproval: ['sendEmail', 'scheduleMeeting', 'updateCRM']
    });

    this.meetingAgent = new MeetingAgent();
    this.trainingAgent = new TrainingAgent();
    this.intelligenceAgent = new IntelligenceAgent();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const prompt = this.buildPrompt(input);
    const response = await this.think(prompt);

    // Check for subagent deployment keywords
    const deployedAgent = this.detectAgentDeployment(input.message, response);

    // Check if response requires approval
    const requiresApproval = this.detectApprovalNeeded(response);

    // Save to database
    await this.saveMessage({
      sessionId: input.sessionId,
      agentId: this.config.id,
      role: 'agent',
      content: response,
      requiresApproval,
      deployedAgent
    });

    return {
      message: response,
      requiresApproval,
      deployAgent: deployedAgent
    };
  }

  /**
   * Execute with streaming - sends tokens as they're generated
   * @param input Agent input with session, message, context, and history
   * @param onChunk Callback for each text chunk
   * @param signal Optional AbortSignal for cancellation
   * @returns AgentOutput with complete response and metadata
   */
  async executeStream(
    input: AgentInput,
    onChunk?: StreamCallback,
    signal?: AbortSignal
  ): Promise<AgentOutput & { tokenUsage: StreamResult }> {
    const prompt = this.buildPrompt(input);

    // Execute with streaming
    const streamResult = await this.thinkStream(prompt, onChunk, signal);
    const response = streamResult.text;

    // Check for subagent deployment keywords
    const deployedAgent = this.detectAgentDeployment(input.message, response);

    // Check if response requires approval
    const requiresApproval = this.detectApprovalNeeded(response);

    // Save to database (only save complete messages, not during streaming)
    await this.saveMessage({
      sessionId: input.sessionId,
      agentId: this.config.id,
      role: 'agent',
      content: response,
      requiresApproval,
      deployedAgent
    });

    return {
      message: response,
      requiresApproval,
      deployAgent: deployedAgent,
      tokenUsage: streamResult
    };
  }

  async executeWithSubagent(input: AgentInput, agentId: AgentId): Promise<AgentOutput> {
    switch (agentId) {
      case 'meeting':
        return this.meetingAgent.execute(input);
      case 'training':
        return this.trainingAgent.execute(input);
      case 'intelligence':
        return this.intelligenceAgent.execute(input);
      default:
        return this.execute(input);
    }
  }

  private buildPrompt(input: AgentInput): string {
    const historyText = input.history
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'CSM' : m.agentId || 'Agent'}: ${m.content}`)
      .join('\n');

    // Build comprehensive context from all available data
    const contextParts: string[] = [];

    // Basic customer info
    contextParts.push(`## Customer Information`);
    contextParts.push(`- **Company Name:** ${input.context.name}`);
    if (input.context.arr) {
      contextParts.push(`- **ARR:** $${typeof input.context.arr === 'number' ? input.context.arr.toLocaleString() : input.context.arr}`);
    }
    contextParts.push(`- **Stage:** ${input.context.stage || 'Onboarding'}`);

    // Stakeholders
    if (input.context.stakeholders && input.context.stakeholders.length > 0) {
      contextParts.push(`\n## Key Stakeholders`);
      input.context.stakeholders.forEach(s => {
        contextParts.push(`- ${s}`);
      });
    }

    // Products
    if (input.context.products && input.context.products.length > 0) {
      contextParts.push(`\n## Products/Entitlements`);
      input.context.products.forEach(p => {
        contextParts.push(`- ${p}`);
      });
    }

    // Extended context (from contract data)
    const extendedContext = input.context as unknown as Record<string, unknown>;

    if (extendedContext.contractPeriod) {
      contextParts.push(`- **Contract Period:** ${extendedContext.contractPeriod}`);
    }

    if (extendedContext.technicalRequirements && Array.isArray(extendedContext.technicalRequirements)) {
      contextParts.push(`\n## Technical Requirements`);
      (extendedContext.technicalRequirements as string[]).slice(0, 5).forEach(r => {
        contextParts.push(`- ${r}`);
      });
    }

    if (extendedContext.tasks && Array.isArray(extendedContext.tasks)) {
      contextParts.push(`\n## Contract Tasks`);
      (extendedContext.tasks as Array<{ task: string }>).slice(0, 5).forEach(t => {
        contextParts.push(`- ${t.task || t}`);
      });
    }

    if (extendedContext.missingInfo && Array.isArray(extendedContext.missingInfo) && extendedContext.missingInfo.length > 0) {
      contextParts.push(`\n## Missing Information (Needs Follow-up)`);
      (extendedContext.missingInfo as string[]).forEach(m => {
        contextParts.push(`- ${m}`);
      });
    }

    return `
${contextParts.join('\n')}

---

## Conversation History
${historyText || 'No previous messages'}

---

## CSM Message
${input.message}

---

Please respond helpfully and professionally. Use the customer context above to provide specific, relevant responses.

If you need to:
- Schedule a meeting → Mention deploying the Meeting Agent
- Create training content → Mention deploying the Training Agent
- Pull data or calculate health → Mention deploying the Intelligence Agent

For any action that affects the customer (emails, meetings, CRM updates), ask for approval first.
`;
  }

  private detectAgentDeployment(userMessage: string, response: string): AgentId | undefined {
    const combined = (userMessage + ' ' + response).toLowerCase();

    if (combined.includes('meeting agent') || (combined.includes('schedule') && combined.includes('call')) ||
        (combined.includes('schedule') && combined.includes('meeting')) || combined.includes('kickoff')) {
      return 'meeting';
    }
    if (combined.includes('training agent') || (combined.includes('training') && combined.includes('deploy')) ||
        combined.includes('create training') || combined.includes('training plan')) {
      return 'training';
    }
    if (combined.includes('intelligence agent') || combined.includes('pull data') ||
        combined.includes('health score') || combined.includes('research')) {
      return 'intelligence';
    }

    return undefined;
  }

  private detectApprovalNeeded(response: string): boolean {
    const approvalKeywords = [
      'shall i',
      'would you like me to',
      'do you approve',
      'can i proceed',
      'ready to send',
      'should i schedule',
      'would you like to proceed',
      'confirm and send',
      'shall i send',
      'shall i schedule',
      'like me to send',
      'like me to schedule'
    ];

    const lower = response.toLowerCase();
    return approvalKeywords.some(keyword => lower.includes(keyword));
  }
}
