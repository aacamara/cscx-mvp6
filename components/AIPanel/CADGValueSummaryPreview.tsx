/**
 * CADGValueSummaryPreview - Editable value summary preview for CADG-generated plans
 * Allows users to review, edit, and approve value metrics, success stories, testimonials, and ROI before creating presentation
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ValueMetric {
  id: string;
  name: string;
  value: string;
  unit: string;
  category: 'efficiency' | 'cost_savings' | 'revenue' | 'productivity' | 'satisfaction';
  description: string;
  included: boolean;
}

export interface SuccessStory {
  id: string;
  title: string;
  description: string;
  impact: string;
  date: string;
  category: 'implementation' | 'adoption' | 'expansion' | 'innovation' | 'support';
  included: boolean;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  title: string;
  date: string;
  included: boolean;
}

export interface ROICalculation {
  investmentCost: number;
  annualBenefit: number;
  roiPercentage: number;
  paybackMonths: number;
  threeYearValue: number;
  assumptions: string[];
}

export interface ValueSummaryData {
  title: string;
  executiveSummary: string;
  valueMetrics: ValueMetric[];
  successStories: SuccessStory[];
  testimonials: Testimonial[];
  roiCalculation: ROICalculation;
  keyHighlights: string[];
  nextSteps: string[];
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
}

interface CADGValueSummaryPreviewProps {
  valueSummary: ValueSummaryData;
  customer: CustomerData;
  onSave: (valueSummary: ValueSummaryData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const METRIC_CATEGORY_OPTIONS = ['efficiency', 'cost_savings', 'revenue', 'productivity', 'satisfaction'] as const;
const STORY_CATEGORY_OPTIONS = ['implementation', 'adoption', 'expansion', 'innovation', 'support'] as const;
const UNIT_OPTIONS = ['%', '$', 'hours', 'days', 'count', 'x'];

const CATEGORY_LABELS: Record<string, string> = {
  efficiency: 'Efficiency',
  cost_savings: 'Cost Savings',
  revenue: 'Revenue',
  productivity: 'Productivity',
  satisfaction: 'Satisfaction',
  implementation: 'Implementation',
  adoption: 'Adoption',
  expansion: 'Expansion',
  innovation: 'Innovation',
  support: 'Support',
};

const CATEGORY_COLORS: Record<string, string> = {
  efficiency: 'bg-blue-500/20 text-blue-400',
  cost_savings: 'bg-green-500/20 text-green-400',
  revenue: 'bg-purple-500/20 text-purple-400',
  productivity: 'bg-amber-500/20 text-amber-400',
  satisfaction: 'bg-pink-500/20 text-pink-400',
  implementation: 'bg-blue-500/20 text-blue-400',
  adoption: 'bg-emerald-500/20 text-emerald-400',
  expansion: 'bg-violet-500/20 text-violet-400',
  innovation: 'bg-orange-500/20 text-orange-400',
  support: 'bg-cyan-500/20 text-cyan-400',
};

// ============================================
// Component
// ============================================

export const CADGValueSummaryPreview: React.FC<CADGValueSummaryPreviewProps> = ({
  valueSummary,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<ValueSummaryData>(() => JSON.parse(JSON.stringify(valueSummary)));

  // Editable draft state
  const [draft, setDraft] = useState<ValueSummaryData>(() => JSON.parse(JSON.stringify(valueSummary)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'stories' | 'testimonials' | 'roi'>('overview');
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [expandedTestimonial, setExpandedTestimonial] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const includedMetrics = draft.valueMetrics.filter(m => m.included);
    const includedStories = draft.successStories.filter(s => s.included);
    const includedTestimonials = draft.testimonials.filter(t => t.included);
    return {
      metricsCount: includedMetrics.length,
      storiesCount: includedStories.length,
      testimonialsCount: includedTestimonials.length,
    };
  }, [draft.valueMetrics, draft.successStories, draft.testimonials]);

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

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create value summary');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Basic Field Operations
  // ============================================

  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  const updateExecutiveSummary = (value: string) => {
    setDraft(prev => ({ ...prev, executiveSummary: value }));
  };

  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Value Metric Operations
  // ============================================

  const toggleMetricIncluded = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      valueMetrics: prev.valueMetrics.map(m =>
        m.id === metricId ? { ...m, included: !m.included } : m
      ),
    }));
  };

  const updateMetric = (metricId: string, field: keyof ValueMetric, value: any) => {
    setDraft(prev => ({
      ...prev,
      valueMetrics: prev.valueMetrics.map(m =>
        m.id === metricId ? { ...m, [field]: value } : m
      ),
    }));
  };

  const addMetric = () => {
    const newId = `metric-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      valueMetrics: [
        ...prev.valueMetrics,
        {
          id: newId,
          name: 'New Metric',
          value: '0',
          unit: '%',
          category: 'efficiency',
          description: '',
          included: true,
        },
      ],
    }));
    setExpandedMetric(newId);
  };

  const removeMetric = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      valueMetrics: prev.valueMetrics.filter(m => m.id !== metricId),
    }));
    if (expandedMetric === metricId) setExpandedMetric(null);
  };

  // ============================================
  // Success Story Operations
  // ============================================

  const toggleStoryIncluded = (storyId: string) => {
    setDraft(prev => ({
      ...prev,
      successStories: prev.successStories.map(s =>
        s.id === storyId ? { ...s, included: !s.included } : s
      ),
    }));
  };

  const updateStory = (storyId: string, field: keyof SuccessStory, value: any) => {
    setDraft(prev => ({
      ...prev,
      successStories: prev.successStories.map(s =>
        s.id === storyId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addStory = () => {
    const newId = `story-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      successStories: [
        ...prev.successStories,
        {
          id: newId,
          title: 'New Success Story',
          description: '',
          impact: '',
          date: new Date().toISOString().slice(0, 7),
          category: 'implementation',
          included: true,
        },
      ],
    }));
    setExpandedStory(newId);
  };

  const removeStory = (storyId: string) => {
    setDraft(prev => ({
      ...prev,
      successStories: prev.successStories.filter(s => s.id !== storyId),
    }));
    if (expandedStory === storyId) setExpandedStory(null);
  };

  // ============================================
  // Testimonial Operations
  // ============================================

  const toggleTestimonialIncluded = (testimonialId: string) => {
    setDraft(prev => ({
      ...prev,
      testimonials: prev.testimonials.map(t =>
        t.id === testimonialId ? { ...t, included: !t.included } : t
      ),
    }));
  };

  const updateTestimonial = (testimonialId: string, field: keyof Testimonial, value: any) => {
    setDraft(prev => ({
      ...prev,
      testimonials: prev.testimonials.map(t =>
        t.id === testimonialId ? { ...t, [field]: value } : t
      ),
    }));
  };

  const addTestimonial = () => {
    const newId = `testimonial-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      testimonials: [
        ...prev.testimonials,
        {
          id: newId,
          quote: '',
          author: '',
          title: '',
          date: new Date().toISOString().slice(0, 7),
          included: true,
        },
      ],
    }));
    setExpandedTestimonial(newId);
  };

  const removeTestimonial = (testimonialId: string) => {
    setDraft(prev => ({
      ...prev,
      testimonials: prev.testimonials.filter(t => t.id !== testimonialId),
    }));
    if (expandedTestimonial === testimonialId) setExpandedTestimonial(null);
  };

  // ============================================
  // ROI Operations
  // ============================================

  const updateROI = (field: keyof ROICalculation, value: any) => {
    setDraft(prev => {
      const newROI = { ...prev.roiCalculation, [field]: value };
      // Recalculate derived values
      if (field === 'investmentCost' || field === 'annualBenefit') {
        const cost = field === 'investmentCost' ? value : newROI.investmentCost;
        const benefit = field === 'annualBenefit' ? value : newROI.annualBenefit;
        newROI.roiPercentage = cost > 0 ? Math.round(((benefit - cost) / cost) * 100) : 0;
        newROI.paybackMonths = benefit > 0 ? Math.round((cost / benefit) * 12) : 0;
        newROI.threeYearValue = benefit * 3 - cost;
      }
      return { ...prev, roiCalculation: newROI };
    });
  };

  const addAssumption = () => {
    setDraft(prev => ({
      ...prev,
      roiCalculation: {
        ...prev.roiCalculation,
        assumptions: [...prev.roiCalculation.assumptions, ''],
      },
    }));
  };

  const updateAssumption = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      roiCalculation: {
        ...prev.roiCalculation,
        assumptions: prev.roiCalculation.assumptions.map((a, i) =>
          i === index ? value : a
        ),
      },
    }));
  };

  const removeAssumption = (index: number) => {
    setDraft(prev => ({
      ...prev,
      roiCalculation: {
        ...prev.roiCalculation,
        assumptions: prev.roiCalculation.assumptions.filter((_, i) => i !== index),
      },
    }));
  };

  // ============================================
  // Highlights & Next Steps Operations
  // ============================================

  const addHighlight = () => {
    setDraft(prev => ({
      ...prev,
      keyHighlights: [...prev.keyHighlights, ''],
    }));
  };

  const updateHighlight = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      keyHighlights: prev.keyHighlights.map((h, i) => (i === index ? value : h)),
    }));
  };

  const removeHighlight = (index: number) => {
    setDraft(prev => ({
      ...prev,
      keyHighlights: prev.keyHighlights.filter((_, i) => i !== index),
    }));
  };

  const addNextStep = () => {
    setDraft(prev => ({
      ...prev,
      nextSteps: [...prev.nextSteps, ''],
    }));
  };

  const updateNextStep = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.map((s, i) => (i === index ? value : s)),
    }));
  };

  const removeNextStep = (index: number) => {
    setDraft(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.filter((_, i) => i !== index),
    }));
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Value Summary Preview</h2>
              <p className="text-white/70 text-sm">
                {customer.name} • Review and edit before creating presentation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">
              {summaryStats.metricsCount} metrics • {summaryStats.storiesCount} stories • {summaryStats.testimonialsCount} testimonials
            </span>
            {isModified && (
              <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 bg-cscx-gray-800/50">
        {(['overview', 'metrics', 'stories', 'testimonials', 'roi'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'metrics' && `Metrics (${draft.valueMetrics.length})`}
            {tab === 'stories' && `Stories (${draft.successStories.length})`}
            {tab === 'testimonials' && `Testimonials (${draft.testimonials.length})`}
            {tab === 'roi' && 'ROI Analysis'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateTitle(e.target.value)}
                className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Executive Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Executive Summary</label>
              <textarea
                value={draft.executiveSummary}
                onChange={(e) => updateExecutiveSummary(e.target.value)}
                rows={4}
                className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-4">
                <div className="text-3xl font-bold text-emerald-400">{draft.roiCalculation.roiPercentage}%</div>
                <div className="text-sm text-gray-400">ROI</div>
              </div>
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-4">
                <div className="text-3xl font-bold text-teal-400">${(draft.roiCalculation.annualBenefit / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Annual Benefit</div>
              </div>
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-4">
                <div className="text-3xl font-bold text-cyan-400">{draft.roiCalculation.paybackMonths}</div>
                <div className="text-sm text-gray-400">Payback Months</div>
              </div>
            </div>

            {/* Key Highlights */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Key Highlights</label>
                <button
                  onClick={addHighlight}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  + Add Highlight
                </button>
              </div>
              <div className="space-y-2">
                {draft.keyHighlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={highlight}
                      onChange={(e) => updateHighlight(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter highlight..."
                    />
                    <button
                      onClick={() => removeHighlight(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Next Steps</label>
                <button
                  onClick={addNextStep}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  + Add Step
                </button>
              </div>
              <div className="space-y-2">
                {draft.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm font-medium w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => updateNextStep(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter next step..."
                    />
                    <button
                      onClick={() => removeNextStep(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => updateNotes(e.target.value)}
                rows={2}
                className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Toggle metrics to include in the presentation
              </p>
              <button
                onClick={addMetric}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Metric
              </button>
            </div>

            {draft.valueMetrics.map((metric) => (
              <div
                key={metric.id}
                className={`bg-cscx-gray-900 border rounded-lg overflow-hidden ${
                  metric.included ? 'border-emerald-500/30' : 'border-white/10 opacity-60'
                }`}
              >
                {/* Metric Header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedMetric(expandedMetric === metric.id ? null : metric.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMetricIncluded(metric.id);
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      metric.included
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-500'
                    }`}
                  >
                    {metric.included && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{metric.name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${CATEGORY_COLORS[metric.category]}`}>
                        {CATEGORY_LABELS[metric.category]}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-emerald-400">
                      {metric.unit === '$' && '$'}{metric.value}{metric.unit !== '$' && metric.unit}
                    </div>
                  </div>

                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedMetric === metric.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Details */}
                {expandedMetric === metric.id && (
                  <div className="border-t border-white/10 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input
                          type="text"
                          value={metric.name}
                          onChange={(e) => updateMetric(metric.id, 'name', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Category</label>
                        <select
                          value={metric.category}
                          onChange={(e) => updateMetric(metric.id, 'category', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {METRIC_CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Value</label>
                        <input
                          type="text"
                          value={metric.value}
                          onChange={(e) => updateMetric(metric.id, 'value', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Unit</label>
                        <select
                          value={metric.unit}
                          onChange={(e) => updateMetric(metric.id, 'unit', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={metric.description}
                        onChange={(e) => updateMetric(metric.id, 'description', e.target.value)}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="How this value was achieved..."
                      />
                    </div>
                    <button
                      onClick={() => removeMetric(metric.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove Metric
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stories Tab */}
        {activeTab === 'stories' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Toggle stories to include in the presentation
              </p>
              <button
                onClick={addStory}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Story
              </button>
            </div>

            {draft.successStories.map((story) => (
              <div
                key={story.id}
                className={`bg-cscx-gray-900 border rounded-lg overflow-hidden ${
                  story.included ? 'border-emerald-500/30' : 'border-white/10 opacity-60'
                }`}
              >
                {/* Story Header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStoryIncluded(story.id);
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      story.included
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-500'
                    }`}
                  >
                    {story.included && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{story.title}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${CATEGORY_COLORS[story.category]}`}>
                        {CATEGORY_LABELS[story.category]}
                      </span>
                      <span className="text-xs text-gray-500">{story.date}</span>
                    </div>
                    {story.impact && (
                      <div className="text-sm text-gray-400 mt-0.5">{story.impact}</div>
                    )}
                  </div>

                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedStory === story.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Details */}
                {expandedStory === story.id && (
                  <div className="border-t border-white/10 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Title</label>
                        <input
                          type="text"
                          value={story.title}
                          onChange={(e) => updateStory(story.id, 'title', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Category</label>
                        <select
                          value={story.category}
                          onChange={(e) => updateStory(story.id, 'category', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {STORY_CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Date</label>
                      <input
                        type="month"
                        value={story.date}
                        onChange={(e) => updateStory(story.id, 'date', e.target.value)}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea
                        value={story.description}
                        onChange={(e) => updateStory(story.id, 'description', e.target.value)}
                        rows={2}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        placeholder="Describe what happened..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Impact</label>
                      <input
                        type="text"
                        value={story.impact}
                        onChange={(e) => updateStory(story.id, 'impact', e.target.value)}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Quantified impact statement..."
                      />
                    </div>
                    <button
                      onClick={() => removeStory(story.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove Story
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Testimonials Tab */}
        {activeTab === 'testimonials' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Toggle testimonials to include in the presentation
              </p>
              <button
                onClick={addTestimonial}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Testimonial
              </button>
            </div>

            {draft.testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className={`bg-cscx-gray-900 border rounded-lg overflow-hidden ${
                  testimonial.included ? 'border-emerald-500/30' : 'border-white/10 opacity-60'
                }`}
              >
                {/* Testimonial Header */}
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedTestimonial(expandedTestimonial === testimonial.id ? null : testimonial.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTestimonialIncluded(testimonial.id);
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                      testimonial.included
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-500'
                    }`}
                  >
                    {testimonial.included && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="text-white italic">"{testimonial.quote.slice(0, 100)}{testimonial.quote.length > 100 ? '...' : ''}"</div>
                    <div className="text-sm text-gray-400 mt-1">
                      — {testimonial.author}, {testimonial.title}
                    </div>
                  </div>

                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedTestimonial === testimonial.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Details */}
                {expandedTestimonial === testimonial.id && (
                  <div className="border-t border-white/10 p-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Quote</label>
                      <textarea
                        value={testimonial.quote}
                        onChange={(e) => updateTestimonial(testimonial.id, 'quote', e.target.value)}
                        rows={3}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        placeholder="The customer quote..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Author</label>
                        <input
                          type="text"
                          value={testimonial.author}
                          onChange={(e) => updateTestimonial(testimonial.id, 'author', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Person name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Title</label>
                        <input
                          type="text"
                          value={testimonial.title}
                          onChange={(e) => updateTestimonial(testimonial.id, 'title', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Job title"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Date</label>
                      <input
                        type="month"
                        value={testimonial.date}
                        onChange={(e) => updateTestimonial(testimonial.id, 'date', e.target.value)}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      onClick={() => removeTestimonial(testimonial.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove Testimonial
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ROI Tab */}
        {activeTab === 'roi' && (
          <div className="space-y-4">
            {/* ROI Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-500/30 rounded-lg p-4">
                <div className="text-4xl font-bold text-emerald-400">{draft.roiCalculation.roiPercentage}%</div>
                <div className="text-sm text-emerald-200">Return on Investment</div>
              </div>
              <div className="bg-gradient-to-br from-teal-600/20 to-teal-600/5 border border-teal-500/30 rounded-lg p-4">
                <div className="text-4xl font-bold text-teal-400">${(draft.roiCalculation.threeYearValue / 1000).toFixed(0)}K</div>
                <div className="text-sm text-teal-200">3-Year Value</div>
              </div>
            </div>

            {/* Investment & Benefit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Investment Cost ($)</label>
                <input
                  type="number"
                  value={draft.roiCalculation.investmentCost}
                  onChange={(e) => updateROI('investmentCost', parseInt(e.target.value) || 0)}
                  className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Annual Benefit ($)</label>
                <input
                  type="number"
                  value={draft.roiCalculation.annualBenefit}
                  onChange={(e) => updateROI('annualBenefit', parseInt(e.target.value) || 0)}
                  className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Calculated Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{draft.roiCalculation.roiPercentage}%</div>
                <div className="text-xs text-gray-400">ROI</div>
              </div>
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{draft.roiCalculation.paybackMonths} mo</div>
                <div className="text-xs text-gray-400">Payback Period</div>
              </div>
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">${(draft.roiCalculation.threeYearValue / 1000).toFixed(0)}K</div>
                <div className="text-xs text-gray-400">3-Year Value</div>
              </div>
            </div>

            {/* Assumptions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Assumptions</label>
                <button
                  onClick={addAssumption}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  + Add Assumption
                </button>
              </div>
              <div className="space-y-2">
                {draft.roiCalculation.assumptions.map((assumption, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-gray-500">•</span>
                    <input
                      type="text"
                      value={assumption}
                      onChange={(e) => updateAssumption(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter assumption..."
                    />
                    <button
                      onClick={() => removeAssumption(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between bg-cscx-gray-900/50">
        {error && (
          <div className="text-sm text-red-400">{error}</div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </span>
            ) : (
              'Create Presentation'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CADGValueSummaryPreview;
