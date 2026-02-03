/**
 * PRD-131: CSM Out of Office Coverage Service
 * Manages OOO detection, coverage assignment, handoff briefs, and return handback
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { calendarService } from './google/calendar.js';
import {
  OOOCoverage,
  CoverageStatus,
  CoveredAccount,
  HandoffBrief,
  PortfolioSummary,
  AccountBrief,
  ReturnHandback,
  ActivitySummary,
  RoutingUpdate,
  CSM,
  CoverageAssignmentRequest,
  CoverageAssignmentResult,
  OOODetection,
  SetupCoverageRequest,
  CoverageResponse,
  CoverageDashboard,
  CoveragePriority,
} from '../types/coverage.js';

class CoverageService {
  private supabase: SupabaseClient | null = null;

  // In-memory stores for fallback
  private coverages: Map<string, OOOCoverage> = new Map();
  private csms: Map<string, CSM> = new Map();
  private oooDetections: Map<string, OOODetection> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample CSMs for demo
    const sampleCSMs: CSM[] = [
      {
        id: 'csm-001',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        role: 'senior_csm',
        teamId: 'team-enterprise',
        primaryBackupId: 'csm-002',
        segment: 'enterprise',
        skills: ['onboarding', 'renewals', 'technical'],
        currentWorkload: 12,
        maxWorkload: 15,
        isAvailable: true,
      },
      {
        id: 'csm-002',
        name: 'Michael Chen',
        email: 'michael.chen@example.com',
        role: 'csm',
        teamId: 'team-enterprise',
        primaryBackupId: 'csm-001',
        segment: 'enterprise',
        skills: ['onboarding', 'adoption'],
        currentWorkload: 10,
        maxWorkload: 15,
        isAvailable: true,
      },
      {
        id: 'csm-003',
        name: 'Emily Rodriguez',
        email: 'emily.rodriguez@example.com',
        role: 'csm',
        teamId: 'team-mid-market',
        segment: 'mid-market',
        skills: ['renewals', 'expansion'],
        currentWorkload: 18,
        maxWorkload: 20,
        isAvailable: true,
      },
    ];

    sampleCSMs.forEach(csm => this.csms.set(csm.id, csm));
  }

  // ============================================
  // OOO Detection
  // ============================================

  /**
   * Detect OOO events from Google Calendar
   */
  async detectOOOFromCalendar(userId: string, csmId: string): Promise<OOODetection[]> {
    try {
      // Get upcoming events and look for OOO patterns
      const events = await calendarService.getUpcomingEvents(userId, 30);
      const detections: OOODetection[] = [];

      for (const event of events) {
        // Look for OOO indicators in event title/description
        const oooPatterns = [
          /out of office/i,
          /ooo/i,
          /vacation/i,
          /pto/i,
          /time off/i,
          /away/i,
          /leave/i,
        ];

        const isOOO = oooPatterns.some(pattern =>
          pattern.test(event.title) ||
          pattern.test(event.description || '')
        );

        if (isOOO && event.isAllDay) {
          const detection: OOODetection = {
            id: uuidv4(),
            csmId,
            source: 'google_calendar',
            startDate: event.startTime,
            endDate: event.endTime,
            detectedAt: new Date(),
            processed: false,
            rawData: event,
          };

          detections.push(detection);
          this.oooDetections.set(detection.id, detection);
        }
      }

      return detections;
    } catch (error) {
      console.error('[CoverageService] Error detecting OOO from calendar:', error);
      return [];
    }
  }

  /**
   * Set manual OOO flag
   */
  async setManualOOO(
    csmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OOODetection> {
    const detection: OOODetection = {
      id: uuidv4(),
      csmId,
      source: 'manual',
      startDate,
      endDate,
      detectedAt: new Date(),
      processed: false,
    };

    this.oooDetections.set(detection.id, detection);

    if (this.supabase) {
      await this.supabase.from('ooo_detections').insert({
        id: detection.id,
        csm_id: detection.csmId,
        source: detection.source,
        start_date: detection.startDate.toISOString(),
        end_date: detection.endDate.toISOString(),
        detected_at: detection.detectedAt.toISOString(),
        processed: detection.processed,
      });
    }

    return detection;
  }

  // ============================================
  // Coverage Assignment
  // ============================================

  /**
   * Setup coverage for OOO CSM
   */
  async setupCoverage(request: SetupCoverageRequest): Promise<CoverageResponse> {
    try {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);

      // Get CSM information
      const csm = this.csms.get(request.csmId);
      if (!csm) {
        return { success: false, error: 'CSM not found' };
      }

      // Assign covering CSM
      const assignmentResult = await this.assignCoveringCSM({
        csmId: request.csmId,
        startDate,
        endDate,
        reason: request.reason,
        preferredCoveringCsmId: request.coveringCsmId,
        accountPriorities: request.accountPriorities,
        notifyCustomers: request.notifyCustomers,
        notificationMethod: request.notificationMethod,
      });

      if (!assignmentResult.success || !assignmentResult.coveringCsm) {
        return {
          success: false,
          error: assignmentResult.errors?.join(', ') || 'Failed to assign covering CSM'
        };
      }

      // Get covered accounts
      const coveredAccounts = await this.getCoveredAccounts(request.csmId, request.accountPriorities);

      // Generate handoff brief
      const handoffBrief = await this.generateHandoffBrief(coveredAccounts);

      // Create coverage record
      const coverage: OOOCoverage = {
        id: uuidv4(),
        csmId: request.csmId,
        csmName: csm.name,
        csmEmail: csm.email,
        coveringCsmId: assignmentResult.coveringCsm.id,
        coveringCsmName: assignmentResult.coveringCsm.name,
        coveringCsmEmail: assignmentResult.coveringCsm.email,
        startDate,
        endDate,
        status: this.determineCoverageStatus(startDate, endDate),
        reason: request.reason,
        coveredAccounts,
        handoffBrief,
        customerNotifications: {
          enabled: request.notifyCustomers,
          sent: false,
          sentAt: null,
          method: request.notificationMethod,
          customMessage: request.customNotificationMessage,
          notifiedCustomers: [],
        },
        routingUpdates: await this.setupRoutingUpdates(request.csmId, assignmentResult.coveringCsm.id),
        returnHandback: {
          summaryDocId: null,
          generatedAt: null,
          activitiesDuringAbsence: [],
          issuesResolved: [],
          issuesOutstanding: [],
          sentimentChanges: [],
          followUpRecommendations: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: request.csmId,
      };

      // Store coverage
      this.coverages.set(coverage.id, coverage);

      // Save to database if available
      if (this.supabase) {
        await this.saveCoverageToDb(coverage);
      }

      return { success: true, coverage };
    } catch (error) {
      console.error('[CoverageService] Error setting up coverage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Assign covering CSM based on various strategies
   */
  private async assignCoveringCSM(
    request: CoverageAssignmentRequest
  ): Promise<CoverageAssignmentResult> {
    const csm = this.csms.get(request.csmId);
    if (!csm) {
      return {
        success: false,
        assignmentMethod: 'primary_backup',
        errors: ['CSM not found']
      };
    }

    // Strategy 1: Use preferred CSM if specified
    if (request.preferredCoveringCsmId) {
      const preferredCSM = this.csms.get(request.preferredCoveringCsmId);
      if (preferredCSM && preferredCSM.isAvailable) {
        return {
          success: true,
          coveringCsm: preferredCSM,
          assignmentMethod: 'primary_backup',
        };
      }
    }

    // Strategy 2: Use pre-configured primary backup
    if (csm.primaryBackupId) {
      const primaryBackup = this.csms.get(csm.primaryBackupId);
      if (primaryBackup && primaryBackup.isAvailable &&
          primaryBackup.currentWorkload < primaryBackup.maxWorkload) {
        return {
          success: true,
          coveringCsm: primaryBackup,
          assignmentMethod: 'primary_backup',
        };
      }
    }

    // Strategy 3: Workload-balanced assignment from same team
    const teamMembers = Array.from(this.csms.values())
      .filter(c =>
        c.id !== request.csmId &&
        c.teamId === csm.teamId &&
        c.isAvailable &&
        c.currentWorkload < c.maxWorkload
      )
      .sort((a, b) =>
        (a.currentWorkload / a.maxWorkload) - (b.currentWorkload / b.maxWorkload)
      );

    if (teamMembers.length > 0) {
      return {
        success: true,
        coveringCsm: teamMembers[0],
        assignmentMethod: 'workload_balanced',
      };
    }

    // Strategy 4: Skill-matched from other teams
    const skillMatched = Array.from(this.csms.values())
      .filter(c =>
        c.id !== request.csmId &&
        c.isAvailable &&
        c.currentWorkload < c.maxWorkload &&
        c.skills?.some(skill => csm.skills?.includes(skill))
      )
      .sort((a, b) =>
        (a.currentWorkload / a.maxWorkload) - (b.currentWorkload / b.maxWorkload)
      );

    if (skillMatched.length > 0) {
      return {
        success: true,
        coveringCsm: skillMatched[0],
        assignmentMethod: 'skill_matched',
      };
    }

    // Strategy 5: Round-robin from all available CSMs
    const allAvailable = Array.from(this.csms.values())
      .filter(c => c.id !== request.csmId && c.isAvailable);

    if (allAvailable.length > 0) {
      // Simple round-robin: pick the one with lowest workload
      const selected = allAvailable.sort((a, b) => a.currentWorkload - b.currentWorkload)[0];
      return {
        success: true,
        coveringCsm: selected,
        assignmentMethod: 'round_robin',
        warnings: ['Using round-robin assignment as no optimal match found'],
      };
    }

    return {
      success: false,
      assignmentMethod: 'round_robin',
      errors: ['No available CSMs found for coverage'],
    };
  }

  /**
   * Get accounts to be covered
   */
  private async getCoveredAccounts(
    csmId: string,
    accountPriorities?: { customerId: string; priority: CoveragePriority }[]
  ): Promise<CoveredAccount[]> {
    // Try to get from database
    if (this.supabase) {
      const { data: customers } = await this.supabase
        .from('customers')
        .select('*')
        .eq('csm_id', csmId);

      if (customers && customers.length > 0) {
        return customers.map(customer => {
          const customPriority = accountPriorities?.find(
            p => p.customerId === customer.id
          )?.priority;

          return {
            customerId: customer.id,
            customerName: customer.name,
            priority: customPriority || this.calculatePriority(customer),
            healthScore: customer.health_score || 70,
            arr: customer.arr || 0,
            activeIssues: [],
            upcomingMeetings: [],
            pendingTasks: [],
            keyContacts: [],
            contextNotes: '',
            status: customer.stage || 'active',
          };
        });
      }
    }

    // Return sample data for demo
    return [
      {
        customerId: 'cust-001',
        customerName: 'Acme Corporation',
        priority: 'high',
        healthScore: 85,
        arr: 120000,
        activeIssues: [
          {
            id: 'issue-1',
            title: 'Integration delay',
            severity: 'medium',
            status: 'in_progress',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        ],
        upcomingMeetings: [
          {
            id: 'meet-1',
            title: 'Weekly Sync',
            startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            attendees: ['john.smith@acme.com'],
            action: 'delegate',
          },
        ],
        pendingTasks: [
          {
            id: 'task-1',
            title: 'Follow up on feature request',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            priority: 'medium',
            status: 'pending',
          },
        ],
        keyContacts: [
          {
            name: 'John Smith',
            email: 'john.smith@acme.com',
            role: 'VP of Engineering',
          },
        ],
        contextNotes: 'Key renewal coming up in 3 months. Focus on demonstrating ROI.',
        status: 'active',
      },
      {
        customerId: 'cust-002',
        customerName: 'TechStart Inc',
        priority: 'medium',
        healthScore: 72,
        arr: 45000,
        activeIssues: [],
        upcomingMeetings: [],
        pendingTasks: [],
        keyContacts: [
          {
            name: 'Jane Doe',
            email: 'jane.doe@techstart.com',
            role: 'CTO',
          },
        ],
        contextNotes: 'Recently completed onboarding. Monitor adoption closely.',
        status: 'active',
      },
    ];
  }

  private calculatePriority(customer: any): CoveragePriority {
    const healthScore = customer.health_score || 70;
    const arr = customer.arr || 0;

    if (healthScore < 50 || arr > 100000) return 'high';
    if (healthScore < 70 || arr > 50000) return 'medium';
    return 'low';
  }

  // ============================================
  // Handoff Brief Generation
  // ============================================

  /**
   * Generate handoff brief for covering CSM
   */
  private async generateHandoffBrief(accounts: CoveredAccount[]): Promise<HandoffBrief> {
    const portfolioSummary = this.generatePortfolioSummary(accounts);
    const accountBriefs = accounts.map(account => this.generateAccountBrief(account));

    return {
      documentId: uuidv4(),
      generatedAt: new Date(),
      viewedAt: null,
      portfolioSummary,
      accountBriefs,
    };
  }

  private generatePortfolioSummary(accounts: CoveredAccount[]): PortfolioSummary {
    const totalArr = accounts.reduce((sum, a) => sum + a.arr, 0);
    const highPriorityCount = accounts.filter(a => a.priority === 'high').length;
    const atRiskCount = accounts.filter(a => a.healthScore < 60 || a.status === 'at_risk').length;
    const upcomingMeetingsCount = accounts.reduce((sum, a) => sum + a.upcomingMeetings.length, 0);
    const pendingTasksCount = accounts.reduce((sum, a) => sum + a.pendingTasks.length, 0);
    const activeIssuesCount = accounts.reduce((sum, a) => sum + a.activeIssues.length, 0);

    // Generate key highlights
    const keyHighlights: string[] = [];
    if (highPriorityCount > 0) {
      keyHighlights.push(`${highPriorityCount} high-priority account(s) require close attention`);
    }
    if (atRiskCount > 0) {
      keyHighlights.push(`${atRiskCount} account(s) are at risk - monitor health closely`);
    }
    if (upcomingMeetingsCount > 0) {
      keyHighlights.push(`${upcomingMeetingsCount} meetings scheduled during coverage period`);
    }

    // Generate critical actions
    const criticalActions: string[] = [];
    accounts
      .filter(a => a.priority === 'high')
      .forEach(a => {
        if (a.activeIssues.some(i => i.severity === 'critical')) {
          criticalActions.push(`Resolve critical issue for ${a.customerName}`);
        }
        if (a.upcomingMeetings.length > 0) {
          criticalActions.push(`Attend/delegate meetings for ${a.customerName}`);
        }
      });

    return {
      totalAccounts: accounts.length,
      totalArr,
      highPriorityCount,
      atRiskCount,
      upcomingMeetingsCount,
      pendingTasksCount,
      activeIssuesCount,
      keyHighlights,
      criticalActions,
    };
  }

  private generateAccountBrief(account: CoveredAccount): AccountBrief {
    const recommendedActions: string[] = [];

    // Generate recommended actions based on account state
    if (account.activeIssues.length > 0) {
      recommendedActions.push('Follow up on active issues');
    }
    if (account.pendingTasks.length > 0) {
      recommendedActions.push('Complete pending tasks before deadlines');
    }
    if (account.healthScore < 70) {
      recommendedActions.push('Schedule health check call');
    }
    if (account.upcomingMeetings.length > 0) {
      recommendedActions.push('Prepare for scheduled meetings');
    }

    return {
      customerId: account.customerId,
      customerName: account.customerName,
      priority: account.priority,
      currentStatus: account.status,
      healthScore: account.healthScore,
      arr: account.arr,
      activeRisks: account.activeIssues.map(i => i.title),
      pendingDeadlines: [
        ...account.pendingTasks.map(t => ({
          item: t.title,
          date: t.dueDate,
          type: 'task' as const,
        })),
        ...account.upcomingMeetings.map(m => ({
          item: m.title,
          date: m.startTime,
          type: 'meeting' as const,
        })),
      ],
      scheduledMeetings: account.upcomingMeetings,
      ongoingConversations: [],
      keyStakeholders: account.keyContacts,
      contextNotes: account.contextNotes,
      recommendedActions,
    };
  }

  // ============================================
  // Routing Updates
  // ============================================

  private async setupRoutingUpdates(
    csmId: string,
    coveringCsmId: string
  ): Promise<RoutingUpdate[]> {
    const csm = this.csms.get(csmId);
    const coveringCsm = this.csms.get(coveringCsmId);

    if (!csm || !coveringCsm) return [];

    const updates: RoutingUpdate[] = [
      {
        id: uuidv4(),
        type: 'email',
        description: 'Email forwarding/CC to covering CSM',
        originalRouting: csm.email,
        temporaryRouting: coveringCsm.email,
        status: 'pending',
        appliedAt: null,
        revertedAt: null,
      },
      {
        id: uuidv4(),
        type: 'tasks',
        description: 'Task assignment redirect to covering CSM',
        originalRouting: csm.id,
        temporaryRouting: coveringCsm.id,
        status: 'pending',
        appliedAt: null,
        revertedAt: null,
      },
      {
        id: uuidv4(),
        type: 'alerts',
        description: 'Alert routing to covering CSM',
        originalRouting: csm.id,
        temporaryRouting: coveringCsm.id,
        status: 'pending',
        appliedAt: null,
        revertedAt: null,
      },
    ];

    return updates;
  }

  // ============================================
  // Coverage Status Management
  // ============================================

  private determineCoverageStatus(startDate: Date, endDate: Date): CoverageStatus {
    const now = new Date();
    if (now < startDate) return 'scheduled';
    if (now >= startDate && now <= endDate) return 'active';
    return 'completed';
  }

  /**
   * Get current coverage for a CSM
   */
  async getCurrentCoverage(csmId: string): Promise<OOOCoverage | null> {
    const now = new Date();

    // Check in-memory
    for (const coverage of this.coverages.values()) {
      if (coverage.csmId === csmId &&
          coverage.startDate <= now &&
          coverage.endDate >= now &&
          coverage.status !== 'cancelled') {
        return coverage;
      }
    }

    // Check database
    if (this.supabase) {
      const { data } = await this.supabase
        .from('ooo_coverages')
        .select('*')
        .eq('csm_id', csmId)
        .lte('start_date', now.toISOString())
        .gte('end_date', now.toISOString())
        .neq('status', 'cancelled')
        .single();

      if (data) {
        return this.mapDbToCoverage(data);
      }
    }

    return null;
  }

  /**
   * Get coverage by ID
   */
  async getCoverageById(coverageId: string): Promise<OOOCoverage | null> {
    // Check in-memory
    const coverage = this.coverages.get(coverageId);
    if (coverage) return coverage;

    // Check database
    if (this.supabase) {
      const { data } = await this.supabase
        .from('ooo_coverages')
        .select('*')
        .eq('id', coverageId)
        .single();

      if (data) {
        return this.mapDbToCoverage(data);
      }
    }

    return null;
  }

  /**
   * Get coverage dashboard data
   */
  async getCoverageDashboard(csmId: string): Promise<CoverageDashboard> {
    const now = new Date();
    const allCoverages = Array.from(this.coverages.values());

    // Coverages where this CSM is out
    const myActiveCoverage = allCoverages.find(c =>
      c.csmId === csmId &&
      c.startDate <= now &&
      c.endDate >= now &&
      c.status === 'active'
    ) || null;

    // Coverages where this CSM is covering for someone else
    const coveringFor = allCoverages.filter(c =>
      c.coveringCsmId === csmId &&
      c.startDate <= now &&
      c.endDate >= now &&
      c.status === 'active'
    );

    // All active coverages
    const activeCoverages = allCoverages.filter(c => c.status === 'active');

    // Upcoming coverages
    const upcomingCoverages = allCoverages.filter(c =>
      c.status === 'scheduled' && c.startDate > now
    );

    // Recently completed
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentlyCompleted = allCoverages.filter(c =>
      c.status === 'completed' && c.endDate >= thirtyDaysAgo
    );

    return {
      activeCoverages,
      upcomingCoverages,
      myActiveCoverage,
      coveringFor,
      recentlyCompleted,
    };
  }

  // ============================================
  // Handoff Brief Access
  // ============================================

  /**
   * Get handoff brief for a coverage
   */
  async getHandoffBrief(coverageId: string, viewerId: string): Promise<HandoffBrief | null> {
    const coverage = await this.getCoverageById(coverageId);
    if (!coverage) return null;

    // Mark as viewed
    if (!coverage.handoffBrief.viewedAt) {
      coverage.handoffBrief.viewedAt = new Date();
      coverage.handoffBrief.viewedBy = viewerId;
      this.coverages.set(coverageId, coverage);
    }

    return coverage.handoffBrief;
  }

  // ============================================
  // Customer Notifications
  // ============================================

  /**
   * Send customer notifications about coverage
   */
  async sendCustomerNotifications(coverageId: string): Promise<{ success: boolean; sent: number; errors: string[] }> {
    const coverage = await this.getCoverageById(coverageId);
    if (!coverage) {
      return { success: false, sent: 0, errors: ['Coverage not found'] };
    }

    if (!coverage.customerNotifications.enabled) {
      return { success: false, sent: 0, errors: ['Notifications not enabled'] };
    }

    const errors: string[] = [];
    let sent = 0;

    for (const account of coverage.coveredAccounts) {
      for (const contact of account.keyContacts) {
        try {
          // In a real implementation, this would send emails via Gmail API
          console.log(`[CoverageService] Would send notification to ${contact.email}`);

          coverage.customerNotifications.notifiedCustomers.push({
            customerId: account.customerId,
            customerName: account.customerName,
            contactEmail: contact.email,
            contactName: contact.name,
            sentAt: new Date(),
          });
          sent++;
        } catch (error) {
          errors.push(`Failed to notify ${contact.email}: ${error}`);
        }
      }
    }

    coverage.customerNotifications.sent = true;
    coverage.customerNotifications.sentAt = new Date();
    this.coverages.set(coverageId, coverage);

    return { success: errors.length === 0, sent, errors };
  }

  // ============================================
  // Return Handback
  // ============================================

  /**
   * Process CSM return and generate handback summary
   */
  async processReturn(coverageId: string): Promise<ReturnHandback | null> {
    const coverage = await this.getCoverageById(coverageId);
    if (!coverage) return null;

    // Generate activities during absence
    const activitiesDuringAbsence: ActivitySummary[] = [
      {
        id: uuidv4(),
        type: 'email',
        customerId: 'cust-001',
        customerName: 'Acme Corporation',
        title: 'Responded to feature inquiry',
        description: 'Answered questions about upcoming API changes',
        date: new Date(coverage.startDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        performedBy: coverage.coveringCsmName,
        outcome: 'Customer satisfied with response',
      },
      {
        id: uuidv4(),
        type: 'meeting',
        customerId: 'cust-001',
        customerName: 'Acme Corporation',
        title: 'Weekly Sync',
        description: 'Covered weekly sync call',
        date: new Date(coverage.startDate.getTime() + 4 * 24 * 60 * 60 * 1000),
        performedBy: coverage.coveringCsmName,
        outcome: 'Discussed roadmap and timeline',
      },
    ];

    // Calculate sentiment changes
    const sentimentChanges = coverage.coveredAccounts.map(account => ({
      customerId: account.customerId,
      customerName: account.customerName,
      previousHealth: account.healthScore,
      currentHealth: account.healthScore + Math.floor(Math.random() * 10) - 5,
      change: 'stable' as const,
    }));

    // Generate follow-up recommendations
    const followUpRecommendations = coverage.coveredAccounts
      .filter(a => a.priority === 'high' || a.activeIssues.length > 0)
      .map(account => ({
        customerId: account.customerId,
        customerName: account.customerName,
        priority: account.priority,
        action: 'Schedule follow-up call to ensure smooth transition',
        reason: 'High-priority account or has active issues',
        suggestedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      }));

    const handback: ReturnHandback = {
      summaryDocId: uuidv4(),
      generatedAt: new Date(),
      activitiesDuringAbsence,
      issuesResolved: [],
      issuesOutstanding: coverage.coveredAccounts
        .flatMap(a => a.activeIssues)
        .map(issue => ({
          id: issue.id,
          customerId: 'cust-001',
          customerName: 'Acme Corporation',
          title: issue.title,
          severity: issue.severity,
          status: 'in_progress',
          notes: 'Continued work during coverage',
          recommendedAction: 'Follow up within 2 days',
        })),
      sentimentChanges,
      followUpRecommendations,
      coveringCsmNotes: 'Overall smooth coverage period. All critical items addressed.',
    };

    // Update coverage
    coverage.returnHandback = handback;
    coverage.status = 'completed';
    coverage.updatedAt = new Date();
    this.coverages.set(coverageId, coverage);

    // Revert routing updates
    for (const update of coverage.routingUpdates) {
      update.status = 'reverted';
      update.revertedAt = new Date();
    }

    return handback;
  }

  // ============================================
  // Database Helpers
  // ============================================

  private async saveCoverageToDb(coverage: OOOCoverage): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('ooo_coverages').upsert({
        id: coverage.id,
        csm_id: coverage.csmId,
        csm_name: coverage.csmName,
        csm_email: coverage.csmEmail,
        covering_csm_id: coverage.coveringCsmId,
        covering_csm_name: coverage.coveringCsmName,
        covering_csm_email: coverage.coveringCsmEmail,
        start_date: coverage.startDate.toISOString(),
        end_date: coverage.endDate.toISOString(),
        status: coverage.status,
        reason: coverage.reason,
        covered_accounts: coverage.coveredAccounts,
        handoff_brief: coverage.handoffBrief,
        customer_notifications: coverage.customerNotifications,
        routing_updates: coverage.routingUpdates,
        return_handback: coverage.returnHandback,
        created_at: coverage.createdAt.toISOString(),
        updated_at: coverage.updatedAt.toISOString(),
        created_by: coverage.createdBy,
      });
    } catch (error) {
      console.error('[CoverageService] Error saving coverage to DB:', error);
    }
  }

  private mapDbToCoverage(data: any): OOOCoverage {
    return {
      id: data.id,
      csmId: data.csm_id,
      csmName: data.csm_name,
      csmEmail: data.csm_email,
      coveringCsmId: data.covering_csm_id,
      coveringCsmName: data.covering_csm_name,
      coveringCsmEmail: data.covering_csm_email,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      status: data.status,
      reason: data.reason,
      coveredAccounts: data.covered_accounts || [],
      handoffBrief: data.handoff_brief || { documentId: null, generatedAt: null, viewedAt: null, portfolioSummary: {}, accountBriefs: [] },
      customerNotifications: data.customer_notifications || { enabled: false, sent: false, sentAt: null, method: 'none', notifiedCustomers: [] },
      routingUpdates: data.routing_updates || [],
      returnHandback: data.return_handback || { summaryDocId: null, generatedAt: null, activitiesDuringAbsence: [], issuesResolved: [], issuesOutstanding: [], sentimentChanges: [], followUpRecommendations: [] },
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
    };
  }

  // ============================================
  // CSM Management
  // ============================================

  /**
   * Get all CSMs
   */
  async getAllCSMs(): Promise<CSM[]> {
    if (this.supabase) {
      const { data } = await this.supabase.from('csms').select('*');
      if (data) {
        return data.map(this.mapDbToCSM);
      }
    }
    return Array.from(this.csms.values());
  }

  /**
   * Get available CSMs for coverage
   */
  async getAvailableCSMs(excludeCsmId: string): Promise<CSM[]> {
    const allCSMs = await this.getAllCSMs();
    return allCSMs.filter(csm =>
      csm.id !== excludeCsmId &&
      csm.isAvailable &&
      csm.currentWorkload < csm.maxWorkload
    );
  }

  private mapDbToCSM(data: any): CSM {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role || 'csm',
      teamId: data.team_id,
      primaryBackupId: data.primary_backup_id,
      segment: data.segment,
      skills: data.skills || [],
      currentWorkload: data.current_workload || 0,
      maxWorkload: data.max_workload || 15,
      isAvailable: data.is_available !== false,
    };
  }
}

// Singleton instance
export const coverageService = new CoverageService();
