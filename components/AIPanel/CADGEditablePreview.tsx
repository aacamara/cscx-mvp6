/**
 * CADGEditablePreview - Generic editable preview component for CADG-generated documents
 *
 * This component provides a flexible, schema-driven editable preview that supports:
 * - Inline text editing for all text fields
 * - Add/remove items from lists
 * - Reorder items via up/down buttons
 * - Dropdown selection for owner assignments
 * - Date pickers for timeline fields
 * - Section collapse/expand
 * - AI Enhance button for content improvement
 *
 * Used by all CADG card types for HITL (Human-in-the-Loop) approval workflow.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export type FieldType =
  | 'text'           // Single line text input
  | 'textarea'       // Multi-line text input
  | 'date'           // Date picker
  | 'datetime'       // Date and time picker
  | 'dropdown'       // Single selection dropdown
  | 'multi-dropdown' // Multiple selection dropdown
  | 'list'           // List of text items (add/remove/reorder)
  | 'list-complex'   // List of complex objects with multiple fields
  | 'slider'         // Range slider (e.g., for influence level)
  | 'toggle'         // Boolean toggle
  | 'number';        // Numeric input

export interface DropdownOption {
  value: string;
  label: string;
}

export interface FieldSchema {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: DropdownOption[];  // For dropdown fields
  min?: number;                // For slider/number fields
  max?: number;                // For slider/number fields
  step?: number;               // For slider/number fields
  itemSchema?: FieldSchema[];  // For list-complex fields
  aiEnhanceable?: boolean;     // Whether AI suggestions are available
  rows?: number;               // For textarea fields
}

export interface SectionSchema {
  id: string;
  title: string;
  icon?: string;
  fields: FieldSchema[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface PreviewSchema {
  title: string;
  icon?: string;
  accentColor?: 'teal' | 'purple' | 'blue' | 'red' | 'green' | 'yellow' | 'orange';
  sections: SectionSchema[];
  showDataSources?: boolean;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

export interface DataSource {
  name: string;
  description?: string;
}

interface CADGEditablePreviewProps {
  schema: PreviewSchema;
  data: Record<string, any>;
  customer: CustomerData;
  dataSources?: DataSource[];
  onSave: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  saveButtonText?: string;
  saveButtonIcon?: string;
}

// ============================================
// Accent Color Helpers
// ============================================

const getAccentClasses = (color: PreviewSchema['accentColor'] = 'teal') => {
  const colors = {
    teal: {
      gradient: 'from-teal-600/20',
      border: 'border-teal-600',
      bg: 'bg-teal-600',
      bgHover: 'hover:bg-teal-700',
      text: 'text-teal-400',
      focus: 'focus:border-teal-500',
    },
    purple: {
      gradient: 'from-purple-600/20',
      border: 'border-purple-600',
      bg: 'bg-purple-600',
      bgHover: 'hover:bg-purple-700',
      text: 'text-purple-400',
      focus: 'focus:border-purple-500',
    },
    blue: {
      gradient: 'from-blue-600/20',
      border: 'border-blue-600',
      bg: 'bg-blue-600',
      bgHover: 'hover:bg-blue-700',
      text: 'text-blue-400',
      focus: 'focus:border-blue-500',
    },
    red: {
      gradient: 'from-red-600/20',
      border: 'border-red-600',
      bg: 'bg-red-600',
      bgHover: 'hover:bg-red-700',
      text: 'text-red-400',
      focus: 'focus:border-red-500',
    },
    green: {
      gradient: 'from-green-600/20',
      border: 'border-green-600',
      bg: 'bg-green-600',
      bgHover: 'hover:bg-green-700',
      text: 'text-green-400',
      focus: 'focus:border-green-500',
    },
    yellow: {
      gradient: 'from-yellow-600/20',
      border: 'border-yellow-600',
      bg: 'bg-yellow-600',
      bgHover: 'hover:bg-yellow-700',
      text: 'text-yellow-400',
      focus: 'focus:border-yellow-500',
    },
    orange: {
      gradient: 'from-orange-600/20',
      border: 'border-orange-600',
      bg: 'bg-orange-600',
      bgHover: 'hover:bg-orange-700',
      text: 'text-orange-400',
      focus: 'focus:border-orange-500',
    },
  };
  return colors[color];
};

// ============================================
// Component
// ============================================

export const CADGEditablePreview: React.FC<CADGEditablePreviewProps> = ({
  schema,
  data,
  customer,
  dataSources,
  onSave,
  onCancel,
  saveButtonText = 'Create Document',
  saveButtonIcon = '📄',
}) => {
  const { getAuthHeaders } = useAuth();
  const accent = getAccentClasses(schema.accentColor);

  // Original data for tracking modifications
  const [original] = useState<Record<string, any>>(() => JSON.parse(JSON.stringify(data)));

  // Editable draft state
  const [draft, setDraft] = useState<Record<string, any>>(() => JSON.parse(JSON.stringify(data)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    schema.sections.forEach(section => {
      if (section.defaultCollapsed) {
        collapsed.add(section.id);
      }
    });
    return collapsed;
  });

  // AI enhancement state
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string | string[]>>({});

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Update field value
  const updateField = useCallback((fieldId: string, value: any) => {
    setDraft(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  // List operations
  const addListItem = useCallback((fieldId: string, itemSchema?: FieldSchema[]) => {
    setDraft(prev => {
      const currentList = prev[fieldId] || [];
      if (itemSchema) {
        // Complex list item - create object with all fields
        const newItem: Record<string, any> = { id: `item-${Date.now()}` };
        itemSchema.forEach(field => {
          newItem[field.id] = '';
        });
        return { ...prev, [fieldId]: [...currentList, newItem] };
      } else {
        // Simple list item - just a string
        return { ...prev, [fieldId]: [...currentList, ''] };
      }
    });
  }, []);

  const removeListItem = useCallback((fieldId: string, index: number) => {
    setDraft(prev => {
      const currentList = [...(prev[fieldId] || [])];
      currentList.splice(index, 1);
      return { ...prev, [fieldId]: currentList };
    });
  }, []);

  const updateListItem = useCallback((fieldId: string, index: number, value: any) => {
    setDraft(prev => {
      const currentList = [...(prev[fieldId] || [])];
      currentList[index] = value;
      return { ...prev, [fieldId]: currentList };
    });
  }, []);

  const reorderListItem = useCallback((fieldId: string, fromIndex: number, toIndex: number) => {
    if (toIndex < 0) return;
    setDraft(prev => {
      const currentList = [...(prev[fieldId] || [])];
      if (toIndex >= currentList.length) return prev;
      const [item] = currentList.splice(fromIndex, 1);
      currentList.splice(toIndex, 0, item);
      return { ...prev, [fieldId]: currentList };
    });
  }, []);

  // AI enhancement
  const handleAiEnhance = async (fieldId: string, fieldType: FieldType, currentValue: any) => {
    setAiLoading(prev => ({ ...prev, [fieldId]: true }));
    setAiSuggestions(prev => ({ ...prev, [fieldId]: undefined as any }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/cadg/enhance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            fieldId,
            fieldType,
            currentValue,
            documentTitle: schema.title,
            customerId: customer.id,
            context: draft,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get AI suggestions');
      }

      const result = await response.json();
      setAiSuggestions(prev => ({ ...prev, [fieldId]: result.suggestion }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
    } finally {
      setAiLoading(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const applyAiSuggestion = (fieldId: string) => {
    const suggestion = aiSuggestions[fieldId];
    if (suggestion !== undefined) {
      updateField(fieldId, suggestion);
      setAiSuggestions(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const dismissAiSuggestion = (fieldId: string) => {
    setAiSuggestions(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (isModified) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  // Render a single field based on its type
  const renderField = (field: FieldSchema, value: any) => {
    const baseInputClass = `w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${accent.focus} disabled:opacity-50`;

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isSaving}
            className={baseInputClass}
            placeholder={field.placeholder}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isSaving}
            rows={field.rows || 4}
            className={`${baseInputClass} resize-y`}
            placeholder={field.placeholder}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isSaving}
            className={baseInputClass}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isSaving}
            className={baseInputClass}
          />
        );

      case 'dropdown':
        return (
          <select
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isSaving}
            className={baseInputClass}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'multi-dropdown':
        const selectedValues = value || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedValues.map((val: string, idx: number) => {
                const option = field.options?.find(o => o.value === val);
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-cscx-gray-700 text-white text-sm rounded-lg"
                  >
                    {option?.label || val}
                    <button
                      onClick={() => {
                        const newValues = selectedValues.filter((_: any, i: number) => i !== idx);
                        updateField(field.id, newValues);
                      }}
                      className="text-cscx-gray-400 hover:text-red-400"
                    >
                      x
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selectedValues.includes(e.target.value)) {
                  updateField(field.id, [...selectedValues, e.target.value]);
                }
              }}
              disabled={isSaving}
              className={baseInputClass}
            >
              <option value="">Add {field.label.toLowerCase()}...</option>
              {field.options?.filter(o => !selectedValues.includes(o.value)).map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'slider':
        return (
          <div className="flex items-center gap-4">
            <input
              type="range"
              value={value || field.min || 0}
              min={field.min || 0}
              max={field.max || 100}
              step={field.step || 1}
              onChange={(e) => updateField(field.id, Number(e.target.value))}
              disabled={isSaving}
              className="flex-1 accent-teal-500"
            />
            <span className="text-white text-sm font-medium w-12 text-right">
              {value || field.min || 0}
            </span>
          </div>
        );

      case 'toggle':
        return (
          <button
            onClick={() => updateField(field.id, !value)}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-teal-600' : 'bg-cscx-gray-700'
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            onChange={(e) => updateField(field.id, e.target.value ? Number(e.target.value) : null)}
            disabled={isSaving}
            className={baseInputClass}
            placeholder={field.placeholder}
          />
        );

      case 'list':
        const listItems = value || [];
        return (
          <div className="space-y-2">
            {listItems.map((item: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-cscx-gray-500 text-sm w-6">{idx + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateListItem(field.id, idx, e.target.value)}
                  disabled={isSaving}
                  className={`flex-1 ${baseInputClass}`}
                  placeholder={field.placeholder}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => reorderListItem(field.id, idx, idx - 1)}
                    disabled={isSaving || idx === 0}
                    className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => reorderListItem(field.id, idx, idx + 1)}
                    disabled={isSaving || idx === listItems.length - 1}
                    className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeListItem(field.id, idx)}
                    disabled={isSaving}
                    className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => addListItem(field.id)}
              disabled={isSaving}
              className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add Item
            </button>
          </div>
        );

      case 'list-complex':
        const complexItems = value || [];
        return (
          <div className="space-y-3">
            {complexItems.map((item: Record<string, any>, idx: number) => (
              <div
                key={item.id || idx}
                className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-cscx-gray-400 text-xs font-medium">Item {idx + 1}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => reorderListItem(field.id, idx, idx - 1)}
                      disabled={isSaving || idx === 0}
                      className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => reorderListItem(field.id, idx, idx + 1)}
                      disabled={isSaving || idx === complexItems.length - 1}
                      className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeListItem(field.id, idx)}
                      disabled={isSaving}
                      className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {field.itemSchema?.map(subField => (
                  <div key={subField.id}>
                    <label className="text-xs text-cscx-gray-400 block mb-1">
                      {subField.label}
                    </label>
                    {subField.type === 'textarea' ? (
                      <textarea
                        value={item[subField.id] || ''}
                        onChange={(e) => {
                          const newItem = { ...item, [subField.id]: e.target.value };
                          updateListItem(field.id, idx, newItem);
                        }}
                        disabled={isSaving}
                        rows={subField.rows || 2}
                        className={`${baseInputClass} resize-y text-xs`}
                        placeholder={subField.placeholder}
                      />
                    ) : subField.type === 'dropdown' ? (
                      <select
                        value={item[subField.id] || ''}
                        onChange={(e) => {
                          const newItem = { ...item, [subField.id]: e.target.value };
                          updateListItem(field.id, idx, newItem);
                        }}
                        disabled={isSaving}
                        className={`${baseInputClass} text-xs`}
                      >
                        <option value="">Select...</option>
                        {subField.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : subField.type === 'date' ? (
                      <input
                        type="date"
                        value={item[subField.id] || ''}
                        onChange={(e) => {
                          const newItem = { ...item, [subField.id]: e.target.value };
                          updateListItem(field.id, idx, newItem);
                        }}
                        disabled={isSaving}
                        className={`${baseInputClass} text-xs`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={item[subField.id] || ''}
                        onChange={(e) => {
                          const newItem = { ...item, [subField.id]: e.target.value };
                          updateListItem(field.id, idx, newItem);
                        }}
                        disabled={isSaving}
                        className={`${baseInputClass} text-xs`}
                        placeholder={subField.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
            <button
              onClick={() => addListItem(field.id, field.itemSchema)}
              disabled={isSaving}
              className="text-xs px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add {field.label.replace(/s$/, '')}
            </button>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isSaving}
            className={baseInputClass}
            placeholder={field.placeholder}
          />
        );
    }
  };

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className={`bg-gradient-to-r ${accent.gradient} to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{schema.icon || '📄'}</span>
              <h3 className="text-white font-semibold">{schema.title}</h3>
              {isModified && (
                <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                  Modified
                </span>
              )}
            </div>
            <p className="text-cscx-gray-400 text-sm mt-1">
              For: {customer.name}
            </p>
          </div>
          {customer.healthScore !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-400">Health</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                customer.healthScore >= 80 ? 'bg-green-900/50 text-green-400' :
                customer.healthScore >= 60 ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {customer.healthScore}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-6">
        {schema.sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);

          return (
            <div key={section.id} className="space-y-4">
              {/* Section Header */}
              <div
                className={`flex items-center justify-between ${section.collapsible ? 'cursor-pointer' : ''}`}
                onClick={() => section.collapsible && toggleSection(section.id)}
              >
                <div className="flex items-center gap-2">
                  {section.icon && <span>{section.icon}</span>}
                  <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                    {section.title}
                  </h4>
                </div>
                {section.collapsible && (
                  <span className="text-cscx-gray-500 text-xs">
                    {isCollapsed ? '+ Expand' : '- Collapse'}
                  </span>
                )}
              </div>

              {/* Section Fields */}
              {!isCollapsed && (
                <div className="space-y-4">
                  {section.fields.map((field) => (
                    <div key={field.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        {field.aiEnhanceable && (
                          <button
                            onClick={() => handleAiEnhance(field.id, field.type, draft[field.id])}
                            disabled={aiLoading[field.id] || isSaving}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                          >
                            {aiLoading[field.id] ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-300 border-t-transparent" />
                                Enhancing...
                              </>
                            ) : (
                              <>
                                <span>*</span>
                                AI Enhance
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {renderField(field, draft[field.id])}

                      {/* AI Suggestion Card */}
                      {aiSuggestions[field.id] !== undefined && (
                        <div className="mt-2 bg-blue-900/20 border border-blue-500 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-400">
                              <span>*</span>
                              <span className="font-medium text-xs">AI Suggestion</span>
                            </div>
                          </div>
                          <div className="text-blue-200 text-sm whitespace-pre-wrap mb-3">
                            {Array.isArray(aiSuggestions[field.id])
                              ? (aiSuggestions[field.id] as string[]).join('\n')
                              : aiSuggestions[field.id]}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => applyAiSuggestion(field.id)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                            >
                              Apply
                            </button>
                            <button
                              onClick={() => dismissAiSuggestion(field.id)}
                              className="px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-xs rounded-lg transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data Sources Panel */}
      {schema.showDataSources && dataSources && dataSources.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-3">
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">
              Data Sources Used
            </h4>
            <div className="flex flex-wrap gap-2">
              {dataSources.map((source, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-cscx-gray-800 text-cscx-gray-300 px-2 py-1 rounded-full flex items-center gap-1"
                  title={source.description}
                >
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {source.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex gap-3 sticky bottom-0 bg-cscx-gray-800 pt-2 border-t border-cscx-gray-700">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex-1 px-4 py-2.5 ${accent.bg} ${accent.bgHover} text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>{saveButtonIcon}</span>
              {saveButtonText}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGEditablePreview;
