/**
 * Natural Language Task Creation Types
 * PRD-234: Natural Language Task Creation
 *
 * Types for AI-powered task creation from natural language input.
 * Enables CSMs to create tasks using free-form text like
 * "follow up with Sarah next week about the renewal".
 */

// ============================================
// Core Types
// ============================================

export type TaskType =
  | 'follow_up'
  | 'send'
  | 'schedule'
  | 'review'
  | 'call'
  | 'email'
  | 'research'
  | 'meeting'
  | 'documentation'
  | 'other';

export type TaskPriority = 'high' | 'medium' | 'low';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

// ============================================
// Entity Extraction Types
// ============================================

/**
 * Matched customer from the database
 */
export interface CustomerMatch {
  id: string;
  name: string;
  match_confidence: number;
  arr?: number;
  health_score?: number;
  renewal_date?: string;
}

/**
 * Matched stakeholder/contact from customer contacts
 */
export interface StakeholderMatch {
  id: string;
  name: string;
  email?: string;
  title?: string;
  match_confidence: number;
}

/**
 * Extracted date information
 */
export interface DateExtraction {
  raw_text: string;
  parsed_date: string; // ISO date string
  is_relative: boolean;
  confidence: number;
}

/**
 * Extracted priority from language
 */
export interface PriorityExtraction {
  priority: TaskPriority;
  confidence: number;
  detected_keywords?: string[];
}

/**
 * Task type classification
 */
export interface TaskTypeExtraction {
  type: TaskType;
  confidence: number;
  detected_verbs?: string[];
}

/**
 * Related entity (meeting, email, deal, etc.)
 */
export interface RelatedEntity {
  type: 'meeting' | 'email' | 'deal' | 'ticket' | 'qbr' | 'other';
  id?: string;
  name?: string;
  confidence: number;
}

/**
 * Ambiguity detected during parsing
 */
export interface Ambiguity {
  field: string;
  issue: string;
  suggestions: string[];
}

// ============================================
// Parsed Task Types
// ============================================

/**
 * Entities extracted from natural language input
 */
export interface ParsedEntities {
  customer?: CustomerMatch;
  stakeholder?: StakeholderMatch;
  due_date?: DateExtraction;
  priority?: PriorityExtraction;
  task_type?: TaskTypeExtraction;
  related_to?: RelatedEntity;
}

/**
 * Result of parsing natural language task input
 */
export interface ParsedTask {
  raw_input: string;
  action_verb: string;
  description: string;
  entities: ParsedEntities;
  confidence: number;
  ambiguities: Ambiguity[];
}

/**
 * Suggested task ready for confirmation
 */
export interface SuggestedTask {
  title: string;
  description: string;
  customer_id?: string;
  customer_name?: string;
  stakeholder_id?: string;
  stakeholder_name?: string;
  due_date?: string;
  priority: TaskPriority;
  task_type: TaskType;
  notes?: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * User context for parsing
 */
export interface UserContext {
  current_customer_id?: string;
  current_customer_name?: string;
  timezone?: string;
  user_id?: string;
}

/**
 * Request to parse natural language task
 */
export interface ParseTaskRequest {
  input: string;
  context?: UserContext;
}

/**
 * Response from task parsing
 */
export interface ParseTaskResponse {
  success: boolean;
  parsed: ParsedTask;
  suggested_task: SuggestedTask;
  ambiguities: Ambiguity[];
  confirmations_needed: string[];
  error?: string;
}

/**
 * Request to create task from natural language
 */
export interface CreateTaskFromNLRequest {
  input: string;
  context?: UserContext;
  auto_confirm?: boolean;
  overrides?: Partial<SuggestedTask>;
}

/**
 * Response from task creation
 */
export interface CreateTaskFromNLResponse {
  success: boolean;
  task?: {
    id: string;
    title: string;
    description: string;
    customer_id?: string;
    customer_name?: string;
    due_date?: string;
    priority: TaskPriority;
    task_type: TaskType;
    status: 'pending' | 'in_progress' | 'completed';
    source: 'natural_language';
    source_input: string;
    parse_confidence: number;
    created_at: string;
  };
  needs_confirmation?: boolean;
  parsed?: ParsedTask;
  suggested_task?: SuggestedTask;
  error?: string;
}

/**
 * Single item in batch parse request
 */
export interface BatchParseItem {
  input: string;
  line_number?: number;
}

/**
 * Request to parse multiple tasks at once
 */
export interface BatchParseRequest {
  items: string[] | BatchParseItem[];
  source?: 'meeting_notes' | 'email' | 'manual' | 'voice';
  context?: UserContext;
}

/**
 * Single result in batch parse response
 */
export interface BatchParseResult {
  input: string;
  line_number?: number;
  success: boolean;
  parsed?: ParsedTask;
  suggested_task?: SuggestedTask;
  confidence: number;
  error?: string;
}

/**
 * Response from batch task parsing
 */
export interface BatchParseResponse {
  success: boolean;
  tasks: BatchParseResult[];
  total_parsed: number;
  high_confidence: number;
  needs_review: number;
  error?: string;
}

/**
 * Request to create multiple tasks from batch
 */
export interface BatchCreateRequest {
  tasks: Array<{
    input: string;
    overrides?: Partial<SuggestedTask>;
    confirmed: boolean;
  }>;
  context?: UserContext;
}

/**
 * Response from batch task creation
 */
export interface BatchCreateResponse {
  success: boolean;
  created: number;
  failed: number;
  tasks: Array<{
    input: string;
    success: boolean;
    task_id?: string;
    error?: string;
  }>;
}

// ============================================
// Hook State Types
// ============================================

/**
 * State for natural language task hook
 */
export interface NaturalLanguageTaskState {
  // Input handling
  input: string;
  isTyping: boolean;

  // Parsing state
  isParsing: boolean;
  parseError: string | null;
  parsed: ParsedTask | null;
  suggestedTask: SuggestedTask | null;
  ambiguities: Ambiguity[];
  confirmationsNeeded: string[];

  // Editing state
  isEditing: boolean;
  editedTask: Partial<SuggestedTask> | null;

  // Creation state
  isCreating: boolean;
  createError: string | null;
  createdTask: CreateTaskFromNLResponse['task'] | null;

  // Batch mode
  isBatchMode: boolean;
  batchItems: BatchParseResult[];
  selectedBatchItems: Set<number>;
}

/**
 * Return type for useNaturalLanguageTask hook
 */
export interface UseNaturalLanguageTaskReturn {
  state: NaturalLanguageTaskState;

  // Input actions
  setInput: (input: string) => void;
  clearInput: () => void;

  // Parse actions
  parseTask: (input?: string) => Promise<void>;
  parseBatch: (items: string[], source?: string) => Promise<void>;

  // Edit actions
  startEditing: () => void;
  updateEdit: (field: keyof SuggestedTask, value: unknown) => void;
  cancelEdit: () => void;

  // Create actions
  createTask: (overrides?: Partial<SuggestedTask>) => Promise<CreateTaskFromNLResponse>;
  createBatchTasks: (selectedOnly?: boolean) => Promise<BatchCreateResponse>;

  // Batch mode actions
  toggleBatchItem: (index: number) => void;
  selectAllBatchItems: () => void;
  deselectAllBatchItems: () => void;

  // Reset
  reset: () => void;
}

// ============================================
// Helper Types
// ============================================

/**
 * Priority keywords for extraction
 */
export const PRIORITY_KEYWORDS: Record<TaskPriority, string[]> = {
  high: ['urgent', 'asap', 'immediately', 'critical', 'important', 'high priority', 'priority'],
  medium: ['soon', 'this week', 'when possible', 'moderate'],
  low: ['eventually', 'when you can', 'low priority', 'nice to have', 'optional'],
};

/**
 * Task type keywords for extraction
 */
export const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  follow_up: ['follow up', 'follow-up', 'followup', 'check in', 'touch base', 'circle back'],
  send: ['send', 'email', 'share', 'forward', 'deliver'],
  schedule: ['schedule', 'book', 'set up', 'arrange', 'plan'],
  review: ['review', 'analyze', 'assess', 'evaluate', 'look at'],
  call: ['call', 'phone', 'ring', 'dial'],
  email: ['email', 'write', 'draft', 'compose'],
  research: ['research', 'investigate', 'look into', 'find out', 'explore'],
  meeting: ['meeting', 'meet', 'sync', 'huddle', 'discussion'],
  documentation: ['document', 'note', 'record', 'write up', 'capture'],
  other: [],
};

export default {
  PRIORITY_KEYWORDS,
  TASK_TYPE_KEYWORDS,
};
