/**
 * AccessibleDropdown Component
 * PRD-272: Keyboard Navigation
 *
 * Fully keyboard-accessible dropdown menu with:
 * - Arrow key navigation
 * - Type-ahead search
 * - Escape to close
 * - Enter/Space to select
 * - Home/End navigation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRovingTabIndexWithTypeAhead } from '../../hooks/useRovingTabIndex';
import { useFocusRestore } from '../../hooks/useFocusRestore';

interface DropdownItem {
  id: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
}

interface AccessibleDropdownProps {
  /** Items to display in the dropdown */
  items: DropdownItem[];
  /** Currently selected item ID */
  selectedId?: string;
  /** Callback when an item is selected */
  onSelect: (item: DropdownItem) => void;
  /** Trigger button content */
  trigger: React.ReactNode;
  /** Dropdown label for accessibility */
  label: string;
  /** Optional placeholder when nothing is selected */
  placeholder?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Optional class name for the container */
  className?: string;
}

/**
 * Accessible dropdown with full keyboard support
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const [selected, setSelected] = useState<string | undefined>();
 *   const items = [
 *     { id: '1', label: 'Option 1' },
 *     { id: '2', label: 'Option 2' },
 *     { id: '3', label: 'Option 3' },
 *   ];
 *
 *   return (
 *     <AccessibleDropdown
 *       items={items}
 *       selectedId={selected}
 *       onSelect={(item) => setSelected(item.id)}
 *       trigger={<span>{selected || 'Select an option'}</span>}
 *       label="Select option"
 *     />
 *   );
 * };
 * ```
 */
export const AccessibleDropdown: React.FC<AccessibleDropdownProps> = ({
  items,
  selectedId,
  onSelect,
  trigger,
  label,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { saveFocus, restoreFocus } = useFocusRestore();

  // Get active (non-disabled) items
  const activeItems = items.filter((item) => !item.disabled);

  // Find initial index based on selected item
  const selectedIndex = selectedId
    ? activeItems.findIndex((item) => item.id === selectedId)
    : 0;

  // Roving tabindex with type-ahead
  const {
    handleKeyDown: rovingHandleKeyDown,
    getTabIndex,
    setRef,
    focusItem,
    searchString,
  } = useRovingTabIndexWithTypeAhead<HTMLLIElement>(
    activeItems.length,
    (index) => activeItems[index]?.label || '',
    {
      orientation: 'vertical',
      loop: true,
      initialIndex: Math.max(0, selectedIndex),
    }
  );

  // Open dropdown
  const openDropdown = useCallback(() => {
    if (disabled) return;
    saveFocus();
    setIsOpen(true);
  }, [disabled, saveFocus]);

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    restoreFocus();
  }, [restoreFocus]);

  // Handle item selection
  const handleSelect = useCallback(
    (item: DropdownItem) => {
      if (item.disabled) return;
      onSelect(item);
      closeDropdown();
    },
    [onSelect, closeDropdown]
  );

  // Handle trigger keyboard events
  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
        case 'ArrowDown':
          e.preventDefault();
          openDropdown();
          // Focus first item after opening
          setTimeout(() => focusItem(Math.max(0, selectedIndex)), 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          openDropdown();
          // Focus last item
          setTimeout(() => focusItem(activeItems.length - 1), 0);
          break;
      }
    },
    [openDropdown, focusItem, selectedIndex, activeItems.length]
  );

  // Handle list keyboard events
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleSelect(activeItems[index]);
          break;
        case 'Escape':
          e.preventDefault();
          closeDropdown();
          break;
        case 'Tab':
          // Close on tab and allow normal tab behavior
          closeDropdown();
          break;
        default:
          // Pass to roving handler
          rovingHandleKeyDown(e, index);
      }
    },
    [handleSelect, closeDropdown, rovingHandleKeyDown, activeItems]
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Get selected item
  const selectedItem = items.find((item) => item.id === selectedId);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg
          text-left text-white
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-cscx-gray-600 focus-visible:ring-2 focus-visible:ring-cscx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cscx-gray-900'}
        `}
      >
        <span className={selectedItem ? 'text-white' : 'text-cscx-gray-400'}>
          {selectedItem ? (
            <span className="flex items-center gap-2">
              {selectedItem.icon}
              {selectedItem.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <svg
          className={`w-4 h-4 text-cscx-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          aria-activedescendant={selectedId ? `option-${selectedId}` : undefined}
          className="
            absolute z-50 w-full mt-1 py-1
            bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg
            shadow-lg max-h-60 overflow-y-auto
          "
        >
          {/* Type-ahead indicator */}
          {searchString && (
            <div className="px-3 py-1 text-xs text-cscx-gray-400 border-b border-cscx-gray-700">
              Searching: {searchString}
            </div>
          )}

          {activeItems.map((item, index) => (
            <li
              key={item.id}
              id={`option-${item.id}`}
              ref={setRef(index)}
              role="option"
              aria-selected={item.id === selectedId}
              aria-disabled={item.disabled}
              tabIndex={getTabIndex(index)}
              onClick={() => handleSelect(item)}
              onKeyDown={(e) => handleListKeyDown(e, index)}
              className={`
                px-4 py-2 cursor-pointer
                ${item.id === selectedId ? 'bg-cscx-accent/20 text-cscx-accent' : 'text-white'}
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cscx-gray-700'}
                focus-visible:outline-none focus-visible:bg-cscx-gray-700
              `}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{item.label}</span>
                {item.id === selectedId && (
                  <svg
                    className="w-4 h-4 ml-auto text-cscx-accent"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-cscx-gray-400 mt-0.5">
                  {item.description}
                </p>
              )}
            </li>
          ))}

          {activeItems.length === 0 && (
            <li className="px-4 py-3 text-center text-cscx-gray-400 text-sm">
              No options available
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default AccessibleDropdown;
