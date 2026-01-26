/**
 * CSCX.AI Agent Builder Types
 * LangSmith-inspired natural language agent creation with memory
 */

// ============================================
// Agent Builder - Creation Phase
// ============================================

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  instructions: string;
  memoryBank: MemoryEntry[];
  triggers: AgentTrigger[];
  tools: AgentTool[];
  connections: ServiceConnection[];
  status: 'draft' | 'active' | 'paused' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface MetaPromptQuestion {
  id: string;
  question: string;
  context: string;
  required: boolean;
  answered: boolean;
  answer?: string;
}

export interface MetaPromptSession {
  id: string;
  initialDescription: string;
  questions: MetaPromptQuestion[];
  refinedPrompt: string;
  suggestedTools: string[];
  suggestedTriggers: string[];
  feasibilityCheck: {
    possible: boolean;
    missingCapabilities: string[];
    suggestions: string[];
  };
  status: 'questioning' | 'generating' | 'ready' | 'created';
}

// ============================================
// Memory System
// ============================================

export interface MemoryEntry {
  id: string;
  type: 'instruction' | 'preference' | 'learned_behavior' | 'context';
  content: string;
  source: 'initial' | 'user_feedback' | 'self_learned';
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface MemoryUpdate {
  entryId: string;
  oldContent: string;
  newContent: string;
  reason: string;
  triggeredBy: 'user_chat' | 'execution_feedback' | 'self_reflection';
  timestamp: Date;
}

// ============================================
// Triggers & Tools
// ============================================

export type TriggerType =
  | 'schedule'      // Cron-based (e.g., 6 AM daily)
  | 'event'         // Event-based (e.g., new customer added)
  | 'webhook'       // External webhook
  | 'manual'        // User-initiated
  | 'condition';    // Condition-based (e.g., health score < 60)

export interface AgentTrigger {
  id: string;
  type: TriggerType;
  name: string;
  description: string;
  config: {
    schedule?: string;  // Cron expression
    event?: string;     // Event name
    webhookUrl?: string;
    condition?: {
      field: string;
      operator: 'equals' | 'gt' | 'lt' | 'contains';
      value: any;
    };
  };
  enabled: boolean;
  lastTriggered?: Date;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'calendar' | 'data' | 'analysis' | 'notification' | 'integration';
  requiresAuth: boolean;
  connectedService?: string;
  parameters: ToolParameter[];
  enabled: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
}

// ============================================
// Service Connections (OAuth)
// ============================================

export type ServiceType =
  | 'google_calendar'
  | 'google_drive'
  | 'gmail'
  | 'slack'
  | 'microsoft_teams'
  | 'salesforce'
  | 'hubspot'
  | 'zoom'
  | 'jira';

export interface ServiceConnection {
  id: string;
  service: ServiceType;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  connectedAt?: Date;
  expiresAt?: Date;
  scopes: string[];
  userId?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Agent Threads & Inbox
// ============================================

export type ThreadStatus = 'idle' | 'busy' | 'interrupted' | 'errored' | 'completed';

export interface AgentThread {
  id: string;
  agentId: string;
  agentName: string;
  status: ThreadStatus;
  triggeredBy: TriggerType;
  triggeredAt: Date;
  completedAt?: Date;

  // Execution state
  currentStep: number;
  totalSteps: number;
  steps: ThreadStep[];

  // Interruption handling
  interruptionReason?: string;
  requiresAttention: boolean;
  notifiedUser: boolean;

  // Context
  customerContext?: {
    id: string;
    name: string;
  };

  // Output
  output?: any;
  error?: string;
}

export interface ThreadStep {
  id: string;
  order: number;
  toolName: string;
  toolInput: any;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;

  // Debug mode
  pausedForReview: boolean;
  userApproved?: boolean;
  userModifiedInput?: any;
}

// ============================================
// Debug Mode
// ============================================

export interface DebugSession {
  id: string;
  agentId: string;
  threadId: string;
  enabled: boolean;
  pauseBeforeTools: boolean;
  pauseBeforeExternal: boolean;  // Only pause for external API calls
  currentPausedStep?: string;
  userMessages: DebugMessage[];
  startedAt: Date;
}

export interface DebugMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  stepId?: string;
  action?: 'continue' | 'modify' | 'skip' | 'abort';
  modification?: any;
}

// ============================================
// Agent Inbox Notifications
// ============================================

export interface InboxNotification {
  id: string;
  threadId: string;
  agentId: string;
  agentName: string;
  type: 'needs_attention' | 'needs_auth' | 'error' | 'completed' | 'feedback_request';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  readAt?: Date;
  resolvedAt?: Date;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: 'reconnect' | 'retry' | 'dismiss' | 'view_thread' | 'provide_input';
}

// ============================================
// Available Tools & Triggers (Registry)
// ============================================

export const AVAILABLE_TOOLS: AgentTool[] = [
  // Communication
  {
    id: 'send_email',
    name: 'Send Email',
    description: 'Send an email via Gmail or Outlook',
    category: 'communication',
    requiresAuth: true,
    connectedService: 'gmail',
    parameters: [
      { name: 'to', type: 'string', required: true, description: 'Recipient email' },
      { name: 'subject', type: 'string', required: true, description: 'Email subject' },
      { name: 'body', type: 'string', required: true, description: 'Email body' },
    ],
    enabled: true,
  },
  {
    id: 'send_slack_dm',
    name: 'Send Slack DM',
    description: 'Send a direct message on Slack',
    category: 'communication',
    requiresAuth: true,
    connectedService: 'slack',
    parameters: [
      { name: 'userId', type: 'string', required: true, description: 'Slack user ID or email' },
      { name: 'message', type: 'string', required: true, description: 'Message content' },
    ],
    enabled: true,
  },
  // Calendar
  {
    id: 'read_calendar',
    name: 'Read Calendar',
    description: 'Read upcoming events from Google Calendar',
    category: 'calendar',
    requiresAuth: true,
    connectedService: 'google_calendar',
    parameters: [
      { name: 'days', type: 'number', required: false, description: 'Days ahead to check', default: 1 },
    ],
    enabled: true,
  },
  {
    id: 'create_meeting',
    name: 'Create Meeting',
    description: 'Schedule a meeting on the calendar',
    category: 'calendar',
    requiresAuth: true,
    connectedService: 'google_calendar',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Meeting title' },
      { name: 'attendees', type: 'array', required: true, description: 'List of attendee emails' },
      { name: 'startTime', type: 'string', required: true, description: 'Start time (ISO format)' },
      { name: 'duration', type: 'number', required: true, description: 'Duration in minutes' },
    ],
    enabled: true,
  },
  // Data & Analysis
  {
    id: 'get_customer_data',
    name: 'Get Customer Data',
    description: 'Retrieve customer information from CRM',
    category: 'data',
    requiresAuth: false,
    parameters: [
      { name: 'customerId', type: 'string', required: false, description: 'Customer ID (uses context if not provided)' },
    ],
    enabled: true,
  },
  {
    id: 'analyze_health_score',
    name: 'Analyze Health Score',
    description: 'Calculate and analyze customer health metrics',
    category: 'analysis',
    requiresAuth: false,
    parameters: [
      { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
      { name: 'includeRecommendations', type: 'boolean', required: false, description: 'Include improvement recommendations', default: true },
    ],
    enabled: true,
  },
  {
    id: 'detect_churn_risk',
    name: 'Detect Churn Risk',
    description: 'Analyze customer for churn signals',
    category: 'analysis',
    requiresAuth: false,
    parameters: [
      { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
    ],
    enabled: true,
  },
  // Notifications
  {
    id: 'notify_user',
    name: 'Notify User',
    description: 'Send notification to CSM (used when agent needs help)',
    category: 'notification',
    requiresAuth: false,
    parameters: [
      { name: 'message', type: 'string', required: true, description: 'Notification message' },
      { name: 'priority', type: 'string', required: false, description: 'Priority level', default: 'medium' },
    ],
    enabled: true,
  },
  {
    id: 'update_memory',
    name: 'Update Memory',
    description: 'Update agent instructions/memory based on feedback',
    category: 'data',
    requiresAuth: false,
    parameters: [
      { name: 'oldInstruction', type: 'string', required: true, description: 'Instruction to replace' },
      { name: 'newInstruction', type: 'string', required: true, description: 'New instruction' },
      { name: 'reason', type: 'string', required: true, description: 'Reason for update' },
    ],
    enabled: true,
  },
];

export const AVAILABLE_TRIGGERS: Omit<AgentTrigger, 'id'>[] = [
  {
    type: 'schedule',
    name: 'Daily Schedule',
    description: 'Run at a specific time every day',
    config: { schedule: '0 6 * * *' },
    enabled: true,
  },
  {
    type: 'schedule',
    name: 'Weekly Schedule',
    description: 'Run once a week',
    config: { schedule: '0 9 * * 1' },
    enabled: true,
  },
  {
    type: 'event',
    name: 'New Customer Added',
    description: 'Triggered when a new customer is created',
    config: { event: 'customer.created' },
    enabled: true,
  },
  {
    type: 'event',
    name: 'Health Score Changed',
    description: 'Triggered when customer health score changes significantly',
    config: { event: 'customer.health_changed' },
    enabled: true,
  },
  {
    type: 'condition',
    name: 'At-Risk Customer',
    description: 'Triggered when health score drops below threshold',
    config: { condition: { field: 'health_score', operator: 'lt', value: 60 } },
    enabled: true,
  },
  {
    type: 'manual',
    name: 'Manual Trigger',
    description: 'Run manually when requested',
    config: {},
    enabled: true,
  },
];

// ============================================
// Service Connection Definitions
// ============================================

export const AVAILABLE_SERVICES: Omit<ServiceConnection, 'id' | 'status' | 'connectedAt'>[] = [
  {
    service: 'google_calendar',
    name: 'Google Calendar',
    icon: '📅',
    scopes: ['calendar.readonly', 'calendar.events'],
  },
  {
    service: 'gmail',
    name: 'Gmail',
    icon: '✉️',
    scopes: ['gmail.send', 'gmail.readonly'],
  },
  {
    service: 'google_drive',
    name: 'Google Drive',
    icon: '📁',
    scopes: ['drive.readonly', 'drive.file'],
  },
  {
    service: 'slack',
    name: 'Slack',
    icon: '💬',
    scopes: ['chat:write', 'users:read'],
  },
  {
    service: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    scopes: ['api', 'refresh_token'],
  },
  {
    service: 'hubspot',
    name: 'HubSpot',
    icon: '🧡',
    scopes: ['contacts', 'deals'],
  },
  {
    service: 'zoom',
    name: 'Zoom',
    icon: '📹',
    scopes: ['meeting:write', 'recording:read'],
  },
  {
    service: 'jira',
    name: 'Jira',
    icon: '🎫',
    scopes: ['read:jira-work', 'write:jira-work'],
  },
];
