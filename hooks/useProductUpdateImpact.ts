/**
 * useProductUpdateImpact Hook
 * PRD-126: Custom hook for managing product update impact data
 *
 * Features:
 * - List and filter product updates
 * - View impact assessments
 * - Track adoption metrics
 * - Manage deprecation tracking
 * - Generate communication templates
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ProductUpdate,
  CustomerImpact,
  CommunicationTemplate,
  ProductUpdateImpactFilters,
  ProductUpdateImpactResponse,
  UpdateType,
  ImpactType,
  AdoptionStatus
} from '../types/productUpdateImpact';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Types
// ============================================

interface UseProductUpdateImpactOptions {
  autoFetch?: boolean;
  updateId?: string;
  customerId?: string;
}

interface AdoptionSummary {
  totalCustomers: number;
  adoptionRate: number;
  byStatus: Record<AdoptionStatus, number>;
  avgDaysToAdoption: number | null;
  topBlockers: Array<{ type: string; count: number }>;
}

interface DeprecationSummary {
  deprecationDeadline: string | null;
  totalAffectedCustomers: number;
  byStatus: Record<string, number>;
  atRiskCount: number;
  completedCount: number;
  arrAtRisk: number;
}

interface ImpactSummary {
  totalCustomers: number;
  byImpactType: Record<ImpactType, number>;
  totalARRImpacted: number;
  avgRelevanceScore: number;
}

interface UseProductUpdateImpactReturn {
  // Updates list
  updates: ProductUpdate[];
  updatesLoading: boolean;
  updatesError: string | null;
  fetchUpdates: (filters?: { updateType?: UpdateType; search?: string }) => Promise<void>;

  // Selected update impact
  selectedUpdate: ProductUpdate | null;
  impacts: CustomerImpact[];
  impactSummary: ImpactSummary | null;
  impactLoading: boolean;
  impactError: string | null;
  fetchUpdateImpact: (updateId: string, filters?: ProductUpdateImpactFilters) => Promise<void>;

  // Communication templates
  templates: CommunicationTemplate[];
  templatesLoading: boolean;
  fetchTemplates: (updateId: string) => Promise<void>;
  generateTemplates: (updateId: string) => Promise<void>;

  // Adoption tracking
  adoptionSummary: AdoptionSummary | null;
  adoptionLoading: boolean;
  fetchAdoption: (updateId: string) => Promise<void>;
  updateAdoptionStatus: (updateId: string, customerId: string, status: AdoptionStatus) => Promise<void>;

  // Deprecation management
  deprecationSummary: DeprecationSummary | null;
  deprecationTracking: any[];
  deprecationLoading: boolean;
  fetchDeprecation: (updateId: string) => Promise<void>;

  // Customer-specific updates
  customerUpdates: Array<{ update: ProductUpdate; impact: CustomerImpact }>;
  customerUpdatesLoading: boolean;
  fetchCustomerUpdates: (customerId: string) => Promise<void>;

  // Actions
  createUpdate: (data: Partial<ProductUpdate>) => Promise<ProductUpdate | null>;
  triggerAssessment: (updateId: string) => Promise<boolean>;
  notifyCSMs: (updateId: string, csmIds?: string[]) => Promise<{ notified: number }>;

  // State management
  clearSelection: () => void;
  refetch: () => Promise<void>;
}

// ============================================
// Hook Implementation
// ============================================

export function useProductUpdateImpact(
  options: UseProductUpdateImpactOptions = {}
): UseProductUpdateImpactReturn {
  const { autoFetch = true, updateId, customerId } = options;

  // Updates list state
  const [updates, setUpdates] = useState<ProductUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesError, setUpdatesError] = useState<string | null>(null);

  // Selected update impact state
  const [selectedUpdate, setSelectedUpdate] = useState<ProductUpdate | null>(null);
  const [impacts, setImpacts] = useState<CustomerImpact[]>([]);
  const [impactSummary, setImpactSummary] = useState<ImpactSummary | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Adoption state
  const [adoptionSummary, setAdoptionSummary] = useState<AdoptionSummary | null>(null);
  const [adoptionLoading, setAdoptionLoading] = useState(false);

  // Deprecation state
  const [deprecationSummary, setDeprecationSummary] = useState<DeprecationSummary | null>(null);
  const [deprecationTracking, setDeprecationTracking] = useState<any[]>([]);
  const [deprecationLoading, setDeprecationLoading] = useState(false);

  // Customer updates state
  const [customerUpdates, setCustomerUpdates] = useState<Array<{ update: ProductUpdate; impact: CustomerImpact }>>([]);
  const [customerUpdatesLoading, setCustomerUpdatesLoading] = useState(false);

  // ============================================
  // Fetch Functions
  // ============================================

  const fetchUpdates = useCallback(async (filters?: { updateType?: UpdateType; search?: string }) => {
    setUpdatesLoading(true);
    setUpdatesError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.updateType) params.append('updateType', filters.updateType);
      if (filters?.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE}/product-updates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch updates');

      const result = await response.json();
      setUpdates(result.data.updates || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch updates';
      setUpdatesError(message);
      console.error('Fetch updates error:', err);
    } finally {
      setUpdatesLoading(false);
    }
  }, []);

  const fetchUpdateImpact = useCallback(async (
    updateId: string,
    filters?: ProductUpdateImpactFilters
  ) => {
    setImpactLoading(true);
    setImpactError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.impactType) params.append('impactType', filters.impactType);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.sortBy) params.append('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await fetch(`${API_BASE}/product-updates/${updateId}/impact?${params}`);
      if (!response.ok) throw new Error('Failed to fetch impact assessment');

      const result = await response.json();
      const data = result.data as ProductUpdateImpactResponse;

      setSelectedUpdate(data.update);
      setImpacts(data.customerImpacts);
      setImpactSummary(data.impactSummary);
      setTemplates(data.communicationTemplates || []);
      setAdoptionSummary(data.adoptionMetrics || null);
      setDeprecationSummary(data.deprecationStatus || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch impact';
      setImpactError(message);
      console.error('Fetch impact error:', err);
    } finally {
      setImpactLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async (updateId: string) => {
    setTemplatesLoading(true);

    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/templates`);
      if (!response.ok) throw new Error('Failed to fetch templates');

      const result = await response.json();
      setTemplates(result.data || []);
    } catch (err) {
      console.error('Fetch templates error:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const generateTemplates = useCallback(async (updateId: string) => {
    setTemplatesLoading(true);

    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/templates/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to generate templates');

      const result = await response.json();
      setTemplates(result.data || []);
    } catch (err) {
      console.error('Generate templates error:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchAdoption = useCallback(async (updateId: string) => {
    setAdoptionLoading(true);

    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/adoption`);
      if (!response.ok) throw new Error('Failed to fetch adoption');

      const result = await response.json();
      setAdoptionSummary(result.data.summary || null);
    } catch (err) {
      console.error('Fetch adoption error:', err);
    } finally {
      setAdoptionLoading(false);
    }
  }, []);

  const updateAdoptionStatus = useCallback(async (
    updateId: string,
    customerId: string,
    status: AdoptionStatus
  ) => {
    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/adoption/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update adoption status');

      // Refresh impact data
      await fetchUpdateImpact(updateId);
    } catch (err) {
      console.error('Update adoption status error:', err);
      throw err;
    }
  }, [fetchUpdateImpact]);

  const fetchDeprecation = useCallback(async (updateId: string) => {
    setDeprecationLoading(true);

    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/deprecation`);

      if (response.status === 404) {
        // Not a deprecation/breaking change
        setDeprecationSummary(null);
        setDeprecationTracking([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch deprecation status');

      const result = await response.json();
      setDeprecationSummary(result.data.summary || null);
      setDeprecationTracking(result.data.tracking || []);
    } catch (err) {
      console.error('Fetch deprecation error:', err);
    } finally {
      setDeprecationLoading(false);
    }
  }, []);

  const fetchCustomerUpdates = useCallback(async (customerId: string) => {
    setCustomerUpdatesLoading(true);

    try {
      const response = await fetch(`${API_BASE}/product-updates/customer/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer updates');

      const result = await response.json();
      setCustomerUpdates(result.data.updates || []);
    } catch (err) {
      console.error('Fetch customer updates error:', err);
    } finally {
      setCustomerUpdatesLoading(false);
    }
  }, []);

  // ============================================
  // Actions
  // ============================================

  const createUpdate = useCallback(async (data: Partial<ProductUpdate>): Promise<ProductUpdate | null> => {
    try {
      const response = await fetch(`${API_BASE}/product-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to create update');

      const result = await response.json();

      // Refresh updates list
      await fetchUpdates();

      return result.data;
    } catch (err) {
      console.error('Create update error:', err);
      return null;
    }
  }, [fetchUpdates]);

  const triggerAssessment = useCallback(async (updateId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to trigger assessment');

      // Refresh impact data
      await fetchUpdateImpact(updateId);

      return true;
    } catch (err) {
      console.error('Trigger assessment error:', err);
      return false;
    }
  }, [fetchUpdateImpact]);

  const notifyCSMs = useCallback(async (
    updateId: string,
    csmIds?: string[]
  ): Promise<{ notified: number }> => {
    try {
      const response = await fetch(`${API_BASE}/product-updates/${updateId}/notify-csms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csmIds })
      });

      if (!response.ok) throw new Error('Failed to notify CSMs');

      const result = await response.json();
      return { notified: result.data.notified };
    } catch (err) {
      console.error('Notify CSMs error:', err);
      return { notified: 0 };
    }
  }, []);

  // ============================================
  // State Management
  // ============================================

  const clearSelection = useCallback(() => {
    setSelectedUpdate(null);
    setImpacts([]);
    setImpactSummary(null);
    setImpactError(null);
    setTemplates([]);
    setAdoptionSummary(null);
    setDeprecationSummary(null);
    setDeprecationTracking([]);
  }, []);

  const refetch = useCallback(async () => {
    await fetchUpdates();
    if (selectedUpdate) {
      await fetchUpdateImpact(selectedUpdate.id);
    }
  }, [fetchUpdates, fetchUpdateImpact, selectedUpdate]);

  // ============================================
  // Auto-fetch Effects
  // ============================================

  useEffect(() => {
    if (autoFetch) {
      fetchUpdates();
    }
  }, [autoFetch, fetchUpdates]);

  useEffect(() => {
    if (updateId) {
      fetchUpdateImpact(updateId);
    }
  }, [updateId, fetchUpdateImpact]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerUpdates(customerId);
    }
  }, [customerId, fetchCustomerUpdates]);

  // ============================================
  // Return
  // ============================================

  return {
    // Updates list
    updates,
    updatesLoading,
    updatesError,
    fetchUpdates,

    // Selected update impact
    selectedUpdate,
    impacts,
    impactSummary,
    impactLoading,
    impactError,
    fetchUpdateImpact,

    // Communication templates
    templates,
    templatesLoading,
    fetchTemplates,
    generateTemplates,

    // Adoption tracking
    adoptionSummary,
    adoptionLoading,
    fetchAdoption,
    updateAdoptionStatus,

    // Deprecation management
    deprecationSummary,
    deprecationTracking,
    deprecationLoading,
    fetchDeprecation,

    // Customer-specific updates
    customerUpdates,
    customerUpdatesLoading,
    fetchCustomerUpdates,

    // Actions
    createUpdate,
    triggerAssessment,
    notifyCSMs,

    // State management
    clearSelection,
    refetch
  };
}

export default useProductUpdateImpact;
