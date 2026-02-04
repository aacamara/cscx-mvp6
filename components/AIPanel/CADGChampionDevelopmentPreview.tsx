/**
 * CADGChampionDevelopmentPreview - Editable champion development preview for CADG-generated plans
 * Allows users to review, edit, and approve champion candidates, activities, rewards, and timeline before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ChampionCandidate {
  id: string;
  name: string;
  role: string;
  email: string;
  engagementScore: number;
  npsScore: number;
  potentialLevel: 'high' | 'medium' | 'low';
  strengths: string[];
  developmentAreas: string[];
  selected: boolean;
}

export interface DevelopmentActivity {
  id: string;
  name: string;
  description: string;
  category: 'training' | 'recognition' | 'networking' | 'contribution' | 'leadership';
  frequency: string;
  owner: string;
  enabled: boolean;
}

export interface ChampionReward {
  id: string;
  name: string;
  description: string;
  type: 'recognition' | 'access' | 'swag' | 'event' | 'certificate';
  criteria: string;
  enabled: boolean;
}

export interface ProgramMilestone {
  id: string;
  name: string;
  date: string;
  description: string;
}

export interface ProgramTimeline {
  startDate: string;
  endDate: string;
  milestones: ProgramMilestone[];
}

export interface SuccessMetric {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
}

export interface ChampionDevelopmentData {
  title: string;
  programGoal: string;
  candidates: ChampionCandidate[];
  activities: DevelopmentActivity[];
  rewards: ChampionReward[];
  timeline: ProgramTimeline;
  successMetrics: SuccessMetric[];
  notes: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGChampionDevelopmentPreviewProps {
  championDevelopment: ChampionDevelopmentData;
  customer: CustomerData;
  onSave: (championDevelopment: ChampionDevelopmentData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const POTENTIAL_OPTIONS = ['high', 'medium', 'low'] as const;
const ACTIVITY_CATEGORY_OPTIONS = ['training', 'recognition', 'networking', 'contribution', 'leadership'] as const;
const FREQUENCY_OPTIONS = ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Annually', 'Ongoing', 'As needed'];
const OWNER_OPTIONS = ['CSM', 'Customer', 'Product Team', 'Community', 'Marketing', 'Executive'];
const REWARD_TYPE_OPTIONS = ['recognition', 'access', 'swag', 'event', 'certificate'] as const;
const UNIT_OPTIONS = ['users', 'count', 'score', 'percent'];

// ============================================
// Component
// ============================================

export const CADGChampionDevelopmentPreview: React.FC<CADGChampionDevelopmentPreviewProps> = ({
  championDevelopment,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<ChampionDevelopmentData>(() => JSON.parse(JSON.stringify(championDevelopment)));

  // Editable draft state
  const [draft, setDraft] = useState<ChampionDevelopmentData>(() => JSON.parse(JSON.stringify(championDevelopment)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'activities' | 'rewards' | 'timeline' | 'metrics'>('candidates');
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(draft.candidates[0]?.id || null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [expandedReward, setExpandedReward] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to create champion development program');
    } finally {
      setIsSaving(false);
    }
  };

  // Update basic fields
  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  const updateProgramGoal = (value: string) => {
    setDraft(prev => ({ ...prev, programGoal: value }));
  };

  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Champion Candidates Operations
  // ============================================

  const toggleCandidateSelected = (candidateId: string) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId ? { ...c, selected: !c.selected } : c
      ),
    }));
  };

  const updateCandidate = (candidateId: string, field: keyof ChampionCandidate, value: any) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId ? { ...c, [field]: value } : c
      ),
    }));
  };

  const addCandidate = () => {
    const newCandidateId = `candidate-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      candidates: [
        ...prev.candidates,
        {
          id: newCandidateId,
          name: '',
          role: '',
          email: '',
          engagementScore: 75,
          npsScore: 7,
          potentialLevel: 'medium',
          strengths: [],
          developmentAreas: [],
          selected: true,
        },
      ],
    }));
    setExpandedCandidate(newCandidateId);
  };

  const removeCandidate = (candidateId: string) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.filter(c => c.id !== candidateId),
    }));
    if (expandedCandidate === candidateId) {
      setExpandedCandidate(null);
    }
  };

  const addStrength = (candidateId: string) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId ? { ...c, strengths: [...c.strengths, ''] } : c
      ),
    }));
  };

  const updateStrength = (candidateId: string, index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId
          ? { ...c, strengths: c.strengths.map((s, i) => i === index ? value : s) }
          : c
      ),
    }));
  };

  const removeStrength = (candidateId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId
          ? { ...c, strengths: c.strengths.filter((_, i) => i !== index) }
          : c
      ),
    }));
  };

  const addDevelopmentArea = (candidateId: string) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId ? { ...c, developmentAreas: [...c.developmentAreas, ''] } : c
      ),
    }));
  };

  const updateDevelopmentArea = (candidateId: string, index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId
          ? { ...c, developmentAreas: c.developmentAreas.map((d, i) => i === index ? value : d) }
          : c
      ),
    }));
  };

  const removeDevelopmentArea = (candidateId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === candidateId
          ? { ...c, developmentAreas: c.developmentAreas.filter((_, i) => i !== index) }
          : c
      ),
    }));
  };

  // ============================================
  // Development Activities Operations
  // ============================================

  const toggleActivityEnabled = (activityId: string) => {
    setDraft(prev => ({
      ...prev,
      activities: prev.activities.map(a =>
        a.id === activityId ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  };

  const updateActivity = (activityId: string, field: keyof DevelopmentActivity, value: any) => {
    setDraft(prev => ({
      ...prev,
      activities: prev.activities.map(a =>
        a.id === activityId ? { ...a, [field]: value } : a
      ),
    }));
  };

  const addActivity = () => {
    const newActivityId = `activity-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      activities: [
        ...prev.activities,
        {
          id: newActivityId,
          name: '',
          description: '',
          category: 'training',
          frequency: 'Monthly',
          owner: 'CSM',
          enabled: true,
        },
      ],
    }));
    setExpandedActivity(newActivityId);
  };

  const removeActivity = (activityId: string) => {
    setDraft(prev => ({
      ...prev,
      activities: prev.activities.filter(a => a.id !== activityId),
    }));
    if (expandedActivity === activityId) {
      setExpandedActivity(null);
    }
  };

  // ============================================
  // Rewards Operations
  // ============================================

  const toggleRewardEnabled = (rewardId: string) => {
    setDraft(prev => ({
      ...prev,
      rewards: prev.rewards.map(r =>
        r.id === rewardId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  };

  const updateReward = (rewardId: string, field: keyof ChampionReward, value: any) => {
    setDraft(prev => ({
      ...prev,
      rewards: prev.rewards.map(r =>
        r.id === rewardId ? { ...r, [field]: value } : r
      ),
    }));
  };

  const addReward = () => {
    const newRewardId = `reward-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      rewards: [
        ...prev.rewards,
        {
          id: newRewardId,
          name: '',
          description: '',
          type: 'recognition',
          criteria: '',
          enabled: true,
        },
      ],
    }));
    setExpandedReward(newRewardId);
  };

  const removeReward = (rewardId: string) => {
    setDraft(prev => ({
      ...prev,
      rewards: prev.rewards.filter(r => r.id !== rewardId),
    }));
    if (expandedReward === rewardId) {
      setExpandedReward(null);
    }
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

  const updateMilestone = (milestoneId: string, field: keyof ProgramMilestone, value: any) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        milestones: prev.timeline.milestones.map(m =>
          m.id === milestoneId ? { ...m, [field]: value } : m
        ),
      },
    }));
  };

  const addMilestone = () => {
    const lastMilestone = draft.timeline.milestones[draft.timeline.milestones.length - 1];
    let newDate = draft.timeline.startDate;
    if (lastMilestone) {
      const date = new Date(lastMilestone.date);
      date.setDate(date.getDate() + 14);
      newDate = date.toISOString().split('T')[0];
    }

    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        milestones: [
          ...prev.timeline.milestones,
          {
            id: `milestone-${Date.now()}`,
            name: '',
            date: newDate,
            description: '',
          },
        ],
      },
    }));
  };

  const removeMilestone = (milestoneId: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        milestones: prev.timeline.milestones.filter(m => m.id !== milestoneId),
      },
    }));
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
          unit: 'count',
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
  const inputClass = 'w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50';
  const smallInputClass = 'bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50';

  // Get potential level badge style
  const getPotentialStyle = (potential: 'high' | 'medium' | 'low') => {
    switch (potential) {
      case 'high':
        return 'bg-green-900/30 text-green-400 border-green-600/30';
      case 'medium':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-600/30';
      case 'low':
        return 'bg-red-900/30 text-red-400 border-red-600/30';
    }
  };

  // Get category icon
  const getCategoryIcon = (category: DevelopmentActivity['category']) => {
    switch (category) {
      case 'training': return '📚';
      case 'recognition': return '🏆';
      case 'networking': return '🤝';
      case 'contribution': return '✍️';
      case 'leadership': return '👑';
    }
  };

  // Get reward type icon
  const getRewardTypeIcon = (type: ChampionReward['type']) => {
    switch (type) {
      case 'recognition': return '⭐';
      case 'access': return '🔑';
      case 'swag': return '🎁';
      case 'event': return '🎟️';
      case 'certificate': return '📜';
    }
  };

  // Count selected/enabled items
  const selectedCandidatesCount = draft.candidates.filter(c => c.selected).length;
  const enabledActivitiesCount = draft.activities.filter(a => a.enabled).length;
  const enabledRewardsCount = draft.rewards.filter(r => r.enabled).length;

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10 bg-cscx-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h3 className="text-white font-semibold">Champion Development Preview</h3>
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
        {/* Program Details Section */}
        <div>
          <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
            Program Details
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Program Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateTitle(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="Champion development program title..."
              />
            </div>
            <div>
              <label className="text-xs text-cscx-gray-400 block mb-1">Program Goal</label>
              <textarea
                value={draft.programGoal}
                onChange={(e) => updateProgramGoal(e.target.value)}
                disabled={isSaving}
                className={inputClass + ' min-h-[60px]'}
                placeholder="Describe the primary goal of this program..."
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-cscx-gray-700">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { key: 'candidates' as const, label: 'Champions', count: selectedCandidatesCount },
              { key: 'activities' as const, label: 'Activities', count: enabledActivitiesCount },
              { key: 'rewards' as const, label: 'Rewards', count: enabledRewardsCount },
              { key: 'timeline' as const, label: 'Timeline', count: draft.timeline.milestones.length },
              { key: 'metrics' as const, label: 'Metrics', count: draft.successMetrics.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-amber-500 text-amber-400'
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

        {/* Tab Content: Candidates */}
        {activeTab === 'candidates' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Champion Candidates
              </h4>
              <button
                onClick={addCandidate}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Candidate
              </button>
            </div>

            <div className="space-y-2">
              {draft.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`bg-cscx-gray-900/30 border rounded-lg overflow-hidden ${
                    candidate.selected ? 'border-cscx-gray-700' : 'border-cscx-gray-700/50 opacity-50'
                  }`}
                >
                  {/* Candidate header */}
                  <button
                    onClick={() => setExpandedCandidate(expandedCandidate === candidate.id ? null : candidate.id)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-cscx-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCandidateSelected(candidate.id);
                        }}
                        disabled={isSaving}
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          candidate.selected
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'border-cscx-gray-600'
                        }`}
                      >
                        {candidate.selected && '✓'}
                      </button>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">
                            {candidate.name || 'New Champion'}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getPotentialStyle(candidate.potentialLevel)}`}>
                            {candidate.potentialLevel.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-cscx-gray-500">{candidate.role || 'No role'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-cscx-gray-400">
                          Engagement: <span className="text-amber-400">{candidate.engagementScore}%</span>
                        </div>
                        <div className="text-xs text-cscx-gray-400">
                          NPS: <span className="text-amber-400">{candidate.npsScore}</span>
                        </div>
                      </div>
                      <span className="text-cscx-gray-500">
                        {expandedCandidate === candidate.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Candidate details */}
                  {expandedCandidate === candidate.id && (
                    <div className="border-t border-cscx-gray-700 p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Name</label>
                          <input
                            type="text"
                            value={candidate.name}
                            onChange={(e) => updateCandidate(candidate.id, 'name', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="Full name"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Role</label>
                          <input
                            type="text"
                            value={candidate.role}
                            onChange={(e) => updateCandidate(candidate.id, 'role', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="Job title"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Email</label>
                          <input
                            type="email"
                            value={candidate.email}
                            onChange={(e) => updateCandidate(candidate.id, 'email', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="email@example.com"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Engagement Score</label>
                          <input
                            type="number"
                            value={candidate.engagementScore}
                            onChange={(e) => updateCandidate(candidate.id, 'engagementScore', parseInt(e.target.value) || 0)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            min={0}
                            max={100}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">NPS Score</label>
                          <input
                            type="number"
                            value={candidate.npsScore}
                            onChange={(e) => updateCandidate(candidate.id, 'npsScore', parseInt(e.target.value) || 0)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            min={0}
                            max={10}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Potential Level</label>
                          <select
                            value={candidate.potentialLevel}
                            onChange={(e) => updateCandidate(candidate.id, 'potentialLevel', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {POTENTIAL_OPTIONS.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Strengths */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-cscx-gray-400">Strengths</label>
                          <button
                            onClick={() => addStrength(candidate.id)}
                            disabled={isSaving}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-1">
                          {candidate.strengths.map((strength, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-green-500 text-xs">+</span>
                              <input
                                type="text"
                                value={strength}
                                onChange={(e) => updateStrength(candidate.id, idx, e.target.value)}
                                disabled={isSaving}
                                className={smallInputClass + ' flex-1'}
                                placeholder="Strength..."
                              />
                              <button
                                onClick={() => removeStrength(candidate.id, idx)}
                                disabled={isSaving}
                                className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {candidate.strengths.length === 0 && (
                            <p className="text-xs text-cscx-gray-500 italic">No strengths listed</p>
                          )}
                        </div>
                      </div>

                      {/* Development Areas */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-cscx-gray-400">Development Areas</label>
                          <button
                            onClick={() => addDevelopmentArea(candidate.id)}
                            disabled={isSaving}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-1">
                          {candidate.developmentAreas.map((area, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-blue-500 text-xs">→</span>
                              <input
                                type="text"
                                value={area}
                                onChange={(e) => updateDevelopmentArea(candidate.id, idx, e.target.value)}
                                disabled={isSaving}
                                className={smallInputClass + ' flex-1'}
                                placeholder="Development area..."
                              />
                              <button
                                onClick={() => removeDevelopmentArea(candidate.id, idx)}
                                disabled={isSaving}
                                className="p-1 text-cscx-gray-500 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {candidate.developmentAreas.length === 0 && (
                            <p className="text-xs text-cscx-gray-500 italic">No development areas listed</p>
                          )}
                        </div>
                      </div>

                      {/* Remove candidate button */}
                      <div className="flex justify-end pt-2 border-t border-cscx-gray-700/50">
                        <button
                          onClick={() => removeCandidate(candidate.id)}
                          disabled={isSaving}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove Candidate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Activities */}
        {activeTab === 'activities' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Development Activities
              </h4>
              <button
                onClick={addActivity}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Activity
              </button>
            </div>

            <div className="space-y-2">
              {draft.activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`bg-cscx-gray-900/30 border rounded-lg overflow-hidden ${
                    activity.enabled ? 'border-cscx-gray-700' : 'border-cscx-gray-700/50 opacity-50'
                  }`}
                >
                  {/* Activity header */}
                  <button
                    onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-cscx-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActivityEnabled(activity.id);
                        }}
                        disabled={isSaving}
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          activity.enabled
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'border-cscx-gray-600'
                        }`}
                      >
                        {activity.enabled && '✓'}
                      </button>
                      <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                      <div className="text-left">
                        <span className="text-white text-sm font-medium">
                          {activity.name || 'New Activity'}
                        </span>
                        <div className="text-xs text-cscx-gray-500 capitalize">{activity.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cscx-gray-400">{activity.frequency}</span>
                      <span className="text-cscx-gray-500">
                        {expandedActivity === activity.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Activity details */}
                  {expandedActivity === activity.id && (
                    <div className="border-t border-cscx-gray-700 p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs text-cscx-gray-400 block mb-1">Activity Name</label>
                          <input
                            type="text"
                            value={activity.name}
                            onChange={(e) => updateActivity(activity.id, 'name', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="Activity name..."
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-cscx-gray-400 block mb-1">Description</label>
                          <textarea
                            value={activity.description}
                            onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full min-h-[60px]'}
                            placeholder="What this activity involves..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Category</label>
                          <select
                            value={activity.category}
                            onChange={(e) => updateActivity(activity.id, 'category', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {ACTIVITY_CATEGORY_OPTIONS.map(c => (
                              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Frequency</label>
                          <select
                            value={activity.frequency}
                            onChange={(e) => updateActivity(activity.id, 'frequency', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {FREQUENCY_OPTIONS.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Owner</label>
                          <select
                            value={activity.owner}
                            onChange={(e) => updateActivity(activity.id, 'owner', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {OWNER_OPTIONS.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Remove activity button */}
                      <div className="flex justify-end pt-2 border-t border-cscx-gray-700/50">
                        <button
                          onClick={() => removeActivity(activity.id)}
                          disabled={isSaving}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove Activity
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Rewards */}
        {activeTab === 'rewards' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Recognition & Rewards
              </h4>
              <button
                onClick={addReward}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Reward
              </button>
            </div>

            <div className="space-y-2">
              {draft.rewards.map((reward) => (
                <div
                  key={reward.id}
                  className={`bg-cscx-gray-900/30 border rounded-lg overflow-hidden ${
                    reward.enabled ? 'border-cscx-gray-700' : 'border-cscx-gray-700/50 opacity-50'
                  }`}
                >
                  {/* Reward header */}
                  <button
                    onClick={() => setExpandedReward(expandedReward === reward.id ? null : reward.id)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-cscx-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRewardEnabled(reward.id);
                        }}
                        disabled={isSaving}
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          reward.enabled
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'border-cscx-gray-600'
                        }`}
                      >
                        {reward.enabled && '✓'}
                      </button>
                      <span className="text-lg">{getRewardTypeIcon(reward.type)}</span>
                      <div className="text-left">
                        <span className="text-white text-sm font-medium">
                          {reward.name || 'New Reward'}
                        </span>
                        <div className="text-xs text-cscx-gray-500 capitalize">{reward.type}</div>
                      </div>
                    </div>
                    <span className="text-cscx-gray-500">
                      {expandedReward === reward.id ? '▼' : '▶'}
                    </span>
                  </button>

                  {/* Reward details */}
                  {expandedReward === reward.id && (
                    <div className="border-t border-cscx-gray-700 p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Reward Name</label>
                          <input
                            type="text"
                            value={reward.name}
                            onChange={(e) => updateReward(reward.id, 'name', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="Reward name..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-cscx-gray-400 block mb-1">Type</label>
                          <select
                            value={reward.type}
                            onChange={(e) => updateReward(reward.id, 'type', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                          >
                            {REWARD_TYPE_OPTIONS.map(t => (
                              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-cscx-gray-400 block mb-1">Description</label>
                          <textarea
                            value={reward.description}
                            onChange={(e) => updateReward(reward.id, 'description', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full min-h-[60px]'}
                            placeholder="What the champion receives..."
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-cscx-gray-400 block mb-1">Earning Criteria</label>
                          <input
                            type="text"
                            value={reward.criteria}
                            onChange={(e) => updateReward(reward.id, 'criteria', e.target.value)}
                            disabled={isSaving}
                            className={smallInputClass + ' w-full'}
                            placeholder="How to earn this reward..."
                          />
                        </div>
                      </div>

                      {/* Remove reward button */}
                      <div className="flex justify-end pt-2 border-t border-cscx-gray-700/50">
                        <button
                          onClick={() => removeReward(reward.id)}
                          disabled={isSaving}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove Reward
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Timeline */}
        {activeTab === 'timeline' && (
          <div>
            {/* Program Date Range */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">
                Program Duration
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

            {/* Milestones */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                Program Milestones
              </h4>
              <button
                onClick={addMilestone}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
              >
                + Add Milestone
              </button>
            </div>

            <div className="space-y-2">
              {draft.timeline.milestones.map((milestone, idx) => (
                <div
                  key={milestone.id}
                  className="bg-cscx-gray-900/30 border border-cscx-gray-700 rounded-lg p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-green-900/50 text-green-400' :
                      idx === draft.timeline.milestones.length - 1 ? 'bg-purple-900/50 text-purple-400' :
                      'bg-amber-900/50 text-amber-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs text-cscx-gray-400 block mb-1">Milestone Name</label>
                        <input
                          type="text"
                          value={milestone.name}
                          onChange={(e) => updateMilestone(milestone.id, 'name', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          placeholder="Milestone name..."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-cscx-gray-400 block mb-1">Date</label>
                        <input
                          type="date"
                          value={milestone.date}
                          onChange={(e) => updateMilestone(milestone.id, 'date', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-cscx-gray-400 block mb-1">Description</label>
                        <input
                          type="text"
                          value={milestone.description}
                          onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                          disabled={isSaving}
                          className={smallInputClass + ' w-full'}
                          placeholder="What happens at this milestone..."
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() => removeMilestone(milestone.id)}
                          disabled={isSaving || draft.timeline.milestones.length <= 1}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
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
                className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
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
                        className="h-full bg-amber-600"
                        style={{ width: `${metric.target > 0 ? Math.min(100, (metric.current / metric.target) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-cscx-gray-500 mt-1">
                      <span>{metric.current} {metric.unit}</span>
                      <span className="text-amber-400">
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
            placeholder="Additional notes about this champion program..."
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
            {selectedCandidatesCount} champions, {enabledActivitiesCount} activities, {enabledRewardsCount} rewards
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
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Creating...
                </>
              ) : (
                <>
                  <span>🏆</span>
                  Create Champion Program
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
