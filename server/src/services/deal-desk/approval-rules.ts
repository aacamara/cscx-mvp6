/**
 * Deal Desk Approval Rules Engine
 * PRD-244: Deal Desk Integration
 *
 * Determines required approval levels based on request characteristics.
 */

import {
  ApprovalRule,
  ApprovalLevel,
  DealDeskRequestType,
  ApproverRole,
} from './types.js';

// ============================================
// Default Approval Rules
// ============================================

const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  // Discount rules - tiered by amount and ARR
  {
    id: 'standard-discount',
    requestType: 'discount',
    conditions: { discountPct: { max: 10 }, arr: { max: 50000 } },
    approvalLevels: [{ level: 1, role: 'deal_desk_analyst', required: true }],
  },
  {
    id: 'medium-discount',
    requestType: 'discount',
    conditions: { discountPct: { max: 15 }, arr: { max: 100000 } },
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
    ],
  },
  {
    id: 'large-discount',
    requestType: 'discount',
    conditions: { discountPct: { max: 25 }, arr: { max: 200000 } },
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },
  {
    id: 'strategic-discount',
    requestType: 'discount',
    conditions: {}, // No limits = catch-all for larger requests
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
      { level: 3, role: 'finance_vp', required: true },
    ],
  },

  // Payment terms rules
  {
    id: 'payment-terms-standard',
    requestType: 'payment_terms',
    conditions: { arr: { max: 100000 } },
    approvalLevels: [{ level: 1, role: 'deal_desk_analyst', required: true }],
  },
  {
    id: 'payment-terms-large',
    requestType: 'payment_terms',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'finance_vp', required: true },
    ],
  },

  // Contract amendment rules
  {
    id: 'contract-amendment-standard',
    requestType: 'contract_amendment',
    conditions: { arr: { max: 100000 } },
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
    ],
  },
  {
    id: 'contract-amendment-large',
    requestType: 'contract_amendment',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },

  // Custom pricing rules
  {
    id: 'custom-pricing-standard',
    requestType: 'custom_pricing',
    conditions: { arr: { max: 75000 } },
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },
  {
    id: 'custom-pricing-large',
    requestType: 'custom_pricing',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
      { level: 3, role: 'finance_vp', required: true },
    ],
  },

  // Bundle rules
  {
    id: 'bundle-standard',
    requestType: 'bundle',
    conditions: { arr: { max: 100000 } },
    approvalLevels: [{ level: 1, role: 'deal_desk_analyst', required: true }],
  },
  {
    id: 'bundle-large',
    requestType: 'bundle',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },
];

// ============================================
// Approval Rules Engine
// ============================================

export interface RequestCharacteristics {
  requestType: DealDeskRequestType;
  discountRequestedPct: number | null;
  currentArr: number;
  contractTermMonths: number | null;
}

export class ApprovalRulesEngine {
  private rules: ApprovalRule[];

  constructor(customRules?: ApprovalRule[]) {
    this.rules = customRules || DEFAULT_APPROVAL_RULES;
  }

  /**
   * Determine required approval levels for a request
   */
  getRequiredApprovals(characteristics: RequestCharacteristics): ApprovalLevel[] {
    // Find matching rule (rules are ordered from most specific to least specific)
    const matchingRules = this.rules.filter(
      (rule) => rule.requestType === characteristics.requestType
    );

    // Check each rule's conditions
    for (const rule of matchingRules) {
      if (this.matchesConditions(rule, characteristics)) {
        return rule.approvalLevels;
      }
    }

    // Default: single analyst approval
    return [{ level: 1, role: 'deal_desk_analyst', required: true }];
  }

  /**
   * Check if request matches rule conditions
   */
  private matchesConditions(
    rule: ApprovalRule,
    characteristics: RequestCharacteristics
  ): boolean {
    const conditions = rule.conditions;

    // Empty conditions = catch-all
    if (Object.keys(conditions).length === 0) {
      return true;
    }

    // Check discount percentage
    if (conditions.discountPct) {
      const discount = characteristics.discountRequestedPct || 0;
      if (discount > conditions.discountPct.max) {
        return false;
      }
    }

    // Check ARR
    if (conditions.arr) {
      if (characteristics.currentArr > conditions.arr.max) {
        return false;
      }
    }

    // Check contract term
    if (conditions.contractTerm) {
      const term = characteristics.contractTermMonths || 12;
      if (term > conditions.contractTerm.max) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the role display name
   */
  static getRoleDisplayName(role: ApproverRole): string {
    const names: Record<ApproverRole, string> = {
      deal_desk_analyst: 'Deal Desk Analyst',
      deal_desk_manager: 'Deal Desk Manager',
      finance_vp: 'VP of Finance',
      cro: 'Chief Revenue Officer',
    };
    return names[role] || role;
  }

  /**
   * Get minimum approval level required for auto-approval threshold
   */
  static getAutoApprovalThreshold(requestType: DealDeskRequestType): {
    discountPct: number;
    arr: number;
  } | null {
    // Auto-approval thresholds (if within these limits, can be auto-approved)
    const thresholds: Record<DealDeskRequestType, { discountPct: number; arr: number } | null> = {
      discount: { discountPct: 5, arr: 25000 },
      payment_terms: null, // No auto-approval
      contract_amendment: null, // No auto-approval
      custom_pricing: null, // No auto-approval
      bundle: { discountPct: 5, arr: 50000 },
    };
    return thresholds[requestType];
  }
}

// Singleton instance with default rules
export const approvalRulesEngine = new ApprovalRulesEngine();
