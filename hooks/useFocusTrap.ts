/**
 * useFocusTrap Hook
 * PRD-272: Keyboard Navigation
 *
 * Traps focus within a container element (for modals, dialogs, etc.)
 * Focus cycles through focusable elements when Tab is pressed.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { FocusTrapOptions } from '../types/keyboard';

/**
 * Selector for all focusable elements
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  'details>summary:first-of-type',
  'details',
].join(', ');

/**
 * Get all focusable elements within a container
 */
const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
};

/**
 * Trap focus within a container element
 *
 * @param containerRef - React ref to the container element
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const Modal: React.FC = ({ children, onClose }) => {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   useFocusTrap(containerRef, {
 *     escapeDeactivates: true,
 *     onDeactivate: onClose,
 *     initialFocus: '.primary-button',
 *   });
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       {children}
 *     </div>
 *   );
 * };
 * ```
 */
export const useFocusTrap = (
  containerRef: React.RefObject<HTMLElement>,
  options: FocusTrapOptions = {}
): void => {
  const {
    initialFocus,
    returnFocus = true,
    escapeDeactivates = true,
    onActivate,
    onDeactivate,
    onTabOut,
  } = options;

  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isActiveRef = useRef(false);

  // Handle Tab key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Handle Escape
      if (e.key === 'Escape' && escapeDeactivates) {
        e.preventDefault();
        onDeactivate?.();
        return;
      }

      // Only handle Tab
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // Tab forward from last element
      if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
        onTabOut?.();
        return;
      }

      // Tab backward from first element
      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
        onTabOut?.();
        return;
      }

      // If focus is outside the trap, bring it back
      if (!container.contains(activeElement)) {
        e.preventDefault();
        (e.shiftKey ? lastElement : firstElement).focus();
        return;
      }
    },
    [containerRef, escapeDeactivates, onDeactivate, onTabOut]
  );

  // Activate trap
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Save previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;
    isActiveRef.current = true;

    // Focus initial element
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      if (initialFocus) {
        const initialElement = container.querySelector<HTMLElement>(initialFocus);
        if (initialElement) {
          initialElement.focus();
        } else {
          focusableElements[0].focus();
        }
      } else {
        focusableElements[0].focus();
      }
    }

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);
    onActivate?.();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      isActiveRef.current = false;

      // Return focus
      if (returnFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [containerRef, handleKeyDown, initialFocus, onActivate, returnFocus]);
};

/**
 * Higher-level focus trap with activation control
 *
 * @param isActive - Whether the trap is active
 * @param containerRef - React ref to the container element
 * @param options - Configuration options
 */
export const useConditionalFocusTrap = (
  isActive: boolean,
  containerRef: React.RefObject<HTMLElement>,
  options: FocusTrapOptions = {}
): void => {
  const {
    initialFocus,
    returnFocus = true,
    escapeDeactivates = true,
    onActivate,
    onDeactivate,
    onTabOut,
  } = options;

  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Save previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus initial element
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      requestAnimationFrame(() => {
        if (initialFocus) {
          const initialElement = container.querySelector<HTMLElement>(initialFocus);
          if (initialElement) {
            initialElement.focus();
          } else {
            focusableElements[0].focus();
          }
        } else {
          focusableElements[0].focus();
        }
      });
    }

    onActivate?.();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape
      if (e.key === 'Escape' && escapeDeactivates) {
        e.preventDefault();
        onDeactivate?.();
        return;
      }

      // Only handle Tab
      if (e.key !== 'Tab') return;

      const elements = getFocusableElements(container);
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // Tab forward from last element
      if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
        onTabOut?.();
        return;
      }

      // Tab backward from first element
      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
        onTabOut?.();
        return;
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus
      if (returnFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [
    isActive,
    containerRef,
    initialFocus,
    returnFocus,
    escapeDeactivates,
    onActivate,
    onDeactivate,
    onTabOut,
  ]);
};

export default useFocusTrap;
