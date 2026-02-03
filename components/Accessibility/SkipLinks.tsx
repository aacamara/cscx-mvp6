/**
 * SkipLinks Component
 * PRD-272: Keyboard Navigation
 *
 * Provides skip links for keyboard users to bypass navigation
 * and jump directly to main content areas.
 */

import React from 'react';
import type { SkipLinkTarget } from '../../types/keyboard';
import { DEFAULT_SKIP_LINKS } from '../../types/keyboard';

interface SkipLinksProps {
  /** Custom skip link targets (optional, uses defaults if not provided) */
  targets?: SkipLinkTarget[];
}

/**
 * Skip links for keyboard navigation
 *
 * These links are visually hidden until focused, then appear
 * to allow keyboard users to skip repetitive content.
 *
 * @example
 * ```tsx
 * // In your main layout:
 * <SkipLinks />
 *
 * // Then add id attributes to target elements:
 * <main id="main-content">...</main>
 * <nav id="main-nav">...</nav>
 * ```
 */
export const SkipLinks: React.FC<SkipLinksProps> = ({
  targets = DEFAULT_SKIP_LINKS,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      // Set focus to the target
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Remove tabindex after blur to avoid tab stop issues
      target.addEventListener(
        'blur',
        () => {
          target.removeAttribute('tabindex');
        },
        { once: true }
      );
    }
  };

  return (
    <nav
      aria-label="Skip links"
      className="skip-links-container"
    >
      {targets.map((target) => (
        <a
          key={target.id}
          href={`#${target.id}`}
          onClick={(e) => handleClick(e, target.id)}
          className="skip-link"
        >
          {target.label}
        </a>
      ))}
    </nav>
  );
};

export default SkipLinks;
