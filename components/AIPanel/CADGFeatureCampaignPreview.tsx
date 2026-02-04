/**
 * CADGFeatureCampaignPreview - Editable feature campaign preview for CADG-generated plans
 * Allows users to review, edit, and approve target features, user segments, messaging, and timeline before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface TargetFeature {
  id: string;
  name: string;
  currentAdoption: number;
  targetAdoption: number;
  priority: 'high' | 'medium' | 'low';
  included: boolean;
}

export interface UserSegment {
  id: string;
  name: string;
  size: number;
  currentUsage: number;
  potential: 'high' | 'medium' | 'low';
  included: boolean;
}

export interface CampaignPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  activities: string[];
}

export interface CampaignTimeline {
  startDate: string;
  endDate: string;
  phases: CampaignPhase[];
}

export interface CampaignMessage {
  id: string;
  channel: 'email' | 'in-app' | 'webinar' | 'training' | 'slack' | 'other';
  subject: string;
  content: string;
  timing: string;
  segment: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
}

export interface FeatureCampaignData {
  title: string;
  campaignGoal: string;
  targetFeatures: TargetFeature[];
  userSegments: UserSegment[];
  timeline: CampaignTimeline;
  messaging: CampaignMessage[];
  successMetrics: SuccessMetric[];
  notes: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGFeatureCampaignPreviewProps {
  featureCampaign: FeatureCampaignData;
  customer: CustomerData;
  onSave: (featureCampaign: FeatureCampaignData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;
const POTENTIAL_OPTIONS = ['high', 'medium', 'low'] as const;
const CHANNEL_OPTIONS = ['email', 'in-app', 'webinar', 'training', 'slack', 'other'] as const;
const UNIT_OPTIONS = ['percent', 'users', 'sessions', 'count', 'score'];

// ============================================
// Component
// ============================================

export const CADGFeatureCampaignPreview: React.FC<CADGFeatureCampaignPreviewProps> = ({
  featureCampaign,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<FeatureCampaignData>(() => JSON.parse(JSON.stringify(featureCampaign)));

  // Editable draft state
  const [draft, setDraft] = useState<FeatureCampaignData>(() => JSON.parse(JSON.stringify(featureCampaign)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'features' | 'segments' | 'timeline' | 'messaging' | 'metrics'>('features');
  const [expandedPhase, setExpandedPhase] = useState<string | null>(draft.timeline.phases[0]?.id || null);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to create feature campaign');
    } finally {
      setIsSaving(false);
    }
  };

  // Update basic fields
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  const updateCampaignGoal = (value: string) => {
    setDraft(prev => ({ ...prev, campaignGoal: value }));
  };

  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Target Features Operations
  // ============================================

  const toggleFeatureIncluded = (featureId: string) => {
    setDraft(prev => ({
      ...prev,
      targetFeatures: prev.targetFeatures.map(f =>
        f.id === featureId ? { ...f, included: !f.included } : f
      ),
    }));
  };

  const updateFeature = (featureId: string, field: keyof TargetFeature, value: any) => {
    setDraft(prev => ({
      ...prev,
      targetFeatures: prev.targetFeatures.map(f =>
        f.id === featureId ? { ...f, [field]: value } : f
      ),
    }));
  };

  const addFeature = () => {
    setDraft(prev => ({
      ...prev,
      targetFeatures: [
        ...prev.targetFeatures,
        {
          id: `feature-${Date.now()}`,
          name: '',
          currentAdoption: 30,
          targetAdoption: 60,
          priority: 'medium',
          included: true,
        },
      ],
    }));
  };

  const removeFeature = (featureId: string) => {
    setDraft(prev => ({
      ...prev,
      targetFeatures: prev.targetFeatures.filter(f => f.id !== featureId),
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
          size: 100,
          currentUsage: 50,
          potential: 'medium',
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
  // Timeline Operations
  // ============================================

  const updateTimelineDate = (field: 'startDate' | 'endDate', value: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        [field]: value,
      },
    }));
  };

  const updatePhase = (phaseId: string, field: keyof CampaignPhase, value: any) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        phases: prev.timeline.phases.map(p =>
          p.id === phaseId ? { ...p, [field]: value } : p
        ),
      },
    }));
  };

  const addPhase = () => {
    const lastPhase = draft.timeline.phases[draft.timeline.phases.length - 1];
    const newStartDate = lastPhase?.endDate || draft.timeline.startDate;
    const startDate = new Date(newStartDate);
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    const newPhaseId = `phase-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        phases: [
          ...prev.timeline.phases,
          {
            id: newPhaseId,
            name: `Phase ${prev.timeline.phases.length + 1}`,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            activities: [],
          },
        ],
      },
    }));
    setExpandedPhase(newPhaseId);
  };

  const removePhase = (phaseId: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        phases: prev.timeline.phases.filter(p => p.id !== phaseId),
      },
    }));
    if (expandedPhase === phaseId) {
      setExpandedPhase(null);
    }
  };

  const addActivity = (phaseId: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        phases: prev.timeline.phases.map(p =>
          p.id === phaseId
            ? { ...p, activities: [...p.activities, ''] }
            : p
        ),
      },
    }));
  };

  const updateActivity = (phaseId: string, index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        phases: prev.timeline.phases.map(p =>
          p.id === phaseId
            ? { ...p, activities: p.activities.map((a, i) => i === index ? value : a) }
            : p
        ),
      },
    }));
  };

  const removeActivity = (phaseId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        phases: prev.timeline.phases.map(p =>
          p.id === phaseId
            ? { ...p, activities: p.activities.filter((_, i) => i !== index) }
            : p
        ),
      },
    }));
  };

  // ============================================
  // Messaging Operations
  // ============================================

  const updateMessage = (messageId: string, field: keyof CampaignMessage, value: any) => {
    setDraft(prev => ({
      ...prev,
      messaging: prev.messaging.map(m =>
        m.id === messageId ? { ...m, [field]: value } : m
      ),
    }));
  };

  const addMessage = () => {
    const newMessageId = `message-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      messaging: [
        ...prev.messaging,
        {
          id: newMessageId,
          channel: 'email',
          subject: '',
          content: '',
          timing: '',
          segment: 'All Users',
        },
      ],
    }));
    setExpandedMessage(newMessageId);
  };

  const removeMessage = (messageId: string) => {
    setDraft(prev => ({
      ...prev,
      messaging: prev.messaging.filter(m => m.id !== messageId),
    }));
    if (expandedMessage === messageId) {
      setExpandedMessage(null);
    }
  };

  const moveMessage = (messageId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const index = prev.messaging.findIndex(m => m.id === messageId);
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === prev.messaging.length - 1)
      ) {
        return prev;
      }

      const newMessages = [...prev.messaging];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newMessages[index], newMessages[swapIndex]] = [newMessages[swapIndex], newMessages[index]];

      return { ...prev, messaging: newMessages };
    });
  };

  // ============================================
  // Success Metrics Operations
  // ============================================

  const updateMetric = (metricId: string, field: keyof SuccessMetric, value: any) => {
    setDraft(prev => ({
      ...prev,
      successMetrics: prev.successMetrics.map(m =>
        m.id === metricId ? { ...m, [field]: value } : m
      ),
    }));
  };

  const addMetric = () => {
    setDraft(prev => ({
      ...prev,
      successMetrics: [
        ...prev.successMetrics,
        {
          id: `metric-${Date.now()}`,
          name: '',
          current: 0,
          target: 50,
          unit: 'percent',
        },
      ],
    }));
  };

  const removeMetric = (metricId: string) => {
    setDraft(prev => ({
      ...prev,
      successMetrics: prev.successMetrics.filter(m => m.id !== metricId),
    }));
  };

  // Base input class
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-rose-500 disabled:opacity-50';

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

  // Get channel icon
  const getChannelIcon = (channel: CampaignMessage['channel']) => {
    switch (channel) {
      case 'email': return '📧';
      case 'in-app': return '💻';
      case 'webinar': return '🎥';
      case 'training': return '📚';
      case 'slack': return '💬';
      case 'other': return '📝';
    }
  };

  // Count included items
  const includedFeaturesCount = draft.targetFeatures.filter(f => f.included).length;
  const includedSegmentsCount = draft.userSegments.filter(s => s.included).length;

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              <h3 className="text-white font-semibold">Feature Campaign Preview</h3>
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
        {/* Campaign Details Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Campaign Details
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Campaign Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateTitle(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="Feature adoption campaign title..."
              />
            </div>
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Campaign Goal</label>
              <textarea
                value={draft.campaignGoal}
                onChange={(e) => updateCampaignGoal(e.target.value)}
                disabled={isSaving}
                className={inputClass + ' min-h-[60px]'}
                placeholder="Describe the primary goal of this campaign..."
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-cscx-gray-700">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { key: 'features' as const, label: 'Features', count: includedFeaturesCount },
              { key: 'segments' as const, label: 'Segments', count: includedSegmentsCount },
              { key: 'timeline' as const, label: 'Timeline', count: draft.timeline.phases.length },
              { key: 'messaging' as const, label: 'Messaging', count: draft.messaging.length },
              { key: 'metrics' as const, label: 'Metrics', count: draft.successMetrics.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-rose-500 text-rose-400'
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

        {/* Tab Content: Features */}
        {activeTab === 'features' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Target Features
              </h4>
              <button
                onClick={addFeature}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Feature
              </button>
            </div>

            <div className="space-y-2">
              {draft.targetFeatures.map((feature) => (
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
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'border-cscx-gray-600'
                      }`}
                    >
                      {feature.included && '✓'}
                    </button>
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={feature.name}
                          onChange={(e) => updateFeature(feature.id, 'name', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          placeholder="Feature name..."
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={feature.currentAdoption}
                            onChange={(e) => updateFeature(feature.id, 'currentAdoption', parseInt(e.target.value) || 0)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-16'}
                            min={0}
                            max={100}
                          />
                          <span className="text-xs text-cscx-gray-500">%</span>
                        </div>
                        <div className="text-xs text-cscx-gray-500 mt-0.5">Current</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={feature.targetAdoption}
                            onChange={(e) => updateFeature(feature.id, 'targetAdoption', parseInt(e.target.value) || 0)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-16'}
                            min={0}
                            max={100}
                          />
                          <span className="text-xs text-cscx-gray-500">%</span>
                        </div>
                        <div className="text-xs text-cscx-gray-500 mt-0.5">Target</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={feature.priority}
                          onChange={(e) => updateFeature(feature.id, 'priority', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ` ${getPriorityStyle(feature.priority)}`}
                        >
                          {PRIORITY_OPTIONS.map(p => (
                            <option key={p} value={p}>{p.toUpperCase()}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeFeature(feature.id)}
                          disabled={isSaving}
                          className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Adoption progress bar */}
                  <div className="mt-2 ml-7">
                    <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-rose-600"
                          style={{ width: `${feature.currentAdoption}%` }}
                        />
                        <div
                          className="bg-rose-600/30"
                          style={{ width: `${Math.max(0, feature.targetAdoption - feature.currentAdoption)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-cscx-gray-500 mt-1">
                      <span>0%</span>
                      <span className="text-rose-400">{feature.targetAdoption - feature.currentAdoption > 0 ? `+${feature.targetAdoption - feature.currentAdoption}%` : '0%'} goal</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Segments */}
        {activeTab === 'segments' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Target User Segments
              </h4>
              <button
                onClick={addSegment}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-400 rounded-lg transition-colors disabled:opacity-50"
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
                          ? 'bg-rose-600 border-rose-600 text-white'
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
                          value={segment.size}
                          onChange={(e) => updateSegment(segment.id, 'size', parseInt(e.target.value) || 0)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          min={0}
                        />
                        <div className="text-xs text-cscx-gray-500 mt-0.5">Users</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={segment.currentUsage}
                            onChange={(e) => updateSegment(segment.id, 'currentUsage', parseInt(e.target.value) || 0)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-16'}
                            min={0}
                            max={100}
                          />
                          <span className="text-xs text-cscx-gray-500">%</span>
                        </div>
                        <div className="text-xs text-cscx-gray-500 mt-0.5">Usage</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={segment.potential}
                          onChange={(e) => updateSegment(segment.id, 'potential', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ` ${getPriorityStyle(segment.potential)}`}
                        >
                          {POTENTIAL_OPTIONS.map(p => (
                            <option key={p} value={p}>{p.toUpperCase()}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeSegment(segment.id)}
                          disabled={isSaving}
                          className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Timeline */}
        {activeTab === 'timeline' && (
          <div>
            {/* Campaign Date Range */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">
                Campaign Duration
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-cscx-gray-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={draft.timeline.startDate}
                    onChange={(e) => updateTimelineDate('startDate', e.target.value)}
                    disabled={isSaving}
                    className={smallInputClass + ' w-full'}
                  />
                </div>
                <div>
                  <label className="text-xs text-cscx-gray-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={draft.timeline.endDate}
                    onChange={(e) => updateTimelineDate('endDate', e.target.value)}
                    disabled={isSaving}
                    className={smallInputClass + ' w-full'}
                  />
                </div>
              </div>
            </div>

            {/* Phases */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Campaign Phases
              </h4>
              <button
                onClick={addPhase}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Phase
              </button>
            </div>

            <div className="space-y-2">
              {draft.timeline.phases.map((phase, phaseIndex) => (
                <div
                  key={phase.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Phase header */}
                  <button
                    onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-cscx-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        phaseIndex === 0 ? 'bg-green-900/50 text-green-400' :
                        phaseIndex === 1 ? 'bg-blue-900/50 text-blue-400' :
                        'bg-purple-900/50 text-purple-400'
                      }`}>
                        {phaseIndex + 1}
                      </span>
                      <span className="text-white text-sm font-medium">{phase.name}</span>
                      <span className="text-xs text-cscx-gray-500">
                        {phase.startDate} → {phase.endDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cscx-gray-500">
                        {phase.activities.length} activities
                      </span>
                      <span className="text-cscx-gray-500">
                        {expandedPhase === phase.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Phase details */}
                  {expandedPhase === phase.id && (
                    <div className="border-t border-cscx-gray-700 p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Phase Name</label>
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Start</label>
                          <input
                            type="date"
                            value={phase.startDate}
                            onChange={(e) => updatePhase(phase.id, 'startDate', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">End</label>
                          <input
                            type="date"
                            value={phase.endDate}
                            onChange={(e) => updatePhase(phase.id, 'endDate', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          />
                        </div>
                      </div>

                      {/* Activities */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-cscx-gray-400">Activities</label>
                          <button
                            onClick={() => addActivity(phase.id)}
                            disabled={isSaving}
                            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                          >
                            + Add Activity
                          </button>
                        </div>
                        <div className="space-y-2">
                          {phase.activities.map((activity, actIndex) => (
                            <div key={actIndex} className="flex items-center gap-2">
                              <span className="text-cscx-gray-500 text-xs">•</span>
                              <input
                                type="text"
                                value={activity}
                                onChange={(e) => updateActivity(phase.id, actIndex, e.target.value)}
                                disabled={isSaving}
                                className={smallInputClass + ' flex-1'}
                                placeholder="Activity description..."
                              />
                              <button
                                onClick={() => removeActivity(phase.id, actIndex)}
                                disabled={isSaving}
                                className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {phase.activities.length === 0 && (
                            <p className="text-xs text-cscx-gray-500 italic">No activities yet</p>
                          )}
                        </div>
                      </div>

                      {/* Remove phase button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => removePhase(phase.id)}
                          disabled={isSaving || draft.timeline.phases.length <= 1}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          Remove Phase
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Messaging */}
        {activeTab === 'messaging' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Messaging Templates
              </h4>
              <button
                onClick={addMessage}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Message
              </button>
            </div>

            <div className="space-y-2">
              {draft.messaging.map((message, msgIndex) => (
                <div
                  key={message.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Message header */}
                  <button
                    onClick={() => setExpandedMessage(expandedMessage === message.id ? null : message.id)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-cscx-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getChannelIcon(message.channel)}</span>
                      <span className="text-white text-sm font-medium capitalize">{message.channel}</span>
                      <span className="text-xs text-cscx-gray-500">•</span>
                      <span className="text-xs text-cscx-gray-400 truncate max-w-[200px]">
                        {message.subject || 'Untitled message'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cscx-gray-500">{message.timing}</span>
                      <span className="text-cscx-gray-500">
                        {expandedMessage === message.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Message details */}
                  {expandedMessage === message.id && (
                    <div className="border-t border-cscx-gray-700 p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Channel</label>
                          <select
                            value={message.channel}
                            onChange={(e) => updateMessage(message.id, 'channel', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {CHANNEL_OPTIONS.map(c => (
                              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Timing</label>
                          <input
                            type="text"
                            value={message.timing}
                            onChange={(e) => updateMessage(message.id, 'timing', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="e.g., Week 1, Day 3"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Target Segment</label>
                          <input
                            type="text"
                            value={message.segment}
                            onChange={(e) => updateMessage(message.id, 'segment', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="e.g., All Users"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-1">Subject/Title</label>
                        <input
                          type="text"
                          value={message.subject}
                          onChange={(e) => updateMessage(message.id, 'subject', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          placeholder="Message subject..."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-1">Content</label>
                        <textarea
                          value={message.content}
                          onChange={(e) => updateMessage(message.id, 'content', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full min-h-[100px]'}
                          placeholder="Message content or script..."
                        />
                      </div>

                      {/* Message actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-cscx-gray-700/50">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => moveMessage(message.id, 'up')}
                            disabled={isSaving || msgIndex === 0}
                            className="p-1 text-cscx-gray-500 hover:text-white transition-colors disabled:opacity-50"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveMessage(message.id, 'down')}
                            disabled={isSaving || msgIndex === draft.messaging.length - 1}
                            className="p-1 text-cscx-gray-500 hover:text-white transition-colors disabled:opacity-50"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          onClick={() => removeMessage(message.id)}
                          disabled={isSaving}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove Message
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Metrics */}
        {activeTab === 'metrics' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Success Metrics
              </h4>
              <button
                onClick={addMetric}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Metric
              </button>
            </div>

            <div className="space-y-2">
              {draft.successMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-3"
                >
                  <div className="grid grid-cols-5 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="text-xs text-cscx-gray-400 block mb-1">Metric Name</label>
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
                      <label className="text-xs text-cscx-gray-400 block mb-1">Current</label>
                      <input
                        type="number"
                        value={metric.current}
                        onChange={(e) => updateMetric(metric.id, 'current', parseFloat(e.target.value) || 0)}
                        disabled={isSaving}
                        className={smallInputClass + ' w-full'}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-cscx-gray-400 block mb-1">Target</label>
                      <input
                        type="number"
                        value={metric.target}
                        onChange={(e) => updateMetric(metric.id, 'target', parseFloat(e.target.value) || 0)}
                        disabled={isSaving}
                        className={smallInputClass + ' w-full'}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-cscx-gray-400 block mb-1">Unit</label>
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
                      <button
                        onClick={() => removeMetric(metric.id)}
                        disabled={isSaving}
                        className="p-1.5 text-cscx-gray-500 hover:text-red-400 transition-colors mb-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-600"
                        style={{ width: `${metric.target > 0 ? Math.min(100, (metric.current / metric.target) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-cscx-gray-500 mt-1">
                      <span>{metric.current} {metric.unit}</span>
                      <span className="text-rose-400">
                        {metric.target > metric.current
                          ? `+${metric.target - metric.current} to goal`
                          : '✓ Goal met'}
                      </span>
                      <span>{metric.target} {metric.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">
            Notes
          </h4>
          <textarea
            value={draft.notes}
            onChange={(e) => updateNotes(e.target.value)}
            disabled={isSaving}
            className={inputClass + ' min-h-[80px]'}
            placeholder="Additional notes about this campaign..."
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-600/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-cscx-gray-700 p-4 bg-cscx-gray-800 sticky bottom-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-cscx-gray-500">
            {includedFeaturesCount} features, {includedSegmentsCount} segments, {draft.timeline.phases.length} phases
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-cscx-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Creating...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Create Campaign Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
