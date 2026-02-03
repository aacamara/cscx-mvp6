/**
 * useAnnounce Hook
 * PRD-271: Screen Reader Optimization
 *
 * Provides screen reader announcements via ARIA live regions.
 * Messages are announced to screen readers without visual changes.
 */

import { useCallback, useRef } from 'react';
import type { LiveRegionPoliteness, AnnouncementConfig } from '../types/accessibility';

// Global announcement queue to prevent overlapping announcements
const announcementQueue: AnnouncementConfig[] = [];
let isProcessing = false;

// DOM element IDs for live regions
const LIVE_REGION_POLITE_ID = 'sr-announcer-polite';
const LIVE_REGION_ASSERTIVE_ID = 'sr-announcer-assertive';

/**
 * Get or create the live region element
 */
const getOrCreateLiveRegion = (politeness: LiveRegionPoliteness): HTMLElement | null => {
  if (typeof document === 'undefined') return null;

  const id = politeness === 'assertive' ? LIVE_REGION_ASSERTIVE_ID : LIVE_REGION_POLITE_ID;
  let element = document.getElementById(id);

  if (!element) {
    element = document.createElement('div');
    element.id = id;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', politeness);
    element.setAttribute('aria-atomic', 'true');
    element.className = 'sr-only';
    // Visually hidden but accessible to screen readers
    element.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(element);
  }

  return element;
};

/**
 * Process the announcement queue
 */
const processQueue = async () => {
  if (isProcessing || announcementQueue.length === 0) return;

  isProcessing = true;

  while (announcementQueue.length > 0) {
    const config = announcementQueue.shift();
    if (!config) continue;

    const { message, politeness = 'polite', clearAfter = 1000 } = config;
    const element = getOrCreateLiveRegion(politeness);

    if (element) {
      // Clear first to ensure the change is detected
      element.textContent = '';

      // Small delay to ensure screen readers detect the change
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Set the announcement
      element.textContent = message;

      // Clear after specified time
      if (clearAfter > 0) {
        await new Promise((resolve) => setTimeout(resolve, clearAfter));
        element.textContent = '';
      }

      // Small delay between announcements
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  isProcessing = false;
};

/**
 * Hook for making screen reader announcements
 *
 * @example
 * ```tsx
 * const { announce, announcePolite, announceAssertive } = useAnnounce();
 *
 * // Polite announcement (default)
 * announce('New message received');
 *
 * // Assertive announcement (interrupts)
 * announceAssertive('Error: Connection lost');
 *
 * // With custom config
 * announce('Loading complete', 'polite', 2000);
 * ```
 */
export const useAnnounce = () => {
  const lastAnnouncementRef = useRef<string>('');
  const lastAnnouncementTimeRef = useRef<number>(0);

  /**
   * Make a screen reader announcement
   */
  const announce = useCallback(
    (
      message: string,
      politeness: LiveRegionPoliteness = 'polite',
      clearAfter = 1000
    ): void => {
      if (!message.trim()) return;

      // Debounce identical announcements within 500ms
      const now = Date.now();
      if (
        message === lastAnnouncementRef.current &&
        now - lastAnnouncementTimeRef.current < 500
      ) {
        return;
      }

      lastAnnouncementRef.current = message;
      lastAnnouncementTimeRef.current = now;

      announcementQueue.push({ message, politeness, clearAfter });
      processQueue();
    },
    []
  );

  /**
   * Make a polite announcement (waits for user to finish current task)
   */
  const announcePolite = useCallback(
    (message: string, clearAfter = 1000): void => {
      announce(message, 'polite', clearAfter);
    },
    [announce]
  );

  /**
   * Make an assertive announcement (interrupts immediately)
   * Use sparingly - only for critical information
   */
  const announceAssertive = useCallback(
    (message: string, clearAfter = 1000): void => {
      announce(message, 'assertive', clearAfter);
    },
    [announce]
  );

  /**
   * Announce loading state
   */
  const announceLoading = useCallback(
    (isLoading: boolean, loadingMessage = 'Loading...', completeMessage = 'Loading complete'): void => {
      announce(isLoading ? loadingMessage : completeMessage, 'polite', 1500);
    },
    [announce]
  );

  /**
   * Announce a list update
   */
  const announceListUpdate = useCallback(
    (itemCount: number, itemType = 'item'): void => {
      const plural = itemCount === 1 ? itemType : `${itemType}s`;
      announce(`${itemCount} ${plural} found`, 'polite', 1500);
    },
    [announce]
  );

  /**
   * Announce a sort change
   */
  const announceSortChange = useCallback(
    (column: string, direction: 'asc' | 'desc'): void => {
      const directionText = direction === 'asc' ? 'ascending' : 'descending';
      announce(`Sorted by ${column}, ${directionText}`, 'polite', 1500);
    },
    [announce]
  );

  /**
   * Announce a filter change
   */
  const announceFilterChange = useCallback(
    (filterName: string, value: string | null): void => {
      if (value) {
        announce(`Filtered by ${filterName}: ${value}`, 'polite', 1500);
      } else {
        announce(`${filterName} filter cleared`, 'polite', 1500);
      }
    },
    [announce]
  );

  /**
   * Announce an error
   */
  const announceError = useCallback(
    (error: string): void => {
      announce(`Error: ${error}`, 'assertive', 3000);
    },
    [announce]
  );

  /**
   * Announce a success message
   */
  const announceSuccess = useCallback(
    (message: string): void => {
      announce(message, 'polite', 2000);
    },
    [announce]
  );

  return {
    announce,
    announcePolite,
    announceAssertive,
    announceLoading,
    announceListUpdate,
    announceSortChange,
    announceFilterChange,
    announceError,
    announceSuccess,
  };
};

export default useAnnounce;
