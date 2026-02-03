/**
 * useAICoach Hook (PRD-239)
 *
 * Custom hook for interacting with the AI Coach API.
 * Provides methods for guidance, feedback, skills, and progress.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Types
// ============================================================================

export type SituationType =
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

export type InteractionType = 'email' | 'call' | 'meeting' | 'presentation';

export type SkillArea =
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

export interface GuidanceRequest {
  customerId?: string;
  customerName?: string;
  situationType: SituationType;
  situationDescription: string;
  additionalContext?: string;
}

export interface RecommendedAction {
  priority: number;
  title: string;
  description: string;
  timeframe: string;
  details: string[];
}

export interface TemplateAction {
  type: 'email' | 'meeting_agenda' | 'talking_points' | 'plan';
  label: string;
  prompt: string;
}

export interface GuidanceResponse {
  guidanceId: string;
  situationAnalysis: string;
  recommendedApproach: RecommendedAction[];
  watchOutFor: string[];
  templates?: TemplateAction[];
  skillsInvolved: SkillArea[];
  followUpQuestion?: string;
}

export interface FeedbackRequest {
  customerId?: string;
  interactionType: InteractionType;
  interactionDescription: string;
  outcome?: string;
  selfAssessment?: string;
}

export interface FeedbackResponse {
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

export interface SkillAssessment {
  id: string;
  userId: string;
  skillArea: SkillArea;
  proficiencyLevel: number;
  assessedAt: string;
  recommendations: string[];
}

export interface CoachingProgress {
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

export interface WeeklySummary {
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

export interface SituationTypeOption {
  value: SituationType;
  label: string;
  description: string;
}

export interface UseAICoachReturn {
  // Data
  situationTypes: SituationTypeOption[];
  guidance: GuidanceResponse | null;
  feedback: FeedbackResponse | null;
  skills: SkillAssessment[];
  progress: CoachingProgress | null;
  weeklySummary: WeeklySummary | null;

  // Loading states
  isLoadingGuidance: boolean;
  isLoadingFeedback: boolean;
  isLoadingSkills: boolean;
  isLoadingProgress: boolean;
  isLoadingSummary: boolean;

  // Error
  error: string | null;

  // Methods
  fetchSituationTypes: () => Promise<void>;
  getGuidance: (request: GuidanceRequest) => Promise<GuidanceResponse | null>;
  getFeedback: (request: FeedbackRequest) => Promise<FeedbackResponse | null>;
  fetchSkills: () => Promise<void>;
  fetchProgress: () => Promise<void>;
  fetchWeeklySummary: () => Promise<void>;
  clearError: () => void;
  clearGuidance: () => void;
  clearFeedback: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAICoach(): UseAICoachReturn {
  const { getAuthHeaders } = useAuth();

  // Data state
  const [situationTypes, setSituationTypes] = useState<SituationTypeOption[]>([]);
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
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
  // Methods
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
    } catch (err) {
      console.error('Error fetching situation types:', err);
      setError('Failed to load situation types');
    }
  }, [getAuthHeaders]);

  const getGuidance = useCallback(
    async (request: GuidanceRequest): Promise<GuidanceResponse | null> => {
      setIsLoadingGuidance(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/coaching/guidance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(request),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to get guidance');
        }

        if (data.success) {
          setGuidance(data.data);
          return data.data;
        }
        return null;
      } catch (err) {
        console.error('Error getting guidance:', err);
        setError((err as Error).message);
        return null;
      } finally {
        setIsLoadingGuidance(false);
      }
    },
    [getAuthHeaders]
  );

  const getFeedback = useCallback(
    async (request: FeedbackRequest): Promise<FeedbackResponse | null> => {
      setIsLoadingFeedback(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/coaching/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(request),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to get feedback');
        }

        if (data.success) {
          setFeedback(data.data);
          return data.data;
        }
        return null;
      } catch (err) {
        console.error('Error getting feedback:', err);
        setError((err as Error).message);
        return null;
      } finally {
        setIsLoadingFeedback(false);
      }
    },
    [getAuthHeaders]
  );

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
    } catch (err) {
      console.error('Error fetching skills:', err);
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
    } catch (err) {
      console.error('Error fetching progress:', err);
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
    } catch (err) {
      console.error('Error fetching weekly summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [getAuthHeaders]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearGuidance = useCallback(() => {
    setGuidance(null);
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    // Data
    situationTypes,
    guidance,
    feedback,
    skills,
    progress,
    weeklySummary,

    // Loading states
    isLoadingGuidance,
    isLoadingFeedback,
    isLoadingSkills,
    isLoadingProgress,
    isLoadingSummary,

    // Error
    error,

    // Methods
    fetchSituationTypes,
    getGuidance,
    getFeedback,
    fetchSkills,
    fetchProgress,
    fetchWeeklySummary,
    clearError,
    clearGuidance,
    clearFeedback,
  };
}

export default useAICoach;
