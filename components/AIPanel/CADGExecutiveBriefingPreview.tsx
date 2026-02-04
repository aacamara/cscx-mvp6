/**
 * CADGExecutiveBriefingPreview - Editable executive briefing preview for CADG-generated briefings
 * Allows users to review, edit, and approve executive briefings before creating presentation
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ExecutiveHeadline {
  id: string;
  headline: string;
  detail: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  enabled: boolean;
}

export interface ExecutiveMetric {
  id: string;
  name: string;
  value: string;
  previousValue?: string;
  trend: 'up' | 'down' | 'stable';
  category: 'health' | 'engagement' | 'adoption' | 'financial' | 'satisfaction';
  enabled: boolean;
}

export interface StrategicUpdate {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'planned' | 'at_risk';
  category: 'growth' | 'retention' | 'expansion' | 'risk_mitigation' | 'innovation';
  enabled: boolean;
}

export interface ExecutiveAsk {
  id: string;
  ask: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  owner: 'CSM' | 'Customer' | 'Product' | 'Engineering' | 'Leadership' | 'Sales';
  dueDate: string;
  enabled: boolean;
}

export interface ExecutiveBriefingData {
  title: string;
  preparedFor: string;
  preparedBy: string;
  briefingDate: string;
  slideCount: 5 | 6 | 7;
  executiveSummary: string;
  headlines: ExecutiveHeadline[];
  keyMetrics: ExecutiveMetric[];
  strategicUpdates: StrategicUpdate[];
  asks: ExecutiveAsk[];
  nextSteps: string[];
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGExecutiveBriefingPreviewProps {
  briefing: ExecutiveBriefingData;
  customer: CustomerData;
  onSave: (briefing: ExecutiveBriefingData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const SLIDE_COUNT_OPTIONS: (5 | 6 | 7)[] = [5, 6, 7];
const SENTIMENT_OPTIONS = ['positive', 'neutral', 'negative'] as const;
const TREND_OPTIONS = ['up', 'down', 'stable'] as const;
const METRIC_CATEGORY_OPTIONS = ['health', 'engagement', 'adoption', 'financial', 'satisfaction'] as const;
const UPDATE_STATUS_OPTIONS = ['completed', 'in_progress', 'planned', 'at_risk'] as const;
const UPDATE_CATEGORY_OPTIONS = ['growth', 'retention', 'expansion', 'risk_mitigation', 'innovation'] as const;
const ASK_PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const ASK_OWNER_OPTIONS = ['CSM', 'Customer', 'Product', 'Engineering', 'Leadership', 'Sales'] as const;

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  negative: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SENTIMENT_ICONS: Record<string, string> = {
  positive: '✅',
  neutral: '➖',
  negative: '⚠️',
};

const TREND_LABELS: Record<string, string> = {
  up: 'Up',
  down: 'Down',
  stable: 'Stable',
};

const TREND_ICONS: Record<string, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const TREND_COLORS: Record<string, string> = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  stable: 'text-gray-400',
};

const METRIC_CATEGORY_LABELS: Record<string, string> = {
  health: 'Health',
  engagement: 'Engagement',
  adoption: 'Adoption',
  financial: 'Financial',
  satisfaction: 'Satisfaction',
};

const METRIC_CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  engagement: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  adoption: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  financial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  satisfaction: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const UPDATE_STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  planned: 'Planned',
  at_risk: 'At Risk',
};

const UPDATE_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  planned: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  at_risk: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const UPDATE_STATUS_ICONS: Record<string, string> = {
  completed: '✅',
  in_progress: '🔄',
  planned: '📋',
  at_risk: '⚠️',
};

const UPDATE_CATEGORY_LABELS: Record<string, string> = {
  growth: 'Growth',
  retention: 'Retention',
  expansion: 'Expansion',
  risk_mitigation: 'Risk Mitigation',
  innovation: 'Innovation',
};

const UPDATE_CATEGORY_COLORS: Record<string, string> = {
  growth: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  retention: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  expansion: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  risk_mitigation: 'bg-red-500/20 text-red-400 border-red-500/30',
  innovation: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const PRIORITY_ICONS: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

// ============================================
// Component
// ============================================

export function CADGExecutiveBriefingPreview({
  briefing,
  customer,
  onSave,
  onCancel,
}: CADGExecutiveBriefingPreviewProps) {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState<ExecutiveBriefingData>(briefing);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'headlines' | 'metrics' | 'updates' | 'asks' | 'nextsteps'>('overview');
  const [expandedHeadlines, setExpandedHeadlines] = useState<Set<string>>(new Set());
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [expandedAsks, setExpandedAsks] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate content stats
  const stats = useMemo(() => {
    const enabledHeadlines = data.headlines.filter(h => h.enabled).length;
    const enabledMetrics = data.keyMetrics.filter(m => m.enabled).length;
    const enabledUpdates = data.strategicUpdates.filter(u => u.enabled).length;
    const enabledAsks = data.asks.filter(a => a.enabled).length;
    const positiveHeadlines = data.headlines.filter(h => h.enabled && h.sentiment === 'positive').length;
    const negativeHeadlines = data.headlines.filter(h => h.enabled && h.sentiment === 'negative').length;
    const highPriorityAsks = data.asks.filter(a => a.enabled && a.priority === 'high').length;
    return { enabledHeadlines, enabledMetrics, enabledUpdates, enabledAsks, positiveHeadlines, negativeHeadlines, highPriorityAsks };
  }, [data.headlines, data.keyMetrics, data.strategicUpdates, data.asks]);

  // Update field helper
  const updateField = <K extends keyof ExecutiveBriefingData>(field: K, value: ExecutiveBriefingData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Headline management
  const updateHeadline = (headlineId: string, updates: Partial<ExecutiveHeadline>) => {
    setData(prev => ({
      ...prev,
      headlines: prev.headlines.map(h => h.id === headlineId ? { ...h, ...updates } : h),
    }));
    setHasChanges(true);
  };

  const toggleHeadlineExpanded = (headlineId: string) => {
    setExpandedHeadlines(prev => {
      const next = new Set(prev);
      if (next.has(headlineId)) next.delete(headlineId);
      else next.add(headlineId);
      return next;
    });
  };

  const addHeadline = () => {
    const newHeadline: ExecutiveHeadline = {
      id: `headline-${Date.now()}`,
      headline: 'New Headline',
      detail: '',
      sentiment: 'neutral',
      enabled: true,
    };
    setData(prev => ({ ...prev, headlines: [...prev.headlines, newHeadline] }));
    setExpandedHeadlines(prev => new Set([...prev, newHeadline.id]));
    setHasChanges(true);
  };

  const removeHeadline = (headlineId: string) => {
    setData(prev => ({
      ...prev,
      headlines: prev.headlines.filter(h => h.id !== headlineId),
    }));
    setHasChanges(true);
  };

  // Metric management
  const updateMetric = (metricId: string, updates: Partial<ExecutiveMetric>) => {
    setData(prev => ({
      ...prev,
      keyMetrics: prev.keyMetrics.map(m => m.id === metricId ? { ...m, ...updates } : m),
    }));
    setHasChanges(true);
  };

  const toggleMetricExpanded = (metricId: string) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      return next;
    });
  };

  const addMetric = () => {
    const newMetric: ExecutiveMetric = {
      id: `metric-${Date.now()}`,
      name: 'New Metric',
      value: '0',
      trend: 'stable',
      category: 'health',
      enabled: true,
    };
    setData(prev => ({ ...prev, keyMetrics: [...prev.keyMetrics, newMetric] }));
    setExpandedMetrics(prev => new Set([...prev, newMetric.id]));
    setHasChanges(true);
  };

  const removeMetric = (metricId: string) => {
    setData(prev => ({
      ...prev,
      keyMetrics: prev.keyMetrics.filter(m => m.id !== metricId),
    }));
    setHasChanges(true);
  };

  // Strategic update management
  const updateStrategicUpdate = (updateId: string, updates: Partial<StrategicUpdate>) => {
    setData(prev => ({
      ...prev,
      strategicUpdates: prev.strategicUpdates.map(u => u.id === updateId ? { ...u, ...updates } : u),
    }));
    setHasChanges(true);
  };

  const toggleUpdateExpanded = (updateId: string) => {
    setExpandedUpdates(prev => {
      const next = new Set(prev);
      if (next.has(updateId)) next.delete(updateId);
      else next.add(updateId);
      return next;
    });
  };

  const addStrategicUpdate = () => {
    const newUpdate: StrategicUpdate = {
      id: `update-${Date.now()}`,
      title: 'New Update',
      description: '',
      status: 'planned',
      category: 'retention',
      enabled: true,
    };
    setData(prev => ({ ...prev, strategicUpdates: [...prev.strategicUpdates, newUpdate] }));
    setExpandedUpdates(prev => new Set([...prev, newUpdate.id]));
    setHasChanges(true);
  };

  const removeStrategicUpdate = (updateId: string) => {
    setData(prev => ({
      ...prev,
      strategicUpdates: prev.strategicUpdates.filter(u => u.id !== updateId),
    }));
    setHasChanges(true);
  };

  // Ask management
  const updateAsk = (askId: string, updates: Partial<ExecutiveAsk>) => {
    setData(prev => ({
      ...prev,
      asks: prev.asks.map(a => a.id === askId ? { ...a, ...updates } : a),
    }));
    setHasChanges(true);
  };

  const toggleAskExpanded = (askId: string) => {
    setExpandedAsks(prev => {
      const next = new Set(prev);
      if (next.has(askId)) next.delete(askId);
      else next.add(askId);
      return next;
    });
  };

  const addAsk = () => {
    const newAsk: ExecutiveAsk = {
      id: `ask-${Date.now()}`,
      ask: 'New Ask',
      rationale: '',
      priority: 'medium',
      owner: 'Leadership',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      enabled: true,
    };
    setData(prev => ({ ...prev, asks: [...prev.asks, newAsk] }));
    setExpandedAsks(prev => new Set([...prev, newAsk.id]));
    setHasChanges(true);
  };

  const removeAsk = (askId: string) => {
    setData(prev => ({
      ...prev,
      asks: prev.asks.filter(a => a.id !== askId),
    }));
    setHasChanges(true);
  };

  const reorderAsk = (askId: string, direction: 'up' | 'down') => {
    setData(prev => {
      const index = prev.asks.findIndex(a => a.id === askId);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.asks.length - 1) return prev;

      const newAsks = [...prev.asks];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newAsks[index], newAsks[swapIndex]] = [newAsks[swapIndex], newAsks[index]];
      return { ...prev, asks: newAsks };
    });
    setHasChanges(true);
  };

  // Next steps management
  const updateNextStep = (index: number, value: string) => {
    setData(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.map((step, i) => i === index ? value : step),
    }));
    setHasChanges(true);
  };

  const addNextStep = () => {
    setData(prev => ({
      ...prev,
      nextSteps: [...prev.nextSteps, 'New next step'],
    }));
    setHasChanges(true);
  };

  const removeNextStep = (index: number) => {
    setData(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  // Tab content rendering
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'headlines':
        return renderHeadlinesTab();
      case 'metrics':
        return renderMetricsTab();
      case 'updates':
        return renderUpdatesTab();
      case 'asks':
        return renderAsksTab();
      case 'nextsteps':
        return renderNextStepsTab();
      default:
        return null;
    }
  };

  // ============================================
  // Overview Tab
  // ============================================
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3">
          <div className="text-xs text-indigo-400 mb-1">ARR</div>
          <div className="text-lg font-semibold text-white">${(data.arr || 0).toLocaleString()}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <div className="text-xs text-emerald-400 mb-1">Health Score</div>
          <div className="text-lg font-semibold text-white">{data.healthScore}/100</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="text-xs text-amber-400 mb-1">Days to Renewal</div>
          <div className="text-lg font-semibold text-white">{data.daysUntilRenewal}</div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
          <div className="text-xs text-purple-400 mb-1">Slide Count</div>
          <select
            value={data.slideCount}
            onChange={(e) => updateField('slideCount', parseInt(e.target.value) as 5 | 6 | 7)}
            className="text-lg font-semibold text-white bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
          >
            {SLIDE_COUNT_OPTIONS.map(count => (
              <option key={count} value={count} className="bg-cscx-gray-800">{count} slides</option>
            ))}
          </select>
        </div>
      </div>

      {/* Title and Metadata */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Briefing Title</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full bg-cscx-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Prepared For</label>
            <input
              type="text"
              value={data.preparedFor}
              onChange={(e) => updateField('preparedFor', e.target.value)}
              className="w-full bg-cscx-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Prepared By</label>
            <input
              type="text"
              value={data.preparedBy}
              onChange={(e) => updateField('preparedBy', e.target.value)}
              className="w-full bg-cscx-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Briefing Date</label>
          <input
            type="date"
            value={data.briefingDate}
            onChange={(e) => updateField('briefingDate', e.target.value)}
            className="w-full bg-cscx-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Executive Summary */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Executive Summary</label>
        <textarea
          value={data.executiveSummary}
          onChange={(e) => updateField('executiveSummary', e.target.value)}
          rows={4}
          className="w-full bg-cscx-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          placeholder="Brief summary of account status and outlook..."
        />
      </div>

      {/* Content Summary */}
      <div className="bg-cscx-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">Briefing Content Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Headlines:</span>
            <span className="text-white font-medium">{stats.enabledHeadlines}</span>
            {stats.positiveHeadlines > 0 && <span className="text-emerald-400 text-xs">({stats.positiveHeadlines} ✅)</span>}
            {stats.negativeHeadlines > 0 && <span className="text-red-400 text-xs">({stats.negativeHeadlines} ⚠️)</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Metrics:</span>
            <span className="text-white font-medium">{stats.enabledMetrics}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Updates:</span>
            <span className="text-white font-medium">{stats.enabledUpdates}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Asks:</span>
            <span className="text-white font-medium">{stats.enabledAsks}</span>
            {stats.highPriorityAsks > 0 && <span className="text-red-400 text-xs">({stats.highPriorityAsks} 🔴)</span>}
          </div>
        </div>
      </div>

      {/* Internal Notes */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Internal Notes (not included in presentation)</label>
        <textarea
          value={data.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={2}
          className="w-full bg-cscx-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          placeholder="Add any internal notes..."
        />
      </div>
    </div>
  );

  // ============================================
  // Headlines Tab
  // ============================================
  const renderHeadlinesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Key Headlines ({stats.enabledHeadlines} enabled)</h4>
        <button
          onClick={addHeadline}
          className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-500/30 transition-colors"
        >
          + Add Headline
        </button>
      </div>

      {data.headlines.map((headline, index) => (
        <div
          key={headline.id}
          className={`border rounded-lg overflow-hidden transition-all ${
            headline.enabled
              ? 'bg-cscx-gray-700 border-gray-600'
              : 'bg-cscx-gray-800 border-gray-700 opacity-60'
          }`}
        >
          {/* Headline Header */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-600/50"
            onClick={() => toggleHeadlineExpanded(headline.id)}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={headline.enabled}
                onChange={(e) => {
                  e.stopPropagation();
                  updateHeadline(headline.id, { enabled: e.target.checked });
                }}
                className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-lg">{SENTIMENT_ICONS[headline.sentiment]}</span>
              <div>
                <div className="text-sm font-medium text-white">{headline.headline}</div>
                <div className="text-xs text-gray-400 truncate max-w-[300px]">{headline.detail}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${SENTIMENT_COLORS[headline.sentiment]}`}>
                {SENTIMENT_LABELS[headline.sentiment]}
              </span>
              <span className="text-gray-400">{expandedHeadlines.has(headline.id) ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Headline Expanded Content */}
          {expandedHeadlines.has(headline.id) && (
            <div className="border-t border-gray-600 p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Headline</label>
                <input
                  type="text"
                  value={headline.headline}
                  onChange={(e) => updateHeadline(headline.id, { headline: e.target.value })}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Supporting Detail</label>
                <textarea
                  value={headline.detail}
                  onChange={(e) => updateHeadline(headline.id, { detail: e.target.value })}
                  rows={2}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Sentiment</label>
                <select
                  value={headline.sentiment}
                  onChange={(e) => updateHeadline(headline.id, { sentiment: e.target.value as ExecutiveHeadline['sentiment'] })}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  {SENTIMENT_OPTIONS.map(sentiment => (
                    <option key={sentiment} value={sentiment}>
                      {SENTIMENT_ICONS[sentiment]} {SENTIMENT_LABELS[sentiment]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => removeHeadline(headline.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove Headline
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {data.headlines.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No headlines yet. Click "Add Headline" to create one.
        </div>
      )}
    </div>
  );

  // ============================================
  // Metrics Tab
  // ============================================
  const renderMetricsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Key Metrics ({stats.enabledMetrics} enabled)</h4>
        <button
          onClick={addMetric}
          className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-500/30 transition-colors"
        >
          + Add Metric
        </button>
      </div>

      {data.keyMetrics.map((metric) => (
        <div
          key={metric.id}
          className={`border rounded-lg overflow-hidden transition-all ${
            metric.enabled
              ? 'bg-cscx-gray-700 border-gray-600'
              : 'bg-cscx-gray-800 border-gray-700 opacity-60'
          }`}
        >
          {/* Metric Header */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-600/50"
            onClick={() => toggleMetricExpanded(metric.id)}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={metric.enabled}
                onChange={(e) => {
                  e.stopPropagation();
                  updateMetric(metric.id, { enabled: e.target.checked });
                }}
                className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500"
              />
              <div>
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  {metric.name}
                  <span className={`${TREND_COLORS[metric.trend]}`}>{TREND_ICONS[metric.trend]}</span>
                </div>
                <div className="text-lg font-semibold text-indigo-400">{metric.value}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${METRIC_CATEGORY_COLORS[metric.category]}`}>
                {METRIC_CATEGORY_LABELS[metric.category]}
              </span>
              <span className="text-gray-400">{expandedMetrics.has(metric.id) ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Metric Expanded Content */}
          {expandedMetrics.has(metric.id) && (
            <div className="border-t border-gray-600 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Metric Name</label>
                  <input
                    type="text"
                    value={metric.name}
                    onChange={(e) => updateMetric(metric.id, { name: e.target.value })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Current Value</label>
                  <input
                    type="text"
                    value={metric.value}
                    onChange={(e) => updateMetric(metric.id, { value: e.target.value })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Trend</label>
                  <select
                    value={metric.trend}
                    onChange={(e) => updateMetric(metric.id, { trend: e.target.value as ExecutiveMetric['trend'] })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {TREND_OPTIONS.map(trend => (
                      <option key={trend} value={trend}>
                        {TREND_ICONS[trend]} {TREND_LABELS[trend]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select
                    value={metric.category}
                    onChange={(e) => updateMetric(metric.id, { category: e.target.value as ExecutiveMetric['category'] })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {METRIC_CATEGORY_OPTIONS.map(category => (
                      <option key={category} value={category}>
                        {METRIC_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Previous Value (optional)</label>
                <input
                  type="text"
                  value={metric.previousValue || ''}
                  onChange={(e) => updateMetric(metric.id, { previousValue: e.target.value || undefined })}
                  placeholder="e.g., 72/100"
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => removeMetric(metric.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove Metric
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {data.keyMetrics.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No metrics yet. Click "Add Metric" to create one.
        </div>
      )}
    </div>
  );

  // ============================================
  // Strategic Updates Tab
  // ============================================
  const renderUpdatesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Strategic Updates ({stats.enabledUpdates} enabled)</h4>
        <button
          onClick={addStrategicUpdate}
          className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-500/30 transition-colors"
        >
          + Add Update
        </button>
      </div>

      {data.strategicUpdates.map((update) => (
        <div
          key={update.id}
          className={`border rounded-lg overflow-hidden transition-all ${
            update.enabled
              ? 'bg-cscx-gray-700 border-gray-600'
              : 'bg-cscx-gray-800 border-gray-700 opacity-60'
          }`}
        >
          {/* Update Header */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-600/50"
            onClick={() => toggleUpdateExpanded(update.id)}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={update.enabled}
                onChange={(e) => {
                  e.stopPropagation();
                  updateStrategicUpdate(update.id, { enabled: e.target.checked });
                }}
                className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-lg">{UPDATE_STATUS_ICONS[update.status]}</span>
              <div>
                <div className="text-sm font-medium text-white">{update.title}</div>
                <div className="text-xs text-gray-400 truncate max-w-[300px]">{update.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${UPDATE_STATUS_COLORS[update.status]}`}>
                {UPDATE_STATUS_LABELS[update.status]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded border ${UPDATE_CATEGORY_COLORS[update.category]}`}>
                {UPDATE_CATEGORY_LABELS[update.category]}
              </span>
              <span className="text-gray-400">{expandedUpdates.has(update.id) ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Update Expanded Content */}
          {expandedUpdates.has(update.id) && (
            <div className="border-t border-gray-600 p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Update Title</label>
                <input
                  type="text"
                  value={update.title}
                  onChange={(e) => updateStrategicUpdate(update.id, { title: e.target.value })}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea
                  value={update.description}
                  onChange={(e) => updateStrategicUpdate(update.id, { description: e.target.value })}
                  rows={2}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={update.status}
                    onChange={(e) => updateStrategicUpdate(update.id, { status: e.target.value as StrategicUpdate['status'] })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {UPDATE_STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {UPDATE_STATUS_ICONS[status]} {UPDATE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select
                    value={update.category}
                    onChange={(e) => updateStrategicUpdate(update.id, { category: e.target.value as StrategicUpdate['category'] })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {UPDATE_CATEGORY_OPTIONS.map(category => (
                      <option key={category} value={category}>
                        {UPDATE_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => removeStrategicUpdate(update.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove Update
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {data.strategicUpdates.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No strategic updates yet. Click "Add Update" to create one.
        </div>
      )}
    </div>
  );

  // ============================================
  // Asks Tab
  // ============================================
  const renderAsksTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Asks & Requests ({stats.enabledAsks} enabled)</h4>
        <button
          onClick={addAsk}
          className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-500/30 transition-colors"
        >
          + Add Ask
        </button>
      </div>

      {data.asks.map((ask, index) => (
        <div
          key={ask.id}
          className={`border rounded-lg overflow-hidden transition-all ${
            ask.enabled
              ? 'bg-cscx-gray-700 border-gray-600'
              : 'bg-cscx-gray-800 border-gray-700 opacity-60'
          }`}
        >
          {/* Ask Header */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-600/50"
            onClick={() => toggleAskExpanded(ask.id)}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={ask.enabled}
                onChange={(e) => {
                  e.stopPropagation();
                  updateAsk(ask.id, { enabled: e.target.checked });
                }}
                className="rounded border-gray-600 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-lg">{PRIORITY_ICONS[ask.priority]}</span>
              <div>
                <div className="text-sm font-medium text-white">{ask.ask}</div>
                <div className="text-xs text-gray-400">Owner: {ask.owner} | Due: {ask.dueDate}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 mr-2">
                <button
                  onClick={(e) => { e.stopPropagation(); reorderAsk(ask.id, 'up'); }}
                  disabled={index === 0}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▲
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); reorderAsk(ask.id, 'down'); }}
                  disabled={index === data.asks.length - 1}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▼
                </button>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_COLORS[ask.priority]}`}>
                {PRIORITY_LABELS[ask.priority]}
              </span>
              <span className="text-gray-400">{expandedAsks.has(ask.id) ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Ask Expanded Content */}
          {expandedAsks.has(ask.id) && (
            <div className="border-t border-gray-600 p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ask</label>
                <input
                  type="text"
                  value={ask.ask}
                  onChange={(e) => updateAsk(ask.id, { ask: e.target.value })}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Rationale</label>
                <textarea
                  value={ask.rationale}
                  onChange={(e) => updateAsk(ask.id, { rationale: e.target.value })}
                  rows={2}
                  className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select
                    value={ask.priority}
                    onChange={(e) => updateAsk(ask.id, { priority: e.target.value as ExecutiveAsk['priority'] })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {ASK_PRIORITY_OPTIONS.map(priority => (
                      <option key={priority} value={priority}>
                        {PRIORITY_ICONS[priority]} {PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Owner</label>
                  <select
                    value={ask.owner}
                    onChange={(e) => updateAsk(ask.id, { owner: e.target.value as ExecutiveAsk['owner'] })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {ASK_OWNER_OPTIONS.map(owner => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={ask.dueDate}
                    onChange={(e) => updateAsk(ask.id, { dueDate: e.target.value })}
                    className="w-full bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => removeAsk(ask.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove Ask
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {data.asks.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No asks yet. Click "Add Ask" to create one.
        </div>
      )}
    </div>
  );

  // ============================================
  // Next Steps Tab
  // ============================================
  const renderNextStepsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Next Steps ({data.nextSteps.length} items)</h4>
        <button
          onClick={addNextStep}
          className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg hover:bg-indigo-500/30 transition-colors"
        >
          + Add Step
        </button>
      </div>

      {data.nextSteps.map((step, index) => (
        <div key={index} className="flex items-center gap-3 bg-cscx-gray-700 border border-gray-600 rounded-lg p-3">
          <span className="text-indigo-400 font-medium min-w-[24px]">{index + 1}.</span>
          <input
            type="text"
            value={step}
            onChange={(e) => updateNextStep(index, e.target.value)}
            className="flex-1 bg-cscx-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => removeNextStep(index)}
            className="text-red-400 hover:text-red-300 transition-colors p-1"
          >
            ✕
          </button>
        </div>
      ))}

      {data.nextSteps.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No next steps yet. Click "Add Step" to create one.
        </div>
      )}
    </div>
  );

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Executive Briefing Preview</h3>
            <p className="text-sm text-gray-400">
              Review and edit before creating {data.slideCount}-slide presentation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Customer:</span>
            <span className="text-sm font-medium text-white">{customer.name}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 bg-cscx-gray-900/50">
        <div className="flex overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'headlines', label: `Headlines (${stats.enabledHeadlines})` },
            { id: 'metrics', label: `Metrics (${stats.enabledMetrics})` },
            { id: 'updates', label: `Updates (${stats.enabledUpdates})` },
            { id: 'asks', label: `Asks (${stats.enabledAsks})` },
            { id: 'nextsteps', label: `Next Steps (${data.nextSteps.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-cscx-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {renderTabContent()}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-700 p-4 bg-cscx-gray-900/50 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {hasChanges && <span className="text-amber-400">• Unsaved changes</span>}
        </div>
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
            className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                Creating Presentation...
              </>
            ) : (
              <>
                Create {data.slideCount}-Slide Presentation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CADGExecutiveBriefingPreview;
