/**
 * AICoach Component (PRD-239)
 *
 * AI coaching assistant that provides real-time guidance to CSMs:
 * - Situational guidance for common CS scenarios
 * - Post-interaction feedback
 * - Skill assessment and progress tracking
 * - Weekly coaching summaries
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Types
// ============================================================================

type SituationType =
  | 'champion_departure'
  | 'champion_promotion'
  | 'escalation'
  | 'churn_risk'
  | 'expansion_opportunity'
  | 'difficult_conversation'
  | 'stakeholder_mapping'
  | 'renewal_negotiation'
  | 'onboarding_stall'
  | 'product_feedback'
  | 'competitor_threat'
  | 'executive_engagement'
  | 'general';

type InteractionType = 'email' | 'call' | 'meeting' | 'presentation';

type SkillArea =
  | 'relationship_building'
  | 'strategic_thinking'
  | 'product_knowledge'
  | 'communication'
  | 'problem_solving'
  | 'time_management'
  | 'negotiation'
  | 'data_analysis'
  | 'executive_presence'
  | 'empathy';

interface RecommendedAction {
  priority: number;
  title: string;
  description: string;
  timeframe: string;
  details: string[];
}

interface TemplateAction {
  type: 'email' | 'meeting_agenda' | 'talking_points' | 'plan';
  label: string;
  prompt: string;
}

interface GuidanceResponse {
  guidanceId: string;
  situationAnalysis: string;
  recommendedApproach: RecommendedAction[];
  watchOutFor: string[];
  templates?: TemplateAction[];
  skillsInvolved: SkillArea[];
  followUpQuestion?: string;
}

interface FeedbackResponse {
  feedbackId: string;
  overallAssessment: string;
  whatWentWell: string[];
  areasForImprovement: string[];
  specificSuggestions: string[];
  skillsAssessed: Array<{
    skill: SkillArea;
    observation: string;
    suggestion?: string;
  }>;
  actionItems: string[];
}

interface SkillAssessment {
  id: string;
  userId: string;
  skillArea: SkillArea;
  proficiencyLevel: number;
  assessedAt: string;
  recommendations: string[];
}

interface CoachingProgress {
  userId: string;
  overallScore: number;
  skillBreakdown: Array<{
    skill: SkillArea;
    level: number;
    trend: 'improving' | 'stable' | 'declining';
    recentChange: number;
  }>;
  interactionsThisMonth: number;
  guidanceRequestsThisMonth: number;
  improvementAreas: SkillArea[];
  strengths: SkillArea[];
  weeklyGoals: string[];
  recentMilestones: string[];
}

interface WeeklySummary {
  userId: string;
  weekOf: string;
  highlights: string[];
  areasOfFocus: string[];
  skillProgress: Array<{
    skill: SkillArea;
    progress: string;
  }>;
  nextWeekGoals: string[];
  motivationalNote: string;
}

interface SituationTypeOption {
  value: SituationType;
  label: string;
  description: string;
}

type TabType = 'guidance' | 'feedback' | 'skills' | 'progress';

interface AICoachProps {
  customerId?: string;
  customerName?: string;
  embedded?: boolean;
  onClose?: () => void;
}

// ============================================================================
// Skill Labels
// ============================================================================

const SKILL_LABELS: Record<SkillArea, string> = {
  relationship_building: 'Relationship Building',
  strategic_thinking: 'Strategic Thinking',
  product_knowledge: 'Product Knowledge',
  communication: 'Communication',
  problem_solving: 'Problem Solving',
  time_management: 'Time Management',
  negotiation: 'Negotiation',
  data_analysis: 'Data Analysis',
  executive_presence: 'Executive Presence',
  empathy: 'Empathy',
};

// ============================================================================
// Component
// ============================================================================

export const AICoach: React.FC<AICoachProps> = ({
  customerId,
  customerName,
  embedded = false,
  onClose,
}) => {
  const { getAuthHeaders } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('guidance');

  // Guidance form state
  const [situationType, setSituationType] = useState<SituationType>('general');
  const [situationDescription, setSituationDescription] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [situationTypes, setSituationTypes] = useState<SituationTypeOption[]>([]);

  // Feedback form state
  const [interactionType, setInteractionType] = useState<InteractionType>('call');
  const [interactionDescription, setInteractionDescription] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selfAssessment, setSelfAssessment] = useState('');

  // Response state
  const [guidanceResponse, setGuidanceResponse] = useState<GuidanceResponse | null>(null);
  const [feedbackResponse, setFeedbackResponse] = useState<FeedbackResponse | null>(null);
  const [skills, setSkills] = useState<SkillAssessment[]>([]);
  const [progress, setProgress] = useState<CoachingProgress | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);

  // Loading states
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchSituationTypes = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/coaching/situation-types`, {
        headers: await getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setSituationTypes(data.data);
      }
    } catch (error) {
      console.error('Error fetching situation types:', error);
    }
  }, [getAuthHeaders]);

  const fetchSkills = useCallback(async () => {
    setIsLoadingSkills(true);
    try {
      const response = await fetch(`${API_URL}/api/coaching/skills`, {
        headers: await getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setSkills(data.data);
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
      setError('Failed to load skill assessment');
    } finally {
      setIsLoadingSkills(false);
    }
  }, [getAuthHeaders]);

  const fetchProgress = useCallback(async () => {
    setIsLoadingProgress(true);
    try {
      const response = await fetch(`${API_URL}/api/coaching/progress`, {
        headers: await getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setProgress(data.data);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
      setError('Failed to load progress data');
    } finally {
      setIsLoadingProgress(false);
    }
  }, [getAuthHeaders]);

  const fetchWeeklySummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const response = await fetch(`${API_URL}/api/coaching/weekly-summary`, {
        headers: await getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setWeeklySummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [getAuthHeaders]);

  // Initial load
  useEffect(() => {
    fetchSituationTypes();
  }, [fetchSituationTypes]);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'skills' && skills.length === 0) {
      fetchSkills();
    } else if (activeTab === 'progress' && !progress) {
      fetchProgress();
      fetchWeeklySummary();
    }
  }, [activeTab, skills.length, progress, fetchSkills, fetchProgress, fetchWeeklySummary]);

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const handleGetGuidance = async () => {
    if (!situationDescription.trim()) {
      setError('Please describe your situation');
      return;
    }

    setIsLoadingGuidance(true);
    setError(null);
    setGuidanceResponse(null);

    try {
      const response = await fetch(`${API_URL}/api/coaching/guidance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          customerId,
          customerName,
          situationType,
          situationDescription,
          additionalContext: additionalContext || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get guidance');
      }

      if (data.success) {
        setGuidanceResponse(data.data);
      }
    } catch (error) {
      console.error('Error getting guidance:', error);
      setError((error as Error).message);
    } finally {
      setIsLoadingGuidance(false);
    }
  };

  const handleGetFeedback = async () => {
    if (!interactionDescription.trim()) {
      setError('Please describe your interaction');
      return;
    }

    setIsLoadingFeedback(true);
    setError(null);
    setFeedbackResponse(null);

    try {
      const response = await fetch(`${API_URL}/api/coaching/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          customerId,
          interactionType,
          interactionDescription,
          outcome: outcome || undefined,
          selfAssessment: selfAssessment || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get feedback');
      }

      if (data.success) {
        setFeedbackResponse(data.data);
      }
    } catch (error) {
      console.error('Error getting feedback:', error);
      setError((error as Error).message);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handleClearGuidance = () => {
    setGuidanceResponse(null);
    setSituationDescription('');
    setAdditionalContext('');
    setSituationType('general');
  };

  const handleClearFeedback = () => {
    setFeedbackResponse(null);
    setInteractionDescription('');
    setOutcome('');
    setSelfAssessment('');
    setInteractionType('call');
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderTabs = () => (
    <div className="flex border-b border-gray-700">
      {[
        { id: 'guidance' as TabType, label: 'Get Guidance', icon: '?' },
        { id: 'feedback' as TabType, label: 'Get Feedback', icon: 'C' },
        { id: 'skills' as TabType, label: 'My Skills', icon: 'S' },
        { id: 'progress' as TabType, label: 'Progress', icon: 'P' },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'text-cscx-accent border-b-2 border-cscx-accent bg-gray-800/50'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
          }`}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderGuidanceTab = () => (
    <div className="p-4 space-y-4">
      {!guidanceResponse ? (
        <>
          {/* Situation Type Select */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What type of situation are you facing?
            </label>
            <select
              value={situationType}
              onChange={e => setSituationType(e.target.value as SituationType)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cscx-accent focus:border-transparent"
            >
              {situationTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {situationTypes.find(t => t.value === situationType)?.description && (
              <p className="mt-1 text-xs text-gray-500">
                {situationTypes.find(t => t.value === situationType)?.description}
              </p>
            )}
          </div>

          {/* Situation Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Describe your situation
            </label>
            <textarea
              value={situationDescription}
              onChange={e => setSituationDescription(e.target.value)}
              placeholder="E.g., My champion at Acme Corp just got promoted to VP. How should I handle this?"
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cscx-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Additional Context */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional context (optional)
            </label>
            <textarea
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              placeholder="Any other relevant details..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cscx-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Customer Context */}
          {customerName && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Customer:</span>
              <span className="font-medium text-white">{customerName}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleGetGuidance}
            disabled={isLoadingGuidance || !situationDescription.trim()}
            className="w-full py-3 px-4 bg-cscx-accent text-white rounded-lg font-medium hover:bg-cscx-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingGuidance ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">...</span>
                Getting Guidance...
              </span>
            ) : (
              'Get AI Guidance'
            )}
          </button>
        </>
      ) : (
        <div className="space-y-6">
          {/* Situation Analysis */}
          <div>
            <h3 className="text-sm font-semibold text-cscx-accent mb-2">
              Situation Analysis
            </h3>
            <p className="text-gray-300">{guidanceResponse.situationAnalysis}</p>
          </div>

          {/* Recommended Approach */}
          <div>
            <h3 className="text-sm font-semibold text-cscx-accent mb-3">
              Recommended Approach
            </h3>
            <div className="space-y-4">
              {guidanceResponse.recommendedApproach.map((action, index) => (
                <div
                  key={index}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cscx-accent/20 text-cscx-accent text-sm font-bold flex items-center justify-center">
                      {action.priority}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-white">{action.title}</h4>
                        <span className="text-xs text-gray-500">{action.timeframe}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{action.description}</p>
                      {action.details.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {action.details.map((detail, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-cscx-accent mt-1">-</span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Watch Out For */}
          {guidanceResponse.watchOutFor.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-500 mb-2">
                Watch Out For
              </h3>
              <ul className="space-y-1">
                {guidanceResponse.watchOutFor.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <span className="text-yellow-500">!</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Templates */}
          {guidanceResponse.templates && guidanceResponse.templates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Templates Ready
              </h3>
              <div className="flex flex-wrap gap-2">
                {guidanceResponse.templates.map((template, index) => (
                  <button
                    key={index}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skills Involved */}
          {guidanceResponse.skillsInvolved.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Skills Involved
              </h3>
              <div className="flex flex-wrap gap-2">
                {guidanceResponse.skillsInvolved.map(skill => (
                  <span
                    key={skill}
                    className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400"
                  >
                    {SKILL_LABELS[skill]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up Question */}
          {guidanceResponse.followUpQuestion && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <p className="text-sm text-gray-300">
                <span className="text-cscx-accent font-medium">Follow-up: </span>
                {guidanceResponse.followUpQuestion}
              </p>
            </div>
          )}

          {/* Clear Button */}
          <button
            onClick={handleClearGuidance}
            className="w-full py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
          >
            Ask Another Question
          </button>
        </div>
      )}
    </div>
  );

  const renderFeedbackTab = () => (
    <div className="p-4 space-y-4">
      {!feedbackResponse ? (
        <>
          {/* Interaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What type of interaction?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['email', 'call', 'meeting', 'presentation'] as InteractionType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setInteractionType(type)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    interactionType === type
                      ? 'bg-cscx-accent text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Interaction Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Describe what happened
            </label>
            <textarea
              value={interactionDescription}
              onChange={e => setInteractionDescription(e.target.value)}
              placeholder="Describe the interaction - what did you discuss, how did it go, what was the customer's reaction?"
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cscx-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What was the outcome? (optional)
            </label>
            <textarea
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              placeholder="Any concrete results or next steps agreed upon..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cscx-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Self Assessment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              How do you think it went? (optional)
            </label>
            <textarea
              value={selfAssessment}
              onChange={e => setSelfAssessment(e.target.value)}
              placeholder="Your own assessment of what went well or could be improved..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cscx-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleGetFeedback}
            disabled={isLoadingFeedback || !interactionDescription.trim()}
            className="w-full py-3 px-4 bg-cscx-accent text-white rounded-lg font-medium hover:bg-cscx-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingFeedback ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">...</span>
                Getting Feedback...
              </span>
            ) : (
              'Get AI Feedback'
            )}
          </button>
        </>
      ) : (
        <div className="space-y-6">
          {/* Overall Assessment */}
          <div>
            <h3 className="text-sm font-semibold text-cscx-accent mb-2">
              Overall Assessment
            </h3>
            <p className="text-gray-300">{feedbackResponse.overallAssessment}</p>
          </div>

          {/* What Went Well */}
          {feedbackResponse.whatWentWell.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-500 mb-2">
                What Went Well
              </h3>
              <ul className="space-y-1">
                {feedbackResponse.whatWentWell.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <span className="text-green-500">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {feedbackResponse.areasForImprovement.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-500 mb-2">
                Areas for Improvement
              </h3>
              <ul className="space-y-1">
                {feedbackResponse.areasForImprovement.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <span className="text-yellow-500">*</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Specific Suggestions */}
          {feedbackResponse.specificSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-2">
                Specific Suggestions
              </h3>
              <ul className="space-y-1">
                {feedbackResponse.specificSuggestions.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <span className="text-blue-400">-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills Assessed */}
          {feedbackResponse.skillsAssessed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Skills Assessed
              </h3>
              <div className="space-y-3">
                {feedbackResponse.skillsAssessed.map((skill, index) => (
                  <div
                    key={index}
                    className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
                  >
                    <h4 className="font-medium text-white text-sm">
                      {SKILL_LABELS[skill.skill]}
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">{skill.observation}</p>
                    {skill.suggestion && (
                      <p className="text-sm text-cscx-accent mt-1">
                        Tip: {skill.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {feedbackResponse.actionItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-cscx-accent mb-2">
                Action Items
              </h3>
              <ul className="space-y-2">
                {feedbackResponse.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-600 bg-gray-800 text-cscx-accent focus:ring-cscx-accent"
                    />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Clear Button */}
          <button
            onClick={handleClearFeedback}
            className="w-full py-2 px-4 border border-gray-700 text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
          >
            Get Feedback on Another Interaction
          </button>
        </div>
      )}
    </div>
  );

  const renderSkillsTab = () => (
    <div className="p-4">
      {isLoadingSkills ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            Your Skill Assessment
          </h3>
          <div className="grid gap-3">
            {skills.map(skill => (
              <div
                key={skill.skillArea}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">
                    {SKILL_LABELS[skill.skillArea]}
                  </h4>
                  <span className="text-sm text-gray-400">
                    Level {skill.proficiencyLevel}/5
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-cscx-accent h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(skill.proficiencyLevel / 5) * 100}%` }}
                  ></div>
                </div>
                {skill.recommendations.length > 0 && (
                  <p className="text-xs text-gray-500">{skill.recommendations[0]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderProgressTab = () => (
    <div className="p-4">
      {isLoadingProgress ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent"></div>
        </div>
      ) : progress ? (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 border-4 border-cscx-accent mb-2">
              <span className="text-2xl font-bold text-white">{progress.overallScore}</span>
            </div>
            <p className="text-sm text-gray-400">Overall Score</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">
                {progress.interactionsThisMonth}
              </div>
              <div className="text-xs text-gray-500">Interactions</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">
                {progress.guidanceRequestsThisMonth}
              </div>
              <div className="text-xs text-gray-500">Guidance Requests</div>
            </div>
          </div>

          {/* Strengths */}
          {progress.strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-500 mb-2">
                Your Strengths
              </h3>
              <div className="flex flex-wrap gap-2">
                {progress.strengths.map(skill => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
                  >
                    {SKILL_LABELS[skill]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Areas */}
          {progress.improvementAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-500 mb-2">
                Focus Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {progress.improvementAreas.map(skill => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm"
                  >
                    {SKILL_LABELS[skill]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Goals */}
          {progress.weeklyGoals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                This Week's Goals
              </h3>
              <ul className="space-y-2">
                {progress.weeklyGoals.map((goal, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-600 bg-gray-800 text-cscx-accent focus:ring-cscx-accent"
                    />
                    <span className="text-gray-300 text-sm">{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weekly Summary */}
          {weeklySummary && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-cscx-accent mb-3">
                Weekly Summary
              </h3>
              {weeklySummary.highlights.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-400 mb-1">Highlights</h4>
                  <ul className="space-y-1">
                    {weeklySummary.highlights.map((item, index) => (
                      <li key={index} className="text-sm text-gray-300">
                        - {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-gray-300 italic">
                "{weeklySummary.motivationalNote}"
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No progress data available yet. Start by asking for guidance!
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div
      className={`flex flex-col bg-cscx-gray-900 ${
        embedded ? 'h-full' : 'min-h-screen'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cscx-accent to-orange-500 flex items-center justify-center">
            <span className="text-white font-bold">AI</span>
          </div>
          <div>
            <h2 className="font-semibold text-white">AI Coach</h2>
            <p className="text-xs text-gray-500">Your personal CS mentor</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            X
          </button>
        )}
      </div>

      {/* Tabs */}
      {renderTabs()}

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-white"
          >
            x
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'guidance' && renderGuidanceTab()}
        {activeTab === 'feedback' && renderFeedbackTab()}
        {activeTab === 'skills' && renderSkillsTab()}
        {activeTab === 'progress' && renderProgressTab()}
      </div>
    </div>
  );
};

export default AICoach;
