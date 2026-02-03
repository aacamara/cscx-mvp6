/**
 * Training Services Index
 * PRD-017: Training Completion Data Certification Tracking
 * PRD-038: Training Invitation Personalization
 *
 * Exports all training-related services for easy importing
 */

// PRD-017: Training Completion Data Certification Tracking
export {
  trainingDataParser,
  type TrainingRecord,
  type TrainingStatus,
  type CourseType,
  type TrainingColumnMapping,
  type TrainingParseResult,
  type SuggestedMapping
} from './dataParser.js';

export {
  certificationTracker,
  type CustomerTrainingStatus,
  type TrainingOverview,
  type CourseCompletionStatus,
  type CertificationOverview,
  type UserCertification,
  type UserTrainingStatus,
  type TrainingAdoptionCorrelation
} from './certificationTracker.js';

export {
  trainingGapAnalyzer,
  type TrainingGap,
  type GapAffectedUser,
  type RoleGap,
  type TrainingRecommendation,
  type TrainingGapAnalysis,
  type TrainingPlan,
  type TrainingPlanWeek,
  type TrainingPlanItem,
  type TrainingSuccessMetric,
  type SendRemindersResult
} from './gapAnalyzer.js';

// PRD-038: Training Invitation Personalization
export {
  TrainingInvitationGenerator,
  trainingInvitationGenerator,
  type TrainingSession,
  type StakeholderAnalysis,
  type TrainingGapAnalysis as InvitationTrainingGapAnalysis,
  type GenerateInvitationsParams,
  type GeneratedInvitation,
} from './invitationGenerator.js';

export {
  TrainingSessionService,
  trainingSessionService,
} from './sessionService.js';

// Re-export default services for convenience
import { trainingDataParser } from './dataParser.js';
import { certificationTracker } from './certificationTracker.js';
import { trainingGapAnalyzer } from './gapAnalyzer.js';

export default {
  dataParser: trainingDataParser,
  certificationTracker,
  gapAnalyzer: trainingGapAnalyzer
};
