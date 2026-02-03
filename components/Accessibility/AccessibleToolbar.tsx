/**
 * AccessibleToolbar Component
 * PRD-272: Keyboard Navigation
 *
 * Toolbar with roving tabindex pattern:
 * - Single tab stop for the entire toolbar
 * - Arrow keys to navigate between items
 * - Home/End to jump to first/last item
 */

import React from 'react';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import type { RovingOrientation } from '../../types/keyboard';

interface ToolbarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

interface AccessibleToolbarProps {
  /** Items in the toolbar */
  items: ToolbarItem[];
  /** Toolbar label for accessibility */
  label: string;
  /** Navigation orientation */
  orientation?: RovingOrientation;
  /** Optional class name for the container */
  className?: string;
}

/**
 * Accessible toolbar with roving tabindex
 *
 * @example
 * ```tsx
 * const MyToolbar: React.FC = () => {
 *   const items = [
 *     { id: 'bold', label: 'Bold', icon: <BoldIcon />, onClick: () => {} },
 *     { id: 'italic', label: 'Italic', icon: <ItalicIcon />, onClick: () => {} },
 *     { id: 'underline', label: 'Underline', icon: <UnderlineIcon />, onClick: () => {} },
 *   ];
 *
 *   return (
 *     <AccessibleToolbar
 *       items={items}
 *       label="Text formatting"
 *       orientation="horizontal"
 *     />
 *   );
 * };
 * ```
 */
export const AccessibleToolbar: React.FC<AccessibleToolbarProps> = ({
  items,
  label,
  orientation = 'horizontal',
  className = '',
}) => {
  const { handleKeyDown, getTabIndex, setRef } = useRovingTabIndex<HTMLButtonElement>(
    items.length,
    { orientation, loop: true }
  );

  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation === 'both' ? undefined : orientation}
      className={`
        flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row'} gap-1
        p-1 bg-cscx-gray-800 rounded-lg
        ${className}
      `}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={setRef(index)}
          type="button"
          tabIndex={getTabIndex(index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onClick={item.onClick}
          disabled={item.disabled}
          aria-label={item.label}
          aria-pressed={item.active}
          className={`
            p-2 rounded-md transition-colors
            ${item.active ? 'bg-cscx-accent text-white' : 'text-cscx-gray-300 hover:bg-cscx-gray-700 hover:text-white'}
            ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cscx-accent focus-visible:ring-inset
          `}
        >
          {item.icon || item.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Toolbar group for organizing related items
 */
interface ToolbarGroupProps {
  /** Group label for accessibility */
  label: string;
  /** Children (toolbar items) */
  children: React.ReactNode;
  /** Optional class name */
  className?: string;
}

export const ToolbarGroup: React.FC<ToolbarGroupProps> = ({
  label,
  children,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex items-center gap-1 ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * Toolbar separator
 */
export const ToolbarSeparator: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={`w-px h-6 bg-cscx-gray-700 mx-1 ${className}`}
    />
  );
};

export default AccessibleToolbar;
