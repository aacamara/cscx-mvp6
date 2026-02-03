/**
 * KeyboardShortcutsHelp Component
 * PRD-272: Keyboard Navigation
 *
 * Modal overlay showing all available keyboard shortcuts,
 * organized by category.
 */

import React, { useRef, useEffect } from 'react';
import { useKeyboardContext } from '../../context/KeyboardContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatShortcut, SHORTCUT_CATEGORY_LABELS } from '../../types/keyboard';
import type { ShortcutCategory } from '../../types/keyboard';

/**
 * Category icons for visual organization
 */
const CATEGORY_ICONS: Record<ShortcutCategory, string> = {
  navigation: '\u2192', // Right arrow
  search: '\uD83D\uDD0D', // Magnifying glass
  actions: '\u26A1', // Lightning
  editing: '\u270F\uFE0F', // Pencil
  modal: '\u2395', // Window
  help: '\u2753', // Question mark
  custom: '\u2699\uFE0F', // Gear
};

/**
 * Keyboard shortcuts help overlay
 *
 * Opens when user presses Shift + ? and shows all available shortcuts.
 *
 * @example
 * ```tsx
 * // Add to your app layout (usually near the root):
 * <KeyboardProvider>
 *   <App />
 *   <KeyboardShortcutsHelp />
 * </KeyboardProvider>
 * ```
 */
export const KeyboardShortcutsHelp: React.FC = () => {
  const { isHelpOpen, hideHelp, getGroupedShortcuts } = useKeyboardContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Trap focus when open
  useFocusTrap(containerRef, {
    escapeDeactivates: true,
    onDeactivate: hideHelp,
    initialFocus: '.close-button',
  });

  // Get grouped shortcuts
  const groups = getGroupedShortcuts();

  if (!isHelpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        ref={containerRef}
        className="w-full max-w-2xl max-h-[80vh] mx-4 bg-cscx-gray-900 border border-cscx-gray-700 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cscx-gray-700">
          <h2
            id="shortcuts-title"
            className="text-xl font-semibold text-white flex items-center gap-2"
          >
            <span className="text-cscx-accent">\u2328</span>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={hideHelp}
            className="close-button p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
            aria-label="Close shortcuts help"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-120px)] p-6">
          {groups.length === 0 ? (
            <p className="text-cscx-gray-400 text-center py-8">
              No keyboard shortcuts available.
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.category}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-cscx-accent uppercase tracking-wider mb-3">
                    <span>{CATEGORY_ICONS[group.category]}</span>
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div
                        key={`${shortcut.key}-${index}`}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-cscx-gray-800 transition-colors"
                      >
                        <span className="text-cscx-gray-300 text-sm">
                          {shortcut.description}
                        </span>
                        <kbd
                          className="ml-4 px-2 py-1 bg-cscx-gray-800 border border-cscx-gray-600 rounded text-xs font-mono text-white min-w-[40px] text-center"
                        >
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cscx-gray-700 bg-cscx-gray-900/50">
          <p className="text-xs text-cscx-gray-400 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-cscx-gray-800 rounded text-cscx-accent font-mono">Esc</kbd> to close
            {' \u2022 '}
            Press <kbd className="px-1.5 py-0.5 bg-cscx-gray-800 rounded text-cscx-accent font-mono">Shift + ?</kbd> to open
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
