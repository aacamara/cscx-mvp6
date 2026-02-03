/**
 * PRD-255: Mentor Assignment Service
 *
 * Manages mentor program including:
 * - Mentor opt-in/opt-out with capacity limits
 * - Mentor-mentee matching algorithm
 * - Assignment workflow (create, accept, decline, complete)
 * - Session logging and tracking
 * - Milestone tracking
 * - Program analytics
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  Mentor,
  MentorProfile,
  MentorRecognition,
  MentorshipAssignment,
  MentorshipSession,
  MenteeRampMilestone,
  MentorMatch,
  MentorMatchFactors,
  MentorshipProgramMetrics,
  MentorEffectiveness,
  RampComparison,
  MentorWorkloadDistribution,
  CreateMentorRequest,
  UpdateMentorRequest,
  CreateAssignmentRequest,
  CreateSessionRequest,
  CreateMilestoneRequest,
  AssignmentStatus,
  MentorSearchFilters,
  MentorshipGoal,
  ActionItem,
  SharedResource,
} from '../../../../types/mentorship.js';

class MentorshipService {
  private supabase: SupabaseClient | null = null;

  // In-memory stores for fallback/demo
  private mentors: Map<string, Mentor> = new Map();
  private assignments: Map<string, MentorshipAssignment> = new Map();
  private sessions: Map<string, MentorshipSession> = new Map();
  private milestones: Map<string, MenteeRampMilestone> = new Map();
  private recognitions: Map<string, MentorRecognition> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample mentors for demo
    const sampleMentors: Mentor[] = [
      {
        id: 'mentor-001',
        userId: 'user-001',
        userName: 'Sarah Johnson',
        userEmail: 'sarah.johnson@example.com',
        userAvatar: undefined,
        isActive: true,
        status: 'active',
        maxMentees: 3,
        currentMenteeCount: 1,
        expertiseAreas: ['onboarding', 'enterprise', 'renewals', 'executive communication'],
        availabilityNotes: 'Available Tuesdays and Thursdays 2-4pm PT',
        totalMenteesToDate: 8,
        averageRating: 4.8,
        isCertified: true,
        certificationStatus: 'certified',
        certifiedAt: new Date('2024-06-15'),
        tenure: 36,
        performanceScore: 92,
        timezone: 'America/Los_Angeles',
        preferredMeetingDays: ['Tuesday', 'Thursday'],
        bio: 'Senior CSM with 3+ years experience. Passionate about helping new team members succeed.',
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date(),
      },
      {
        id: 'mentor-002',
        userId: 'user-002',
        userName: 'Michael Chen',
        userEmail: 'michael.chen@example.com',
        userAvatar: undefined,
        isActive: true,
        status: 'active',
        maxMentees: 2,
        currentMenteeCount: 2,
        expertiseAreas: ['technical', 'adoption', 'mid-market', 'data analysis'],
        availabilityNotes: 'Mornings work best for me',
        totalMenteesToDate: 5,
        averageRating: 4.6,
        isCertified: true,
        certificationStatus: 'certified',
        certifiedAt: new Date('2024-09-01'),
        tenure: 24,
        performanceScore: 88,
        timezone: 'America/New_York',
        preferredMeetingDays: ['Monday', 'Wednesday', 'Friday'],
        bio: 'Technical CSM with engineering background. Love diving deep into product adoption.',
        createdAt: new Date('2023-06-20'),
        updatedAt: new Date(),
      },
      {
        id: 'mentor-003',
        userId: 'user-003',
        userName: 'Emily Rodriguez',
        userEmail: 'emily.rodriguez@example.com',
        userAvatar: undefined,
        isActive: true,
        status: 'active',
        maxMentees: 2,
        currentMenteeCount: 0,
        expertiseAreas: ['smb', 'expansion', 'customer advocacy', 'process improvement'],
        availabilityNotes: 'Flexible schedule, happy to accommodate',
        totalMenteesToDate: 3,
        averageRating: 4.9,
        isCertified: false,
        certificationStatus: 'in_progress',
        certifiedAt: null,
        tenure: 18,
        performanceScore: 85,
        timezone: 'America/Chicago',
        preferredMeetingDays: ['Tuesday', 'Wednesday', 'Thursday'],
        bio: 'High-volume CSM expert. Specializing in efficient customer engagement.',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date(),
      },
    ];

    sampleMentors.forEach(mentor => this.mentors.set(mentor.id, mentor));

    // Sample assignments
    const sampleAssignments: MentorshipAssignment[] = [
      {
        id: 'assign-001',
        mentorId: 'mentor-001',
        mentorUserId: 'user-001',
        mentorName: 'Sarah Johnson',
        mentorEmail: 'sarah.johnson@example.com',
        menteeUserId: 'user-010',
        menteeName: 'Alex Thompson',
        menteeEmail: 'alex.thompson@example.com',
        assignedByUserId: 'user-100',
        assignedByName: 'Manager Jane',
        startDate: new Date('2025-01-06'),
        expectedEndDate: new Date('2025-04-06'),
        checkInCadence: 'weekly',
        goals: [
          {
            id: 'goal-001',
            goal: 'Complete first successful onboarding independently',
            targetDate: new Date('2025-02-15'),
            achieved: false,
          },
          {
            id: 'goal-002',
            goal: 'Conduct first QBR with mentor observation',
            targetDate: new Date('2025-03-01'),
            achieved: false,
          },
        ],
        milestones: [
          {
            id: 'ms-001',
            name: 'Complete product training',
            targetDate: new Date('2025-01-20'),
            achievedDate: new Date('2025-01-18'),
            verificationMethod: 'system_tracked',
            order: 1,
          },
          {
            id: 'ms-002',
            name: 'Shadow 3 customer calls',
            targetDate: new Date('2025-01-27'),
            verificationMethod: 'mentor_verified',
            order: 2,
          },
        ],
        status: 'active',
        mentorAcceptedAt: new Date('2025-01-07'),
        expectations: 'Weekly 30-min check-ins, async Slack support for questions',
        focusAreas: ['onboarding', 'customer communication'],
        createdAt: new Date('2025-01-06'),
        updatedAt: new Date(),
      },
    ];

    sampleAssignments.forEach(a => this.assignments.set(a.id, a));

    // Sample sessions
    const sampleSessions: MentorshipSession[] = [
      {
        id: 'session-001',
        assignmentId: 'assign-001',
        sessionDate: new Date('2025-01-13'),
        durationMinutes: 30,
        topicsCovered: ['Onboarding best practices', 'Customer communication templates'],
        summary: 'Discussed onboarding workflow and reviewed email templates. Alex is making great progress.',
        actionItems: [
          {
            id: 'ai-001',
            item: 'Review customer communication playbook',
            owner: 'mentee',
            dueDate: new Date('2025-01-17'),
            done: true,
            completedAt: new Date('2025-01-16'),
          },
          {
            id: 'ai-002',
            item: 'Schedule shadow session for next week',
            owner: 'mentor',
            dueDate: new Date('2025-01-15'),
            done: true,
            completedAt: new Date('2025-01-14'),
          },
        ],
        resourcesShared: [
          {
            id: 'res-001',
            type: 'document',
            title: 'Onboarding Checklist Template',
            url: 'https://docs.example.com/onboarding-checklist',
            sharedAt: new Date('2025-01-13'),
          },
        ],
        menteeConfidenceBefore: 3,
        menteeConfidenceAfter: 4,
        sessionQuality: 5,
        loggedBy: 'mentor',
        isScheduled: true,
        createdAt: new Date('2025-01-13'),
      },
      {
        id: 'session-002',
        assignmentId: 'assign-001',
        sessionDate: new Date('2025-01-20'),
        durationMinutes: 45,
        topicsCovered: ['Customer call shadowing debrief', 'Handling objections'],
        summary: 'Debriefed on Alex shadowing a renewal call. Discussed objection handling techniques.',
        actionItems: [
          {
            id: 'ai-003',
            item: 'Practice objection handling with role play',
            owner: 'mentee',
            dueDate: new Date('2025-01-24'),
            done: false,
          },
        ],
        resourcesShared: [],
        menteeConfidenceBefore: 3,
        menteeConfidenceAfter: 4,
        sessionQuality: 5,
        loggedBy: 'mentor',
        isScheduled: true,
        createdAt: new Date('2025-01-20'),
      },
    ];

    sampleSessions.forEach(s => this.sessions.set(s.id, s));
  }

  // ============================================
  // Mentor Management
  // ============================================

  /**
   * Get all mentors with optional filters
   */
  async getMentors(filters?: MentorSearchFilters): Promise<Mentor[]> {
    let mentors = Array.from(this.mentors.values());

    if (filters) {
      if (filters.isAvailable !== undefined) {
        mentors = mentors.filter(m =>
          filters.isAvailable
            ? m.isActive && m.currentMenteeCount < m.maxMentees
            : true
        );
      }
      if (filters.isCertified !== undefined) {
        mentors = mentors.filter(m => m.isCertified === filters.isCertified);
      }
      if (filters.expertiseAreas && filters.expertiseAreas.length > 0) {
        mentors = mentors.filter(m =>
          filters.expertiseAreas!.some(area =>
            m.expertiseAreas.some(e => e.toLowerCase().includes(area.toLowerCase()))
          )
        );
      }
      if (filters.minRating !== undefined) {
        mentors = mentors.filter(m => (m.averageRating || 0) >= filters.minRating!);
      }
      if (filters.timezone) {
        mentors = mentors.filter(m => m.timezone === filters.timezone);
      }
    }

    return mentors.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }

  /**
   * Get a single mentor by ID
   */
  async getMentor(mentorId: string): Promise<Mentor | null> {
    return this.mentors.get(mentorId) || null;
  }

  /**
   * Get mentor profile with assignments and recognitions
   */
  async getMentorProfile(mentorId: string): Promise<MentorProfile | null> {
    const mentor = await this.getMentor(mentorId);
    if (!mentor) return null;

    const assignments = await this.getAssignmentsByMentor(mentorId);
    const activeAssignments = assignments
      .filter(a => a.status === 'active' || a.status === 'pending')
      .map(a => ({
        id: a.id,
        menteeUserId: a.menteeUserId,
        menteeName: a.menteeName,
        startDate: a.startDate,
        status: a.status,
        progress: this.calculateAssignmentProgress(a),
        lastSessionDate: undefined, // TODO: calculate from sessions
        nextSessionDate: undefined,
      }));

    const pastAssignments = assignments
      .filter(a => a.status === 'completed' || a.status === 'cancelled')
      .map(a => ({
        id: a.id,
        menteeUserId: a.menteeUserId,
        menteeName: a.menteeName,
        startDate: a.startDate,
        status: a.status,
        progress: 100,
      }));

    const recognitions = Array.from(this.recognitions.values())
      .filter(r => r.mentorId === mentorId);

    return {
      ...mentor,
      user: {
        id: mentor.userId,
        name: mentor.userName,
        email: mentor.userEmail,
        role: 'CSM',
        avatar: mentor.userAvatar,
      },
      activeAssignments,
      pastAssignments,
      recognitions,
    };
  }

  /**
   * Create a new mentor (opt-in)
   */
  async createMentor(userId: string, userName: string, userEmail: string, request: CreateMentorRequest): Promise<Mentor> {
    const id = uuidv4();
    const mentor: Mentor = {
      id,
      userId,
      userName,
      userEmail,
      isActive: true,
      status: 'active',
      maxMentees: request.maxMentees || 2,
      currentMenteeCount: 0,
      expertiseAreas: request.expertiseAreas,
      availabilityNotes: request.availabilityNotes,
      totalMenteesToDate: 0,
      averageRating: null,
      isCertified: false,
      certificationStatus: 'not_certified',
      certifiedAt: null,
      tenure: 0, // Would be calculated from user data
      bio: request.bio,
      preferredMeetingDays: request.preferredMeetingDays,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mentors.set(id, mentor);
    console.log(`[MentorshipService] Created mentor ${id} for user ${userId}`);
    return mentor;
  }

  /**
   * Update mentor settings
   */
  async updateMentor(mentorId: string, request: UpdateMentorRequest): Promise<Mentor | null> {
    const mentor = this.mentors.get(mentorId);
    if (!mentor) return null;

    const updated: Mentor = {
      ...mentor,
      isActive: request.isActive ?? mentor.isActive,
      maxMentees: request.maxMentees ?? mentor.maxMentees,
      expertiseAreas: request.expertiseAreas ?? mentor.expertiseAreas,
      availabilityNotes: request.availabilityNotes ?? mentor.availabilityNotes,
      bio: request.bio ?? mentor.bio,
      preferredMeetingDays: request.preferredMeetingDays ?? mentor.preferredMeetingDays,
      updatedAt: new Date(),
    };

    this.mentors.set(mentorId, updated);
    console.log(`[MentorshipService] Updated mentor ${mentorId}`);
    return updated;
  }

  /**
   * Deactivate mentor (opt-out)
   */
  async deactivateMentor(mentorId: string): Promise<boolean> {
    const mentor = this.mentors.get(mentorId);
    if (!mentor) return false;

    // Check for active assignments
    const activeAssignments = Array.from(this.assignments.values())
      .filter(a => a.mentorId === mentorId && (a.status === 'active' || a.status === 'pending'));

    if (activeAssignments.length > 0) {
      console.log(`[MentorshipService] Cannot deactivate mentor ${mentorId} - has ${activeAssignments.length} active assignments`);
      return false;
    }

    mentor.isActive = false;
    mentor.status = 'inactive';
    mentor.updatedAt = new Date();
    this.mentors.set(mentorId, mentor);
    console.log(`[MentorshipService] Deactivated mentor ${mentorId}`);
    return true;
  }

  // ============================================
  // Mentor Matching
  // ============================================

  /**
   * Find best mentor matches for a mentee
   */
  async findBestMentors(menteeUserId: string, menteeNeeds?: string[]): Promise<MentorMatch[]> {
    const availableMentors = Array.from(this.mentors.values())
      .filter(m => m.isActive && m.currentMenteeCount < m.maxMentees && m.userId !== menteeUserId);

    const matches: MentorMatch[] = [];

    for (const mentor of availableMentors) {
      const factors = await this.calculateMatchFactors(mentor, menteeUserId, menteeNeeds);
      const matchScore = this.calculateMatchScore(factors);
      const reasoning = this.generateMatchReasoning(mentor, factors);

      matches.push({
        mentorId: mentor.id,
        mentor,
        matchScore,
        factors,
        reasoning,
      });
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  private async calculateMatchFactors(
    mentor: Mentor,
    menteeUserId: string,
    menteeNeeds?: string[]
  ): Promise<MentorMatchFactors> {
    // Calculate expertise overlap
    const expertiseOverlap = menteeNeeds && menteeNeeds.length > 0
      ? menteeNeeds.filter(need =>
          mentor.expertiseAreas.some(e => e.toLowerCase().includes(need.toLowerCase()))
        ).length / menteeNeeds.length
      : 0.5;

    // Capacity check
    const capacityAvailable = mentor.currentMenteeCount < mentor.maxMentees;

    // Location/timezone match (simplified - would use actual mentee data)
    const timezoneMatch = true; // Placeholder
    const locationMatch = timezoneMatch;

    // Past success rate
    const pastAssignments = Array.from(this.assignments.values())
      .filter(a => a.mentorId === mentor.id && a.status === 'completed');
    const successfulAssignments = pastAssignments.filter(a => (a.menteeRating || 0) >= 4);
    const pastSuccessRate = pastAssignments.length > 0
      ? successfulAssignments.length / pastAssignments.length
      : 0.5;

    // Tenure score (normalized, max at 36 months)
    const tenureScore = Math.min(mentor.tenure / 36, 1);

    return {
      expertiseOverlap,
      capacityAvailable,
      locationMatch,
      timezoneMatch,
      pastSuccessRate,
      tenureScore,
    };
  }

  private calculateMatchScore(factors: MentorMatchFactors): number {
    // Weighted scoring
    const weights = {
      expertiseOverlap: 35,
      capacityAvailable: 10,
      locationMatch: 10,
      timezoneMatch: 10,
      pastSuccessRate: 25,
      tenureScore: 10,
    };

    return Math.round(
      factors.expertiseOverlap * weights.expertiseOverlap +
      (factors.capacityAvailable ? weights.capacityAvailable : 0) +
      (factors.locationMatch ? weights.locationMatch : 0) +
      (factors.timezoneMatch ? weights.timezoneMatch : 0) +
      factors.pastSuccessRate * weights.pastSuccessRate +
      factors.tenureScore * weights.tenureScore
    );
  }

  private generateMatchReasoning(mentor: Mentor, factors: MentorMatchFactors): string[] {
    const reasons: string[] = [];

    if (factors.expertiseOverlap >= 0.7) {
      reasons.push(`Strong expertise alignment (${Math.round(factors.expertiseOverlap * 100)}%)`);
    } else if (factors.expertiseOverlap >= 0.4) {
      reasons.push(`Moderate expertise alignment (${Math.round(factors.expertiseOverlap * 100)}%)`);
    }

    if (mentor.isCertified) {
      reasons.push('Certified mentor');
    }

    if (factors.pastSuccessRate >= 0.8) {
      reasons.push(`Excellent track record (${Math.round(factors.pastSuccessRate * 100)}% success)`);
    }

    if ((mentor.averageRating || 0) >= 4.5) {
      reasons.push(`Highly rated (${mentor.averageRating}/5)`);
    }

    if (factors.timezoneMatch) {
      reasons.push('Compatible timezone');
    }

    if (mentor.currentMenteeCount === 0) {
      reasons.push('Has full availability');
    }

    return reasons;
  }

  // ============================================
  // Assignment Management
  // ============================================

  /**
   * Create a new mentorship assignment
   */
  async createAssignment(request: CreateAssignmentRequest, assignedByUserId?: string, assignedByName?: string): Promise<MentorshipAssignment> {
    const mentor = this.mentors.get(request.mentorId);
    if (!mentor) {
      throw new Error(`Mentor ${request.mentorId} not found`);
    }

    if (mentor.currentMenteeCount >= mentor.maxMentees) {
      throw new Error(`Mentor ${mentor.userName} is at capacity`);
    }

    const id = uuidv4();
    const goals: MentorshipGoal[] = (request.goals || []).map(g => ({
      id: uuidv4(),
      goal: g.goal,
      targetDate: new Date(g.targetDate),
      achieved: false,
    }));

    const assignment: MentorshipAssignment = {
      id,
      mentorId: request.mentorId,
      mentorUserId: mentor.userId,
      mentorName: mentor.userName,
      mentorEmail: mentor.userEmail,
      menteeUserId: request.menteeUserId,
      menteeName: 'New CSM', // Would fetch from user service
      menteeEmail: 'new.csm@example.com',
      assignedByUserId,
      assignedByName,
      startDate: new Date(request.startDate),
      expectedEndDate: request.expectedEndDate ? new Date(request.expectedEndDate) : undefined,
      checkInCadence: request.checkInCadence || 'weekly',
      goals,
      milestones: [],
      status: 'pending',
      expectations: request.expectations,
      focusAreas: request.focusAreas,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.assignments.set(id, assignment);
    console.log(`[MentorshipService] Created assignment ${id} - Mentor: ${mentor.userName}, Mentee: ${assignment.menteeName}`);
    return assignment;
  }

  /**
   * Get all assignments with optional filters
   */
  async getAssignments(filters?: { status?: AssignmentStatus; menteeUserId?: string }): Promise<MentorshipAssignment[]> {
    let assignments = Array.from(this.assignments.values());

    if (filters) {
      if (filters.status) {
        assignments = assignments.filter(a => a.status === filters.status);
      }
      if (filters.menteeUserId) {
        assignments = assignments.filter(a => a.menteeUserId === filters.menteeUserId);
      }
    }

    return assignments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get assignments by mentor
   */
  async getAssignmentsByMentor(mentorId: string): Promise<MentorshipAssignment[]> {
    return Array.from(this.assignments.values())
      .filter(a => a.mentorId === mentorId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a single assignment
   */
  async getAssignment(assignmentId: string): Promise<MentorshipAssignment | null> {
    return this.assignments.get(assignmentId) || null;
  }

  /**
   * Accept mentorship assignment
   */
  async acceptAssignment(assignmentId: string, notes?: string): Promise<MentorshipAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return null;

    if (assignment.status !== 'pending') {
      throw new Error(`Cannot accept assignment with status: ${assignment.status}`);
    }

    assignment.status = 'active';
    assignment.mentorAcceptedAt = new Date();
    if (notes) {
      assignment.expectations = (assignment.expectations || '') + `\n\nMentor notes: ${notes}`;
    }
    assignment.updatedAt = new Date();

    // Update mentor's mentee count
    const mentor = this.mentors.get(assignment.mentorId);
    if (mentor) {
      mentor.currentMenteeCount++;
      mentor.updatedAt = new Date();
      this.mentors.set(assignment.mentorId, mentor);
    }

    this.assignments.set(assignmentId, assignment);
    console.log(`[MentorshipService] Assignment ${assignmentId} accepted`);
    return assignment;
  }

  /**
   * Decline mentorship assignment
   */
  async declineAssignment(assignmentId: string, reason: string): Promise<MentorshipAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return null;

    if (assignment.status !== 'pending') {
      throw new Error(`Cannot decline assignment with status: ${assignment.status}`);
    }

    assignment.status = 'cancelled';
    assignment.mentorDeclinedAt = new Date();
    assignment.declineReason = reason;
    assignment.updatedAt = new Date();

    this.assignments.set(assignmentId, assignment);
    console.log(`[MentorshipService] Assignment ${assignmentId} declined: ${reason}`);
    return assignment;
  }

  /**
   * Complete mentorship assignment
   */
  async completeAssignment(assignmentId: string, completionNotes?: string, mentorFeedback?: string): Promise<MentorshipAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return null;

    if (assignment.status !== 'active') {
      throw new Error(`Cannot complete assignment with status: ${assignment.status}`);
    }

    assignment.status = 'completed';
    assignment.actualEndDate = new Date();
    assignment.completionNotes = completionNotes;
    assignment.mentorFeedback = mentorFeedback;
    assignment.updatedAt = new Date();

    // Update mentor stats
    const mentor = this.mentors.get(assignment.mentorId);
    if (mentor) {
      mentor.currentMenteeCount = Math.max(0, mentor.currentMenteeCount - 1);
      mentor.totalMenteesToDate++;
      mentor.updatedAt = new Date();
      this.mentors.set(assignment.mentorId, mentor);
    }

    this.assignments.set(assignmentId, assignment);
    console.log(`[MentorshipService] Assignment ${assignmentId} completed`);
    return assignment;
  }

  /**
   * Provide mentee feedback and rating
   */
  async provideMenteeFeedback(assignmentId: string, feedback: string, rating?: number): Promise<MentorshipAssignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) return null;

    assignment.menteeFeedback = feedback;
    if (rating !== undefined && rating >= 1 && rating <= 5) {
      assignment.menteeRating = rating;

      // Update mentor's average rating
      const mentor = this.mentors.get(assignment.mentorId);
      if (mentor) {
        const completedAssignments = Array.from(this.assignments.values())
          .filter(a => a.mentorId === assignment.mentorId && a.menteeRating);
        const totalRating = completedAssignments.reduce((sum, a) => sum + (a.menteeRating || 0), 0) + rating;
        mentor.averageRating = totalRating / (completedAssignments.length + 1);
        mentor.updatedAt = new Date();
        this.mentors.set(assignment.mentorId, mentor);
      }
    }
    assignment.updatedAt = new Date();

    this.assignments.set(assignmentId, assignment);
    console.log(`[MentorshipService] Mentee feedback provided for assignment ${assignmentId}`);
    return assignment;
  }

  private calculateAssignmentProgress(assignment: MentorshipAssignment): number {
    const completedGoals = assignment.goals.filter(g => g.achieved).length;
    const completedMilestones = assignment.milestones.filter(m => m.achievedDate).length;
    const totalItems = assignment.goals.length + assignment.milestones.length;

    if (totalItems === 0) {
      // Fallback to time-based progress
      const start = assignment.startDate.getTime();
      const end = (assignment.expectedEndDate || new Date(start + 90 * 24 * 60 * 60 * 1000)).getTime();
      const now = Date.now();
      return Math.min(100, Math.round(((now - start) / (end - start)) * 100));
    }

    return Math.round(((completedGoals + completedMilestones) / totalItems) * 100);
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Create a mentorship session
   */
  async createSession(assignmentId: string, request: CreateSessionRequest, loggedBy: 'mentor' | 'mentee'): Promise<MentorshipSession> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    const id = uuidv4();
    const actionItems: ActionItem[] = (request.actionItems || []).map(ai => ({
      id: uuidv4(),
      item: ai.item,
      owner: ai.owner,
      dueDate: ai.dueDate ? new Date(ai.dueDate) : undefined,
      done: false,
    }));

    const resourcesShared: SharedResource[] = (request.resourcesShared || []).map(r => ({
      id: uuidv4(),
      type: r.type,
      title: r.title,
      url: r.url,
      description: r.description,
      sharedAt: new Date(),
    }));

    const session: MentorshipSession = {
      id,
      assignmentId,
      sessionDate: new Date(request.sessionDate),
      durationMinutes: request.durationMinutes,
      topicsCovered: request.topicsCovered,
      summary: request.summary,
      actionItems,
      resourcesShared,
      menteeConfidenceBefore: request.menteeConfidenceBefore,
      menteeConfidenceAfter: request.menteeConfidenceAfter,
      sessionQuality: request.sessionQuality,
      mentorNotes: request.mentorNotes,
      menteeNotes: request.menteeNotes,
      loggedBy,
      meetingLink: request.meetingLink,
      isScheduled: true,
      createdAt: new Date(),
    };

    this.sessions.set(id, session);
    console.log(`[MentorshipService] Created session ${id} for assignment ${assignmentId}`);
    return session;
  }

  /**
   * Get sessions for an assignment
   */
  async getSessionsByAssignment(assignmentId: string): Promise<MentorshipSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.assignmentId === assignmentId)
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, updates: Partial<CreateSessionRequest>): Promise<MentorshipSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (updates.topicsCovered) session.topicsCovered = updates.topicsCovered;
    if (updates.summary !== undefined) session.summary = updates.summary;
    if (updates.menteeConfidenceBefore !== undefined) session.menteeConfidenceBefore = updates.menteeConfidenceBefore;
    if (updates.menteeConfidenceAfter !== undefined) session.menteeConfidenceAfter = updates.menteeConfidenceAfter;
    if (updates.sessionQuality !== undefined) session.sessionQuality = updates.sessionQuality;
    if (updates.mentorNotes !== undefined) session.mentorNotes = updates.mentorNotes;
    if (updates.menteeNotes !== undefined) session.menteeNotes = updates.menteeNotes;

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Complete action item
   */
  async completeActionItem(sessionId: string, actionItemId: string): Promise<MentorshipSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const actionItem = session.actionItems.find(ai => ai.id === actionItemId);
    if (actionItem) {
      actionItem.done = true;
      actionItem.completedAt = new Date();
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  // ============================================
  // Milestone Management
  // ============================================

  /**
   * Create a ramp milestone
   */
  async createMilestone(assignmentId: string, request: CreateMilestoneRequest): Promise<MenteeRampMilestone> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    const existingMilestones = await this.getMilestonesByAssignment(assignmentId);
    const id = uuidv4();

    const milestone: MenteeRampMilestone = {
      id,
      assignmentId,
      menteeUserId: assignment.menteeUserId,
      milestoneName: request.milestoneName,
      description: request.description,
      targetDate: request.targetDate ? new Date(request.targetDate) : undefined,
      verificationMethod: 'mentor_verified',
      category: request.category,
      order: request.order ?? existingMilestones.length + 1,
      createdAt: new Date(),
    };

    this.milestones.set(id, milestone);
    console.log(`[MentorshipService] Created milestone ${id} for assignment ${assignmentId}`);
    return milestone;
  }

  /**
   * Get milestones for an assignment
   */
  async getMilestonesByAssignment(assignmentId: string): Promise<MenteeRampMilestone[]> {
    return Array.from(this.milestones.values())
      .filter(m => m.assignmentId === assignmentId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Complete a milestone
   */
  async completeMilestone(milestoneId: string, verifiedByUserId?: string, verifiedByUserName?: string): Promise<MenteeRampMilestone | null> {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone) return null;

    milestone.achievedDate = new Date();
    milestone.verifiedByUserId = verifiedByUserId;
    milestone.verifiedByUserName = verifiedByUserName;
    milestone.verificationMethod = verifiedByUserId ? 'mentor_verified' : 'self_report';

    this.milestones.set(milestoneId, milestone);
    console.log(`[MentorshipService] Milestone ${milestoneId} completed`);
    return milestone;
  }

  // ============================================
  // Analytics
  // ============================================

  /**
   * Get program metrics
   */
  async getProgramMetrics(): Promise<MentorshipProgramMetrics> {
    const mentors = Array.from(this.mentors.values());
    const assignments = Array.from(this.assignments.values());
    const sessions = Array.from(this.sessions.values());

    const activeMentors = mentors.filter(m => m.isActive);
    const activeAssignments = assignments.filter(a => a.status === 'active');
    const completedAssignments = assignments.filter(a => a.status === 'completed');

    // Calculate average session frequency (sessions per month per active assignment)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recentSessions = sessions.filter(s => s.sessionDate.getTime() >= thirtyDaysAgo);
    const avgSessionFrequency = activeAssignments.length > 0
      ? recentSessions.length / activeAssignments.length
      : 0;

    // Calculate satisfaction scores
    const ratingsSum = completedAssignments.reduce((sum, a) => sum + (a.menteeRating || 0), 0);
    const ratedAssignments = completedAssignments.filter(a => a.menteeRating);
    const avgMenteeSatisfaction = ratedAssignments.length > 0
      ? ratingsSum / ratedAssignments.length
      : 0;

    return {
      totalActiveMentors: activeMentors.length,
      totalActiveMentees: activeAssignments.length,
      totalActiveAssignments: activeAssignments.length,
      mentorshipCoverage: 85, // Would calculate from actual new CSM data
      avgRampTimeWithMentor: 45, // Would calculate from actual milestone data
      avgRampTimeWithoutMentor: 60,
      rampTimeReduction: 25,
      avgSessionFrequency,
      avgSessionCompletionRate: 92,
      avgMenteeSatisfaction,
      avgMentorSatisfaction: 4.2,
    };
  }

  /**
   * Get ramp time comparison (mentored vs non-mentored)
   */
  async getRampComparison(): Promise<RampComparison[]> {
    // This would calculate from actual data
    // Returning sample data for demo
    return [
      {
        period: 'Q4 2024',
        mentoredCSMs: {
          count: 8,
          avgRampDays: 42,
          avgFirstMonthPerformance: 78,
          retentionRate: 100,
        },
        nonMentoredCSMs: {
          count: 3,
          avgRampDays: 58,
          avgFirstMonthPerformance: 65,
          retentionRate: 67,
        },
      },
      {
        period: 'Q1 2025',
        mentoredCSMs: {
          count: 5,
          avgRampDays: 38,
          avgFirstMonthPerformance: 82,
          retentionRate: 100,
        },
        nonMentoredCSMs: {
          count: 1,
          avgRampDays: 55,
          avgFirstMonthPerformance: 60,
          retentionRate: 100,
        },
      },
    ];
  }

  /**
   * Get mentor effectiveness rankings
   */
  async getMentorEffectiveness(): Promise<MentorEffectiveness[]> {
    const mentors = Array.from(this.mentors.values()).filter(m => m.totalMenteesToDate > 0);
    const assignments = Array.from(this.assignments.values());
    const sessions = Array.from(this.sessions.values());

    const effectiveness: MentorEffectiveness[] = mentors.map((mentor, index) => {
      const mentorAssignments = assignments.filter(a => a.mentorId === mentor.id);
      const completedAssignments = mentorAssignments.filter(a => a.status === 'completed');
      const mentorSessions = sessions.filter(s =>
        mentorAssignments.some(a => a.id === s.assignmentId)
      );

      const ratedAssignments = completedAssignments.filter(a => a.menteeRating);
      const avgRating = ratedAssignments.length > 0
        ? ratedAssignments.reduce((sum, a) => sum + (a.menteeRating || 0), 0) / ratedAssignments.length
        : 0;

      return {
        mentorId: mentor.id,
        mentorName: mentor.userName,
        totalMentees: mentor.totalMenteesToDate,
        avgMenteeRating: avgRating,
        avgRampTimeReduction: 20 + Math.random() * 15, // Would calculate from actual data
        sessionCompletionRate: mentorSessions.length > 0 ? 90 + Math.random() * 10 : 0,
        goalAchievementRate: 75 + Math.random() * 20,
        milestoneCompletionRate: 80 + Math.random() * 18,
        rank: index + 1,
      };
    });

    return effectiveness
      .sort((a, b) => b.avgMenteeRating - a.avgMenteeRating)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  /**
   * Get mentor workload distribution
   */
  async getMentorWorkload(): Promise<MentorWorkloadDistribution[]> {
    const mentors = Array.from(this.mentors.values()).filter(m => m.isActive);
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    return mentors.map(mentor => {
      const mentorAssignments = Array.from(this.assignments.values())
        .filter(a => a.mentorId === mentor.id && a.status === 'active');

      const mentorSessions = sessions.filter(s =>
        mentorAssignments.some(a => a.id === s.assignmentId) &&
        s.sessionDate.getTime() >= sevenDaysAgo
      );

      const lastSession = sessions
        .filter(s => mentorAssignments.some(a => a.id === s.assignmentId))
        .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())[0];

      return {
        mentorId: mentor.id,
        mentorName: mentor.userName,
        currentMentees: mentor.currentMenteeCount,
        maxMentees: mentor.maxMentees,
        utilizationRate: (mentor.currentMenteeCount / mentor.maxMentees) * 100,
        avgSessionsPerWeek: mentorSessions.length,
        lastSessionDate: lastSession?.sessionDate,
      };
    });
  }
}

export const mentorshipService = new MentorshipService();
