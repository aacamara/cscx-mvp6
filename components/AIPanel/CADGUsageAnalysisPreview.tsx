/**
 * CADGUsageAnalysisPreview - Editable usage analysis preview for CADG-generated reports
 * Allows users to review, edit, and approve metrics, filters, and recommendations before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface UsageMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  included: boolean;
}

export interface FeatureAdoption {
  id: string;
  feature: string;
  adoptionRate: number;
  activeUsers: number;
  trend: 'up' | 'down' | 'stable';
  included: boolean;
}

export interface UserSegment {
  id: string;
  name: string;
  count: number;
  percentage: number;
  avgEngagement: number;
  included: boolean;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  impact: string;
}

export interface ChartTypes {
  showTrendChart: boolean;
  showAdoptionChart: boolean;
  showSegmentChart: boolean;
  showHeatmap: boolean;
}

export interface UsageAnalysisData {
  title: string;
  timeRange: {
    start: string;
    end: string;
    preset: string;
  };
  metrics: UsageMetric[];
  featureAdoption: FeatureAdoption[];
  userSegments: UserSegment[];
  recommendations: Recommendation[];
  chartTypes: ChartTypes;
  notes: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGUsageAnalysisPreviewProps {
  usageAnalysis: UsageAnalysisData;
  customer: CustomerData;
  onSave: (usageAnalysis: UsageAnalysisData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const TIME_RANGE_PRESETS = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const CATEGORY_OPTIONS = ['adoption', 'engagement', 'training', 'support', 'retention', 'expansion'];
const UNIT_OPTIONS = ['users', 'percent', 'minutes', 'sessions', 'actions', 'count'];
const TREND_OPTIONS = ['up', 'down', 'stable'] as const;

// ============================================
// Component
// ============================================

export const CADGUsageAnalysisPreview: React.FC<CADGUsageAnalysisPreviewProps> = ({
  usageAnalysis,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<UsageAnalysisData>(() => JSON.parse(JSON.stringify(usageAnalysis)));

  // Editable draft state
  const [draft, setDraft] = useState<UsageAnalysisData>(() => JSON.parse(JSON.stringify(usageAnalysis)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'features' | 'segments' | 'recommendations'>('metrics');

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

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
      setError(err instanceof Error ? err.message : 'Failed to create usage analysis');
    } finally {
      setIsSaving(false);
    }
  };

  // Update title
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  // Update notes
  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Time Range Operations
  // ============================================

  const updateTimeRangePreset = (preset: string) => {
    const endDate = new Date();
    let startDate = new Date();

    switch (preset) {
      case 'last_7_days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last_30_days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last_90_days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'last_year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'custom':
        // Keep current dates for custom
        startDate = new Date(draft.timeRange.start);
        break;
    }

    setDraft(prev => ({
      ...prev,
      timeRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        preset,
      },
    }));
  };

  const updateTimeRangeDate = (field: 'start' | 'end', value: string) => {
    setDraft(prev => ({
      ...prev,
      timeRange: {
        ...prev.timeRange,
        [field]: value,
        preset: 'custom',
      },
    }));
  };

  // ============================================
  // Metrics Operations
  // ============================================

  const toggleMetricIncluded = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      metrics: prev.metrics.map(m =>
        m.id === metricId ? { ...m, included: !m.included } : m
      ),
    }));
  };

  const updateMetric = (metricId: string, field: keyof UsageMetric, value: any) => {
    setDraft(prev => ({
      ...prev,
      metrics: prev.metrics.map(m =>
        m.id === metricId ? { ...m, [field]: value } : m
      ),
    }));
  };

  const addMetric = () => {
    setDraft(prev => ({
      ...prev,
      metrics: [
        ...prev.metrics,
        {
          id: `metric-${Date.now()}`,
          name: '',
          value: 0,
          unit: 'users',
          trend: 'stable',
          trendValue: 0,
          included: true,
        },
      ],
    }));
  };

  const removeMetric = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      metrics: prev.metrics.filter(m => m.id !== metricId),
    }));
  };

  // ============================================
  // Feature Adoption Operations
  // ============================================

  const toggleFeatureIncluded = (featureId: string) => {
    setDraft(prev => ({
      ...prev,
      featureAdoption: prev.featureAdoption.map(f =>
        f.id === featureId ? { ...f, included: !f.included } : f
      ),
    }));
  };

  const updateFeature = (featureId: string, field: keyof FeatureAdoption, value: any) => {
    setDraft(prev => ({
      ...prev,
      featureAdoption: prev.featureAdoption.map(f =>
        f.id === featureId ? { ...f, [field]: value } : f
      ),
    }));
  };

  const addFeature = () => {
    setDraft(prev => ({
      ...prev,
      featureAdoption: [
        ...prev.featureAdoption,
        {
          id: `feature-${Date.now()}`,
          feature: '',
          adoptionRate: 0,
          activeUsers: 0,
          trend: 'stable',
          included: true,
        },
      ],
    }));
  };

  const removeFeature = (featureId: string) => {
    setDraft(prev => ({
      ...prev,
      featureAdoption: prev.featureAdoption.filter(f => f.id !== featureId),
    }));
  };

  // ============================================
  // User Segments Operations
  // ============================================

  const toggleSegmentIncluded = (segmentId: string) => {
    setDraft(prev => ({
      ...prev,
      userSegments: prev.userSegments.map(s =>
        s.id === segmentId ? { ...s, included: !s.included } : s
      ),
    }));
  };

  const updateSegment = (segmentId: string, field: keyof UserSegment, value: any) => {
    setDraft(prev => ({
      ...prev,
      userSegments: prev.userSegments.map(s =>
        s.id === segmentId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSegment = () => {
    setDraft(prev => ({
      ...prev,
      userSegments: [
        ...prev.userSegments,
        {
          id: `segment-${Date.now()}`,
          name: '',
          count: 0,
          percentage: 0,
          avgEngagement: 0,
          included: true,
        },
      ],
    }));
  };

  const removeSegment = (segmentId: string) => {
    setDraft(prev => ({
      ...prev,
      userSegments: prev.userSegments.filter(s => s.id !== segmentId),
    }));
  };

  // ============================================
  // Recommendations Operations
  // ============================================

  const updateRecommendation = (recId: string, field: keyof Recommendation, value: any) => {
    setDraft(prev => ({
      ...prev,
      recommendations: prev.recommendations.map(r =>
        r.id === recId ? { ...r, [field]: value } : r
      ),
    }));
  };

  const addRecommendation = () => {
    setDraft(prev => ({
      ...prev,
      recommendations: [
        ...prev.recommendations,
        {
          id: `rec-${Date.now()}`,
          priority: 'medium',
          category: 'engagement',
          recommendation: '',
          impact: '',
        },
      ],
    }));
  };

  const removeRecommendation = (recId: string) => {
    setDraft(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter(r => r.id !== recId),
    }));
  };

  const moveRecommendation = (recId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const index = prev.recommendations.findIndex(r => r.id === recId);
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === prev.recommendations.length - 1)
      ) {
        return prev;
      }

      const newRecs = [...prev.recommendations];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newRecs[index], newRecs[swapIndex]] = [newRecs[swapIndex], newRecs[index]];

      return { ...prev, recommendations: newRecs };
    });
  };

  // ============================================
  // Chart Types Operations
  // ============================================

  const toggleChartType = (chartType: keyof ChartTypes) => {
    setDraft(prev => ({
      ...prev,
      chartTypes: {
        ...prev.chartTypes,
        [chartType]: !prev.chartTypes[chartType],
      },
    }));
  };

  // Base input class
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50';

  // Get trend icon and color
  const getTrendDisplay = (trend: 'up' | 'down' | 'stable', value?: number) => {
    switch (trend) {
      case 'up':
        return { icon: '↑', color: 'text-green-400', bgColor: 'bg-green-900/30' };
      case 'down':
        return { icon: '↓', color: 'text-red-400', bgColor: 'bg-red-900/30' };
      default:
        return { icon: '→', color: 'text-gray-400', bgColor: 'bg-gray-900/30' };
    }
  };

  // Get priority badge style
  const getPriorityStyle = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-900/30 text-red-400 border-red-600/30';
      case 'medium':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-600/30';
      case 'low':
        return 'bg-green-900/30 text-green-400 border-green-600/30';
    }
  };

  // Count included items
  const includedMetricsCount = draft.metrics.filter(m => m.included).length;
  const includedFeaturesCount = draft.featureAdoption.filter(f => f.included).length;
  const includedSegmentsCount = draft.userSegments.filter(s => s.included).length;

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h3 className="text-white font-semibold">Usage Analysis Preview</h3>
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

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Analysis Details Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Analysis Details
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateTitle(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="Usage analysis title..."
              />
            </div>
          </div>
        </div>

        {/* Time Range Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>📅</span>
            Time Range
          </h4>
          <div className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {TIME_RANGE_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => updateTimeRangePreset(preset.value)}
                  disabled={isSaving}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    draft.timeRange.preset === preset.value
                      ? 'bg-emerald-600/30 border-emerald-600/50 text-emerald-400'
                      : 'border-cscx-gray-600 text-cscx-gray-400 hover:border-cscx-gray-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-cscx-gray-400 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={draft.timeRange.start}
                  onChange={(e) => updateTimeRangeDate('start', e.target.value)}
                  disabled={isSaving}
                  className={smallInputClass + ' w-full'}
                />
              </div>
              <div>
                <label className="text-xs text-cscx-gray-400 block mb-1">End Date</label>
                <input
                  type="date"
                  value={draft.timeRange.end}
                  onChange={(e) => updateTimeRangeDate('end', e.target.value)}
                  disabled={isSaving}
                  className={smallInputClass + ' w-full'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart Types Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>📈</span>
            Include Charts
          </h4>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'showTrendChart' as const, label: 'Trend Chart', icon: '📈' },
              { key: 'showAdoptionChart' as const, label: 'Adoption Chart', icon: '📊' },
              { key: 'showSegmentChart' as const, label: 'Segment Chart', icon: '🥧' },
              { key: 'showHeatmap' as const, label: 'Usage Heatmap', icon: '🗓️' },
            ].map(chart => (
              <button
                key={chart.key}
                onClick={() => toggleChartType(chart.key)}
                disabled={isSaving}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                  draft.chartTypes[chart.key]
                    ? 'bg-emerald-600/30 border-emerald-600/50 text-emerald-400'
                    : 'border-cscx-gray-600 text-cscx-gray-400 hover:border-cscx-gray-500'
                }`}
              >
                <span>{chart.icon}</span>
                {chart.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-cscx-gray-700">
          <div className="flex gap-4">
            {[
              { key: 'metrics' as const, label: 'Metrics', count: includedMetricsCount },
              { key: 'features' as const, label: 'Features', count: includedFeaturesCount },
              { key: 'segments' as const, label: 'Segments', count: includedSegmentsCount },
              { key: 'recommendations' as const, label: 'Recommendations', count: draft.recommendations.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-cscx-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs bg-cscx-gray-700 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content: Metrics */}
        {activeTab === 'metrics' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Usage Metrics
              </h4>
              <button
                onClick={addMetric}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Metric
              </button>
            </div>

            <div className="space-y-2">
              {draft.metrics.map((metric) => {
                const trendDisplay = getTrendDisplay(metric.trend);
                return (
                  <div
                    key={metric.id}
                    className={`bg-cscx-gray-900/30 border rounded-lg p-3 ${
                      metric.included ? 'border-cscx-gray-700' : 'border-cscx-gray-700/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleMetricIncluded(metric.id)}
                        disabled={isSaving}
                        className={`mt-1 w-4 h-4 rounded border flex items-center justify-center ${
                          metric.included
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-cscx-gray-600'
                        }`}
                      >
                        {metric.included && '✓'}
                      </button>
                      <div className="flex-1 grid grid-cols-5 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={metric.name}
                            onChange={(e) => updateMetric(metric.id, 'name', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="Metric name..."
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={metric.value}
                            onChange={(e) => updateMetric(metric.id, 'value', parseFloat(e.target.value) || 0)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          />
                        </div>
                        <div>
                          <select
                            value={metric.unit}
                            onChange={(e) => updateMetric(metric.id, 'unit', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {UNIT_OPTIONS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={metric.trend}
                            onChange={(e) => updateMetric(metric.id, 'trend', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' flex-1'}
                          >
                            {TREND_OPTIONS.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <span className={`${trendDisplay.color}`}>{trendDisplay.icon}</span>
                          <button
                            onClick={() => removeMetric(metric.id)}
                            disabled={isSaving}
                            className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content: Features */}
        {activeTab === 'features' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Feature Adoption
              </h4>
              <button
                onClick={addFeature}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Feature
              </button>
            </div>

            <div className="space-y-2">
              {draft.featureAdoption.map((feature) => {
                const trendDisplay = getTrendDisplay(feature.trend);
                return (
                  <div
                    key={feature.id}
                    className={`bg-cscx-gray-900/30 border rounded-lg p-3 ${
                      feature.included ? 'border-cscx-gray-700' : 'border-cscx-gray-700/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleFeatureIncluded(feature.id)}
                        disabled={isSaving}
                        className={`mt-1 w-4 h-4 rounded border flex items-center justify-center ${
                          feature.included
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-cscx-gray-600'
                        }`}
                      >
                        {feature.included && '✓'}
                      </button>
                      <div className="flex-1">
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={feature.feature}
                              onChange={(e) => updateFeature(feature.id, 'feature', e.target.value)}
                              disabled={isSaving}
                              className={smallInputClass + ' w-full'}
                              placeholder="Feature name..."
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={feature.adoptionRate}
                                onChange={(e) => updateFeature(feature.id, 'adoptionRate', parseFloat(e.target.value) || 0)}
                                disabled={isSaving}
                                min={0}
                                max={100}
                                className={smallInputClass + ' w-full'}
                              />
                              <span className="text-xs text-cscx-gray-500">%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={feature.activeUsers}
                              onChange={(e) => updateFeature(feature.id, 'activeUsers', parseInt(e.target.value) || 0)}
                              disabled={isSaving}
                              className={smallInputClass + ' flex-1'}
                              placeholder="Users"
                            />
                            <select
                              value={feature.trend}
                              onChange={(e) => updateFeature(feature.id, 'trend', e.target.value)}
                              disabled={isSaving}
                              className={smallInputClass + ' w-16'}
                            >
                              {TREND_OPTIONS.map(t => (
                                <option key={t} value={t}>{trendDisplay.icon}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeFeature(feature.id)}
                              disabled={isSaving}
                              className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {/* Adoption bar */}
                        <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${feature.adoptionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content: Segments */}
        {activeTab === 'segments' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                User Segments
              </h4>
              <button
                onClick={addSegment}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Segment
              </button>
            </div>

            <div className="space-y-2">
              {draft.userSegments.map((segment) => (
                <div
                  key={segment.id}
                  className={`bg-cscx-gray-900/30 border rounded-lg p-3 ${
                    segment.included ? 'border-cscx-gray-700' : 'border-cscx-gray-700/50 opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSegmentIncluded(segment.id)}
                      disabled={isSaving}
                      className={`mt-1 w-4 h-4 rounded border flex items-center justify-center ${
                        segment.included
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-cscx-gray-600'
                      }`}
                    >
                      {segment.included && '✓'}
                    </button>
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={segment.name}
                          onChange={(e) => updateSegment(segment.id, 'name', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          placeholder="Segment name..."
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          value={segment.count}
                          onChange={(e) => updateSegment(segment.id, 'count', parseInt(e.target.value) || 0)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          placeholder="Count"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={segment.percentage}
                            onChange={(e) => updateSegment(segment.id, 'percentage', parseFloat(e.target.value) || 0)}
                            disabled={isSaving}
                            min={0}
                            max={100}
                            className={smallInputClass + ' w-full'}
                          />
                          <span className="text-xs text-cscx-gray-500">%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number"
                            value={segment.avgEngagement}
                            onChange={(e) => updateSegment(segment.id, 'avgEngagement', parseFloat(e.target.value) || 0)}
                            disabled={isSaving}
                            min={0}
                            max={100}
                            className={smallInputClass + ' w-full'}
                            title="Avg Engagement"
                          />
                          <span className="text-xs text-cscx-gray-500">eng</span>
                        </div>
                        <button
                          onClick={() => removeSegment(segment.id)}
                          disabled={isSaving}
                          className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Recommendations */}
        {activeTab === 'recommendations' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Recommendations
              </h4>
              <button
                onClick={addRecommendation}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Recommendation
              </button>
            </div>

            <div className="space-y-3">
              {draft.recommendations.map((rec, index) => (
                <div
                  key={rec.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-3"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveRecommendation(rec.id, 'up')}
                        disabled={isSaving || index === 0}
                        className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveRecommendation(rec.id, 'down')}
                        disabled={isSaving || index === draft.recommendations.length - 1}
                        className="p-1 text-cscx-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={rec.priority}
                          onChange={(e) => updateRecommendation(rec.id, 'priority', e.target.value)}
                          disabled={isSaving}
                          className={`${smallInputClass} ${getPriorityStyle(rec.priority)}`}
                        >
                          {PRIORITY_OPTIONS.map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                        <select
                          value={rec.category}
                          onChange={(e) => updateRecommendation(rec.id, 'category', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass}
                        >
                          {CATEGORY_OPTIONS.map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeRecommendation(rec.id)}
                          disabled={isSaving}
                          className="ml-auto p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                      <textarea
                        value={rec.recommendation}
                        onChange={(e) => updateRecommendation(rec.id, 'recommendation', e.target.value)}
                        disabled={isSaving}
                        rows={2}
                        className={smallInputClass + ' w-full resize-y'}
                        placeholder="Recommendation..."
                      />
                      <input
                        type="text"
                        value={rec.impact}
                        onChange={(e) => updateRecommendation(rec.id, 'impact', e.target.value)}
                        disabled={isSaving}
                        className={smallInputClass + ' w-full'}
                        placeholder="Expected impact..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>📝</span>
            Notes
          </h4>
          <textarea
            value={draft.notes}
            onChange={(e) => updateNotes(e.target.value)}
            disabled={isSaving}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="Additional notes or context for the usage analysis..."
          />
        </div>
      </div>

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
          className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <span>📄</span>
              Create Usage Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGUsageAnalysisPreview;
