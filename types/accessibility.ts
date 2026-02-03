/**
 * CSCX.AI Accessibility Types
 * PRD-271: Screen Reader Optimization
 *
 * Type definitions for accessibility features including
 * live regions, announcements, and ARIA attributes.
 */

// ============================================
// Live Region Types
// ============================================

/**
 * Politeness levels for screen reader announcements
 * - 'polite': Waits for the user to finish current task
 * - 'assertive': Interrupts immediately (use sparingly)
 * - 'off': Disables announcements
 */
export type LiveRegionPoliteness = 'polite' | 'assertive' | 'off';

/**
 * What types of changes should be announced
 */
export type LiveRegionRelevant = 'additions' | 'removals' | 'text' | 'all';

/**
 * Configuration for a live region announcement
 */
export interface AnnouncementConfig {
  message: string;
  politeness?: LiveRegionPoliteness;
  clearAfter?: number; // ms to clear the announcement
}

// ============================================
// Sort State Types
// ============================================

/**
 * ARIA sort direction values
 */
export type AriaSortDirection = 'ascending' | 'descending' | 'none' | 'other';

/**
 * Sort configuration for tables
 */
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

// ============================================
// Health Score Types
// ============================================

/**
 * Health score verbal description
 */
export type HealthScoreLevel = 'excellent' | 'good' | 'needs attention' | 'critical';

/**
 * Trend direction for health scores
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Full health score description for screen readers
 */
export interface HealthScoreDescription {
  score: number;
  level: HealthScoreLevel;
  trend: TrendDirection;
  fullDescription: string;
}

// ============================================
// Chart Accessibility Types
// ============================================

/**
 * Data point for accessible charts
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  description?: string;
}

/**
 * Chart summary for screen readers
 */
export interface ChartSummary {
  title: string;
  type: string;
  dataPointCount: number;
  min: number;
  max: number;
  average: number;
  fullDescription: string;
}

// ============================================
// Table Accessibility Types
// ============================================

/**
 * Column definition with accessibility metadata
 */
export interface AccessibleColumn<T = unknown> {
  key: string;
  label: string;
  sortable?: boolean;
  description?: string;
  renderCell?: (row: T) => React.ReactNode;
  getCellDescription?: (row: T) => string;
}

/**
 * Table state for screen reader announcements
 */
export interface TableAccessibilityState {
  rowCount: number;
  columnCount: number;
  sortedBy?: string;
  sortDirection?: AriaSortDirection;
  filterActive?: boolean;
  selectedRowCount?: number;
}

// ============================================
// Focus Management Types
// ============================================

/**
 * Focus trap configuration
 */
export interface FocusTrapConfig {
  initialFocus?: string; // CSS selector for initial focus
  returnFocus?: boolean; // Return focus when trap is deactivated
  escapeDeactivates?: boolean; // Allow Escape key to deactivate
}

/**
 * Skip link destination
 */
export interface SkipLinkTarget {
  id: string;
  label: string;
}

// ============================================
// Screen Reader Preferences
// ============================================

/**
 * User preferences for screen reader experience
 */
export interface ScreenReaderPreferences {
  announceNewMessages: boolean;
  announceLoadingStates: boolean;
  announceDataChanges: boolean;
  verbosityLevel: 'minimal' | 'normal' | 'verbose';
  autoFocusNewContent: boolean;
}

/**
 * Default screen reader preferences
 */
export const DEFAULT_SCREEN_READER_PREFERENCES: ScreenReaderPreferences = {
  announceNewMessages: true,
  announceLoadingStates: true,
  announceDataChanges: true,
  verbosityLevel: 'normal',
  autoFocusNewContent: true,
};

// ============================================
// Component Props Types
// ============================================

/**
 * Common accessibility props for components
 */
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: LiveRegionPoliteness;
  'aria-busy'?: boolean;
  'aria-hidden'?: boolean;
  role?: string;
}

/**
 * Props for accessible form controls
 */
export interface AccessibleFormControlProps extends AccessibilityProps {
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  'aria-errormessage'?: string;
}

// ============================================
// Message Accessibility Types
// ============================================

/**
 * Accessible message for chat components
 */
export interface AccessibleMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  index?: number;
  total?: number;
  isStreaming?: boolean;
  isThinking?: boolean;
  toolCalls?: Array<{
    id: string;
    name: string;
    result?: string;
  }>;
}

/**
 * Message announcement configuration
 */
export interface MessageAnnouncementConfig {
  announceUserMessages: boolean;
  announceAssistantMessages: boolean;
  maxAnnouncementLength: number;
  includeTimestamp: boolean;
}

/**
 * Default message announcement configuration
 */
export const DEFAULT_MESSAGE_ANNOUNCEMENT_CONFIG: MessageAnnouncementConfig = {
  announceUserMessages: true,
  announceAssistantMessages: true,
  maxAnnouncementLength: 150,
  includeTimestamp: false,
};

// ============================================
// PRD-275: Reduced Motion Types
// ============================================

/**
 * Motion preference levels
 * - 'full': All animations enabled (default experience)
 * - 'partial': Reduced animations (150-200ms max)
 * - 'reduced': Minimal essential animations (50ms)
 * - 'none': No animations at all
 * - 'system': Follow OS prefers-reduced-motion preference
 */
export type MotionPreference = 'full' | 'partial' | 'reduced' | 'none' | 'system';

/**
 * Motion level configuration
 */
export interface MotionLevel {
  id: MotionPreference;
  label: string;
  description: string;
  animationDuration: string;
}

/**
 * Available motion levels for UI display
 */
export const MOTION_LEVELS: MotionLevel[] = [
  {
    id: 'full',
    label: 'Full Motion',
    description: 'All animations enabled',
    animationDuration: 'Default',
  },
  {
    id: 'partial',
    label: 'Partial',
    description: 'Subtle, quick animations only',
    animationDuration: '150ms max',
  },
  {
    id: 'reduced',
    label: 'Reduced',
    description: 'Minimal essential animations',
    animationDuration: '50ms',
  },
  {
    id: 'none',
    label: 'None',
    description: 'No animations at all',
    animationDuration: '0ms',
  },
  {
    id: 'system',
    label: 'System',
    description: 'Follow OS preference',
    animationDuration: 'Auto',
  },
];

/**
 * Motion preference state
 */
export interface MotionPreferenceState {
  userPreference: MotionPreference;
  systemPreference: boolean; // OS prefers-reduced-motion
  effectiveLevel: Exclude<MotionPreference, 'system'>;
}

/**
 * Default motion preference
 */
export const DEFAULT_MOTION_PREFERENCE: MotionPreference = 'system';
