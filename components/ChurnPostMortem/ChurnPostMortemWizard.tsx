/**
 * Churn Post-Mortem Wizard (PRD-124)
 *
 * Step-by-step wizard for completing churn post-mortem analysis:
 * 1. Review compiled data
 * 2. Select root causes
 * 3. Review AI analysis
 * 4. Add lessons learned & recommendations
 * 5. Win-back assessment
 * 6. Schedule review meeting
 */

import React, { useState, useEffect } from 'react';
import {
  ChurnPostMortem,
  ChurnReason,
  ChurnDataCompilation,
  ChurnAnalysis,
  WinBackPotential,
  CHURN_REASON_LABELS,
  WIN_BACK_POTENTIAL_LABELS
} from '../../types/churnPostMortem';

interface ChurnPostMortemWizardProps {
  postMortemId: string;
  onClose: () => void;
  onComplete?: () => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

const STEPS = [
  { id: 'review-data', title: 'Review Data', description: 'Review compiled customer history' },
  { id: 'root-cause', title: 'Root Cause', description: 'Classify churn reasons' },
  { id: 'analysis', title: 'Analysis', description: 'Review AI-generated insights' },
  { id: 'lessons', title: 'Lessons', description: 'Document lessons learned' },
  { id: 'win-back', title: 'Win-Back', description: 'Assess win-back potential' },
  { id: 'complete', title: 'Complete', description: 'Finalize post-mortem' }
];

const CHURN_REASONS: ChurnReason[] = [
  'price_value',
  'product_gaps',
  'poor_onboarding',
  'champion_left',
  'strategic_ma',
  'competitive',
  'support_issues',
  'relationship',
  'budget_cuts',
  'other'
];

export const ChurnPostMortemWizard: React.FC<ChurnPostMortemWizardProps> = ({
  postMortemId,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [postMortem, setPostMortem] = useState<ChurnPostMortem | null>(null);
  const [dataCompilation, setDataCompilation] = useState<ChurnDataCompilation | null>(null);
  const [analysis, setAnalysis] = useState<ChurnAnalysis | null>(null);

  // Form state
  const [primaryCause, setPrimaryCause] = useState<ChurnReason | null>(null);
  const [contributingCauses, setContributingCauses] = useState<ChurnReason[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [newLesson, setNewLesson] = useState('');
  const [newRecommendation, setNewRecommendation] = useState('');
  const [winBackPotential, setWinBackPotential] = useState<WinBackPotential>('none');
  const [winBackTriggers, setWinBackTriggers] = useState<string[]>([]);
  const [newTrigger, setNewTrigger] = useState('');
  const [winBackReminderDate, setWinBackReminderDate] = useState('');
  const [reviewOutcome, setReviewOutcome] = useState('');

  // Load post-mortem data
  useEffect(() => {
    loadPostMortem();
  }, [postMortemId]);

  const loadPostMortem = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/churn/post-mortem/${postMortemId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load post-mortem');
      }

      setPostMortem(data.postMortem);
      setDataCompilation(data.dataCompilation || null);
      setAnalysis(data.analysis || null);

      // Pre-populate form fields
      if (data.postMortem.rootCauses?.primary) {
        setPrimaryCause(data.postMortem.rootCauses.primary);
        setContributingCauses(data.postMortem.rootCauses.contributing || []);
        setCustomNotes(data.postMortem.rootCauses.customNotes || '');
      }

      if (data.analysis) {
        setLessonsLearned(data.analysis.lessonsLearned || []);
        setRecommendations(data.analysis.recommendations || []);
      }

      if (data.postMortem.winBackAssessment) {
        setWinBackPotential(data.postMortem.winBackAssessment.potential || 'none');
        setWinBackTriggers(data.postMortem.winBackAssessment.triggers || []);
        setWinBackReminderDate(data.postMortem.winBackAssessment.reminderDate || '');
      }

      // Determine starting step based on status
      determineStartingStep(data.postMortem, data.dataCompilation, data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post-mortem');
    } finally {
      setLoading(false);
    }
  };

  const determineStartingStep = (
    pm: ChurnPostMortem,
    data: ChurnDataCompilation | null,
    analysis: ChurnAnalysis | null
  ) => {
    if (pm.status === 'completed' || pm.status === 'closed') {
      setCurrentStep(5); // Show completion
    } else if (analysis) {
      setCurrentStep(3); // Go to lessons
    } else if (pm.rootCauses?.primary) {
      setCurrentStep(2); // Go to analysis
    } else if (data) {
      setCurrentStep(1); // Go to root cause
    } else {
      setCurrentStep(0); // Start at data review
    }
  };

  // Step handlers
  const handleCompileData = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/churn/post-mortem/${postMortemId}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to compile data');
      }

      setDataCompilation(data.dataCompilation);
      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compile data');
    } finally {
      setProcessing(false);
    }
  };

  const handleSetRootCause = async () => {
    if (!primaryCause) {
      setError('Please select a primary root cause');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/churn/post-mortem/${postMortemId}/root-cause`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary: primaryCause,
          contributing: contributingCauses,
          customNotes
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to set root cause');
      }

      setPostMortem(data.postMortem);
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set root cause');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/churn/post-mortem/${postMortemId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate analysis');
      }

      setAnalysis(data.analysis);
      setLessonsLearned(data.analysis.lessonsLearned || []);
      setRecommendations(data.analysis.recommendations || []);
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/churn/post-mortem/${postMortemId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewOutcome,
          lessonsLearned,
          recommendations,
          winBackAssessment: {
            potential: winBackPotential,
            triggers: winBackTriggers,
            reminderDate: winBackReminderDate || null
          }
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to complete post-mortem');
      }

      setPostMortem(data.postMortem);
      setCurrentStep(5);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete post-mortem');
    } finally {
      setProcessing(false);
    }
  };

  // Utility functions
  const addLesson = () => {
    if (newLesson.trim()) {
      setLessonsLearned([...lessonsLearned, newLesson.trim()]);
      setNewLesson('');
    }
  };

  const removeLesson = (index: number) => {
    setLessonsLearned(lessonsLearned.filter((_, i) => i !== index));
  };

  const addRecommendation = () => {
    if (newRecommendation.trim()) {
      setRecommendations([...recommendations, newRecommendation.trim()]);
      setNewRecommendation('');
    }
  };

  const removeRecommendation = (index: number) => {
    setRecommendations(recommendations.filter((_, i) => i !== index));
  };

  const addTrigger = () => {
    if (newTrigger.trim()) {
      setWinBackTriggers([...winBackTriggers, newTrigger.trim()]);
      setNewTrigger('');
    }
  };

  const removeTrigger = (index: number) => {
    setWinBackTriggers(winBackTriggers.filter((_, i) => i !== index));
  };

  const toggleContributingCause = (cause: ChurnReason) => {
    if (cause === primaryCause) return;
    if (contributingCauses.includes(cause)) {
      setContributingCauses(contributingCauses.filter(c => c !== cause));
    } else {
      setContributingCauses([...contributingCauses, cause]);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-cscx-gray-400 mt-4">Loading post-mortem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-cscx-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Churn Post-Mortem</h2>
              {postMortem && (
                <p className="text-cscx-gray-400 mt-1">
                  {postMortem.customerName} - {formatCurrency(postMortem.arrLost)} ARR Lost
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-cscx-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center mt-6 overflow-x-auto">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-2 shrink-0 ${
                    index === currentStep
                      ? 'text-cscx-accent'
                      : index < currentStep
                      ? 'text-green-400'
                      : 'text-cscx-gray-500'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index === currentStep
                        ? 'bg-cscx-accent text-white'
                        : index < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-cscx-gray-800 text-cscx-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-px w-8 mx-2 ${
                      index < currentStep ? 'bg-green-500' : 'bg-cscx-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 0: Review Data */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Review Compiled Data</h3>
                <p className="text-cscx-gray-400">
                  We'll compile the customer's history including health scores, risk signals, support tickets,
                  meeting notes, and usage trends.
                </p>
              </div>

              {dataCompilation ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-cscx-gray-800 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-white">
                        {dataCompilation.healthScoreHistory.length}
                      </p>
                      <p className="text-xs text-cscx-gray-400">Health Score Points</p>
                    </div>
                    <div className="bg-cscx-gray-800 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-white">
                        {dataCompilation.riskSignals.length}
                      </p>
                      <p className="text-xs text-cscx-gray-400">Risk Signals</p>
                    </div>
                    <div className="bg-cscx-gray-800 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-white">
                        {dataCompilation.meetingSentiments.length}
                      </p>
                      <p className="text-xs text-cscx-gray-400">Meeting Records</p>
                    </div>
                    <div className="bg-cscx-gray-800 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-white">
                        {dataCompilation.interactionTimeline.length}
                      </p>
                      <p className="text-xs text-cscx-gray-400">Timeline Events</p>
                    </div>
                  </div>

                  {/* Save Plays Summary */}
                  {dataCompilation.savePlays.length > 0 && (
                    <div className="bg-cscx-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-cscx-gray-300 mb-2">Save Play Attempts</h4>
                      <div className="space-y-2">
                        {dataCompilation.savePlays.map((play, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-white">{play.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              play.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              play.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {play.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setCurrentStep(1)}
                    className="w-full py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Continue to Root Cause Classification
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCompileData}
                  disabled={processing}
                  className="w-full py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Compiling Data...' : 'Compile Customer History'}
                </button>
              )}
            </div>
          )}

          {/* Step 1: Root Cause */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Root Cause Classification</h3>
                <p className="text-cscx-gray-400">
                  Select the primary reason for churn and any contributing factors.
                </p>
              </div>

              {/* Primary Cause */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-3">
                  Primary Root Cause *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CHURN_REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => {
                        setPrimaryCause(reason);
                        setContributingCauses(contributingCauses.filter(c => c !== reason));
                      }}
                      className={`p-3 rounded-lg text-left text-sm transition-colors ${
                        primaryCause === reason
                          ? 'bg-cscx-accent text-white'
                          : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700'
                      }`}
                    >
                      {CHURN_REASON_LABELS[reason]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contributing Factors */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-3">
                  Contributing Factors (optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CHURN_REASONS.filter(r => r !== primaryCause).map(reason => (
                    <button
                      key={reason}
                      onClick={() => toggleContributingCause(reason)}
                      className={`p-3 rounded-lg text-left text-sm transition-colors ${
                        contributingCauses.includes(reason)
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                          : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700'
                      }`}
                    >
                      {CHURN_REASON_LABELS[reason]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Notes */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  placeholder="Any additional context about the churn..."
                  className="w-full px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSetRootCause}
                  disabled={!primaryCause || processing}
                  className="flex-1 py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Saving...' : 'Continue to Analysis'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Analysis */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">AI-Powered Analysis</h3>
                <p className="text-cscx-gray-400">
                  Generate insights based on the compiled data and root cause classification.
                </p>
              </div>

              {analysis ? (
                <div className="space-y-4">
                  {/* Executive Summary */}
                  <div className="bg-cscx-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-cscx-gray-300 mb-2">Executive Summary</h4>
                    <p className="text-white text-sm">{analysis.executiveSummary}</p>
                  </div>

                  {/* Early Warnings */}
                  <div className="bg-cscx-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-yellow-400 mb-2">Early Warning Signals</h4>
                    <ul className="space-y-1">
                      {analysis.earlyWarningSignals.map((signal, i) => (
                        <li key={i} className="text-sm text-cscx-gray-300 flex items-start gap-2">
                          <span className="text-yellow-400">!</span>
                          {signal}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Missed Opportunities */}
                  <div className="bg-cscx-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-400 mb-2">Missed Opportunities</h4>
                    <ul className="space-y-1">
                      {analysis.missedOpportunities.map((opp, i) => (
                        <li key={i} className="text-sm text-cscx-gray-300 flex items-start gap-2">
                          <span className="text-red-400">-</span>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => setCurrentStep(3)}
                    className="w-full py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Continue to Lessons Learned
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-cscx-gray-400 mb-4">
                    Click below to generate AI-powered analysis of the churn.
                  </p>
                  <button
                    onClick={handleGenerateAnalysis}
                    disabled={processing}
                    className="px-8 py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {processing ? 'Generating Analysis...' : 'Generate Analysis'}
                  </button>
                </div>
              )}

              <button
                onClick={() => setCurrentStep(1)}
                className="w-full py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
              >
                Back to Root Cause
              </button>
            </div>
          )}

          {/* Step 3: Lessons Learned */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Lessons Learned & Recommendations</h3>
                <p className="text-cscx-gray-400">
                  Review and edit the AI-suggested lessons and recommendations.
                </p>
              </div>

              {/* Lessons Learned */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                  Lessons Learned
                </label>
                <div className="space-y-2 mb-3">
                  {lessonsLearned.map((lesson, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-cscx-gray-800 rounded-lg">
                      <span className="text-green-400 mt-0.5">+</span>
                      <span className="flex-1 text-sm text-white">{lesson}</span>
                      <button
                        onClick={() => removeLesson(i)}
                        className="text-cscx-gray-500 hover:text-red-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLesson}
                    onChange={e => setNewLesson(e.target.value)}
                    placeholder="Add a lesson learned..."
                    className="flex-1 px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    onKeyDown={e => e.key === 'Enter' && addLesson()}
                  />
                  <button
                    onClick={addLesson}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                  Recommendations
                </label>
                <div className="space-y-2 mb-3">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-cscx-gray-800 rounded-lg">
                      <span className="text-blue-400 mt-0.5">*</span>
                      <span className="flex-1 text-sm text-white">{rec}</span>
                      <button
                        onClick={() => removeRecommendation(i)}
                        className="text-cscx-gray-500 hover:text-red-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRecommendation}
                    onChange={e => setNewRecommendation(e.target.value)}
                    placeholder="Add a recommendation..."
                    className="flex-1 px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    onKeyDown={e => e.key === 'Enter' && addRecommendation()}
                  />
                  <button
                    onClick={addRecommendation}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="flex-1 py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Continue to Win-Back Assessment
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Win-Back Assessment */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Win-Back Assessment</h3>
                <p className="text-cscx-gray-400">
                  Evaluate the potential to win back this customer in the future.
                </p>
              </div>

              {/* Win-Back Potential */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-3">
                  Win-Back Potential
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['high', 'medium', 'low', 'none'] as WinBackPotential[]).map(potential => (
                    <button
                      key={potential}
                      onClick={() => setWinBackPotential(potential)}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                        winBackPotential === potential
                          ? potential === 'high' ? 'bg-green-600 text-white' :
                            potential === 'medium' ? 'bg-yellow-600 text-white' :
                            potential === 'low' ? 'bg-orange-600 text-white' :
                            'bg-red-600 text-white'
                          : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700'
                      }`}
                    >
                      {WIN_BACK_POTENTIAL_LABELS[potential]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Win-Back Triggers */}
              {winBackPotential !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                    Win-Back Triggers
                  </label>
                  <p className="text-xs text-cscx-gray-500 mb-2">
                    What events might prompt a win-back opportunity?
                  </p>
                  <div className="space-y-2 mb-3">
                    {winBackTriggers.map((trigger, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-cscx-gray-800 rounded-lg">
                        <span className="text-cscx-accent">*</span>
                        <span className="flex-1 text-sm text-white">{trigger}</span>
                        <button
                          onClick={() => removeTrigger(i)}
                          className="text-cscx-gray-500 hover:text-red-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTrigger}
                      onChange={e => setNewTrigger(e.target.value)}
                      placeholder="e.g., New product features, budget cycle reset..."
                      className="flex-1 px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                      onKeyDown={e => e.key === 'Enter' && addTrigger()}
                    />
                    <button
                      onClick={addTrigger}
                      className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Reminder Date */}
              {winBackPotential !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                    Win-Back Reminder Date (optional)
                  </label>
                  <input
                    type="date"
                    value={winBackReminderDate}
                    onChange={e => setWinBackReminderDate(e.target.value)}
                    className="w-full px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                  />
                </div>
              )}

              {/* Review Outcome */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                  Review Meeting Outcome (optional)
                </label>
                <textarea
                  value={reviewOutcome}
                  onChange={e => setReviewOutcome(e.target.value)}
                  placeholder="Summary of post-mortem review discussion..."
                  className="w-full px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {processing ? 'Completing...' : 'Complete Post-Mortem'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 5 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Post-Mortem Complete</h3>
              <p className="text-cscx-gray-400 mb-6">
                The churn post-mortem for {postMortem?.customerName} has been completed.
                Lessons learned have been recorded and will help improve retention strategies.
              </p>

              {postMortem?.documentUrl && (
                <a
                  href={postMortem.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors mb-4"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Full Document
                </a>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChurnPostMortemWizard;
