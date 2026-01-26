import { BaseAgent, AgentInput, AgentOutput } from './base.js';

const SYSTEM_PROMPT = `You are the Meeting Agent for CSCX.AI, a specialized AI agent for handling all meeting-related tasks in customer success workflows.

Your capabilities:
1. **Schedule Meetings**: Propose meeting times, create agendas, coordinate with stakeholders
2. **Create Agendas**: Generate detailed, relevant meeting agendas based on onboarding phase
3. **Pre-Meeting Briefs**: Create briefing documents for CSMs before customer calls
4. **Meeting Summaries**: Analyze transcripts and extract key insights
5. **Follow-up Actions**: Identify and track action items from meetings

When scheduling meetings, always:
- Suggest 2-3 specific time slots (business hours)
- Include a detailed, phase-appropriate agenda
- List all recommended attendees with their roles
- Specify meeting duration and format (video call, phone, in-person)
- **Always ask for approval** before sending calendar invites

When creating agendas, include:
- Clear objectives for the meeting
- Time-boxed agenda items with owners
- Pre-read materials if applicable
- Discussion questions to drive conversation
- Expected outcomes

Meeting types you handle:
- **Kickoff**: Initial customer meeting to establish relationship and goals
- **Check-in**: Regular progress reviews during onboarding
- **Training**: Product training sessions with end users
- **QBR**: Quarterly business reviews with executives
- **Technical**: Technical deep-dives with IT/Engineering teams

Format all outputs with markdown for clarity. Be professional but personable.`;

export class MeetingAgent extends BaseAgent {
  constructor() {
    super({
      id: 'meeting',
      name: 'Meeting Agent',
      description: 'Handles meeting scheduling, agendas, and transcription',
      model: 'claude', // Use Claude for better meeting content
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      requiresApproval: ['sendInvite', 'joinCall', 'scheduleMeeting']
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const action = this.detectAction(input.message);

    switch (action) {
      case 'schedule':
        return this.scheduleMeeting(input);
      case 'transcribe':
        return this.summarizeTranscript(input);
      default:
        return this.handleGeneral(input);
    }
  }

  private async scheduleMeeting(input: AgentInput): Promise<AgentOutput> {
    // Generate available slots (mock for now, would integrate with calendar API)
    const availability = this.generateAvailability();

    const prompt = `
The CSM wants to schedule a meeting with ${input.context.name}.
Available time slots: ${JSON.stringify(availability)}

Generate a professional response suggesting the best meeting times.
Include a proposed agenda for a discovery/onboarding call.
Ask for approval before sending the invite.
`;

    const response = await this.think(prompt);

    return {
      message: response,
      requiresApproval: true,
      data: { availability }
    };
  }

  private async summarizeTranscript(input: AgentInput): Promise<AgentOutput> {
    const prompt = `
Analyze this meeting context and provide insights:
Customer: ${input.context.name}
Message: ${input.message}

Generate a structured summary including:
1. Key decisions made
2. Action items (with owners if mentioned)
3. Concerns or objections raised
4. Overall sentiment
5. Recommended next steps
`;

    const response = await this.think(prompt);

    return {
      message: response,
      data: { type: 'meeting_summary' }
    };
  }

  private async handleGeneral(input: AgentInput): Promise<AgentOutput> {
    const prompt = `
Customer: ${input.context.name}
CSM Request: ${input.message}

Respond helpfully about meeting-related tasks.
`;

    const response = await this.think(prompt);
    return { message: response };
  }

  private detectAction(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('schedule') || lower.includes('book') || lower.includes('meeting')) {
      return 'schedule';
    }
    if (lower.includes('transcript') || lower.includes('summary') || lower.includes('insights')) {
      return 'transcribe';
    }
    return 'general';
  }

  private generateAvailability(): Array<{ date: string; time: string }> {
    // Mock availability - would come from calendar integration
    const slots = [];
    const now = new Date();

    for (let i = 1; i <= 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      if (date.getDay() !== 0 && date.getDay() !== 6) {
        slots.push({
          date: date.toISOString().split('T')[0],
          time: '10:00 AM EST'
        });
        slots.push({
          date: date.toISOString().split('T')[0],
          time: '2:00 PM EST'
        });
      }
    }

    return slots.slice(0, 4);
  }
}
