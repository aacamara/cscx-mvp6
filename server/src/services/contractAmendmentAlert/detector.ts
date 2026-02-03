/**
 * Contract Amendment Alert Detector
 * PRD-108: Contract Amendment Needed
 *
 * Detects situations requiring contract amendments:
 * - Usage exceeding contracted limits
 * - Seat count overages
 * - Scope changes or out-of-scope requests
 * - Term modification needs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export type AmendmentAlertTriggerType =
  | 'usage_overage'
  | 'seat_overage'
  | 'storage_overage'
  | 'api_overage'
  | 'out_of_scope_request'
  | 'use_case_change'
  | 'early_renewal_request'
  | 'term_extension_request'
  | 'feature_upgrade_request';

export type AmendmentAlertPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AmendmentTrigger {
  type: AmendmentAlertTriggerType;
  detect: (customer: CustomerData) => boolean;
  details: (customer: CustomerData) => AmendmentDetails;
  priority: (customer: CustomerData) => AmendmentAlertPriority;
  estimateValue: (customer: CustomerData, details: AmendmentDetails) => number;
}

export interface CustomerData {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  renewalDate: string;
  csmId?: string;
  csmName?: string;
  contract: {
    id?: string;
    apiLimit: number;
    seats: number;
    storageLimit: number;
    plan?: string;
    startDate: string;
    endDate: string;
  };
  usage: {
    apiCalls: number;
    activeUsers: number;
    storageUsed: number;
    lastUpdated: string;
  };
  recentRequests?: Array<{
    type: string;
    description: string;
    date: string;
  }>;
}

export interface AmendmentDetails {
  contracted: number;
  actual: number;
  overageAmount?: number;
  overagePercent?: number;
  additionalSeats?: number;
  trend?: 'increasing' | 'stable' | 'decreasing';
  persistedMonths?: number;
  description: string;
}

export interface DetectedAmendmentNeed {
  customerId: string;
  customerName: string;
  triggerType: AmendmentAlertTriggerType;
  priority: AmendmentAlertPriority;
  details: AmendmentDetails;
  estimatedMonthlyValue: number;
  estimatedAnnualValue: number;
  contract: {
    id?: string;
    currentArr: number;
    contractStart: string;
    contractEnd: string;
    daysUntilRenewal: number;
    plan?: string;
  };
  customerContext: {
    healthScore: number;
    relationshipStatus: 'excellent' | 'good' | 'fair' | 'at_risk';
    csmId?: string;
    csmName?: string;
  };
  recommendedOptions: Array<{
    id: string;
    title: string;
    description: string;
    estimatedValue: number;
    isRecommended: boolean;
  }>;
  detectedAt: string;
}

// ============================================
// Amendment Triggers Configuration
// ============================================

const AMENDMENT_TRIGGERS: AmendmentTrigger[] = [
  {
    type: 'usage_overage',
    detect: (customer) => {
      const limit = customer.contract.apiLimit;
      const actual = customer.usage.apiCalls;
      return limit > 0 && actual > limit * 1.1; // 10% overage threshold
    },
    details: (customer) => {
      const limit = customer.contract.apiLimit;
      const actual = customer.usage.apiCalls;
      const overageAmount = actual - limit;
      const overagePercent = ((actual - limit) / limit) * 100;
      return {
        contracted: limit,
        actual,
        overageAmount,
        overagePercent,
        trend: 'increasing', // Would be calculated from historical data
        description: `API usage at ${actual.toLocaleString()} calls exceeds contracted limit of ${limit.toLocaleString()} by ${overagePercent.toFixed(1)}%`,
      };
    },
    priority: (customer) => {
      const limit = customer.contract.apiLimit;
      const actual = customer.usage.apiCalls;
      const overagePercent = ((actual - limit) / limit) * 100;
      if (overagePercent > 50) return 'critical';
      if (overagePercent > 30) return 'high';
      if (overagePercent > 15) return 'medium';
      return 'low';
    },
    estimateValue: (customer, details) => {
      // Estimate based on per-unit pricing
      const overageAmount = details.overageAmount || 0;
      const pricePerUnit = 0.001; // $0.001 per API call (example)
      return overageAmount * pricePerUnit;
    },
  },
  {
    type: 'seat_overage',
    detect: (customer) => {
      return customer.usage.activeUsers > customer.contract.seats;
    },
    details: (customer) => {
      const contracted = customer.contract.seats;
      const actual = customer.usage.activeUsers;
      const additionalSeats = actual - contracted;
      return {
        contracted,
        actual,
        additionalSeats,
        overagePercent: ((actual - contracted) / contracted) * 100,
        trend: 'increasing',
        description: `${actual} active users exceed contracted ${contracted} seats by ${additionalSeats} seats`,
      };
    },
    priority: (customer) => {
      const contracted = customer.contract.seats;
      const actual = customer.usage.activeUsers;
      const additionalSeats = actual - contracted;
      if (additionalSeats > 20) return 'critical';
      if (additionalSeats > 10) return 'high';
      if (additionalSeats > 5) return 'medium';
      return 'low';
    },
    estimateValue: (customer, details) => {
      // Estimate based on per-seat pricing
      const additionalSeats = details.additionalSeats || 0;
      const pricePerSeat = customer.arr / (customer.contract.seats * 12); // Derive from current pricing
      return additionalSeats * pricePerSeat;
    },
  },
  {
    type: 'storage_overage',
    detect: (customer) => {
      const limit = customer.contract.storageLimit;
      const actual = customer.usage.storageUsed;
      return limit > 0 && actual > limit * 1.2; // 20% overage threshold
    },
    details: (customer) => {
      const limit = customer.contract.storageLimit;
      const actual = customer.usage.storageUsed;
      const overageAmount = actual - limit;
      const overagePercent = ((actual - limit) / limit) * 100;
      return {
        contracted: limit,
        actual,
        overageAmount,
        overagePercent,
        trend: 'increasing',
        description: `Storage at ${(actual / 1024).toFixed(1)} GB exceeds contracted ${(limit / 1024).toFixed(1)} GB by ${overagePercent.toFixed(1)}%`,
      };
    },
    priority: (customer) => {
      const limit = customer.contract.storageLimit;
      const actual = customer.usage.storageUsed;
      const overagePercent = ((actual - limit) / limit) * 100;
      if (overagePercent > 50) return 'high';
      if (overagePercent > 30) return 'medium';
      return 'low';
    },
    estimateValue: (customer, details) => {
      // Estimate based on storage pricing
      const overageGB = (details.overageAmount || 0) / 1024;
      const pricePerGB = 5; // $5 per GB per month (example)
      return overageGB * pricePerGB;
    },
  },
];

// ============================================
// Contract Amendment Alert Detector
// ============================================

export class ContractAmendmentAlertDetector {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Main Detection Method
  // ============================================

  /**
   * Detect amendment needs for a specific customer
   */
  async detectForCustomer(customerId: string): Promise<DetectedAmendmentNeed[]> {
    const customerData = await this.getCustomerData(customerId);
    if (!customerData) {
      return [];
    }

    return this.detectAmendmentNeeds(customerData);
  }

  /**
   * Detect amendment needs across all customers
   */
  async detectAll(): Promise<DetectedAmendmentNeed[]> {
    const customers = await this.getAllCustomerData();
    const allNeeds: DetectedAmendmentNeed[] = [];

    for (const customer of customers) {
      const needs = this.detectAmendmentNeeds(customer);
      allNeeds.push(...needs);
    }

    // Sort by priority (critical first) then by estimated value
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allNeeds.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedAnnualValue - a.estimatedAnnualValue;
    });

    return allNeeds;
  }

  // ============================================
  // Detection Logic
  // ============================================

  private detectAmendmentNeeds(customer: CustomerData): DetectedAmendmentNeed[] {
    const needs: DetectedAmendmentNeed[] = [];
    const now = new Date();
    const renewalDate = new Date(customer.renewalDate);
    const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    for (const trigger of AMENDMENT_TRIGGERS) {
      if (trigger.detect(customer)) {
        const details = trigger.details(customer);
        const priority = trigger.priority(customer);
        const estimatedMonthlyValue = trigger.estimateValue(customer, details);

        const need: DetectedAmendmentNeed = {
          customerId: customer.id,
          customerName: customer.name,
          triggerType: trigger.type,
          priority,
          details,
          estimatedMonthlyValue,
          estimatedAnnualValue: estimatedMonthlyValue * 12,
          contract: {
            id: customer.contract.id,
            currentArr: customer.arr,
            contractStart: customer.contract.startDate,
            contractEnd: customer.contract.endDate,
            daysUntilRenewal,
            plan: customer.contract.plan,
          },
          customerContext: {
            healthScore: customer.healthScore,
            relationshipStatus: this.getRelationshipStatus(customer.healthScore),
            csmId: customer.csmId,
            csmName: customer.csmName,
          },
          recommendedOptions: this.generateOptions(trigger.type, customer, details, estimatedMonthlyValue),
          detectedAt: now.toISOString(),
        };

        needs.push(need);
      }
    }

    return needs;
  }

  // ============================================
  // Option Generation
  // ============================================

  private generateOptions(
    triggerType: AmendmentAlertTriggerType,
    customer: CustomerData,
    details: AmendmentDetails,
    estimatedMonthlyValue: number
  ): DetectedAmendmentNeed['recommendedOptions'] {
    switch (triggerType) {
      case 'usage_overage':
      case 'api_overage':
        return [
          {
            id: 'upgrade_tier',
            title: 'Upgrade to next tier',
            description: `Move to higher tier with increased API limits`,
            estimatedValue: estimatedMonthlyValue * 12 * 1.2, // 20% more for tier upgrade
            isRecommended: true,
          },
          {
            id: 'add_overage_package',
            title: 'Add overage package',
            description: `Add a usage overage package to cover excess API calls`,
            estimatedValue: estimatedMonthlyValue * 12,
            isRecommended: false,
          },
          {
            id: 'custom_arrangement',
            title: 'Negotiate custom arrangement',
            description: `Work with the customer on a custom pricing arrangement`,
            estimatedValue: estimatedMonthlyValue * 12 * 0.9, // Potential discount
            isRecommended: false,
          },
        ];

      case 'seat_overage':
        return [
          {
            id: 'add_seats',
            title: 'Add additional seats',
            description: `Add ${details.additionalSeats} seats to match current usage`,
            estimatedValue: estimatedMonthlyValue * 12,
            isRecommended: true,
          },
          {
            id: 'upgrade_plan',
            title: 'Upgrade to unlimited plan',
            description: `Upgrade to a plan with unlimited seats`,
            estimatedValue: customer.arr * 0.3, // 30% increase estimate
            isRecommended: false,
          },
          {
            id: 'seat_audit',
            title: 'Conduct seat audit',
            description: `Help customer optimize seat usage before adding`,
            estimatedValue: estimatedMonthlyValue * 12 * 0.5,
            isRecommended: false,
          },
        ];

      case 'storage_overage':
        return [
          {
            id: 'add_storage',
            title: 'Add storage capacity',
            description: `Add storage to accommodate current usage`,
            estimatedValue: estimatedMonthlyValue * 12,
            isRecommended: true,
          },
          {
            id: 'archive_plan',
            title: 'Implement archiving strategy',
            description: `Help customer archive older data to reduce active storage`,
            estimatedValue: estimatedMonthlyValue * 12 * 0.3,
            isRecommended: false,
          },
        ];

      default:
        return [
          {
            id: 'contact_customer',
            title: 'Contact customer to discuss',
            description: `Schedule a call to understand the customer's evolving needs`,
            estimatedValue: estimatedMonthlyValue * 12,
            isRecommended: true,
          },
        ];
    }
  }

  // ============================================
  // Data Access
  // ============================================

  private async getCustomerData(customerId: string): Promise<CustomerData | null> {
    if (!this.supabase) {
      return this.getMockCustomerData(customerId);
    }

    try {
      // Get customer and contract data
      const { data: customer, error } = await this.supabase
        .from('customers')
        .select(`
          id,
          name,
          arr,
          health_score,
          renewal_date,
          csm_id,
          contracts (
            id,
            api_limit,
            seats,
            storage_limit,
            plan,
            start_date,
            end_date
          )
        `)
        .eq('id', customerId)
        .single();

      if (error || !customer) {
        console.error('Error fetching customer:', error);
        return null;
      }

      // Get usage metrics
      const { data: usage } = await this.supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      const contract = (customer.contracts as any)?.[0] || {
        api_limit: 1000000,
        seats: 50,
        storage_limit: 10240,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      return {
        id: customer.id,
        name: customer.name,
        arr: customer.arr || 0,
        healthScore: customer.health_score || 70,
        renewalDate: customer.renewal_date || contract.end_date,
        csmId: customer.csm_id,
        contract: {
          id: contract.id,
          apiLimit: contract.api_limit || 1000000,
          seats: contract.seats || 50,
          storageLimit: contract.storage_limit || 10240,
          plan: contract.plan,
          startDate: contract.start_date,
          endDate: contract.end_date,
        },
        usage: {
          apiCalls: usage?.total_events || 0,
          activeUsers: usage?.mau || 0,
          storageUsed: usage?.storage_used || 0,
          lastUpdated: usage?.calculated_at || new Date().toISOString(),
        },
      };
    } catch (err) {
      console.error('Error getting customer data:', err);
      return null;
    }
  }

  private async getAllCustomerData(): Promise<CustomerData[]> {
    if (!this.supabase) {
      return this.getMockAllCustomerData();
    }

    try {
      const { data: customers, error } = await this.supabase
        .from('customers')
        .select('id')
        .eq('stage', 'active');

      if (error || !customers) {
        console.error('Error fetching customers:', error);
        return [];
      }

      const customerDataList: CustomerData[] = [];
      for (const c of customers) {
        const data = await this.getCustomerData(c.id);
        if (data) {
          customerDataList.push(data);
        }
      }

      return customerDataList;
    } catch (err) {
      console.error('Error getting all customer data:', err);
      return [];
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private getRelationshipStatus(healthScore: number): 'excellent' | 'good' | 'fair' | 'at_risk' {
    if (healthScore >= 85) return 'excellent';
    if (healthScore >= 70) return 'good';
    if (healthScore >= 50) return 'fair';
    return 'at_risk';
  }

  // ============================================
  // Mock Data (for development)
  // ============================================

  private getMockCustomerData(customerId: string): CustomerData {
    return {
      id: customerId,
      name: 'TechFlow Inc',
      arr: 85000,
      healthScore: 78,
      renewalDate: '2026-08-15',
      csmId: 'csm-001',
      csmName: 'Sarah Johnson',
      contract: {
        id: 'contract-001',
        apiLimit: 1000000,
        seats: 50,
        storageLimit: 10240, // 10 GB in MB
        plan: 'Professional',
        startDate: '2025-08-15',
        endDate: '2026-08-15',
      },
      usage: {
        apiCalls: 1450000, // 45% over limit
        activeUsers: 58, // 8 over limit
        storageUsed: 8192, // 80% of limit
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  private getMockAllCustomerData(): CustomerData[] {
    return [
      this.getMockCustomerData('customer-001'),
      {
        id: 'customer-002',
        name: 'DataDriven Co',
        arr: 120000,
        healthScore: 85,
        renewalDate: '2026-06-30',
        csmId: 'csm-002',
        csmName: 'Mike Chen',
        contract: {
          id: 'contract-002',
          apiLimit: 2000000,
          seats: 100,
          storageLimit: 51200,
          plan: 'Enterprise',
          startDate: '2025-06-30',
          endDate: '2026-06-30',
        },
        usage: {
          apiCalls: 1800000,
          activeUsers: 115, // 15% overage
          storageUsed: 40960,
          lastUpdated: new Date().toISOString(),
        },
      },
      {
        id: 'customer-003',
        name: 'CloudFirst Solutions',
        arr: 45000,
        healthScore: 65,
        renewalDate: '2026-03-15',
        csmId: 'csm-001',
        csmName: 'Sarah Johnson',
        contract: {
          id: 'contract-003',
          apiLimit: 500000,
          seats: 25,
          storageLimit: 5120,
          plan: 'Starter',
          startDate: '2025-03-15',
          endDate: '2026-03-15',
        },
        usage: {
          apiCalls: 620000, // 24% overage
          activeUsers: 23,
          storageUsed: 4096,
          lastUpdated: new Date().toISOString(),
        },
      },
    ];
  }
}

// Singleton instance
export const contractAmendmentAlertDetector = new ContractAmendmentAlertDetector();

export default contractAmendmentAlertDetector;
