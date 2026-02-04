/**
 * CADGEscalationReportPreview - Editable escalation report preview for CADG-generated plans
 * Allows users to review, edit, and approve escalation reports before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface TimelineEvent {
  id: string;
  date: string;
  event: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actor: 'customer' | 'csm' | 'support' | 'product' | 'leadership' | 'external';
  enabled: boolean;
}

export interface ImpactMetric {
  id: string;
  metric: string;
  value: string;
  impact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}

export interface SupportingEvidence {
  id: string;
  title: string;
  type: 'email' | 'ticket' | 'meeting' | 'document' | 'screenshot' | 'log' | 'other';
  date: string;
  description: string;
  url?: string;
  enabled: boolean;
}

export interface ResolutionRequest {
  id: string;
  request: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  owner: 'Product' | 'Engineering' | 'Leadership' | 'Support' | 'Legal' | 'Finance';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface EscalationReportData {
  title: string;
  createdDate: string;
  escalationLevel: 'critical' | 'high' | 'medium';
  issueSummary: string;
  customerName: string;
  arr: number;
  healthScore: number;
  daysUntilRenewal: number;
  primaryContact: string;
  escalationOwner: string;
  timeline: TimelineEvent[];
  impactMetrics: ImpactMetric[];
  resolutionRequests: ResolutionRequest[];
  supportingEvidence: SupportingEvidence[];
  recommendedActions: string;
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
}

interface CADGEscalationReportPreviewProps {
  escalationReport: EscalationReportData;
  customer: CustomerData;
  onSave: (report: EscalationReportData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const ESCALATION_LEVEL_OPTIONS = ['critical', 'high', 'medium'] as const;
const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;
const ACTOR_OPTIONS = ['customer', 'csm', 'support', 'product', 'leadership', 'external'] as const;
const EVIDENCE_TYPE_OPTIONS = ['email', 'ticket', 'meeting', 'document', 'screenshot', 'log', 'other'] as const;
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low'] as const;
const OWNER_OPTIONS = ['Product', 'Engineering', 'Leadership', 'Support', 'Legal', 'Finance'] as const;
const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'blocked'] as const;

const ESCALATION_LEVEL_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
};

const ESCALATION_LEVEL_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const ACTOR_LABELS: Record<string, string> = {
  customer: 'Customer',
  csm: 'CSM',
  support: 'Support',
  product: 'Product',
  leadership: 'Leadership',
  external: 'External',
};

const ACTOR_COLORS: Record<string, string> = {
  customer: 'bg-blue-500/20 text-blue-400',
  csm: 'bg-emerald-500/20 text-emerald-400',
  support: 'bg-purple-500/20 text-purple-400',
  product: 'bg-cyan-500/20 text-cyan-400',
  leadership: 'bg-amber-500/20 text-amber-400',
  external: 'bg-gray-500/20 text-gray-400',
};

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  ticket: 'Ticket',
  meeting: 'Meeting',
  document: 'Document',
  screenshot: 'Screenshot',
  log: 'Log',
  other: 'Other',
};

const EVIDENCE_TYPE_COLORS: Record<string, string> = {
  email: 'bg-blue-500/20 text-blue-400',
  ticket: 'bg-red-500/20 text-red-400',
  meeting: 'bg-green-500/20 text-green-400',
  document: 'bg-purple-500/20 text-purple-400',
  screenshot: 'bg-pink-500/20 text-pink-400',
  log: 'bg-gray-500/20 text-gray-400',
  other: 'bg-amber-500/20 text-amber-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-green-500/20 text-green-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  blocked: 'bg-red-500/20 text-red-400',
};

// ============================================
// Component
// ============================================

export const CADGEscalationReportPreview: React.FC<CADGEscalationReportPreviewProps> = ({
  escalationReport,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<EscalationReportData>(() => JSON.parse(JSON.stringify(escalationReport)));

  // Editable draft state
  const [draft, setDraft] = useState<EscalationReportData>(() => JSON.parse(JSON.stringify(escalationReport)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'impact' | 'requests' | 'evidence'>('overview');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [expandedImpact, setExpandedImpact] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate stats based on current draft
  const calculatedStats = useMemo(() => {
    const enabledEvents = draft.timeline.filter(e => e.enabled);
    const enabledImpacts = draft.impactMetrics.filter(m => m.enabled);
    const enabledEvidence = draft.supportingEvidence.filter(e => e.enabled);
    const pendingRequests = draft.resolutionRequests.filter(r => r.status === 'pending' || r.status === 'in_progress');
    const urgentRequests = draft.resolutionRequests.filter(r => r.priority === 'urgent');
    const criticalImpacts = enabledImpacts.filter(m => m.severity === 'critical');
    const criticalEvents = enabledEvents.filter(e => e.severity === 'critical');

    // Determine escalation level based on impacts and events
    let escalationLevel: EscalationReportData['escalationLevel'] = draft.escalationLevel;
    if (criticalImpacts.length >= 2 || criticalEvents.length >= 2 || urgentRequests.length >= 2) {
      escalationLevel = 'critical';
    } else if (criticalImpacts.length >= 1 || criticalEvents.length >= 1 || urgentRequests.length >= 1) {
      escalationLevel = 'high';
    }

    return {
      escalationLevel,
      timelineCount: enabledEvents.length,
      impactCount: enabledImpacts.length,
      requestCount: draft.resolutionRequests.length,
      evidenceCount: enabledEvidence.length,
      pendingRequests: pendingRequests.length,
      urgentRequests: urgentRequests.length,
      criticalImpacts: criticalImpacts.length,
      criticalEvents: criticalEvents.length,
    };
  }, [draft]);

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (isModified) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmDiscard) return;
    }
    onCancel();
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Update escalation level before saving
      const finalDraft = {
        ...draft,
        escalationLevel: calculatedStats.escalationLevel,
      };
      await onSave(finalDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save escalation report');
    } finally {
      setIsSaving(false);
    }
  };

  // Timeline event handlers
  const handleToggleEvent = (eventId: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: prev.timeline.map(e =>
        e.id === eventId ? { ...e, enabled: !e.enabled } : e
      ),
    }));
  };

  const handleUpdateEvent = (eventId: string, updates: Partial<TimelineEvent>) => {
    setDraft(prev => ({
      ...prev,
      timeline: prev.timeline.map(e =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    }));
  };

  const handleAddEvent = () => {
    const newEvent: TimelineEvent = {
      id: `event-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      event: 'New Event',
      description: '',
      severity: 'medium',
      actor: 'csm',
      enabled: true,
    };
    setDraft(prev => ({
      ...prev,
      timeline: [...prev.timeline, newEvent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }));
    setExpandedEvent(newEvent.id);
  };

  const handleRemoveEvent = (eventId: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: prev.timeline.filter(e => e.id !== eventId),
    }));
  };

  // Impact metric handlers
  const handleToggleImpact = (impactId: string) => {
    setDraft(prev => ({
      ...prev,
      impactMetrics: prev.impactMetrics.map(m =>
        m.id === impactId ? { ...m, enabled: !m.enabled } : m
      ),
    }));
  };

  const handleUpdateImpact = (impactId: string, updates: Partial<ImpactMetric>) => {
    setDraft(prev => ({
      ...prev,
      impactMetrics: prev.impactMetrics.map(m =>
        m.id === impactId ? { ...m, ...updates } : m
      ),
    }));
  };

  const handleAddImpact = () => {
    const newImpact: ImpactMetric = {
      id: `impact-${Date.now()}`,
      metric: 'New Impact',
      value: '',
      impact: '',
      severity: 'high',
      enabled: true,
    };
    setDraft(prev => ({
      ...prev,
      impactMetrics: [...prev.impactMetrics, newImpact],
    }));
    setExpandedImpact(newImpact.id);
  };

  const handleRemoveImpact = (impactId: string) => {
    setDraft(prev => ({
      ...prev,
      impactMetrics: prev.impactMetrics.filter(m => m.id !== impactId),
    }));
  };

  // Resolution request handlers
  const handleUpdateRequest = (requestId: string, updates: Partial<ResolutionRequest>) => {
    setDraft(prev => ({
      ...prev,
      resolutionRequests: prev.resolutionRequests.map(r =>
        r.id === requestId ? { ...r, ...updates } : r
      ),
    }));
  };

  const handleAddRequest = () => {
    const newRequest: ResolutionRequest = {
      id: `request-${Date.now()}`,
      request: 'New Resolution Request',
      priority: 'high',
      owner: 'Product',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'pending',
    };
    setDraft(prev => ({
      ...prev,
      resolutionRequests: [...prev.resolutionRequests, newRequest],
    }));
    setExpandedRequest(newRequest.id);
  };

  const handleRemoveRequest = (requestId: string) => {
    setDraft(prev => ({
      ...prev,
      resolutionRequests: prev.resolutionRequests.filter(r => r.id !== requestId),
    }));
  };

  const handleMoveRequest = (requestId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const idx = prev.resolutionRequests.findIndex(r => r.id === requestId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.resolutionRequests.length - 1) return prev;

      const newRequests = [...prev.resolutionRequests];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newRequests[idx], newRequests[targetIdx]] = [newRequests[targetIdx], newRequests[idx]];

      return { ...prev, resolutionRequests: newRequests };
    });
  };

  // Supporting evidence handlers
  const handleToggleEvidence = (evidenceId: string) => {
    setDraft(prev => ({
      ...prev,
      supportingEvidence: prev.supportingEvidence.map(e =>
        e.id === evidenceId ? { ...e, enabled: !e.enabled } : e
      ),
    }));
  };

  const handleUpdateEvidence = (evidenceId: string, updates: Partial<SupportingEvidence>) => {
    setDraft(prev => ({
      ...prev,
      supportingEvidence: prev.supportingEvidence.map(e =>
        e.id === evidenceId ? { ...e, ...updates } : e
      ),
    }));
  };

  const handleAddEvidence = () => {
    const newEvidence: SupportingEvidence = {
      id: `evidence-${Date.now()}`,
      title: 'New Evidence',
      type: 'document',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      enabled: true,
    };
    setDraft(prev => ({
      ...prev,
      supportingEvidence: [...prev.supportingEvidence, newEvidence],
    }));
    setExpandedEvidence(newEvidence.id);
  };

  const handleRemoveEvidence = (evidenceId: string) => {
    setDraft(prev => ({
      ...prev,
      supportingEvidence: prev.supportingEvidence.filter(e => e.id !== evidenceId),
    }));
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700 overflow-hidden max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-red-900/30 to-rose-900/20 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
              className="text-lg font-semibold bg-transparent border-none outline-none text-white w-full focus:ring-1 focus:ring-red-500/50 rounded px-1"
            />
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
              <span>{customer.name}</span>
              <span>|</span>
              <span>Created: {draft.createdDate}</span>
              <span>|</span>
              <span className={ESCALATION_LEVEL_COLORS[calculatedStats.escalationLevel]}>
                {ESCALATION_LEVEL_LABELS[calculatedStats.escalationLevel]} Escalation
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Create Report'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Escalation Overview Card */}
        <div className="mt-4 p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
          <div className="grid grid-cols-6 gap-4">
            {/* Escalation Level */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Level</div>
              <div className={`text-2xl font-bold ${ESCALATION_LEVEL_COLORS[calculatedStats.escalationLevel]}`}>
                {ESCALATION_LEVEL_LABELS[calculatedStats.escalationLevel]}
              </div>
            </div>

            {/* Health Score */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Health</div>
              <div className={`text-2xl font-bold ${
                draft.healthScore < 40 ? 'text-red-400' :
                draft.healthScore < 60 ? 'text-orange-400' :
                draft.healthScore < 80 ? 'text-amber-400' :
                'text-green-400'
              }`}>
                {draft.healthScore}
              </div>
            </div>

            {/* ARR */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">ARR</div>
              <div className="text-2xl font-bold text-white">
                ${(draft.arr / 1000).toFixed(0)}K
              </div>
            </div>

            {/* Days Until Renewal */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Days to Renewal</div>
              <div className={`text-2xl font-bold ${
                draft.daysUntilRenewal < 30 ? 'text-red-400' :
                draft.daysUntilRenewal < 60 ? 'text-orange-400' :
                'text-white'
              }`}>
                {draft.daysUntilRenewal}
              </div>
            </div>

            {/* Primary Contact */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Primary Contact</div>
              <input
                type="text"
                value={draft.primaryContact}
                onChange={(e) => setDraft(prev => ({ ...prev, primaryContact: e.target.value }))}
                className="text-lg font-semibold bg-transparent border-none outline-none text-white w-full focus:ring-1 focus:ring-red-500/50 rounded truncate"
              />
            </div>

            {/* Escalation Owner */}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Owner</div>
              <input
                type="text"
                value={draft.escalationOwner}
                onChange={(e) => setDraft(prev => ({ ...prev, escalationOwner: e.target.value }))}
                className="text-lg font-semibold bg-transparent border-none outline-none text-red-400 w-full focus:ring-1 focus:ring-red-500/50 rounded truncate"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['overview', 'timeline', 'impact', 'requests', 'evidence'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-cscx-gray-900 text-red-400 border-t border-x border-red-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-cscx-gray-900/50'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'timeline' && `Timeline (${calculatedStats.timelineCount})`}
              {tab === 'impact' && `Impact (${calculatedStats.impactCount})`}
              {tab === 'requests' && `Requests (${calculatedStats.requestCount})`}
              {tab === 'evidence' && `Evidence (${calculatedStats.evidenceCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Issue Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Issue Summary
              </label>
              <textarea
                value={draft.issueSummary}
                onChange={(e) => setDraft(prev => ({ ...prev, issueSummary: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                placeholder="Describe the issue requiring escalation..."
              />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Critical Impacts</div>
                <div className="text-2xl font-bold text-red-400">{calculatedStats.criticalImpacts}</div>
              </div>
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Urgent Requests</div>
                <div className="text-2xl font-bold text-orange-400">{calculatedStats.urgentRequests}</div>
              </div>
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Pending Requests</div>
                <div className="text-2xl font-bold text-blue-400">{calculatedStats.pendingRequests}</div>
              </div>
              <div className="p-4 bg-cscx-gray-900/50 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-500 uppercase mb-1">Timeline Events</div>
                <div className="text-2xl font-bold text-emerald-400">{calculatedStats.timelineCount}</div>
              </div>
            </div>

            {/* Quick Summary */}
            <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-lg">
              <div className="text-sm text-red-400 font-medium mb-2">Escalation Summary</div>
              <div className="text-sm text-gray-300">
                This escalation involves <span className="text-white font-medium">{calculatedStats.impactCount} impact metrics</span> with{' '}
                <span className="text-white font-medium">{calculatedStats.requestCount} resolution requests</span>.{' '}
                <span className="text-red-400 font-medium">{calculatedStats.urgentRequests} urgent</span> requests require immediate attention.
              </div>
            </div>

            {/* Recommended Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recommended Actions
              </label>
              <textarea
                value={draft.recommendedActions}
                onChange={(e) => setDraft(prev => ({ ...prev, recommendedActions: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                placeholder="Summary of recommended next steps..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Internal Notes
              </label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-cscx-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                placeholder="Add any internal notes..."
              />
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.timelineCount} of {draft.timeline.length} events enabled
              </div>
              <button
                onClick={handleAddEvent}
                className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
              >
                + Add Event
              </button>
            </div>

            {draft.timeline.map((event, idx) => (
              <div
                key={event.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  event.enabled
                    ? 'bg-cscx-gray-900/50 border-gray-700'
                    : 'bg-cscx-gray-900/20 border-gray-800 opacity-60'
                }`}
              >
                {/* Event Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={event.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleEvent(event.id);
                      }}
                      className="w-4 h-4 rounded bg-cscx-gray-800 border-gray-600 text-red-500 focus:ring-red-500/50"
                    />

                    {/* Timeline Number */}
                    <span className="w-6 h-6 flex items-center justify-center bg-red-500/20 text-red-400 text-xs rounded-full">
                      {idx + 1}
                    </span>

                    {/* Date */}
                    <span className="text-sm text-gray-400">{event.date}</span>

                    {/* Severity Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded border ${SEVERITY_COLORS[event.severity]}`}>
                      {SEVERITY_LABELS[event.severity]}
                    </span>

                    {/* Actor Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${ACTOR_COLORS[event.actor]}`}>
                      {ACTOR_LABELS[event.actor]}
                    </span>

                    {/* Event Name */}
                    <span className="flex-1 text-white font-medium truncate">{event.event}</span>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedEvent === event.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedEvent === event.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Event Name */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Event</label>
                        <input
                          type="text"
                          value={event.event}
                          onChange={(e) => handleUpdateEvent(event.id, { event: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date</label>
                        <input
                          type="date"
                          value={event.date}
                          onChange={(e) => handleUpdateEvent(event.id, { date: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Actor */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Actor</label>
                        <select
                          value={event.actor}
                          onChange={(e) => handleUpdateEvent(event.id, { actor: e.target.value as TimelineEvent['actor'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {ACTOR_OPTIONS.map(actor => (
                            <option key={actor} value={actor}>{ACTOR_LABELS[actor]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Severity */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Severity</label>
                        <select
                          value={event.severity}
                          onChange={(e) => handleUpdateEvent(event.id, { severity: e.target.value as TimelineEvent['severity'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {SEVERITY_OPTIONS.map(sev => (
                            <option key={sev} value={sev}>{SEVERITY_LABELS[sev]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={event.description}
                        onChange={(e) => handleUpdateEvent(event.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        placeholder="Describe what happened..."
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveEvent(event.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Event
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Impact Tab */}
        {activeTab === 'impact' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.impactCount} of {draft.impactMetrics.length} impacts enabled
              </div>
              <button
                onClick={handleAddImpact}
                className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
              >
                + Add Impact
              </button>
            </div>

            {draft.impactMetrics.map((impact) => (
              <div
                key={impact.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  impact.enabled
                    ? 'bg-cscx-gray-900/50 border-gray-700'
                    : 'bg-cscx-gray-900/20 border-gray-800 opacity-60'
                }`}
              >
                {/* Impact Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedImpact(expandedImpact === impact.id ? null : impact.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={impact.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleImpact(impact.id);
                      }}
                      className="w-4 h-4 rounded bg-cscx-gray-800 border-gray-600 text-red-500 focus:ring-red-500/50"
                    />

                    {/* Severity Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded border ${SEVERITY_COLORS[impact.severity]}`}>
                      {SEVERITY_LABELS[impact.severity]}
                    </span>

                    {/* Metric Name */}
                    <span className="flex-1 text-white font-medium">{impact.metric}</span>

                    {/* Value */}
                    <span className="text-sm text-gray-400">{impact.value}</span>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedImpact === impact.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedImpact === impact.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Metric Name */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Metric</label>
                        <input
                          type="text"
                          value={impact.metric}
                          onChange={(e) => handleUpdateImpact(impact.id, { metric: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Value */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Value</label>
                        <input
                          type="text"
                          value={impact.value}
                          onChange={(e) => handleUpdateImpact(impact.id, { value: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Severity */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Severity</label>
                        <select
                          value={impact.severity}
                          onChange={(e) => handleUpdateImpact(impact.id, { severity: e.target.value as ImpactMetric['severity'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {SEVERITY_OPTIONS.map(sev => (
                            <option key={sev} value={sev}>{SEVERITY_LABELS[sev]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Impact Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Business Impact</label>
                      <textarea
                        value={impact.impact}
                        onChange={(e) => handleUpdateImpact(impact.id, { impact: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        placeholder="Describe the business impact..."
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveImpact(impact.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Impact
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.pendingRequests} of {calculatedStats.requestCount} requests pending
              </div>
              <button
                onClick={handleAddRequest}
                className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
              >
                + Add Request
              </button>
            </div>

            {draft.resolutionRequests.map((request, idx) => (
              <div
                key={request.id}
                className="border rounded-lg overflow-hidden transition-colors bg-cscx-gray-900/50 border-gray-700"
              >
                {/* Request Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Reorder Controls */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveRequest(request.id, 'up');
                        }}
                        disabled={idx === 0}
                        className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveRequest(request.id, 'down');
                        }}
                        disabled={idx === draft.resolutionRequests.length - 1}
                        className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Priority Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${PRIORITY_COLORS[request.priority]}`}>
                      {PRIORITY_LABELS[request.priority]}
                    </span>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[request.status]}`}>
                      {STATUS_LABELS[request.status]}
                    </span>

                    {/* Owner */}
                    <span className="text-xs text-gray-400">{request.owner}</span>

                    {/* Request Name */}
                    <span className="flex-1 text-white font-medium truncate">{request.request}</span>

                    {/* Due Date */}
                    <span className="text-xs text-gray-400">{request.dueDate}</span>

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedRequest === request.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedRequest === request.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Request */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Request</label>
                        <input
                          type="text"
                          value={request.request}
                          onChange={(e) => handleUpdateRequest(request.id, { request: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <select
                          value={request.priority}
                          onChange={(e) => handleUpdateRequest(request.id, { priority: e.target.value as ResolutionRequest['priority'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {PRIORITY_OPTIONS.map(pri => (
                            <option key={pri} value={pri}>{PRIORITY_LABELS[pri]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Owner */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Owner</label>
                        <select
                          value={request.owner}
                          onChange={(e) => handleUpdateRequest(request.id, { owner: e.target.value as ResolutionRequest['owner'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {OWNER_OPTIONS.map(owner => (
                            <option key={owner} value={owner}>{owner}</option>
                          ))}
                        </select>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={request.dueDate}
                          onChange={(e) => handleUpdateRequest(request.id, { dueDate: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                          value={request.status}
                          onChange={(e) => handleUpdateRequest(request.id, { status: e.target.value as ResolutionRequest['status'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveRequest(request.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {calculatedStats.evidenceCount} of {draft.supportingEvidence.length} evidence items enabled
              </div>
              <button
                onClick={handleAddEvidence}
                className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
              >
                + Add Evidence
              </button>
            </div>

            {draft.supportingEvidence.map((evidence) => (
              <div
                key={evidence.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  evidence.enabled
                    ? 'bg-cscx-gray-900/50 border-gray-700'
                    : 'bg-cscx-gray-900/20 border-gray-800 opacity-60'
                }`}
              >
                {/* Evidence Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-cscx-gray-900/70"
                  onClick={() => setExpandedEvidence(expandedEvidence === evidence.id ? null : evidence.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={evidence.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleEvidence(evidence.id);
                      }}
                      className="w-4 h-4 rounded bg-cscx-gray-800 border-gray-600 text-red-500 focus:ring-red-500/50"
                    />

                    {/* Type Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded ${EVIDENCE_TYPE_COLORS[evidence.type]}`}>
                      {EVIDENCE_TYPE_LABELS[evidence.type]}
                    </span>

                    {/* Date */}
                    <span className="text-sm text-gray-400">{evidence.date}</span>

                    {/* Title */}
                    <span className="flex-1 text-white font-medium truncate">{evidence.title}</span>

                    {/* URL Indicator */}
                    {evidence.url && (
                      <span className="text-xs text-blue-400">Has link</span>
                    )}

                    {/* Expand Icon */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedEvidence === evidence.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedEvidence === evidence.id && (
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Title */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          value={evidence.title}
                          onChange={(e) => handleUpdateEvidence(evidence.id, { title: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>

                      {/* Type */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select
                          value={evidence.type}
                          onChange={(e) => handleUpdateEvidence(evidence.id, { type: e.target.value as SupportingEvidence['type'] })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          {EVIDENCE_TYPE_OPTIONS.map(type => (
                            <option key={type} value={type}>{EVIDENCE_TYPE_LABELS[type]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date</label>
                        <input
                          type="date"
                          value={evidence.date}
                          onChange={(e) => handleUpdateEvidence(evidence.id, { date: e.target.value })}
                          className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={evidence.description}
                        onChange={(e) => handleUpdateEvidence(evidence.id, { description: e.target.value })}
                        rows={2}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        placeholder="Describe the evidence..."
                      />
                    </div>

                    {/* URL */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">URL (optional)</label>
                      <input
                        type="url"
                        value={evidence.url || ''}
                        onChange={(e) => handleUpdateEvidence(evidence.id, { url: e.target.value || undefined })}
                        className="w-full px-2 py-1.5 bg-cscx-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        placeholder="https://..."
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveEvidence(evidence.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Remove Evidence
                      </button>
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

export default CADGEscalationReportPreview;
