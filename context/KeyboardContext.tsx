/**
 * CSCX.AI Keyboard Shortcut Context
 * PRD-272: Keyboard Navigation
 *
 * Global keyboard shortcut manager that handles:
 * - Registering/unregistering shortcuts
 * - Go-to mode navigation
 * - Help overlay display
 * - Context-aware shortcuts
 * - Conflict detection
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import type {
  ShortcutDefinition,
  ShortcutGroup,
  ShortcutCategory,
  KeyboardContextValue,
  GoToModeState,
  KeyboardModifier,
} from '../types/keyboard';
import { SHORTCUT_CATEGORY_LABELS } from '../types/keyboard';

// ============================================
// Context Definition
// ============================================

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique key for a shortcut
 */
const getShortcutKey = (shortcut: ShortcutDefinition): string => {
  const mods = shortcut.modifiers?.sort().join('+') || '';
  const context = shortcut.context || 'global';
  return `${context}:${mods ? `${mods}+` : ''}${shortcut.key.toLowerCase()}`;
};

/**
 * Build key string from keyboard event
 */
const buildKeyString = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  // Only include shift for non-character keys or with other modifiers
  if (e.shiftKey && (e.key.length > 1 || parts.length > 0)) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
};

/**
 * Check if element is an input field
 */
const isInputElement = (element: Element | null): boolean => {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  const isEditable = element.getAttribute('contenteditable') === 'true';
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable;
};

// ============================================
// Provider Component
// ============================================

interface KeyboardProviderProps {
  children: React.ReactNode;
}

export const KeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  // State
  const [shortcuts, setShortcuts] = useState<Map<string, ShortcutDefinition>>(new Map());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [goToMode, setGoToMode] = useState<GoToModeState>({
    isActive: false,
    targets: [],
  });
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Refs
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  // ============================================
  // Go-To Mode Handlers
  // ============================================

  const activateGoToMode = useCallback(() => {
    // Define go-to targets
    const targets = [
      { key: 'd', label: 'Dashboard', action: () => window.location.hash = '#observability' },
      { key: 'c', label: 'Customers', action: () => window.location.hash = '#customers' },
      { key: 'a', label: 'Agent Center', action: () => window.location.hash = '#agent-center' },
      { key: 's', label: 'Agent Studio', action: () => window.location.hash = '#agent-studio' },
      { key: 'k', label: 'Knowledge Base', action: () => window.location.hash = '#knowledge-base' },
    ];

    const timeoutId = setTimeout(() => {
      setGoToMode({ isActive: false, targets: [] });
    }, 2000);

    setGoToMode({ isActive: true, targets, timeoutId });
  }, []);

  const handleGoToKey = useCallback((key: string) => {
    const target = goToMode.targets.find((t) => t.key.toLowerCase() === key.toLowerCase());
    if (target) {
      if (goToMode.timeoutId) {
        clearTimeout(goToMode.timeoutId);
      }
      setGoToMode({ isActive: false, targets: [] });
      if (target.action) {
        target.action();
      } else if (target.path) {
        window.location.href = target.path;
      }
    } else {
      // Invalid key, cancel go-to mode
      if (goToMode.timeoutId) {
        clearTimeout(goToMode.timeoutId);
      }
      setGoToMode({ isActive: false, targets: [] });
    }
  }, [goToMode]);

  // ============================================
  // Keyboard Event Handler
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if paused
      if (isPaused) return;

      // Handle go-to mode
      if (goToMode.isActive) {
        e.preventDefault();
        handleGoToKey(e.key);
        return;
      }

      // Skip in input fields unless it's a global shortcut with modifiers
      if (isInputElement(e.target as Element)) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) return;
      }

      // Build key string and find matching shortcut
      const keyString = buildKeyString(e);

      // Check for context-specific shortcut first
      let shortcut: ShortcutDefinition | undefined;
      if (currentContext) {
        shortcut = shortcutsRef.current.get(`${currentContext}:${keyString}`);
      }

      // Fall back to global shortcut
      if (!shortcut) {
        shortcut = shortcutsRef.current.get(`global:${keyString}`);
      }

      if (shortcut && (!shortcut.enabled || shortcut.enabled())) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, goToMode, currentContext, handleGoToKey]);

  // ============================================
  // Register Default Shortcuts
  // ============================================

  useEffect(() => {
    // Help shortcut (Shift + ?)
    const helpShortcut: ShortcutDefinition = {
      key: '?',
      modifiers: ['shift'],
      description: 'Show keyboard shortcuts',
      action: () => setIsHelpOpen(true),
      category: 'help',
    };

    // Search shortcut (/)
    const searchShortcut: ShortcutDefinition = {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.getElementById('global-search') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      category: 'search',
    };

    // Go-to mode (g)
    const goToShortcut: ShortcutDefinition = {
      key: 'g',
      description: 'Go to... (then d for dashboard, c for customers, etc.)',
      action: activateGoToMode,
      category: 'navigation',
    };

    // Escape (close modals/overlays)
    const escapeShortcut: ShortcutDefinition = {
      key: 'Escape',
      description: 'Close modal or overlay',
      action: () => {
        if (isHelpOpen) {
          setIsHelpOpen(false);
        }
      },
      category: 'modal',
    };

    // Register defaults
    const defaultShortcuts: ShortcutDefinition[] = [
      helpShortcut,
      searchShortcut,
      goToShortcut,
      escapeShortcut,
    ];

    const newShortcuts = new Map(shortcuts);
    defaultShortcuts.forEach((s) => {
      newShortcuts.set(getShortcutKey(s), s);
    });
    setShortcuts(newShortcuts);

    // Cleanup not needed as we want these to persist
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // Context Methods
  // ============================================

  const register = useCallback((shortcut: ShortcutDefinition) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      const key = getShortcutKey(shortcut);

      // Check for conflicts
      if (next.has(key)) {
        console.warn(
          `Keyboard shortcut conflict: "${key}" is already registered. ` +
          `Overwriting "${next.get(key)?.description}" with "${shortcut.description}".`
        );
      }

      next.set(key, shortcut);
      return next;
    });
  }, []);

  const unregister = useCallback((shortcut: ShortcutDefinition) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.delete(getShortcutKey(shortcut));
      return next;
    });
  }, []);

  const showHelp = useCallback(() => setIsHelpOpen(true), []);
  const hideHelp = useCallback(() => setIsHelpOpen(false), []);

  const setContext = useCallback((context: string | null) => {
    setCurrentContext(context);
  }, []);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  const getGroupedShortcuts = useCallback((): ShortcutGroup[] => {
    const groups: Map<ShortcutCategory, ShortcutDefinition[]> = new Map();

    shortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'custom';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(shortcut);
    });

    const result: ShortcutGroup[] = [];
    const categoryOrder: ShortcutCategory[] = [
      'navigation',
      'search',
      'actions',
      'editing',
      'modal',
      'help',
      'custom',
    ];

    categoryOrder.forEach((category) => {
      const shortcuts = groups.get(category);
      if (shortcuts && shortcuts.length > 0) {
        result.push({
          category,
          label: SHORTCUT_CATEGORY_LABELS[category],
          shortcuts,
        });
      }
    });

    return result;
  }, [shortcuts]);

  // ============================================
  // Context Value
  // ============================================

  const value: KeyboardContextValue = useMemo(
    () => ({
      register,
      unregister,
      showHelp,
      hideHelp,
      isHelpOpen,
      setContext,
      currentContext,
      pause,
      resume,
      isPaused,
      getGroupedShortcuts,
    }),
    [
      register,
      unregister,
      showHelp,
      hideHelp,
      isHelpOpen,
      setContext,
      currentContext,
      pause,
      resume,
      isPaused,
      getGroupedShortcuts,
    ]
  );

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      {/* Go-to mode indicator */}
      {goToMode.isActive && (
        <div
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50
                     bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg
                     px-4 py-3 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <p className="text-white text-sm font-medium mb-2">Go to...</p>
          <div className="flex gap-3">
            {goToMode.targets.map((target) => (
              <span
                key={target.key}
                className="inline-flex items-center gap-1 text-xs text-cscx-gray-300"
              >
                <kbd className="px-1.5 py-0.5 bg-cscx-gray-800 rounded text-cscx-accent font-mono">
                  {target.key}
                </kbd>
                {target.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </KeyboardContext.Provider>
  );
};

// ============================================
// Hook
// ============================================

export const useKeyboardContext = (): KeyboardContextValue => {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboardContext must be used within a KeyboardProvider');
  }
  return context;
};

export default KeyboardContext;
