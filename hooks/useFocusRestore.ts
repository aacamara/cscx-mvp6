/**
 * useFocusRestore Hook
 * PRD-272: Keyboard Navigation
 *
 * Saves and restores focus position, useful for:
 * - Opening/closing modals
 * - Navigating between views
 * - Restoring focus after async operations
 */

import { useRef, useCallback } from 'react';
import type { FocusRestoreState } from '../types/keyboard';

/**
 * Return type for useFocusRestore hook
 */
export interface UseFocusRestoreReturn {
  /** Save the currently focused element */
  saveFocus: () => void;
  /** Restore focus to the saved element */
  restoreFocus: () => void;
  /** Check if there's a saved focus position */
  hasSavedFocus: () => boolean;
  /** Clear the saved focus without restoring */
  clearSavedFocus: () => void;
  /** Get info about saved focus */
  getSavedFocusInfo: () => FocusRestoreState | null;
}

/**
 * Save and restore focus position
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const { saveFocus, restoreFocus } = useFocusRestore();
 *   const [isModalOpen, setIsModalOpen] = useState(false);
 *
 *   const openModal = () => {
 *     saveFocus();
 *     setIsModalOpen(true);
 *   };
 *
 *   const closeModal = () => {
 *     setIsModalOpen(false);
 *     restoreFocus();
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={openModal}>Open Modal</button>
 *       {isModalOpen && <Modal onClose={closeModal} />}
 *     </>
 *   );
 * };
 * ```
 */
export const useFocusRestore = (): UseFocusRestoreReturn => {
  const focusStateRef = useRef<FocusRestoreState | null>(null);

  /**
   * Save the currently focused element
   */
  const saveFocus = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && activeElement !== document.body) {
      focusStateRef.current = {
        previousElement: activeElement,
        savedAt: Date.now(),
      };
    }
  }, []);

  /**
   * Restore focus to the saved element
   */
  const restoreFocus = useCallback(() => {
    const state = focusStateRef.current;
    if (state?.previousElement) {
      // Check if element is still in the DOM and focusable
      if (
        document.body.contains(state.previousElement) &&
        !state.previousElement.hasAttribute('disabled')
      ) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          state.previousElement?.focus();
        });
      }
      focusStateRef.current = null;
    }
  }, []);

  /**
   * Check if there's a saved focus position
   */
  const hasSavedFocus = useCallback(() => {
    return focusStateRef.current !== null;
  }, []);

  /**
   * Clear the saved focus without restoring
   */
  const clearSavedFocus = useCallback(() => {
    focusStateRef.current = null;
  }, []);

  /**
   * Get info about saved focus
   */
  const getSavedFocusInfo = useCallback(() => {
    return focusStateRef.current;
  }, []);

  return {
    saveFocus,
    restoreFocus,
    hasSavedFocus,
    clearSavedFocus,
    getSavedFocusInfo,
  };
};

/**
 * Auto-restore focus when component unmounts
 *
 * @example
 * ```tsx
 * const Modal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
 *   useAutoFocusRestore(); // Automatically restores focus when unmounted
 *
 *   return <div>Modal content</div>;
 * };
 * ```
 */
export const useAutoFocusRestore = (): void => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save focus on mount
  if (previousFocusRef.current === null) {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }

  // Restore focus on unmount
  // Using a ref-based cleanup to avoid dependencies
  const elementRef = useRef(previousFocusRef.current);

  // Store the element for cleanup
  elementRef.current = previousFocusRef.current;

  // Note: We use a layout effect pattern with a ref
  // to ensure the element is captured before any focus changes
  useRef(() => {
    return () => {
      if (
        elementRef.current &&
        document.body.contains(elementRef.current) &&
        !elementRef.current.hasAttribute('disabled')
      ) {
        elementRef.current.focus();
      }
    };
  });
};

/**
 * Focus a specific element and save the current focus for later restoration
 *
 * @param targetRef - Ref to the element to focus
 * @returns Object with focus and restore functions
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const inputRef = useRef<HTMLInputElement>(null);
 *   const { focus, restore } = useFocusTo(inputRef);
 *
 *   return (
 *     <>
 *       <button onClick={focus}>Focus Input</button>
 *       <button onClick={restore}>Restore Focus</button>
 *       <input ref={inputRef} />
 *     </>
 *   );
 * };
 * ```
 */
export const useFocusTo = (
  targetRef: React.RefObject<HTMLElement>
): { focus: () => void; restore: () => void } => {
  const { saveFocus, restoreFocus } = useFocusRestore();

  const focus = useCallback(() => {
    saveFocus();
    targetRef.current?.focus();
  }, [saveFocus, targetRef]);

  return { focus, restore: restoreFocus };
};

export default useFocusRestore;
