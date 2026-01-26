/**
 * Meeting Agent
 * Prepares meeting briefs, agendas, and follow-ups using Google Workspace context
 *
 * Features:
 * - Pre-meeting briefings with customer context
 * - Agenda generation
 * - Post-meeting summaries and action items
 * - Follow-up scheduling
 * - Meeting notes with AI assistance
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config/index.js";
import { calendarService, CalendarEvent, CreateEventOptions } from "../../services/google/calendar.js";
import { gmailService, EmailThread } from "../../services/google/gmail.js";
import { driveService, DriveFile } from "../../services/google/drive.js";
import { knowledgeService, SearchResult } from "../../services/knowledge.js";

// Type definitions
export type MeetingType =
  | 'kickoff'
  | 'qbr'
  | 'check_in'
  | 'training'
  | 'executive_review'
  | 'renewal'
  | 'escalation'
  | 'demo'
  | 'planning'
  | 'custom';

export interface CustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  status: string;
  renewalDate?: string;
  industry?: string;
  stakeholders?: Array<{
    name: string;
    role: string;
    email: string;
    isPrimary?: boolean;
  }>;
  openIssues?: number;
  productUsage?: {
    activeUsers?: number;
    featureAdoption?: number;
    lastLoginDate?: string;
  };
  recentMilestones?: string[];
  userId?: string; // For Google Workspace API access
}

export interface MeetingBriefRequest {
  eventId?: string;
  meetingType: MeetingType;
  customerContext: CustomerContext;
  attendees: string[];
  meetingTitle?: string;
  meetingDate?: Date;
  duration?: number; // minutes
  additionalContext?: string;
  userId: string;
}

export interface MeetingBrief {
  title: string;
  customerSummary: string;
  objectives: string[];
  suggestedAgenda: AgendaItem[];
  talkingPoints: string[];
  risksAndConcerns: string[];
  opportunitiesAndWins: string[];
  attendeeInsights: AttendeeInsight[];
  relevantDocuments: DriveFile[];
  recentEmailContext: string;
  preparationTips: string[];
  suggestedQuestions: string[];
  confidence: number;
}

export interface AgendaItem {
  topic: string;
  duration: number; // minutes
  owner?: string;
  notes?: string;
}

export interface AttendeeInsight {
  email: string;
  name?: string;
  role?: string;
  lastInteraction?: Date;
  relationship?: 'champion' | 'supporter' | 'neutral' | 'blocker' | 'unknown';
  notes?: string;
}

export interface MeetingSummary {
  title: string;
  date: Date;
  attendees: string[];
  keyDiscussions: string[];
  decisions: string[];
  actionItems: ActionItem[];
  nextSteps: string[];
  followUpDate?: Date;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  healthImpact?: 'improved' | 'stable' | 'declined';
}

export interface ActionItem {
  task: string;
  owner: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

const MEETING_SYSTEM_PROMPT = `You are an expert Customer Success meeting preparation assistant.

Your goal is to help CSMs prepare for and follow up on customer meetings effectively.

## Core Principles

1. **Context is King**: Always incorporate customer history, health metrics, and recent interactions
2. **Value-Focused Agendas**: Every meeting should have clear objectives and value for the customer
3. **Proactive Insights**: Identify risks, opportunities, and key discussion points ahead of time
4. **Actionable Outcomes**: Every meeting should result in clear next steps
5. **Relationship Building**: Help strengthen relationships through personalized preparation

## Meeting Preparation Guidelines

### Pre-Meeting Brief
- Executive summary of customer status
- Key metrics and trends
- Recent interactions and context
- Objectives and success criteria
- Potential risks or concerns to address
- Opportunities to highlight

### Agenda Structure
- Welcome and relationship building (5 min)
- Review of previous action items (5-10 min)
- Main discussion topics (variable)
- Next steps and action items (5-10 min)
- Closing and scheduling follow-up (5 min)

### Meeting Types

1. **Kickoff**: Focus on goals, success criteria, implementation plan
2. **QBR**: Business outcomes, ROI, strategic alignment, expansion opportunities
3. **Check-in**: Health pulse, blockers, quick wins, relationship maintenance
4. **Training**: Learning objectives, hands-on exercises, Q&A
5. **Executive Review**: Strategic value, executive alignment, partnership growth
6. **Renewal**: Value delivered, future roadmap, commercial discussion
7. **Escalation**: Issue resolution, recovery plan, trust rebuilding
8. **Demo**: Feature showcase, use case alignment, adoption planning
9. **Planning**: Strategic planning, goal setting, roadmap alignment

## Output Formats

### Meeting Brief Format
---
CUSTOMER_SUMMARY: [2-3 sentence executive summary]
---
OBJECTIVES:
- [Objective 1]
- [Objective 2]
---
AGENDA:
1. [Topic] (X min) - [Owner]
2. [Topic] (X min) - [Owner]
---
TALKING_POINTS:
- [Key point to discuss]
---
RISKS:
- [Risk or concern]
---
OPPORTUNITIES:
- [Opportunity or win to highlight]
---
PREPARATION_TIPS:
- [Tip for CSM]
---
QUESTIONS_TO_ASK:
- [Strategic question]
---

### Meeting Summary Format
---
KEY_DISCUSSIONS:
- [Topic discussed]
---
DECISIONS:
- [Decision made]
---
ACTION_ITEMS:
- [Task] | [Owner] | [Due Date] | [Priority]
---
NEXT_STEPS:
- [Next step]
---
SENTIMENT: [positive/neutral/negative/mixed]
---
HEALTH_IMPACT: [improved/stable/declined]
---`;

export class MeetingAgent {
  private model: ChatGoogleGenerativeAI;
  private supabase: ReturnType<typeof createClient> | null = null;
  private conversationHistory: (HumanMessage | AIMessage)[] = [];

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: "gemini-2.0-flash",
      temperature: 0.7
    });

    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Generate a comprehensive meeting brief
   */
  async generateMeetingBrief(request: MeetingBriefRequest): Promise<MeetingBrief> {
    const {
      eventId,
      meetingType,
      customerContext,
      attendees,
      meetingTitle,
      meetingDate,
      additionalContext,
      userId
    } = request;

    // Gather context from multiple sources in parallel
    const [
      calendarEvent,
      recentEmails,
      relevantDocs,
      knowledgeContext,
      csmPlaybook,
      attendeeInsights
    ] = await Promise.all([
      eventId ? this.getCalendarEvent(userId, eventId) : Promise.resolve(null),
      this.getRecentEmailsWithCustomer(userId, customerContext, attendees),
      this.getRelevantDocuments(userId, customerContext),
      this.searchKnowledgeBase(meetingType, customerContext),
      this.getCsmPlaybook(meetingType),
      this.getAttendeeInsights(userId, attendees, customerContext)
    ]);

    // Build context string
    const contextString = this.buildContextString(
      customerContext,
      calendarEvent,
      recentEmails,
      relevantDocs,
      knowledgeContext,
      csmPlaybook,
      attendeeInsights
    );

    // Build the prompt
    const prompt = this.buildBriefPrompt(
      meetingType,
      meetingTitle || calendarEvent?.title || 'Customer Meeting',
      meetingDate || calendarEvent?.startTime || new Date(),
      attendees,
      additionalContext
    );

    const systemContent = `${MEETING_SYSTEM_PROMPT}

## CURRENT MEETING CONTEXT
${contextString}`;

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
      input: prompt
    });

    // Parse the response
    const parsedBrief = this.parseBriefResponse(response);

    return {
      title: meetingTitle || calendarEvent?.title || `${meetingType} Meeting with ${customerContext.name}`,
      customerSummary: parsedBrief.customerSummary,
      objectives: parsedBrief.objectives,
      suggestedAgenda: parsedBrief.agenda,
      talkingPoints: parsedBrief.talkingPoints,
      risksAndConcerns: parsedBrief.risks,
      opportunitiesAndWins: parsedBrief.opportunities,
      attendeeInsights,
      relevantDocuments: relevantDocs,
      recentEmailContext: this.summarizeEmails(recentEmails),
      preparationTips: parsedBrief.preparationTips,
      suggestedQuestions: parsedBrief.questions,
      confidence: this.calculateConfidence(knowledgeContext, customerContext, recentEmails)
    };
  }

  /**
   * Generate a post-meeting summary from notes
   */
  async generateMeetingSummary(
    meetingNotes: string,
    customerContext: CustomerContext,
    attendees: string[],
    meetingType: MeetingType
  ): Promise<MeetingSummary> {
    const prompt = `Please analyze these meeting notes and generate a structured summary.

Meeting Type: ${meetingType}
Customer: ${customerContext.name}
Health Score: ${customerContext.healthScore}/100
Attendees: ${attendees.join(', ')}

Meeting Notes:
---
${meetingNotes}
---

Generate a comprehensive summary following the Meeting Summary Format.
Extract all action items with clear owners and due dates.
Assess the overall sentiment and potential health score impact.`;

    const fullPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(MEETING_SYSTEM_PROMPT),
      new HumanMessage("{input}")
    ]);

    const chain = RunnableSequence.from([
      fullPrompt,
      this.model,
      new StringOutputParser()
    ]);

    const response = await chain.invoke({ input: prompt });
    return this.parseSummaryResponse(response, attendees);
  }

  /**
   * Schedule a follow-up meeting
   */
  async scheduleFollowUp(
    userId: string,
    customerContext: CustomerContext,
    options: {
      title?: string;
      daysFromNow?: number;
      duration?: number;
      attendees: string[];
      agenda?: string;
      createMeetLink?: boolean;
    }
  ): Promise<CalendarEvent> {
    const {
      title = `Follow-up: ${customerContext.name}`,
      daysFromNow = 7,
      duration = 30,
      attendees,
      agenda,
      createMeetLink = true
    } = options;

    // Find available slot
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + daysFromNow);
    startDate.setHours(9, 0, 0, 0); // Start looking at 9 AM

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7); // Look within a week

    const availableSlots = await calendarService.findAvailableSlots(userId, {
      timeMin: startDate,
      timeMax: endDate,
      duration,
    });

    if (availableSlots.length === 0) {
      throw new Error('No available slots found in the next week');
    }

    // Use the first available slot
    const slot = availableSlots[0];

    const eventOptions: CreateEventOptions = {
      title,
      description: agenda || `Follow-up meeting with ${customerContext.name}`,
      startTime: slot.start,
      endTime: slot.end,
      attendees,
      createMeetLink,
      sendNotifications: true,
    };

    return calendarService.createMeeting(userId, eventOptions);
  }

  /**
   * Get today's meetings with briefs
   */
  async getTodaysMeetingsWithBriefs(
    userId: string,
    getCustomerContext: (attendees: string[]) => Promise<CustomerContext | null>
  ): Promise<Array<{ event: CalendarEvent; brief: MeetingBrief | null }>> {
    const events = await calendarService.getTodayEvents(userId);
    const results: Array<{ event: CalendarEvent; brief: MeetingBrief | null }> = [];

    for (const event of events) {
      const attendeeEmails = event.attendees.map(a => a.email);
      const customerContext = await getCustomerContext(attendeeEmails);

      if (customerContext) {
        const brief = await this.generateMeetingBrief({
          eventId: event.id,
          meetingType: this.inferMeetingType(event.title),
          customerContext,
          attendees: attendeeEmails,
          meetingTitle: event.title,
          meetingDate: event.startTime,
          userId,
        });
        results.push({ event, brief });
      } else {
        results.push({ event, brief: null });
      }
    }

    return results;
  }

  /**
   * Create action items from meeting and save to database
   */
  async createActionItems(
    userId: string,
    customerId: string,
    meetingId: string,
    actionItems: ActionItem[]
  ): Promise<void> {
    if (!this.supabase) return;

    for (const item of actionItems) {
      await (this.supabase as any)
        .from('google_tasks')
        .insert({
          user_id: userId,
          customer_id: customerId,
          title: item.task,
          notes: `From meeting: ${meetingId}`,
          due_date: item.dueDate?.toISOString(),
          status: 'needsAction',
          priority: item.priority,
        });
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Get calendar event details
   */
  private async getCalendarEvent(
    userId: string,
    eventId: string
  ): Promise<CalendarEvent | null> {
    try {
      return await calendarService.getEvent(userId, eventId);
    } catch {
      return null;
    }
  }

  /**
   * Get recent emails with customer
   */
  private async getRecentEmailsWithCustomer(
    userId: string,
    customerContext: CustomerContext,
    attendees: string[]
  ): Promise<EmailThread[]> {
    try {
      const threads: EmailThread[] = [];

      // Search for emails with each attendee
      for (const email of attendees.slice(0, 3)) {
        const attendeeThreads = await gmailService.getEmailsFromSender(userId, email);
        threads.push(...attendeeThreads.slice(0, 2));
      }

      // Also search by company name
      const companyThreads = await gmailService.searchEmails(
        userId,
        customerContext.name,
        5
      );
      threads.push(...companyThreads);

      // Dedupe and sort by date
      const uniqueThreads = Array.from(
        new Map(threads.map(t => [t.id, t])).values()
      );

      return uniqueThreads
        .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  /**
   * Get relevant documents from Drive
   */
  private async getRelevantDocuments(
    userId: string,
    customerContext: CustomerContext
  ): Promise<DriveFile[]> {
    try {
      const { files } = await driveService.searchFiles(userId, customerContext.name, {
        maxResults: 5
      });
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Search knowledge base for meeting prep
   */
  private async searchKnowledgeBase(
    meetingType: MeetingType,
    customerContext: CustomerContext
  ): Promise<SearchResult[]> {
    const queryParts = [meetingType.replace('_', ' '), 'meeting'];

    if (customerContext.healthScore < 60) {
      queryParts.push('at-risk', 'recovery');
    }

    if (meetingType === 'qbr') {
      queryParts.push('quarterly business review', 'ROI');
    } else if (meetingType === 'renewal') {
      queryParts.push('renewal', 'expansion');
    } else if (meetingType === 'kickoff') {
      queryParts.push('onboarding', 'implementation');
    }

    try {
      return await knowledgeService.search(queryParts.join(' '), {
        limit: 3,
        threshold: 0.5
      });
    } catch {
      return [];
    }
  }

  /**
   * Get CSM playbook for meeting type
   */
  private async getCsmPlaybook(
    meetingType: MeetingType
  ): Promise<{ name: string; content: string } | null> {
    if (!this.supabase) return null;

    try {
      const playbookMap: Record<string, string> = {
        kickoff: 'onboarding',
        qbr: 'qbr',
        check_in: 'health',
        training: 'onboarding',
        executive_review: 'expansion',
        renewal: 'renewal',
        escalation: 'health',
        demo: 'onboarding',
        planning: 'expansion',
        custom: 'communication'
      };

      const category = playbookMap[meetingType] || 'communication';

      const { data } = await (this.supabase as any)
        .from('csm_playbooks')
        .select('name, content')
        .eq('category', category)
        .eq('is_active', true)
        .limit(1)
        .single();

      return data || null;
    } catch {
      return null;
    }
  }

  /**
   * Get insights about meeting attendees
   */
  private async getAttendeeInsights(
    userId: string,
    attendees: string[],
    customerContext: CustomerContext
  ): Promise<AttendeeInsight[]> {
    const insights: AttendeeInsight[] = [];

    // Match attendees with stakeholders
    for (const email of attendees) {
      const stakeholder = customerContext.stakeholders?.find(
        s => s.email.toLowerCase() === email.toLowerCase()
      );

      if (stakeholder) {
        // Get last email interaction
        let lastInteraction: Date | undefined;
        try {
          const threads = await gmailService.getEmailsFromSender(userId, email);
          if (threads.length > 0) {
            lastInteraction = threads[0].lastMessageAt;
          }
        } catch {
          // Ignore
        }

        insights.push({
          email,
          name: stakeholder.name,
          role: stakeholder.role,
          lastInteraction,
          relationship: stakeholder.isPrimary ? 'champion' : 'supporter',
        });
      } else {
        insights.push({
          email,
          relationship: 'unknown'
        });
      }
    }

    return insights;
  }

  /**
   * Build context string for the prompt
   */
  private buildContextString(
    customerContext: CustomerContext,
    calendarEvent: CalendarEvent | null,
    recentEmails: EmailThread[],
    relevantDocs: DriveFile[],
    knowledgeResults: SearchResult[],
    csmPlaybook: { name: string; content: string } | null,
    attendeeInsights: AttendeeInsight[]
  ): string {
    const parts: string[] = [];

    // Customer overview
    parts.push(`### Customer Overview
- Company: ${customerContext.name}
- ARR: $${customerContext.arr.toLocaleString()}
- Health Score: ${customerContext.healthScore}/100
- Status: ${customerContext.status}
- Industry: ${customerContext.industry || 'Unknown'}
- Renewal Date: ${customerContext.renewalDate || 'Not set'}
- Open Issues: ${customerContext.openIssues || 0}`);

    // Product usage
    if (customerContext.productUsage) {
      const usage = customerContext.productUsage;
      parts.push(`### Product Usage
- Active Users: ${usage.activeUsers || 'Unknown'}
- Feature Adoption: ${usage.featureAdoption ? `${usage.featureAdoption}%` : 'Unknown'}
- Last Login: ${usage.lastLoginDate || 'Unknown'}`);
    }

    // Recent milestones
    if (customerContext.recentMilestones?.length) {
      parts.push(`### Recent Milestones
${customerContext.recentMilestones.map(m => `- ${m}`).join('\n')}`);
    }

    // Meeting details
    if (calendarEvent) {
      parts.push(`### Scheduled Meeting
- Title: ${calendarEvent.title}
- Date: ${calendarEvent.startTime.toLocaleDateString()} at ${calendarEvent.startTime.toLocaleTimeString()}
- Duration: ${Math.round((calendarEvent.endTime.getTime() - calendarEvent.startTime.getTime()) / 60000)} minutes
- Meet Link: ${calendarEvent.meetLink || 'Not set'}`);
    }

    // Attendee insights
    if (attendeeInsights.length > 0) {
      parts.push(`### Meeting Attendees
${attendeeInsights.map(a =>
        `- ${a.name || a.email}${a.role ? ` (${a.role})` : ''}${a.relationship !== 'unknown' ? ` - ${a.relationship}` : ''}${a.lastInteraction ? ` - Last contact: ${a.lastInteraction.toLocaleDateString()}` : ''}`
      ).join('\n')}`);
    }

    // Recent email context
    if (recentEmails.length > 0) {
      parts.push(`### Recent Email Threads
${recentEmails.slice(0, 3).map(t =>
        `- "${t.subject}" (${t.messageCount} messages, ${t.lastMessageAt.toLocaleDateString()})`
      ).join('\n')}`);
    }

    // Relevant documents
    if (relevantDocs.length > 0) {
      parts.push(`### Relevant Documents in Drive
${relevantDocs.slice(0, 3).map(d =>
        `- ${d.name} (${d.mimeType.includes('document') ? 'Doc' : d.mimeType.includes('spreadsheet') ? 'Sheet' : d.mimeType.includes('presentation') ? 'Slides' : 'File'})`
      ).join('\n')}`);
    }

    // CSM Playbook
    if (csmPlaybook) {
      parts.push(`### CSM Playbook: ${csmPlaybook.name}
${csmPlaybook.content.substring(0, 800)}${csmPlaybook.content.length > 800 ? '...' : ''}`);
    }

    // Knowledge base
    if (knowledgeResults.length > 0) {
      parts.push(`### Best Practices
${knowledgeResults.map(r =>
        `From "${r.documentTitle}":\n${r.content.substring(0, 400)}...`
      ).join('\n\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build the brief generation prompt
   */
  private buildBriefPrompt(
    meetingType: MeetingType,
    title: string,
    date: Date,
    attendees: string[],
    additionalContext?: string
  ): string {
    const meetingLabels: Record<MeetingType, string> = {
      kickoff: 'Kickoff/Implementation Meeting',
      qbr: 'Quarterly Business Review (QBR)',
      check_in: 'Regular Check-in',
      training: 'Training Session',
      executive_review: 'Executive Business Review',
      renewal: 'Renewal Discussion',
      escalation: 'Escalation/Issue Resolution',
      demo: 'Product Demo',
      planning: 'Strategic Planning',
      custom: 'Customer Meeting'
    };

    let prompt = `Please generate a comprehensive meeting brief for this upcoming meeting.

Meeting Type: ${meetingLabels[meetingType]}
Title: ${title}
Date: ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}
Attendees: ${attendees.join(', ')}`;

    if (additionalContext) {
      prompt += `\n\nAdditional Context:\n${additionalContext}`;
    }

    prompt += `\n\nGenerate a detailed brief following the Meeting Brief Format. Include specific talking points and questions based on the customer context provided.`;

    return prompt;
  }

  /**
   * Parse the brief response from the model
   */
  private parseBriefResponse(response: string): {
    customerSummary: string;
    objectives: string[];
    agenda: AgendaItem[];
    talkingPoints: string[];
    risks: string[];
    opportunities: string[];
    preparationTips: string[];
    questions: string[];
  } {
    const extractSection = (marker: string): string[] => {
      const regex = new RegExp(`${marker}:?\\s*([\\s\\S]*?)(?=---|$)`, 'i');
      const match = response.match(regex);
      if (!match) return [];

      return match[1]
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0);
    };

    // Extract customer summary
    const summaryMatch = response.match(/CUSTOMER_SUMMARY:?\s*([\s\S]*?)(?=---|$)/i);
    const customerSummary = summaryMatch ? summaryMatch[1].trim() : '';

    // Extract objectives
    const objectives = extractSection('OBJECTIVES');

    // Extract agenda items
    const agendaLines = extractSection('AGENDA');
    const agenda: AgendaItem[] = agendaLines.map(line => {
      const match = line.match(/(.+?)\s*\((\d+)\s*min\)(?:\s*-\s*(.+))?/);
      if (match) {
        return {
          topic: match[1].replace(/^\d+\.\s*/, '').trim(),
          duration: parseInt(match[2]),
          owner: match[3]?.trim()
        };
      }
      return { topic: line, duration: 10 };
    });

    return {
      customerSummary,
      objectives,
      agenda,
      talkingPoints: extractSection('TALKING_POINTS'),
      risks: extractSection('RISKS'),
      opportunities: extractSection('OPPORTUNITIES'),
      preparationTips: extractSection('PREPARATION_TIPS'),
      questions: extractSection('QUESTIONS_TO_ASK')
    };
  }

  /**
   * Parse meeting summary response
   */
  private parseSummaryResponse(response: string, attendees: string[]): MeetingSummary {
    const extractSection = (marker: string): string[] => {
      const regex = new RegExp(`${marker}:?\\s*([\\s\\S]*?)(?=---|$)`, 'i');
      const match = response.match(regex);
      if (!match) return [];

      return match[1]
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0);
    };

    // Parse action items with owner and due date
    const actionLines = extractSection('ACTION_ITEMS');
    const actionItems: ActionItem[] = actionLines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      return {
        task: parts[0] || line,
        owner: parts[1] || 'Unassigned',
        dueDate: parts[2] ? new Date(parts[2]) : undefined,
        priority: (parts[3]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
        status: 'pending'
      };
    });

    // Extract sentiment
    const sentimentMatch = response.match(/SENTIMENT:\s*(positive|neutral|negative|mixed)/i);
    const sentiment = (sentimentMatch?.[1]?.toLowerCase() as MeetingSummary['sentiment']) || 'neutral';

    // Extract health impact
    const healthMatch = response.match(/HEALTH_IMPACT:\s*(improved|stable|declined)/i);
    const healthImpact = healthMatch?.[1]?.toLowerCase() as MeetingSummary['healthImpact'];

    return {
      title: 'Meeting Summary',
      date: new Date(),
      attendees,
      keyDiscussions: extractSection('KEY_DISCUSSIONS'),
      decisions: extractSection('DECISIONS'),
      actionItems,
      nextSteps: extractSection('NEXT_STEPS'),
      sentiment,
      healthImpact
    };
  }

  /**
   * Summarize email threads for context
   */
  private summarizeEmails(threads: EmailThread[]): string {
    if (threads.length === 0) return 'No recent email context available.';

    return threads.slice(0, 3).map(t =>
      `• "${t.subject}" - ${t.messageCount} messages, last activity ${t.lastMessageAt.toLocaleDateString()}`
    ).join('\n');
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    knowledgeResults: SearchResult[],
    customerContext: CustomerContext,
    recentEmails: EmailThread[]
  ): number {
    let confidence = 0.6;

    if (knowledgeResults.length > 0) confidence += 0.1;
    if (customerContext.stakeholders?.length) confidence += 0.1;
    if (recentEmails.length > 0) confidence += 0.1;
    if (customerContext.productUsage) confidence += 0.05;
    if (customerContext.recentMilestones?.length) confidence += 0.05;

    return Math.min(confidence, 0.95);
  }

  /**
   * Infer meeting type from title
   */
  private inferMeetingType(title: string): MeetingType {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('kickoff') || titleLower.includes('kick-off') || titleLower.includes('implementation')) {
      return 'kickoff';
    }
    if (titleLower.includes('qbr') || titleLower.includes('quarterly') || titleLower.includes('business review')) {
      return 'qbr';
    }
    if (titleLower.includes('check-in') || titleLower.includes('check in') || titleLower.includes('sync')) {
      return 'check_in';
    }
    if (titleLower.includes('training') || titleLower.includes('workshop')) {
      return 'training';
    }
    if (titleLower.includes('executive') || titleLower.includes('ebr')) {
      return 'executive_review';
    }
    if (titleLower.includes('renewal')) {
      return 'renewal';
    }
    if (titleLower.includes('escalation') || titleLower.includes('issue') || titleLower.includes('urgent')) {
      return 'escalation';
    }
    if (titleLower.includes('demo') || titleLower.includes('demonstration')) {
      return 'demo';
    }
    if (titleLower.includes('planning') || titleLower.includes('strategy') || titleLower.includes('roadmap')) {
      return 'planning';
    }

    return 'custom';
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// Singleton instance
export const meetingAgent = new MeetingAgent();
