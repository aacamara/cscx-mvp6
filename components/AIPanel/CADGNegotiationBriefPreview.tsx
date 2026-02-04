/**
 * CADGNegotiationBriefPreview - Editable negotiation brief preview for CADG-generated plans
 * Allows users to review, edit, and approve contract terms, leverage points, counter-strategies, and walk-away points before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ContractTerm {
  id: string;
  term: string;
  currentValue: string;
  targetValue: string;
  priority: 'must_have' | 'important' | 'nice_to_have';
  notes: string;
}

export interface LeveragePoint {
  id: string;
  title: string;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  category: 'value_delivered' | 'relationship' | 'market_position' | 'strategic_fit' | 'timing';
  enabled: boolean;
}

export interface CounterStrategy {
  id: string;
  objection: string;
  response: string;
  evidence: string;
  category: 'price' | 'scope' | 'timeline' | 'terms' | 'competition';
}

export interface WalkAwayPoint {
  id: string;
  condition: string;
  threshold: string;
  rationale: string;
  severity: 'critical' | 'important' | 'minor';
}

export interface NegotiationBriefData {
  title: string;
  negotiationDate: string;
  contractValue: number;
  contractTerm: string;
  renewalDate: string;
  currentTerms: ContractTerm[];
  leveragePoints: LeveragePoint[];
  counterStrategies: CounterStrategy[];
  walkAwayPoints: WalkAwayPoint[];
  competitorIntel: string[];
  valueDelivered: string[];
  internalNotes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGNegotiationBriefPreviewProps {
  negotiationBrief: NegotiationBriefData;
  customer: CustomerData;
  onSave: (negotiationBrief: NegotiationBriefData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const PRIORITY_OPTIONS = ['must_have', 'important', 'nice_to_have'] as const;
const STRENGTH_OPTIONS = ['strong', 'moderate', 'weak'] as const;
const LEVERAGE_CATEGORY_OPTIONS = ['value_delivered', 'relationship', 'market_position', 'strategic_fit', 'timing'] as const;
const COUNTER_CATEGORY_OPTIONS = ['price', 'scope', 'timeline', 'terms', 'competition'] as const;
const SEVERITY_OPTIONS = ['critical', 'important', 'minor'] as const;
const CONTRACT_TERM_OPTIONS = ['12 months', '24 months', '36 months', 'Month-to-month'] as const;

const PRIORITY_LABELS: Record<string, string> = {
  must_have: 'Must Have',
  important: 'Important',
  nice_to_have: 'Nice to Have',
};

const PRIORITY_COLORS: Record<string, string> = {
  must_have: 'bg-red-500/20 text-red-400 border-red-500/30',
  important: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  nice_to_have: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const STRENGTH_LABELS: Record<string, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: 'bg-emerald-500/20 text-emerald-400',
  moderate: 'bg-blue-500/20 text-blue-400',
  weak: 'bg-gray-500/20 text-gray-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  value_delivered: 'Value Delivered',
  relationship: 'Relationship',
  market_position: 'Market Position',
  strategic_fit: 'Strategic Fit',
  timing: 'Timing',
  price: 'Price',
  scope: 'Scope',
  timeline: 'Timeline',
  terms: 'Terms',
  competition: 'Competition',
};

const CATEGORY_COLORS: Record<string, string> = {
  value_delivered: 'bg-emerald-500/20 text-emerald-400',
  relationship: 'bg-purple-500/20 text-purple-400',
  market_position: 'bg-blue-500/20 text-blue-400',
  strategic_fit: 'bg-cyan-500/20 text-cyan-400',
  timing: 'bg-amber-500/20 text-amber-400',
  price: 'bg-red-500/20 text-red-400',
  scope: 'bg-violet-500/20 text-violet-400',
  timeline: 'bg-orange-500/20 text-orange-400',
  terms: 'bg-pink-500/20 text-pink-400',
  competition: 'bg-rose-500/20 text-rose-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  important: 'Important',
  minor: 'Minor',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  important: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

// ============================================
// Component
// ============================================

export const CADGNegotiationBriefPreview: React.FC<CADGNegotiationBriefPreviewProps> = ({
  negotiationBrief,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<NegotiationBriefData>(() => JSON.parse(JSON.stringify(negotiationBrief)));

  // Editable draft state
  const [draft, setDraft] = useState<NegotiationBriefData>(() => JSON.parse(JSON.stringify(negotiationBrief)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'terms' | 'leverage' | 'counter' | 'walkaway'>('overview');
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const [expandedLeverage, setExpandedLeverage] = useState<string | null>(null);
  const [expandedCounter, setExpandedCounter] = useState<string | null>(null);
  const [expandedWalkaway, setExpandedWalkaway] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate stats
  const stats = useMemo(() => {
    const enabledLeverage = draft.leveragePoints.filter(l => l.enabled);
    const strongLeverage = enabledLeverage.filter(l => l.strength === 'strong').length;
    const criticalWalkaway = draft.walkAwayPoints.filter(w => w.severity === 'critical').length;
    const mustHaveTerms = draft.currentTerms.filter(t => t.priority === 'must_have').length;
    return {
      termsCount: draft.currentTerms.length,
      mustHaveTerms,
      enabledLeverageCount: enabledLeverage.length,
      strongLeverage,
      counterCount: draft.counterStrategies.length,
      walkAwayCount: draft.walkAwayPoints.length,
      criticalWalkaway,
    };
  }, [draft]);

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
      setError(err instanceof Error ? err.message : 'Failed to create negotiation brief');
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

  const updateNegotiationDate = (value: string) => {
    setDraft(prev => ({ ...prev, negotiationDate: value }));
  };

  const updateContractValue = (value: number) => {
    setDraft(prev => ({ ...prev, contractValue: value }));
  };

  const updateContractTerm = (value: string) => {
    setDraft(prev => ({ ...prev, contractTerm: value }));
  };

  const updateInternalNotes = (value: string) => {
    setDraft(prev => ({ ...prev, internalNotes: value }));
  };

  // ============================================
  // Contract Terms Operations
  // ============================================

  const updateTerm = (id: string, field: keyof ContractTerm, value: any) => {
    setDraft(prev => ({
      ...prev,
      currentTerms: prev.currentTerms.map(t =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));
  };

  const addTerm = () => {
    const newTerm: ContractTerm = {
      id: `term-${Date.now()}`,
      term: 'New Term',
      currentValue: '',
      targetValue: '',
      priority: 'important',
      notes: '',
    };
    setDraft(prev => ({
      ...prev,
      currentTerms: [...prev.currentTerms, newTerm],
    }));
    setExpandedTerm(newTerm.id);
  };

  const removeTerm = (id: string) => {
    setDraft(prev => ({
      ...prev,
      currentTerms: prev.currentTerms.filter(t => t.id !== id),
    }));
    if (expandedTerm === id) setExpandedTerm(null);
  };

  // ============================================
  // Leverage Points Operations
  // ============================================

  const updateLeveragePoint = (id: string, field: keyof LeveragePoint, value: any) => {
    setDraft(prev => ({
      ...prev,
      leveragePoints: prev.leveragePoints.map(l =>
        l.id === id ? { ...l, [field]: value } : l
      ),
    }));
  };

  const toggleLeverageEnabled = (id: string) => {
    setDraft(prev => ({
      ...prev,
      leveragePoints: prev.leveragePoints.map(l =>
        l.id === id ? { ...l, enabled: !l.enabled } : l
      ),
    }));
  };

  const addLeveragePoint = () => {
    const newLeverage: LeveragePoint = {
      id: `leverage-${Date.now()}`,
      title: 'New Leverage Point',
      description: '',
      strength: 'moderate',
      category: 'value_delivered',
      enabled: true,
    };
    setDraft(prev => ({
      ...prev,
      leveragePoints: [...prev.leveragePoints, newLeverage],
    }));
    setExpandedLeverage(newLeverage.id);
  };

  const removeLeveragePoint = (id: string) => {
    setDraft(prev => ({
      ...prev,
      leveragePoints: prev.leveragePoints.filter(l => l.id !== id),
    }));
    if (expandedLeverage === id) setExpandedLeverage(null);
  };

  // ============================================
  // Counter-Strategies Operations
  // ============================================

  const updateCounterStrategy = (id: string, field: keyof CounterStrategy, value: any) => {
    setDraft(prev => ({
      ...prev,
      counterStrategies: prev.counterStrategies.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }));
  };

  const addCounterStrategy = () => {
    const newCounter: CounterStrategy = {
      id: `counter-${Date.now()}`,
      objection: 'New Objection',
      response: '',
      evidence: '',
      category: 'price',
    };
    setDraft(prev => ({
      ...prev,
      counterStrategies: [...prev.counterStrategies, newCounter],
    }));
    setExpandedCounter(newCounter.id);
  };

  const removeCounterStrategy = (id: string) => {
    setDraft(prev => ({
      ...prev,
      counterStrategies: prev.counterStrategies.filter(c => c.id !== id),
    }));
    if (expandedCounter === id) setExpandedCounter(null);
  };

  // ============================================
  // Walk-Away Points Operations
  // ============================================

  const updateWalkAwayPoint = (id: string, field: keyof WalkAwayPoint, value: any) => {
    setDraft(prev => ({
      ...prev,
      walkAwayPoints: prev.walkAwayPoints.map(w =>
        w.id === id ? { ...w, [field]: value } : w
      ),
    }));
  };

  const addWalkAwayPoint = () => {
    const newWalkaway: WalkAwayPoint = {
      id: `walkaway-${Date.now()}`,
      condition: 'New Condition',
      threshold: '',
      rationale: '',
      severity: 'important',
    };
    setDraft(prev => ({
      ...prev,
      walkAwayPoints: [...prev.walkAwayPoints, newWalkaway],
    }));
    setExpandedWalkaway(newWalkaway.id);
  };

  const removeWalkAwayPoint = (id: string) => {
    setDraft(prev => ({
      ...prev,
      walkAwayPoints: prev.walkAwayPoints.filter(w => w.id !== id),
    }));
    if (expandedWalkaway === id) setExpandedWalkaway(null);
  };

  // ============================================
  // List Operations (Competitor Intel & Value Delivered)
  // ============================================

  const updateCompetitorIntel = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      competitorIntel: prev.competitorIntel.map((item, i) => i === index ? value : item),
    }));
  };

  const addCompetitorIntel = () => {
    setDraft(prev => ({
      ...prev,
      competitorIntel: [...prev.competitorIntel, ''],
    }));
  };

  const removeCompetitorIntel = (index: number) => {
    setDraft(prev => ({
      ...prev,
      competitorIntel: prev.competitorIntel.filter((_, i) => i !== index),
    }));
  };

  const updateValueDelivered = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      valueDelivered: prev.valueDelivered.map((item, i) => i === index ? value : item),
    }));
  };

  const addValueDelivered = () => {
    setDraft(prev => ({
      ...prev,
      valueDelivered: [...prev.valueDelivered, ''],
    }));
  };

  const removeValueDelivered = (index: number) => {
    setDraft(prev => ({
      ...prev,
      valueDelivered: prev.valueDelivered.filter((_, i) => i !== index),
    }));
  };

  // ============================================
  // Render Tabs
  // ============================================

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-900/50 rounded-lg p-4 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Contract Value</div>
          <div className="text-xl font-bold text-white">${draft.contractValue.toLocaleString()}</div>
        </div>
        <div className="bg-cscx-gray-900/50 rounded-lg p-4 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Days to Renewal</div>
          <div className="text-xl font-bold text-white">
            {Math.max(0, Math.round((new Date(draft.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))}
          </div>
        </div>
        <div className="bg-cscx-gray-900/50 rounded-lg p-4 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Leverage Points</div>
          <div className="text-xl font-bold text-emerald-400">
            {stats.enabledLeverageCount} <span className="text-sm text-gray-500">({stats.strongLeverage} strong)</span>
          </div>
        </div>
        <div className="bg-cscx-gray-900/50 rounded-lg p-4 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Walk-Away Points</div>
          <div className="text-xl font-bold text-red-400">
            {stats.walkAwayCount} <span className="text-sm text-gray-500">({stats.criticalWalkaway} critical)</span>
          </div>
        </div>
      </div>

      {/* Title & Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input
            type="text"
            value={draft.title}
            onChange={e => updateTitle(e.target.value)}
            className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Negotiation Date</label>
            <input
              type="date"
              value={draft.negotiationDate}
              onChange={e => updateNegotiationDate(e.target.value)}
              className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contract Value ($)</label>
            <input
              type="number"
              value={draft.contractValue}
              onChange={e => updateContractValue(parseInt(e.target.value) || 0)}
              className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contract Term</label>
            <select
              value={draft.contractTerm}
              onChange={e => updateContractTerm(e.target.value)}
              className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              {CONTRACT_TERM_OPTIONS.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Value Delivered */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Value Delivered</label>
          <button
            onClick={addValueDelivered}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {draft.valueDelivered.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={e => updateValueDelivered(idx, e.target.value)}
                placeholder="Value point..."
                className="flex-1 bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => removeValueDelivered(idx)}
                className="text-gray-500 hover:text-red-400 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Intel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Competitor Intelligence</label>
          <button
            onClick={addCompetitorIntel}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {draft.competitorIntel.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={e => updateCompetitorIntel(idx, e.target.value)}
                placeholder="Competitor insight..."
                className="flex-1 bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => removeCompetitorIntel(idx)}
                className="text-gray-500 hover:text-red-400 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Internal Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Internal Notes</label>
        <textarea
          value={draft.internalNotes}
          onChange={e => updateInternalNotes(e.target.value)}
          placeholder="Add confidential internal notes..."
          rows={4}
          className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
        />
      </div>
    </div>
  );

  const renderTermsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Contract Terms</h3>
          <p className="text-xs text-gray-500">{stats.termsCount} terms ({stats.mustHaveTerms} must-have)</p>
        </div>
        <button
          onClick={addTerm}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
        >
          + Add Term
        </button>
      </div>

      <div className="space-y-3">
        {draft.currentTerms.map((term) => (
          <div
            key={term.id}
            className="bg-cscx-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden"
          >
            {/* Term Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-900/70"
              onClick={() => setExpandedTerm(expandedTerm === term.id ? null : term.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`px-2 py-0.5 rounded text-xs border ${PRIORITY_COLORS[term.priority]}`}>
                  {PRIORITY_LABELS[term.priority]}
                </div>
                <span className="text-white font-medium">{term.term}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{term.currentValue} → {term.targetValue}</span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedTerm === term.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Term Details (Expanded) */}
            {expandedTerm === term.id && (
              <div className="p-4 border-t border-gray-700/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Term Name</label>
                    <input
                      type="text"
                      value={term.term}
                      onChange={e => updateTerm(term.id, 'term', e.target.value)}
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Priority</label>
                    <select
                      value={term.priority}
                      onChange={e => updateTerm(term.id, 'priority', e.target.value)}
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Current Value</label>
                    <input
                      type="text"
                      value={term.currentValue}
                      onChange={e => updateTerm(term.id, 'currentValue', e.target.value)}
                      placeholder="Current state..."
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Target Value</label>
                    <input
                      type="text"
                      value={term.targetValue}
                      onChange={e => updateTerm(term.id, 'targetValue', e.target.value)}
                      placeholder="Target outcome..."
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={term.notes}
                    onChange={e => updateTerm(term.id, 'notes', e.target.value)}
                    placeholder="Internal notes..."
                    rows={2}
                    className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => removeTerm(term.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove Term
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderLeverageTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Leverage Points</h3>
          <p className="text-xs text-gray-500">{stats.enabledLeverageCount} enabled ({stats.strongLeverage} strong)</p>
        </div>
        <button
          onClick={addLeveragePoint}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
        >
          + Add Leverage
        </button>
      </div>

      <div className="space-y-3">
        {draft.leveragePoints.map((leverage) => (
          <div
            key={leverage.id}
            className={`rounded-lg border overflow-hidden transition-all ${
              leverage.enabled
                ? 'bg-cscx-gray-900/50 border-gray-700/50'
                : 'bg-cscx-gray-900/20 border-gray-700/30 opacity-60'
            }`}
          >
            {/* Leverage Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-900/70"
              onClick={() => setExpandedLeverage(expandedLeverage === leverage.id ? null : leverage.id)}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={e => { e.stopPropagation(); toggleLeverageEnabled(leverage.id); }}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    leverage.enabled
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-gray-600 text-transparent hover:border-gray-500'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span className={`text-white font-medium ${!leverage.enabled && 'line-through'}`}>
                  {leverage.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${STRENGTH_COLORS[leverage.strength]}`}>
                  {STRENGTH_LABELS[leverage.strength]}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[leverage.category]}`}>
                  {CATEGORY_LABELS[leverage.category]}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedLeverage === leverage.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Leverage Details (Expanded) */}
            {expandedLeverage === leverage.id && (
              <div className="p-4 border-t border-gray-700/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={leverage.title}
                      onChange={e => updateLeveragePoint(leverage.id, 'title', e.target.value)}
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Strength</label>
                      <select
                        value={leverage.strength}
                        onChange={e => updateLeveragePoint(leverage.id, 'strength', e.target.value)}
                        className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        {STRENGTH_OPTIONS.map(s => (
                          <option key={s} value={s}>{STRENGTH_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Category</label>
                      <select
                        value={leverage.category}
                        onChange={e => updateLeveragePoint(leverage.id, 'category', e.target.value)}
                        className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        {LEVERAGE_CATEGORY_OPTIONS.map(c => (
                          <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea
                    value={leverage.description}
                    onChange={e => updateLeveragePoint(leverage.id, 'description', e.target.value)}
                    placeholder="Describe this leverage point..."
                    rows={2}
                    className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => removeLeveragePoint(leverage.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove Leverage Point
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderCounterTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Counter-Strategies</h3>
          <p className="text-xs text-gray-500">{stats.counterCount} strategies prepared</p>
        </div>
        <button
          onClick={addCounterStrategy}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          + Add Strategy
        </button>
      </div>

      <div className="space-y-3">
        {draft.counterStrategies.map((counter) => (
          <div
            key={counter.id}
            className="bg-cscx-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden"
          >
            {/* Counter Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-900/70"
              onClick={() => setExpandedCounter(expandedCounter === counter.id ? null : counter.id)}
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[counter.category]}`}>
                  {CATEGORY_LABELS[counter.category]}
                </span>
                <span className="text-white font-medium">{counter.objection}</span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedCounter === counter.id ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Counter Details (Expanded) */}
            {expandedCounter === counter.id && (
              <div className="p-4 border-t border-gray-700/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Objection</label>
                    <input
                      type="text"
                      value={counter.objection}
                      onChange={e => updateCounterStrategy(counter.id, 'objection', e.target.value)}
                      placeholder="Expected objection..."
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Category</label>
                    <select
                      value={counter.category}
                      onChange={e => updateCounterStrategy(counter.id, 'category', e.target.value)}
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {COUNTER_CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Response</label>
                  <textarea
                    value={counter.response}
                    onChange={e => updateCounterStrategy(counter.id, 'response', e.target.value)}
                    placeholder="Recommended response..."
                    rows={2}
                    className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Evidence</label>
                  <textarea
                    value={counter.evidence}
                    onChange={e => updateCounterStrategy(counter.id, 'evidence', e.target.value)}
                    placeholder="Supporting evidence or data..."
                    rows={2}
                    className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => removeCounterStrategy(counter.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove Strategy
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderWalkawayTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Walk-Away Points</h3>
          <p className="text-xs text-gray-500">{stats.walkAwayCount} conditions ({stats.criticalWalkaway} critical)</p>
        </div>
        <button
          onClick={addWalkAwayPoint}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
        >
          + Add Walk-Away
        </button>
      </div>

      <div className="space-y-3">
        {draft.walkAwayPoints.map((walkaway) => (
          <div
            key={walkaway.id}
            className="bg-cscx-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden"
          >
            {/* Walk-Away Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-cscx-gray-900/70"
              onClick={() => setExpandedWalkaway(expandedWalkaway === walkaway.id ? null : walkaway.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`px-2 py-0.5 rounded text-xs border ${SEVERITY_COLORS[walkaway.severity]}`}>
                  {SEVERITY_LABELS[walkaway.severity]}
                </div>
                <span className="text-white font-medium">{walkaway.condition}</span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedWalkaway === walkaway.id ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Walk-Away Details (Expanded) */}
            {expandedWalkaway === walkaway.id && (
              <div className="p-4 border-t border-gray-700/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Condition</label>
                    <input
                      type="text"
                      value={walkaway.condition}
                      onChange={e => updateWalkAwayPoint(walkaway.id, 'condition', e.target.value)}
                      placeholder="Walk-away condition..."
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Severity</label>
                    <select
                      value={walkaway.severity}
                      onChange={e => updateWalkAwayPoint(walkaway.id, 'severity', e.target.value)}
                      className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {SEVERITY_OPTIONS.map(s => (
                        <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Threshold</label>
                  <input
                    type="text"
                    value={walkaway.threshold}
                    onChange={e => updateWalkAwayPoint(walkaway.id, 'threshold', e.target.value)}
                    placeholder="Specific threshold..."
                    className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rationale</label>
                  <textarea
                    value={walkaway.rationale}
                    onChange={e => updateWalkAwayPoint(walkaway.id, 'rationale', e.target.value)}
                    placeholder="Why this is a deal-breaker..."
                    rows={2}
                    className="w-full bg-cscx-gray-900 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => removeWalkAwayPoint(walkaway.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove Walk-Away Point
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-900/90 to-violet-900/90 backdrop-blur-sm px-4 py-3 border-b border-indigo-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-medium">Negotiation Brief Preview</h3>
              <p className="text-xs text-indigo-300">
                {customer.name} • ${draft.contractValue.toLocaleString()} contract
              </p>
            </div>
          </div>
          {isModified && (
            <span className="text-xs text-amber-400">• Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 border-b border-gray-700/50">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'terms', label: 'Terms', icon: '📋', count: stats.termsCount },
            { id: 'leverage', label: 'Leverage', icon: '💪', count: stats.enabledLeverageCount },
            { id: 'counter', label: 'Counter', icon: '🛡️', count: stats.counterCount },
            { id: 'walkaway', label: 'Walk-Away', icon: '🚫', count: stats.walkAwayCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-cscx-gray-900/50 text-white border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-cscx-gray-900/30'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-xs text-gray-500">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'terms' && renderTermsTab()}
        {activeTab === 'leverage' && renderLeverageTab()}
        {activeTab === 'counter' && renderCounterTab()}
        {activeTab === 'walkaway' && renderWalkawayTab()}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-cscx-gray-900/50 border-t border-gray-700/50 flex items-center justify-between">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Creating...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Create Brief</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGNegotiationBriefPreview;
