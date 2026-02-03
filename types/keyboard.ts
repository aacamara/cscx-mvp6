/**
 * CSCX.AI Keyboard Navigation Types
 * PRD-272: Keyboard Navigation
 *
 * Type definitions for keyboard shortcuts, focus management,
 * roving tabindex, and accessible navigation patterns.
 */

// ============================================
// Keyboard Modifier Types
// ============================================

/**
 * Keyboard modifier keys
 */
export type KeyboardModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

/**
 * Platform-specific modifier (Cmd on Mac, Ctrl on Windows/Linux)
 */
export type PlatformModifier = 'mod';

// ============================================
// Shortcut Definition Types
// ============================================

/**
 * Definition of a keyboard shortcut
 */
export interface ShortcutDefinition {
  /** The key to trigger the shortcut (e.g., 'k', 'Enter', 'Escape') */
  key: string;
  /** Modifier keys required (ctrl, alt, shift, meta) */
  modifiers?: KeyboardModifier[];
  /** Human-readable description for help overlay */
  description: string;
  /** Function to execute when shortcut is triggered */
  action: () => void;
  /** Optional context (page/component) where shortcut is active */
  context?: string;
  /** Optional function to check if shortcut is currently enabled */
  enabled?: () => boolean;
  /** Optional category for grouping in help overlay */
  category?: ShortcutCategory;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
}

/**
 * Categories for organizing shortcuts in help overlay
 */
export type ShortcutCategory =
  | 'navigation'
  | 'actions'
  | 'editing'
  | 'search'
  | 'help'
  | 'modal'
  | 'custom';

/**
 * Grouped shortcuts for display
 */
export interface ShortcutGroup {
  category: ShortcutCategory;
  label: string;
  shortcuts: ShortcutDefinition[];
}

// ============================================
// Go-To Mode Types
// ============================================

/**
 * Go-to navigation targets (g then key)
 */
export interface GoToTarget {
  key: string;
  label: string;
  path?: string;
  action?: () => void;
}

/**
 * Go-to mode state
 */
export interface GoToModeState {
  isActive: boolean;
  targets: GoToTarget[];
  timeoutId?: ReturnType<typeof setTimeout>;
}

// ============================================
// Focus Management Types
// ============================================

/**
 * Focus trap options
 */
export interface FocusTrapOptions {
  /** CSS selector for initial focus element */
  initialFocus?: string;
  /** Return focus to previous element when trap is released */
  returnFocus?: boolean;
  /** Allow Escape key to release trap */
  escapeDeactivates?: boolean;
  /** Callback when trap is activated */
  onActivate?: () => void;
  /** Callback when trap is deactivated */
  onDeactivate?: () => void;
  /** Callback when user tries to tab out of trap */
  onTabOut?: () => void;
}

/**
 * Focus restoration state
 */
export interface FocusRestoreState {
  previousElement: HTMLElement | null;
  savedAt: number;
}

// ============================================
// Roving Tab Index Types
// ============================================

/**
 * Orientation for roving tabindex navigation
 */
export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

/**
 * Options for roving tabindex hook
 */
export interface RovingTabIndexOptions {
  /** Navigation orientation */
  orientation?: RovingOrientation;
  /** Loop from end to start (and vice versa) */
  loop?: boolean;
  /** Starting index */
  initialIndex?: number;
  /** Callback when focus changes */
  onFocusChange?: (index: number) => void;
  /** Enable Home/End key navigation */
  enableHomeEnd?: boolean;
  /** Enable Page Up/Down navigation (for large lists) */
  enablePageNavigation?: boolean;
  /** Number of items to skip with Page Up/Down */
  pageSize?: number;
}

/**
 * Return type for roving tabindex hook
 */
export interface RovingTabIndexReturn<T extends HTMLElement> {
  /** Current focused index */
  focusedIndex: number;
  /** Set focused index programmatically */
  setFocusedIndex: (index: number) => void;
  /** Get tabIndex for an item */
  getTabIndex: (index: number) => 0 | -1;
  /** Get ref setter for an item */
  setRef: (index: number) => (el: T | null) => void;
  /** Keyboard event handler */
  handleKeyDown: (e: React.KeyboardEvent, index: number) => void;
  /** Focus a specific item */
  focusItem: (index: number) => void;
}

// ============================================
// Grid Navigation Types
// ============================================

/**
 * Options for grid navigation (data tables)
 */
export interface GridNavigationOptions {
  /** Number of columns in the grid */
  columnCount: number;
  /** Number of rows in the grid */
  rowCount: number;
  /** Loop navigation within rows */
  loopRows?: boolean;
  /** Loop navigation within columns */
  loopColumns?: boolean;
  /** Callback when cell focus changes */
  onCellChange?: (row: number, column: number) => void;
}

/**
 * Grid cell position
 */
export interface GridPosition {
  row: number;
  column: number;
}

// ============================================
// Type-Ahead Types
// ============================================

/**
 * Options for type-ahead search in lists
 */
export interface TypeAheadOptions {
  /** Timeout before resetting search string (ms) */
  timeout?: number;
  /** Function to get searchable text from item */
  getItemText: (index: number) => string;
  /** Callback when match is found */
  onMatch?: (index: number) => void;
}

/**
 * Type-ahead state
 */
export interface TypeAheadState {
  searchString: string;
  lastKeyTime: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

// ============================================
// Keyboard Manager State
// ============================================

/**
 * Global keyboard manager state
 */
export interface KeyboardManagerState {
  /** All registered shortcuts */
  shortcuts: Map<string, ShortcutDefinition>;
  /** Is help overlay open */
  isHelpOpen: boolean;
  /** Is go-to mode active */
  goToMode: GoToModeState;
  /** Current context (for context-specific shortcuts) */
  currentContext: string | null;
  /** Paused state (for when modals are open, etc.) */
  isPaused: boolean;
}

// ============================================
// Keyboard Context Types
// ============================================

/**
 * Context value for keyboard shortcut manager
 */
export interface KeyboardContextValue {
  /** Register a shortcut */
  register: (shortcut: ShortcutDefinition) => void;
  /** Unregister a shortcut */
  unregister: (shortcut: ShortcutDefinition) => void;
  /** Show help overlay */
  showHelp: () => void;
  /** Hide help overlay */
  hideHelp: () => void;
  /** Is help overlay visible */
  isHelpOpen: boolean;
  /** Set current context */
  setContext: (context: string | null) => void;
  /** Get current context */
  currentContext: string | null;
  /** Pause all shortcuts */
  pause: () => void;
  /** Resume all shortcuts */
  resume: () => void;
  /** Is manager paused */
  isPaused: boolean;
  /** Get all shortcuts grouped by category */
  getGroupedShortcuts: () => ShortcutGroup[];
}

// ============================================
// Skip Link Types
// ============================================

/**
 * Skip link target
 */
export interface SkipLinkTarget {
  id: string;
  label: string;
}

/**
 * Default skip links
 */
export const DEFAULT_SKIP_LINKS: SkipLinkTarget[] = [
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'main-nav', label: 'Skip to navigation' },
  { id: 'search', label: 'Skip to search' },
];

// ============================================
// Shortcut Category Labels
// ============================================

/**
 * Human-readable labels for shortcut categories
 */
export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  editing: 'Editing',
  search: 'Search',
  help: 'Help',
  modal: 'Modals & Dialogs',
  custom: 'Custom',
};

// ============================================
// Default Shortcuts
// ============================================

/**
 * Platform detection
 */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Get modifier key symbol for display
 */
export const getModifierSymbol = (modifier: KeyboardModifier): string => {
  switch (modifier) {
    case 'ctrl':
      return isMac ? '^' : 'Ctrl';
    case 'alt':
      return isMac ? 'Option' : 'Alt';
    case 'shift':
      return 'Shift';
    case 'meta':
      return isMac ? 'Cmd' : 'Win';
    default:
      return modifier;
  }
};

/**
 * Format shortcut for display
 */
export const formatShortcut = (shortcut: ShortcutDefinition): string => {
  const parts: string[] = [];

  if (shortcut.modifiers) {
    parts.push(...shortcut.modifiers.map(getModifierSymbol));
  }

  // Format special keys
  let key = shortcut.key;
  switch (key.toLowerCase()) {
    case 'arrowup':
      key = isMac ? '\u2191' : 'Up';
      break;
    case 'arrowdown':
      key = isMac ? '\u2193' : 'Down';
      break;
    case 'arrowleft':
      key = isMac ? '\u2190' : 'Left';
      break;
    case 'arrowright':
      key = isMac ? '\u2192' : 'Right';
      break;
    case 'enter':
      key = isMac ? '\u21B5' : 'Enter';
      break;
    case 'escape':
      key = 'Esc';
      break;
    case ' ':
      key = 'Space';
      break;
    default:
      key = key.toUpperCase();
  }

  parts.push(key);

  return parts.join(isMac ? '' : ' + ');
};
