/**
 * PRD-220: Automated Data Enrichment Hook
 *
 * Custom React hook for managing data enrichment state and operations.
 * Provides functions to trigger, monitor, and display enrichment data.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  EntityType,
  EnrichmentPriority,
  EnrichmentStatus,
  EnrichmentViewData,
  EnrichmentFieldDisplay,
  EnrichmentChange,
  CustomerEnrichmentData,
  StakeholderEnrichmentData,
  CUSTOMER_FIELD_CATEGORIES,
  STAKEHOLDER_FIELD_CATEGORIES,
  getConfidenceLabel,
  formatFieldValue
} from '../types/enrichment';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

interface EnrichmentStatusResponse {
  entity_id: string;
  entity_type: EntityType;
  status: EnrichmentStatus;
  last_enriched: string | null;
  next_scheduled: string | null;
  fields: Record<string, {
    value: unknown;
    confidence: number;
    source: string;
    updated_at: string;
  }>;
  changes_detected: EnrichmentChange[];
}

interface QueueItem {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  priority: EnrichmentPriority;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error_message?: string;
  created_at: string;
}

interface UseEnrichmentOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

interface UseEnrichmentReturn {
  // State
  data: EnrichmentViewData | null;
  loading: boolean;
  enriching: boolean;
  error: string | null;
  queueStatus: QueueItem | null;

  // Actions
  fetchEnrichmentData: (entityType: EntityType, entityId: string) => Promise<void>;
  triggerEnrichment: (
    entityType: EntityType,
    entityId: string,
    options?: {
      priority?: EnrichmentPriority;
      fields?: string[];
      sourceHints?: Record<string, string>;
      sync?: boolean;
    }
  ) => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDataFreshness(lastEnriched: string | null): 'fresh' | 'stale' | 'outdated' | 'never' {
  if (!lastEnriched) return 'never';

  const lastDate = new Date(lastEnriched);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince <= 7) return 'fresh';
  if (daysSince <= 30) return 'stale';
  return 'outdated';
}

function calculateCoveragePercentage(
  fields: Record<string, unknown>,
  entityType: EntityType
): number {
  const categories = entityType === 'customer'
    ? CUSTOMER_FIELD_CATEGORIES
    : STAKEHOLDER_FIELD_CATEGORIES;

  const allFields = Object.values(categories).flat();
  const populatedFields = allFields.filter(field => {
    const value = fields[field];
    return value !== null && value !== undefined && value !== '';
  });

  return Math.round((populatedFields.length / allFields.length) * 100);
}

function transformToFieldDisplay(
  fields: Record<string, { value: unknown; confidence: number; source: string; updated_at: string }>,
  entityType: EntityType
): EnrichmentFieldDisplay[] {
  const categories = entityType === 'customer'
    ? CUSTOMER_FIELD_CATEGORIES
    : STAKEHOLDER_FIELD_CATEGORIES;

  const displays: EnrichmentFieldDisplay[] = [];

  for (const [category, fieldNames] of Object.entries(categories)) {
    for (const fieldName of fieldNames) {
      const fieldData = fields[fieldName];

      if (fieldData) {
        const updatedAt = new Date(fieldData.updated_at);
        const daysSinceUpdate = Math.floor(
          (new Date().getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        displays.push({
          category,
          field_name: fieldName,
          display_name: formatDisplayName(fieldName),
          value: fieldData.value,
          formatted_value: formatFieldValue(fieldName, fieldData.value),
          confidence: fieldData.confidence,
          confidence_label: getConfidenceLabel(fieldData.confidence),
          source: fieldData.source,
          source_icon: getSourceIcon(fieldData.source),
          last_updated: formatRelativeTime(updatedAt),
          is_stale: daysSinceUpdate > 30
        });
      }
    }
  }

  return displays;
}

function formatDisplayName(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    clearbit: 'C',
    crunchbase: 'CB',
    linkedin: 'in',
    builtwith: 'BW',
    news_api: 'N',
    ai_inference: 'AI',
    manual: 'M'
  };
  return icons[source] || source.charAt(0).toUpperCase();
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useEnrichment(options: UseEnrichmentOptions = {}): UseEnrichmentReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  // State
  const [data, setData] = useState<EnrichmentViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueItem | null>(null);

  // Track current entity for refresh
  const [currentEntity, setCurrentEntity] = useState<{
    type: EntityType;
    id: string;
  } | null>(null);

  // Fetch enrichment data for an entity
  const fetchEnrichmentData = useCallback(async (
    entityType: EntityType,
    entityId: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    setCurrentEntity({ type: entityType, id: entityId });

    try {
      const response = await fetch(
        `${API_BASE}/enrichment/status/${entityType}/${entityId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch enrichment data');
      }

      const result = await response.json();
      const statusData: EnrichmentStatusResponse = result.data;

      // Get entity name (would need additional API call in real implementation)
      const entityName = await getEntityName(entityType, entityId);

      // Transform to view data
      const viewData: EnrichmentViewData = {
        entity_id: entityId,
        entity_type: entityType,
        entity_name: entityName,
        status: statusData.status,
        last_enriched: statusData.last_enriched,
        data_freshness: getDataFreshness(statusData.last_enriched),
        coverage_percentage: calculateCoveragePercentage(
          Object.fromEntries(
            Object.entries(statusData.fields).map(([k, v]) => [k, v.value])
          ),
          entityType
        ),
        fields: transformToFieldDisplay(statusData.fields, entityType),
        recent_changes: statusData.changes_detected.map(c => ({
          ...c,
          detected_at: new Date(c.detected_at)
        })),
        can_enrich: true
      };

      setData(viewData);

      // Also check queue status
      await checkQueueStatus(entityType, entityId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch enrichment data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check queue status
  const checkQueueStatus = async (entityType: EntityType, entityId: string): Promise<void> => {
    try {
      const response = await fetch(
        `${API_BASE}/enrichment/queue/${entityType}/${entityId}`
      );

      if (response.ok) {
        const result = await response.json();
        if (result.data.queued) {
          setQueueStatus(result.data.queue_item);
        } else {
          setQueueStatus(null);
        }
      }
    } catch {
      // Ignore queue status errors
    }
  };

  // Trigger enrichment
  const triggerEnrichment = useCallback(async (
    entityType: EntityType,
    entityId: string,
    triggerOptions?: {
      priority?: EnrichmentPriority;
      fields?: string[];
      sourceHints?: Record<string, string>;
      sync?: boolean;
    }
  ): Promise<void> => {
    setEnriching(true);
    setError(null);

    try {
      const endpoint = triggerOptions?.sync
        ? `${API_BASE}/enrichment/sync`
        : `${API_BASE}/enrichment/trigger`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          priority: triggerOptions?.priority || 'high',
          fields: triggerOptions?.fields,
          source_hints: triggerOptions?.sourceHints
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to trigger enrichment');
      }

      const result = await response.json();

      // If sync mode, update data immediately
      if (triggerOptions?.sync && result.data) {
        await fetchEnrichmentData(entityType, entityId);
      } else {
        // Check queue status
        await checkQueueStatus(entityType, entityId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger enrichment');
    } finally {
      setEnriching(false);
    }
  }, [fetchEnrichmentData]);

  // Refresh current entity status
  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!currentEntity) return;
    await fetchEnrichmentData(currentEntity.type, currentEntity.id);
  }, [currentEntity, fetchEnrichmentData]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !currentEntity) return;

    const interval = setInterval(refreshStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, currentEntity, refreshStatus]);

  // Poll queue status while enriching
  useEffect(() => {
    if (!queueStatus || queueStatus.status === 'completed' || queueStatus.status === 'failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      if (!currentEntity) return;

      await checkQueueStatus(currentEntity.type, currentEntity.id);

      // If completed, refresh data
      const latestQueue = queueStatus;
      if (latestQueue?.status === 'completed') {
        await fetchEnrichmentData(currentEntity.type, currentEntity.id);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [queueStatus, currentEntity, fetchEnrichmentData]);

  return {
    data,
    loading,
    enriching,
    error,
    queueStatus,
    fetchEnrichmentData,
    triggerEnrichment,
    refreshStatus,
    clearError
  };
}

// ============================================
// HELPER - GET ENTITY NAME
// ============================================

async function getEntityName(entityType: EntityType, entityId: string): Promise<string> {
  try {
    const endpoint = entityType === 'customer'
      ? `${API_BASE}/customers/${entityId}`
      : `${API_BASE}/stakeholders/${entityId}`;

    const response = await fetch(endpoint);
    if (response.ok) {
      const data = await response.json();
      return entityType === 'customer'
        ? data.name || data.company_name || 'Unknown Customer'
        : data.stakeholder?.name || data.name || 'Unknown Stakeholder';
    }
  } catch {
    // Ignore errors
  }

  return entityType === 'customer' ? 'Customer' : 'Stakeholder';
}

// ============================================
// ADDITIONAL HOOKS
// ============================================

/**
 * Hook for customer enrichment specifically
 */
export function useCustomerEnrichment(customerId: string | null) {
  const enrichment = useEnrichment();

  useEffect(() => {
    if (customerId) {
      enrichment.fetchEnrichmentData('customer', customerId);
    }
  }, [customerId]);

  const triggerCustomerEnrichment = useCallback(async (
    options?: { fields?: string[]; sourceHints?: Record<string, string> }
  ) => {
    if (!customerId) return;
    await enrichment.triggerEnrichment('customer', customerId, {
      ...options,
      sync: true
    });
  }, [customerId, enrichment.triggerEnrichment]);

  return {
    ...enrichment,
    triggerEnrichment: triggerCustomerEnrichment
  };
}

/**
 * Hook for stakeholder enrichment specifically
 */
export function useStakeholderEnrichment(stakeholderId: string | null) {
  const enrichment = useEnrichment();

  useEffect(() => {
    if (stakeholderId) {
      enrichment.fetchEnrichmentData('stakeholder', stakeholderId);
    }
  }, [stakeholderId]);

  const triggerStakeholderEnrichment = useCallback(async (
    options?: { fields?: string[]; sourceHints?: { linkedin_url?: string; email?: string } }
  ) => {
    if (!stakeholderId) return;
    await enrichment.triggerEnrichment('stakeholder', stakeholderId, {
      ...options,
      sync: true
    });
  }, [stakeholderId, enrichment.triggerEnrichment]);

  return {
    ...enrichment,
    triggerEnrichment: triggerStakeholderEnrichment
  };
}

export default useEnrichment;
