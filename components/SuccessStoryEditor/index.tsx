/**
 * Success Story Editor Component (PRD-240)
 *
 * AI-powered success story drafting with editing, preview, and publishing workflow.
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface CustomerMetrics {
  healthScoreImprovement?: number;
  currentHealthScore?: number;
  retentionRate?: number;
  expansionRevenue?: number;
  efficiencyGains?: string;
  timeToValue?: string;
  costSavings?: number;
  npsScore?: number;
  adoptionRate?: number;
  customMetrics?: Record<string, string | number>;
}

interface CustomerQuote {
  text: string;
  author: string;
  role: string;
  source?: string;
  date?: string;
}

interface KeyMetric {
  label: string;
  value: string;
  icon?: string;
}

interface GeneratedStory {
  title: string;
  summary: string;
  challenge: string;
  solution: string;
  results: string;
  narrative: string;
  keyMetrics: KeyMetric[];
  quotes: CustomerQuote[];
  tags: string[];
  suggestedImages?: string[];
  callToAction?: string;
}

interface SuccessStory {
  id: string;
  customerId: string;
  title: string;
  summary: string;
  challenge: string;
  solution: string;
  results: string;
  narrative: string;
  metrics: CustomerMetrics;
  quotes: CustomerQuote[];
  tags: string[];
  status: string;
  tone: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

interface CustomerContext {
  customerId: string;
  customerName: string;
  industry?: string;
  companySize?: string;
  region?: string;
  metrics: CustomerMetrics;
  challenges?: string[];
  solutions?: string[];
  outcomes?: string[];
  quotes?: CustomerQuote[];
  milestones?: string[];
}

type StoryTone = 'professional' | 'conversational' | 'executive' | 'technical';
type FocusArea = 'metrics' | 'transformation' | 'roi' | 'innovation';
type ViewMode = 'edit' | 'preview' | 'split';

interface SuccessStoryEditorProps {
  customerId?: string;
  customerName?: string;
  existingStoryId?: string;
  onClose?: () => void;
  onSave?: (story: SuccessStory) => void;
}

export const SuccessStoryEditor: React.FC<SuccessStoryEditorProps> = ({
  customerId,
  customerName: propCustomerName,
  existingStoryId,
  onClose,
  onSave,
}) => {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState(propCustomerName || '');
  const [tone, setTone] = useState<StoryTone>('professional');
  const [focusArea, setFocusArea] = useState<FocusArea>('transformation');
  const [customInstructions, setCustomInstructions] = useState('');

  // Story content
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [savedStory, setSavedStory] = useState<SuccessStory | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

  // Context
  const [context, setContext] = useState<CustomerContext | null>(null);
  const [showContextEditor, setShowContextEditor] = useState(false);

  // Custom metrics input
  const [metricsInput, setMetricsInput] = useState<Record<string, string>>({});
  const [challengesInput, setChallengesInput] = useState('');
  const [outcomesInput, setOutcomesInput] = useState('');

  // Load existing story or context
  useEffect(() => {
    if (existingStoryId) {
      loadExistingStory(existingStoryId);
    } else if (customerId) {
      loadCustomerContext(customerId);
    }
  }, [existingStoryId, customerId]);

  const loadExistingStory = async (storyId: string) => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/content/success-story/${storyId}`, {
        headers: { 'x-user-id': userId },
      });
      const data = await response.json();
      if (data.success && data.story) {
        setSavedStory(data.story);
        setStory({
          title: data.story.title,
          summary: data.story.summary,
          challenge: data.story.challenge,
          solution: data.story.solution,
          results: data.story.results,
          narrative: data.story.narrative,
          keyMetrics: Object.entries(data.story.metrics || {}).map(([k, v]) => ({
            label: formatMetricKey(k),
            value: String(v),
            icon: getMetricIcon(k),
          })),
          quotes: data.story.quotes || [],
          tags: data.story.tags || [],
        });
      }
    } catch (err) {
      setError('Failed to load story');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerContext = async (custId: string) => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/content/success-story/customer/${custId}/context`, {
        headers: { 'x-user-id': userId },
      });
      const data = await response.json();
      if (data.success && data.context) {
        setContext(data.context);
        setCustomerName(data.context.customerName);
        if (data.context.metrics) {
          const metrics: Record<string, string> = {};
          Object.entries(data.context.metrics).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
              metrics[k] = String(v);
            }
          });
          setMetricsInput(metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load context:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!customerName && !customerId) {
      setError('Please provide a customer name');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const userId = localStorage.getItem('userId') || '';

      // Build metrics from input
      const metrics: CustomerMetrics = {};
      Object.entries(metricsInput).forEach(([k, v]) => {
        if (v) {
          const numVal = parseFloat(v);
          (metrics as Record<string, unknown>)[k] = isNaN(numVal) ? v : numVal;
        }
      });

      const requestBody = {
        customerId,
        customerName: customerName || context?.customerName,
        industry: context?.industry,
        companySize: context?.companySize,
        region: context?.region,
        metrics,
        challenges: challengesInput ? challengesInput.split('\n').filter(Boolean) : context?.challenges,
        outcomes: outcomesInput ? outcomesInput.split('\n').filter(Boolean) : context?.outcomes,
        quotes: context?.quotes,
        tone,
        focusArea,
        customInstructions: customInstructions || undefined,
        includeCallToAction: true,
        autoSave: false,
      };

      const response = await fetch(`${API_URL}/api/content/success-story/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success && data.story) {
        setStory(data.story);
        setViewMode('split');
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError(`Failed to generate story: ${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (status: string = 'draft') => {
    if (!story) return;

    setIsSaving(true);
    setError(null);

    try {
      const userId = localStorage.getItem('userId') || '';

      const storyData = {
        customerId: customerId || savedStory?.customerId || `temp_${Date.now()}`,
        title: story.title,
        summary: story.summary,
        challenge: story.challenge,
        solution: story.solution,
        results: story.results,
        narrative: story.narrative,
        metrics: metricsInput,
        quotes: story.quotes,
        tags: story.tags,
        tone,
        status,
      };

      const url = savedStory?.id
        ? `${API_URL}/api/content/success-story/${savedStory.id}`
        : `${API_URL}/api/content/success-story`;

      const response = await fetch(url, {
        method: savedStory?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(storyData),
      });

      const data = await response.json();

      if (data.success && data.story) {
        setSavedStory(data.story);
        setSuccessMessage('Story saved successfully!');
        onSave?.(data.story);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (err) {
      setError(`Failed to save story: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!savedStory?.id) {
      await handleSave('pending_approval');
      return;
    }

    setIsSaving(true);
    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/content/success-story/${savedStory.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          message: 'Please review this success story for approval.',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSavedStory(data.story);
        setSuccessMessage('Submitted for approval!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Submit failed');
      }
    } catch (err) {
      setError(`Failed to submit: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!savedStory?.id) {
      setError('Please save the story first');
      return;
    }

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/content/success-story/${savedStory.id}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ format }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMessage(`Exported as ${format.toUpperCase()}`);
        setTimeout(() => setSuccessMessage(null), 3000);
        // In production, would open the exported file
      }
    } catch (err) {
      setError(`Export failed: ${(err as Error).message}`);
    }
  };

  const updateStoryField = (field: keyof GeneratedStory, value: string | string[]) => {
    if (story) {
      setStory({ ...story, [field]: value });
    }
  };

  const formatMetricKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
  };

  const getMetricIcon = (key: string): string => {
    const icons: Record<string, string> = {
      healthScoreImprovement: '📈',
      currentHealthScore: '💚',
      retentionRate: '🔄',
      expansionRevenue: '💰',
      efficiencyGains: '⚡',
      timeToValue: '⏱️',
      costSavings: '💵',
      npsScore: '⭐',
      adoptionRate: '📊',
    };
    return icons[key] || '📌';
  };

  const toneOptions: { value: StoryTone; label: string; description: string }[] = [
    { value: 'professional', label: 'Professional', description: 'Formal, data-driven' },
    { value: 'conversational', label: 'Conversational', description: 'Warm, relatable' },
    { value: 'executive', label: 'Executive', description: 'Concise, ROI-focused' },
    { value: 'technical', label: 'Technical', description: 'Detailed, feature-focused' },
  ];

  const focusOptions: { value: FocusArea; label: string; icon: string }[] = [
    { value: 'transformation', label: 'Transformation Journey', icon: '🚀' },
    { value: 'metrics', label: 'Metrics & Numbers', icon: '📊' },
    { value: 'roi', label: 'ROI & Savings', icon: '💰' },
    { value: 'innovation', label: 'Innovation & Use Cases', icon: '💡' },
  ];

  if (isLoading) {
    return (
      <div className="bg-cscx-gray-900 rounded-lg border border-cscx-gray-700 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cscx-accent"></div>
        <span className="ml-3 text-cscx-gray-300">Loading...</span>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 rounded-lg border border-cscx-gray-700 overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <div>
            <h2 className="font-semibold text-white text-lg">
              {savedStory ? 'Edit Success Story' : 'Create Success Story'}
            </h2>
            <p className="text-xs text-cscx-gray-400">
              AI-powered success story drafting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedStory && (
            <span className={`px-2 py-1 text-xs rounded ${
              savedStory.status === 'published' ? 'bg-green-500/20 text-green-400' :
              savedStory.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
              savedStory.status === 'pending_approval' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-cscx-gray-700 text-cscx-gray-400'
            }`}>
              {savedStory.status.replace('_', ' ').toUpperCase()}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-cscx-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mx-4 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Configuration / Editor */}
        <div className={`${story && viewMode !== 'edit' ? 'w-1/2' : 'w-full'} border-r border-cscx-gray-700 overflow-y-auto p-4 space-y-4`}>
          {!story ? (
            <>
              {/* Customer Info */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                  disabled={!!customerId}
                />
              </div>

              {/* Tone Selection */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                  Story Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {toneOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTone(option.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        tone === option.value
                          ? 'border-cscx-accent bg-cscx-accent/10'
                          : 'border-cscx-gray-600 bg-cscx-gray-800 hover:border-cscx-gray-500'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{option.label}</div>
                      <p className="text-xs text-cscx-gray-400">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Area */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                  Focus Area
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {focusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFocusArea(option.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        focusArea === option.value
                          ? 'border-cscx-accent bg-cscx-accent/10'
                          : 'border-cscx-gray-600 bg-cscx-gray-800 hover:border-cscx-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        <span className="font-medium text-white text-sm">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Metrics Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-cscx-gray-300">
                    Key Metrics
                  </label>
                  <button
                    onClick={() => setShowContextEditor(!showContextEditor)}
                    className="text-xs text-cscx-accent hover:text-cscx-accent/80"
                  >
                    {showContextEditor ? 'Hide Details' : 'Add Details'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={metricsInput.efficiencyGains || ''}
                      onChange={(e) => setMetricsInput({ ...metricsInput, efficiencyGains: e.target.value })}
                      placeholder="Efficiency gains (e.g., 40%)"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={metricsInput.costSavings || ''}
                      onChange={(e) => setMetricsInput({ ...metricsInput, costSavings: e.target.value })}
                      placeholder="Cost savings ($)"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={metricsInput.retentionRate || ''}
                      onChange={(e) => setMetricsInput({ ...metricsInput, retentionRate: e.target.value })}
                      placeholder="Retention improvement (%)"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={metricsInput.timeToValue || ''}
                      onChange={(e) => setMetricsInput({ ...metricsInput, timeToValue: e.target.value })}
                      placeholder="Time to value"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Extended Context */}
              {showContextEditor && (
                <div className="space-y-3 pt-2 border-t border-cscx-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">
                      Challenges (one per line)
                    </label>
                    <textarea
                      value={challengesInput}
                      onChange={(e) => setChallengesInput(e.target.value)}
                      placeholder="Manual processes&#10;Lack of visibility&#10;Reactive engagement"
                      rows={3}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">
                      Outcomes (one per line)
                    </label>
                    <textarea
                      value={outcomesInput}
                      onChange={(e) => setOutcomesInput(e.target.value)}
                      placeholder="Improved retention&#10;Reduced churn&#10;Increased efficiency"
                      rows={3}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-1">
                  Custom Instructions (optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add any specific instructions for the AI..."
                  rows={2}
                  className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (!customerName && !customerId)}
                className="w-full py-3 bg-cscx-accent hover:bg-cscx-accent/90 disabled:bg-cscx-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating Story...
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Generate Success Story
                  </>
                )}
              </button>
            </>
          ) : (
            /* Editor Mode */
            <>
              {/* View Mode Toggle */}
              <div className="flex gap-2 pb-3 border-b border-cscx-gray-700">
                {(['edit', 'split', 'preview'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 text-sm rounded ${
                      viewMode === mode
                        ? 'bg-cscx-accent text-white'
                        : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              {viewMode !== 'preview' && (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      value={story.title}
                      onChange={(e) => updateStoryField('title', e.target.value)}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                    />
                  </div>

                  {/* Summary */}
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">Summary</label>
                    <textarea
                      value={story.summary}
                      onChange={(e) => updateStoryField('summary', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>

                  {/* Challenge */}
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">The Challenge</label>
                    <textarea
                      value={story.challenge}
                      onChange={(e) => updateStoryField('challenge', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>

                  {/* Solution */}
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">The Solution</label>
                    <textarea
                      value={story.solution}
                      onChange={(e) => updateStoryField('solution', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>

                  {/* Results */}
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">The Results</label>
                    <textarea
                      value={story.results}
                      onChange={(e) => updateStoryField('results', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent resize-none"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-cscx-gray-300 mb-1">Tags</label>
                    <input
                      type="text"
                      value={story.tags.join(', ')}
                      onChange={(e) => updateStoryField('tags', e.target.value.split(',').map(t => t.trim()))}
                      placeholder="technology, customer-success, automation"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white focus:outline-none focus:border-cscx-accent text-sm"
                    />
                  </div>

                  {/* Regenerate */}
                  <button
                    onClick={() => { setStory(null); setViewMode('edit'); }}
                    className="w-full py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-300 rounded-lg transition-colors text-sm border border-cscx-gray-600"
                  >
                    ← Start Over
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Panel - Preview */}
        {story && viewMode !== 'edit' && (
          <div className="w-1/2 overflow-y-auto p-6 bg-white">
            {/* Preview Content */}
            <article className="prose prose-lg max-w-none">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{story.title}</h1>

              {/* Key Metrics */}
              {story.keyMetrics.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-6 not-prose">
                  {story.keyMetrics.slice(0, 4).map((metric, i) => (
                    <div key={i} className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-3xl mb-1">{metric.icon}</div>
                      <div className="text-2xl font-bold text-cscx-accent">{metric.value}</div>
                      <div className="text-sm text-gray-600">{metric.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <p className="text-lg text-gray-700 font-medium border-l-4 border-cscx-accent pl-4 mb-6">
                {story.summary}
              </p>

              {/* Challenge */}
              <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">The Challenge</h2>
              <p className="text-gray-700">{story.challenge}</p>

              {/* Solution */}
              <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">The Solution</h2>
              <p className="text-gray-700">{story.solution}</p>

              {/* Results */}
              <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">The Results</h2>
              <p className="text-gray-700">{story.results}</p>

              {/* Customer Quote */}
              {story.quotes.length > 0 && (
                <blockquote className="border-l-4 border-cscx-accent bg-gray-50 p-4 my-6 italic">
                  <p className="text-gray-800 mb-2">"{story.quotes[0].text}"</p>
                  <footer className="text-sm text-gray-600">
                    — {story.quotes[0].author}, {story.quotes[0].role}
                  </footer>
                </blockquote>
              )}

              {/* Call to Action */}
              {story.callToAction && (
                <div className="bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg p-6 text-center mt-8 not-prose">
                  <p className="text-gray-800 font-medium">{story.callToAction}</p>
                  <button className="mt-3 px-6 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90">
                    Learn More
                  </button>
                </div>
              )}

              {/* Tags */}
              {story.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 not-prose">
                  {story.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {story && (
        <div className="p-4 border-t border-cscx-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('pdf')}
              className="px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm flex items-center gap-2"
              disabled={!savedStory?.id}
            >
              📄 PDF
            </button>
            <button
              onClick={() => handleExport('slides')}
              className="px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm flex items-center gap-2"
              disabled={!savedStory?.id}
            >
              📊 Slides
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave('draft')}
              disabled={isSaving}
              className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg text-sm"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleSubmitForApproval}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
            >
              Request Approval
            </button>
            {savedStory?.status === 'approved' && (
              <button
                onClick={() => handleSave('published')}
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm"
              >
                Publish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Quick action button to open success story editor
 */
export const SuccessStoryButton: React.FC<{
  customerId?: string;
  customerName?: string;
  label?: string;
  className?: string;
}> = ({ customerId, customerName, label = 'Create Success Story', className }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={className || "px-3 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"}
      >
        <span>📝</span>
        {label}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl h-[90vh]">
            <SuccessStoryEditor
              customerId={customerId}
              customerName={customerName}
              onClose={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SuccessStoryEditor;
