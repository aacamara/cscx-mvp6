import { BaseAgent, AgentInput, AgentOutput } from './base.js';

const SYSTEM_PROMPT = `You are the Training Agent for CSCX.AI, a specialized AI agent for customer enablement and training in customer success workflows.

Your role is to:
1. **Create Training Plans**: Design personalized learning paths based on products purchased and user roles
2. **Generate Training Content**: Create guides, tutorials, and quick-start materials
3. **Answer Questions**: Provide accurate answers from the product knowledge base
4. **Track Progress**: Monitor training completion and recommend next steps
5. **Recommend Learning**: Suggest additional training based on usage patterns

When creating training content:
- Structure content with clear learning objectives
- Include step-by-step instructions with screenshots/examples where helpful
- Add real-world examples relevant to the customer's industry
- Consider the user's technical skill level
- Break complex topics into digestible modules
- Include knowledge checks or exercises

Training content types you can generate:
- **Quick Start Guides**: 5-10 minute overview to get started fast
- **Feature Deep-Dives**: Detailed exploration of specific capabilities
- **Best Practices**: Industry-specific recommendations
- **Troubleshooting Guides**: Common issues and solutions
- **Admin Guides**: Configuration and setup for technical users
- **Executive Overviews**: High-level value demonstrations

When recommending training, consider:
- Products the customer has purchased
- Stakeholder roles (executive, admin, end user)
- Technical proficiency level
- Time since onboarding began
- Previous training completed

Format all content with markdown. Be educational, supportive, and encouraging.
Include practical tips and real examples whenever possible.`;

export class TrainingAgent extends BaseAgent {
  constructor() {
    super({
      id: 'training',
      name: 'Training Agent',
      description: 'AI-powered training and knowledge base',
      model: 'claude', // Use Claude for training content
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      requiresApproval: []
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const action = this.detectAction(input.message);

    switch (action) {
      case 'generate':
        return this.generateTraining(input);
      case 'answer':
        return this.answerQuestion(input);
      case 'recommend':
        return this.recommendModules(input);
      default:
        return this.handleGeneral(input);
    }
  }

  private async generateTraining(input: AgentInput): Promise<AgentOutput> {
    const products = input.context.products?.join(', ') || 'the platform';

    const prompt = `
Generate training content for ${input.context.name}.
Products they use: ${products}
Request: ${input.message}

Create a structured training module that includes:
1. Overview (what they'll learn)
2. Prerequisites
3. Step-by-step guide
4. Best practices
5. Common issues and solutions

Make it specific to their use case.
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { type: 'training_module' }
    };
  }

  private async answerQuestion(input: AgentInput): Promise<AgentOutput> {
    const prompt = `
Customer: ${input.context.name}
Question: ${input.message}

Provide a helpful, accurate answer.
If this requires technical documentation, mention the relevant resources.
Offer to explain further or provide examples.
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { type: 'kb_answer' }
    };
  }

  private async recommendModules(input: AgentInput): Promise<AgentOutput> {
    const products = input.context.products?.join(', ') || 'the platform';

    const prompt = `
Customer: ${input.context.name}
Products: ${products}
Request: ${input.message}

Recommend training modules based on their products and needs.
Include:
- Module name and duration
- Why it's relevant for them
- Suggested order of completion
- Expected outcomes
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { type: 'recommendations' }
    };
  }

  private async handleGeneral(input: AgentInput): Promise<AgentOutput> {
    const prompt = `
Customer: ${input.context.name}
Message: ${input.message}

Respond helpfully about training and learning resources.
`;

    const response = await this.think(prompt);
    return { message: response };
  }

  private detectAction(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('generate') || lower.includes('create') || lower.includes('training for')) {
      return 'generate';
    }
    if (lower.includes('how') || lower.includes('what') || lower.includes('?')) {
      return 'answer';
    }
    if (lower.includes('recommend') || lower.includes('suggest') || lower.includes('modules')) {
      return 'recommend';
    }
    return 'general';
  }
}
