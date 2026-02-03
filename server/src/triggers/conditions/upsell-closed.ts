/**
 * Upsell Closed Condition Processor
 * PRD-130: Upsell Closed -> Success Measurement
 *
 * Fires when an upsell/expansion opportunity closes.
 * Automatically triggers success measurement plan creation.
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { upsellSuccessService } from '../../services/upsell-success/index.js';

export const upsellClosedProcessor: ConditionProcessor = {
  type: 'upsell_closed',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Process relevant event types
    const relevantEvents = [
      'opportunity_closed_won',
      'contract_amendment',
      'expansion_closed',
      'upsell_completed',
      'custom', // For manual triggers
    ];

    if (!relevantEvents.includes(event.type)) {
      return false;
    }

    // Extract upsell data from event
    const arrIncrease = event.data.arrIncrease || event.data.arr_increase || event.data.amount;
    const products = event.data.products || event.data.product_names || [];
    const opportunityId = event.data.opportunityId || event.data.opportunity_id;

    // Check minimum ARR threshold if configured
    const minArrIncrease = condition.params.minArrIncrease || 0;
    if (arrIncrease < minArrIncrease) {
      return false;
    }

    // Check product filter if specified
    const productFilter = condition.params.productFilter as string[] | undefined;
    if (productFilter && productFilter.length > 0) {
      const hasMatchingProduct = products.some((p: string) =>
        productFilter.some((filter) => p.toLowerCase().includes(filter.toLowerCase()))
      );
      if (!hasMatchingProduct) {
        return false;
      }
    }

    // Check opportunity type filter if specified
    const opportunityTypes = condition.params.opportunityTypes as string[] | undefined;
    if (opportunityTypes && opportunityTypes.length > 0) {
      const oppType = event.data.opportunityType || event.data.type || 'expansion';
      if (!opportunityTypes.includes(oppType)) {
        return false;
      }
    }

    // Auto-create measurement plan if enabled
    const autoCreatePlan = condition.params.autoCreatePlan !== false;
    if (autoCreatePlan) {
      try {
        const measurement = await upsellSuccessService.createMeasurementPlan({
          customerId: event.customerId,
          opportunityId,
          products: Array.isArray(products) ? products : [products],
          arrIncrease,
          closeDate: event.timestamp.toISOString(),
          salesRep: event.data.salesRep || event.data.owner_name,
          source: event.data.source || 'salesforce',
        });

        // Attach measurement data to event for use in actions
        event.data.measurementId = measurement.id;
        event.data.measurementPlan = measurement.measurementPlan;
        event.data.successCriteria = measurement.successCriteria;
      } catch (error) {
        console.error('Failed to auto-create measurement plan:', error);
        // Continue evaluation even if auto-creation fails
      }
    }

    // Attach normalized data to event
    event.data.normalizedArrIncrease = arrIncrease;
    event.data.normalizedProducts = products;
    event.data.normalizedOpportunityId = opportunityId;

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const { minArrIncrease, productFilter, opportunityTypes, autoCreatePlan } = condition.params;
    const parts: string[] = ['Upsell closed'];

    if (minArrIncrease) {
      parts.push(`with ARR increase >= $${minArrIncrease.toLocaleString()}`);
    }

    if (productFilter && productFilter.length > 0) {
      parts.push(`including ${productFilter.join(' or ')}`);
    }

    if (opportunityTypes && opportunityTypes.length > 0) {
      parts.push(`of type ${opportunityTypes.join(' or ')}`);
    }

    if (autoCreatePlan !== false) {
      parts.push('(auto-creates measurement plan)');
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { minArrIncrease, productFilter, opportunityTypes } = condition.params;

    if (minArrIncrease !== undefined) {
      if (typeof minArrIncrease !== 'number' || minArrIncrease < 0) {
        return { valid: false, error: 'minArrIncrease must be a non-negative number' };
      }
    }

    if (productFilter !== undefined) {
      if (!Array.isArray(productFilter)) {
        return { valid: false, error: 'productFilter must be an array of strings' };
      }
    }

    if (opportunityTypes !== undefined) {
      if (!Array.isArray(opportunityTypes)) {
        return { valid: false, error: 'opportunityTypes must be an array of strings' };
      }

      const validTypes = ['expansion', 'upsell', 'cross_sell', 'renewal_expansion'];
      for (const type of opportunityTypes) {
        if (!validTypes.includes(type)) {
          return { valid: false, error: `Invalid opportunity type: ${type}` };
        }
      }
    }

    return { valid: true };
  },
};
