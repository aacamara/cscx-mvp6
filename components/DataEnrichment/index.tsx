/**
 * PRD-220: Automated Data Enrichment Component
 *
 * Displays enriched data for customers and stakeholders with:
 * - Field-by-field display with confidence scores
 * - Source attribution
 * - On-demand enrichment trigger
 * - Change history
 */

import React, { useState, useEffect } from 'react';
import { useEnrichment } from '../../hooks/useEnrichment';
import {
  EntityType,
  EnrichmentFieldDisplay,
  EnrichmentChange,
  CUSTOMER_FIELD_CATEGORIES,
  STAKEHOLDER_FIELD_CATEGORIES
} from '../../types/enrichment';

// ============================================
// TYPES
// ============================================

interface DataEnrichmentProps {
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  compact?: boolean;
  onFieldClick?: (field: EnrichmentFieldDisplay) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.85) return 'text-green-400';
  if (confidence >= 0.6) return 'text-yellow-400';
  return 'text-red-400';
};

const getConfidenceBg = (confidence: number): string => {
  if (confidence >= 0.85) return 'bg-green-500/20';
  if (confidence >= 0.6) return 'bg-yellow-500/20';
  return 'bg-red-500/20';
};

const getFreshnessColor = (freshness: string): string => {
  switch (freshness) {
    case 'fresh': return 'text-green-400';
    case 'stale': return 'text-yellow-400';
    case 'outdated': return 'text-red-400';
    default: return 'text-cscx-gray-400';
  }
};

const getFreshnessLabel = (freshness: string): string => {
  switch (freshness) {
    case 'fresh': return 'Data is up to date';
    case 'stale': return 'Data may be outdated';
    case 'outdated': return 'Data needs refresh';
    default: return 'No data yet';
  }
};

const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    clearbit: 'Clearbit',
    crunchbase: 'Crunchbase',
    linkedin: 'LinkedIn',
    builtwith: 'BuiltWith',
    news_api: 'News API',
    ai_inference: 'AI',
    manual: 'Manual'
  };
  return labels[source] || source;
};

// ============================================
// MAIN COMPONENT
// ============================================

export const DataEnrichment: React.FC<DataEnrichmentProps> = ({
  entityType,
  entityId,
  entityName,
  compact = false,
  onFieldClick
}) => {
  const {
    data,
    loading,
    enriching,
    error,
    queueStatus,
    fetchEnrichmentData,
    triggerEnrichment,
    clearError
  } = useEnrichment();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch data on mount or when entity changes
  useEffect(() => {
    if (entityId) {
      fetchEnrichmentData(entityType, entityId);
    }
  }, [entityType, entityId, fetchEnrichmentData]);

  // Get categories for this entity type
  const categories = entityType === 'customer'
    ? CUSTOMER_FIELD_CATEGORIES
    : STAKEHOLDER_FIELD_CATEGORIES;

  // Handle enrichment trigger
  const handleEnrichNow = async () => {
    await triggerEnrichment(entityType, entityId, { sync: true });
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-6 text-center text-cscx-gray-400">
        <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading enrichment data...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-2">{error}</p>
        <button
          onClick={() => {
            clearError();
            fetchEnrichmentData(entityType, entityId);
          }}
          className="text-cscx-accent hover:underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {entityName || data?.entity_name || (entityType === 'customer' ? 'Customer' : 'Stakeholder')}
            </h3>
            {data && (
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className={getFreshnessColor(data.data_freshness)}>
                  {getFreshnessLabel(data.data_freshness)}
                </span>
                <span className="text-cscx-gray-500">|</span>
                <span className="text-cscx-gray-400">
                  {data.coverage_percentage}% enriched
                </span>
                {data.last_enriched && (
                  <>
                    <span className="text-cscx-gray-500">|</span>
                    <span className="text-cscx-gray-400">
                      Last: {new Date(data.last_enriched).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleEnrichNow}
            disabled={enriching || (queueStatus?.status === 'processing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              enriching || queueStatus?.status === 'processing'
                ? 'bg-cscx-gray-700 text-cscx-gray-400 cursor-not-allowed'
                : 'bg-cscx-accent hover:bg-cscx-accent/80 text-white'
            }`}
          >
            {(enriching || queueStatus?.status === 'processing') ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Enriching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Enrich Now
              </>
            )}
          </button>
        </div>

        {/* Queue status indicator */}
        {queueStatus && queueStatus.status === 'processing' && (
          <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400">
            Enrichment in progress... This may take a few moments.
          </div>
        )}
      </div>

      {/* Coverage Progress Bar */}
      {data && (
        <div className="px-4 py-3 border-b border-cscx-gray-800">
          <div className="flex items-center justify-between text-xs text-cscx-gray-400 mb-1">
            <span>Data Coverage</span>
            <span>{data.coverage_percentage}%</span>
          </div>
          <div className="w-full h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cscx-accent to-cscx-accent/70 rounded-full transition-all duration-500"
              style={{ width: `${data.coverage_percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Category Tabs */}
      {!compact && data && (
        <div className="flex overflow-x-auto border-b border-cscx-gray-800">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === null
                ? 'text-cscx-accent border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            All Fields
          </button>
          {Object.keys(categories).map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === category
                  ? 'text-cscx-accent border-b-2 border-cscx-accent'
                  : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Fields Display */}
      {data && (
        <div className="p-4">
          {data.fields.length === 0 ? (
            <div className="text-center py-8 text-cscx-gray-500">
              <p>No enrichment data available yet.</p>
              <p className="text-sm mt-1">Click "Enrich Now" to gather data.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group fields by category */}
              {Object.entries(categories).map(([category, _fieldNames]) => {
                // Filter fields for this category
                const categoryFields = data.fields.filter(f => f.category === category);

                // Skip if not matching active category filter
                if (activeCategory && activeCategory !== category) return null;

                // Skip empty categories
                if (categoryFields.length === 0) return null;

                return (
                  <div key={category}>
                    {!activeCategory && (
                      <h4 className="text-sm font-medium text-cscx-gray-300 mb-3 uppercase tracking-wider">
                        {category}
                      </h4>
                    )}
                    <div className={compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
                      {categoryFields.map((field) => (
                        <FieldCard
                          key={field.field_name}
                          field={field}
                          compact={compact}
                          onClick={onFieldClick ? () => onFieldClick(field) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent Changes */}
      {data && data.recent_changes.length > 0 && (
        <div className="border-t border-cscx-gray-800">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-cscx-gray-400 hover:bg-cscx-gray-800/50 transition-colors"
          >
            <span>Recent Changes ({data.recent_changes.length})</span>
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="px-4 pb-4 space-y-2">
              {data.recent_changes.slice(0, 5).map((change, index) => (
                <ChangeItem key={index} change={change} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      {!compact && (
        <div className="px-4 py-3 border-t border-cscx-gray-800 flex items-center justify-between text-sm">
          <button
            onClick={() => fetchEnrichmentData(entityType, entityId)}
            className="text-cscx-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
          <span className="text-cscx-gray-500">
            {data?.fields.length || 0} fields enriched
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================
// FIELD CARD COMPONENT
// ============================================

interface FieldCardProps {
  field: EnrichmentFieldDisplay;
  compact?: boolean;
  onClick?: () => void;
}

const FieldCard: React.FC<FieldCardProps> = ({ field, compact, onClick }) => {
  const renderValue = () => {
    // Handle arrays specially
    if (Array.isArray(field.value)) {
      if (field.value.length === 0) return <span className="text-cscx-gray-500">None</span>;

      // If array of objects with title/name fields
      if (typeof field.value[0] === 'object' && field.value[0] !== null) {
        const items = field.value as Array<{ title?: string; name?: string; company?: string }>;
        return (
          <div className="space-y-1">
            {items.slice(0, 3).map((item, i) => (
              <div key={i} className="text-sm">
                {item.title || item.name}
                {item.company && <span className="text-cscx-gray-500"> at {item.company}</span>}
              </div>
            ))}
            {items.length > 3 && (
              <span className="text-cscx-gray-500 text-xs">+{items.length - 3} more</span>
            )}
          </div>
        );
      }

      // Array of strings
      return (
        <div className="flex flex-wrap gap-1">
          {(field.value as string[]).slice(0, 5).map((item, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-cscx-gray-800 text-cscx-gray-300 rounded text-xs"
            >
              {item}
            </span>
          ))}
          {field.value.length > 5 && (
            <span className="px-2 py-0.5 text-cscx-gray-500 text-xs">
              +{field.value.length - 5}
            </span>
          )}
        </div>
      );
    }

    // URL fields
    if (field.field_name.includes('url') || field.field_name.includes('linkedin')) {
      const url = field.value as string;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cscx-accent hover:underline text-sm truncate block"
        >
          {url}
        </a>
      );
    }

    // Default
    return <span className="text-white">{field.formatted_value}</span>;
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center justify-between py-1 ${onClick ? 'cursor-pointer hover:bg-cscx-gray-800/50 -mx-2 px-2 rounded' : ''}`}
      >
        <span className="text-cscx-gray-400 text-sm">{field.display_name}</span>
        <span className="text-white text-sm truncate max-w-[60%] text-right">
          {field.formatted_value}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 bg-cscx-gray-800/30 border border-cscx-gray-800 rounded-lg ${
        onClick ? 'cursor-pointer hover:border-cscx-gray-700 transition-colors' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-cscx-gray-400 text-xs">{field.display_name}</span>
        <div className="flex items-center gap-2">
          {/* Source badge */}
          <span
            className="px-1.5 py-0.5 bg-cscx-gray-700 text-cscx-gray-400 rounded text-[10px] uppercase"
            title={`Source: ${getSourceLabel(field.source)}`}
          >
            {field.source_icon}
          </span>
          {/* Confidence indicator */}
          <span
            className={`w-2 h-2 rounded-full ${getConfidenceBg(field.confidence)}`}
            title={`Confidence: ${Math.round(field.confidence * 100)}%`}
          />
        </div>
      </div>
      <div className="text-sm">{renderValue()}</div>
      {field.is_stale && (
        <div className="mt-1 text-[10px] text-yellow-400/80">
          May be outdated - {field.last_updated}
        </div>
      )}
    </div>
  );
};

// ============================================
// CHANGE ITEM COMPONENT
// ============================================

interface ChangeItemProps {
  change: EnrichmentChange;
}

const ChangeItem: React.FC<ChangeItemProps> = ({ change }) => {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'Not set';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="p-2 bg-cscx-gray-800/30 rounded text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-cscx-gray-300 font-medium">
          {change.field.replace(/_/g, ' ')}
        </span>
        <span className="text-cscx-gray-500">
          {new Date(change.detected_at).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-2 text-cscx-gray-400">
        <span className="truncate max-w-[40%]">{formatValue(change.old_value)}</span>
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span className="text-green-400 truncate max-w-[40%]">{formatValue(change.new_value)}</span>
      </div>
    </div>
  );
};

// ============================================
// COMPACT ENRICHMENT BADGE
// ============================================

interface EnrichmentBadgeProps {
  entityType: EntityType;
  entityId: string;
  onClick?: () => void;
}

export const EnrichmentBadge: React.FC<EnrichmentBadgeProps> = ({
  entityType,
  entityId,
  onClick
}) => {
  const { data, loading, fetchEnrichmentData } = useEnrichment();

  useEffect(() => {
    fetchEnrichmentData(entityType, entityId);
  }, [entityType, entityId, fetchEnrichmentData]);

  if (loading) {
    return (
      <span className="px-2 py-0.5 bg-cscx-gray-800 text-cscx-gray-400 rounded text-xs">
        ...
      </span>
    );
  }

  if (!data) {
    return (
      <button
        onClick={onClick}
        className="px-2 py-0.5 bg-cscx-gray-800 text-cscx-gray-400 rounded text-xs hover:bg-cscx-gray-700 transition-colors"
      >
        Not enriched
      </button>
    );
  }

  const freshnessColors: Record<string, string> = {
    fresh: 'bg-green-500/20 text-green-400',
    stale: 'bg-yellow-500/20 text-yellow-400',
    outdated: 'bg-red-500/20 text-red-400',
    never: 'bg-cscx-gray-800 text-cscx-gray-400'
  };

  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 hover:opacity-80 transition-opacity ${freshnessColors[data.data_freshness]}`}
    >
      <span>{data.coverage_percentage}%</span>
      {data.data_freshness === 'fresh' && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};

export default DataEnrichment;
