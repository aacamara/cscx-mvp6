/**
 * Expansion Services Index
 * PRD-103: Expansion Signal Detected
 *
 * Exports all expansion-related services for easy consumption.
 */

// Types
export * from './types.js';

// Services
export { ExpansionSignalDetector, expansionDetector } from './detector.js';
export { ExpansionOpportunityService, expansionOpportunityService } from './opportunity-service.js';
export { ExpansionSlackAlerts, expansionSlackAlerts } from './slack-alerts.js';
export { ExpansionWorkflowService, expansionWorkflowService } from './workflow.js';
