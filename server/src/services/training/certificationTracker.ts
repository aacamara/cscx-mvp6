/**
 * Certification Tracker Service
 * PRD-017: Track certifications, expiration dates, and certification rates
 *
 * Features:
 * - Calculate certification rates per customer
 * - Track expiring certifications
 * - Compute time-to-certification metrics
 * - Identify users with incomplete/failing certifications
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { trainingDataParser, TrainingRecord, TrainingStatus, CourseType } from './dataParser.js';

// Types
export interface CustomerTrainingStatus {
  customer_id: string;
  customer_name: string;
  overview: TrainingOverview;
  courses: CourseCompletionStatus[];
  certifications: CertificationOverview;
  expiring_certifications: UserCertification[];
  users_by_status: UserTrainingStatus[];
  training_vs_adoption: TrainingAdoptionCorrelation;
}

export interface TrainingOverview {
  total_users: number;
  certified_users: number;
  in_progress_users: number;
  not_started_users: number;
  certification_rate: number;
  avg_time_to_complete: number;
  overall_pass_rate: number;
}

export interface CourseCompletionStatus {
  course_id: string;
  course_name: string;
  course_type: CourseType;
  enrolled_count: number;
  completed_count: number;
  completion_rate: number;
  pass_rate: number;
  avg_score?: number;
  avg_days_to_complete: number;
  is_required?: boolean;
}

export interface CertificationOverview {
  total_certifications: number;
  active_certifications: number;
  expiring_soon: number;
  expired: number;
  certification_rate: number;
}

export interface UserCertification {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  certification_id: string;
  certification_name: string;
  earned_date: string;
  expires_date?: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'revoked';
  score: number;
  days_until_expiry?: number;
}

export interface UserTrainingStatus {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  total_courses: number;
  completed_courses: number;
  certifications_earned: number;
  certifications_required: number;
  completion_percentage: number;
  status: 'certified' | 'in_progress' | 'not_started' | 'at_risk';
  last_activity?: string;
}

export interface TrainingAdoptionCorrelation {
  fully_certified: { avg_usage_score: number; avg_feature_adoption: number; count: number };
  partially_certified: { avg_usage_score: number; avg_feature_adoption: number; count: number };
  not_certified: { avg_usage_score: number; avg_feature_adoption: number; count: number };
  insight?: string;
}

// Role-based certification requirements
const ROLE_CERTIFICATION_REQUIREMENTS: Record<string, string[]> = {
  'admin': ['admin-certification', 'basic-fundamentals'],
  'administrator': ['admin-certification', 'basic-fundamentals'],
  'developer': ['api-integration', 'basic-fundamentals'],
  'analyst': ['reporting-mastery', 'basic-fundamentals'],
  'power user': ['advanced-features', 'basic-fundamentals'],
  'user': ['basic-fundamentals']
};

class CertificationTrackerService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get comprehensive training status for a customer
   */
  async getCustomerTrainingStatus(
    customerId: string,
    customerName?: string
  ): Promise<CustomerTrainingStatus> {
    // Get all training records for the customer
    const records = await trainingDataParser.getTrainingRecords(customerId);

    // Get customer name if not provided
    let resolvedCustomerName = customerName || 'Unknown Customer';
    if (!customerName && this.supabase) {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();
      resolvedCustomerName = customer?.name || resolvedCustomerName;
    }

    // Calculate all metrics
    const overview = this.calculateOverview(records);
    const courses = this.calculateCourseStatus(records);
    const certifications = this.calculateCertificationOverview(records);
    const expiringCertifications = this.getExpiringCertifications(records);
    const usersByStatus = this.calculateUserStatus(records);
    const trainingVsAdoption = await this.correlateTrainingWithAdoption(customerId, records);

    return {
      customer_id: customerId,
      customer_name: resolvedCustomerName,
      overview,
      courses,
      certifications,
      expiring_certifications: expiringCertifications,
      users_by_status: usersByStatus,
      training_vs_adoption: trainingVsAdoption
    };
  }

  /**
   * Calculate training overview metrics
   */
  private calculateOverview(records: TrainingRecord[]): TrainingOverview {
    // Group records by user
    const userRecords = new Map<string, TrainingRecord[]>();
    for (const record of records) {
      const userId = record.user_email || record.user_id;
      if (!userRecords.has(userId)) {
        userRecords.set(userId, []);
      }
      userRecords.get(userId)!.push(record);
    }

    const totalUsers = userRecords.size;
    let certifiedUsers = 0;
    let inProgressUsers = 0;
    let notStartedUsers = 0;

    for (const [_, userRecs] of userRecords) {
      const hasCompleted = userRecs.some(r => r.status === 'completed' && r.passed);
      const hasInProgress = userRecs.some(r => r.status === 'in_progress');
      const allNotStarted = userRecs.every(r => r.status === 'not_started');

      if (hasCompleted) {
        certifiedUsers++;
      } else if (hasInProgress) {
        inProgressUsers++;
      } else if (allNotStarted) {
        notStartedUsers++;
      } else {
        inProgressUsers++;
      }
    }

    // Calculate average time to complete
    const completedRecords = records.filter(r =>
      r.status === 'completed' && r.time_to_complete_days !== undefined
    );
    const avgTimeToComplete = completedRecords.length > 0
      ? completedRecords.reduce((sum, r) => sum + (r.time_to_complete_days || 0), 0) / completedRecords.length
      : 0;

    // Calculate pass rate
    const attemptedRecords = records.filter(r => r.status === 'completed' || r.status === 'failed');
    const passedRecords = attemptedRecords.filter(r => r.passed);
    const overallPassRate = attemptedRecords.length > 0
      ? (passedRecords.length / attemptedRecords.length) * 100
      : 0;

    return {
      total_users: totalUsers,
      certified_users: certifiedUsers,
      in_progress_users: inProgressUsers,
      not_started_users: notStartedUsers,
      certification_rate: totalUsers > 0 ? (certifiedUsers / totalUsers) * 100 : 0,
      avg_time_to_complete: Math.round(avgTimeToComplete),
      overall_pass_rate: Math.round(overallPassRate)
    };
  }

  /**
   * Calculate course completion status
   */
  private calculateCourseStatus(records: TrainingRecord[]): CourseCompletionStatus[] {
    // Group records by course
    const courseRecords = new Map<string, TrainingRecord[]>();
    for (const record of records) {
      const courseId = record.course_id;
      if (!courseRecords.has(courseId)) {
        courseRecords.set(courseId, []);
      }
      courseRecords.get(courseId)!.push(record);
    }

    const courseStatuses: CourseCompletionStatus[] = [];

    for (const [courseId, courseRecs] of courseRecords) {
      const firstRecord = courseRecs[0];
      const enrolledCount = courseRecs.length;
      const completedRecords = courseRecs.filter(r => r.status === 'completed');
      const completedCount = completedRecords.length;
      const passedRecords = courseRecs.filter(r => r.passed);

      // Calculate average score
      const recordsWithScores = completedRecords.filter(r => r.score !== undefined);
      const avgScore = recordsWithScores.length > 0
        ? recordsWithScores.reduce((sum, r) => sum + (r.score || 0), 0) / recordsWithScores.length
        : undefined;

      // Calculate average days to complete
      const recordsWithTime = completedRecords.filter(r => r.time_to_complete_days !== undefined);
      const avgDays = recordsWithTime.length > 0
        ? recordsWithTime.reduce((sum, r) => sum + (r.time_to_complete_days || 0), 0) / recordsWithTime.length
        : 0;

      courseStatuses.push({
        course_id: courseId,
        course_name: firstRecord.course_name,
        course_type: firstRecord.course_type,
        enrolled_count: enrolledCount,
        completed_count: completedCount,
        completion_rate: Math.round((completedCount / enrolledCount) * 100),
        pass_rate: completedCount > 0 ? Math.round((passedRecords.length / completedCount) * 100) : 0,
        avg_score: avgScore !== undefined ? Math.round(avgScore) : undefined,
        avg_days_to_complete: Math.round(avgDays),
        is_required: courseId === 'basic-fundamentals' || courseId === 'admin-certification'
      });
    }

    // Sort by enrollment count descending
    return courseStatuses.sort((a, b) => b.enrolled_count - a.enrolled_count);
  }

  /**
   * Calculate certification overview
   */
  private calculateCertificationOverview(records: TrainingRecord[]): CertificationOverview {
    const certifiedRecords = records.filter(r => r.certification_earned);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let activeCerts = 0;
    let expiringSoon = 0;
    let expired = 0;

    for (const record of certifiedRecords) {
      if (!record.certification_expires) {
        activeCerts++;
        continue;
      }

      const expiryDate = new Date(record.certification_expires);
      if (expiryDate < now) {
        expired++;
      } else if (expiryDate < thirtyDaysFromNow) {
        expiringSoon++;
      } else {
        activeCerts++;
      }
    }

    // Unique users with certifications
    const uniqueCertifiedUsers = new Set(certifiedRecords.map(r => r.user_email || r.user_id));
    const uniqueAllUsers = new Set(records.map(r => r.user_email || r.user_id));

    return {
      total_certifications: certifiedRecords.length,
      active_certifications: activeCerts,
      expiring_soon: expiringSoon,
      expired,
      certification_rate: uniqueAllUsers.size > 0
        ? Math.round((uniqueCertifiedUsers.size / uniqueAllUsers.size) * 100)
        : 0
    };
  }

  /**
   * Get certifications expiring within 30 days
   */
  private getExpiringCertifications(records: TrainingRecord[]): UserCertification[] {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringCerts: UserCertification[] = [];

    for (const record of records) {
      if (!record.certification_earned || !record.certification_expires) continue;

      const expiryDate = new Date(record.certification_expires);
      if (expiryDate > now && expiryDate <= thirtyDaysFromNow) {
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        expiringCerts.push({
          user_id: record.user_id,
          user_email: record.user_email,
          user_name: record.user_name,
          user_role: record.user_role,
          certification_id: record.course_id,
          certification_name: record.certification_earned,
          earned_date: record.completion_date || record.enrollment_date,
          expires_date: record.certification_expires,
          status: 'expiring_soon',
          score: record.score || 0,
          days_until_expiry: daysUntilExpiry
        });
      }
    }

    // Sort by days until expiry
    return expiringCerts.sort((a, b) =>
      (a.days_until_expiry || 0) - (b.days_until_expiry || 0)
    );
  }

  /**
   * Calculate user training status
   */
  private calculateUserStatus(records: TrainingRecord[]): UserTrainingStatus[] {
    // Group by user
    const userRecords = new Map<string, TrainingRecord[]>();
    for (const record of records) {
      const userId = record.user_email || record.user_id;
      if (!userRecords.has(userId)) {
        userRecords.set(userId, []);
      }
      userRecords.get(userId)!.push(record);
    }

    const userStatuses: UserTrainingStatus[] = [];

    for (const [userId, userRecs] of userRecords) {
      const firstRecord = userRecs[0];
      const role = (firstRecord.user_role || 'user').toLowerCase();
      const requiredCerts = ROLE_CERTIFICATION_REQUIREMENTS[role] || ['basic-fundamentals'];

      const totalCourses = userRecs.length;
      const completedCourses = userRecs.filter(r => r.status === 'completed' && r.passed).length;
      const certificationsEarned = userRecs.filter(r => r.certification_earned).length;
      const certificationsRequired = requiredCerts.length;

      // Check which required certifications are met
      const earnedCertCourseIds = userRecs
        .filter(r => r.passed && r.certification_earned)
        .map(r => r.course_id);
      const requiredMet = requiredCerts.filter(c => earnedCertCourseIds.includes(c)).length;

      // Determine status
      let status: UserTrainingStatus['status'] = 'not_started';
      if (requiredMet === certificationsRequired) {
        status = 'certified';
      } else if (userRecs.some(r => r.status === 'in_progress')) {
        status = 'in_progress';
      } else if (userRecs.some(r => r.status === 'failed')) {
        status = 'at_risk';
      } else if (completedCourses > 0) {
        status = 'in_progress';
      }

      // Find last activity
      const lastActivityRecord = userRecs
        .filter(r => r.completion_date || r.enrollment_date)
        .sort((a, b) =>
          new Date(b.completion_date || b.enrollment_date).getTime() -
          new Date(a.completion_date || a.enrollment_date).getTime()
        )[0];

      userStatuses.push({
        user_id: firstRecord.user_id,
        user_email: firstRecord.user_email,
        user_name: firstRecord.user_name,
        user_role: firstRecord.user_role,
        total_courses: totalCourses,
        completed_courses: completedCourses,
        certifications_earned: certificationsEarned,
        certifications_required: certificationsRequired,
        completion_percentage: totalCourses > 0
          ? Math.round((completedCourses / totalCourses) * 100)
          : 0,
        status,
        last_activity: lastActivityRecord?.completion_date || lastActivityRecord?.enrollment_date
      });
    }

    // Sort by status priority then name
    const statusPriority = { 'at_risk': 0, 'not_started': 1, 'in_progress': 2, 'certified': 3 };
    return userStatuses.sort((a, b) =>
      statusPriority[a.status] - statusPriority[b.status] ||
      a.user_name.localeCompare(b.user_name)
    );
  }

  /**
   * Correlate training completion with product adoption
   */
  private async correlateTrainingWithAdoption(
    customerId: string,
    records: TrainingRecord[]
  ): Promise<TrainingAdoptionCorrelation> {
    // Group users by certification level
    const userCertLevels = new Map<string, 'full' | 'partial' | 'none'>();

    // Group records by user
    const userRecords = new Map<string, TrainingRecord[]>();
    for (const record of records) {
      const userId = record.user_email || record.user_id;
      if (!userRecords.has(userId)) {
        userRecords.set(userId, []);
      }
      userRecords.get(userId)!.push(record);
    }

    // Determine certification level for each user
    for (const [userId, userRecs] of userRecords) {
      const certifiedCourses = userRecs.filter(r => r.passed && r.certification_earned);
      const role = (userRecs[0]?.user_role || 'user').toLowerCase();
      const requiredCerts = ROLE_CERTIFICATION_REQUIREMENTS[role] || ['basic-fundamentals'];

      const earnedCertCourseIds = certifiedCourses.map(r => r.course_id);
      const requiredMet = requiredCerts.filter(c => earnedCertCourseIds.includes(c)).length;

      if (requiredMet === requiredCerts.length) {
        userCertLevels.set(userId, 'full');
      } else if (certifiedCourses.length > 0) {
        userCertLevels.set(userId, 'partial');
      } else {
        userCertLevels.set(userId, 'none');
      }
    }

    // Get usage data for users (mock for now)
    // In production, this would fetch from usage_metrics
    const mockUsageByLevel = {
      full: { avgUsage: 85, avgAdoption: 78 },
      partial: { avgUsage: 62, avgAdoption: 52 },
      none: { avgUsage: 34, avgAdoption: 28 }
    };

    const fullCount = Array.from(userCertLevels.values()).filter(v => v === 'full').length;
    const partialCount = Array.from(userCertLevels.values()).filter(v => v === 'partial').length;
    const noneCount = Array.from(userCertLevels.values()).filter(v => v === 'none').length;

    // Calculate correlation insight
    const fullUsage = mockUsageByLevel.full.avgUsage;
    const noneUsage = mockUsageByLevel.none.avgUsage;
    const multiplier = noneUsage > 0 ? (fullUsage / noneUsage).toFixed(1) : 'N/A';

    return {
      fully_certified: {
        avg_usage_score: mockUsageByLevel.full.avgUsage,
        avg_feature_adoption: mockUsageByLevel.full.avgAdoption,
        count: fullCount
      },
      partially_certified: {
        avg_usage_score: mockUsageByLevel.partial.avgUsage,
        avg_feature_adoption: mockUsageByLevel.partial.avgAdoption,
        count: partialCount
      },
      not_certified: {
        avg_usage_score: mockUsageByLevel.none.avgUsage,
        avg_feature_adoption: mockUsageByLevel.none.avgAdoption,
        count: noneCount
      },
      insight: `Certified users have ${multiplier}x higher adoption!`
    };
  }

  /**
   * Get users requiring certification by role
   */
  async getUsersRequiringCertification(
    customerId: string,
    role: string
  ): Promise<Array<{ user: UserTrainingStatus; missing: string[] }>> {
    const records = await trainingDataParser.getTrainingRecords(customerId);
    const userStatuses = this.calculateUserStatus(records);

    const requiredCerts = ROLE_CERTIFICATION_REQUIREMENTS[role.toLowerCase()] || [];
    const result: Array<{ user: UserTrainingStatus; missing: string[] }> = [];

    for (const user of userStatuses) {
      if ((user.user_role || '').toLowerCase() !== role.toLowerCase()) continue;

      // Get user's earned certifications
      const userRecords = records.filter(r =>
        r.user_email === user.user_email && r.passed && r.certification_earned
      );
      const earnedCertIds = userRecords.map(r => r.course_id);

      const missing = requiredCerts.filter(c => !earnedCertIds.includes(c));
      if (missing.length > 0) {
        result.push({ user, missing });
      }
    }

    return result;
  }
}

// Singleton instance
export const certificationTracker = new CertificationTrackerService();
export default certificationTracker;
