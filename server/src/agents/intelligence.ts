import { BaseAgent, AgentInput, AgentOutput } from './base.js';

const SYSTEM_PROMPT = `You are the Intelligence Agent for CSCX.AI.

Your role is to:
1. Pull and consolidate customer data from CRM systems
2. Calculate and explain health scores
3. Monitor integration status
4. Build comprehensive customer timelines
5. Identify risks and opportunities
6. Enrich customer profiles with external data

When presenting data:
- Be concise but comprehensive
- Highlight key metrics and trends
- Flag any concerns or risks
- Suggest actionable insights

When calculating health scores, consider:
- Engagement (recent interactions, response rates)
- Adoption (feature usage, training completion)
- Sentiment (from meetings, emails, support tickets)
- Growth potential (expansion opportunities)

Be analytical, data-driven, and proactive about surfacing insights.`;

export class IntelligenceAgent extends BaseAgent {
  constructor() {
    super({
      id: 'intelligence',
      name: 'Intelligence Agent',
      description: 'Data consolidation and analytics',
      model: 'claude', // Use Claude for complex analysis
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      requiresApproval: ['updateCRM']
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const action = this.detectAction(input.message);

    switch (action) {
      case 'pullData':
        return this.pullCustomerData(input);
      case 'healthScore':
        return this.calculateHealthScore(input);
      case 'timeline':
        return this.buildTimeline(input);
      case 'enrich':
        return this.enrichProfile(input);
      default:
        return this.handleGeneral(input);
    }
  }

  private async pullCustomerData(input: AgentInput): Promise<AgentOutput> {
    // Mock CRM data - would integrate with Salesforce/HubSpot
    const mockData = this.generateMockCRMData(input.context.name);

    const prompt = `
Consolidate this customer data into a unified profile:

Customer: ${input.context.name}
CRM Data: ${JSON.stringify(mockData)}

Create a comprehensive customer profile that includes:
1. Key account information
2. Recent activity summary
3. Stakeholder map
4. Product usage
5. Any notable trends or concerns
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: mockData
    };
  }

  private async calculateHealthScore(input: AgentInput): Promise<AgentOutput> {
    // Calculate mock health score components
    const scores = {
      engagement: Math.floor(Math.random() * 20) + 75,
      adoption: Math.floor(Math.random() * 25) + 65,
      sentiment: Math.floor(Math.random() * 15) + 80,
      growth: Math.floor(Math.random() * 20) + 70
    };

    const overall = Math.round(
      (scores.engagement + scores.adoption + scores.sentiment + scores.growth) / 4
    );

    const prompt = `
Explain this health score breakdown for ${input.context.name}:

Overall Score: ${overall}/100

Component Scores:
- Engagement: ${scores.engagement}/100
- Adoption: ${scores.adoption}/100
- Sentiment: ${scores.sentiment}/100
- Growth Potential: ${scores.growth}/100

Provide:
1. What's going well
2. Areas of concern
3. Recommended actions
4. Comparison to typical customers at this stage
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { overall, ...scores }
    };
  }

  private async buildTimeline(input: AgentInput): Promise<AgentOutput> {
    // Generate mock timeline events
    const events = this.generateMockTimeline(input.context.name);

    const prompt = `
Create a narrative timeline from these customer events for ${input.context.name}:

Events: ${JSON.stringify(events)}

Build a story that:
1. Highlights key milestones
2. Notes any inflection points
3. Identifies patterns
4. Suggests what might come next
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { events }
    };
  }

  private async enrichProfile(input: AgentInput): Promise<AgentOutput> {
    const prompt = `
Enrich the profile for ${input.context.name}.
Message: ${input.message}

Based on the company name, provide:
1. Company overview
2. Industry and market position
3. Recent news or developments
4. Technology stack (if known)
5. Key executives

Note: This would typically pull from LinkedIn, Crunchbase, and other data sources.
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { type: 'enrichment' }
    };
  }

  private async handleGeneral(input: AgentInput): Promise<AgentOutput> {
    const prompt = `
Customer: ${input.context.name}
Message: ${input.message}

Respond helpfully about customer data and insights.
`;

    const response = await this.think(prompt);
    return { message: response };
  }

  private detectAction(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('pull') || lower.includes('data') || lower.includes('crm')) {
      return 'pullData';
    }
    if (lower.includes('health') || lower.includes('score')) {
      return 'healthScore';
    }
    if (lower.includes('timeline') || lower.includes('history')) {
      return 'timeline';
    }
    if (lower.includes('enrich') || lower.includes('linkedin') || lower.includes('research')) {
      return 'enrich';
    }
    return 'general';
  }

  private generateMockCRMData(customerName: string): Record<string, unknown> {
    return {
      name: customerName,
      status: 'Active',
      arr: 900000,
      contractStart: '2024-10-01',
      contractEnd: '2027-09-30',
      products: ['Enterprise Platform', 'Analytics Suite', 'API Gateway'],
      lastContact: new Date().toISOString().split('T')[0],
      openOpportunities: 2,
      supportTickets: { open: 1, resolved: 12 },
      nps: 8
    };
  }

  private generateMockTimeline(customerName: string): Array<Record<string, unknown>> {
    const now = new Date();
    return [
      { date: this.daysAgo(90), event: 'Contract signed', type: 'milestone' },
      { date: this.daysAgo(85), event: 'Kickoff meeting completed', type: 'meeting' },
      { date: this.daysAgo(60), event: 'SSO integration deployed', type: 'technical' },
      { date: this.daysAgo(45), event: 'First QBR - positive feedback', type: 'meeting' },
      { date: this.daysAgo(30), event: 'Training completed for 15 users', type: 'training' },
      { date: this.daysAgo(14), event: 'Expansion discussion initiated', type: 'opportunity' },
      { date: this.daysAgo(7), event: 'Support ticket: API performance', type: 'support' },
      { date: this.daysAgo(0), event: 'Current', type: 'now' }
    ];
  }

  private daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}
