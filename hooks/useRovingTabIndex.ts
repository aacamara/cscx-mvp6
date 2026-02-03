/**
 * useRovingTabIndex Hook
 * PRD-272: Keyboard Navigation
 *
 * Implements the roving tabindex pattern for toolbars, menus, and lists.
 * Only one item has tabindex="0", all others have tabindex="-1".
 * Arrow keys navigate between items.
 */

import { useState, useRef, useCallback } from 'react';
import type {
  RovingTabIndexOptions,
  RovingTabIndexReturn,
} from '../types/keyboard';

/**
 * Implement roving tabindex for keyboard navigation
 *
 * @param itemCount - Number of items in the list
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const Toolbar: React.FC<{ items: ToolbarItem[] }> = ({ items }) => {
 *   const { handleKeyDown, getTabIndex, setRef } = useRovingTabIndex<HTMLButtonElement>(
 *     items.length,
 *     { orientation: 'horizontal' }
 *   );
 *
 *   return (
 *     <div role="toolbar" aria-label="Actions">
 *       {items.map((item, index) => (
 *         <button
 *           key={item.id}
 *           ref={setRef(index)}
 *           tabIndex={getTabIndex(index)}
 *           onKeyDown={(e) => handleKeyDown(e, index)}
 *           onClick={item.onClick}
 *         >
 *           {item.label}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * };
 * ```
 */
export const useRovingTabIndex = <T extends HTMLElement>(
  itemCount: number,
  options: RovingTabIndexOptions = {}
): RovingTabIndexReturn<T> => {
  const {
    orientation = 'horizontal',
    loop = true,
    initialIndex = 0,
    onFocusChange,
    enableHomeEnd = true,
    enablePageNavigation = false,
    pageSize = 10,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const itemRefs = useRef<(T | null)[]>([]);

  /**
   * Get the next index based on direction
   */
  const getNextIndex = useCallback(
    (currentIndex: number, direction: 1 | -1): number => {
      const nextIndex = currentIndex + direction;

      if (loop) {
        if (nextIndex < 0) return itemCount - 1;
        if (nextIndex >= itemCount) return 0;
        return nextIndex;
      }

      return Math.max(0, Math.min(nextIndex, itemCount - 1));
    },
    [itemCount, loop]
  );

  /**
   * Get page navigation index
   */
  const getPageIndex = useCallback(
    (currentIndex: number, direction: 1 | -1): number => {
      const nextIndex = currentIndex + direction * pageSize;

      if (loop) {
        if (nextIndex < 0) return Math.max(0, itemCount + nextIndex);
        if (nextIndex >= itemCount) return nextIndex % itemCount;
        return nextIndex;
      }

      return Math.max(0, Math.min(nextIndex, itemCount - 1));
    },
    [itemCount, loop, pageSize]
  );

  /**
   * Focus a specific item
   */
  const focusItem = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));
      setFocusedIndex(clampedIndex);
      onFocusChange?.(clampedIndex);

      // Focus the element
      requestAnimationFrame(() => {
        itemRefs.current[clampedIndex]?.focus();
      });
    },
    [itemCount, onFocusChange]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number): void => {
      let nextIndex: number | null = null;

      switch (e.key) {
        // Horizontal navigation
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') {
            nextIndex = getNextIndex(index, 1);
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') {
            nextIndex = getNextIndex(index, -1);
          }
          break;

        // Vertical navigation
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') {
            nextIndex = getNextIndex(index, 1);
          }
          break;

        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') {
            nextIndex = getNextIndex(index, -1);
          }
          break;

        // Home/End
        case 'Home':
          if (enableHomeEnd) {
            nextIndex = 0;
          }
          break;

        case 'End':
          if (enableHomeEnd) {
            nextIndex = itemCount - 1;
          }
          break;

        // Page Up/Down
        case 'PageUp':
          if (enablePageNavigation) {
            nextIndex = getPageIndex(index, -1);
          }
          break;

        case 'PageDown':
          if (enablePageNavigation) {
            nextIndex = getPageIndex(index, 1);
          }
          break;
      }

      if (nextIndex !== null && nextIndex !== index) {
        e.preventDefault();
        focusItem(nextIndex);
      }
    },
    [
      orientation,
      enableHomeEnd,
      enablePageNavigation,
      itemCount,
      getNextIndex,
      getPageIndex,
      focusItem,
    ]
  );

  /**
   * Get tabIndex for an item
   */
  const getTabIndex = useCallback(
    (index: number): 0 | -1 => {
      return index === focusedIndex ? 0 : -1;
    },
    [focusedIndex]
  );

  /**
   * Set ref for an item
   */
  const setRef = useCallback(
    (index: number) => (el: T | null) => {
      itemRefs.current[index] = el;
    },
    []
  );

  return {
    focusedIndex,
    setFocusedIndex: focusItem,
    getTabIndex,
    setRef,
    handleKeyDown,
    focusItem,
  };
};

/**
 * Roving tabindex with type-ahead search
 *
 * @param itemCount - Number of items
 * @param getItemText - Function to get searchable text for each item
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const Menu: React.FC<{ items: MenuItem[] }> = ({ items }) => {
 *   const { handleKeyDown, getTabIndex, setRef } = useRovingTabIndexWithTypeAhead(
 *     items.length,
 *     (index) => items[index].label,
 *     { orientation: 'vertical' }
 *   );
 *
 *   return (
 *     <ul role="menu">
 *       {items.map((item, index) => (
 *         <li
 *           key={item.id}
 *           ref={setRef(index)}
 *           role="menuitem"
 *           tabIndex={getTabIndex(index)}
 *           onKeyDown={(e) => handleKeyDown(e, index)}
 *         >
 *           {item.label}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * };
 * ```
 */
export const useRovingTabIndexWithTypeAhead = <T extends HTMLElement>(
  itemCount: number,
  getItemText: (index: number) => string,
  options: RovingTabIndexOptions & { typeAheadTimeout?: number } = {}
): RovingTabIndexReturn<T> & { searchString: string } => {
  const { typeAheadTimeout = 500, ...rovingOptions } = options;
  const baseReturn = useRovingTabIndex<T>(itemCount, rovingOptions);

  const searchStringRef = useRef('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchString, setSearchString] = useState('');

  /**
   * Enhanced keyboard handler with type-ahead
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number): void => {
      // Check if it's a character key for type-ahead
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }

        // Update search string
        const newSearchString = searchStringRef.current + e.key.toLowerCase();
        searchStringRef.current = newSearchString;
        setSearchString(newSearchString);

        // Find matching item
        for (let i = 0; i < itemCount; i++) {
          const searchIndex = (index + 1 + i) % itemCount;
          const text = getItemText(searchIndex).toLowerCase();
          if (text.startsWith(newSearchString)) {
            e.preventDefault();
            baseReturn.focusItem(searchIndex);
            break;
          }
        }

        // Set timeout to clear search string
        searchTimeoutRef.current = setTimeout(() => {
          searchStringRef.current = '';
          setSearchString('');
        }, typeAheadTimeout);

        return;
      }

      // Fall back to base handler
      baseReturn.handleKeyDown(e, index);
    },
    [baseReturn, getItemText, itemCount, typeAheadTimeout]
  );

  return {
    ...baseReturn,
    handleKeyDown,
    searchString,
  };
};

export default useRovingTabIndex;
