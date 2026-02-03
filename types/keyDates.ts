/**
 * Key Date Types (PRD-109)
 *
 * Type definitions for the Key Date Reminder feature.
 * Tracks important customer dates and generates timely reminders.
 */

// ============================================
// Date Type Enum
// ============================================

export type KeyDateType =
  | 'contract_anniversary'     // Contract start anniversary (FR-1.1)
  | 'renewal'                  // Renewal date (FR-1.2)
  | 'go_live_anniversary'      // Go-live anniversary (FR-1.3)
  | 'stakeholder_birthday'     // Stakeholder birthdays (FR-1.4)
  | 'company_founding'         // Company founding date (FR-1.5)
  | 'custom_milestone';        // Custom milestone dates (FR-1.6)

export type RecurrencePattern = 'yearly' | 'monthly' | 'quarterly' | 'none';

export type ReminderStatus = 'pending' | 'sent' | 'dismissed' | 'expired';

export type ReminderUrgency = 'low' | 'medium' | 'high' | 'critical';

// ============================================
// Core Types
// ============================================

export interface KeyDate {
  id: string;
  customerId: string;
  customerName?: string;
  stakeholderId?: string;
  stakeholderName?: string;
  dateType: KeyDateType;
  dateValue: string; // ISO date string (YYYY-MM-DD)
  title: string;
  description?: string;
  reminderDaysBefore: number;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  lastRemindedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KeyDateReminder {
  id: string;
  keyDateId: string;
  keyDate: KeyDate;
  scheduledFor: string;
  daysUntil: number;
  status: ReminderStatus;
  urgency: ReminderUrgency;
  suggestedActions: SuggestedAction[];
  customerContext: CustomerContext;
  sentAt?: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

export interface SuggestedAction {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'gift' | 'document' | 'task';
  title: string;
  description: string;
  priority: 'primary' | 'secondary';
  templateId?: string;
}

export interface CustomerContext {
  customerSince?: string;
  totalRevenue?: number;
  healthScore?: number;
  healthStatus?: 'excellent' | 'good' | 'at_risk' | 'critical';
  recentInteractions?: number;
  lastContactDate?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateKeyDateInput {
  customerId: string;
  stakeholderId?: string;
  dateType: KeyDateType;
  dateValue: string;
  title: string;
  description?: string;
  reminderDaysBefore?: number;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface UpdateKeyDateInput {
  dateType?: KeyDateType;
  dateValue?: string;
  title?: string;
  description?: string;
  reminderDaysBefore?: number;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface KeyDateFilters {
  customerId?: string;
  stakeholderId?: string;
  dateType?: KeyDateType;
  fromDate?: string;
  toDate?: string;
  upcoming?: boolean; // Only dates in the future
  search?: string;
}

export interface KeyDateListResponse {
  keyDates: KeyDate[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UpcomingRemindersResponse {
  reminders: KeyDateReminder[];
  summary: {
    total: number;
    byUrgency: Record<ReminderUrgency, number>;
    byType: Record<KeyDateType, number>;
  };
}

// ============================================
// Slack Alert Types
// ============================================

export interface KeyDateSlackAlert {
  customerId: string;
  customerName: string;
  keyDate: KeyDate;
  daysUntil: number;
  context: CustomerContext;
  suggestedActions: SuggestedAction[];
  buttons: SlackButton[];
}

export interface SlackButton {
  type: 'button';
  text: string;
  actionId: string;
  style?: 'primary' | 'danger';
  url?: string;
}

// ============================================
// Configuration
// ============================================

export interface ReminderConfig {
  defaultReminderDays: number;
  reminderLevels: number[]; // e.g., [7, 1] for 7 days and 1 day before
  excludeWeekends: boolean;
  slackChannelId?: string;
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  defaultReminderDays: 7,
  reminderLevels: [7, 1],
  excludeWeekends: true,
};

// ============================================
// Default Suggested Actions by Date Type
// ============================================

export const DEFAULT_SUGGESTED_ACTIONS: Record<KeyDateType, SuggestedAction[]> = {
  contract_anniversary: [
    {
      id: 'anniversary-email',
      type: 'email',
      title: 'Send Anniversary Email',
      description: 'Celebrate the partnership milestone with a personalized note',
      priority: 'primary',
    },
    {
      id: 'anniversary-roi',
      type: 'document',
      title: 'Share Value Summary',
      description: 'Generate and share an ROI/value summary report',
      priority: 'secondary',
    },
    {
      id: 'anniversary-call',
      type: 'call',
      title: 'Executive Thank-You Call',
      description: 'Consider scheduling a thank-you call with executive sponsor',
      priority: 'secondary',
    },
  ],
  renewal: [
    {
      id: 'renewal-prep',
      type: 'document',
      title: 'Prepare Renewal Package',
      description: 'Compile renewal proposal with usage data and recommendations',
      priority: 'primary',
    },
    {
      id: 'renewal-meeting',
      type: 'meeting',
      title: 'Schedule Renewal Discussion',
      description: 'Book a meeting to discuss renewal terms and expansion',
      priority: 'primary',
    },
    {
      id: 'renewal-checklist',
      type: 'task',
      title: 'Review Renewal Checklist',
      description: 'Ensure all renewal preparation steps are completed',
      priority: 'secondary',
    },
  ],
  go_live_anniversary: [
    {
      id: 'golive-email',
      type: 'email',
      title: 'Send Adoption Milestone Email',
      description: 'Celebrate successful adoption and share usage highlights',
      priority: 'primary',
    },
    {
      id: 'golive-review',
      type: 'meeting',
      title: 'Schedule Adoption Review',
      description: 'Review product adoption and identify optimization opportunities',
      priority: 'secondary',
    },
  ],
  stakeholder_birthday: [
    {
      id: 'birthday-wish',
      type: 'email',
      title: 'Send Birthday Wishes',
      description: 'Send a personalized birthday message',
      priority: 'primary',
    },
    {
      id: 'birthday-gift',
      type: 'gift',
      title: 'Consider a Small Gift',
      description: 'For key stakeholders, consider sending a thoughtful gift',
      priority: 'secondary',
    },
  ],
  company_founding: [
    {
      id: 'founding-congrats',
      type: 'email',
      title: 'Send Congratulations',
      description: 'Acknowledge the company milestone with a congratulatory note',
      priority: 'primary',
    },
  ],
  custom_milestone: [
    {
      id: 'custom-acknowledge',
      type: 'email',
      title: 'Acknowledge Milestone',
      description: 'Send a personalized acknowledgment message',
      priority: 'primary',
    },
    {
      id: 'custom-task',
      type: 'task',
      title: 'Create Follow-up Task',
      description: 'Set a reminder to follow up after the milestone',
      priority: 'secondary',
    },
  ],
};

// ============================================
// Hook Return Type
// ============================================

export interface UseKeyDatesReturn {
  // Data
  keyDates: KeyDate[];
  upcomingReminders: KeyDateReminder[];
  selectedKeyDate: KeyDate | null;

  // State
  loading: boolean;
  error: string | null;
  filters: KeyDateFilters;

  // Actions
  fetchKeyDates: (filters?: KeyDateFilters) => Promise<void>;
  fetchUpcomingReminders: (days?: number) => Promise<void>;
  createKeyDate: (input: CreateKeyDateInput) => Promise<KeyDate>;
  updateKeyDate: (id: string, input: UpdateKeyDateInput) => Promise<KeyDate>;
  deleteKeyDate: (id: string) => Promise<void>;
  dismissReminder: (reminderId: string) => Promise<void>;
  setFilters: (filters: Partial<KeyDateFilters>) => void;
  selectKeyDate: (keyDate: KeyDate | null) => void;
  clearError: () => void;
}

// ============================================
// Utility Types
// ============================================

export type DateTypeLabel = {
  [K in KeyDateType]: {
    label: string;
    icon: string;
    color: string;
  };
};

export const DATE_TYPE_CONFIG: DateTypeLabel = {
  contract_anniversary: {
    label: 'Contract Anniversary',
    icon: 'document',
    color: 'blue',
  },
  renewal: {
    label: 'Renewal Date',
    icon: 'refresh',
    color: 'purple',
  },
  go_live_anniversary: {
    label: 'Go-Live Anniversary',
    icon: 'rocket',
    color: 'green',
  },
  stakeholder_birthday: {
    label: 'Birthday',
    icon: 'cake',
    color: 'pink',
  },
  company_founding: {
    label: 'Company Founding',
    icon: 'building',
    color: 'amber',
  },
  custom_milestone: {
    label: 'Custom Milestone',
    icon: 'flag',
    color: 'cyan',
  },
};
