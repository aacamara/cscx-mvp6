/**
 * AI Services Index
 *
 * Export all AI-powered services for the CSCX platform.
 */

// Email Drafting
export {
  draftEmail,
  draftEmailBatch,
  getRecentActivity,
  getCustomerEmailContext,
  type EmailType,
  type EmailTone,
  type EmailContext,
  type DraftEmailParams,
  type DraftedEmail,
} from './email-drafter.js';

// Meeting Preparation
export {
  prepareMeetingBrief,
  formatMeetingBriefAsDocument,
  type MeetingType,
  type MeetingPrepParams,
  type MeetingBrief,
} from './meeting-prep.js';

// Churn Prediction
export {
  predictChurnRisk,
  predictChurnBatch,
  getHighRiskCustomers,
  type RiskSeverity,
  type RiskSignal,
  type ChurnPrediction,
} from './churn-predictor.js';
