/**
 * Email Agent
 * Drafts personalized customer emails using RAG and customer context
 *
 * Features:
 * - Context-aware email drafting
 * - Knowledge base integration for best practices
 * - Customer history and relationship awareness
 * - Multiple email types (check-in, follow-up, QBR invite, etc.)
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { config } from "../../config/index.js";
import { knowledgeService, SearchResult } from "../../services/knowledge.js";
import { gmailService, EmailThread, DraftEmail } from "../../services/google/gmail.js";
import { calendarService, CalendarEvent } from "../../services/google/calendar.js";
import { createClient } from "@supabase/supabase-js";

// Type definitions
export type EmailType =
  | 'check_in'
  | 'follow_up'
  | 'qbr_invite'
  | 'renewal'
  | 'onboarding'
  | 'escalation'
  | 'introduction'
  | 'thank_you'
  | 'meeting_recap'
  | 'custom';

export interface CustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  status: string;
  renewalDate?: string;
  daysSinceLastContact?: number;
  stakeholders?: Array<{
    name: string;
    role: string;
    email: string;
    isPrimary?: boolean;
  }>;
  openIssues?: number;
  recentEmails?: EmailThread[];
  recentMeetings?: Array<{
    title: string;
    date: string;
    summary?: string;
  }>;
  upcomingMeetings?: CalendarEvent[];
  industry?: string;
  productUsage?: {
    activeUsers?: number;
    featureAdoption?: number;
    lastLoginDate?: string;
  };
  userId?: string; // For Google Workspace API access
}

export interface EmailDraftRequest {
  emailType: EmailType;
  recipientEmail: string;
  recipientName?: string;
  customerContext: CustomerContext;
  additionalContext?: string;
  tone?: 'formal' | 'friendly' | 'professional' | 'urgent';
  threadId?: string; // For replies
  userId: string;
}

export interface EmailDraftResponse {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipientEmail: string;
  recipientName?: string;
  suggestedFollowUp?: string;
  confidence: number;
  sourcesUsed: string[];
  requiresApproval: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const EMAIL_SYSTEM_PROMPT = `You are an expert Customer Success email composer working for a SaaS company.

Your goal is to draft highly personalized, effective emails that strengthen customer relationships and drive business outcomes.

## Core Principles

1. **Personalization First**: Always reference specific customer details, past interactions, and their business context
2. **Value-Focused**: Every email should provide value to the recipient
3. **Clear Call-to-Action**: Include a specific, easy-to-act-on next step
4. **Professional Yet Human**: Be warm and genuine while maintaining professionalism
5. **Concise**: Respect the recipient's time - get to the point quickly

## Email Structure Guidelines

- **Subject Line**: Short, specific, avoid spam triggers, create curiosity or urgency when appropriate
- **Opening**: Personal greeting, brief reference to relationship or recent interaction
- **Body**: 2-3 short paragraphs max, clear purpose, relevant value proposition
- **Closing**: Specific CTA with easy options (calendar link, yes/no question)
- **Signature**: Professional sign-off

## Tone Adaptation

- **Formal**: For executives, first contacts, sensitive situations
- **Friendly**: For established relationships, champions
- **Professional**: Standard business communication
- **Urgent**: For time-sensitive matters, at-risk situations

## Email Types You Handle

1. **Check-in**: Regular touchpoint, gauge satisfaction, offer help
2. **Follow-up**: After meeting/call, reference specific discussions
3. **QBR Invite**: Quarterly business review invitation with value prop
4. **Renewal**: Renewal conversation starter, emphasize value delivered
5. **Onboarding**: Welcome, next steps, resource sharing
6. **Escalation**: Addressing concerns, recovery plans
7. **Introduction**: First contact, value proposition
8. **Thank You**: Post-meeting, milestone achievement, referral
9. **Meeting Recap**: Summarize discussion, action items, next steps

## Output Format

Always return emails in this exact format:
---
SUBJECT: [Your subject line here]
---
[Full email body in HTML format with proper paragraphs using <p> tags]
---
FOLLOW_UP: [Suggested follow-up action or reminder, e.g., "Follow up in 3 days if no response"]
---

Important:
- Use <p> tags for paragraphs
- Use <br> for line breaks within paragraphs
- Do not use markdown in the email body
- Keep HTML simple and email-client friendly`;

export class EmailAgent {
  private model: ChatGoogleGenerativeAI | ChatAnthropic;
  private conversationHistory: (HumanMessage | AIMessage)[] = [];
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    // Use Gemini as default (Claude requires credits)
    this.model = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: "gemini-2.0-flash",
      temperature: 0.7
    });

    // Initialize Supabase for playbook access
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Draft an email based on the request
   */
  async draftEmail(request: EmailDraftRequest): Promise<EmailDraftResponse> {
    const {
      emailType,
      recipientEmail,
      recipientName,
      customerContext,
      additionalContext,
      tone = 'professional',
      threadId,
      userId
    } = request;

    // Gather context from multiple sources
    const [knowledgeContext, recentThreads, customerDbContext, upcomingMeetings, csmPlaybook] = await Promise.all([
      this.searchKnowledgeBase(emailType, customerContext),
      this.getRecentEmailHistory(userId, recipientEmail),
      this.getCustomerDbContext(customerContext.id, userId),
      this.getUpcomingMeetings(userId, recipientEmail),
      this.getCsmPlaybook(emailType, customerContext)
    ]);

    // Enrich customer context with upcoming meetings
    if (upcomingMeetings.length > 0) {
      customerContext.upcomingMeetings = upcomingMeetings;
    }

    // Build the prompt with all context
    const contextString = this.buildContextString(
      customerContext,
      knowledgeContext,
      recentThreads,
      customerDbContext,
      csmPlaybook
    );

    const prompt = this.buildEmailPrompt(
      emailType,
      recipientName || recipientEmail,
      tone,
      additionalContext,
      threadId
    );

    // Combine system message with context
    const systemContent = `${EMAIL_SYSTEM_PROMPT}

## CURRENT CUSTOMER CONTEXT
${contextString}`;

    const fullPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(systemContent),
      new MessagesPlaceholder("history"),
      new HumanMessage("{input}")
    ]);

    // Create and execute the chain
    const chain = RunnableSequence.from([
      fullPrompt,
      this.model,
      new StringOutputParser()
    ]);

    const response = await chain.invoke({
      history: this.conversationHistory,
      input: prompt
    });

    // Parse the response
    const parsedEmail = this.parseEmailResponse(response);

    // Track sources used
    const sourcesUsed = knowledgeContext.map(r => r.documentTitle);
    if (recentThreads.length > 0) {
      sourcesUsed.push('Recent Email History');
    }
    if (customerDbContext) {
      sourcesUsed.push('Customer Database');
    }

    return {
      subject: parsedEmail.subject,
      bodyHtml: parsedEmail.bodyHtml,
      bodyText: this.htmlToPlainText(parsedEmail.bodyHtml),
      recipientEmail,
      recipientName,
      suggestedFollowUp: parsedEmail.followUp,
      confidence: this.calculateConfidence(knowledgeContext, customerContext),
      sourcesUsed,
      requiresApproval: true // Always require approval for outbound emails
    };
  }

  /**
   * Search knowledge base for relevant email templates and best practices
   */
  private async searchKnowledgeBase(
    emailType: EmailType,
    customerContext: CustomerContext
  ): Promise<SearchResult[]> {
    // Build search query based on email type and customer context
    const queryParts = [emailType.replace('_', ' '), 'email'];

    if (customerContext.healthScore < 60) {
      queryParts.push('at-risk', 'save play');
    } else if (customerContext.renewalDate) {
      const daysToRenewal = this.daysUntil(customerContext.renewalDate);
      if (daysToRenewal < 90) {
        queryParts.push('renewal');
      }
    }

    if (customerContext.status === 'onboarding') {
      queryParts.push('onboarding', 'kickoff');
    }

    const query = queryParts.join(' ');

    try {
      const results = await knowledgeService.search(query, {
        limit: 3,
        threshold: 0.5
      });
      return results;
    } catch (error) {
      console.error('Knowledge base search failed:', error);
      return [];
    }
  }

  /**
   * Get recent email history with recipient
   */
  private async getRecentEmailHistory(
    userId: string,
    recipientEmail: string
  ): Promise<EmailThread[]> {
    try {
      const threads = await gmailService.getEmailsFromSender(userId, recipientEmail);
      return threads.slice(0, 5); // Last 5 threads
    } catch (error) {
      // Gmail not connected or error - continue without history
      return [];
    }
  }

  /**
   * Get customer context from database
   */
  private async getCustomerDbContext(
    customerId: string,
    userId: string
  ): Promise<Record<string, unknown> | null> {
    try {
      return await knowledgeService.getCustomerContext(customerId, userId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get upcoming meetings with the recipient
   */
  private async getUpcomingMeetings(
    userId: string,
    recipientEmail: string
  ): Promise<CalendarEvent[]> {
    try {
      const events = await calendarService.getUpcomingEvents(userId, 14, 10);
      // Filter to events with the recipient as attendee
      return events.filter(event =>
        event.attendees.some(a =>
          a.email.toLowerCase() === recipientEmail.toLowerCase()
        )
      ).slice(0, 3);
    } catch (error) {
      // Calendar not connected or error - continue without meeting context
      return [];
    }
  }

  /**
   * Get relevant CSM playbook for this email type
   */
  private async getCsmPlaybook(
    emailType: EmailType,
    customerContext: CustomerContext
  ): Promise<{ name: string; content: string } | null> {
    if (!this.supabase) return null;

    try {
      // Map email types to playbook categories
      const playbookMap: Record<string, string> = {
        check_in: 'health',
        follow_up: 'communication',
        qbr_invite: 'qbr',
        renewal: 'renewal',
        onboarding: 'onboarding',
        escalation: 'health',
        introduction: 'onboarding',
        thank_you: 'communication',
        meeting_recap: 'communication',
        custom: 'communication'
      };

      const category = playbookMap[emailType] || 'communication';

      // Get relevant playbook
      const { data: playbook } = await (this.supabase as any)
        .from('csm_playbooks')
        .select('name, content')
        .eq('category', category)
        .eq('is_active', true)
        .limit(1)
        .single();

      return playbook || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Build context string for the prompt
   */
  private buildContextString(
    customerContext: CustomerContext,
    knowledgeResults: SearchResult[],
    recentThreads: EmailThread[],
    dbContext: Record<string, unknown> | null,
    csmPlaybook?: { name: string; content: string } | null
  ): string {
    const parts: string[] = [];

    // Customer info
    parts.push(`### Customer Information
- Company: ${customerContext.name}
- ARR: $${customerContext.arr.toLocaleString()}
- Health Score: ${customerContext.healthScore}/100
- Status: ${customerContext.status}
- Renewal Date: ${customerContext.renewalDate || 'Not set'}
- Days Since Last Contact: ${customerContext.daysSinceLastContact || 'Unknown'}
- Open Issues: ${customerContext.openIssues || 0}`);

    // Stakeholders
    if (customerContext.stakeholders && customerContext.stakeholders.length > 0) {
      parts.push(`### Key Stakeholders
${customerContext.stakeholders.map(s =>
        `- ${s.name} (${s.role})${s.isPrimary ? ' - Primary Contact' : ''}`
      ).join('\n')}`);
    }

    // Recent meetings
    if (customerContext.recentMeetings && customerContext.recentMeetings.length > 0) {
      parts.push(`### Recent Meetings
${customerContext.recentMeetings.slice(0, 3).map(m =>
        `- ${m.title} (${m.date})${m.summary ? `: ${m.summary.substring(0, 100)}...` : ''}`
      ).join('\n')}`);
    }

    // Upcoming meetings with this customer (from Google Calendar)
    if (customerContext.upcomingMeetings && customerContext.upcomingMeetings.length > 0) {
      parts.push(`### Upcoming Meetings with Customer (from Calendar)
${customerContext.upcomingMeetings.slice(0, 3).map(m =>
        `- ${m.title} on ${m.startTime.toLocaleDateString()} at ${m.startTime.toLocaleTimeString()}${m.meetLink ? ' (Google Meet)' : ''}`
      ).join('\n')}`);
    }

    // Recent email threads
    if (recentThreads.length > 0) {
      parts.push(`### Recent Email History
${recentThreads.slice(0, 3).map(t =>
        `- "${t.subject}" (${t.messageCount} messages, last: ${t.lastMessageAt.toLocaleDateString()})`
      ).join('\n')}`);
    }

    // Product usage context
    if (customerContext.productUsage) {
      const usage = customerContext.productUsage;
      parts.push(`### Product Usage
- Active Users: ${usage.activeUsers || 'Unknown'}
- Feature Adoption: ${usage.featureAdoption ? `${usage.featureAdoption}%` : 'Unknown'}
- Last Login: ${usage.lastLoginDate || 'Unknown'}`);
    }

    // Database context (upcoming meetings, open tasks)
    if (dbContext) {
      const db = dbContext as any;
      if (db.upcoming_meetings?.length > 0) {
        parts.push(`### Scheduled Meetings (from Database)
${db.upcoming_meetings.slice(0, 3).map((m: any) =>
          `- ${m.title} on ${new Date(m.start_time).toLocaleDateString()}`
        ).join('\n')}`);
      }
      if (db.open_tasks?.length > 0) {
        parts.push(`### Open Tasks
${db.open_tasks.slice(0, 3).map((t: any) =>
          `- ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}`
        ).join('\n')}`);
      }
    }

    // CSM Playbook guidance
    if (csmPlaybook) {
      parts.push(`### CSM Playbook Guidance: ${csmPlaybook.name}
${csmPlaybook.content.substring(0, 1000)}${csmPlaybook.content.length > 1000 ? '...' : ''}`);
    }

    // Knowledge base context
    if (knowledgeResults.length > 0) {
      parts.push(`### Relevant Best Practices
${knowledgeResults.map(r =>
        `From "${r.documentTitle}":\n${r.content.substring(0, 500)}...`
      ).join('\n\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build the email drafting prompt
   */
  private buildEmailPrompt(
    emailType: EmailType,
    recipientName: string,
    tone: string,
    additionalContext?: string,
    threadId?: string
  ): string {
    const emailTypeLabels: Record<EmailType, string> = {
      check_in: 'Check-in Email',
      follow_up: 'Follow-up Email',
      qbr_invite: 'QBR Invitation',
      renewal: 'Renewal Discussion',
      onboarding: 'Onboarding Welcome',
      escalation: 'Escalation Response',
      introduction: 'Introduction Email',
      thank_you: 'Thank You Note',
      meeting_recap: 'Meeting Recap',
      custom: 'Custom Email'
    };

    let prompt = `Please draft a ${emailTypeLabels[emailType]} to ${recipientName}.

Tone: ${tone}`;

    if (threadId) {
      prompt += `\n\nThis is a REPLY to an existing thread. Do not include a subject line, just the body.`;
    }

    if (additionalContext) {
      prompt += `\n\nAdditional context from the CSM:\n${additionalContext}`;
    }

    prompt += `\n\nUse the customer context provided to personalize this email. Make it specific and actionable.`;

    return prompt;
  }

  /**
   * Parse the email response from the model
   */
  private parseEmailResponse(response: string): {
    subject: string;
    bodyHtml: string;
    followUp?: string;
  } {
    let subject = '';
    let bodyHtml = '';
    let followUp: string | undefined;

    // Extract subject
    const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?=---|$)/s);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    }

    // Extract follow-up
    const followUpMatch = response.match(/FOLLOW_UP:\s*(.+?)(?=---|$)/s);
    if (followUpMatch) {
      followUp = followUpMatch[1].trim();
    }

    // Extract body (everything between subject and follow_up markers)
    const bodyMatch = response.match(/---\s*\n([\s\S]*?)(?:\n---\s*FOLLOW_UP|$)/);
    if (bodyMatch) {
      bodyHtml = bodyMatch[1].trim();
      // Remove any remaining markers
      bodyHtml = bodyHtml.replace(/^---\s*/, '').replace(/\s*---$/, '').trim();
    }

    // If parsing failed, treat entire response as body
    if (!bodyHtml) {
      bodyHtml = response;
      // Generate subject from first line if missing
      if (!subject) {
        const firstLine = response.split('\n')[0];
        subject = firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
      }
    }

    // Ensure HTML formatting
    if (!bodyHtml.includes('<p>') && !bodyHtml.includes('<br>')) {
      bodyHtml = bodyHtml
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
    }

    return { subject, bodyHtml, followUp };
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Calculate confidence score for the draft
   */
  private calculateConfidence(
    knowledgeResults: SearchResult[],
    customerContext: CustomerContext
  ): number {
    let confidence = 0.7; // Base confidence

    // More knowledge context = higher confidence
    if (knowledgeResults.length > 0) {
      confidence += 0.1;
      if (knowledgeResults[0].similarity > 0.8) {
        confidence += 0.05;
      }
    }

    // More customer context = higher confidence
    if (customerContext.stakeholders && customerContext.stakeholders.length > 0) {
      confidence += 0.05;
    }
    if (customerContext.recentMeetings && customerContext.recentMeetings.length > 0) {
      confidence += 0.05;
    }
    if (customerContext.daysSinceLastContact !== undefined) {
      confidence += 0.03;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate days until a date
   */
  private daysUntil(dateString: string): number {
    const target = new Date(dateString);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Create a Gmail draft from the email response
   */
  async createDraft(
    userId: string,
    emailResponse: EmailDraftResponse,
    threadId?: string
  ): Promise<string> {
    const draft: DraftEmail = {
      to: [emailResponse.recipientEmail],
      subject: emailResponse.subject,
      bodyHtml: emailResponse.bodyHtml,
      bodyText: emailResponse.bodyText,
      threadId
    };

    return gmailService.createDraft(userId, draft);
  }

  /**
   * Send email directly (after approval)
   */
  async sendEmail(
    userId: string,
    emailResponse: EmailDraftResponse,
    options: {
      threadId?: string;
      customerId?: string;
      saveToDb?: boolean;
    } = {}
  ): Promise<string> {
    return gmailService.sendEmail(userId, {
      to: [emailResponse.recipientEmail],
      subject: emailResponse.subject,
      bodyHtml: emailResponse.bodyHtml,
      bodyText: emailResponse.bodyText,
      threadId: options.threadId,
      saveToDb: options.saveToDb ?? true,
      customerId: options.customerId,
    });
  }

  /**
   * Draft a reply to an existing email thread
   */
  async draftReply(
    userId: string,
    threadId: string,
    customerContext: CustomerContext,
    additionalContext?: string
  ): Promise<EmailDraftResponse> {
    // Get the thread to understand context
    const { thread, messages } = await gmailService.getThread(userId, threadId);
    const lastMessage = messages[messages.length - 1];

    // Build reply request
    const request: EmailDraftRequest = {
      emailType: 'follow_up',
      recipientEmail: lastMessage.from.email,
      recipientName: lastMessage.from.name,
      customerContext,
      additionalContext: `This is a REPLY to an existing email thread.

Original Thread Subject: ${thread.subject}

Last message from ${lastMessage.from.name || lastMessage.from.email}:
---
${lastMessage.bodyText.substring(0, 1000)}${lastMessage.bodyText.length > 1000 ? '...' : ''}
---

${additionalContext || ''}`,
      tone: 'professional',
      threadId,
      userId,
    };

    return this.draftEmail(request);
  }

  /**
   * Get email templates from database
   */
  async getEmailTemplates(
    category?: string
  ): Promise<Array<{ id: string; name: string; category: string; subject: string; body: string }>> {
    if (!this.supabase) return [];

    try {
      let query = (this.supabase as any)
        .from('email_templates')
        .select('id, name, category, subject_template, body_template')
        .eq('is_active', true);

      if (category) {
        query = query.eq('category', category);
      }

      const { data } = await query.order('name');

      return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        subject: t.subject_template,
        body: t.body_template,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Draft email from a template
   */
  async draftFromTemplate(
    userId: string,
    templateId: string,
    customerContext: CustomerContext,
    recipientEmail: string,
    variables?: Record<string, string>
  ): Promise<EmailDraftResponse> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Get template
    const { data: template } = await (this.supabase as any)
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      throw new Error('Template not found');
    }

    // Build variable map with customer context
    const vars: Record<string, string> = {
      customer_name: customerContext.name,
      customer_arr: `$${customerContext.arr.toLocaleString()}`,
      health_score: String(customerContext.healthScore),
      renewal_date: customerContext.renewalDate || '',
      ...variables,
    };

    // Replace variables in template
    let subject = template.subject_template;
    let body = template.body_template;

    for (const [key, value] of Object.entries(vars)) {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return {
      subject,
      bodyHtml: body,
      bodyText: this.htmlToPlainText(body),
      recipientEmail,
      confidence: 0.85,
      sourcesUsed: [`Template: ${template.name}`],
      requiresApproval: true,
    };
  }

  /**
   * Interactive chat for refining emails
   */
  async refineEmail(
    feedback: string,
    currentDraft: EmailDraftResponse,
    customerContext: CustomerContext
  ): Promise<EmailDraftResponse> {
    // Add current draft to history
    this.conversationHistory.push(
      new AIMessage(`Current draft:\nSubject: ${currentDraft.subject}\n\n${currentDraft.bodyText}`)
    );
    this.conversationHistory.push(new HumanMessage(feedback));

    const systemContent = `${EMAIL_SYSTEM_PROMPT}

You previously drafted an email. The user has feedback to refine it. Please update the email based on their feedback while maintaining personalization and professionalism.

Customer: ${customerContext.name}
Health Score: ${customerContext.healthScore}/100`;

    const fullPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(systemContent),
      new MessagesPlaceholder("history"),
      new HumanMessage("{input}")
    ]);

    const chain = RunnableSequence.from([
      fullPrompt,
      this.model,
      new StringOutputParser()
    ]);

    const response = await chain.invoke({
      history: this.conversationHistory,
      input: `Please revise the email based on this feedback: ${feedback}`
    });

    const parsedEmail = this.parseEmailResponse(response);

    // Update history
    this.conversationHistory.push(new AIMessage(response));

    return {
      ...currentDraft,
      subject: parsedEmail.subject,
      bodyHtml: parsedEmail.bodyHtml,
      bodyText: this.htmlToPlainText(parsedEmail.bodyHtml),
      suggestedFollowUp: parsedEmail.followUp
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Generate suggested email actions based on customer context
   */
  async suggestEmailActions(customerContext: CustomerContext): Promise<Array<{
    action: string;
    emailType: EmailType;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>> {
    const suggestions: Array<{
      action: string;
      emailType: EmailType;
      priority: 'high' | 'medium' | 'low';
      reason: string;
    }> = [];

    // Check for various triggers

    // At-risk customer
    if (customerContext.healthScore < 60) {
      suggestions.push({
        action: 'Send check-in email to address concerns',
        emailType: 'check_in',
        priority: 'high',
        reason: `Health score is low (${customerContext.healthScore}/100)`
      });
    }

    // Days since last contact
    if (customerContext.daysSinceLastContact && customerContext.daysSinceLastContact > 14) {
      suggestions.push({
        action: 'Send re-engagement email',
        emailType: 'follow_up',
        priority: customerContext.daysSinceLastContact > 30 ? 'high' : 'medium',
        reason: `No contact in ${customerContext.daysSinceLastContact} days`
      });
    }

    // Renewal approaching
    if (customerContext.renewalDate) {
      const daysToRenewal = this.daysUntil(customerContext.renewalDate);
      if (daysToRenewal <= 90 && daysToRenewal > 0) {
        suggestions.push({
          action: 'Initiate renewal conversation',
          emailType: 'renewal',
          priority: daysToRenewal <= 30 ? 'high' : 'medium',
          reason: `Renewal in ${daysToRenewal} days`
        });
      }
    }

    // New customer onboarding
    if (customerContext.status === 'onboarding') {
      suggestions.push({
        action: 'Send onboarding welcome and next steps',
        emailType: 'onboarding',
        priority: 'high',
        reason: 'Customer is in onboarding phase'
      });
    }

    // Open issues
    if (customerContext.openIssues && customerContext.openIssues > 0) {
      suggestions.push({
        action: 'Send update on open issues',
        emailType: 'follow_up',
        priority: customerContext.openIssues > 3 ? 'high' : 'medium',
        reason: `${customerContext.openIssues} open issues`
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
  }
}

// Singleton instance
export const emailAgent = new EmailAgent();
