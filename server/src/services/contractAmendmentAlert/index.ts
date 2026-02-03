/**
 * Contract Amendment Alert Service
 * PRD-108: Contract Amendment Needed
 *
 * Barrel export for contract amendment alert detection and notification services.
 */

export {
  ContractAmendmentAlertDetector,
  contractAmendmentAlertDetector,
  type AmendmentAlertTriggerType,
  type AmendmentAlertPriority,
  type AmendmentTrigger,
  type CustomerData,
  type AmendmentDetails,
  type DetectedAmendmentNeed,
} from './detector.js';

export {
  ContractAmendmentSlackAlerts,
  contractAmendmentSlackAlerts,
} from './slack-alerts.js';
