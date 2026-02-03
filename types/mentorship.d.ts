/**
 * PRD-255: Mentor Assignment Types
 *
 * Type definitions for the mentorship program system.
 * Supports formal mentor-mentee relationships, session tracking,
 * milestone tracking, and program analytics.
 */
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
    tenure: number;
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
    startDate: Date;
    expectedEndDate?: Date;
    actualEndDate?: Date;
    checkInCadence: CheckInCadence;
    goals: MentorshipGoal[];
    milestones: MentorshipMilestone[];
    status: AssignmentStatus;
    mentorAcceptedAt?: Date;
    mentorDeclinedAt?: Date;
    declineReason?: string;
    completionNotes?: string;
    mentorFeedback?: string;
    menteeFeedback?: string;
    menteeRating?: number;
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
    progress: number;
    lastSessionDate?: Date;
    nextSessionDate?: Date;
}
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
    topicsCovered: string[];
    summary?: string;
    actionItems: ActionItem[];
    resourcesShared: SharedResource[];
    menteeConfidenceBefore?: number;
    menteeConfidenceAfter?: number;
    sessionQuality?: number;
    mentorNotes?: string;
    menteeNotes?: string;
    loggedBy: SessionLoggedBy;
    meetingLink?: string;
    isScheduled: boolean;
    createdAt: Date;
}
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
export interface MentorMatchFactors {
    expertiseOverlap: number;
    capacityAvailable: boolean;
    locationMatch: boolean;
    timezoneMatch: boolean;
    pastSuccessRate: number;
    tenureScore: number;
}
export interface MentorMatch {
    mentorId: string;
    mentor: Mentor;
    matchScore: number;
    factors: MentorMatchFactors;
    reasoning: string[];
}
export interface MenteeSkillGap {
    skill: string;
    currentLevel: number;
    targetLevel: number;
    priority: 'high' | 'medium' | 'low';
}
export interface MentorshipProgramMetrics {
    totalActiveMentors: number;
    totalActiveMentees: number;
    totalActiveAssignments: number;
    mentorshipCoverage: number;
    avgRampTimeWithMentor: number;
    avgRampTimeWithoutMentor: number;
    rampTimeReduction: number;
    avgSessionFrequency: number;
    avgSessionCompletionRate: number;
    avgMenteeSatisfaction: number;
    avgMentorSatisfaction: number;
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
    goals?: Array<{
        goal: string;
        targetDate: string;
    }>;
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
//# sourceMappingURL=mentorship.d.ts.map