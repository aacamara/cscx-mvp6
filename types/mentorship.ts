/**
 * PRD-255: Mentor Assignment Types
 *
 * Type definitions for the mentorship program system.
 * Supports formal mentor-mentee relationships, session tracking,
 * milestone tracking, and program analytics.
 */

// ============================================
// Mentor Types
// ============================================

export type MentorStatus = 'active' | 'inactive' | 'on_leave';

export type MentorCertificationStatus = 'not_certified' | 'in_progress' | 'certified';

export interface Mentor {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  isActive: boolean;
  status: MentorStatus;
  maxMentees: number;
  currentMenteeCount: number;
  expertiseAreas: string[];
  availabilityNotes?: string;
  totalMenteesToDate: number;
  averageRating: number | null;
  isCertified: boolean;
  certificationStatus: MentorCertificationStatus;
  certifiedAt: Date | null;
  tenure: number; // months
  performanceScore?: number;
  timezone?: string;
  preferredMeetingDays?: string[];
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MentorProfile extends Mentor {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    department?: string;
  };
  activeAssignments: MentorshipAssignmentSummary[];
  pastAssignments: MentorshipAssignmentSummary[];
  recognitions: MentorRecognition[];
}

export interface MentorRecognition {
  id: string;
  mentorId: string;
  type: 'badge' | 'certificate' | 'award';
  title: string;
  description: string;
  awardedAt: Date;
  awardedBy?: string;
}

// ============================================
// Mentorship Assignment Types
// ============================================

export type AssignmentStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'on_hold';

export type CheckInCadence = 'weekly' | 'biweekly' | 'monthly';

export interface MentorshipGoal {
  id: string;
  goal: string;
  targetDate: Date;
  achieved: boolean;
  achievedAt?: Date;
  notes?: string;
}

export interface MentorshipMilestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: Date;
  achievedDate?: Date;
  verificationMethod: 'self_report' | 'mentor_verified' | 'system_tracked';
  verifiedByUserId?: string;
  verifiedByUserName?: string;
  order: number;
}

export interface MentorshipAssignment {
  id: string;
  mentorId: string;
  mentorUserId: string;
  mentorName: string;
  mentorEmail: string;
  menteeUserId: string;
  menteeName: string;
  menteeEmail: string;
  assignedByUserId?: string;
  assignedByName?: string;

  // Configuration
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  checkInCadence: CheckInCadence;

  // Goals & Milestones
  goals: MentorshipGoal[];
  milestones: MentorshipMilestone[];

  // Status
  status: AssignmentStatus;
  mentorAcceptedAt?: Date;
  mentorDeclinedAt?: Date;
  declineReason?: string;

  // Completion
  completionNotes?: string;
  mentorFeedback?: string;
  menteeFeedback?: string;
  menteeRating?: number; // 1-5

  // Metadata
  expectations?: string;
  focusAreas?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MentorshipAssignmentSummary {
  id: string;
  menteeUserId: string;
  menteeName: string;
  startDate: Date;
  status: AssignmentStatus;
  progress: number; // 0-100
  lastSessionDate?: Date;
  nextSessionDate?: Date;
}

// ============================================
// Mentorship Session Types
// ============================================

export type SessionLoggedBy = 'mentor' | 'mentee';

export interface ActionItem {
  id: string;
  item: string;
  owner: 'mentor' | 'mentee';
  dueDate?: Date;
  done: boolean;
  completedAt?: Date;
}

export interface SharedResource {
  id: string;
  type: 'document' | 'link' | 'video' | 'article' | 'other';
  title: string;
  url?: string;
  description?: string;
  sharedAt: Date;
}

export interface MentorshipSession {
  id: string;
  assignmentId: string;
  sessionDate: Date;
  durationMinutes?: number;

  // Content
  topicsCovered: string[];
  summary?: string;
  actionItems: ActionItem[];
  resourcesShared: SharedResource[];

  // Assessment
  menteeConfidenceBefore?: number; // 1-5
  menteeConfidenceAfter?: number; // 1-5
  sessionQuality?: number; // 1-5
  mentorNotes?: string;
  menteeNotes?: string;

  // Metadata
  loggedBy: SessionLoggedBy;
  meetingLink?: string;
  isScheduled: boolean;
  createdAt: Date;
}

// ============================================
// Mentee Ramp Milestone Types
// ============================================

export interface MenteeRampMilestone {
  id: string;
  assignmentId: string;
  menteeUserId: string;
  milestoneName: string;
  description?: string;
  targetDate?: Date;
  achievedDate?: Date;
  verificationMethod: 'self_report' | 'mentor_verified' | 'system_tracked';
  verifiedByUserId?: string;
  verifiedByUserName?: string;
  category?: string;
  order: number;
  createdAt: Date;
}

// ============================================
// Mentor Matching Types
// ============================================

export interface MentorMatchFactors {
  expertiseOverlap: number; // 0-1
  capacityAvailable: boolean;
  locationMatch: boolean;
  timezoneMatch: boolean;
  pastSuccessRate: number; // 0-1
  tenureScore: number; // 0-1
}

export interface MentorMatch {
  mentorId: string;
  mentor: Mentor;
  matchScore: number; // 0-100
  factors: MentorMatchFactors;
  reasoning: string[];
}

export interface MenteeSkillGap {
  skill: string;
  currentLevel: number; // 1-5
  targetLevel: number; // 1-5
  priority: 'high' | 'medium' | 'low';
}

// ============================================
// Program Analytics Types
// ============================================

export interface MentorshipProgramMetrics {
  totalActiveMentors: number;
  totalActiveMentees: number;
  totalActiveAssignments: number;
  mentorshipCoverage: number; // percentage of new CSMs with mentors
  avgRampTimeWithMentor: number; // days
  avgRampTimeWithoutMentor: number; // days
  rampTimeReduction: number; // percentage improvement
  avgSessionFrequency: number; // sessions per month
  avgSessionCompletionRate: number; // percentage
  avgMenteeSatisfaction: number; // 1-5
  avgMentorSatisfaction: number; // 1-5
}

export interface MentorEffectiveness {
  mentorId: string;
  mentorName: string;
  totalMentees: number;
  avgMenteeRating: number;
  avgRampTimeReduction: number;
  sessionCompletionRate: number;
  goalAchievementRate: number;
  milestoneCompletionRate: number;
  rank: number;
}

export interface RampComparison {
  period: string;
  mentoredCSMs: {
    count: number;
    avgRampDays: number;
    avgFirstMonthPerformance: number;
    retentionRate: number;
  };
  nonMentoredCSMs: {
    count: number;
    avgRampDays: number;
    avgFirstMonthPerformance: number;
    retentionRate: number;
  };
}

export interface MentorWorkloadDistribution {
  mentorId: string;
  mentorName: string;
  currentMentees: number;
  maxMentees: number;
  utilizationRate: number;
  avgSessionsPerWeek: number;
  lastSessionDate?: Date;
}

// ============================================
// Request/Response Types
// ============================================

export interface CreateMentorRequest {
  maxMentees?: number;
  expertiseAreas: string[];
  availabilityNotes?: string;
  bio?: string;
  preferredMeetingDays?: string[];
}

export interface UpdateMentorRequest {
  isActive?: boolean;
  maxMentees?: number;
  expertiseAreas?: string[];
  availabilityNotes?: string;
  bio?: string;
  preferredMeetingDays?: string[];
}

export interface CreateAssignmentRequest {
  mentorId: string;
  menteeUserId: string;
  startDate: string;
  expectedEndDate?: string;
  checkInCadence?: CheckInCadence;
  goals?: Array<{ goal: string; targetDate: string }>;
  expectations?: string;
  focusAreas?: string[];
}

export interface AcceptAssignmentRequest {
  notes?: string;
}

export interface DeclineAssignmentRequest {
  reason: string;
}

export interface CompleteAssignmentRequest {
  completionNotes?: string;
  mentorFeedback?: string;
}

export interface CreateSessionRequest {
  sessionDate: string;
  durationMinutes?: number;
  topicsCovered: string[];
  summary?: string;
  actionItems?: Array<{
    item: string;
    owner: 'mentor' | 'mentee';
    dueDate?: string;
  }>;
  resourcesShared?: Array<{
    type: 'document' | 'link' | 'video' | 'article' | 'other';
    title: string;
    url?: string;
    description?: string;
  }>;
  menteeConfidenceBefore?: number;
  menteeConfidenceAfter?: number;
  sessionQuality?: number;
  mentorNotes?: string;
  menteeNotes?: string;
  meetingLink?: string;
}

export interface CreateMilestoneRequest {
  milestoneName: string;
  description?: string;
  targetDate?: string;
  category?: string;
  order?: number;
}

export interface CompleteMilestoneRequest {
  verificationMethod?: 'self_report' | 'mentor_verified';
  notes?: string;
}

export interface ProvideFeedbackRequest {
  feedback: string;
  rating?: number;
}

export interface MentorSearchFilters {
  expertiseAreas?: string[];
  isAvailable?: boolean;
  isCertified?: boolean;
  minRating?: number;
  timezone?: string;
}

// ============================================
// API Response Types
// ============================================

export interface MentorResponse {
  success: boolean;
  mentor?: Mentor;
  mentors?: Mentor[];
  error?: string;
}

export interface AssignmentResponse {
  success: boolean;
  assignment?: MentorshipAssignment;
  assignments?: MentorshipAssignment[];
  error?: string;
}

export interface SessionResponse {
  success: boolean;
  session?: MentorshipSession;
  sessions?: MentorshipSession[];
  error?: string;
}

export interface MatchResponse {
  success: boolean;
  matches?: MentorMatch[];
  error?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  metrics?: MentorshipProgramMetrics;
  rampComparison?: RampComparison[];
  mentorEffectiveness?: MentorEffectiveness[];
  workloadDistribution?: MentorWorkloadDistribution[];
  error?: string;
}
