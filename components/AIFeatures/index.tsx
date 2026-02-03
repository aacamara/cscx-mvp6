/**
 * AI Features Module
 *
 * Central export for all AI-powered features:
 * - Pattern Recognition (PRD-233)
 * - Intelligent Escalation Routing (PRD-236)
 * - Customer Journey Optimization (PRD-237)
 */

export { PatternRecognition } from './PatternRecognition';
export { default as PatternRecognitionView } from './PatternRecognition';

// PRD-236: Intelligent Escalation Routing
export { EscalationManager } from './EscalationManager';
export { default as EscalationManagerView } from './EscalationManager';

// PRD-237: Customer Journey Optimization
export { JourneyAnalytics } from './JourneyAnalytics';
export { default as JourneyAnalyticsView } from './JourneyAnalytics';

// Re-export types for external use
export type {
  // Add type exports as needed
} from './PatternRecognition';
