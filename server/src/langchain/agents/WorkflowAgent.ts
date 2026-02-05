/**
 * LangGraph Workflow Agent
 * Uses Claude's native tool calling with LangGraph state management
 * Includes human-in-the-loop approval checkpoints for actions
 */

import Anthropic from '@anthropic-ai/sdk';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { config } from '../../config/index.js';
import { approvalService, ActionType } from '../../services/approval.js';
import { calendarService } from '../../services/google/calendar.js';
import { gmailService } from '../../services/google/gmail.js';
import { driveService } from '../../services/google/drive.js';
import { docsService } from '../../services/google/docs.js';
import { sheetsService } from '../../services/google/sheets.js';
import { slidesService } from '../../services/google/slides.js';
import { knowledgeService } from '../../services/knowledge.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for agent queries
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Response Cleanup - Remove spurious placeholder text
// ============================================

/**
 * Clean up AI responses that may contain placeholder patterns
 * This happens occasionally when the model outputs template text incorrectly
 * Patterns seen: _PLACEHOLDER0__, PLACEHOLDER1_, _PLACEHOLDER0_, PLACEHOLDER2__
 */
function cleanResponseText(text: string): string {
  // Check if there are any placeholder patterns
  const hasPlaceholders = /PLACEHOLDER/i.test(text);
  if (hasPlaceholders) {
    console.log('🧹 cleanResponseText: Found placeholders in response, cleaning...');
    console.log('🧹 Before:', text.substring(0, 500));
  }

  const cleaned = text
    // Remove ALL placeholder patterns (with or without leading underscore)
    .replace(/_*PLACEHOLDER\d+_*/gi, '')
    // Remove bold placeholder patterns
    .replace(/\*\*_*PLACEHOLDER\d+_*\*\*/gi, '')
    // Clean up emoji + placeholder combinations
    .replace(/([⚡✅📄🔗📊📈📉🎯])\s*_*PLACEHOLDER\d+_*/gi, '$1')
    // Remove any remaining standalone placeholder patterns
    .replace(/\bPLACEHOLDER\d*\b_*/gi, '')
    // Clean up numbered list items that became empty
    .replace(/^\d+\.\s*$/gm, '')
    // Clean up bullet points that became empty
    .replace(/^[-•]\s*$/gm, '')
    // Clean up resulting double spaces
    .replace(/\s{2,}/g, ' ')
    // Clean up multiple newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Clean up lines that are just whitespace
    .replace(/^\s+$/gm, '')
    .trim();

  if (hasPlaceholders) {
    const stillHasPlaceholders = /PLACEHOLDER/i.test(cleaned);
    console.log('🧹 After:', cleaned.substring(0, 500));
    console.log('🧹 Still has placeholders:', stillHasPlaceholders);
  }

  return cleaned;
}

// ============================================
// CSCX.AI System Prompt - General Purpose Claude
// ============================================

const CSCX_SYSTEM_PROMPT = `You are Claude, an AI assistant created by Anthropic, integrated into CSCX.AI. You are helpful, harmless, and honest. You have broad knowledge and capabilities spanning virtually any topic or task.

## CORE IDENTITY
- You are Claude, a highly capable AI assistant created by Anthropic
- You are integrated into CSCX.AI to serve users with intelligence, accuracy, and care
- You aim to be genuinely helpful while being safe and ethical

## CAPABILITIES
You can assist users with a wide range of tasks including:

**Knowledge & Research** - Answering questions, explaining concepts, research synthesis
**Writing & Communication** - Emails, reports, articles, editing, creative writing
**Coding & Technical** - Writing/debugging code, architecture, documentation
**Analysis & Problem-Solving** - Data analysis, calculations, strategic thinking
**Creative & Ideation** - Brainstorming, content creation, design feedback
**Professional & Personal** - Career advice, project planning, decision frameworks

## BEHAVIOR GUIDELINES

**Helpfulness** - Be genuinely helpful, provide substantive responses, anticipate needs

**Accuracy & Honesty** - Be accurate, indicate uncertainty, don't make up facts, correct errors

**Communication Style**
- Match tone to user's style
- Be concise by default, thorough when needed
- Use clear, natural language
- Don't be sycophantic or excessively flattering
- Be direct without being curt

**Data Display**
- When displaying file names, document titles, email subjects, or any user data from tools, show the EXACT names as returned - never redact, anonymize, or replace with placeholders
- The user is viewing their own data and expects to see actual names
- NEVER use placeholder text like "_PLACEHOLDER0__" or similar patterns in your responses
- Always write out complete formulas, lists, and content - do not use placeholder substitution

**Formatting**
- Use markdown formatting when it aids clarity
- Use code blocks with syntax highlighting for code
- Don't over-format casual conversational responses

## RESPONSE APPROACH
- For simple questions: respond directly and concisely
- For complex questions: think step-by-step, structure logically
- For coding: write clean, commented code with best practices
- For writing: match requested tone, provide complete drafts
- For research: synthesize clearly, present multiple perspectives`;

// ============================================
// Types
// ============================================

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

interface PendingAction {
  toolCall: ToolCall;
  approvalId?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'executed';
}

// State annotation for LangGraph
const AgentState = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  userId: Annotation<string>(),
  customerContext: Annotation<Record<string, any>>(),
  pendingActions: Annotation<PendingAction[]>({
    reducer: (current, update) => update,
    default: () => []
  }),
  toolResults: Annotation<Record<string, any>[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  response: Annotation<string>({
    reducer: (_, update) => update,
    default: () => ''
  }),
  requiresApproval: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false
  })
});

type AgentStateType = typeof AgentState.State;

// ============================================
// Tool Definitions for Claude
// ============================================

// Built-in Anthropic tools (web search)
const ANTHROPIC_BUILTIN_TOOLS = [
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5
  }
];

const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_todays_meetings',
    description: 'Get all calendar events/meetings for today. Use when the user asks about their schedule, meetings today, or daily agenda.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'get_upcoming_meetings',
    description: 'Get upcoming calendar events for the next N days. Use when user asks about upcoming meetings, schedule this week, or future events.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look ahead (default 7)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_recent_emails',
    description: 'Get recent email threads from Gmail. Use when user asks about emails, inbox, or recent messages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of email threads to return (default 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'schedule_meeting',
    description: 'Schedule a new calendar meeting. REQUIRES USER APPROVAL before execution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Meeting title'
        },
        description: {
          type: 'string',
          description: 'Meeting description or agenda'
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee email addresses'
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO format or natural language (e.g., "tomorrow at 2pm")'
        },
        durationMinutes: {
          type: 'number',
          description: 'Meeting duration in minutes (default 30)'
        }
      },
      required: ['title', 'startTime']
    }
  },
  {
    name: 'draft_email',
    description: 'Draft an email to send. REQUIRES USER APPROVAL before sending. Always ask for the recipient email if not provided.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipient email addresses (required)'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text or HTML)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'create_task',
    description: 'Create a follow-up task or reminder. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Task title'
        },
        notes: {
          type: 'string',
          description: 'Task description or notes'
        },
        dueDate: {
          type: 'string',
          description: 'Due date (e.g., "tomorrow", "next week", "2024-01-15")'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Task priority'
        }
      },
      required: ['title']
    }
  },
  // ============================================
  // Google Drive Tools
  // ============================================
  {
    name: 'get_recent_files',
    description: 'Get recently modified files from Google Drive. Use when user asks about recent documents, files, or Drive activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of files to return (default 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'search_files',
    description: 'Search for files in Google Drive by name or content. Use when user asks to find a document or file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (file name or content keywords)'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_folders',
    description: 'List folders in Google Drive. Use when user asks about their folder structure or where files are.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parentId: {
          type: 'string',
          description: 'Parent folder ID (omit for root)'
        }
      },
      required: []
    }
  },
  // ============================================
  // Google Docs Tools
  // ============================================
  {
    name: 'create_document',
    description: 'Create a new Google Doc from a template or blank. REQUIRES USER APPROVAL. Use for onboarding plans, meeting notes, QBR reports.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Document title'
        },
        template: {
          type: 'string',
          enum: ['blank', 'qbr_report', 'meeting_notes', 'onboarding_plan', 'success_plan', 'renewal_proposal'],
          description: 'Template to use (default: blank)'
        },
        variables: {
          type: 'object',
          description: 'Variables to replace in template (e.g., {customer_name: "Acme Inc"})'
        },
        folderId: {
          type: 'string',
          description: 'Folder ID to save document in (optional)'
        }
      },
      required: ['title']
    }
  },
  // ============================================
  // Google Sheets Tools
  // ============================================
  {
    name: 'create_spreadsheet',
    description: 'Create a new Google Sheet from a template or blank. REQUIRES USER APPROVAL. Use for tracking, metrics, health scores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Spreadsheet title'
        },
        template: {
          type: 'string',
          enum: ['blank', 'health_tracker', 'renewal_tracker', 'onboarding_tracker', 'usage_metrics', 'customer_scorecard'],
          description: 'Template to use (default: blank)'
        },
        variables: {
          type: 'object',
          description: 'Variables to replace in template'
        },
        folderId: {
          type: 'string',
          description: 'Folder ID to save spreadsheet in (optional)'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email immediately. REQUIRES USER APPROVAL. Use when user explicitly wants to send (not just draft) an email.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipient email addresses'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        body: {
          type: 'string',
          description: 'Email body (HTML or plain text)'
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'CC recipients (optional)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  // ============================================
  // Knowledge Base Tools
  // ============================================
  {
    name: 'search_knowledge',
    description: 'Search the CSM knowledge base for playbooks, best practices, templates, and CSM guidance. Use this when users ask about CSM concepts, processes, or need specific playbook steps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "EBR preparation", "health score triage", "onboarding playbook")'
        },
        category: {
          type: 'string',
          enum: ['playbooks', 'health-scoring', 'onboarding', 'ebr', 'metrics', 'templates', 'risk-management', 'foundations'],
          description: 'Optional category to filter results'
        }
      },
      required: ['query']
    }
  },
  // ============================================
  // Extended Google Calendar Tools
  // ============================================
  {
    name: 'get_availability',
    description: 'Check free/busy times for scheduling. Returns available time slots.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: { type: 'string', description: 'Start date (ISO format or natural language)' },
        endDate: { type: 'string', description: 'End date (ISO format or natural language)' },
        durationMinutes: { type: 'number', description: 'Desired meeting duration in minutes (default 30)' }
      },
      required: ['startDate', 'endDate']
    }
  },
  {
    name: 'list_calendars',
    description: 'Get list of all calendars the user has access to.',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  // ============================================
  // Extended Gmail Tools
  // ============================================
  {
    name: 'search_emails',
    description: 'Search emails using Gmail query syntax. Use for finding specific emails.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (e.g., "from:john@example.com", "subject:meeting", "is:unread")' },
        maxResults: { type: 'number', description: 'Maximum results (default 10)' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_email_thread',
    description: 'Get a specific email thread by ID with all messages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threadId: { type: 'string', description: 'Gmail thread ID' }
      },
      required: ['threadId']
    }
  },
  {
    name: 'get_unread_emails',
    description: 'Get all unread emails.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'number', description: 'Maximum results (default 20)' }
      },
      required: []
    }
  },
  {
    name: 'get_email_labels',
    description: 'Get all Gmail labels/folders.',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  // ============================================
  // Extended Google Drive Tools
  // ============================================
  {
    name: 'get_file_content',
    description: 'Get the content of a Google Doc, Sheet, or other file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'get_documents',
    description: 'List all Google Docs in Drive.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'number', description: 'Maximum results (default 50)' }
      },
      required: []
    }
  },
  {
    name: 'get_spreadsheets',
    description: 'List all Google Sheets in Drive.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'number', description: 'Maximum results (default 50)' }
      },
      required: []
    }
  },
  {
    name: 'get_presentations',
    description: 'List all Google Slides presentations in Drive.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'number', description: 'Maximum results (default 50)' }
      },
      required: []
    }
  },
  // ============================================
  // Google Sheets Read Tools
  // ============================================
  {
    name: 'get_spreadsheet_data',
    description: 'Read data from a Google Sheet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
        range: { type: 'string', description: 'Cell range (e.g., "Sheet1!A1:D10")' }
      },
      required: ['spreadsheetId', 'range']
    }
  },
  // ============================================
  // Google Docs Read Tools
  // ============================================
  {
    name: 'get_document',
    description: 'Get a Google Doc content and metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        documentId: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['documentId']
    }
  },
  // ============================================
  // Google Slides Tools
  // ============================================
  {
    name: 'get_presentation',
    description: 'Get a Google Slides presentation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        presentationId: { type: 'string', description: 'Presentation ID' }
      },
      required: ['presentationId']
    }
  },
  {
    name: 'create_presentation',
    description: 'Create a new Google Slides presentation. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Presentation title' },
        template: {
          type: 'string',
          enum: ['blank', 'qbr_deck', 'kickoff_deck', 'training_deck', 'executive_briefing'],
          description: 'Template to use'
        },
        variables: { type: 'object', description: 'Variables to replace in template' },
        folderId: { type: 'string', description: 'Folder ID to save in (optional)' }
      },
      required: ['title']
    }
  },
  // ============================================
  // Google Sheets Update Tools (Requires Approval)
  // ============================================
  {
    name: 'update_spreadsheet',
    description: 'Update data in a Google Sheet. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
        range: { type: 'string', description: 'Cell range (e.g., "Sheet1!A1:D10")' },
        values: { type: 'array', description: 'Array of row arrays with values' }
      },
      required: ['spreadsheetId', 'range', 'values']
    }
  },
  {
    name: 'append_to_spreadsheet',
    description: 'Append a row to a Google Sheet. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
        sheetName: { type: 'string', description: 'Sheet/tab name' },
        values: { type: 'array', description: 'Row values to append' }
      },
      required: ['spreadsheetId', 'sheetName', 'values']
    }
  },
  // ============================================
  // Google Apps Script Tools
  // ============================================
  {
    name: 'generate_appscript',
    description: 'Generate a Google Apps Script that can be deployed to a spreadsheet. Use for automation like data processing, chart creation, email triggers, etc. Returns the script code for the user to deploy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        purpose: { type: 'string', description: 'What the script should do (e.g., "create a chart from data in column A and B", "send email when cell changes")' },
        spreadsheetId: { type: 'string', description: 'Target spreadsheet ID (optional)' },
        sheetName: { type: 'string', description: 'Target sheet name (optional)' },
        dataRange: { type: 'string', description: 'Data range for charts/processing (e.g., "A1:B10")' }
      },
      required: ['purpose']
    }
  },
  {
    name: 'create_chart_slide',
    description: 'Create a Google Slides presentation with a chart from spreadsheet data. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Presentation title' },
        spreadsheetId: { type: 'string', description: 'Source spreadsheet ID' },
        dataRange: { type: 'string', description: 'Data range (e.g., "Sheet1!A1:B10")' },
        chartType: { type: 'string', enum: ['BAR', 'LINE', 'PIE', 'COLUMN', 'AREA'], description: 'Chart type' },
        chartTitle: { type: 'string', description: 'Chart title' }
      },
      required: ['title', 'spreadsheetId', 'dataRange', 'chartType']
    }
  },
  // ============================================
  // ONBOARDING AGENT TOOLS
  // ============================================
  {
    name: 'onboarding_kickoff',
    description: 'Schedule a kickoff meeting for a new customer. Creates calendar event with all stakeholders and generates kickoff deck. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        title: { type: 'string', description: 'Meeting title (default: "Kickoff Meeting")' },
        date: { type: 'string', description: 'Preferred date/time (ISO format or natural language)' },
        duration: { type: 'number', description: 'Duration in minutes (default: 60)' },
        includeKickoffDeck: { type: 'boolean', description: 'Create kickoff presentation (default: true)' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'onboarding_30_60_90_plan',
    description: 'Generate a 30-60-90 day onboarding plan for a customer. Creates Google Doc with milestones and tracking sheet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        segment: { type: 'string', enum: ['smb', 'commercial', 'enterprise', 'strategic'], description: 'Customer segment' },
        contractGoals: { type: 'array', items: { type: 'string' }, description: 'Goals from contract' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'onboarding_stakeholder_map',
    description: 'Create a stakeholder map for a customer. Identifies champions, decision makers, and blockers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'onboarding_welcome_sequence',
    description: 'Create a welcome email sequence for new customer. Generates 5 draft emails (Day 1, 3, 7, 14, 30). REQUIRES USER APPROVAL to send.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        stakeholderEmails: { type: 'array', items: { type: 'string' }, description: 'Email addresses of stakeholders' }
      },
      required: ['customerId']
    }
  },
  // ============================================
  // ADOPTION AGENT TOOLS
  // ============================================
  {
    name: 'adoption_usage_analysis',
    description: 'Analyze product usage metrics for a customer. Queries usage_metrics table and generates report.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        period: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Analysis period (default: 30d)' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'adoption_campaign',
    description: 'Create an adoption campaign for underutilized features. Generates email sequence and tracking sheet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        features: { type: 'array', items: { type: 'string' }, description: 'Features to promote' },
        campaignType: { type: 'string', enum: ['email', 'in-app', 'both'], description: 'Campaign type' }
      },
      required: ['customerId', 'features']
    }
  },
  {
    name: 'adoption_feature_training',
    description: 'Schedule feature training sessions. Creates calendar events and training materials.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        features: { type: 'array', items: { type: 'string' }, description: 'Features to train on' },
        trainingType: { type: 'string', enum: ['admin', 'end-user', 'advanced'], description: 'Training level' }
      },
      required: ['customerId', 'features']
    }
  },
  {
    name: 'adoption_champion_program',
    description: 'Identify and develop customer champions based on usage data. Returns top users and creates nurture sequence.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        minUsage: { type: 'number', description: 'Minimum usage threshold to qualify' }
      },
      required: ['customerId']
    }
  },
  // ============================================
  // RENEWAL AGENT TOOLS
  // ============================================
  {
    name: 'renewal_forecast',
    description: 'Generate renewal forecast for a customer or portfolio. Queries renewal_pipeline table.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID (omit for portfolio view)' },
        timeframe: { type: 'string', enum: ['30d', '60d', '90d', 'quarter', 'year'], description: 'Forecast timeframe' }
      },
      required: []
    }
  },
  {
    name: 'renewal_value_summary',
    description: 'Create a value summary document showing ROI and impact delivered. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        includeMetrics: { type: 'array', items: { type: 'string' }, description: 'Metrics to highlight' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'renewal_expansion_analysis',
    description: 'Identify expansion opportunities for a customer. Queries expansion_opportunities table.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        includeCompetitive: { type: 'boolean', description: 'Include competitive analysis' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'renewal_playbook_start',
    description: 'Start the 120-day renewal playbook for a customer. Creates tasks and tracking.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        renewalDate: { type: 'string', description: 'Expected renewal date' }
      },
      required: ['customerId']
    }
  },
  // ============================================
  // RISK AGENT TOOLS
  // ============================================
  {
    name: 'risk_assessment',
    description: 'Run a comprehensive risk assessment for a customer. Analyzes health score, usage trends, and risk signals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        includeRecommendations: { type: 'boolean', description: 'Include recommended actions' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'risk_save_play',
    description: 'Create a save play for an at-risk customer. Generates action plan and documents. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        riskLevel: { type: 'string', enum: ['medium', 'high', 'critical'], description: 'Risk severity' },
        primaryIssue: { type: 'string', description: 'Main issue to address' },
        rootCause: { type: 'string', description: 'Root cause analysis' }
      },
      required: ['customerId', 'riskLevel', 'primaryIssue']
    }
  },
  {
    name: 'risk_escalation',
    description: 'Escalate a customer issue to management. Creates escalation record and notifies stakeholders. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        escalationLevel: { type: 'number', enum: [1, 2, 3], description: '1=Manager, 2=Director, 3=VP' },
        reason: { type: 'string', description: 'Escalation reason' },
        arrAtRisk: { type: 'number', description: 'ARR at risk amount' }
      },
      required: ['customerId', 'escalationLevel', 'reason']
    }
  },
  {
    name: 'risk_health_check',
    description: 'Perform a deep health check on a customer. Analyzes all PROVE dimensions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        dimensions: {
          type: 'array',
          items: { type: 'string', enum: ['product', 'risk', 'outcomes', 'voice', 'engagement'] },
          description: 'PROVE dimensions to analyze (default: all)'
        }
      },
      required: ['customerId']
    }
  },
  // ============================================
  // STRATEGIC AGENT TOOLS
  // ============================================
  {
    name: 'strategic_qbr_prep',
    description: 'Prepare QBR materials for a customer. Creates presentation, metrics sheet, and prep checklist. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'], description: 'Quarter' },
        year: { type: 'number', description: 'Year (e.g., 2026)' },
        includeRoadmap: { type: 'boolean', description: 'Include product roadmap discussion' }
      },
      required: ['customerId', 'quarter', 'year']
    }
  },
  {
    name: 'strategic_exec_briefing',
    description: 'Create an executive briefing document for leadership meeting. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        briefingType: { type: 'string', enum: ['internal', 'customer-facing'], description: 'Audience type' },
        focusAreas: { type: 'array', items: { type: 'string' }, description: 'Key topics to cover' }
      },
      required: ['customerId']
    }
  },
  {
    name: 'strategic_account_plan',
    description: 'Generate or update the strategic account plan for a customer. REQUIRES USER APPROVAL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        fiscalYear: { type: 'string', description: 'Fiscal year (e.g., FY2026)' },
        objectives: { type: 'array', items: { type: 'string' }, description: 'Strategic objectives' }
      },
      required: ['customerId', 'fiscalYear']
    }
  },
  {
    name: 'strategic_success_plan',
    description: 'Create a strategic success plan aligned with customer business goals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerId: { type: 'string', description: 'Customer UUID' },
        businessGoals: { type: 'array', items: { type: 'string' }, description: 'Customer business goals' },
        successMetrics: { type: 'array', items: { type: 'string' }, description: 'How success will be measured' }
      },
      required: ['customerId', 'businessGoals']
    }
  }
];

// Tools that require approval before execution
const APPROVAL_REQUIRED_TOOLS = [
  'schedule_meeting', 'draft_email', 'create_task', 'create_document',
  'create_spreadsheet', 'send_email', 'create_presentation',
  'update_spreadsheet', 'append_to_spreadsheet', 'create_chart_slide',
  // Agent-specific tools that create documents or send communications
  'onboarding_kickoff', 'onboarding_welcome_sequence',
  'renewal_value_summary',
  'risk_save_play', 'risk_escalation',
  'strategic_qbr_prep', 'strategic_exec_briefing', 'strategic_account_plan'
];

// Read-only tool that returns code for user to deploy (no approval needed)
const CODE_GENERATION_TOOLS = ['generate_appscript'];

// ============================================
// Claude Client
// ============================================

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey
});

// ============================================
// Tool Execution Functions
// ============================================

async function executeReadOnlyTool(
  toolName: string,
  input: Record<string, any>,
  userId: string,
  options?: { useKnowledgeBase?: boolean }
): Promise<any> {
  switch (toolName) {
    case 'get_todays_meetings': {
      const events = await calendarService.getTodayEvents(userId);
      return {
        success: true,
        meetings: events.map((e: any) => ({
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          attendees: e.attendees?.slice(0, 5),
          meetLink: e.meetLink,
          calendarLink: e.htmlLink || `https://calendar.google.com/calendar/event?eid=${e.id}`
        })),
        note: 'Each meeting has "meetLink" for Google Meet and "calendarLink" to open in Google Calendar'
      };
    }

    case 'get_upcoming_meetings': {
      const days = input.days || 7;
      const events = await calendarService.getUpcomingEvents(userId, days);
      return {
        success: true,
        meetings: events.map((e: any) => ({
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          attendees: e.attendees?.slice(0, 5),
          meetLink: e.meetLink,
          calendarLink: e.htmlLink || `https://calendar.google.com/calendar/event?eid=${e.id}`
        })),
        note: 'Each meeting has "meetLink" for Google Meet and "calendarLink" to open in Google Calendar'
      };
    }

    case 'get_recent_emails': {
      const maxResults = input.maxResults || 10;
      const result = await gmailService.listThreads(userId, { maxResults });
      return {
        success: true,
        emails: result.threads.map((t: any) => ({
          subject: t.subject,
          snippet: t.snippet?.substring(0, 150),
          participants: t.participants?.slice(0, 3),
          isUnread: t.isUnread
        }))
      };
    }

    // ============================================
    // Google Drive Read-Only Tools
    // ============================================
    case 'get_recent_files': {
      const maxResults = input.maxResults || 10;
      const files = await driveService.getRecentFiles(userId, maxResults);
      return {
        success: true,
        files: files.map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink
        }))
      };
    }

    case 'search_files': {
      const { query, maxResults = 10 } = input;
      const result = await driveService.searchFiles(userId, query, { maxResults });
      return {
        success: true,
        files: result.files.map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink: f.webViewLink
        }))
      };
    }

    case 'list_folders': {
      const folders = await driveService.listFolders(userId, input.parentId);
      return {
        success: true,
        folders: folders.map((f: any) => ({
          id: f.id,
          name: f.name
        }))
      };
    }

    // ============================================
    // Knowledge Base Tools
    // ============================================
    case 'search_knowledge': {
      // Check if knowledge base is disabled
      if (options?.useKnowledgeBase === false) {
        return {
          success: false,
          error: 'Knowledge base is currently disabled',
          results: [],
          totalFound: 0
        };
      }
      const { query, category } = input;
      const results = await knowledgeService.search(query, {
        layer: 'universal',
        category,
        limit: 5,
        threshold: 0.6
      });
      return {
        success: true,
        results: results.map((r: any) => ({
          title: r.documentTitle,
          content: r.content,
          category: r.documentLayer,
          similarity: r.similarity
        })),
        totalFound: results.length
      };
    }

    // ============================================
    // Extended Calendar Tools
    // ============================================
    case 'get_availability': {
      const { startDate, endDate, durationMinutes = 30 } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const slots = await calendarService.findAvailableSlots(userId, {
        timeMin: start,
        timeMax: end,
        duration: durationMinutes
      });
      return {
        success: true,
        availableSlots: slots.map((s: any) => ({
          start: s.start,
          end: s.end
        }))
      };
    }

    case 'list_calendars': {
      const calendars = await calendarService.getCalendarList(userId);
      return { success: true, calendars };
    }

    // ============================================
    // Extended Gmail Tools
    // ============================================
    case 'search_emails': {
      const { query, maxResults = 10 } = input;
      const results = await gmailService.searchEmails(userId, query, maxResults);
      return {
        success: true,
        emails: results.map((e: any) => ({
          id: e.threadId,
          subject: e.subject,
          snippet: e.snippet?.substring(0, 150),
          from: e.from,
          date: e.date,
          isUnread: e.isUnread
        }))
      };
    }

    case 'get_email_thread': {
      const { threadId } = input;
      const result = await gmailService.getThread(userId, threadId);
      return {
        success: true,
        thread: {
          id: result.thread.id,
          subject: result.thread.subject,
          messages: result.messages?.map((m: any) => ({
            from: m.from,
            to: m.to,
            date: m.date,
            body: m.body?.substring(0, 2000)
          }))
        }
      };
    }

    case 'get_unread_emails': {
      const { maxResults = 20 } = input;
      const emails = await gmailService.getUnreadEmails(userId, maxResults);
      return {
        success: true,
        emails: emails.map((e: any) => ({
          id: e.threadId,
          subject: e.subject,
          snippet: e.snippet?.substring(0, 150),
          from: e.from
        }))
      };
    }

    case 'get_email_labels': {
      const labels = await gmailService.getLabels(userId);
      return { success: true, labels };
    }

    // ============================================
    // Extended Drive Tools
    // ============================================
    case 'get_file_content': {
      const { fileId } = input;
      const content = await driveService.getFileContent(userId, fileId);
      return {
        success: true,
        content: {
          mimeType: content.mimeType,
          text: content.text?.substring(0, 5000),
          title: content.title
        }
      };
    }

    case 'get_documents': {
      const { maxResults = 50 } = input;
      const docs = await driveService.getDocuments(userId, maxResults);
      return {
        success: true,
        documents: docs.map((d: any) => ({
          id: d.id,
          name: d.name,
          modifiedTime: d.modifiedTime,
          link: d.webViewLink || `https://docs.google.com/document/d/${d.id}`
        })),
        note: 'Each document has a "link" field that opens directly in Google Docs'
      };
    }

    case 'get_spreadsheets': {
      const { maxResults = 50 } = input;
      const sheets = await driveService.getSpreadsheets(userId, maxResults);
      return {
        success: true,
        spreadsheets: sheets.map((s: any) => ({
          id: s.id,
          name: s.name,
          modifiedTime: s.modifiedTime,
          link: s.webViewLink || `https://docs.google.com/spreadsheets/d/${s.id}`
        })),
        note: 'Each spreadsheet has a "link" field that opens directly in Google Sheets'
      };
    }

    case 'get_presentations': {
      const { maxResults = 50 } = input;
      const presentations = await driveService.getPresentations(userId, maxResults);
      return {
        success: true,
        presentations: presentations.map((p: any) => ({
          id: p.id,
          name: p.name,
          modifiedTime: p.modifiedTime,
          link: p.webViewLink || `https://docs.google.com/presentation/d/${p.id}`
        })),
        note: 'Each presentation has a "link" field that opens directly in Google Slides'
      };
    }

    // ============================================
    // Sheets Read Tools
    // ============================================
    case 'get_spreadsheet_data': {
      const { spreadsheetId, range } = input;
      const data = await sheetsService.getValues(userId, spreadsheetId, range);
      return {
        success: true,
        data: {
          range: data.range,
          values: data.values
        }
      };
    }

    // ============================================
    // Docs Read Tools
    // ============================================
    case 'get_document': {
      const { documentId } = input;
      const doc = await docsService.getDocument(userId, documentId);
      return {
        success: true,
        document: {
          id: doc.id,
          title: doc.title,
          content: doc.content?.substring(0, 5000)
        }
      };
    }

    // ============================================
    // Slides Read Tools
    // ============================================
    case 'get_presentation': {
      const { presentationId } = input;
      const presentation = await slidesService.getPresentation(userId, presentationId);
      return {
        success: true,
        presentation: {
          id: presentation.id,
          title: presentation.title,
          slideCount: presentation.slides?.length || 0
        }
      };
    }

    // ============================================
    // ONBOARDING AGENT TOOLS (Read-Only)
    // ============================================
    case 'onboarding_30_60_90_plan': {
      const { customerId, segment, contractGoals } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get customer data
      const { data: customer } = await supabase
        .from('customers')
        .select('*, stakeholders(*), contracts(*)')
        .eq('id', customerId)
        .single();

      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Search knowledge base for onboarding playbook
      const kbResults = await knowledgeService.search('30 60 90 day onboarding plan framework', {
        layer: 'universal',
        category: 'onboarding',
        limit: 3
      });

      const customerSegment = segment || customer.segment || 'commercial';
      const goals = contractGoals || customer.contracts?.[0]?.goals || [];

      return {
        success: true,
        plan: {
          customer: { name: customer.name, segment: customerSegment, arr: customer.arr },
          phases: [
            {
              name: 'Days 1-30: Foundation',
              goals: ['Complete kickoff', 'Define success criteria', 'Initial training'],
              milestones: [
                'Kickoff meeting completed',
                'Admin users trained',
                'Success metrics agreed'
              ]
            },
            {
              name: 'Days 31-60: Adoption',
              goals: ['Expand user base', 'Feature adoption', 'First value realization'],
              milestones: [
                '50% user activation',
                'Core workflows configured',
                'First ROI documented'
              ]
            },
            {
              name: 'Days 61-90: Optimization',
              goals: ['Full adoption', 'Advanced features', 'Prepare for steady state'],
              milestones: [
                '80% user activation',
                'All integrations live',
                'QBR scheduled'
              ]
            }
          ],
          contractGoals: goals,
          knowledgeBase: kbResults.map(r => ({ title: r.documentTitle, excerpt: r.content?.substring(0, 200) }))
        },
        note: 'Use create_document with template "onboarding_plan" to generate the full document'
      };
    }

    case 'onboarding_stakeholder_map': {
      const { customerId } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get stakeholders for customer
      const { data: stakeholders } = await supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId);

      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();

      if (!stakeholders) {
        return { success: false, error: 'No stakeholders found' };
      }

      // Categorize stakeholders
      const champions = stakeholders.filter(s => s.role?.toLowerCase().includes('champion') || s.is_champion);
      const decisionMakers = stakeholders.filter(s =>
        s.role?.toLowerCase().includes('executive') ||
        s.role?.toLowerCase().includes('vp') ||
        s.role?.toLowerCase().includes('director')
      );
      const primaryContacts = stakeholders.filter(s => s.is_primary_contact);

      return {
        success: true,
        stakeholderMap: {
          customer: customer?.name,
          totalStakeholders: stakeholders.length,
          champions: champions.map(s => ({ name: s.name, title: s.title, email: s.email })),
          decisionMakers: decisionMakers.map(s => ({ name: s.name, title: s.title, email: s.email })),
          primaryContacts: primaryContacts.map(s => ({ name: s.name, title: s.title, email: s.email })),
          allStakeholders: stakeholders.map(s => ({
            name: s.name,
            title: s.title,
            email: s.email,
            role: s.role,
            influence: s.influence_level
          }))
        }
      };
    }

    // ============================================
    // ADOPTION AGENT TOOLS (Read-Only)
    // ============================================
    case 'adoption_usage_analysis': {
      const { customerId, period = '30d' } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Query usage metrics
      const { data: metrics } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .order('metric_date', { ascending: false });

      const { data: customer } = await supabase
        .from('customers')
        .select('name, health_score, arr')
        .eq('id', customerId)
        .single();

      if (!metrics || metrics.length === 0) {
        return { success: false, error: 'No usage data found for this period' };
      }

      // Calculate trends
      const latestMetric = metrics[0];
      const oldestMetric = metrics[metrics.length - 1];
      const dauTrend = latestMetric.dau - oldestMetric.dau;
      const mauTrend = latestMetric.mau - oldestMetric.mau;

      // Calculate averages
      const avgDau = Math.round(metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / metrics.length);
      const avgMau = Math.round(metrics.reduce((sum, m) => sum + (m.mau || 0), 0) / metrics.length);
      const avgAdoptionScore = Math.round(metrics.reduce((sum, m) => sum + (m.adoption_score || 0), 0) / metrics.length);

      return {
        success: true,
        usageAnalysis: {
          customer: customer?.name,
          period: `Last ${days} days`,
          currentMetrics: {
            dau: latestMetric.dau,
            wau: latestMetric.wau,
            mau: latestMetric.mau,
            adoptionScore: latestMetric.adoption_score,
            usageTrend: latestMetric.usage_trend
          },
          trends: {
            dauChange: dauTrend,
            mauChange: mauTrend,
            direction: dauTrend > 0 ? 'growing' : dauTrend < 0 ? 'declining' : 'stable'
          },
          averages: { avgDau, avgMau, avgAdoptionScore },
          featureAdoption: latestMetric.feature_adoption || {},
          healthScore: customer?.health_score,
          dataPoints: metrics.length
        }
      };
    }

    case 'adoption_champion_program': {
      const { customerId, minUsage = 10 } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get usage data to identify high-engagement users
      const { data: metrics } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .order('metric_date', { ascending: false })
        .limit(30);

      const { data: stakeholders } = await supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId);

      // Identify potential champions based on engagement
      const activeUsers = metrics?.[0]?.active_users || 0;
      const avgLoginCount = metrics?.reduce((sum, m) => sum + (m.login_count || 0), 0) / (metrics?.length || 1);

      // Mark stakeholders with high engagement as potential champions
      const potentialChampions = stakeholders?.filter(s =>
        s.engagement_score > 70 || s.is_champion
      ) || [];

      return {
        success: true,
        championProgram: {
          customerId,
          metrics: {
            activeUsers,
            avgDailyLogins: Math.round(avgLoginCount),
            engagementLevel: avgLoginCount > minUsage ? 'high' : 'moderate'
          },
          potentialChampions: potentialChampions.map(c => ({
            name: c.name,
            title: c.title,
            email: c.email,
            engagementScore: c.engagement_score
          })),
          recommendations: [
            'Schedule 1:1 with top users to discuss champion program',
            'Create exclusive early access program for champions',
            'Develop referral incentives for internal advocacy'
          ]
        }
      };
    }

    case 'adoption_campaign': {
      const { customerId, features, campaignType = 'email' } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('*, stakeholders(*), usage_metrics(*)')
        .eq('id', customerId)
        .single();

      // Search knowledge base for adoption campaigns
      const kbResults = await knowledgeService.search('feature adoption campaign email sequence', {
        layer: 'universal',
        category: 'playbooks',
        limit: 2
      });

      // Analyze current feature adoption
      const currentAdoption = customer?.usage_metrics?.[0]?.feature_adoption || {};

      return {
        success: true,
        adoptionCampaign: {
          customer: customer?.name,
          features,
          campaignType,
          currentAdoption,
          suggestedSequence: [
            { day: 1, subject: `Unlock the power of ${features[0]}`, focus: 'Introduction & value prop' },
            { day: 3, subject: `Quick tip: Get more from ${features[0]}`, focus: 'Best practices' },
            { day: 7, subject: 'See how peers are using this feature', focus: 'Social proof & use cases' },
            { day: 14, subject: 'Need help getting started?', focus: 'Offer training/support' }
          ],
          targetAudience: customer?.stakeholders?.map((s: any) => ({
            name: s.name,
            email: s.email,
            currentUsage: 'TBD'
          })) || [],
          knowledgeBase: kbResults.map(r => ({ title: r.documentTitle, excerpt: r.content?.substring(0, 200) })),
          note: 'Use draft_email to create individual campaign emails for approval'
        }
      };
    }

    case 'adoption_feature_training': {
      const { customerId, features, trainingType = 'end-user' } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('*, stakeholders(*)')
        .eq('id', customerId)
        .single();

      // Search knowledge base for training templates
      const kbResults = await knowledgeService.search('training program template schedule', {
        layer: 'universal',
        category: 'playbooks',
        limit: 2
      });

      const trainingDuration = trainingType === 'admin' ? 90 : trainingType === 'advanced' ? 60 : 45;

      return {
        success: true,
        featureTraining: {
          customer: customer?.name,
          features,
          trainingType,
          recommendedSessions: features.map((feature: string, index: number) => ({
            session: index + 1,
            topic: feature,
            duration: trainingDuration,
            suggestedDate: new Date(Date.now() + (7 + index * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            format: 'Live virtual training'
          })),
          targetAttendees: {
            type: trainingType,
            count: customer?.stakeholders?.length || 0,
            roles: trainingType === 'admin' ? ['Administrators', 'Power users'] :
              trainingType === 'advanced' ? ['Power users', 'Champions'] :
              ['All users']
          },
          prerequisites: trainingType === 'admin' ? ['Admin access', 'Basic product knowledge'] :
            trainingType === 'advanced' ? ['Completed basic training', 'Active product usage'] :
            ['Account access'],
          knowledgeBase: kbResults.map(r => ({ title: r.documentTitle, excerpt: r.content?.substring(0, 200) })),
          note: 'Use schedule_meeting to book the training sessions'
        }
      };
    }

    // ============================================
    // RENEWAL AGENT TOOLS (Read-Only)
    // ============================================
    case 'renewal_forecast': {
      const { customerId, timeframe = '90d' } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      let query = supabase
        .from('renewal_pipeline')
        .select('*, customers(name, arr, health_score, segment)');

      // Calculate date range
      const endDate = new Date();
      if (timeframe === '30d') endDate.setDate(endDate.getDate() + 30);
      else if (timeframe === '60d') endDate.setDate(endDate.getDate() + 60);
      else if (timeframe === '90d') endDate.setDate(endDate.getDate() + 90);
      else if (timeframe === 'quarter') endDate.setMonth(endDate.getMonth() + 3);
      else if (timeframe === 'year') endDate.setFullYear(endDate.getFullYear() + 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else {
        query = query.lte('renewal_date', endDate.toISOString().split('T')[0]);
      }

      const { data: renewals } = await query.order('renewal_date', { ascending: true });

      if (!renewals || renewals.length === 0) {
        return { success: false, error: 'No renewals found in timeframe' };
      }

      // Calculate forecast
      const totalARR = renewals.reduce((sum, r) => sum + (r.current_arr || 0), 0);
      const weightedARR = renewals.reduce((sum, r) => sum + ((r.current_arr || 0) * (r.probability || 50) / 100), 0);
      const atRiskARR = renewals.filter(r => r.probability < 70).reduce((sum, r) => sum + (r.current_arr || 0), 0);

      const stageBreakdown = {
        early: renewals.filter(r => r.stage === 'early').length,
        mid: renewals.filter(r => r.stage === 'mid').length,
        late: renewals.filter(r => r.stage === 'late').length,
        final: renewals.filter(r => r.stage === 'final').length
      };

      return {
        success: true,
        renewalForecast: {
          timeframe,
          summary: {
            totalRenewals: renewals.length,
            totalARR: totalARR,
            forecastedARR: Math.round(weightedARR),
            atRiskARR: atRiskARR,
            avgProbability: Math.round(renewals.reduce((sum, r) => sum + (r.probability || 50), 0) / renewals.length)
          },
          stageBreakdown,
          renewals: renewals.map(r => ({
            customer: r.customers?.name,
            renewalDate: r.renewal_date,
            currentARR: r.current_arr,
            proposedARR: r.proposed_arr,
            probability: r.probability,
            stage: r.stage,
            riskFactors: r.risk_factors || []
          }))
        }
      };
    }

    case 'renewal_expansion_analysis': {
      const { customerId, includeCompetitive = false } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get expansion opportunities
      const { data: opportunities } = await supabase
        .from('expansion_opportunities')
        .select('*, customers(name, arr, segment)')
        .eq('customer_id', customerId);

      const { data: customer } = await supabase
        .from('customers')
        .select('*, usage_metrics(adoption_score, feature_adoption)')
        .eq('id', customerId)
        .single();

      const totalPotential = opportunities?.reduce((sum, o) => sum + (o.estimated_value || 0), 0) || 0;

      return {
        success: true,
        expansionAnalysis: {
          customer: customer?.name,
          currentARR: customer?.arr,
          segment: customer?.segment,
          opportunities: opportunities?.map(o => ({
            type: o.opportunity_type,
            productLine: o.product_line,
            estimatedValue: o.estimated_value,
            probability: o.probability,
            stage: o.stage,
            timeline: o.timeline,
            useCase: o.use_case,
            blockers: o.blockers
          })) || [],
          summary: {
            totalOpportunities: opportunities?.length || 0,
            totalPotential,
            weightedPotential: opportunities?.reduce((sum, o) => sum + ((o.estimated_value || 0) * (o.probability || 25) / 100), 0) || 0
          },
          recommendations: [
            customer?.usage_metrics?.[0]?.adoption_score < 70 ? 'Focus on adoption before expansion' : 'Customer ready for expansion discussion',
            opportunities?.some(o => o.stage === 'qualified') ? 'Follow up on qualified opportunities' : 'Identify new expansion opportunities'
          ]
        }
      };
    }

    case 'renewal_playbook_start': {
      const { customerId, renewalDate } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get customer and renewal data
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      const actualRenewalDate = renewalDate || customer?.renewal_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Search knowledge base for renewal playbook
      const kbResults = await knowledgeService.search('120 day renewal playbook checklist', {
        layer: 'universal',
        category: 'playbooks',
        limit: 2
      });

      // Calculate days until renewal
      const daysUntilRenewal = Math.ceil((new Date(actualRenewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        renewalPlaybook: {
          customer: customer?.name,
          renewalDate: actualRenewalDate,
          daysUntilRenewal,
          currentStage: daysUntilRenewal > 90 ? '120-day' : daysUntilRenewal > 60 ? '90-day' : daysUntilRenewal > 30 ? '60-day' : '30-day',
          checklist: {
            '120_day': [
              { task: 'Review account health', completed: false },
              { task: 'Identify stakeholder changes', completed: false },
              { task: 'Document value delivered', completed: false }
            ],
            '90_day': [
              { task: 'Schedule QBR', completed: false },
              { task: 'Prepare value summary', completed: false },
              { task: 'Engage executive sponsor', completed: false }
            ],
            '60_day': [
              { task: 'Present renewal proposal', completed: false },
              { task: 'Discuss expansion opportunities', completed: false },
              { task: 'Address any concerns', completed: false }
            ],
            '30_day': [
              { task: 'Finalize commercial terms', completed: false },
              { task: 'Obtain verbal commitment', completed: false },
              { task: 'Send contract', completed: false }
            ]
          },
          knowledgeBase: kbResults.map(r => ({ title: r.documentTitle, excerpt: r.content?.substring(0, 200) }))
        }
      };
    }

    // ============================================
    // RISK AGENT TOOLS (Read-Only)
    // ============================================
    case 'risk_assessment': {
      const { customerId, includeRecommendations = true } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get customer with health data
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      // Get risk signals
      const { data: signals } = await supabase
        .from('risk_signals')
        .select('*')
        .eq('customer_id', customerId)
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });

      // Get recent usage trend
      const { data: usage } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .order('metric_date', { ascending: false })
        .limit(7);

      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Calculate risk score
      const activeSignals = signals?.length || 0;
      const criticalSignals = signals?.filter(s => s.severity === 'critical').length || 0;
      const highSignals = signals?.filter(s => s.severity === 'high').length || 0;
      const decliningUsage = usage?.filter(u => u.usage_trend === 'declining').length || 0;

      const riskLevel = criticalSignals > 0 ? 'critical' :
        highSignals > 1 || decliningUsage > 3 ? 'high' :
        activeSignals > 0 ? 'medium' : 'low';

      return {
        success: true,
        riskAssessment: {
          customer: customer.name,
          healthScore: customer.health_score,
          healthColor: customer.health_color,
          riskLevel,
          arrAtRisk: customer.arr,
          signals: signals?.map(s => ({
            type: s.signal_type,
            severity: s.severity,
            description: s.description,
            detectedAt: s.detected_at
          })) || [],
          usageTrend: usage?.[0]?.usage_trend || 'stable',
          summary: {
            activeSignals,
            criticalSignals,
            highSignals,
            decliningUsageDays: decliningUsage
          },
          recommendations: includeRecommendations ? [
            criticalSignals > 0 ? 'Immediate escalation required' : null,
            decliningUsage > 3 ? 'Schedule usage review meeting' : null,
            customer.health_score < 50 ? 'Initiate save play' : null,
            'Review stakeholder engagement'
          ].filter(Boolean) : []
        }
      };
    }

    case 'risk_health_check': {
      const { customerId, dimensions = ['product', 'risk', 'outcomes', 'voice', 'engagement'] } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      // Get comprehensive customer data
      const { data: customer } = await supabase
        .from('customers')
        .select('*, stakeholders(*), usage_metrics(*), risk_signals(*), nps_responses(*)')
        .eq('id', customerId)
        .single();

      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      const latestUsage = customer.usage_metrics?.[0];
      const activeSignals = customer.risk_signals?.filter((s: any) => !s.resolved_at) || [];
      const latestNps = customer.nps_responses?.[0];

      // Calculate PROVE scores
      const proveScores: Record<string, { score: number; details: string[] }> = {};

      if (dimensions.includes('product')) {
        const adoptionScore = latestUsage?.adoption_score || 50;
        proveScores.product = {
          score: adoptionScore,
          details: [
            `DAU: ${latestUsage?.dau || 0}`,
            `MAU: ${latestUsage?.mau || 0}`,
            `Adoption Score: ${adoptionScore}`
          ]
        };
      }

      if (dimensions.includes('risk')) {
        const riskScore = Math.max(0, 100 - (activeSignals.length * 15));
        proveScores.risk = {
          score: riskScore,
          details: [
            `Active Signals: ${activeSignals.length}`,
            ...activeSignals.slice(0, 3).map((s: any) => `${s.severity}: ${s.signal_type}`)
          ]
        };
      }

      if (dimensions.includes('outcomes')) {
        proveScores.outcomes = {
          score: 70, // Would be calculated from success metrics
          details: ['ROI tracking needed', 'Success metrics TBD']
        };
      }

      if (dimensions.includes('voice')) {
        const npsScore = latestNps?.score ?? 7;
        proveScores.voice = {
          score: npsScore * 10,
          details: [
            `Latest NPS: ${npsScore}`,
            `Sentiment: ${npsScore >= 9 ? 'Promoter' : npsScore >= 7 ? 'Passive' : 'Detractor'}`
          ]
        };
      }

      if (dimensions.includes('engagement')) {
        const engagedStakeholders = customer.stakeholders?.filter((s: any) => s.engagement_score > 50).length || 0;
        proveScores.engagement = {
          score: Math.min(100, engagedStakeholders * 25),
          details: [
            `Engaged Stakeholders: ${engagedStakeholders}/${customer.stakeholders?.length || 0}`,
            `Last Contact: ${customer.last_activity || 'Unknown'}`
          ]
        };
      }

      // Calculate overall health
      const scores = Object.values(proveScores).map(p => p.score);
      const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      return {
        success: true,
        healthCheck: {
          customer: customer.name,
          overallScore,
          overallHealth: overallScore >= 80 ? 'green' : overallScore >= 50 ? 'yellow' : 'red',
          dimensions: proveScores,
          recommendations: [
            overallScore < 50 ? 'Customer is at risk - initiate save play' : null,
            proveScores.engagement?.score < 50 ? 'Increase stakeholder engagement' : null,
            proveScores.product?.score < 50 ? 'Focus on product adoption' : null
          ].filter(Boolean)
        }
      };
    }

    // ============================================
    // STRATEGIC AGENT TOOLS (Read-Only)
    // ============================================
    case 'strategic_success_plan': {
      const { customerId, businessGoals, successMetrics } = input;

      if (!supabase) {
        return { success: false, error: 'Database not configured' };
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('*, contracts(*), stakeholders(*)')
        .eq('id', customerId)
        .single();

      // Search knowledge base for success planning
      const kbResults = await knowledgeService.search('strategic success plan framework', {
        layer: 'universal',
        category: 'playbooks',
        limit: 2
      });

      return {
        success: true,
        successPlan: {
          customer: customer?.name,
          segment: customer?.segment,
          arr: customer?.arr,
          businessGoals: businessGoals || customer?.contracts?.[0]?.goals || [],
          successMetrics: successMetrics || [
            'User adoption rate > 80%',
            'Monthly active users growth',
            'Time to value < 30 days',
            'NPS score > 50'
          ],
          executiveSponsor: customer?.stakeholders?.find((s: any) => s.role?.includes('Executive'))?.name || 'TBD',
          keyMilestones: [
            { milestone: 'Onboarding complete', target: '30 days', status: 'pending' },
            { milestone: 'First value realized', target: '60 days', status: 'pending' },
            { milestone: 'Full adoption', target: '90 days', status: 'pending' },
            { milestone: 'Expansion discussion', target: '180 days', status: 'pending' }
          ],
          knowledgeBase: kbResults.map(r => ({ title: r.documentTitle, excerpt: r.content?.substring(0, 200) }))
        }
      };
    }

    // ============================================
    // Apps Script Generation (read-only, returns code)
    // ============================================
    case 'generate_appscript': {
      const { purpose, spreadsheetId, sheetName, dataRange } = input;

      // Generate Apps Script code based on purpose
      let scriptCode = '';
      let instructions = '';

      if (purpose.toLowerCase().includes('chart')) {
        scriptCode = `/**
 * Creates a chart in the active spreadsheet
 * Generated by CSCX.AI
 */
function createChart() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('${sheetName || 'Sheet1'}');
  const range = sheet.getRange('${dataRange || 'A1:B10'}');

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.${purpose.toLowerCase().includes('pie') ? 'PIE' : purpose.toLowerCase().includes('line') ? 'LINE' : 'COLUMN'})
    .addRange(range)
    .setPosition(5, 5, 0, 0)
    .setOption('title', 'Chart from CSCX.AI')
    .setOption('legend', { position: 'bottom' })
    .build();

  sheet.insertChart(chart);
  Logger.log('Chart created successfully!');
}

// Add menu item when spreadsheet opens
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CSCX.AI')
    .addItem('Create Chart', 'createChart')
    .addToUi();
}`;
        instructions = `To deploy this script:
1. Open your spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId || '[YOUR_SPREADSHEET_ID]'}
2. Go to Extensions > Apps Script
3. Delete any existing code and paste this script
4. Save (Ctrl+S) and run the "onOpen" function first
5. Refresh your spreadsheet - you'll see a "CSCX.AI" menu
6. Click CSCX.AI > Create Chart`;
      } else if (purpose.toLowerCase().includes('email') || purpose.toLowerCase().includes('send')) {
        scriptCode = `/**
 * Sends emails based on spreadsheet data
 * Generated by CSCX.AI
 */
function sendEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('${sheetName || 'Sheet1'}');
  const data = sheet.getDataRange().getValues();

  // Assuming columns: Email, Subject, Message
  for (let i = 1; i < data.length; i++) {
    const email = data[i][0];
    const subject = data[i][1];
    const message = data[i][2];

    if (email && subject && message) {
      GmailApp.sendEmail(email, subject, message);
      Logger.log('Email sent to: ' + email);
    }
  }

  SpreadsheetApp.getUi().alert('Emails sent successfully!');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CSCX.AI')
    .addItem('Send Emails', 'sendEmails')
    .addToUi();
}`;
        instructions = `To deploy this script:
1. Open your spreadsheet with email data
2. Go to Extensions > Apps Script
3. Paste this code and save
4. Run onOpen function, then refresh the sheet
5. Click CSCX.AI > Send Emails`;
      } else if (purpose.toLowerCase().includes('trigger') || purpose.toLowerCase().includes('automate')) {
        scriptCode = `/**
 * Automated trigger script
 * Generated by CSCX.AI
 */
function onEdit(e) {
  const range = e.range;
  const sheet = e.source.getActiveSheet();

  // Log the change
  Logger.log('Cell ' + range.getA1Notation() + ' changed to: ' + range.getValue());

  // Example: If column A changes, update timestamp in column B
  if (range.getColumn() === 1) {
    const row = range.getRow();
    sheet.getRange(row, 2).setValue(new Date());
  }
}

function createTrigger() {
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log('Trigger created!');
}`;
        instructions = `To deploy this script:
1. Go to Extensions > Apps Script
2. Paste this code and save
3. Run "createTrigger" function once
4. Now every edit will trigger the automation`;
      } else {
        // Generic data processing script
        scriptCode = `/**
 * Custom data processing script
 * Purpose: ${purpose}
 * Generated by CSCX.AI
 */
function processData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('${sheetName || 'Sheet1'}');
  const range = sheet.getRange('${dataRange || 'A1:Z100'}');
  const data = range.getValues();

  // Process your data here
  Logger.log('Processing ' + data.length + ' rows...');

  // Example: Add summary at bottom
  const lastRow = sheet.getLastRow() + 2;
  sheet.getRange(lastRow, 1).setValue('Processed: ' + new Date());

  SpreadsheetApp.getUi().alert('Data processed!');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CSCX.AI')
    .addItem('Process Data', 'processData')
    .addToUi();
}`;
        instructions = `To deploy this script:
1. Go to Extensions > Apps Script in your spreadsheet
2. Paste this code and save
3. Run "onOpen", refresh the sheet
4. Use the CSCX.AI menu to run`;
      }

      return {
        success: true,
        script: {
          code: scriptCode,
          instructions: instructions,
          purpose: purpose,
          targetSpreadsheet: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null
        }
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

// ============================================
// LangGraph Nodes
// ============================================

/**
 * Call Claude with the conversation and tools
 */
async function callClaude(state: AgentStateType): Promise<Partial<AgentStateType>> {
  // Extract specialist persona if selected
  const specialistPersona = state.customerContext?._specialistPersona;
  const specialistType = state.customerContext?._specialist;
  const useKnowledgeBase = state.customerContext?.useKnowledgeBase !== false;

  // Build customer context without internal fields
  const cleanContext = { ...state.customerContext };
  delete cleanContext._specialist;
  delete cleanContext._specialistPersona;
  delete cleanContext.useKnowledgeBase;
  delete cleanContext.userId;

  // CSM expertise section - only included when knowledge base is enabled
  const csmExpertise = useKnowledgeBase ? `

## CSM EXPERT KNOWLEDGE

You have access to a knowledge base with CSM expertise including:

**PROVE Health Framework** (for health assessments):
- **P**roduct: Usage and adoption metrics (30% weight)
- **R**isk: Churn/contraction indicators (20% weight)
- **O**utcomes: Measurable business results (20% weight)
- **V**oice: Customer sentiment, NPS, CSAT (15% weight)
- **E**ngagement: Interaction quality and frequency (15% weight)

**Health Score Colors:** Green (80-100), Yellow (50-79), Red (0-49)

**Available Playbooks:** Onboarding, EBR, Triage, Recovery, Renewal, Churn Prevention

Use the \`search_knowledge\` tool to find specific playbooks, templates, and best practices.
` : '';

  const specialistSection = specialistPersona
    ? `\n\n## YOUR SPECIALIST ROLE\n${specialistPersona}`
    : '';

  // Build the system prompt using the general-purpose base
  const systemPrompt = `${CSCX_SYSTEM_PROMPT}${csmExpertise}${specialistSection}

## CURRENT CONTEXT
${Object.keys(cleanContext).length > 0 ? `Customer: ${cleanContext.name || 'Unknown'}\n${JSON.stringify(cleanContext, null, 2)}` : 'No specific customer selected'}

## AVAILABLE TOOLS

**Web Search:**
- web_search - Search the internet for current events, weather, news

**Google Calendar:**
- get_todays_meetings - Today's calendar events
- get_upcoming_meetings - Upcoming events for N days
- get_availability - Find free time slots
- list_calendars - List all calendars

**Gmail:**
- get_recent_emails - Recent email threads
- search_emails - Search emails by query
- get_email_thread - Get specific thread
- get_unread_emails - Unread emails
- get_email_labels - Gmail labels/folders

**Google Drive:**
- get_recent_files - Recently modified files
- search_files - Search files by name
- list_folders - List folders
- get_file_content - Get file content
- get_documents - List Google Docs
- get_spreadsheets - List Sheets
- get_presentations - List Slides

**Google Docs:**
- get_document - Read document content

**Google Sheets:**
- get_spreadsheet_data - Read spreadsheet data

**Google Slides:**
- get_presentation - Get presentation info

${useKnowledgeBase ? '**Knowledge Base:**\n- search_knowledge - Search CSM playbooks, best practices' : ''}

**Apps Script (generates deployable code):**
- generate_appscript - Generate Apps Script for automation, charts, triggers

**Actions (REQUIRE approval):**
- schedule_meeting - Book calendar meeting
- draft_email / send_email - Create/send emails
- create_task - Create follow-up task
- create_document - Create Google Doc
- create_spreadsheet - Create Google Sheet
- create_presentation - Create Google Slides
- create_chart_slide - Create Slides with charts from spreadsheet
- update_spreadsheet - Update sheet data
- append_to_spreadsheet - Add row to sheet

**Onboarding Agent Tools:**
- onboarding_kickoff - Schedule kickoff meeting (REQUIRES approval)
- onboarding_30_60_90_plan - Generate 30-60-90 day plan
- onboarding_stakeholder_map - Map customer stakeholders
- onboarding_welcome_sequence - Create welcome email sequence (REQUIRES approval)

**Adoption Agent Tools:**
- adoption_usage_analysis - Analyze product usage metrics
- adoption_campaign - Create feature adoption campaign
- adoption_feature_training - Plan feature training sessions
- adoption_champion_program - Identify customer champions

**Renewal Agent Tools:**
- renewal_forecast - Generate renewal forecast
- renewal_value_summary - Create value summary document (REQUIRES approval)
- renewal_expansion_analysis - Identify expansion opportunities
- renewal_playbook_start - Start 120-day renewal playbook

**Risk Agent Tools:**
- risk_assessment - Run comprehensive risk assessment
- risk_save_play - Create save play for at-risk customer (REQUIRES approval)
- risk_escalation - Escalate customer issue (REQUIRES approval)
- risk_health_check - Perform deep PROVE health check

**Strategic Agent Tools:**
- strategic_qbr_prep - Prepare QBR materials (REQUIRES approval)
- strategic_exec_briefing - Create executive briefing (REQUIRES approval)
- strategic_account_plan - Generate account plan (REQUIRES approval)
- strategic_success_plan - Create strategic success plan

## GUIDELINES
- USE TOOLS when appropriate - don't just describe what you could do
- For action tools, explain what you're doing and that it requires approval
- Be helpful, concise, and proactive
${specialistType ? `- **Focus Area:** ${specialistType}` : ''}`;

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = state.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  }));

  try {
    // Combine custom tools with built-in Anthropic tools (web search)
    const allTools = [...CLAUDE_TOOLS, ...ANTHROPIC_BUILTIN_TOOLS] as any;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      tools: allTools,
      tool_choice: { type: 'auto' },
      messages: anthropicMessages
    });

    // Debug log to see what Claude returned
    console.log('🤖 Claude response:', {
      stopReason: response.stop_reason,
      contentTypes: response.content.map(b => b.type),
      hasToolUse: response.content.some(b => b.type === 'tool_use')
    });

    // Check for tool use
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const textContent = cleanResponseText(textBlocks.map(b => b.text).join('\n'));

    if (toolUseBlocks.length > 0) {
      // Process tool calls
      const pendingActions: PendingAction[] = [];
      const toolResults: Record<string, any>[] = [];

      console.log('🔧 Tool use blocks:', toolUseBlocks.map(t => ({ id: t.id, name: t.name, input: t.input })));
      console.log('🔧 Approval required tools:', APPROVAL_REQUIRED_TOOLS);

      for (const toolUse of toolUseBlocks) {
        const toolCall: ToolCall = {
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input as Record<string, any>
        };

        console.log('🔧 Checking tool:', toolUse.name, 'requiresApproval:', APPROVAL_REQUIRED_TOOLS.includes(toolUse.name));

        if (APPROVAL_REQUIRED_TOOLS.includes(toolUse.name)) {
          // This tool requires approval
          console.log('🔧 Adding to pending actions:', toolUse.name);
          pendingActions.push({
            toolCall,
            status: 'pending_approval'
          });
        } else {
          // Execute read-only tools immediately
          try {
            const result = await executeReadOnlyTool(
              toolUse.name,
              toolUse.input as Record<string, any>,
              state.userId,
              { useKnowledgeBase: state.customerContext?.useKnowledgeBase !== false }
            );
            toolResults.push({
              toolCallId: toolUse.id,
              toolName: toolUse.name,
              result
            });
          } catch (error) {
            toolResults.push({
              toolCallId: toolUse.id,
              toolName: toolUse.name,
              result: { success: false, error: (error as Error).message }
            });
          }
        }
      }

      return {
        response: textContent,
        pendingActions,
        toolResults,
        requiresApproval: pendingActions.length > 0
      };
    }

    // No tool calls - just return the text response
    return {
      response: textContent,
      pendingActions: [],
      requiresApproval: false
    };
  } catch (error) {
    console.error('Claude API error:', error);
    return {
      response: `I apologize, I encountered an error: ${(error as Error).message}. This might be due to API rate limits or missing credentials.`,
      requiresApproval: false
    };
  }
}

/**
 * Process tool results and generate follow-up response
 */
async function processToolResults(state: AgentStateType): Promise<Partial<AgentStateType>> {
  if (state.toolResults.length === 0) {
    return {};
  }

  // Format tool results for Claude
  const resultsText = state.toolResults.map(tr => {
    return `Tool: ${tr.toolName}\nResult: ${JSON.stringify(tr.result, null, 2)}`;
  }).join('\n\n');

  // Add tool results as assistant message context
  const updatedMessages = [
    ...state.messages,
    { role: 'assistant', content: `[Tool Results]\n${resultsText}` }
  ];

  // Get Claude to summarize the results naturally
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a helpful assistant. Summarize the tool results in a natural, conversational way for the user. Format nicely with markdown.',
      messages: [
        { role: 'user', content: `Please summarize these tool results:\n\n${resultsText}` }
      ]
    });

    const textContent = cleanResponseText(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(b => b.text)
        .join('\n')
    );

    return {
      response: textContent,
      messages: updatedMessages
    };
  } catch (error) {
    // Fallback to raw results if Claude fails
    return {
      response: `Here's what I found:\n\n${resultsText}`,
      messages: updatedMessages
    };
  }
}

/**
 * Create approval requests for pending actions
 */
async function createApprovalRequests(state: AgentStateType): Promise<Partial<AgentStateType>> {
  if (state.pendingActions.length === 0) {
    return {};
  }

  const updatedActions: PendingAction[] = [];

  for (const action of state.pendingActions) {
    if (action.status === 'pending_approval') {
      try {
        // Map tool call to approval action type
        // Note: DB constraint allows: send_email, schedule_meeting, create_task, share_document, other
        // Using 'other' for new document types until DB migration is run
        const actionTypeMap: Record<string, string> = {
          'schedule_meeting': 'schedule_meeting',
          'draft_email': 'send_email',
          'send_email': 'send_email',
          'create_task': 'create_task',
          'create_document': 'other',  // Use 'other' until DB constraint is updated
          'create_spreadsheet': 'other'  // Use 'other' until DB constraint is updated
        };

        const actionType = (actionTypeMap[action.toolCall.name] || 'other') as ActionType;
        console.log(`🔧 Mapping ${action.toolCall.name} to approval type: ${actionType}`);

        // Create approval request - include original tool name in actionData for execution
        const approval = await approvalService.createApproval({
          userId: state.userId,
          actionType,
          actionData: {
            ...action.toolCall.input,
            _toolName: action.toolCall.name  // Include original tool name for execution
          },
          originalContent: formatActionContent(action.toolCall)
        });

        updatedActions.push({
          ...action,
          approvalId: approval.id
        });

        console.log(`✅ Created approval request: ${approval.id} for ${action.toolCall.name}`);
      } catch (error) {
        console.error('Failed to create approval:', error);
        updatedActions.push(action);
      }
    } else {
      updatedActions.push(action);
    }
  }

  // Generate response about pending approvals
  const approvalMessages = updatedActions.map(a => {
    const input = a.toolCall.input;
    switch (a.toolCall.name) {
      case 'schedule_meeting':
        return `📅 **Meeting:** "${input.title}" - Check Pending Approvals to confirm`;
      case 'draft_email':
        return `📧 **Email:** "${input.subject}" - Check Pending Approvals to send`;
      case 'create_task':
        return `✅ **Task:** "${input.title}" - Check Pending Approvals to create`;
      default:
        return `⚡ **Action:** ${a.toolCall.name} - Awaiting approval`;
    }
  });

  const response = state.response + '\n\n**Actions Pending Approval:**\n' + approvalMessages.join('\n');

  return {
    pendingActions: updatedActions,
    response
  };
}

/**
 * Format action content for approval display
 */
function formatActionContent(toolCall: ToolCall): string {
  const input = toolCall.input;
  switch (toolCall.name) {
    case 'schedule_meeting':
      return `Meeting: ${input.title}\nTime: ${input.startTime}\nAttendees: ${input.attendees?.join(', ') || 'TBD'}\nDescription: ${input.description || 'None'}`;
    case 'draft_email':
    case 'send_email':
      return `To: ${input.to?.join(', ') || 'TBD'}\nSubject: ${input.subject}\n\n${input.body}`;
    case 'create_task':
      return `Task: ${input.title}\nDue: ${input.dueDate || 'TBD'}\nPriority: ${input.priority || 'medium'}\nNotes: ${input.notes || 'None'}`;
    case 'create_document':
      return `Document: ${input.title}\nTemplate: ${input.template || 'blank'}\nVariables: ${JSON.stringify(input.variables || {}, null, 2)}`;
    case 'create_spreadsheet':
      return `Spreadsheet: ${input.title}\nTemplate: ${input.template || 'blank'}\nVariables: ${JSON.stringify(input.variables || {}, null, 2)}`;
    // Agent-specific approval tools
    case 'onboarding_kickoff':
      return `📅 KICKOFF MEETING\nCustomer: ${input.customerId}\nDate: ${input.date || 'TBD'}\nDuration: ${input.duration || 60} minutes\nIncludes Kickoff Deck: ${input.includeKickoffDeck !== false ? 'Yes' : 'No'}`;
    case 'onboarding_welcome_sequence':
      return `✉️ WELCOME EMAIL SEQUENCE\nCustomer: ${input.customerId}\nRecipients: ${input.stakeholderEmails?.join(', ') || 'All stakeholders'}\nEmails: Day 1, Day 3, Day 7, Day 14, Day 30`;
    case 'renewal_value_summary':
      return `💎 VALUE SUMMARY DOCUMENT\nCustomer: ${input.customerId}\nMetrics to Include: ${input.includeMetrics?.join(', ') || 'All standard metrics'}\n\nWill generate comprehensive ROI and value documentation.`;
    case 'risk_save_play':
      return `🛡️ SAVE PLAY\nCustomer: ${input.customerId}\nRisk Level: ${input.riskLevel}\nPrimary Issue: ${input.primaryIssue}\nRoot Cause: ${input.rootCause || 'TBD'}\n\nWill create action plan and recovery documentation.`;
    case 'risk_escalation':
      return `🚨 ESCALATION\nCustomer: ${input.customerId}\nLevel: ${['Manager', 'Director', 'VP'][input.escalationLevel - 1] || 'Unknown'}\nReason: ${input.reason}\nARR at Risk: $${(input.arrAtRisk || 0).toLocaleString()}`;
    case 'strategic_qbr_prep':
      return `📊 QBR PREPARATION\nCustomer: ${input.customerId}\nQuarter: ${input.quarter} ${input.year}\nIncludes Roadmap: ${input.includeRoadmap ? 'Yes' : 'No'}\n\nWill generate:\n- QBR Presentation\n- Metrics Dashboard\n- Preparation Checklist`;
    case 'strategic_exec_briefing':
      return `👔 EXECUTIVE BRIEFING\nCustomer: ${input.customerId}\nAudience: ${input.briefingType || 'internal'}\nFocus Areas: ${input.focusAreas?.join(', ') || 'General overview'}`;
    case 'strategic_account_plan':
      return `🗺️ ACCOUNT PLAN\nCustomer: ${input.customerId}\nFiscal Year: ${input.fiscalYear}\nObjectives: ${input.objectives?.join(', ') || 'TBD'}`;
    default:
      return JSON.stringify(input, null, 2);
  }
}

/**
 * Routing function to determine next step
 */
function routeAfterClaude(state: AgentStateType): string {
  if (state.toolResults.length > 0) {
    return 'process_results';
  }
  if (state.pendingActions.length > 0) {
    return 'create_approvals';
  }
  return END;
}

// ============================================
// Build the Graph
// ============================================

function createWorkflowGraph() {
  const workflow = new StateGraph(AgentState)
    .addNode('call_claude', callClaude)
    .addNode('process_results', processToolResults)
    .addNode('create_approvals', createApprovalRequests)
    .addEdge(START, 'call_claude')
    .addConditionalEdges('call_claude', routeAfterClaude, {
      'process_results': 'process_results',
      'create_approvals': 'create_approvals',
      [END]: END
    })
    .addEdge('process_results', END)
    .addEdge('create_approvals', END);

  return workflow.compile();
}

// ============================================
// Exported Agent Interface
// ============================================

// Specialist persona configurations
const SPECIALIST_PERSONAS: Record<string, string> = {
  onboarding: `You are an **Onboarding Specialist**. Your focus is on new customer setup, kickoff meetings, and 30-60-90 day success plans.
Key responsibilities:
- Schedule kickoff meetings with stakeholders
- Create onboarding plans and tracking documents
- Send welcome emails and introductions
- Set up customer workspace folders
- Track onboarding milestones`,

  adoption: `You are an **Adoption Specialist**. Your focus is on product usage, feature enablement, and training coordination.
Key responsibilities:
- Monitor product usage and adoption metrics
- Recommend features based on use cases
- Schedule training sessions
- Create adoption tracking spreadsheets
- Send usage tips and best practices`,

  renewal: `You are a **Renewal Specialist**. Your focus is on renewal management, expansion opportunities, and commercial negotiations.
Key responsibilities:
- Track renewal timelines
- Identify upsell and expansion opportunities
- Draft renewal proposals
- Schedule renewal discussions
- Create renewal tracking sheets`,

  risk: `You are a **Risk Specialist**. Your focus is on at-risk account detection, save plays, and escalation management.
Key responsibilities:
- Monitor health score trends
- Identify churn signals
- Create escalation reports
- Schedule save meetings
- Draft re-engagement campaigns`,

  strategic: `You are a **Strategic CSM**. Your focus is on executive relationships, QBRs, and strategic account planning.
Key responsibilities:
- Schedule QBR meetings
- Create executive briefing documents
- Build strategic account plans
- Draft executive communications
- Prepare QBR presentations`
};

export class WorkflowAgent {
  private graph: ReturnType<typeof createWorkflowGraph>;

  constructor() {
    this.graph = createWorkflowGraph();
  }

  async chat(
    message: string,
    userId: string,
    customerContext?: Record<string, any>,
    history: Array<{ role: string; content: string }> = [],
    specialist?: string  // Optional specialist type for focused responses
  ): Promise<{
    response: string;
    requiresApproval: boolean;
    pendingActions: PendingAction[];
    toolsUsed: string[];
    toolResults: Array<{ toolCallId?: string; toolName: string; result: any }>;
    specialistUsed?: string;
  }> {
    // Add specialist context to customerContext for the system prompt
    const enhancedContext = {
      ...customerContext,
      _specialist: specialist,
      _specialistPersona: specialist ? SPECIALIST_PERSONAS[specialist] : undefined
    };

    const initialState = {
      messages: [...history, { role: 'user', content: message }],
      userId,
      customerContext: enhancedContext,
      pendingActions: [],
      toolResults: [],
      response: '',
      requiresApproval: false
    };

    try {
      const result = await this.graph.invoke(initialState);

      return {
        response: cleanResponseText(result.response || 'I processed your request.'),
        requiresApproval: result.requiresApproval || false,
        pendingActions: result.pendingActions || [],
        toolsUsed: result.toolResults?.map((tr: any) => tr.toolName) || [],
        toolResults: (result.toolResults || []) as Array<{ toolCallId?: string; toolName: string; result: any }>,
        specialistUsed: specialist
      };
    } catch (error) {
      console.error('Workflow agent error:', error);
      return {
        response: `I encountered an error: ${(error as Error).message}`,
        requiresApproval: false,
        pendingActions: [],
        toolsUsed: [],
        toolResults: [],
        specialistUsed: specialist
      };
    }
  }

  /**
   * Streaming variant of chat() — streams Claude responses token-by-token via callbacks.
   * Uses anthropic.messages.stream() instead of messages.create().
   * Tool handling (approval checks, read-only execution) mirrors chat() exactly.
   */
  async chatStream(
    message: string,
    userId: string,
    customerContext?: Record<string, any>,
    history: Array<{ role: string; content: string }> = [],
    specialist?: string,
    callbacks?: {
      onToken: (text: string) => void;
      onToolEvent?: (event: {
        type: 'tool_start' | 'tool_end';
        name: string;
        params?: any;
        result?: any;
        duration?: number;
      }) => void;
    },
    abortSignal?: AbortSignal
  ): Promise<{
    response: string;
    requiresApproval: boolean;
    pendingActions: PendingAction[];
    toolsUsed: string[];
    toolResults: Array<{ toolCallId?: string; toolName: string; result: any }>;
    specialistUsed?: string;
  }> {
    // Build system prompt — same logic as callClaude()
    const specialistPersona = specialist ? SPECIALIST_PERSONAS[specialist] : undefined;
    const useKnowledgeBase = customerContext?.useKnowledgeBase !== false;

    const cleanContext = { ...customerContext };
    delete cleanContext._specialist;
    delete cleanContext._specialistPersona;
    delete cleanContext.useKnowledgeBase;
    delete cleanContext.userId;

    const csmExpertise = useKnowledgeBase ? `

## CSM EXPERT KNOWLEDGE

You have access to a knowledge base with CSM expertise including:

**PROVE Health Framework** (for health assessments):
- **P**roduct: Usage and adoption metrics (30% weight)
- **R**isk: Churn/contraction indicators (20% weight)
- **O**utcomes: Measurable business results (20% weight)
- **V**oice: Customer sentiment, NPS, CSAT (15% weight)
- **E**ngagement: Interaction quality and frequency (15% weight)

**Health Score Colors:** Green (80-100), Yellow (50-79), Red (0-49)

**Available Playbooks:** Onboarding, EBR, Triage, Recovery, Renewal, Churn Prevention

Use the \`search_knowledge\` tool to find specific playbooks, templates, and best practices.
` : '';

    const specialistSection = specialistPersona
      ? `\n\n## YOUR SPECIALIST ROLE\n${specialistPersona}`
      : '';

    const systemPrompt = `${CSCX_SYSTEM_PROMPT}${csmExpertise}${specialistSection}

## CURRENT CONTEXT
${Object.keys(cleanContext).length > 0 ? `Customer: ${cleanContext.name || 'Unknown'}\n${JSON.stringify(cleanContext, null, 2)}` : 'No specific customer selected'}

## AVAILABLE TOOLS

**Web Search:**
- web_search - Search the internet for current events, weather, news

**Google Calendar:**
- get_todays_meetings - Today's calendar events
- get_upcoming_meetings - Upcoming events for N days
- get_availability - Find free time slots
- list_calendars - List all calendars

**Gmail:**
- get_recent_emails - Recent email threads
- search_emails - Search emails by query
- get_email_thread - Get specific thread
- get_unread_emails - Unread emails
- get_email_labels - Gmail labels/folders

**Google Drive:**
- get_recent_files - Recently modified files
- search_files - Search files by name
- list_folders - List folders
- get_file_content - Get file content
- get_documents - List Google Docs
- get_spreadsheets - List Sheets
- get_presentations - List Slides

**Google Docs:**
- get_document - Read document content

**Google Sheets:**
- get_spreadsheet_data - Read spreadsheet data

**Google Slides:**
- get_presentation - Get presentation info

${useKnowledgeBase ? '**Knowledge Base:**\n- search_knowledge - Search CSM playbooks, best practices' : ''}

**Apps Script (generates deployable code):**
- generate_appscript - Generate Apps Script for automation, charts, triggers

**Actions (REQUIRE approval):**
- schedule_meeting - Book calendar meeting
- draft_email / send_email - Create/send emails
- create_task - Create follow-up task
- create_document - Create Google Doc
- create_spreadsheet - Create Google Sheet
- create_presentation - Create Google Slides
- create_chart_slide - Create Slides with charts from spreadsheet
- update_spreadsheet - Update sheet data
- append_to_spreadsheet - Add row to sheet

**Onboarding Agent Tools:**
- onboarding_kickoff - Schedule kickoff meeting (REQUIRES approval)
- onboarding_30_60_90_plan - Generate 30-60-90 day plan
- onboarding_stakeholder_map - Map customer stakeholders
- onboarding_welcome_sequence - Create welcome email sequence (REQUIRES approval)

**Adoption Agent Tools:**
- adoption_usage_analysis - Analyze product usage metrics
- adoption_campaign - Create feature adoption campaign
- adoption_feature_training - Plan feature training sessions
- adoption_champion_program - Identify customer champions

**Renewal Agent Tools:**
- renewal_forecast - Generate renewal forecast
- renewal_value_summary - Create value summary document (REQUIRES approval)
- renewal_expansion_analysis - Identify expansion opportunities
- renewal_playbook_start - Start 120-day renewal playbook

**Risk Agent Tools:**
- risk_assessment - Run comprehensive risk assessment
- risk_save_play - Create save play for at-risk customer (REQUIRES approval)
- risk_escalation - Escalate customer issue (REQUIRES approval)
- risk_health_check - Perform deep PROVE health check

**Strategic Agent Tools:**
- strategic_qbr_prep - Prepare QBR materials (REQUIRES approval)
- strategic_exec_briefing - Create executive briefing (REQUIRES approval)
- strategic_account_plan - Generate account plan (REQUIRES approval)
- strategic_success_plan - Create strategic success plan

## GUIDELINES
- USE TOOLS when appropriate - don't just describe what you could do
- For action tools, explain what you're doing and that it requires approval
- Be helpful, concise, and proactive
${specialist ? `- **Focus Area:** ${specialist}` : ''}`;

    const anthropicMessages: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user' as const, content: message }
    ].map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    try {
      const allTools = [...CLAUDE_TOOLS, ...ANTHROPIC_BUILTIN_TOOLS] as any;

      // Use streaming API
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        tools: allTools,
        tool_choice: { type: 'auto' },
        messages: anthropicMessages
      });

      // Handle abort signal
      if (abortSignal) {
        const onAbort = () => {
          stream.abort();
        };
        abortSignal.addEventListener('abort', onAbort, { once: true });
        // Clean up listener when stream finishes
        stream.on('end', () => abortSignal.removeEventListener('abort', onAbort));
      }

      // Stream text tokens
      stream.on('text', (text) => {
        callbacks?.onToken(text);
      });

      // Wait for the stream to complete and get the final message
      const finalMessage = await stream.finalMessage();

      // Process the response — same logic as callClaude()
      const toolUseBlocks = finalMessage.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const textBlocks = finalMessage.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      const textContent = cleanResponseText(textBlocks.map(b => b.text).join('\n'));

      if (toolUseBlocks.length > 0) {
        const pendingActions: PendingAction[] = [];
        const toolResults: Array<{ toolCallId?: string; toolName: string; result: any }> = [];

        for (const toolUse of toolUseBlocks) {
          const toolCall: ToolCall = {
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input as Record<string, any>
          };

          if (APPROVAL_REQUIRED_TOOLS.includes(toolUse.name)) {
            // Emit tool_start event for approval-required tools
            callbacks?.onToolEvent?.({
              type: 'tool_start',
              name: toolUse.name,
              params: toolUse.input
            });

            pendingActions.push({
              toolCall,
              status: 'pending_approval'
            });

            callbacks?.onToolEvent?.({
              type: 'tool_end',
              name: toolUse.name,
              result: { status: 'pending_approval' },
              duration: 0
            });
          } else {
            // Execute read-only tools immediately
            callbacks?.onToolEvent?.({
              type: 'tool_start',
              name: toolUse.name,
              params: toolUse.input
            });

            const startTime = Date.now();
            try {
              const result = await executeReadOnlyTool(
                toolUse.name,
                toolUse.input as Record<string, any>,
                userId,
                { useKnowledgeBase: customerContext?.useKnowledgeBase !== false }
              );
              const duration = Date.now() - startTime;
              toolResults.push({
                toolCallId: toolUse.id,
                toolName: toolUse.name,
                result
              });

              callbacks?.onToolEvent?.({
                type: 'tool_end',
                name: toolUse.name,
                result,
                duration
              });
            } catch (error) {
              const duration = Date.now() - startTime;
              const errorResult = { success: false, error: (error as Error).message };
              toolResults.push({
                toolCallId: toolUse.id,
                toolName: toolUse.name,
                result: errorResult
              });

              callbacks?.onToolEvent?.({
                type: 'tool_end',
                name: toolUse.name,
                result: errorResult,
                duration
              });
            }
          }
        }

        // If we have tool results, generate a follow-up summary
        let finalResponse = textContent;
        if (toolResults.length > 0) {
          const resultsText = toolResults.map(tr =>
            `Tool: ${tr.toolName}\nResult: ${JSON.stringify(tr.result, null, 2)}`
          ).join('\n\n');

          try {
            const summaryResponse = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              system: 'You are a helpful assistant. Summarize the tool results in a natural, conversational way for the user. Format nicely with markdown.',
              messages: [
                { role: 'user', content: `Please summarize these tool results:\n\n${resultsText}` }
              ]
            });

            const summaryText = cleanResponseText(
              summaryResponse.content
                .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                .map(b => b.text)
                .join('\n')
            );
            finalResponse = summaryText;
          } catch {
            finalResponse = `Here's what I found:\n\n${resultsText}`;
          }
        }

        // Handle pending approvals — create approval requests same as createApprovalRequests()
        if (pendingActions.length > 0) {
          for (const action of pendingActions) {
            try {
              const actionTypeMap: Record<string, string> = {
                'schedule_meeting': 'schedule_meeting',
                'draft_email': 'send_email',
                'send_email': 'send_email',
                'create_task': 'create_task',
                'create_document': 'other',
                'create_spreadsheet': 'other'
              };
              const actionType = (actionTypeMap[action.toolCall.name] || 'other') as ActionType;

              const approval = await approvalService.createApproval({
                userId,
                actionType,
                actionData: {
                  ...action.toolCall.input,
                  _toolName: action.toolCall.name
                },
                originalContent: formatActionContent(action.toolCall)
              });
              action.approvalId = approval.id;
            } catch (error) {
              console.error('Failed to create approval in chatStream:', error);
            }
          }

          // Append approval messages to the response
          const approvalMessages = pendingActions.map(a => {
            const input = a.toolCall.input;
            switch (a.toolCall.name) {
              case 'schedule_meeting':
                return `📅 **Meeting:** "${input.title}" - Check Pending Approvals to confirm`;
              case 'draft_email':
                return `📧 **Email:** "${input.subject}" - Check Pending Approvals to send`;
              case 'create_task':
                return `✅ **Task:** "${input.title}" - Check Pending Approvals to create`;
              default:
                return `⚡ **Action:** ${a.toolCall.name} - Awaiting approval`;
            }
          });
          finalResponse += '\n\n**Actions Pending Approval:**\n' + approvalMessages.join('\n');
        }

        return {
          response: finalResponse,
          requiresApproval: pendingActions.length > 0,
          pendingActions,
          toolsUsed: [...toolResults.map(tr => tr.toolName), ...pendingActions.map(a => a.toolCall.name)],
          toolResults,
          specialistUsed: specialist
        };
      }

      // No tool calls — just return the text
      return {
        response: textContent,
        requiresApproval: false,
        pendingActions: [],
        toolsUsed: [],
        toolResults: [],
        specialistUsed: specialist
      };
    } catch (error) {
      // Handle abort errors gracefully
      if (abortSignal?.aborted) {
        return {
          response: '',
          requiresApproval: false,
          pendingActions: [],
          toolsUsed: [],
          toolResults: [],
          specialistUsed: specialist
        };
      }
      console.error('Claude streaming API error:', error);
      return {
        response: `I encountered an error: ${(error as Error).message}`,
        requiresApproval: false,
        pendingActions: [],
        toolsUsed: [],
        toolResults: [],
        specialistUsed: specialist
      };
    }
  }
}

// Export singleton instance
export const workflowAgent = new WorkflowAgent();
