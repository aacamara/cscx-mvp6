/**
 * Email Services Index
 *
 * Exports all email-related services including sync and parsing.
 */

export * from './emailService.js';
export * from './threadParser.js';

// Re-export default services
export { default as emailService } from './emailService.js';
export { emailThreadParser } from './threadParser.js';
