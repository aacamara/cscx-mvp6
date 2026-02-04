/**
 * CADGRenewalForecastPreview - Editable renewal forecast preview for CADG-generated plans
 * Allows users to review, edit, and approve renewal probability factors, risks, signals, and actions before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ProbabilityFactor {
  id: string;
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  impact: number;
  enabled: boolean;
}

export interface PositiveSignal {
  id: string;
  name: string;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  impact: number;
  enabled: boolean;
}

export interface RecommendedAction {
  id: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  owner: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface RenewalForecastData {
  title: string;
  renewalDate: string;
  currentProbability: number;
  targetProbability: number;
  arr: number;
  contractTerm: string;
  probabilityFactors: ProbabilityFactor[];
  riskFactors: RiskFactor[];
  positiveSignals: PositiveSignal[];
  recommendedActions: RecommendedAction[];
  historicalContext: string;
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGRenewalForecastPreviewProps {
  renewalForecast: RenewalForecastData;
  customer: CustomerData;
  onSave: (renewalForecast: RenewalForecastData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const SEVERITY_OPTIONS = ['high', 'medium', 'low'] as const;
const STRENGTH_OPTIONS = ['strong', 'moderate', 'weak'] as const;
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const STATUS_OPTIONS = ['pending', 'in_progress', 'completed'] as const;
const OWNER_OPTIONS = ['CSM', 'Account Executive', 'Support', 'Product', 'Executive', 'Sales', 'Marketing'];
const CONTRACT_TERM_OPTIONS = ['6 months', '12 months', '18 months', '24 months', '36 months'];

// ============================================
// Component
// ============================================

export const CADGRenewalForecastPreview: React.FC<CADGRenewalForecastPreviewProps> = ({
  renewalForecast,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<RenewalForecastData>(() => JSON.parse(JSON.stringify(renewalForecast)));

  // Editable draft state
  const [draft, setDraft] = useState<RenewalForecastData>(() => JSON.parse(JSON.stringify(renewalForecast)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'risks' | 'signals' | 'actions'>('overview');
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate weighted probability based on factors
  const calculatedProbability = useMemo(() => {
    const baseProb = draft.probabilityFactors.reduce((acc, f) => acc + (f.score * f.weight / 100), 0);
    const riskImpact = draft.riskFactors.filter(r => r.enabled).reduce((acc, r) => acc + r.impact, 0);
    const signalImpact = draft.positiveSignals.filter(s => s.enabled).reduce((acc, s) => acc + s.impact, 0);
    return Math.max(0, Math.min(100, Math.round(baseProb + riskImpact + signalImpact)));
  }, [draft.probabilityFactors, draft.riskFactors, draft.positiveSignals]);

  // Days until renewal
  const daysUntilRenewal = useMemo(() => {
    const today = new Date();
    const renewal = new Date(draft.renewalDate);
    return Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [draft.renewalDate]);

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
      // Update current probability with calculated value
      const updatedDraft = {
        ...draft,
        currentProbability: calculatedProbability,
      };
      await onSave(updatedDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create renewal forecast');
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

  const updateRenewalDate = (value: string) => {
    setDraft(prev => ({ ...prev, renewalDate: value }));
  };

  const updateArr = (value: number) => {
    setDraft(prev => ({ ...prev, arr: value }));
  };

  const updateContractTerm = (value: string) => {
    setDraft(prev => ({ ...prev, contractTerm: value }));
  };

  const updateTargetProbability = (value: number) => {
    setDraft(prev => ({ ...prev, targetProbability: value }));
  };

  const updateHistoricalContext = (value: string) => {
    setDraft(prev => ({ ...prev, historicalContext: value }));
  };

  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Probability Factor Operations
  // ============================================

  const updateFactor = (factorId: string, field: keyof ProbabilityFactor, value: any) => {
    setDraft(prev => ({
      ...prev,
      probabilityFactors: prev.probabilityFactors.map(f =>
        f.id === factorId ? { ...f, [field]: value } : f
      ),
    }));
  };

  const addFactor = () => {
    const newId = `factor-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      probabilityFactors: [
        ...prev.probabilityFactors,
        {
          id: newId,
          name: 'New Factor',
          weight: 10,
          score: 70,
          description: '',
        },
      ],
    }));
  };

  const removeFactor = (factorId: string) => {
    setDraft(prev => ({
      ...prev,
      probabilityFactors: prev.probabilityFactors.filter(f => f.id !== factorId),
    }));
  };

  // ============================================
  // Risk Factor Operations
  // ============================================

  const toggleRiskEnabled = (riskId: string) => {
    setDraft(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.map(r =>
        r.id === riskId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  };

  const updateRisk = (riskId: string, field: keyof RiskFactor, value: any) => {
    setDraft(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.map(r =>
        r.id === riskId ? { ...r, [field]: value } : r
      ),
    }));
  };

  const addRisk = () => {
    const newId = `risk-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      riskFactors: [
        ...prev.riskFactors,
        {
          id: newId,
          name: 'New Risk',
          description: '',
          severity: 'medium',
          impact: -10,
          enabled: true,
        },
      ],
    }));
    setExpandedRisk(newId);
  };

  const removeRisk = (riskId: string) => {
    setDraft(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.filter(r => r.id !== riskId),
    }));
    if (expandedRisk === riskId) setExpandedRisk(null);
  };

  // ============================================
  // Positive Signal Operations
  // ============================================

  const toggleSignalEnabled = (signalId: string) => {
    setDraft(prev => ({
      ...prev,
      positiveSignals: prev.positiveSignals.map(s =>
        s.id === signalId ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  const updateSignal = (signalId: string, field: keyof PositiveSignal, value: any) => {
    setDraft(prev => ({
      ...prev,
      positiveSignals: prev.positiveSignals.map(s =>
        s.id === signalId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSignal = () => {
    const newId = `signal-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      positiveSignals: [
        ...prev.positiveSignals,
        {
          id: newId,
          name: 'New Signal',
          description: '',
          strength: 'moderate',
          impact: 10,
          enabled: true,
        },
      ],
    }));
    setExpandedSignal(newId);
  };

  const removeSignal = (signalId: string) => {
    setDraft(prev => ({
      ...prev,
      positiveSignals: prev.positiveSignals.filter(s => s.id !== signalId),
    }));
    if (expandedSignal === signalId) setExpandedSignal(null);
  };

  // ============================================
  // Action Operations
  // ============================================

  const updateAction = (actionId: string, field: keyof RecommendedAction, value: any) => {
    setDraft(prev => ({
      ...prev,
      recommendedActions: prev.recommendedActions.map(a =>
        a.id === actionId ? { ...a, [field]: value } : a
      ),
    }));
  };

  const addAction = () => {
    const newId = `action-${Date.now()}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    setDraft(prev => ({
      ...prev,
      recommendedActions: [
        ...prev.recommendedActions,
        {
          id: newId,
          action: 'New Action',
          priority: 'medium',
          owner: 'CSM',
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'pending',
        },
      ],
    }));
    setExpandedAction(newId);
  };

  const removeAction = (actionId: string) => {
    setDraft(prev => ({
      ...prev,
      recommendedActions: prev.recommendedActions.filter(a => a.id !== actionId),
    }));
    if (expandedAction === actionId) setExpandedAction(null);
  };

  const moveAction = (actionId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const idx = prev.recommendedActions.findIndex(a => a.id === actionId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.recommendedActions.length - 1) return prev;

      const newActions = [...prev.recommendedActions];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newActions[idx], newActions[swapIdx]] = [newActions[swapIdx], newActions[idx]];

      return { ...prev, recommendedActions: newActions };
    });
  };

  // ============================================
  // Helper Functions
  // ============================================

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'text-emerald-400 bg-emerald-500/20';
      case 'moderate': return 'text-blue-400 bg-blue-500/20';
      case 'weak': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-500/20';
      case 'in_progress': return 'text-blue-400 bg-blue-500/20';
      case 'pending': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-emerald-400';
    if (probability >= 60) return 'text-blue-400';
    if (probability >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProbabilityBgColor = (probability: number) => {
    if (probability >= 80) return 'bg-emerald-500';
    if (probability >= 60) return 'bg-blue-500';
    if (probability >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-xl overflow-hidden border border-cscx-gray-700">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Renewal Forecast Preview</h3>
              <p className="text-sm text-white/70">Review and adjust the forecast before creating document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isModified && (
              <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-white text-teal-700 font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Create Forecast'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Probability Overview Card */}
      <div className="mx-6 mt-6 p-6 bg-cscx-gray-900/50 rounded-xl border border-cscx-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="text-xl font-semibold text-white bg-transparent border-b border-transparent hover:border-cscx-gray-600 focus:border-teal-500 focus:outline-none w-full"
            />
            <p className="text-sm text-gray-400 mt-1">{customer.name}</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getProbabilityColor(calculatedProbability)}`}>
              {calculatedProbability}%
            </div>
            <p className="text-sm text-gray-400">Renewal Probability</p>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Current</span>
            <span>Target: {draft.targetProbability}%</span>
          </div>
          <div className="h-3 bg-cscx-gray-700 rounded-full overflow-hidden">
            <div className="h-full relative">
              <div
                className={`absolute h-full ${getProbabilityBgColor(calculatedProbability)} transition-all duration-500`}
                style={{ width: `${calculatedProbability}%` }}
              />
              <div
                className="absolute h-full w-0.5 bg-white/50"
                style={{ left: `${draft.targetProbability}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-cscx-gray-800 rounded-lg">
            <p className="text-2xl font-semibold text-white">${(draft.arr / 1000).toFixed(0)}K</p>
            <p className="text-xs text-gray-400">ARR</p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800 rounded-lg">
            <p className={`text-2xl font-semibold ${daysUntilRenewal <= 30 ? 'text-red-400' : daysUntilRenewal <= 90 ? 'text-yellow-400' : 'text-white'}`}>
              {daysUntilRenewal}
            </p>
            <p className="text-xs text-gray-400">Days Until Renewal</p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800 rounded-lg">
            <p className="text-2xl font-semibold text-white">{draft.contractTerm}</p>
            <p className="text-xs text-gray-400">Contract Term</p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800 rounded-lg">
            <p className="text-2xl font-semibold text-emerald-400">
              +{draft.targetProbability - calculatedProbability}%
            </p>
            <p className="text-xs text-gray-400">Gap to Target</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cscx-gray-700 mx-6 mt-6">
        {(['overview', 'factors', 'risks', 'signals', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {tab === 'risks' && (
              <span className="ml-1 text-xs text-red-400">
                ({draft.riskFactors.filter(r => r.enabled).length})
              </span>
            )}
            {tab === 'signals' && (
              <span className="ml-1 text-xs text-emerald-400">
                ({draft.positiveSignals.filter(s => s.enabled).length})
              </span>
            )}
            {tab === 'actions' && (
              <span className="ml-1 text-xs text-blue-400">
                ({draft.recommendedActions.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Renewal Date</label>
                <input
                  type="date"
                  value={draft.renewalDate}
                  onChange={(e) => updateRenewalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Contract Term</label>
                <select
                  value={draft.contractTerm}
                  onChange={(e) => updateContractTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                >
                  {CONTRACT_TERM_OPTIONS.map(term => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">ARR ($)</label>
                <input
                  type="number"
                  value={draft.arr}
                  onChange={(e) => updateArr(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Probability (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.targetProbability}
                  onChange={(e) => updateTargetProbability(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Historical Context */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Historical Context</label>
              <textarea
                value={draft.historicalContext}
                onChange={(e) => updateHistoricalContext(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none resize-none"
                placeholder="Add context about renewal history, patterns, or key considerations..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => updateNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none resize-none"
                placeholder="Additional notes..."
              />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-red-400 font-medium">Risk Factors</span>
                </div>
                <p className="text-2xl font-semibold text-white">{draft.riskFactors.filter(r => r.enabled).length}</p>
                <p className="text-xs text-gray-400">
                  Impact: {draft.riskFactors.filter(r => r.enabled).reduce((acc, r) => acc + r.impact, 0)}%
                </p>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-emerald-400 font-medium">Positive Signals</span>
                </div>
                <p className="text-2xl font-semibold text-white">{draft.positiveSignals.filter(s => s.enabled).length}</p>
                <p className="text-xs text-gray-400">
                  Impact: +{draft.positiveSignals.filter(s => s.enabled).reduce((acc, s) => acc + s.impact, 0)}%
                </p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-blue-400 font-medium">Actions</span>
                </div>
                <p className="text-2xl font-semibold text-white">{draft.recommendedActions.length}</p>
                <p className="text-xs text-gray-400">
                  {draft.recommendedActions.filter(a => a.priority === 'high').length} high priority
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Factors Tab */}
        {activeTab === 'factors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-white">Probability Factors</h4>
                <p className="text-sm text-gray-400">
                  Total weight: {draft.probabilityFactors.reduce((acc, f) => acc + f.weight, 0)}%
                  {draft.probabilityFactors.reduce((acc, f) => acc + f.weight, 0) !== 100 && (
                    <span className="text-yellow-400 ml-2">(Should sum to 100%)</span>
                  )}
                </p>
              </div>
              <button
                onClick={addFactor}
                className="px-3 py-1.5 text-sm text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Factor
              </button>
            </div>

            {draft.probabilityFactors.map((factor) => (
              <div
                key={factor.id}
                className="p-4 bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={factor.name}
                        onChange={(e) => updateFactor(factor.id, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        onClick={() => removeFactor(factor.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Weight (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={factor.weight}
                          onChange={(e) => updateFactor(factor.id, 'weight', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Score (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={factor.score}
                          onChange={(e) => updateFactor(factor.id, 'score', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Score Bar */}
                    <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProbabilityBgColor(factor.score)} transition-all duration-300`}
                        style={{ width: `${factor.score}%` }}
                      />
                    </div>

                    <input
                      type="text"
                      value={factor.description}
                      onChange={(e) => updateFactor(factor.id, 'description', e.target.value)}
                      placeholder="Description..."
                      className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-gray-400 text-sm focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="text-right">
                    <p className={`text-2xl font-semibold ${getProbabilityColor(factor.score)}`}>
                      {Math.round(factor.score * factor.weight / 100)}
                    </p>
                    <p className="text-xs text-gray-500">Contribution</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Risks Tab */}
        {activeTab === 'risks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-white">Risk Factors</h4>
                <p className="text-sm text-gray-400">Toggle risks that apply to this account</p>
              </div>
              <button
                onClick={addRisk}
                className="px-3 py-1.5 text-sm text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Risk
              </button>
            </div>

            {draft.riskFactors.map((risk) => (
              <div
                key={risk.id}
                className={`border rounded-lg transition-all ${
                  risk.enabled
                    ? 'bg-red-500/5 border-red-500/30'
                    : 'bg-cscx-gray-900/30 border-cscx-gray-700 opacity-60'
                }`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedRisk(expandedRisk === risk.id ? null : risk.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRiskEnabled(risk.id);
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          risk.enabled
                            ? 'bg-red-500 border-red-500'
                            : 'border-gray-500'
                        }`}
                      >
                        {risk.enabled && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div>
                        <h5 className={`font-medium ${risk.enabled ? 'text-white' : 'text-gray-400'}`}>
                          {risk.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(risk.severity)}`}>
                            {risk.severity}
                          </span>
                          <span className="text-xs text-red-400">{risk.impact}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRisk(risk.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedRisk === risk.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {expandedRisk === risk.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-cscx-gray-700/50 pt-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={risk.name}
                        onChange={(e) => updateRisk(risk.id, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={risk.description}
                        onChange={(e) => updateRisk(risk.id, 'description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Severity</label>
                        <select
                          value={risk.severity}
                          onChange={(e) => updateRisk(risk.id, 'severity', e.target.value)}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        >
                          {SEVERITY_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Impact (%)</label>
                        <input
                          type="number"
                          min="-50"
                          max="0"
                          value={risk.impact}
                          onChange={(e) => updateRisk(risk.id, 'impact', Math.min(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Signals Tab */}
        {activeTab === 'signals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-white">Positive Signals</h4>
                <p className="text-sm text-gray-400">Toggle signals that support renewal</p>
              </div>
              <button
                onClick={addSignal}
                className="px-3 py-1.5 text-sm text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Signal
              </button>
            </div>

            {draft.positiveSignals.map((signal) => (
              <div
                key={signal.id}
                className={`border rounded-lg transition-all ${
                  signal.enabled
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-cscx-gray-900/30 border-cscx-gray-700 opacity-60'
                }`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedSignal(expandedSignal === signal.id ? null : signal.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSignalEnabled(signal.id);
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          signal.enabled
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-gray-500'
                        }`}
                      >
                        {signal.enabled && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div>
                        <h5 className={`font-medium ${signal.enabled ? 'text-white' : 'text-gray-400'}`}>
                          {signal.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded ${getStrengthColor(signal.strength)}`}>
                            {signal.strength}
                          </span>
                          <span className="text-xs text-emerald-400">+{signal.impact}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSignal(signal.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedSignal === signal.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {expandedSignal === signal.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-cscx-gray-700/50 pt-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={signal.name}
                        onChange={(e) => updateSignal(signal.id, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={signal.description}
                        onChange={(e) => updateSignal(signal.id, 'description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Strength</label>
                        <select
                          value={signal.strength}
                          onChange={(e) => updateSignal(signal.id, 'strength', e.target.value)}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        >
                          {STRENGTH_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Impact (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={signal.impact}
                          onChange={(e) => updateSignal(signal.id, 'impact', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-white">Recommended Actions</h4>
                <p className="text-sm text-gray-400">Actions to improve renewal probability</p>
              </div>
              <button
                onClick={addAction}
                className="px-3 py-1.5 text-sm text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Action
              </button>
            </div>

            {draft.recommendedActions.map((action, idx) => (
              <div
                key={action.id}
                className="border border-cscx-gray-700 rounded-lg bg-cscx-gray-900/30"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div>
                        <h5 className="font-medium text-white">{action.action}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded ${getPriorityColor(action.priority)}`}>
                            {action.priority}
                          </span>
                          <span className="text-xs text-gray-400">{action.owner}</span>
                          <span className="text-xs text-gray-500">Due: {action.dueDate}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(action.status)}`}>
                            {action.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveAction(action.id, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveAction(action.id, 'down');
                        }}
                        disabled={idx === draft.recommendedActions.length - 1}
                        className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAction(action.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedAction === action.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {expandedAction === action.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-cscx-gray-700/50 pt-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Action</label>
                      <input
                        type="text"
                        value={action.action}
                        onChange={(e) => updateAction(action.id, 'action', e.target.value)}
                        className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <select
                          value={action.priority}
                          onChange={(e) => updateAction(action.id, 'priority', e.target.value)}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        >
                          {PRIORITY_OPTIONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Owner</label>
                        <select
                          value={action.owner}
                          onChange={(e) => updateAction(action.id, 'owner', e.target.value)}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        >
                          {OWNER_OPTIONS.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={action.dueDate}
                          onChange={(e) => updateAction(action.id, 'dueDate', e.target.value)}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                          value={action.status}
                          onChange={(e) => updateAction(action.id, 'status', e.target.value)}
                          className="w-full px-3 py-1.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:border-teal-500 focus:outline-none"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
