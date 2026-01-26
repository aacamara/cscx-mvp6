/**
 * LangChain Tools for CS Agents
 * These tools give agents the ability to take actions and retrieve information
 */

import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { z } from "zod";
import { vectorStore } from "../vectorstore/index.js";
import { calendarService } from "../../services/google/calendar.js";
import { gmailService } from "../../services/google/gmail.js";
import { driveService } from "../../services/google/drive.js";

/**
 * Knowledge Base Search Tool
 * Searches CS playbooks, best practices, and documentation
 */
export const knowledgeBaseSearchTool = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description: `Search the Customer Success knowledge base for playbooks, best practices, templates, and frameworks.
Use this when you need guidance on how to handle a CS situation like onboarding, renewals, churn prevention, or stakeholder management.`,
  schema: z.object({
    query: z.string().describe("The search query - describe what you're looking for"),
    topic: z.string().optional().describe("Optional topic filter: onboarding, renewal, churn_prevention, expansion, health_score, qbr, stakeholder_management")
  }),
  func: async ({ query, topic }) => {
    const filter = topic ? { topic } : undefined;
    const results = await vectorStore.similaritySearch(query, 3, 'knowledge_base');

    if (results.length === 0) {
      return "No relevant knowledge base articles found. Consider asking the user for more context.";
    }

    return results.map((r, i) =>
      `[Result ${i + 1}] (Relevance: ${(r.score * 100).toFixed(0)}%)\n${r.document.content}`
    ).join('\n\n---\n\n');
  }
});

/**
 * Contract Search Tool
 * Searches through past contracts for similar terms, clauses, or customers
 */
export const contractSearchTool = new DynamicStructuredTool({
  name: "search_contracts",
  description: `Search through past customer contracts to find similar terms, pricing, entitlements, or customer profiles.
Use this when you need to reference how similar deals were structured or find precedents.`,
  schema: z.object({
    query: z.string().describe("What to search for in contracts"),
    customerName: z.string().optional().describe("Optional: filter by specific customer name")
  }),
  func: async ({ query, customerName }) => {
    const filter = customerName ? { customer_name: customerName } : undefined;
    const results = await vectorStore.hybridSearch(query, 5, 'contracts');

    if (results.length === 0) {
      return "No matching contracts found in the database.";
    }

    return results.map((r, i) =>
      `[Contract ${i + 1}] ${r.document.metadata.customer_name || 'Unknown'}\n${r.document.content.substring(0, 500)}...`
    ).join('\n\n');
  }
});

/**
 * Customer Notes Search Tool
 * Searches through customer interaction notes and history
 */
export const customerNotesSearchTool = new DynamicStructuredTool({
  name: "search_customer_notes",
  description: `Search through past customer notes, meeting summaries, and interaction history.
Use this to understand customer context, past issues, or relationship history.`,
  schema: z.object({
    query: z.string().describe("What to search for in customer notes"),
    customerId: z.string().optional().describe("Optional: filter by customer ID")
  }),
  func: async ({ query, customerId }) => {
    const filter = customerId ? { customer_id: customerId } : undefined;
    const results = await vectorStore.similaritySearch(query, 5, 'customer_notes');

    if (results.length === 0) {
      return "No customer notes found matching your query.";
    }

    return results.map((r, i) => {
      const date = r.document.metadata.date || 'Unknown date';
      return `[Note ${i + 1}] ${date}\n${r.document.content}`;
    }).join('\n\n');
  }
});

/**
 * Schedule Meeting Tool (HITL - requires approval)
 */
export const scheduleMeetingTool = new DynamicStructuredTool({
  name: "schedule_meeting",
  description: `Schedule a meeting with a customer stakeholder. This action requires human approval before execution.
Use this to set up kickoff calls, QBRs, check-ins, or any customer meetings.`,
  schema: z.object({
    attendees: z.array(z.string()).describe("List of attendee emails"),
    title: z.string().describe("Meeting title"),
    description: z.string().describe("Meeting agenda/description"),
    duration: z.number().describe("Duration in minutes (30, 45, 60, etc.)"),
    preferredDays: z.array(z.string()).optional().describe("Preferred days of the week"),
    urgency: z.enum(["low", "medium", "high"]).describe("How urgent is this meeting")
  }),
  func: async ({ attendees, title, description, duration, preferredDays, urgency }) => {
    // In production, this would queue for HITL approval then call Google Calendar API
    const meetingRequest = {
      id: `meeting_${Date.now()}`,
      type: 'schedule_meeting',
      status: 'pending_approval',
      details: { attendees, title, description, duration, preferredDays, urgency },
      createdAt: new Date().toISOString()
    };

    // Store in pending actions (would be database in production)
    return JSON.stringify({
      action: 'MEETING_SCHEDULED_FOR_APPROVAL',
      message: `Meeting "${title}" with ${attendees.join(', ')} has been queued for your approval.`,
      details: meetingRequest,
      requiresApproval: true
    });
  }
});

/**
 * Send Email Tool (HITL - requires approval)
 */
export const sendEmailTool = new DynamicStructuredTool({
  name: "send_email",
  description: `Draft and send an email to a customer. This action requires human approval before sending.
Use this for outreach, follow-ups, check-ins, or any customer communication.`,
  schema: z.object({
    to: z.array(z.string()).describe("Recipient email addresses"),
    cc: z.array(z.string()).optional().describe("CC recipients"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content (can include markdown)"),
    templateType: z.enum(["welcome", "check_in", "renewal", "at_risk", "qbr_invite", "custom"]).describe("Type of email template used")
  }),
  func: async ({ to, cc, subject, body, templateType }) => {
    const emailDraft = {
      id: `email_${Date.now()}`,
      type: 'send_email',
      status: 'pending_approval',
      details: { to, cc, subject, body, templateType },
      createdAt: new Date().toISOString()
    };

    return JSON.stringify({
      action: 'EMAIL_DRAFTED_FOR_APPROVAL',
      message: `Email "${subject}" to ${to.join(', ')} has been drafted and is awaiting your approval.`,
      details: emailDraft,
      requiresApproval: true,
      preview: `To: ${to.join(', ')}\nSubject: ${subject}\n\n${body.substring(0, 200)}...`
    });
  }
});

/**
 * Create Task Tool
 */
export const createTaskTool = new DynamicStructuredTool({
  name: "create_task",
  description: `Create a follow-up task or reminder for the CSM.
Use this to ensure important actions don't fall through the cracks.`,
  schema: z.object({
    title: z.string().describe("Task title"),
    description: z.string().describe("Task description"),
    dueDate: z.string().describe("Due date (ISO format or relative like 'tomorrow', 'next week')"),
    priority: z.enum(["low", "medium", "high", "urgent"]).describe("Task priority"),
    customerId: z.string().optional().describe("Associated customer ID"),
    category: z.enum(["follow_up", "renewal", "risk", "expansion", "onboarding", "other"]).describe("Task category")
  }),
  func: async ({ title, description, dueDate, priority, customerId, category }) => {
    const task = {
      id: `task_${Date.now()}`,
      title,
      description,
      dueDate,
      priority,
      customerId,
      category,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return JSON.stringify({
      action: 'TASK_CREATED',
      message: `Task "${title}" created with ${priority} priority, due ${dueDate}.`,
      task
    });
  }
});

/**
 * Log Activity Tool
 */
export const logActivityTool = new DynamicStructuredTool({
  name: "log_activity",
  description: `Log a customer interaction or activity to the timeline.
Use this after calls, meetings, or any significant customer touchpoint.`,
  schema: z.object({
    customerId: z.string().describe("Customer ID"),
    activityType: z.enum(["call", "email", "meeting", "note", "milestone"]).describe("Type of activity"),
    title: z.string().describe("Activity title/summary"),
    details: z.string().describe("Detailed notes about the interaction"),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional().describe("Overall sentiment of the interaction"),
    nextSteps: z.string().optional().describe("Agreed next steps")
  }),
  func: async ({ customerId, activityType, title, details, sentiment, nextSteps }) => {
    const activity = {
      id: `activity_${Date.now()}`,
      customerId,
      type: activityType,
      title,
      details,
      sentiment,
      nextSteps,
      createdAt: new Date().toISOString()
    };

    // Also add to vector store for future search
    await vectorStore.addDocument(
      `${title}\n${details}\n${nextSteps || ''}`,
      { customer_id: customerId, type: activityType, date: new Date().toISOString() },
      'customer_notes'
    );

    return JSON.stringify({
      action: 'ACTIVITY_LOGGED',
      message: `${activityType} logged for customer: "${title}"`,
      activity
    });
  }
});

/**
 * Calculate Health Score Tool
 */
export const calculateHealthScoreTool = new DynamicStructuredTool({
  name: "calculate_health_score",
  description: `Calculate or analyze a customer's health score based on available data.
Use this to assess customer health and identify risks.`,
  schema: z.object({
    customerId: z.string().describe("Customer ID"),
    usageMetrics: z.object({
      loginFrequency: z.number().optional().describe("Logins per week"),
      featureAdoption: z.number().optional().describe("Percentage of features used"),
      activeUsers: z.number().optional().describe("Number of active users")
    }).optional(),
    engagementMetrics: z.object({
      lastMeetingDays: z.number().optional().describe("Days since last meeting"),
      emailResponseRate: z.number().optional().describe("Email response rate percentage"),
      npsScore: z.number().optional().describe("Latest NPS score")
    }).optional(),
    supportMetrics: z.object({
      openTickets: z.number().optional().describe("Number of open support tickets"),
      avgResolutionTime: z.number().optional().describe("Average ticket resolution time in hours"),
      escalations: z.number().optional().describe("Number of escalations in last 30 days")
    }).optional()
  }),
  func: async ({ customerId, usageMetrics, engagementMetrics, supportMetrics }) => {
    // Calculate component scores
    let usageScore = 70; // Default
    let engagementScore = 70;
    let supportScore = 80;

    if (usageMetrics) {
      usageScore = Math.min(100, Math.max(0,
        (usageMetrics.loginFrequency || 5) * 10 +
        (usageMetrics.featureAdoption || 50) * 0.5 +
        (usageMetrics.activeUsers || 5) * 2
      ));
    }

    if (engagementMetrics) {
      const daysPenalty = Math.min(30, engagementMetrics.lastMeetingDays || 0) * 1;
      engagementScore = Math.min(100, Math.max(0,
        100 - daysPenalty +
        (engagementMetrics.emailResponseRate || 50) * 0.3 +
        ((engagementMetrics.npsScore || 7) - 5) * 5
      ));
    }

    if (supportMetrics) {
      supportScore = Math.min(100, Math.max(0,
        100 -
        (supportMetrics.openTickets || 0) * 5 -
        (supportMetrics.escalations || 0) * 15 -
        Math.max(0, (supportMetrics.avgResolutionTime || 24) - 24) * 0.5
      ));
    }

    // Weighted average
    const overallScore = Math.round(
      usageScore * 0.35 +
      engagementScore * 0.35 +
      supportScore * 0.30
    );

    const riskLevel = overallScore >= 80 ? 'low' : overallScore >= 60 ? 'medium' : 'high';
    const recommendations = [];

    if (usageScore < 60) recommendations.push('Schedule product training session');
    if (engagementScore < 60) recommendations.push('Re-engage with check-in call');
    if (supportScore < 60) recommendations.push('Review open tickets with support team');
    if (overallScore < 50) recommendations.push('URGENT: Escalate to CS leadership');

    return JSON.stringify({
      customerId,
      healthScore: {
        overall: overallScore,
        usage: Math.round(usageScore),
        engagement: Math.round(engagementScore),
        support: Math.round(supportScore)
      },
      riskLevel,
      recommendations,
      calculatedAt: new Date().toISOString()
    });
  }
});

/**
 * Get Today's Calendar Events Tool - REAL Google Calendar integration
 */
export const getTodaysMeetingsTool = new DynamicStructuredTool({
  name: "get_todays_meetings",
  description: `Get today's calendar events/meetings from Google Calendar.
Use this when the user asks about their meetings today, schedule, or wants meeting briefs.`,
  schema: z.object({
    userId: z.string().describe("The user ID for Google Calendar access")
  }),
  func: async ({ userId }) => {
    try {
      if (!userId) {
        return JSON.stringify({
          error: true,
          message: "User ID required for calendar access. Please sign in with Google."
        });
      }

      const events = await calendarService.getTodayEvents(userId);

      if (!events || events.length === 0) {
        return JSON.stringify({
          success: true,
          message: "You have no meetings scheduled for today.",
          meetings: []
        });
      }

      const formattedEvents = events.map((event: any) => ({
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        attendees: event.attendees?.map((a: any) => a.email || a).slice(0, 5) || [],
        meetLink: event.meetLink,
        location: event.location,
        description: event.description?.substring(0, 200)
      }));

      return JSON.stringify({
        success: true,
        message: `You have ${events.length} meeting(s) today.`,
        meetings: formattedEvents
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Failed to fetch calendar: ${(error as Error).message}`
      });
    }
  }
});

/**
 * Get Upcoming Calendar Events Tool
 */
export const getUpcomingMeetingsTool = new DynamicStructuredTool({
  name: "get_upcoming_meetings",
  description: `Get upcoming calendar events/meetings from Google Calendar for the next few days.
Use this when the user asks about upcoming meetings or their schedule.`,
  schema: z.object({
    userId: z.string().describe("The user ID for Google Calendar access"),
    days: z.number().optional().describe("Number of days to look ahead (default 7)")
  }),
  func: async ({ userId, days = 7 }) => {
    try {
      if (!userId) {
        return JSON.stringify({
          error: true,
          message: "User ID required for calendar access."
        });
      }

      const events = await calendarService.getUpcomingEvents(userId, days);

      if (!events || events.length === 0) {
        return JSON.stringify({
          success: true,
          message: `No meetings scheduled in the next ${days} days.`,
          meetings: []
        });
      }

      const formattedEvents = events.map((event: any) => ({
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        attendees: event.attendees?.slice(0, 5) || []
      }));

      return JSON.stringify({
        success: true,
        message: `You have ${events.length} meeting(s) in the next ${days} days.`,
        meetings: formattedEvents
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Failed to fetch calendar: ${(error as Error).message}`
      });
    }
  }
});

/**
 * Get Recent Emails Tool - REAL Gmail integration
 */
export const getRecentEmailsTool = new DynamicStructuredTool({
  name: "get_recent_emails",
  description: `Get recent emails from Gmail inbox.
Use this when the user asks about their emails, inbox, or recent messages.`,
  schema: z.object({
    userId: z.string().describe("The user ID for Gmail access"),
    maxResults: z.number().optional().describe("Maximum number of emails to return (default 10)")
  }),
  func: async ({ userId, maxResults = 10 }) => {
    try {
      if (!userId) {
        return JSON.stringify({
          error: true,
          message: "User ID required for Gmail access."
        });
      }

      const result = await gmailService.listThreads(userId, { maxResults });
      const threads = result.threads;

      if (!threads || threads.length === 0) {
        return JSON.stringify({
          success: true,
          message: "No recent emails found.",
          emails: []
        });
      }

      const formattedEmails = threads.map((thread: any) => ({
        subject: thread.subject,
        snippet: thread.snippet?.substring(0, 150),
        participants: thread.participants?.slice(0, 3),
        date: thread.lastMessageAt,
        isUnread: thread.isUnread
      }));

      return JSON.stringify({
        success: true,
        message: `Found ${threads.length} recent email thread(s).`,
        emails: formattedEmails
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Failed to fetch emails: ${(error as Error).message}`
      });
    }
  }
});

/**
 * Google Drive Search Tool - REAL Google Drive integration
 */
export const googleDriveSearchTool = new DynamicStructuredTool({
  name: "search_google_drive",
  description: `Search for documents in Google Drive.
Use this to find customer-related documents, proposals, contracts, or presentations.`,
  schema: z.object({
    userId: z.string().describe("The user ID for Drive access"),
    query: z.string().describe("Search query for Google Drive"),
    maxResults: z.number().optional().describe("Maximum number of files to return")
  }),
  func: async ({ userId, query, maxResults = 10 }) => {
    try {
      if (!userId) {
        return JSON.stringify({
          error: true,
          message: "User ID required for Drive access."
        });
      }

      const result = await driveService.searchFiles(userId, query, { maxResults });
      const files = result.files;

      if (!files || files.length === 0) {
        return JSON.stringify({
          success: true,
          message: `No files found matching "${query}".`,
          files: []
        });
      }

      const formattedFiles = files.map((file: any) => ({
        name: file.name,
        type: file.mimeType,
        link: file.webViewLink,
        modifiedTime: file.modifiedTime
      }));

      return JSON.stringify({
        success: true,
        message: `Found ${files.length} file(s) matching "${query}".`,
        files: formattedFiles
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Failed to search Drive: ${(error as Error).message}`
      });
    }
  }
});

/**
 * Get Customer Summary Tool
 */
export const getCustomerSummaryTool = new DynamicStructuredTool({
  name: "get_customer_summary",
  description: `Get a comprehensive summary of a customer including key metrics, recent activity, and important context.
Use this to quickly get up to speed on a customer before an interaction.`,
  schema: z.object({
    customerId: z.string().describe("Customer ID to get summary for"),
    includeHistory: z.boolean().optional().describe("Include recent activity history")
  }),
  func: async ({ customerId, includeHistory }) => {
    // In production, this would fetch from database
    // For now, return a structured summary template
    return JSON.stringify({
      action: 'CUSTOMER_SUMMARY',
      message: `Fetching summary for customer ${customerId}...`,
      note: 'Connect to database to get real customer data',
      templateFields: [
        'name', 'arr', 'healthScore', 'status', 'renewalDate',
        'primaryContact', 'csm', 'recentActivities', 'openTasks', 'risks'
      ]
    });
  }
});

// Export all tools as an array
export const allTools = [
  knowledgeBaseSearchTool,
  contractSearchTool,
  customerNotesSearchTool,
  scheduleMeetingTool,
  sendEmailTool,
  createTaskTool,
  logActivityTool,
  calculateHealthScoreTool,
  googleDriveSearchTool,
  getCustomerSummaryTool,
  // Google Workspace tools
  getTodaysMeetingsTool,
  getUpcomingMeetingsTool,
  getRecentEmailsTool
];

// Export tools grouped by category
export const searchTools = [
  knowledgeBaseSearchTool,
  contractSearchTool,
  customerNotesSearchTool,
  googleDriveSearchTool,
  getRecentEmailsTool
];

// Google Workspace tools
export const googleWorkspaceTools = [
  getTodaysMeetingsTool,
  getUpcomingMeetingsTool,
  getRecentEmailsTool,
  googleDriveSearchTool
];

export const actionTools = [
  scheduleMeetingTool,
  sendEmailTool,
  createTaskTool,
  logActivityTool
];

export const analysisTools = [
  calculateHealthScoreTool,
  getCustomerSummaryTool
];
