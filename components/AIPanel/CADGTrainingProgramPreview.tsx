/**
 * CADGTrainingProgramPreview - Editable training program preview for CADG-generated plans
 * Allows users to review, edit, and approve training modules, objectives, assessments, and timeline before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface TrainingResource {
  id: string;
  name: string;
  type: 'video' | 'document' | 'quiz' | 'hands-on' | 'webinar';
  url?: string;
}

export interface TrainingModule {
  id: string;
  name: string;
  description: string;
  duration: string;
  order: number;
  learningObjectives: string[];
  assessmentCriteria: string[];
  prerequisites: string[];
  resources: TrainingResource[];
  enabled: boolean;
}

export interface TargetAudience {
  id: string;
  name: string;
  role: string;
  currentSkillLevel: 'beginner' | 'intermediate' | 'advanced';
  targetSkillLevel: 'beginner' | 'intermediate' | 'advanced';
  included: boolean;
}

export interface CompletionCriteria {
  id: string;
  name: string;
  type: 'attendance' | 'assessment' | 'project' | 'certification';
  requiredScore?: number;
  enabled: boolean;
}

export interface ProgramTimeline {
  startDate: string;
  endDate: string;
  totalDuration: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
}

export interface TrainingProgramData {
  title: string;
  programGoal: string;
  modules: TrainingModule[];
  targetAudience: TargetAudience[];
  timeline: ProgramTimeline;
  completionCriteria: CompletionCriteria[];
  successMetrics: SuccessMetric[];
  notes: string;
}

export interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGTrainingProgramPreviewProps {
  trainingProgram: TrainingProgramData;
  customer: CustomerData;
  onSave: (trainingProgram: TrainingProgramData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const SKILL_LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced'] as const;
const RESOURCE_TYPE_OPTIONS = ['video', 'document', 'quiz', 'hands-on', 'webinar'] as const;
const CRITERIA_TYPE_OPTIONS = ['attendance', 'assessment', 'project', 'certification'] as const;
const DURATION_OPTIONS = ['30 minutes', '1 hour', '1.5 hours', '2 hours', '2.5 hours', '3 hours', '4 hours', 'Half day', 'Full day'];
const UNIT_OPTIONS = ['percent', 'count', 'score', 'hours', 'days'];

// ============================================
// Component
// ============================================

export const CADGTrainingProgramPreview: React.FC<CADGTrainingProgramPreviewProps> = ({
  trainingProgram,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<TrainingProgramData>(() => JSON.parse(JSON.stringify(trainingProgram)));

  // Editable draft state
  const [draft, setDraft] = useState<TrainingProgramData>(() => JSON.parse(JSON.stringify(trainingProgram)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'modules' | 'audience' | 'criteria' | 'timeline' | 'metrics'>('modules');
  const [expandedModule, setExpandedModule] = useState<string | null>(draft.modules[0]?.id || null);
  const [expandedAudience, setExpandedAudience] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to create training program');
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
  // Module Operations
  // ============================================

  const toggleModuleEnabled = (moduleId: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId ? { ...m, enabled: !m.enabled } : m
      ),
    }));
  };

  const updateModule = (moduleId: string, field: keyof TrainingModule, value: any) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId ? { ...m, [field]: value } : m
      ),
    }));
  };

  const addModule = () => {
    const newModuleId = `module-${Date.now()}`;
    const newOrder = draft.modules.length + 1;
    setDraft(prev => ({
      ...prev,
      modules: [
        ...prev.modules,
        {
          id: newModuleId,
          name: `Module ${newOrder}`,
          description: '',
          duration: '2 hours',
          order: newOrder,
          learningObjectives: [''],
          assessmentCriteria: [''],
          prerequisites: [],
          resources: [],
          enabled: true,
        },
      ],
    }));
    setExpandedModule(newModuleId);
  };

  const removeModule = (moduleId: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules
        .filter(m => m.id !== moduleId)
        .map((m, idx) => ({ ...m, order: idx + 1 })),
    }));
    if (expandedModule === moduleId) {
      setExpandedModule(draft.modules[0]?.id || null);
    }
  };

  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      const modules = [...prev.modules];
      const idx = modules.findIndex(m => m.id === moduleId);
      if (direction === 'up' && idx > 0) {
        [modules[idx - 1], modules[idx]] = [modules[idx], modules[idx - 1]];
      } else if (direction === 'down' && idx < modules.length - 1) {
        [modules[idx], modules[idx + 1]] = [modules[idx + 1], modules[idx]];
      }
      return {
        ...prev,
        modules: modules.map((m, i) => ({ ...m, order: i + 1 })),
      };
    });
  };

  // Learning objectives operations
  const addLearningObjective = (moduleId: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, learningObjectives: [...m.learningObjectives, ''] }
          : m
      ),
    }));
  };

  const updateLearningObjective = (moduleId: string, index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? {
              ...m,
              learningObjectives: m.learningObjectives.map((obj, i) =>
                i === index ? value : obj
              ),
            }
          : m
      ),
    }));
  };

  const removeLearningObjective = (moduleId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, learningObjectives: m.learningObjectives.filter((_, i) => i !== index) }
          : m
      ),
    }));
  };

  // Assessment criteria operations
  const addAssessmentCriteria = (moduleId: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, assessmentCriteria: [...m.assessmentCriteria, ''] }
          : m
      ),
    }));
  };

  const updateAssessmentCriteria = (moduleId: string, index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? {
              ...m,
              assessmentCriteria: m.assessmentCriteria.map((c, i) =>
                i === index ? value : c
              ),
            }
          : m
      ),
    }));
  };

  const removeAssessmentCriteria = (moduleId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, assessmentCriteria: m.assessmentCriteria.filter((_, i) => i !== index) }
          : m
      ),
    }));
  };

  // Prerequisites operations
  const addPrerequisite = (moduleId: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, prerequisites: [...m.prerequisites, ''] }
          : m
      ),
    }));
  };

  const updatePrerequisite = (moduleId: string, index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? {
              ...m,
              prerequisites: m.prerequisites.map((p, i) =>
                i === index ? value : p
              ),
            }
          : m
      ),
    }));
  };

  const removePrerequisite = (moduleId: string, index: number) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, prerequisites: m.prerequisites.filter((_, i) => i !== index) }
          : m
      ),
    }));
  };

  // Resource operations
  const addResource = (moduleId: string) => {
    const newResourceId = `resource-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? {
              ...m,
              resources: [
                ...m.resources,
                { id: newResourceId, name: '', type: 'document' as const, url: '' },
              ],
            }
          : m
      ),
    }));
  };

  const updateResource = (moduleId: string, resourceId: string, field: keyof TrainingResource, value: any) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? {
              ...m,
              resources: m.resources.map(r =>
                r.id === resourceId ? { ...r, [field]: value } : r
              ),
            }
          : m
      ),
    }));
  };

  const removeResource = (moduleId: string, resourceId: string) => {
    setDraft(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId
          ? { ...m, resources: m.resources.filter(r => r.id !== resourceId) }
          : m
      ),
    }));
  };

  // ============================================
  // Target Audience Operations
  // ============================================

  const toggleAudienceIncluded = (audienceId: string) => {
    setDraft(prev => ({
      ...prev,
      targetAudience: prev.targetAudience.map(a =>
        a.id === audienceId ? { ...a, included: !a.included } : a
      ),
    }));
  };

  const updateAudience = (audienceId: string, field: keyof TargetAudience, value: any) => {
    setDraft(prev => ({
      ...prev,
      targetAudience: prev.targetAudience.map(a =>
        a.id === audienceId ? { ...a, [field]: value } : a
      ),
    }));
  };

  const addAudience = () => {
    const newAudienceId = `audience-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      targetAudience: [
        ...prev.targetAudience,
        {
          id: newAudienceId,
          name: '',
          role: '',
          currentSkillLevel: 'beginner' as const,
          targetSkillLevel: 'intermediate' as const,
          included: true,
        },
      ],
    }));
    setExpandedAudience(newAudienceId);
  };

  const removeAudience = (audienceId: string) => {
    setDraft(prev => ({
      ...prev,
      targetAudience: prev.targetAudience.filter(a => a.id !== audienceId),
    }));
    if (expandedAudience === audienceId) {
      setExpandedAudience(null);
    }
  };

  // ============================================
  // Completion Criteria Operations
  // ============================================

  const toggleCriteriaEnabled = (criteriaId: string) => {
    setDraft(prev => ({
      ...prev,
      completionCriteria: prev.completionCriteria.map(c =>
        c.id === criteriaId ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  const updateCriteria = (criteriaId: string, field: keyof CompletionCriteria, value: any) => {
    setDraft(prev => ({
      ...prev,
      completionCriteria: prev.completionCriteria.map(c =>
        c.id === criteriaId ? { ...c, [field]: value } : c
      ),
    }));
  };

  const addCriteria = () => {
    const newCriteriaId = `criteria-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      completionCriteria: [
        ...prev.completionCriteria,
        {
          id: newCriteriaId,
          name: '',
          type: 'attendance' as const,
          requiredScore: undefined,
          enabled: true,
        },
      ],
    }));
  };

  const removeCriteria = (criteriaId: string) => {
    setDraft(prev => ({
      ...prev,
      completionCriteria: prev.completionCriteria.filter(c => c.id !== criteriaId),
    }));
  };

  // ============================================
  // Timeline Operations
  // ============================================

  const updateTimeline = (field: keyof ProgramTimeline, value: string) => {
    setDraft(prev => ({
      ...prev,
      timeline: { ...prev.timeline, [field]: value },
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
    const newMetricId = `metric-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      successMetrics: [
        ...prev.successMetrics,
        {
          id: newMetricId,
          name: '',
          current: 0,
          target: 100,
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

  // ============================================
  // Helper functions
  // ============================================

  const getResourceIcon = (type: TrainingResource['type']) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'quiz':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'hands-on':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
        );
      case 'webinar':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCriteriaIcon = (type: CompletionCriteria['type']) => {
    switch (type) {
      case 'attendance':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'assessment':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'project':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'certification':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-500/20 text-green-400';
      case 'intermediate':
        return 'bg-blue-500/20 text-blue-400';
      case 'advanced':
        return 'bg-purple-500/20 text-purple-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Count statistics
  const enabledModulesCount = draft.modules.filter(m => m.enabled).length;
  const includedAudienceCount = draft.targetAudience.filter(a => a.included).length;
  const enabledCriteriaCount = draft.completionCriteria.filter(c => c.enabled).length;

  // ============================================
  // Render
  // ============================================

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-cscx-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-violet-500/30">
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-t-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Training Program</h2>
                <p className="text-sm text-gray-400">{customer.name}</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Title editing */}
          <input
            type="text"
            value={draft.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-lg font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            placeholder="Program title..."
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 bg-cscx-gray-800/50">
          {[
            { id: 'modules', label: 'Modules', count: enabledModulesCount },
            { id: 'audience', label: 'Audience', count: includedAudienceCount },
            { id: 'criteria', label: 'Criteria', count: enabledCriteriaCount },
            { id: 'timeline', label: 'Timeline', count: null },
            { id: 'metrics', label: 'Metrics', count: draft.successMetrics.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-white/10">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Program Goal */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Program Goal</label>
            <textarea
              value={draft.programGoal}
              onChange={(e) => updateProgramGoal(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              placeholder="What is the primary learning goal?"
            />
          </div>

          {/* Modules Tab */}
          {activeTab === 'modules' && (
            <div className="space-y-4">
              {draft.modules.map((module, idx) => (
                <div
                  key={module.id}
                  className={`border rounded-lg overflow-hidden ${
                    module.enabled ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/10 bg-white/5 opacity-60'
                  }`}
                >
                  {/* Module header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                    onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={module.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleModuleEnabled(module.id);
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-white/10 text-violet-500 focus:ring-violet-500/50"
                      />
                      <span className="w-8 h-8 flex items-center justify-center bg-violet-500/20 text-violet-400 rounded-full text-sm font-medium">
                        {module.order}
                      </span>
                      <div>
                        <h4 className="font-medium text-white">{module.name || 'Untitled Module'}</h4>
                        <p className="text-sm text-gray-400">{module.duration} • {module.resources.length} resources</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveModule(module.id, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveModule(module.id, 'down');
                        }}
                        disabled={idx === draft.modules.length - 1}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeModule(module.id);
                        }}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedModule === module.id ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded module content */}
                  {expandedModule === module.id && (
                    <div className="p-4 border-t border-white/10 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Module Name</label>
                          <input
                            type="text"
                            value={module.name}
                            onChange={(e) => updateModule(module.id, 'name', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Duration</label>
                          <select
                            value={module.duration}
                            onChange={(e) => updateModule(module.id, 'duration', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          >
                            {DURATION_OPTIONS.map(d => (
                              <option key={d} value={d} className="bg-cscx-gray-800">{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <textarea
                          value={module.description}
                          onChange={(e) => updateModule(module.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                      </div>

                      {/* Learning Objectives */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Learning Objectives</label>
                          <button
                            onClick={() => addLearningObjective(module.id)}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {module.learningObjectives.map((obj, objIdx) => (
                            <div key={objIdx} className="flex items-center gap-2">
                              <span className="text-violet-400">•</span>
                              <input
                                type="text"
                                value={obj}
                                onChange={(e) => updateLearningObjective(module.id, objIdx, e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                placeholder="Learning objective..."
                              />
                              <button
                                onClick={() => removeLearningObjective(module.id, objIdx)}
                                className="p-1 text-red-400 hover:text-red-300"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assessment Criteria */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Assessment Criteria</label>
                          <button
                            onClick={() => addAssessmentCriteria(module.id)}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {module.assessmentCriteria.map((criteria, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2">
                              <span className="text-green-400">✓</span>
                              <input
                                type="text"
                                value={criteria}
                                onChange={(e) => updateAssessmentCriteria(module.id, cIdx, e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                placeholder="Assessment criteria..."
                              />
                              <button
                                onClick={() => removeAssessmentCriteria(module.id, cIdx)}
                                className="p-1 text-red-400 hover:text-red-300"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Prerequisites */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Prerequisites</label>
                          <button
                            onClick={() => addPrerequisite(module.id)}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {module.prerequisites.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No prerequisites</p>
                          ) : (
                            module.prerequisites.map((prereq, pIdx) => (
                              <div key={pIdx} className="flex items-center gap-2">
                                <span className="text-yellow-400">→</span>
                                <input
                                  type="text"
                                  value={prereq}
                                  onChange={(e) => updatePrerequisite(module.id, pIdx, e.target.value)}
                                  className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                  placeholder="Prerequisite module..."
                                />
                                <button
                                  onClick={() => removePrerequisite(module.id, pIdx)}
                                  className="p-1 text-red-400 hover:text-red-300"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Resources */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Resources</label>
                          <button
                            onClick={() => addResource(module.id)}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {module.resources.map((resource) => (
                            <div key={resource.id} className="flex items-center gap-2 bg-white/5 rounded p-2">
                              <span className="text-violet-400">
                                {getResourceIcon(resource.type)}
                              </span>
                              <input
                                type="text"
                                value={resource.name}
                                onChange={(e) => updateResource(module.id, resource.id, 'name', e.target.value)}
                                className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none"
                                placeholder="Resource name..."
                              />
                              <select
                                value={resource.type}
                                onChange={(e) => updateResource(module.id, resource.id, 'type', e.target.value)}
                                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none"
                              >
                                {RESOURCE_TYPE_OPTIONS.map(t => (
                                  <option key={t} value={t} className="bg-cscx-gray-800">{t}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeResource(module.id, resource.id)}
                                className="p-1 text-red-400 hover:text-red-300"
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
              ))}

              {/* Add module button */}
              <button
                onClick={addModule}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
              >
                + Add Module
              </button>
            </div>
          )}

          {/* Audience Tab */}
          {activeTab === 'audience' && (
            <div className="space-y-4">
              {draft.targetAudience.map((audience) => (
                <div
                  key={audience.id}
                  className={`border rounded-lg p-4 ${
                    audience.included ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/10 bg-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={audience.included}
                        onChange={() => toggleAudienceIncluded(audience.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-white/10 text-violet-500 focus:ring-violet-500/50"
                      />
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSkillLevelColor(audience.currentSkillLevel)}`}>
                          {audience.currentSkillLevel}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSkillLevelColor(audience.targetSkillLevel)}`}>
                          {audience.targetSkillLevel}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAudience(audience.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Audience Name</label>
                      <input
                        type="text"
                        value={audience.name}
                        onChange={(e) => updateAudience(audience.id, 'name', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="e.g., End Users"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Role</label>
                      <input
                        type="text"
                        value={audience.role}
                        onChange={(e) => updateAudience(audience.id, 'role', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="e.g., Daily platform users"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Current Skill Level</label>
                      <select
                        value={audience.currentSkillLevel}
                        onChange={(e) => updateAudience(audience.id, 'currentSkillLevel', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      >
                        {SKILL_LEVEL_OPTIONS.map(level => (
                          <option key={level} value={level} className="bg-cscx-gray-800">{level}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Target Skill Level</label>
                      <select
                        value={audience.targetSkillLevel}
                        onChange={(e) => updateAudience(audience.id, 'targetSkillLevel', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      >
                        {SKILL_LEVEL_OPTIONS.map(level => (
                          <option key={level} value={level} className="bg-cscx-gray-800">{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addAudience}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
              >
                + Add Target Audience
              </button>
            </div>
          )}

          {/* Criteria Tab */}
          {activeTab === 'criteria' && (
            <div className="space-y-4">
              {draft.completionCriteria.map((criteria) => (
                <div
                  key={criteria.id}
                  className={`border rounded-lg p-4 ${
                    criteria.enabled ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/10 bg-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={criteria.enabled}
                        onChange={() => toggleCriteriaEnabled(criteria.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-white/10 text-violet-500 focus:ring-violet-500/50"
                      />
                      <span className="text-violet-400">
                        {getCriteriaIcon(criteria.type)}
                      </span>
                      <input
                        type="text"
                        value={criteria.name}
                        onChange={(e) => updateCriteria(criteria.id, 'name', e.target.value)}
                        className="flex-1 bg-transparent border-none text-white focus:outline-none"
                        placeholder="Criteria name..."
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={criteria.type}
                        onChange={(e) => updateCriteria(criteria.id, 'type', e.target.value)}
                        className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none"
                      >
                        {CRITERIA_TYPE_OPTIONS.map(t => (
                          <option key={t} value={t} className="bg-cscx-gray-800">{t}</option>
                        ))}
                      </select>
                      {(criteria.type === 'assessment' || criteria.type === 'certification') && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={criteria.requiredScore || ''}
                            onChange={(e) => updateCriteria(criteria.id, 'requiredScore', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-16 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none"
                            placeholder="%"
                            min={0}
                            max={100}
                          />
                          <span className="text-gray-400 text-sm">%</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeCriteria(criteria.id)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addCriteria}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
              >
                + Add Completion Criteria
              </button>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={draft.timeline.startDate}
                    onChange={(e) => updateTimeline('startDate', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={draft.timeline.endDate}
                    onChange={(e) => updateTimeline('endDate', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Total Duration</label>
                  <input
                    type="text"
                    value={draft.timeline.totalDuration}
                    onChange={(e) => updateTimeline('totalDuration', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    placeholder="e.g., 6 weeks"
                  />
                </div>
              </div>

              {/* Module schedule visualization */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Module Schedule</h4>
                <div className="space-y-2">
                  {draft.modules.filter(m => m.enabled).map((module, idx) => (
                    <div key={module.id} className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-violet-500/20 text-violet-400 rounded-full text-xs">
                        {idx + 1}
                      </span>
                      <div className="flex-1 bg-violet-500/20 rounded h-8 flex items-center px-3">
                        <span className="text-sm text-white truncate">{module.name}</span>
                      </div>
                      <span className="text-sm text-gray-400 w-20 text-right">{module.duration}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Total training time: {draft.modules.filter(m => m.enabled).reduce((acc, m) => {
                    const hours = parseFloat(m.duration.match(/[\d.]+/)?.[0] || '0');
                    const isMinutes = m.duration.toLowerCase().includes('min');
                    return acc + (isMinutes ? hours / 60 : hours);
                  }, 0).toFixed(1)} hours
                </p>
              </div>
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              {draft.successMetrics.map((metric) => (
                <div key={metric.id} className="border border-white/10 rounded-lg p-4 bg-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={metric.name}
                      onChange={(e) => updateMetric(metric.id, 'name', e.target.value)}
                      className="flex-1 bg-transparent border-none text-white font-medium focus:outline-none"
                      placeholder="Metric name..."
                    />
                    <button
                      onClick={() => removeMetric(metric.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Current</label>
                      <input
                        type="number"
                        value={metric.current}
                        onChange={(e) => updateMetric(metric.id, 'current', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Target</label>
                      <input
                        type="number"
                        value={metric.target}
                        onChange={(e) => updateMetric(metric.id, 'target', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Unit</label>
                      <select
                        value={metric.unit}
                        onChange={(e) => updateMetric(metric.id, 'unit', e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u} className="bg-cscx-gray-800">{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${Math.min((metric.current / metric.target) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {Math.round((metric.current / metric.target) * 100)}% of target
                  </p>
                </div>
              ))}

              <button
                onClick={addMetric}
                className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
              >
                + Add Success Metric
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Program Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => updateNotes(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              placeholder="Additional notes about the training program..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between bg-cscx-gray-800/50 rounded-b-xl">
          <div className="text-sm text-gray-400">
            {isModified && (
              <span className="flex items-center gap-1 text-yellow-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
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
              className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-medium hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Create Program
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
