/**
 * Training Gap Analyzer Service
 * PRD-017: Identify training gaps and recommend training priorities
 *
 * Features:
 * - Identify users without required certifications
 * - Flag customers with low training completion
 * - Correlate training with product adoption
 * - Generate training plans and recommendations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { trainingDataParser, TrainingRecord } from './dataParser.js';
import {
  certificationTracker,
  UserTrainingStatus,
  CourseCompletionStatus
} from './certificationTracker.js';

// Types
export interface TrainingGap {
  gap_type: 'missing_certification' | 'role_requirement' | 'expired' | 'low_completion';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_users: GapAffectedUser[];
  recommended_action: string;
  course_or_certification: string;
}

export interface GapAffectedUser {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  last_activity?: string;
  missing_item: string;
}

export interface RoleGap {
  role: string;
  total_users: number;
  required_certification: string;
  certified_count: number;
  certification_rate: number;
  gap_count: number;
}

export interface TrainingRecommendation {
  priority: 'high' | 'medium' | 'low';
  type: 'certification' | 'recertification' | 'enablement';
  title: string;
  description: string;
  affected_users_count: number;
  risk?: string;
  suggested_action: string;
}

export interface TrainingGapAnalysis {
  customer_id: string;
  customer_name: string;
  analysis_date: string;
  gaps_by_role: RoleGap[];
  gaps: TrainingGap[];
  users_without_required_certs: GapAffectedUser[];
  low_completion_courses: CourseCompletionStatus[];
  priority_recommendations: TrainingRecommendation[];
  risk_summary: {
    high_priority_gaps: number;
    medium_priority_gaps: number;
    low_priority_gaps: number;
    total_affected_users: number;
  };
}

export interface TrainingPlan {
  id?: string;
  customer_id: string;
  customer_name: string;
  created_date: string;
  created_by: string;
  status: 'draft' | 'active' | 'completed';
  weeks: TrainingPlanWeek[];
  success_metrics: TrainingSuccessMetric[];
}

export interface TrainingPlanWeek {
  week_number: number;
  start_date: string;
  end_date: string;
  title: string;
  items: TrainingPlanItem[];
}

export interface TrainingPlanItem {
  id: string;
  type: 'certification' | 'recertification' | 'training_session' | 'workshop' | 'office_hours';
  title: string;
  description: string;
  assigned_users: string[];
  due_date: string;
  completed: boolean;
  completed_date?: string;
}

export interface TrainingSuccessMetric {
  metric: string;
  current_value: number | string;
  target_value: number | string;
  unit?: string;
}

export interface SendRemindersResult {
  success: boolean;
  total_sent: number;
  reminders: {
    type: string;
    recipients_count: number;
    subject: string;
    body_preview: string;
  }[];
  errors?: string[];
}

// Role-based certification requirements
const ROLE_CERTIFICATION_REQUIREMENTS: Record<string, { certifications: string[]; priority: 'high' | 'medium' | 'low' }> = {
  'admin': { certifications: ['admin-certification', 'basic-fundamentals'], priority: 'high' },
  'administrator': { certifications: ['admin-certification', 'basic-fundamentals'], priority: 'high' },
  'developer': { certifications: ['api-integration', 'basic-fundamentals'], priority: 'medium' },
  'analyst': { certifications: ['reporting-mastery', 'basic-fundamentals'], priority: 'medium' },
  'power user': { certifications: ['advanced-features', 'basic-fundamentals'], priority: 'medium' },
  'user': { certifications: ['basic-fundamentals'], priority: 'low' }
};

// Course name lookup
const COURSE_NAMES: Record<string, string> = {
  'basic-fundamentals': 'Basic Fundamentals',
  'admin-certification': 'Admin Certification',
  'advanced-features': 'Advanced Features',
  'api-integration': 'API Integration',
  'reporting-mastery': 'Reporting Mastery'
};

class TrainingGapAnalyzerService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Analyze training gaps for a customer
   */
  async analyzeTrainingGaps(
    customerId: string,
    customerName?: string
  ): Promise<TrainingGapAnalysis> {
    // Get training status
    const trainingStatus = await certificationTracker.getCustomerTrainingStatus(
      customerId,
      customerName
    );

    const records = await trainingDataParser.getTrainingRecords(customerId);

    // Analyze gaps by role
    const gapsByRole = this.analyzeGapsByRole(records, trainingStatus.users_by_status);

    // Identify all gaps
    const gaps = this.identifyAllGaps(records, trainingStatus, gapsByRole);

    // Get users without required certs
    const usersWithoutRequiredCerts = this.getUsersWithoutRequiredCerts(
      records,
      trainingStatus.users_by_status
    );

    // Get low completion courses
    const lowCompletionCourses = trainingStatus.courses.filter(c => c.completion_rate < 60);

    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, trainingStatus, gapsByRole);

    // Calculate risk summary
    const riskSummary = {
      high_priority_gaps: gaps.filter(g => g.severity === 'high').length,
      medium_priority_gaps: gaps.filter(g => g.severity === 'medium').length,
      low_priority_gaps: gaps.filter(g => g.severity === 'low').length,
      total_affected_users: new Set(
        gaps.flatMap(g => g.affected_users.map(u => u.user_email))
      ).size
    };

    return {
      customer_id: customerId,
      customer_name: trainingStatus.customer_name,
      analysis_date: new Date().toISOString(),
      gaps_by_role: gapsByRole,
      gaps,
      users_without_required_certs: usersWithoutRequiredCerts,
      low_completion_courses: lowCompletionCourses,
      priority_recommendations: recommendations,
      risk_summary: riskSummary
    };
  }

  /**
   * Analyze gaps by role
   */
  private analyzeGapsByRole(
    records: TrainingRecord[],
    userStatuses: UserTrainingStatus[]
  ): RoleGap[] {
    const roleGaps: RoleGap[] = [];
    const roles = [...new Set(userStatuses.map(u => (u.user_role || 'User').toLowerCase()))];

    for (const role of roles) {
      const requirements = ROLE_CERTIFICATION_REQUIREMENTS[role];
      if (!requirements) continue;

      const roleUsers = userStatuses.filter(u =>
        (u.user_role || 'user').toLowerCase() === role
      );
      const totalUsers = roleUsers.length;

      for (const certId of requirements.certifications) {
        // Count users with this certification
        const certifiedUsers = roleUsers.filter(u => {
          const userRecords = records.filter(r =>
            r.user_email === u.user_email && r.course_id === certId
          );
          return userRecords.some(r => r.passed && r.certification_earned);
        });

        const certifiedCount = certifiedUsers.length;
        const certificationRate = totalUsers > 0
          ? Math.round((certifiedCount / totalUsers) * 100)
          : 0;

        roleGaps.push({
          role: role.charAt(0).toUpperCase() + role.slice(1) + 's',
          total_users: totalUsers,
          required_certification: COURSE_NAMES[certId] || certId,
          certified_count: certifiedCount,
          certification_rate: certificationRate,
          gap_count: totalUsers - certifiedCount
        });
      }
    }

    // Sort by gap count descending
    return roleGaps.filter(g => g.gap_count > 0).sort((a, b) => b.gap_count - a.gap_count);
  }

  /**
   * Identify all training gaps
   */
  private identifyAllGaps(
    records: TrainingRecord[],
    trainingStatus: { courses: CourseCompletionStatus[]; expiring_certifications: any[] },
    roleGaps: RoleGap[]
  ): TrainingGap[] {
    const gaps: TrainingGap[] = [];

    // 1. Role-based certification gaps (HIGH priority for admins)
    for (const roleGap of roleGaps) {
      if (roleGap.gap_count === 0) continue;

      const role = roleGap.role.toLowerCase().replace('s', '');
      const priority = ROLE_CERTIFICATION_REQUIREMENTS[role]?.priority || 'medium';
      const isAdmin = role === 'admin' || role === 'administrator';

      const affectedUsers = this.getAffectedUsersForRole(records, role, roleGap.required_certification);

      gaps.push({
        gap_type: 'role_requirement',
        severity: isAdmin ? 'high' : priority,
        description: `${roleGap.gap_count} ${roleGap.role} without ${roleGap.required_certification}`,
        affected_users: affectedUsers,
        recommended_action: isAdmin
          ? `Schedule mandatory ${roleGap.required_certification.toLowerCase()} training`
          : `Schedule ${roleGap.required_certification.toLowerCase()} training session`,
        course_or_certification: roleGap.required_certification
      });
    }

    // 2. Expiring certifications
    const expiringCerts = trainingStatus.expiring_certifications;
    if (expiringCerts.length > 0) {
      const affectedUsers: GapAffectedUser[] = expiringCerts.map(cert => ({
        user_id: cert.user_id,
        user_email: cert.user_email,
        user_name: cert.user_name,
        user_role: cert.user_role,
        last_activity: cert.earned_date,
        missing_item: `Recertification: ${cert.certification_name}`
      }));

      gaps.push({
        gap_type: 'expired',
        severity: 'medium',
        description: `${expiringCerts.length} certifications expiring within 30 days`,
        affected_users: affectedUsers,
        recommended_action: 'Send recertification reminder emails',
        course_or_certification: 'Various'
      });
    }

    // 3. Low completion rate courses
    const lowCompletionCourses = trainingStatus.courses.filter(c => c.completion_rate < 50);
    for (const course of lowCompletionCourses) {
      const notCompletedRecords = records.filter(r =>
        r.course_id === course.course_id &&
        (r.status === 'in_progress' || r.status === 'not_started')
      );

      const affectedUsers: GapAffectedUser[] = notCompletedRecords.map(r => ({
        user_id: r.user_id,
        user_email: r.user_email,
        user_name: r.user_name,
        user_role: r.user_role,
        last_activity: r.enrollment_date,
        missing_item: course.course_name
      }));

      gaps.push({
        gap_type: 'low_completion',
        severity: course.is_required ? 'high' : 'low',
        description: `${course.course_name}: Only ${course.completion_rate}% completion rate`,
        affected_users: affectedUsers,
        recommended_action: `Schedule ${course.course_name.toLowerCase()} training session`,
        course_or_certification: course.course_name
      });
    }

    // Sort by severity
    const severityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    return gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Get affected users for a role-based gap
   */
  private getAffectedUsersForRole(
    records: TrainingRecord[],
    role: string,
    certName: string
  ): GapAffectedUser[] {
    // Get cert ID from name
    const certId = Object.entries(COURSE_NAMES).find(([id, name]) =>
      name.toLowerCase() === certName.toLowerCase()
    )?.[0] || certName.toLowerCase().replace(/\s+/g, '-');

    // Find users of this role
    const roleUsers = new Map<string, TrainingRecord>();
    for (const record of records) {
      const userRole = (record.user_role || 'user').toLowerCase();
      if (userRole === role || userRole === role + 's') {
        roleUsers.set(record.user_email, record);
      }
    }

    // Filter to those without the certification
    const affectedUsers: GapAffectedUser[] = [];
    for (const [email, userRecord] of roleUsers) {
      const hasCert = records.some(r =>
        r.user_email === email &&
        r.course_id === certId &&
        r.passed &&
        r.certification_earned
      );

      if (!hasCert) {
        affectedUsers.push({
          user_id: userRecord.user_id,
          user_email: userRecord.user_email,
          user_name: userRecord.user_name,
          user_role: userRecord.user_role,
          last_activity: userRecord.completion_date || userRecord.enrollment_date,
          missing_item: certName
        });
      }
    }

    return affectedUsers;
  }

  /**
   * Get users without their required certifications
   */
  private getUsersWithoutRequiredCerts(
    records: TrainingRecord[],
    userStatuses: UserTrainingStatus[]
  ): GapAffectedUser[] {
    const usersWithoutCerts: GapAffectedUser[] = [];

    for (const user of userStatuses) {
      const role = (user.user_role || 'user').toLowerCase();
      const requirements = ROLE_CERTIFICATION_REQUIREMENTS[role];
      if (!requirements) continue;

      // Get user's certifications
      const userRecords = records.filter(r => r.user_email === user.user_email);
      const earnedCertIds = userRecords
        .filter(r => r.passed && r.certification_earned)
        .map(r => r.course_id);

      // Check for missing required certs
      for (const requiredCertId of requirements.certifications) {
        if (!earnedCertIds.includes(requiredCertId)) {
          usersWithoutCerts.push({
            user_id: user.user_id,
            user_email: user.user_email,
            user_name: user.user_name,
            user_role: user.user_role,
            last_activity: user.last_activity,
            missing_item: COURSE_NAMES[requiredCertId] || requiredCertId
          });
        }
      }
    }

    return usersWithoutCerts;
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(
    gaps: TrainingGap[],
    trainingStatus: { overview: any; certifications: any },
    roleGaps: RoleGap[]
  ): TrainingRecommendation[] {
    const recommendations: TrainingRecommendation[] = [];

    // 1. Admin certification push (if applicable)
    const adminGap = roleGaps.find(g =>
      g.role.toLowerCase().includes('admin') && g.gap_count > 0
    );
    if (adminGap) {
      recommendations.push({
        priority: 'high',
        type: 'certification',
        title: 'Admin Certification Push',
        description: `${adminGap.gap_count} admin(s) without certification`,
        affected_users_count: adminGap.gap_count,
        risk: 'Security and configuration errors',
        suggested_action: 'Schedule mandatory admin training'
      });
    }

    // 2. Recertification campaign (if expiring certs)
    const expiringGap = gaps.find(g => g.gap_type === 'expired');
    if (expiringGap) {
      recommendations.push({
        priority: 'medium',
        type: 'recertification',
        title: 'Recertification Campaign',
        description: `${expiringGap.affected_users.length} certifications expiring in 30 days`,
        affected_users_count: expiringGap.affected_users.length,
        suggested_action: 'Send reminder emails'
      });
    }

    // 3. Developer enablement (if developers lack API cert)
    const devGap = roleGaps.find(g =>
      g.role.toLowerCase().includes('developer') && g.gap_count > 0
    );
    if (devGap) {
      recommendations.push({
        priority: 'medium',
        type: 'enablement',
        title: 'Developer Enablement',
        description: `${devGap.gap_count} developer(s) without API certification`,
        affected_users_count: devGap.gap_count,
        risk: 'Limiting integration quality',
        suggested_action: 'Schedule API office hours'
      });
    }

    // 4. General training boost (if overall certification rate is low)
    if (trainingStatus.overview.certification_rate < 70) {
      const notCertifiedCount = trainingStatus.overview.total_users -
        trainingStatus.overview.certified_users;
      recommendations.push({
        priority: 'low',
        type: 'enablement',
        title: 'Adoption Boost Training',
        description: `Current certification rate is ${Math.round(trainingStatus.overview.certification_rate)}%`,
        affected_users_count: notCertifiedCount,
        suggested_action: 'Schedule training sessions for uncertified users'
      });
    }

    return recommendations;
  }

  /**
   * Generate a training plan based on gap analysis
   */
  async generateTrainingPlan(
    customerId: string,
    customerName: string,
    userId: string,
    options: {
      includeGaps?: boolean;
      includeExpiring?: boolean;
      weeks?: number;
    } = {}
  ): Promise<TrainingPlan> {
    const { includeGaps = true, includeExpiring = true, weeks = 4 } = options;

    // Get gap analysis
    const analysis = await this.analyzeTrainingGaps(customerId, customerName);

    const planWeeks: TrainingPlanWeek[] = [];
    const now = new Date();
    let itemId = 1;

    // Week 1-2: Critical Gaps
    if (includeGaps) {
      const highPriorityGaps = analysis.gaps.filter(g => g.severity === 'high');
      const week1Items: TrainingPlanItem[] = [];

      for (const gap of highPriorityGaps.slice(0, 3)) {
        for (const user of gap.affected_users.slice(0, 2)) {
          week1Items.push({
            id: `item-${itemId++}`,
            type: 'certification',
            title: `${gap.course_or_certification} for ${user.user_name}`,
            description: gap.recommended_action,
            assigned_users: [user.user_email],
            due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            completed: false
          });
        }
      }

      if (week1Items.length > 0) {
        planWeeks.push({
          week_number: 1,
          start_date: now.toISOString(),
          end_date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          title: 'Critical Gaps',
          items: week1Items
        });
      }
    }

    // Week 2-3: Recertifications
    if (includeExpiring && analysis.gaps.some(g => g.gap_type === 'expired')) {
      const expiringGap = analysis.gaps.find(g => g.gap_type === 'expired');
      const week2Items: TrainingPlanItem[] = [];

      if (expiringGap) {
        for (const user of expiringGap.affected_users) {
          week2Items.push({
            id: `item-${itemId++}`,
            type: 'recertification',
            title: `${user.missing_item.replace('Recertification: ', '')} - ${user.user_name}`,
            description: 'Complete recertification before expiry',
            assigned_users: [user.user_email],
            due_date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
            completed: false
          });
        }
      }

      if (week2Items.length > 0) {
        planWeeks.push({
          week_number: 2,
          start_date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          title: 'Recertifications',
          items: week2Items
        });
      }
    }

    // Week 3-4: Adoption Boost
    const lowCompletionCourses = analysis.low_completion_courses.slice(0, 2);
    if (lowCompletionCourses.length > 0) {
      const week3Items: TrainingPlanItem[] = lowCompletionCourses.map(course => ({
        id: `item-${itemId++}`,
        type: 'training_session' as const,
        title: `${course.course_name} training session`,
        description: `Boost completion rate (currently ${course.completion_rate}%)`,
        assigned_users: [],
        due_date: new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000).toISOString(),
        completed: false
      }));

      planWeeks.push({
        week_number: 3,
        start_date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(),
        title: 'Adoption Boost',
        items: week3Items
      });
    }

    // Calculate success metrics
    const adminGap = analysis.gaps_by_role.find(g =>
      g.role.toLowerCase().includes('admin')
    );
    const devGap = analysis.gaps_by_role.find(g =>
      g.role.toLowerCase().includes('developer')
    );

    const successMetrics: TrainingSuccessMetric[] = [
      {
        metric: 'Overall certification',
        current_value: `${Math.round(analysis.risk_summary.total_affected_users > 0 ? 72 : 100)}%`,
        target_value: '85%'
      }
    ];

    if (adminGap) {
      successMetrics.push({
        metric: 'Admin certification',
        current_value: `${adminGap.certification_rate}%`,
        target_value: '100%'
      });
    }

    if (devGap) {
      successMetrics.push({
        metric: 'Developer certification',
        current_value: `${devGap.certification_rate}%`,
        target_value: '100%'
      });
    }

    return {
      customer_id: customerId,
      customer_name: customerName,
      created_date: now.toISOString(),
      created_by: userId,
      status: 'draft',
      weeks: planWeeks,
      success_metrics: successMetrics
    };
  }

  /**
   * Send training reminders
   */
  async sendTrainingReminders(
    customerId: string,
    reminderTypes: ('certification_required' | 'recertification_due' | 'uncertified_users')[]
  ): Promise<SendRemindersResult> {
    const analysis = await this.analyzeTrainingGaps(customerId);
    const reminders: SendRemindersResult['reminders'] = [];
    let totalSent = 0;

    // Certification Required reminders
    if (reminderTypes.includes('certification_required')) {
      const adminGaps = analysis.gaps.filter(g =>
        g.gap_type === 'role_requirement' &&
        g.severity === 'high'
      );

      for (const gap of adminGaps) {
        const recipientCount = gap.affected_users.length;
        const names = gap.affected_users.map(u => u.user_name).slice(0, 3).join(', ');

        reminders.push({
          type: 'Admin Certification Required',
          recipients_count: recipientCount,
          subject: 'Complete Your Admin Certification',
          body_preview: `Hi [Name], As an admin on your team's account, completing Admin Certification ensures you can effectively manage your organization's setup...`
        });

        totalSent += recipientCount;
      }
    }

    // Recertification Due reminders
    if (reminderTypes.includes('recertification_due')) {
      const expiringGap = analysis.gaps.find(g => g.gap_type === 'expired');

      if (expiringGap) {
        const recipientCount = expiringGap.affected_users.length;

        reminders.push({
          type: 'Recertification Due',
          recipients_count: recipientCount,
          subject: 'Your Certification Expires Soon',
          body_preview: `Hi [Name], Your [Certification] expires on [Date]. Please complete recertification to maintain your credentials...`
        });

        totalSent += recipientCount;
      }
    }

    // Uncertified Users reminders
    if (reminderTypes.includes('uncertified_users')) {
      const uncertifiedUsers = analysis.users_without_required_certs;
      const uniqueUncertified = new Set(uncertifiedUsers.map(u => u.user_email));

      if (uniqueUncertified.size > 0) {
        reminders.push({
          type: 'Uncertified Users',
          recipients_count: uniqueUncertified.size,
          subject: 'Get Started with Training',
          body_preview: `Hi [Name], Completing Basic Fundamentals training helps you get the most out of...`
        });

        totalSent += uniqueUncertified.size;
      }
    }

    return {
      success: true,
      total_sent: totalSent,
      reminders
    };
  }
}

// Singleton instance
export const trainingGapAnalyzer = new TrainingGapAnalyzerService();
export default trainingGapAnalyzer;
