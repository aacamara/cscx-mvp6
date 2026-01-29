/**
 * Ticket Escalated Condition Processor
 * Fires when a support ticket is escalated or reaches critical priority
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const ticketEscalatedProcessor: ConditionProcessor = {
  type: 'ticket_escalated',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process ticket-related events
    if (event.type !== 'support_ticket_escalated' && event.type !== 'support_ticket_created') {
      return false;
    }

    const priorities = condition.params.priorities || ['critical', 'high'];
    const categories = condition.params.categories;  // Optional: specific categories
    const escalationLevels = condition.params.escalationLevels;  // Optional: min escalation level

    // Check if this is an escalation event
    const isEscalation = event.type === 'support_ticket_escalated' ||
                         event.data.isEscalation ||
                         event.data.wasEscalated;

    // Check priority
    const ticketPriority = event.data.priority?.toLowerCase();
    const matchesPriority = priorities.some(
      (p: string) => p.toLowerCase() === ticketPriority
    );

    if (!matchesPriority && !isEscalation) {
      return false;
    }

    // Check categories if specified
    if (categories && Array.isArray(categories) && categories.length > 0) {
      const ticketCategory = event.data.category?.toLowerCase();
      if (!categories.some((c: string) => c.toLowerCase() === ticketCategory)) {
        return false;
      }
    }

    // Check escalation level if specified
    if (escalationLevels !== undefined) {
      const currentLevel = event.data.escalationLevel || 0;
      if (currentLevel < escalationLevels) {
        return false;
      }
    }

    // Check for repeat escalations
    if (condition.params.repeatEscalationsOnly) {
      const escalationCount = event.data.escalationCount || 0;
      if (escalationCount < 2) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const priorities = condition.params.priorities || ['critical', 'high'];
    let description = `Ticket escalated (${priorities.join('/')} priority)`;

    if (condition.params.categories?.length) {
      description += ` in ${condition.params.categories.join('/')} category`;
    }

    if (condition.params.escalationLevels) {
      description += `, level ${condition.params.escalationLevels}+`;
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { priorities, categories, escalationLevels } = condition.params;

    if (priorities !== undefined && !Array.isArray(priorities)) {
      return { valid: false, error: 'priorities must be an array' };
    }

    if (categories !== undefined && !Array.isArray(categories)) {
      return { valid: false, error: 'categories must be an array' };
    }

    if (escalationLevels !== undefined && (typeof escalationLevels !== 'number' || escalationLevels < 0)) {
      return { valid: false, error: 'escalationLevels must be a non-negative number' };
    }

    return { valid: true };
  },
};
