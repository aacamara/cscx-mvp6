/**
 * Custom Report Builder
 * PRD-180: Drag-and-drop report building with filters, groupings, and visualizations
 *
 * Features:
 * - Data source selection
 * - Column selection with drag-and-drop reordering
 * - Advanced filter builder with AND/OR logic
 * - Grouping and sorting configuration
 * - Multiple visualization types
 * - Live preview
 * - Save, schedule, and share functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CustomReport,
  ReportConfig,
  DataSourceType,
  ReportColumn,
  ReportFilter,
  FilterGroup,
  ReportGrouping,
  ReportSorting,
  VisualizationConfig,
  ReportExecutionResult,
  BuilderStep,
  DATA_SOURCES,
  FILTER_OPERATORS,
  OPERATOR_LABELS,
  FieldDefinition
} from '../../../types/customReportBuilder';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Helper Functions
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatNumber = (value: number, decimals = 0): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatCellValue = (value: unknown, fieldType: string): string => {
  if (value === null || value === undefined) return '-';
  switch (fieldType) {
    case 'currency':
      return formatCurrency(Number(value));
    case 'number':
      return formatNumber(Number(value));
    case 'date':
      return formatDate(String(value));
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
};

// ============================================
// Sub-Components
// ============================================

interface StepIndicatorProps {
  currentStep: BuilderStep;
  onStepClick: (step: BuilderStep) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  const steps: { id: BuilderStep; label: string; icon: string }[] = [
    { id: 'source', label: 'Data Source', icon: '\u{1F4CA}' },
    { id: 'columns', label: 'Columns', icon: '\u{1F4CB}' },
    { id: 'filters', label: 'Filters', icon: '\u{1F50D}' },
    { id: 'grouping', label: 'Group & Sort', icon: '\u{1F4C8}' },
    { id: 'visualization', label: 'Visualization', icon: '\u{1F4C8}' },
    { id: 'preview', label: 'Preview', icon: '\u{1F441}' }
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-between mb-8 px-4">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <button
            onClick={() => onStepClick(step.id)}
            className={`flex flex-col items-center gap-1 ${
              index <= currentIndex ? 'text-cscx-accent' : 'text-gray-500'
            } hover:text-cscx-accent transition-colors`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                index === currentIndex
                  ? 'bg-cscx-accent text-white'
                  : index < currentIndex
                  ? 'bg-cscx-accent/20 text-cscx-accent'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {step.icon}
            </div>
            <span className="text-xs font-medium">{step.label}</span>
          </button>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${
                index < currentIndex ? 'bg-cscx-accent' : 'bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface DataSourceSelectorProps {
  selectedSource: DataSourceType | null;
  onSelect: (source: DataSourceType) => void;
}

const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({ selectedSource, onSelect }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Select Data Source</h3>
      <p className="text-gray-400 text-sm">Choose the primary data source for your report.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {DATA_SOURCES.map(source => (
          <button
            key={source.id}
            onClick={() => onSelect(source.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedSource === source.id
                ? 'border-cscx-accent bg-cscx-accent/10'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <h4 className="font-medium text-white">{source.name}</h4>
            <p className="text-xs text-gray-400 mt-1">{source.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

interface ColumnSelectorProps {
  dataSource: DataSourceType;
  selectedColumns: ReportColumn[];
  onColumnsChange: (columns: ReportColumn[]) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  dataSource,
  selectedColumns,
  onColumnsChange
}) => {
  const availableFields = DATA_SOURCES.find(ds => ds.id === dataSource)?.available_fields || [];

  const toggleColumn = (field: FieldDefinition) => {
    const existing = selectedColumns.find(c => c.field_id === field.id);
    if (existing) {
      onColumnsChange(selectedColumns.filter(c => c.field_id !== field.id));
    } else {
      const newColumn: ReportColumn = {
        id: `col-${Date.now()}`,
        field_id: field.id,
        field_name: field.name,
        field_type: field.type,
        display_name: field.name,
        visible: true,
        order: selectedColumns.length
      };
      onColumnsChange([...selectedColumns, newColumn]);
    }
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...selectedColumns];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newColumns.length) return;
    [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
    newColumns.forEach((col, i) => { col.order = i; });
    onColumnsChange(newColumns);
  };

  const updateColumnDisplayName = (columnId: string, displayName: string) => {
    onColumnsChange(
      selectedColumns.map(c =>
        c.id === columnId ? { ...c, display_name: displayName } : c
      )
    );
  };

  const updateColumnAggregation = (columnId: string, aggregation: string | undefined) => {
    onColumnsChange(
      selectedColumns.map(c =>
        c.id === columnId ? { ...c, aggregation: aggregation as any } : c
      )
    );
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Available Fields */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Available Fields</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableFields.map(field => {
            const isSelected = selectedColumns.some(c => c.field_id === field.id);
            return (
              <button
                key={field.id}
                onClick={() => toggleColumn(field)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cscx-accent bg-cscx-accent/10 text-cscx-accent'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{field.name}</span>
                  <span className="text-xs text-gray-400 capitalize">{field.type}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Columns */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Selected Columns ({selectedColumns.length})
        </h3>
        {selectedColumns.length === 0 ? (
          <p className="text-gray-400 text-sm">Click fields on the left to add columns.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedColumns
              .sort((a, b) => a.order - b.order)
              .map((column, index) => {
                const field = availableFields.find(f => f.id === column.field_id);
                return (
                  <div
                    key={column.id}
                    className="p-3 rounded-lg border border-gray-700 bg-gray-800/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={column.display_name}
                        onChange={e => updateColumnDisplayName(column.id, e.target.value)}
                        className="bg-transparent border-none text-white font-medium focus:outline-none focus:ring-1 focus:ring-cscx-accent rounded px-1"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveColumn(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                        >
                          ^
                        </button>
                        <button
                          onClick={() => moveColumn(index, 'down')}
                          disabled={index === selectedColumns.length - 1}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                        >
                          v
                        </button>
                        <button
                          onClick={() => toggleColumn(field!)}
                          className="p-1 text-gray-400 hover:text-red-400"
                        >
                          x
                        </button>
                      </div>
                    </div>
                    {field?.aggregatable && (
                      <select
                        value={column.aggregation || ''}
                        onChange={e => updateColumnAggregation(column.id, e.target.value || undefined)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                      >
                        <option value="">No aggregation</option>
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                        <option value="min">Minimum</option>
                        <option value="max">Maximum</option>
                        <option value="count">Count</option>
                        <option value="count_distinct">Count Distinct</option>
                      </select>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

interface FilterBuilderProps {
  dataSource: DataSourceType;
  filterGroup: FilterGroup;
  onFilterGroupChange: (group: FilterGroup) => void;
}

const FilterBuilder: React.FC<FilterBuilderProps> = ({
  dataSource,
  filterGroup,
  onFilterGroupChange
}) => {
  const availableFields = DATA_SOURCES.find(ds => ds.id === dataSource)?.available_fields || [];

  const addFilter = () => {
    const field = availableFields[0];
    if (!field) return;

    const newFilter: ReportFilter = {
      id: `filter-${Date.now()}`,
      field_id: field.id,
      field_name: field.name,
      operator: 'equals',
      value: ''
    };
    onFilterGroupChange({
      ...filterGroup,
      filters: [...filterGroup.filters, newFilter]
    });
  };

  const updateFilter = (filterId: string, updates: Partial<ReportFilter>) => {
    onFilterGroupChange({
      ...filterGroup,
      filters: filterGroup.filters.map(f =>
        f.id === filterId ? { ...f, ...updates } : f
      )
    });
  };

  const removeFilter = (filterId: string) => {
    onFilterGroupChange({
      ...filterGroup,
      filters: filterGroup.filters.filter(f => f.id !== filterId)
    });
  };

  const handleFieldChange = (filterId: string, fieldId: string) => {
    const field = availableFields.find(f => f.id === fieldId);
    if (!field) return;

    const operators = FILTER_OPERATORS[field.type] || [];
    updateFilter(filterId, {
      field_id: fieldId,
      field_name: field.name,
      operator: operators[0] || 'equals',
      value: ''
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Filters</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Match:</span>
            <select
              value={filterGroup.logic}
              onChange={e => onFilterGroupChange({ ...filterGroup, logic: e.target.value as 'AND' | 'OR' })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="AND">ALL conditions (AND)</option>
              <option value="OR">ANY condition (OR)</option>
            </select>
          </div>
          <button
            onClick={addFilter}
            className="px-3 py-1.5 bg-cscx-accent text-white text-sm rounded hover:bg-cscx-accent/80 transition-colors"
          >
            + Add Filter
          </button>
        </div>
      </div>

      {filterGroup.filters.length === 0 ? (
        <p className="text-gray-400 text-sm py-4">No filters applied. Click "Add Filter" to create one.</p>
      ) : (
        <div className="space-y-3">
          {filterGroup.filters.map((filter, index) => {
            const field = availableFields.find(f => f.id === filter.field_id);
            const operators = field ? (FILTER_OPERATORS[field.type] || []) : [];

            return (
              <div key={filter.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                {index > 0 && (
                  <span className="text-sm text-cscx-accent font-medium w-12">
                    {filterGroup.logic}
                  </span>
                )}
                {index === 0 && <span className="w-12 text-sm text-gray-400">Where</span>}

                <select
                  value={filter.field_id}
                  onChange={e => handleFieldChange(filter.id, e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  {availableFields.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={e => updateFilter(filter.id, { operator: e.target.value as any })}
                  className="w-48 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  {operators.map(op => (
                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                  ))}
                </select>

                {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                  <input
                    type={field?.type === 'number' || field?.type === 'currency' ? 'number' : 'text'}
                    value={filter.value as string}
                    onChange={e => updateFilter(filter.id, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                )}

                {filter.operator === 'between' && (
                  <input
                    type={field?.type === 'number' || field?.type === 'currency' ? 'number' : 'text'}
                    value={filter.value2 as string || ''}
                    onChange={e => updateFilter(filter.id, { value2: e.target.value })}
                    placeholder="To value"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                )}

                <button
                  onClick={() => removeFilter(filter.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface GroupingSortingProps {
  dataSource: DataSourceType;
  columns: ReportColumn[];
  groupings: ReportGrouping[];
  sortings: ReportSorting[];
  onGroupingsChange: (groupings: ReportGrouping[]) => void;
  onSortingsChange: (sortings: ReportSorting[]) => void;
}

const GroupingSorting: React.FC<GroupingSortingProps> = ({
  dataSource,
  columns,
  groupings,
  sortings,
  onGroupingsChange,
  onSortingsChange
}) => {
  const availableFields = DATA_SOURCES.find(ds => ds.id === dataSource)?.available_fields || [];
  const sortableFields = availableFields.filter(f => f.sortable);

  const addGrouping = () => {
    const usedIds = groupings.map(g => g.field_id);
    const availableField = columns.find(c => !usedIds.includes(c.field_id));
    if (!availableField) return;

    onGroupingsChange([
      ...groupings,
      { field_id: availableField.field_id, field_name: availableField.field_name, order: groupings.length }
    ]);
  };

  const addSorting = () => {
    const usedIds = sortings.map(s => s.field_id);
    const availableField = sortableFields.find(f => !usedIds.includes(f.id));
    if (!availableField) return;

    onSortingsChange([
      ...sortings,
      { field_id: availableField.id, field_name: availableField.name, direction: 'asc', order: sortings.length }
    ]);
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Grouping */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Group By</h3>
          <button
            onClick={addGrouping}
            disabled={groupings.length >= columns.length}
            className="px-3 py-1.5 bg-cscx-accent text-white text-sm rounded hover:bg-cscx-accent/80 transition-colors disabled:opacity-50"
          >
            + Add Group
          </button>
        </div>
        {groupings.length === 0 ? (
          <p className="text-gray-400 text-sm">No grouping applied. Results will show all rows.</p>
        ) : (
          <div className="space-y-2">
            {groupings.map((group, index) => (
              <div key={group.field_id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <span className="text-sm text-gray-400 w-16">Group {index + 1}</span>
                <select
                  value={group.field_id}
                  onChange={e => {
                    const field = columns.find(c => c.field_id === e.target.value);
                    if (!field) return;
                    const newGroupings = [...groupings];
                    newGroupings[index] = { ...group, field_id: field.field_id, field_name: field.field_name };
                    onGroupingsChange(newGroupings);
                  }}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  {columns.map(c => (
                    <option key={c.field_id} value={c.field_id}>{c.display_name}</option>
                  ))}
                </select>
                <button
                  onClick={() => onGroupingsChange(groupings.filter((_, i) => i !== index))}
                  className="p-2 text-gray-400 hover:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sorting */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Sort By</h3>
          <button
            onClick={addSorting}
            disabled={sortings.length >= sortableFields.length}
            className="px-3 py-1.5 bg-cscx-accent text-white text-sm rounded hover:bg-cscx-accent/80 transition-colors disabled:opacity-50"
          >
            + Add Sort
          </button>
        </div>
        {sortings.length === 0 ? (
          <p className="text-gray-400 text-sm">No sorting applied. Results will use default order.</p>
        ) : (
          <div className="space-y-2">
            {sortings.map((sort, index) => (
              <div key={sort.field_id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <span className="text-sm text-gray-400 w-16">Then by</span>
                <select
                  value={sort.field_id}
                  onChange={e => {
                    const field = sortableFields.find(f => f.id === e.target.value);
                    if (!field) return;
                    const newSortings = [...sortings];
                    newSortings[index] = { ...sort, field_id: field.id, field_name: field.name };
                    onSortingsChange(newSortings);
                  }}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  {sortableFields.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <select
                  value={sort.direction}
                  onChange={e => {
                    const newSortings = [...sortings];
                    newSortings[index] = { ...sort, direction: e.target.value as 'asc' | 'desc' };
                    onSortingsChange(newSortings);
                  }}
                  className="w-32 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <button
                  onClick={() => onSortingsChange(sortings.filter((_, i) => i !== index))}
                  className="p-2 text-gray-400 hover:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface VisualizationSelectorProps {
  config: VisualizationConfig;
  onConfigChange: (config: VisualizationConfig) => void;
}

const VisualizationSelector: React.FC<VisualizationSelectorProps> = ({
  config,
  onConfigChange
}) => {
  const visualTypes = [
    { id: 'table', name: 'Table', icon: '\u{1F4CB}', description: 'Display data in rows and columns' },
    { id: 'bar_chart', name: 'Bar Chart', icon: '\u{1F4CA}', description: 'Compare values across categories' },
    { id: 'line_chart', name: 'Line Chart', icon: '\u{1F4C8}', description: 'Show trends over time' },
    { id: 'pie_chart', name: 'Pie Chart', icon: '\u{1F967}', description: 'Show proportions of a whole' },
    { id: 'metric_card', name: 'Metric Cards', icon: '\u{1F4B0}', description: 'Display key metrics prominently' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Visualization Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {visualTypes.map(vt => (
            <button
              key={vt.id}
              onClick={() => onConfigChange({ ...config, type: vt.id as any })}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                config.type === vt.id
                  ? 'border-cscx-accent bg-cscx-accent/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">{vt.icon}</div>
              <h4 className="font-medium text-white text-sm">{vt.name}</h4>
              <p className="text-xs text-gray-400 mt-1">{vt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {config.type !== 'table' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Chart Title</label>
            <input
              type="text"
              value={config.title || ''}
              onChange={e => onConfigChange({ ...config, title: e.target.value })}
              placeholder="Enter chart title"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={config.show_legend ?? true}
                onChange={e => onConfigChange({ ...config, show_legend: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-cscx-accent focus:ring-cscx-accent"
              />
              Show Legend
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={config.show_data_labels ?? false}
                onChange={e => onConfigChange({ ...config, show_data_labels: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-cscx-accent focus:ring-cscx-accent"
              />
              Show Data Labels
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

interface ReportPreviewProps {
  result: ReportExecutionResult | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ result, isLoading, onRefresh }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cscx-accent"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Click "Run Preview" to see your report results.</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-cscx-accent text-white rounded hover:bg-cscx-accent/80 transition-colors"
        >
          Run Preview
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {result.total_rows} row{result.total_rows !== 1 ? 's' : ''} | {result.execution_time_ms}ms
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {result.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Total Rows</p>
            <p className="text-2xl font-semibold text-white">{formatNumber(result.summary.row_count)}</p>
          </div>
          {Object.entries(result.summary)
            .filter(([key]) => key.endsWith('_sum') && key !== 'row_count')
            .slice(0, 3)
            .map(([key, value]) => {
              const fieldName = key.replace('_sum', '');
              const column = result.columns.find(c => c.field_id === fieldName);
              return (
                <div key={key} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Total {column?.display_name || fieldName}</p>
                  <p className="text-2xl font-semibold text-white">
                    {column?.field_type === 'currency' ? formatCurrency(value) : formatNumber(value)}
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {result.columns.map(col => (
                <th
                  key={col.id}
                  className="px-4 py-3 text-left font-medium text-gray-400"
                >
                  {col.display_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 25).map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-gray-800 hover:bg-gray-800/50"
              >
                {result.columns.map(col => (
                  <td
                    key={col.id}
                    className={`px-4 py-3 ${
                      col.field_type === 'number' || col.field_type === 'currency'
                        ? 'text-right'
                        : 'text-left'
                    } text-white`}
                  >
                    {formatCellValue(row[col.field_id], col.field_type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.total_rows > 25 && (
          <p className="text-center text-sm text-gray-400 py-4">
            Showing 25 of {result.total_rows} rows
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

interface CustomReportBuilderProps {
  reportId?: string;
  onSave?: (report: CustomReport) => void;
  onCancel?: () => void;
}

export const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  reportId,
  onSave,
  onCancel
}) => {
  // State
  const [currentStep, setCurrentStep] = useState<BuilderStep>('source');
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [config, setConfig] = useState<ReportConfig>({
    data_source: 'customers',
    columns: [],
    filters: { logic: 'AND', filters: [] },
    groupings: [],
    sortings: [],
    visualization: { type: 'table' },
    limit: 100
  });
  const [previewResult, setPreviewResult] = useState<ReportExecutionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing report if editing
  useEffect(() => {
    if (reportId) {
      loadReport(reportId);
    }
  }, [reportId]);

  const loadReport = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reports/custom/${id}`);
      if (!response.ok) throw new Error('Failed to load report');

      const { data } = await response.json();
      setReportName(data.name);
      setReportDescription(data.description || '');
      setConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  };

  const runPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/reports/custom/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      if (!response.ok) throw new Error('Failed to execute preview');

      const { data } = await response.json();
      setPreviewResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const handleSave = async () => {
    if (!reportName.trim()) {
      setError('Please enter a report name');
      return;
    }

    if (config.columns.length === 0) {
      setError('Please select at least one column');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = reportId
        ? `${API_BASE}/reports/custom/${reportId}`
        : `${API_BASE}/reports/custom`;
      const method = reportId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          description: reportDescription,
          config
        })
      });

      if (!response.ok) throw new Error('Failed to save report');

      const { data } = await response.json();
      onSave?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    const steps: BuilderStep[] = ['source', 'columns', 'filters', 'grouping', 'visualization', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: BuilderStep[] = ['source', 'columns', 'filters', 'grouping', 'visualization', 'preview'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'source':
        return !!config.data_source;
      case 'columns':
        return config.columns.length > 0;
      default:
        return true;
    }
  };

  // Reset columns when data source changes
  const handleDataSourceChange = (source: DataSourceType) => {
    setConfig({
      ...config,
      data_source: source,
      columns: [],
      filters: { logic: 'AND', filters: [] },
      groupings: [],
      sortings: []
    });
    setPreviewResult(null);
  };

  return (
    <div className="min-h-screen bg-cscx-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-white">
                {reportId ? 'Edit Report' : 'Create Custom Report'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !reportName.trim() || config.columns.length === 0}
                className="px-4 py-2 bg-cscx-accent text-white rounded hover:bg-cscx-accent/80 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Report'}
              </button>
            </div>
          </div>

          {/* Report Name & Description */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <input
              type="text"
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="Report Name *"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-cscx-accent focus:outline-none"
            />
            <input
              type="text"
              value={reportDescription}
              onChange={e => setReportDescription(e.target.value)}
              placeholder="Description (optional)"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-cscx-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <StepIndicator currentStep={currentStep} onStepClick={setCurrentStep} />

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 min-h-[400px]">
          {currentStep === 'source' && (
            <DataSourceSelector
              selectedSource={config.data_source}
              onSelect={handleDataSourceChange}
            />
          )}

          {currentStep === 'columns' && (
            <ColumnSelector
              dataSource={config.data_source}
              selectedColumns={config.columns}
              onColumnsChange={cols => setConfig({ ...config, columns: cols })}
            />
          )}

          {currentStep === 'filters' && (
            <FilterBuilder
              dataSource={config.data_source}
              filterGroup={config.filters}
              onFilterGroupChange={filters => setConfig({ ...config, filters })}
            />
          )}

          {currentStep === 'grouping' && (
            <GroupingSorting
              dataSource={config.data_source}
              columns={config.columns}
              groupings={config.groupings}
              sortings={config.sortings}
              onGroupingsChange={groupings => setConfig({ ...config, groupings })}
              onSortingsChange={sortings => setConfig({ ...config, sortings })}
            />
          )}

          {currentStep === 'visualization' && (
            <VisualizationSelector
              config={config.visualization}
              onConfigChange={visualization => setConfig({ ...config, visualization })}
            />
          )}

          {currentStep === 'preview' && (
            <ReportPreview
              result={previewResult}
              isLoading={isLoading}
              onRefresh={runPreview}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={prevStep}
            disabled={currentStep === 'source'}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
          >
            Previous
          </button>

          <div className="flex items-center gap-3">
            {currentStep === 'preview' && (
              <button
                onClick={runPreview}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Running...' : 'Run Preview'}
              </button>
            )}
            {currentStep !== 'preview' && (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="px-4 py-2 bg-cscx-accent text-white rounded hover:bg-cscx-accent/80 transition-colors disabled:opacity-50"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilder;
