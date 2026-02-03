/**
 * Follow-Up Email Generator
 * PRD-116: Generate personalized follow-up emails after customer calls
 *
 * Creates emails that include:
 * - Thank you for the meeting
 * - Summary of discussion
 * - Action items with owners and dates
 * - Next steps
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import type { ActionItem, Commitment, EmailDraft, TranscriptAnalysisOutput } from './types.js';

// ============================================
// Types
// ============================================

export interface EmailGenerationInput {
  customerName: string;
  meetingTitle: string;
  meetingDate: Date;
  participants: Array<{ name: string; email?: string; role?: string }>;
  analysis: TranscriptAnalysisOutput;
  senderName?: string;
  companyName?: string;
  customTone?: 'formal' | 'friendly' | 'professional';
}

// ============================================
// Follow-Up Email Generator
// ============================================

export class FollowUpEmailGenerator {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Generate a follow-up email draft
   */
  async generate(input: EmailGenerationInput): Promise<EmailDraft> {
    const recipients = this.extractRecipients(input.participants);

    if (!this.anthropic) {
      console.warn('Anthropic API not configured, using template email');
      return this.generateTemplateEmail(input, recipients);
    }

    try {
      const prompt = this.buildEmailPrompt(input);

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: this.buildSystemPrompt(input),
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '';

      return this.parseEmailResponse(responseText, input, recipients);
    } catch (error) {
      console.error('Email generation failed:', error);
      // Fall back to template email
      return this.generateTemplateEmail(input, recipients);
    }
  }

  /**
   * Build system prompt for email generation
   */
  private buildSystemPrompt(input: EmailGenerationInput): string {
    const tone = input.customTone || 'professional';

    return `You are an expert Customer Success Manager writing a follow-up email after a customer meeting.

Your tone should be ${tone}, appreciative, and action-oriented.

Guidelines:
- Keep the email concise but comprehensive
- Lead with appreciation for their time
- Highlight key discussion points briefly
- Clearly list action items with owners and due dates
- End with clear next steps
- Use proper email formatting with paragraphs
- Don't be overly formal or use corporate jargon
- Be warm but professional

Return the email body as HTML with proper formatting (paragraphs, lists, etc.).`;
  }

  /**
   * Build prompt for email content
   */
  private buildEmailPrompt(input: EmailGenerationInput): string {
    const { customerName, meetingTitle, meetingDate, analysis, senderName } = input;

    const actionItemsList = analysis.actionItems
      .map(
        (item) =>
          `- ${item.description} (Owner: ${item.owner}, Due: ${item.dueDate || 'TBD'})`
      )
      .join('\n');

    const commitmentsList = analysis.commitments
      .map((c) => `- ${c.description} (${c.party === 'us' ? 'We will' : 'You will'})`)
      .join('\n');

    return `Generate a follow-up email for this meeting:

## Meeting Details
- Customer: ${customerName}
- Meeting: ${meetingTitle}
- Date: ${meetingDate.toLocaleDateString()}
- Sender: ${senderName || 'Your CSM'}

## Meeting Summary
${analysis.summary}

## Key Topics Discussed
${analysis.keyTopics.join(', ') || 'General discussion'}

## Action Items
${actionItemsList || 'No specific action items'}

## Commitments Made
${commitmentsList || 'No specific commitments'}

## Next Steps
${analysis.nextSteps.join('\n') || 'To be determined'}

## Output Format
Return a JSON object with this structure:
{
  "subject": "Clear, specific subject line",
  "bodyHtml": "HTML formatted email body",
  "bodyText": "Plain text version of the email"
}

Return ONLY valid JSON. No markdown code blocks.`;
  }

  /**
   * Parse email response from AI
   */
  private parseEmailResponse(
    text: string,
    input: EmailGenerationInput,
    recipients: { to: string[]; cc: string[] }
  ): EmailDraft {
    let jsonString = text.trim();

    // Remove markdown code blocks if present
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.slice(7);
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.slice(3);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }

    jsonString = jsonString.trim();

    try {
      const parsed = JSON.parse(jsonString);

      return {
        to: recipients.to,
        cc: recipients.cc.length > 0 ? recipients.cc : undefined,
        subject: parsed.subject || `Follow-up: ${input.meetingTitle}`,
        bodyHtml: parsed.bodyHtml || parsed.body || '',
        bodyText: parsed.bodyText || this.stripHtml(parsed.bodyHtml || ''),
      };
    } catch (error) {
      console.error('Failed to parse email response:', error);
      // Fall back to template
      return this.generateTemplateEmail(input, recipients);
    }
  }

  /**
   * Generate a template-based email when AI is unavailable
   */
  private generateTemplateEmail(
    input: EmailGenerationInput,
    recipients: { to: string[]; cc: string[] }
  ): EmailDraft {
    const { customerName, meetingTitle, meetingDate, analysis, senderName, companyName } =
      input;

    const subject = `Follow-up: ${meetingTitle} - ${meetingDate.toLocaleDateString()}`;

    const actionItemsHtml = analysis.actionItems.length
      ? `
<h3>Action Items</h3>
<ul>
${analysis.actionItems
  .map(
    (item) => `
  <li>
    <strong>${item.description}</strong><br/>
    <em>Owner:</em> ${item.owner} | <em>Due:</em> ${item.dueDate || 'TBD'} | <em>Priority:</em> ${item.priority}
  </li>`
  )
  .join('')}
</ul>`
      : '';

    const nextStepsHtml = analysis.nextSteps.length
      ? `
<h3>Next Steps</h3>
<ul>
${analysis.nextSteps.map((step) => `<li>${step}</li>`).join('')}
</ul>`
      : '';

    const bodyHtml = `
<p>Hi ${this.getFirstRecipientName(recipients.to)},</p>

<p>Thank you for taking the time to meet with us today regarding <strong>${meetingTitle}</strong>.</p>

<h3>Summary</h3>
<p>${analysis.summary || 'We had a productive discussion about your needs and goals.'}</p>

${actionItemsHtml}

${nextStepsHtml}

<p>Please let me know if you have any questions or if I missed anything from our discussion.</p>

<p>Looking forward to our continued partnership!</p>

<p>Best regards,<br/>
${senderName || 'Your Customer Success Team'}${companyName ? `<br/>${companyName}` : ''}</p>
`.trim();

    const bodyText = this.stripHtml(bodyHtml);

    return {
      to: recipients.to,
      cc: recipients.cc.length > 0 ? recipients.cc : undefined,
      subject,
      bodyHtml,
      bodyText,
    };
  }

  /**
   * Extract recipients from participants
   */
  private extractRecipients(
    participants: Array<{ name: string; email?: string; role?: string }>
  ): { to: string[]; cc: string[] } {
    const to: string[] = [];
    const cc: string[] = [];

    for (const participant of participants) {
      if (participant.email) {
        // Primary contacts go to TO, others to CC
        if (
          participant.role?.toLowerCase().includes('primary') ||
          participant.role?.toLowerCase().includes('main') ||
          to.length === 0
        ) {
          to.push(participant.email);
        } else {
          cc.push(participant.email);
        }
      }
    }

    return { to, cc };
  }

  /**
   * Get first name from email or use generic greeting
   */
  private getFirstRecipientName(toEmails: string[]): string {
    if (toEmails.length === 0) return 'there';

    const email = toEmails[0];
    const name = email.split('@')[0];

    // Try to extract a readable name
    const parts = name.split(/[._-]/);
    if (parts.length > 0) {
      return this.capitalizeFirst(parts[0]);
    }

    return 'there';
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Strip HTML tags from string
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/h[123456]>/gi, '\n')
      .replace(/<h[123456][^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

// Export singleton
export const followUpEmailGenerator = new FollowUpEmailGenerator();
