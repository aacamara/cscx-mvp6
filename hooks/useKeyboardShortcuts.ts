/**
 * useKeyboardShortcuts Hook
 * PRD-272: Keyboard Navigation
 *
 * Hook for registering component-level keyboard shortcuts.
 * Automatically registers on mount and unregisters on unmount.
 */

import { useEffect, useRef } from 'react';
import type { ShortcutDefinition } from '../types/keyboard';
import { useKeyboardContext } from '../context/KeyboardContext';

/**
 * Register keyboard shortcuts for a component
 *
 * @param shortcuts - Array of shortcut definitions to register
 * @param deps - Optional dependency array for re-registering shortcuts
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 'n',
 *     modifiers: ['ctrl'],
 *     description: 'Create new item',
 *     action: () => setShowCreateModal(true),
 *     category: 'actions',
 *   },
 *   {
 *     key: 'Delete',
 *     description: 'Delete selected item',
 *     action: handleDelete,
 *     enabled: () => selectedItem !== null,
 *     category: 'actions',
 *   },
 * ]);
 * ```
 */
export const useKeyboardShortcuts = (
  shortcuts: ShortcutDefinition[],
  deps: React.DependencyList = []
): void => {
  const { register, unregister } = useKeyboardContext();
  const shortcutsRef = useRef<ShortcutDefinition[]>([]);

  useEffect(() => {
    // Unregister previous shortcuts
    shortcutsRef.current.forEach((shortcut) => {
      unregister(shortcut);
    });

    // Register new shortcuts
    shortcuts.forEach((shortcut) => {
      register(shortcut);
    });

    // Store current shortcuts for cleanup
    shortcutsRef.current = shortcuts;

    // Cleanup on unmount
    return () => {
      shortcuts.forEach((shortcut) => {
        unregister(shortcut);
      });
    };
  }, [register, unregister, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * Register a single keyboard shortcut for a component
 *
 * @param shortcut - Shortcut definition to register
 * @param deps - Optional dependency array for re-registering
 *
 * @example
 * ```tsx
 * useKeyboardShortcut({
 *   key: 'Enter',
 *   modifiers: ['ctrl'],
 *   description: 'Submit form',
 *   action: handleSubmit,
 *   category: 'actions',
 * });
 * ```
 */
export const useKeyboardShortcut = (
  shortcut: ShortcutDefinition,
  deps: React.DependencyList = []
): void => {
  useKeyboardShortcuts([shortcut], deps);
};

export default useKeyboardShortcuts;
