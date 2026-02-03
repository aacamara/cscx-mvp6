/**
 * Ticket Spike Condition Processor
 * PRD-087: Fires when a customer experiences an unusual spike in support tickets
 *
 * A spike is defined as tickets/day exceeding the baseline by a multiplier threshold.
 * Default: 3x baseline = high severity, 5x baseline = critical severity
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const ticketSpikeProcessor: ConditionProcessor = {
  type: 'ticket_spike',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Process ticket-related events
    if (event.type !== 'support_ticket_created' && event.type !== 'support_ticket_escalated') {
      return false;
    }

    // Extract spike detection parameters from condition
    const spikeThreshold = condition.params.spikeThreshold || 3.0;
    const minTickets = condition.params.minTickets || 3;
    const categories = condition.params.categories; // Optional: specific categories only

    // Get spike data from event
    const ticketCount = event.data.ticketCount || event.data.recentTicketCount || 1;
    const baseline = event.data.baseline || event.data.baselineDailyAvg || 2.0;
    const multiplier = event.data.spikeMultiplier || event.data.multiplier;

    // If multiplier is provided directly, use it
    if (multiplier !== undefined) {
      // Check minimum ticket threshold
      if (ticketCount < minTickets) {
        return false;
      }

      // Check if multiplier meets threshold
      if (multiplier < spikeThreshold) {
        return false;
      }
    } else {
      // Calculate multiplier from ticket count and baseline
      const calculatedMultiplier = baseline > 0 ? ticketCount / baseline : ticketCount;

      if (ticketCount < minTickets) {
        return false;
      }

      if (calculatedMultiplier < spikeThreshold) {
        return false;
      }
    }

    // Check category filter if specified
    if (categories && Array.isArray(categories) && categories.length > 0) {
      const ticketCategory = event.data.category?.toLowerCase();
      const dominantCategory = event.data.dominantCategory?.toLowerCase();

      // If the dominant category or ticket category matches filter
      const categoryMatch = categories.some(
        (c: string) =>
          c.toLowerCase() === ticketCategory ||
          c.toLowerCase() === dominantCategory
      );

      if (!categoryMatch) {
        return false;
      }
    }

    // Check minimum severity filter if specified
    if (condition.params.minSeverity) {
      const severityOrder = ['low', 'medium', 'high', 'critical'];
      const eventSeverity = event.data.severity?.toLowerCase() || 'medium';
      const minSeverity = condition.params.minSeverity.toLowerCase();

      const eventIdx = severityOrder.indexOf(eventSeverity);
      const minIdx = severityOrder.indexOf(minSeverity);

      if (eventIdx < minIdx) {
        return false;
      }
    }

    // Check for high-severity tickets (P1/P2) if configured
    if (condition.params.requireHighSeverityTickets) {
      const severityBreakdown = event.data.severityBreakdown || {};
      const p1Count = severityBreakdown.P1 || severityBreakdown.p1 || 0;
      const p2Count = severityBreakdown.P2 || severityBreakdown.p2 || 0;

      if (p1Count === 0 && p2Count === 0) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const threshold = condition.params.spikeThreshold || 3.0;
    const minTickets = condition.params.minTickets || 3;
    let description = `Support ticket spike (${threshold}x+ baseline, min ${minTickets} tickets)`;

    if (condition.params.categories?.length) {
      description += ` in ${condition.params.categories.join('/')} category`;
    }

    if (condition.params.requireHighSeverityTickets) {
      description += ' with P1/P2 tickets';
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const {
      spikeThreshold,
      lookbackHours,
      baselineDays,
      minTickets,
      categories,
      minSeverity,
    } = condition.params;

    if (spikeThreshold !== undefined && (typeof spikeThreshold !== 'number' || spikeThreshold < 1)) {
      return { valid: false, error: 'spikeThreshold must be a number >= 1' };
    }

    if (lookbackHours !== undefined && (typeof lookbackHours !== 'number' || lookbackHours < 1 || lookbackHours > 168)) {
      return { valid: false, error: 'lookbackHours must be between 1 and 168 (1 week)' };
    }

    if (baselineDays !== undefined && (typeof baselineDays !== 'number' || baselineDays < 7 || baselineDays > 90)) {
      return { valid: false, error: 'baselineDays must be between 7 and 90' };
    }

    if (minTickets !== undefined && (typeof minTickets !== 'number' || minTickets < 1)) {
      return { valid: false, error: 'minTickets must be a positive number' };
    }

    if (categories !== undefined && !Array.isArray(categories)) {
      return { valid: false, error: 'categories must be an array' };
    }

    if (minSeverity !== undefined) {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(minSeverity.toLowerCase())) {
        return { valid: false, error: `minSeverity must be one of: ${validSeverities.join(', ')}` };
      }
    }

    return { valid: true };
  },
};
