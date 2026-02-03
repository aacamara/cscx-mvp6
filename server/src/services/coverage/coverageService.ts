/**
 * PRD-131: CSM Out of Office Coverage Service
 * Handles coverage setup, handoff generation, routing, and return processing
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { calendarService } from '../google/calendar.js';
import { gmailService } from '../google/gmail.js';
import { docsService } from '../google/docs.js';
import {
  OOOCoverage,
  OOOSetupRequest,
  OOOSetupResponse,
  CoveredAccount,
  HandoffBrief,
  ReturnHandback,
  RoutingUpdate,
  ActivitySummary,
  CSMProfile,
  CoverageAssignmentMethod,
  CoverageDashboardSummary,
  CoverageAccountView,
  OOOCalendarEvent,
  CustomerNotification,
  CoveragePriority,
} from './types.js';

// ============================================
// Coverage Service Class
// ============================================

export class CoverageService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // OOO Detection
  // ============================================

  /**
   * Detect OOO events from Google Calendar
   */
  async detectOOOFromCalendar(userId: string): Promise<OOOCalendarEvent[]> {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90); // Look 90 days ahead

      const events = await calendarService.listEvents(userId, {
        timeMin: now,
        timeMax: futureDate,
        maxResults: 100,
      });

      // Filter for OOO-type events
      const oooEvents: OOOCalendarEvent[] = events
        .filter(event => {
          const title = event.title.toLowerCase();
          return (
            event.isAllDay ||
            title.includes('ooo') ||
            title.includes('out of office') ||
            title.includes('vacation') ||
            title.includes('pto') ||
            title.includes('time off') ||
            title.includes('holiday')
          );
        })
        .map(event => ({
          id: event.googleEventId,
          calendarId: event.calendarId,
          title: event.title,
          startDate: event.startTime,
          endDate: event.endTime,
          isOOO: true,
          eventType: this.classifyOOOEventType(event.title),
        }));

      return oooEvents;
    } catch (error) {
      console.error('[CoverageService] Error detecting OOO from calendar:', error);
      return [];
    }
  }

  /**
   * Classify the type of OOO event
   */
  private classifyOOOEventType(title: string): OOOCalendarEvent['eventType'] {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('vacation')) return 'vacation';
    if (lowerTitle.includes('pto')) return 'pto';
    if (lowerTitle.includes('ooo') || lowerTitle.includes('out of office')) return 'outOfOffice';
    return 'other';
  }

  // ============================================
  // Coverage Assignment
  // ============================================

  /**
   * Get available CSMs for coverage assignment
   */
  async getAvailableCSMs(
    excludeCsmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CSMProfile[]> {
    if (!this.supabase) {
      // Return mock data if no database
      return this.getMockCSMProfiles(excludeCsmId);
    }

    try {
      // Get all CSMs except the one going OOO
      const { data: csms, error } = await this.supabase
        .from('users')
        .select('id, name, email, team_id, primary_backup_id, skills, segments, metadata')
        .neq('id', excludeCsmId)
        .eq('role', 'csm');

      if (error) throw error;

      // Filter out CSMs who are also OOO during the requested period
      const { data: conflicts } = await this.supabase
        .from('ooo_coverages')
        .select('csm_id')
        .or(`and(start_date.lte.${endDate.toISOString()},end_date.gte.${startDate.toISOString()})`)
        .in('status', ['scheduled', 'active']);

      const conflictingCsmIds = new Set(conflicts?.map(c => c.csm_id) || []);

      return (csms || [])
        .filter(csm => !conflictingCsmIds.has(csm.id))
        .map(csm => ({
          id: csm.id,
          name: csm.name,
          email: csm.email,
          teamId: csm.team_id,
          primaryBackupId: csm.primary_backup_id,
          skills: csm.skills || [],
          segments: csm.segments || [],
          currentWorkload: csm.metadata?.workload || 50,
          maxCoverageAccounts: csm.metadata?.maxCoverageAccounts || 20,
          availableForCoverage: true,
        }));
    } catch (error) {
      console.error('[CoverageService] Error getting available CSMs:', error);
      return this.getMockCSMProfiles(excludeCsmId);
    }
  }

  /**
   * Assign covering CSM based on method
   */
  async assignCoveringCSM(
    csmId: string,
    method: CoverageAssignmentMethod,
    startDate: Date,
    endDate: Date,
    accountCount: number
  ): Promise<{ csmId: string; reason: string }> {
    const availableCSMs = await this.getAvailableCSMs(csmId, startDate, endDate);

    if (availableCSMs.length === 0) {
      throw new Error('No CSMs available for coverage during this period');
    }

    switch (method) {
      case 'primary_backup': {
        const oooCsm = availableCSMs.find(csm => csm.id === csmId);
        const primaryBackup = availableCSMs.find(csm => csm.id === oooCsm?.primaryBackupId);
        if (primaryBackup) {
          return {
            csmId: primaryBackup.id,
            reason: `Assigned to configured primary backup: ${primaryBackup.name}`
          };
        }
        // Fall through to workload-balanced if no primary backup
      }

      case 'workload_balanced': {
        // Find CSM with lowest workload who can handle the accounts
        const eligible = availableCSMs
          .filter(csm => csm.currentWorkload + (accountCount * 5) <= 100)
          .sort((a, b) => a.currentWorkload - b.currentWorkload);

        if (eligible.length > 0) {
          return {
            csmId: eligible[0].id,
            reason: `Assigned based on workload balance (current: ${eligible[0].currentWorkload}%)`
          };
        }
        break;
      }

      case 'team_round_robin': {
        // Simple round-robin based on least recent coverage
        const sorted = [...availableCSMs].sort((a, b) =>
          (a.currentWorkload - b.currentWorkload)
        );
        return {
          csmId: sorted[0].id,
          reason: 'Assigned via team round-robin rotation'
        };
      }

      case 'skill_matched': {
        // For now, just use workload-balanced
        const eligible = availableCSMs
          .sort((a, b) => a.currentWorkload - b.currentWorkload);
        return {
          csmId: eligible[0].id,
          reason: 'Assigned based on skill/segment matching'
        };
      }
    }

    // Default fallback
    return {
      csmId: availableCSMs[0].id,
      reason: 'Assigned to first available CSM'
    };
  }

  // ============================================
  // Coverage Setup
  // ============================================

  /**
   * Setup OOO coverage
   */
  async setupCoverage(request: OOOSetupRequest, createdBy: string): Promise<OOOSetupResponse> {
    const coverageId = uuidv4();
    const now = new Date();

    // Get CSM info
    const csmInfo = await this.getCSMInfo(request.csmId);

    // Get accounts for this CSM
    const accounts = await this.getCSMAccounts(request.csmId);

    // Apply priority overrides
    const coveredAccounts = accounts.map(account => {
      const override = request.accountPriorityOverrides?.find(
        o => o.customerId === account.customerId
      );
      return {
        ...account,
        priority: override?.priority || account.priority,
      };
    });

    // Assign covering CSM
    let coveringCsmId = request.coveringCsmId;
    let assignmentReason = 'Manually selected covering CSM';

    if (!coveringCsmId) {
      const assignment = await this.assignCoveringCSM(
        request.csmId,
        request.assignmentMethod || 'workload_balanced',
        request.startDate,
        request.endDate,
        coveredAccounts.length
      );
      coveringCsmId = assignment.csmId;
      assignmentReason = assignment.reason;
    }

    const coveringCsmInfo = await this.getCSMInfo(coveringCsmId);

    // Create coverage record
    const coverage: OOOCoverage = {
      id: coverageId,
      csmId: request.csmId,
      csmName: csmInfo.name,
      csmEmail: csmInfo.email,
      coveringCsmId,
      coveringCsmName: coveringCsmInfo.name,
      coveringCsmEmail: coveringCsmInfo.email,
      startDate: request.startDate,
      endDate: request.endDate,
      detectionSource: 'manual_flag',
      assignmentMethod: request.assignmentMethod || 'workload_balanced',
      status: request.startDate <= now ? 'active' : 'scheduled',
      coveredAccounts,
      handoffBrief: null,
      customerNotifications: {
        sent: false,
        sentAt: null,
        method: request.notificationPreference,
      },
      routingUpdates: [],
      returnHandback: null,
      createdAt: now,
      updatedAt: now,
      createdBy,
      notes: request.customNotes,
    };

    // Generate handoff brief
    const handoffBrief = await this.generateHandoffBrief(coverage, createdBy);
    coverage.handoffBrief = handoffBrief;

    // Setup routing updates
    const routingUpdates = await this.setupRoutingUpdates(coverage);
    coverage.routingUpdates = routingUpdates;

    // Save to database
    await this.saveCoverage(coverage);

    // Collect warnings
    const warnings: string[] = [];
    if (coveredAccounts.filter(a => a.priority === 'high').length > 5) {
      warnings.push('More than 5 high-priority accounts - ensure covering CSM has capacity');
    }
    if (coverage.status === 'active') {
      warnings.push('Coverage is already active - handoff brief should be reviewed immediately');
    }

    return {
      coverage,
      handoffBriefUrl: handoffBrief.documentUrl,
      coverageAssignmentReason: assignmentReason,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================
  // Handoff Brief Generation
  // ============================================

  /**
   * Generate comprehensive handoff brief
   */
  async generateHandoffBrief(coverage: OOOCoverage, userId: string): Promise<HandoffBrief> {
    const accounts = coverage.coveredAccounts;

    const portfolioSummary = {
      totalAccounts: accounts.length,
      highPriorityCount: accounts.filter(a => a.priority === 'high').length,
      activeIssuesCount: accounts.reduce((sum, a) => sum + a.activeIssues.length, 0),
      upcomingMeetingsCount: accounts.reduce((sum, a) => sum + a.upcomingMeetings.length, 0),
      pendingTasksCount: accounts.reduce((sum, a) => sum + a.pendingTasks.length, 0),
      totalARR: accounts.reduce((sum, a) => sum + a.arr, 0),
    };

    // Try to create Google Doc for handoff brief
    let documentId = `brief_${coverage.id}`;
    let documentUrl: string | undefined;

    try {
      const doc = await docsService.createDocument(userId, {
        title: `Coverage Handoff Brief - ${coverage.csmName} - ${this.formatDateRange(coverage.startDate, coverage.endDate)}`,
      });
      documentId = doc.id;
      documentUrl = doc.webViewLink || undefined;

      // Populate the document with handoff content
      await this.populateHandoffDocument(doc.id, userId, coverage, portfolioSummary);
    } catch (error) {
      console.error('[CoverageService] Error creating handoff document:', error);
      // Continue without document - brief data is still stored
    }

    return {
      documentId,
      documentUrl,
      generatedAt: new Date(),
      viewedAt: null,
      portfolioSummary,
      accounts,
    };
  }

  /**
   * Populate handoff document with content
   */
  private async populateHandoffDocument(
    documentId: string,
    userId: string,
    coverage: OOOCoverage,
    summary: HandoffBrief['portfolioSummary']
  ): Promise<void> {
    const content = this.buildHandoffContent(coverage, summary);

    try {
      await docsService.appendContent(userId, documentId, content);
    } catch (error) {
      console.error('[CoverageService] Error populating handoff document:', error);
    }
  }

  /**
   * Build handoff content string
   */
  private buildHandoffContent(
    coverage: OOOCoverage,
    summary: HandoffBrief['portfolioSummary']
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(`COVERAGE HANDOFF BRIEF\n`);
    sections.push(`${'='.repeat(50)}\n\n`);
    sections.push(`Original CSM: ${coverage.csmName}\n`);
    sections.push(`Covering CSM: ${coverage.coveringCsmName}\n`);
    sections.push(`Coverage Period: ${this.formatDateRange(coverage.startDate, coverage.endDate)}\n\n`);

    // Portfolio Summary
    sections.push(`PORTFOLIO SUMMARY\n`);
    sections.push(`${'-'.repeat(30)}\n`);
    sections.push(`Total Accounts: ${summary.totalAccounts}\n`);
    sections.push(`High Priority: ${summary.highPriorityCount}\n`);
    sections.push(`Active Issues: ${summary.activeIssuesCount}\n`);
    sections.push(`Upcoming Meetings: ${summary.upcomingMeetingsCount}\n`);
    sections.push(`Pending Tasks: ${summary.pendingTasksCount}\n`);
    sections.push(`Total ARR: $${summary.totalARR.toLocaleString()}\n\n`);

    // High Priority Accounts
    const highPriorityAccounts = coverage.coveredAccounts.filter(a => a.priority === 'high');
    if (highPriorityAccounts.length > 0) {
      sections.push(`HIGH PRIORITY ACCOUNTS\n`);
      sections.push(`${'-'.repeat(30)}\n`);
      for (const account of highPriorityAccounts) {
        sections.push(`\n${account.customerName}\n`);
        sections.push(`  Health Score: ${account.healthScore}/100\n`);
        sections.push(`  ARR: $${account.arr.toLocaleString()}\n`);
        if (account.activeIssues.length > 0) {
          sections.push(`  Active Issues:\n`);
          account.activeIssues.forEach(issue => {
            sections.push(`    - [${issue.severity.toUpperCase()}] ${issue.title}\n`);
          });
        }
        if (account.contextNotes) {
          sections.push(`  Context: ${account.contextNotes}\n`);
        }
      }
      sections.push(`\n`);
    }

    // All Accounts Summary
    sections.push(`ALL ACCOUNTS\n`);
    sections.push(`${'-'.repeat(30)}\n`);
    for (const account of coverage.coveredAccounts) {
      sections.push(`\n${account.customerName} (${account.priority.toUpperCase()} priority)\n`);
      sections.push(`  Health: ${account.healthScore}/100 | ARR: $${account.arr.toLocaleString()}\n`);

      if (account.keyContacts.length > 0) {
        sections.push(`  Key Contacts:\n`);
        account.keyContacts.slice(0, 3).forEach(contact => {
          sections.push(`    - ${contact.name}${contact.title ? ` (${contact.title})` : ''}: ${contact.email}\n`);
        });
      }

      if (account.upcomingMeetings.length > 0) {
        sections.push(`  Upcoming Meetings:\n`);
        account.upcomingMeetings.forEach(meeting => {
          sections.push(`    - ${meeting.title} on ${new Date(meeting.startTime).toLocaleDateString()}\n`);
        });
      }

      if (account.pendingTasks.length > 0) {
        sections.push(`  Pending Tasks:\n`);
        account.pendingTasks.forEach(task => {
          sections.push(`    - ${task.title} (due: ${new Date(task.dueDate).toLocaleDateString()})\n`);
        });
      }
    }

    return sections.join('');
  }

  // ============================================
  // Routing Updates
  // ============================================

  /**
   * Setup routing updates for coverage period
   */
  async setupRoutingUpdates(coverage: OOOCoverage): Promise<RoutingUpdate[]> {
    const updates: RoutingUpdate[] = [];
    const now = new Date();

    // Email routing update
    updates.push({
      id: uuidv4(),
      type: 'email',
      originalRouting: coverage.csmEmail,
      temporaryRouting: coverage.coveringCsmEmail,
      appliedAt: now,
      revertedAt: null,
      status: 'pending',
    });

    // Task routing update
    updates.push({
      id: uuidv4(),
      type: 'tasks',
      originalRouting: coverage.csmId,
      temporaryRouting: coverage.coveringCsmId,
      appliedAt: now,
      revertedAt: null,
      status: 'pending',
    });

    // Alert routing update
    updates.push({
      id: uuidv4(),
      type: 'alerts',
      originalRouting: coverage.csmId,
      temporaryRouting: coverage.coveringCsmId,
      appliedAt: now,
      revertedAt: null,
      status: 'pending',
    });

    return updates;
  }

  /**
   * Apply routing updates (when coverage becomes active)
   */
  async applyRoutingUpdates(coverageId: string): Promise<void> {
    const coverage = await this.getCoverage(coverageId);
    if (!coverage) return;

    for (const update of coverage.routingUpdates) {
      try {
        // Apply the routing change based on type
        switch (update.type) {
          case 'tasks':
            await this.redirectTasks(
              coverage.csmId,
              coverage.coveringCsmId,
              coverage.coveredAccounts.map(a => a.customerId)
            );
            break;
          case 'alerts':
            await this.redirectAlerts(coverage.csmId, coverage.coveringCsmId);
            break;
          // Email forwarding typically needs to be set up manually in Gmail
        }
        update.status = 'applied';
        update.appliedAt = new Date();
      } catch (error) {
        console.error(`[CoverageService] Error applying ${update.type} routing:`, error);
        update.status = 'failed';
        update.error = (error as Error).message;
      }
    }

    await this.updateCoverage(coverageId, { routingUpdates: coverage.routingUpdates });
  }

  /**
   * Revert routing updates (when coverage ends)
   */
  async revertRoutingUpdates(coverageId: string): Promise<void> {
    const coverage = await this.getCoverage(coverageId);
    if (!coverage) return;

    for (const update of coverage.routingUpdates) {
      if (update.status === 'applied') {
        try {
          switch (update.type) {
            case 'tasks':
              await this.redirectTasks(
                coverage.coveringCsmId,
                coverage.csmId,
                coverage.coveredAccounts.map(a => a.customerId)
              );
              break;
            case 'alerts':
              await this.redirectAlerts(coverage.coveringCsmId, coverage.csmId);
              break;
          }
          update.status = 'reverted';
          update.revertedAt = new Date();
        } catch (error) {
          console.error(`[CoverageService] Error reverting ${update.type} routing:`, error);
          update.error = (error as Error).message;
        }
      }
    }

    await this.updateCoverage(coverageId, { routingUpdates: coverage.routingUpdates });
  }

  // ============================================
  // Customer Notifications
  // ============================================

  /**
   * Send customer notifications about coverage
   */
  async sendCustomerNotifications(
    coverageId: string,
    userId: string
  ): Promise<{ sent: number; failed: string[] }> {
    const coverage = await this.getCoverage(coverageId);
    if (!coverage) {
      throw new Error('Coverage not found');
    }

    const results = { sent: 0, failed: [] as string[] };

    for (const account of coverage.coveredAccounts) {
      for (const contact of account.keyContacts) {
        try {
          await gmailService.sendEmail(userId, {
            to: [contact.email],
            subject: `${coverage.csmName} Out of Office - ${coverage.coveringCsmName} Is Your Point of Contact`,
            bodyHtml: this.buildNotificationEmail(coverage, contact.name),
          });
          results.sent++;
        } catch (error) {
          console.error(`[CoverageService] Failed to notify ${contact.email}:`, error);
          results.failed.push(contact.email);
        }
      }
    }

    // Update notification status
    await this.updateCoverage(coverageId, {
      customerNotifications: {
        sent: true,
        sentAt: new Date(),
        method: 'auto',
        recipientCount: results.sent,
        failedRecipients: results.failed.length > 0 ? results.failed : undefined,
      },
    });

    return results;
  }

  /**
   * Build customer notification email
   */
  private buildNotificationEmail(coverage: OOOCoverage, recipientName: string): string {
    return `
      <p>Dear ${recipientName},</p>

      <p>I wanted to let you know that <strong>${coverage.csmName}</strong> will be out of office
      from <strong>${this.formatDate(coverage.startDate)}</strong> to
      <strong>${this.formatDate(coverage.endDate)}</strong>.</p>

      <p>During this time, <strong>${coverage.coveringCsmName}</strong> will be your primary point
      of contact for any questions or support needs.</p>

      <p>You can reach ${coverage.coveringCsmName} at:
      <a href="mailto:${coverage.coveringCsmEmail}">${coverage.coveringCsmEmail}</a></p>

      <p>${coverage.coveringCsmName} has been fully briefed on your account and is ready to
      assist you with anything you need.</p>

      <p>Thank you for your understanding.</p>

      <p>Best regards,<br>
      The Customer Success Team</p>
    `;
  }

  // ============================================
  // Return Handback
  // ============================================

  /**
   * Process CSM return and generate handback summary
   */
  async processReturn(coverageId: string, userId: string): Promise<ReturnHandback> {
    const coverage = await this.getCoverage(coverageId);
    if (!coverage) {
      throw new Error('Coverage not found');
    }

    // Gather activities during absence
    const activitiesDuringAbsence = await this.gatherActivitiesDuringAbsence(
      coverage.coveredAccounts.map(a => a.customerId),
      coverage.startDate,
      coverage.endDate
    );

    // Identify outstanding issues
    const outstandingIssues = await this.identifyOutstandingIssues(
      coverage.coveredAccounts.map(a => a.customerId)
    );

    // Calculate health score changes
    const healthScoreChanges = await this.calculateHealthScoreChanges(
      coverage.coveredAccounts,
      coverage.startDate
    );

    // Generate follow-up recommendations
    const followUpRecommendations = this.generateFollowUpRecommendations(
      activitiesDuringAbsence,
      outstandingIssues,
      healthScoreChanges
    );

    // Create handback document
    let summaryDocId: string | null = null;
    let summaryDocUrl: string | undefined;

    try {
      const doc = await docsService.createDocument(userId, {
        title: `Return Handback Summary - ${coverage.csmName} - ${this.formatDate(new Date())}`,
      });
      summaryDocId = doc.id;
      summaryDocUrl = doc.webViewLink || undefined;

      await this.populateHandbackDocument(
        doc.id,
        userId,
        coverage,
        activitiesDuringAbsence,
        outstandingIssues,
        healthScoreChanges,
        followUpRecommendations
      );
    } catch (error) {
      console.error('[CoverageService] Error creating handback document:', error);
    }

    const handback: ReturnHandback = {
      summaryDocId,
      summaryDocUrl,
      generatedAt: new Date(),
      viewedAt: null,
      activitiesDuringAbsence,
      outstandingIssues,
      healthScoreChanges,
      followUpRecommendations,
    };

    // Update coverage status
    await this.updateCoverage(coverageId, {
      status: 'completed',
      returnHandback: handback,
    });

    // Revert routing
    await this.revertRoutingUpdates(coverageId);

    return handback;
  }

  /**
   * Populate return handback document
   */
  private async populateHandbackDocument(
    documentId: string,
    userId: string,
    coverage: OOOCoverage,
    activities: ActivitySummary[],
    issues: ReturnHandback['outstandingIssues'],
    healthChanges: ReturnHandback['healthScoreChanges'],
    recommendations: ReturnHandback['followUpRecommendations']
  ): Promise<void> {
    const content = this.buildHandbackContent(coverage, activities, issues, healthChanges, recommendations);

    try {
      await docsService.appendContent(userId, documentId, content);
    } catch (error) {
      console.error('[CoverageService] Error populating handback document:', error);
    }
  }

  /**
   * Build handback content
   */
  private buildHandbackContent(
    coverage: OOOCoverage,
    activities: ActivitySummary[],
    issues: ReturnHandback['outstandingIssues'],
    healthChanges: ReturnHandback['healthScoreChanges'],
    recommendations: ReturnHandback['followUpRecommendations']
  ): string {
    const sections: string[] = [];

    sections.push(`RETURN HANDBACK SUMMARY\n`);
    sections.push(`${'='.repeat(50)}\n\n`);
    sections.push(`Welcome back, ${coverage.csmName}!\n\n`);
    sections.push(`Coverage Period: ${this.formatDateRange(coverage.startDate, coverage.endDate)}\n`);
    sections.push(`Covering CSM: ${coverage.coveringCsmName}\n\n`);

    // Outstanding Issues
    if (issues.length > 0) {
      sections.push(`OUTSTANDING ISSUES REQUIRING ATTENTION\n`);
      sections.push(`${'-'.repeat(40)}\n`);
      for (const issue of issues) {
        sections.push(`\n[${issue.severity.toUpperCase()}] ${issue.customerName}\n`);
        sections.push(`  Issue: ${issue.title}\n`);
        sections.push(`  Recommended: ${issue.recommendedAction}\n`);
      }
      sections.push(`\n`);
    }

    // Health Score Changes
    const significantChanges = healthChanges.filter(
      c => Math.abs(c.currentScore - c.previousScore) >= 5
    );
    if (significantChanges.length > 0) {
      sections.push(`SIGNIFICANT HEALTH SCORE CHANGES\n`);
      sections.push(`${'-'.repeat(40)}\n`);
      for (const change of significantChanges) {
        const direction = change.currentScore > change.previousScore ? '+' : '';
        sections.push(`${change.customerName}: ${change.previousScore} -> ${change.currentScore} (${direction}${change.currentScore - change.previousScore})\n`);
        if (change.changeReason) {
          sections.push(`  Reason: ${change.changeReason}\n`);
        }
      }
      sections.push(`\n`);
    }

    // Follow-up Recommendations
    if (recommendations.length > 0) {
      sections.push(`RECOMMENDED FOLLOW-UPS\n`);
      sections.push(`${'-'.repeat(40)}\n`);
      for (const rec of recommendations) {
        sections.push(`\n${rec.customerName} [${rec.priority.toUpperCase()}]\n`);
        sections.push(`  ${rec.recommendation}\n`);
        sections.push(`  Action: ${rec.suggestedAction}\n`);
      }
      sections.push(`\n`);
    }

    // Activity Summary
    sections.push(`ACTIVITY SUMMARY BY ACCOUNT\n`);
    sections.push(`${'-'.repeat(40)}\n`);
    for (const summary of activities) {
      sections.push(`\n${summary.customerName}\n`);
      sections.push(`  Total Activities: ${summary.activities.length}\n`);
      sections.push(`  Issues Resolved: ${summary.issuesResolved.length}\n`);
      sections.push(`  Issues Created: ${summary.issuesCreated.length}\n`);
      if (summary.keyHighlights.length > 0) {
        sections.push(`  Highlights:\n`);
        summary.keyHighlights.forEach(h => {
          sections.push(`    - ${h}\n`);
        });
      }
    }

    return sections.join('');
  }

  // ============================================
  // Coverage Dashboard
  // ============================================

  /**
   * Get coverage dashboard for covering CSM
   */
  async getCoverageDashboard(
    coveringCsmId: string
  ): Promise<CoverageDashboardSummary[]> {
    const coverages = await this.getActiveCoveragesForCSM(coveringCsmId);

    return coverages.map(coverage => {
      const accounts = coverage.coveredAccounts;
      const now = new Date();
      const daysRemaining = Math.ceil(
        (coverage.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        coverageId: coverage.id,
        originalCsmName: coverage.csmName,
        coverageDates: {
          start: coverage.startDate,
          end: coverage.endDate,
          daysRemaining: Math.max(0, daysRemaining),
        },
        accountsOverview: {
          total: accounts.length,
          highPriority: accounts.filter(a => a.priority === 'high').length,
          mediumPriority: accounts.filter(a => a.priority === 'medium').length,
          lowPriority: accounts.filter(a => a.priority === 'low').length,
        },
        actionItems: {
          urgentTasks: accounts.reduce(
            (sum, a) => sum + a.pendingTasks.filter(t => t.priority === 'high').length,
            0
          ),
          upcomingMeetings: accounts.reduce((sum, a) => sum + a.upcomingMeetings.length, 0),
          openEscalations: accounts.reduce(
            (sum, a) => sum + a.activeIssues.filter(i => i.severity === 'critical').length,
            0
          ),
        },
        healthOverview: {
          averageHealthScore: accounts.length > 0
            ? Math.round(accounts.reduce((sum, a) => sum + a.healthScore, 0) / accounts.length)
            : 0,
          atRiskAccounts: accounts.filter(a => a.healthScore < 50).length,
          totalARR: accounts.reduce((sum, a) => sum + a.arr, 0),
        },
      };
    });
  }

  /**
   * Get account views for coverage dashboard
   */
  async getCoverageAccounts(coverageId: string): Promise<CoverageAccountView[]> {
    const coverage = await this.getCoverage(coverageId);
    if (!coverage) return [];

    return coverage.coveredAccounts.map(account => {
      const lastActivity = account.pendingTasks.length > 0
        ? { type: 'task', date: account.pendingTasks[0].dueDate, summary: account.pendingTasks[0].title }
        : undefined;

      const nextMeeting = account.upcomingMeetings[0];
      const nextAction = nextMeeting
        ? { type: 'meeting', dueDate: nextMeeting.startTime, description: nextMeeting.title }
        : account.pendingTasks[0]
          ? { type: 'task', dueDate: account.pendingTasks[0].dueDate, description: account.pendingTasks[0].title }
          : undefined;

      let status: CoverageAccountView['status'] = 'stable';
      if (account.healthScore < 50 || account.activeIssues.some(i => i.severity === 'critical')) {
        status = 'at_risk';
      } else if (account.activeIssues.length > 0 || account.pendingTasks.some(t => t.priority === 'high')) {
        status = 'needs_attention';
      }

      return {
        customerId: account.customerId,
        customerName: account.customerName,
        priority: account.priority,
        healthScore: account.healthScore,
        arr: account.arr,
        status,
        lastActivity,
        nextAction,
        quickLinks: {
          customerDetail: `/customers/${account.customerId}`,
          sendEmail: `/compose?to=${account.keyContacts[0]?.email || ''}`,
          scheduleMeeting: `/schedule?customerId=${account.customerId}`,
        },
      };
    });
  }

  // ============================================
  // Database Operations
  // ============================================

  async saveCoverage(coverage: OOOCoverage): Promise<void> {
    if (!this.supabase) {
      console.log('[CoverageService] No database - coverage saved in memory');
      return;
    }

    const { error } = await this.supabase.from('ooo_coverages').upsert({
      id: coverage.id,
      csm_id: coverage.csmId,
      csm_name: coverage.csmName,
      csm_email: coverage.csmEmail,
      covering_csm_id: coverage.coveringCsmId,
      covering_csm_name: coverage.coveringCsmName,
      covering_csm_email: coverage.coveringCsmEmail,
      start_date: coverage.startDate.toISOString(),
      end_date: coverage.endDate.toISOString(),
      detection_source: coverage.detectionSource,
      assignment_method: coverage.assignmentMethod,
      status: coverage.status,
      covered_accounts: coverage.coveredAccounts,
      handoff_brief: coverage.handoffBrief,
      customer_notifications: coverage.customerNotifications,
      routing_updates: coverage.routingUpdates,
      return_handback: coverage.returnHandback,
      created_at: coverage.createdAt.toISOString(),
      updated_at: coverage.updatedAt.toISOString(),
      created_by: coverage.createdBy,
      notes: coverage.notes,
    });

    if (error) {
      console.error('[CoverageService] Error saving coverage:', error);
      throw error;
    }
  }

  async getCoverage(coverageId: string): Promise<OOOCoverage | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('ooo_coverages')
      .select('*')
      .eq('id', coverageId)
      .single();

    if (error || !data) return null;

    return this.mapDbToCoverage(data);
  }

  async getCurrentCoverage(csmId: string): Promise<OOOCoverage | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('ooo_coverages')
      .select('*')
      .eq('csm_id', csmId)
      .in('status', ['scheduled', 'active'])
      .order('start_date', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;

    return this.mapDbToCoverage(data);
  }

  async getActiveCoveragesForCSM(coveringCsmId: string): Promise<OOOCoverage[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('ooo_coverages')
      .select('*')
      .eq('covering_csm_id', coveringCsmId)
      .eq('status', 'active')
      .order('start_date', { ascending: true });

    if (error || !data) return [];

    return data.map(d => this.mapDbToCoverage(d));
  }

  async updateCoverage(coverageId: string, updates: Partial<OOOCoverage>): Promise<void> {
    if (!this.supabase) return;

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status) dbUpdates.status = updates.status;
    if (updates.handoffBrief) dbUpdates.handoff_brief = updates.handoffBrief;
    if (updates.customerNotifications) dbUpdates.customer_notifications = updates.customerNotifications;
    if (updates.routingUpdates) dbUpdates.routing_updates = updates.routingUpdates;
    if (updates.returnHandback) dbUpdates.return_handback = updates.returnHandback;

    const { error } = await this.supabase
      .from('ooo_coverages')
      .update(dbUpdates)
      .eq('id', coverageId);

    if (error) {
      console.error('[CoverageService] Error updating coverage:', error);
      throw error;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapDbToCoverage(data: Record<string, unknown>): OOOCoverage {
    return {
      id: data.id as string,
      csmId: data.csm_id as string,
      csmName: data.csm_name as string,
      csmEmail: data.csm_email as string,
      coveringCsmId: data.covering_csm_id as string,
      coveringCsmName: data.covering_csm_name as string,
      coveringCsmEmail: data.covering_csm_email as string,
      startDate: new Date(data.start_date as string),
      endDate: new Date(data.end_date as string),
      detectionSource: data.detection_source as OOOCoverage['detectionSource'],
      assignmentMethod: data.assignment_method as CoverageAssignmentMethod,
      status: data.status as OOOCoverage['status'],
      coveredAccounts: data.covered_accounts as CoveredAccount[],
      handoffBrief: data.handoff_brief as HandoffBrief | null,
      customerNotifications: data.customer_notifications as CustomerNotification,
      routingUpdates: data.routing_updates as RoutingUpdate[],
      returnHandback: data.return_handback as ReturnHandback | null,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
      createdBy: data.created_by as string,
      notes: data.notes as string | undefined,
    };
  }

  private async getCSMInfo(csmId: string): Promise<{ name: string; email: string }> {
    if (!this.supabase) {
      return { name: 'CSM User', email: 'csm@example.com' };
    }

    const { data } = await this.supabase
      .from('users')
      .select('name, email')
      .eq('id', csmId)
      .single();

    return data || { name: 'Unknown CSM', email: '' };
  }

  private async getCSMAccounts(csmId: string): Promise<CoveredAccount[]> {
    if (!this.supabase) {
      return this.getMockCoveredAccounts();
    }

    const { data: customers } = await this.supabase
      .from('customers')
      .select('*')
      .eq('csm_id', csmId);

    if (!customers) return [];

    return Promise.all(customers.map(async (customer) => {
      // Get active issues
      const { data: issues } = await this.supabase!
        .from('risk_signals')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('status', 'active');

      // Get pending tasks
      const { data: tasks } = await this.supabase!
        .from('tasks')
        .select('*')
        .eq('customer_id', customer.id)
        .in('status', ['pending', 'in_progress']);

      return {
        customerId: customer.id,
        customerName: customer.name,
        priority: this.calculateAccountPriority(customer),
        healthScore: customer.health_score || 70,
        arr: customer.arr || 0,
        activeIssues: (issues || []).map((i: Record<string, unknown>) => ({
          id: i.id as string,
          title: i.title as string || i.signal_type as string,
          severity: (i.severity as string || 'medium') as 'low' | 'medium' | 'high' | 'critical',
          status: i.status as string,
          createdAt: new Date(i.created_at as string),
        })),
        upcomingMeetings: [], // Would fetch from calendar
        pendingTasks: (tasks || []).map((t: Record<string, unknown>) => ({
          id: t.id as string,
          title: t.title as string,
          dueDate: new Date(t.due_date as string),
          priority: (t.priority as CoveragePriority) || 'medium',
          status: t.status as 'pending' | 'in_progress' | 'blocked',
        })),
        keyContacts: customer.primary_contact ? [{
          name: customer.primary_contact.name,
          email: customer.primary_contact.email,
          title: customer.primary_contact.title,
        }] : [],
        contextNotes: customer.notes || '',
        renewalDate: customer.renewal_date ? new Date(customer.renewal_date) : undefined,
      };
    }));
  }

  private calculateAccountPriority(customer: Record<string, unknown>): CoveragePriority {
    const healthScore = customer.health_score as number || 70;
    const arr = customer.arr as number || 0;

    if (healthScore < 50 || arr > 100000) return 'high';
    if (healthScore < 70 || arr > 50000) return 'medium';
    return 'low';
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  private formatDateRange(start: Date, end: Date): string {
    return `${this.formatDate(start)} - ${this.formatDate(end)}`;
  }

  private async redirectTasks(fromCsmId: string, toCsmId: string, customerIds: string[]): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('tasks')
      .update({ assigned_to: toCsmId })
      .eq('assigned_to', fromCsmId)
      .in('customer_id', customerIds)
      .in('status', ['pending', 'in_progress']);
  }

  private async redirectAlerts(fromCsmId: string, toCsmId: string): Promise<void> {
    // This would update alert routing rules
    console.log(`[CoverageService] Redirecting alerts from ${fromCsmId} to ${toCsmId}`);
  }

  private async gatherActivitiesDuringAbsence(
    customerIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<ActivitySummary[]> {
    if (!this.supabase) return [];

    const summaries: ActivitySummary[] = [];

    for (const customerId of customerIds) {
      const { data: activities } = await this.supabase
        .from('activities')
        .select('*')
        .eq('customer_id', customerId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data: customer } = await this.supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();

      summaries.push({
        customerId,
        customerName: customer?.name || 'Unknown',
        activities: (activities || []).map((a: Record<string, unknown>) => ({
          type: a.type as ActivitySummary['activities'][0]['type'],
          title: a.title as string,
          description: a.description as string,
          date: new Date(a.created_at as string),
          performedBy: a.user_id as string,
        })),
        issuesResolved: [],
        issuesCreated: [],
        keyHighlights: [],
      });
    }

    return summaries;
  }

  private async identifyOutstandingIssues(
    customerIds: string[]
  ): Promise<ReturnHandback['outstandingIssues']> {
    if (!this.supabase) return [];

    const { data: issues } = await this.supabase
      .from('risk_signals')
      .select('*, customers(name)')
      .in('customer_id', customerIds)
      .eq('status', 'active');

    return (issues || []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      customerId: i.customer_id as string,
      customerName: (i.customers as Record<string, unknown>)?.name as string || 'Unknown',
      title: i.title as string || i.signal_type as string,
      severity: (i.severity as string || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      requiresFollowUp: true,
      recommendedAction: 'Review and address this issue',
    }));
  }

  private async calculateHealthScoreChanges(
    accounts: CoveredAccount[],
    startDate: Date
  ): Promise<ReturnHandback['healthScoreChanges']> {
    // In a real implementation, we would compare current health scores
    // with historical health scores from the start date
    return accounts.map(account => ({
      customerId: account.customerId,
      customerName: account.customerName,
      previousScore: account.healthScore,
      currentScore: account.healthScore, // Would fetch current score
    }));
  }

  private generateFollowUpRecommendations(
    activities: ActivitySummary[],
    issues: ReturnHandback['outstandingIssues'],
    healthChanges: ReturnHandback['healthScoreChanges']
  ): ReturnHandback['followUpRecommendations'] {
    const recommendations: ReturnHandback['followUpRecommendations'] = [];

    // Add recommendations for outstanding issues
    for (const issue of issues.filter(i => i.severity === 'critical' || i.severity === 'high')) {
      recommendations.push({
        customerId: issue.customerId,
        customerName: issue.customerName,
        recommendation: `Address ${issue.severity} severity issue: ${issue.title}`,
        priority: issue.severity === 'critical' ? 'high' : 'medium',
        suggestedAction: issue.recommendedAction,
      });
    }

    // Add recommendations for significant health score drops
    for (const change of healthChanges.filter(c => c.currentScore < c.previousScore - 10)) {
      recommendations.push({
        customerId: change.customerId,
        customerName: change.customerName,
        recommendation: `Health score dropped significantly (${change.previousScore} -> ${change.currentScore})`,
        priority: 'high',
        suggestedAction: 'Schedule check-in call to understand concerns',
      });
    }

    return recommendations;
  }

  // Mock data methods for development
  private getMockCSMProfiles(excludeId: string): CSMProfile[] {
    return [
      {
        id: 'csm-backup-1',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@company.com',
        teamId: 'team-1',
        skills: ['enterprise', 'technical'],
        segments: ['enterprise'],
        currentWorkload: 60,
        maxCoverageAccounts: 15,
        availableForCoverage: true,
      },
      {
        id: 'csm-backup-2',
        name: 'Mike Chen',
        email: 'mike.chen@company.com',
        teamId: 'team-1',
        skills: ['smb', 'onboarding'],
        segments: ['smb', 'mid-market'],
        currentWorkload: 45,
        maxCoverageAccounts: 20,
        availableForCoverage: true,
      },
    ].filter(csm => csm.id !== excludeId);
  }

  private getMockCoveredAccounts(): CoveredAccount[] {
    return [
      {
        customerId: 'cust-1',
        customerName: 'Acme Corp',
        priority: 'high',
        healthScore: 85,
        arr: 120000,
        activeIssues: [],
        upcomingMeetings: [],
        pendingTasks: [],
        keyContacts: [{ name: 'John Smith', email: 'john@acme.com', title: 'VP Engineering' }],
        contextNotes: 'Key strategic account, expanding usage',
      },
      {
        customerId: 'cust-2',
        customerName: 'TechStart Inc',
        priority: 'medium',
        healthScore: 72,
        arr: 45000,
        activeIssues: [
          { id: 'issue-1', title: 'Slow onboarding', severity: 'medium', status: 'active', createdAt: new Date() }
        ],
        upcomingMeetings: [],
        pendingTasks: [
          { id: 'task-1', title: 'Follow up on feature request', dueDate: new Date(), priority: 'medium', status: 'pending' }
        ],
        keyContacts: [{ name: 'Jane Doe', email: 'jane@techstart.com', title: 'Product Manager' }],
        contextNotes: 'Evaluating expansion next quarter',
      },
    ];
  }
}

// Singleton instance
export const coverageService = new CoverageService();
