/**
 * Collaboration Services Index
 *
 * Exports all collaboration-related services for team coordination features.
 */

export * from './templateLibrary.js';
export { templateLibraryService, default as templateLibrary } from './templateLibrary.js';

// PRD-260: Team Goal Tracking
export {
  teamAnalyticsService,
  // Types
  type PeriodType,
  type PeriodStatus,
  type GoalType,
  type OwnerType,
  type GoalStatus,
  type TargetDirection,
  type AchievementType,
  type GoalPeriod,
  type Goal,
  type Milestone,
  type GoalProgressPoint,
  type GoalCheckIn,
  type GoalContribution,
  type GoalAchievement,
  type CreateGoalPeriodInput,
  type CreateGoalInput,
  type UpdateGoalInput,
  type TeamDashboard,
  type IndividualDashboard,
  type LeaderboardEntry,
} from './teamAnalytics.js';

// PRD-253: Peer Review Workflow
export { peerReviewService, PeerReviewService } from './peerReview.js';

// PRD-257: Cross-Functional Alignment
export * from './crossFunctionalTypes.js';
export { crossFunctionalService, CrossFunctionalService } from './crossFunctionalService.js';

// PRD-254: Best Practice Sharing (Knowledge Sharing)
export {
  knowledgeSharingService,
  KnowledgeSharingService,
  // Types
  type BestPracticeStatus,
  type BestPracticeCategory,
  type UsageOutcome,
  type Attachment,
  type BestPractice,
  type BestPracticeComment,
  type BestPracticeUsage,
  type CreateBestPracticeInput,
  type UpdateBestPracticeInput,
  type SearchFilters,
  type SearchResult,
  type BestPracticeRecommendation,
} from './knowledgeSharing.js';

// PRD-258: Coverage Backup System
export * from './types.js';
export { coverageBackupService, CoverageBackupService } from './coverageBackupService.js';

// PRD-260: Leaderboard
export { leaderboardService } from './leaderboard.js';
