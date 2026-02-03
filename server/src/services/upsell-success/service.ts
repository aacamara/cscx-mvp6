/**
 * PRD-130: Upsell Success Measurement Service
 * Business logic for measuring success after upsell completion
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  UpsellSuccessMeasurement,
  SuccessMetric,
  Checkpoint,
  SuccessReview,
  MeasurementOutcome,
  MeasurementProgress,
  ProgressStatus,
  OutcomeStatus,
  CreateMeasurementRequest,
  UpdateProgressRequest,
  RecordReviewRequest,
  DocumentOutcomeRequest,
  MeasurementSummary,
  UpcomingCheckpoint,
  OutcomeAnalysis,
  UpsellFeedback,
  DEFAULT_SUCCESS_TEMPLATES,
  MetricProgress,
  CheckpointType,
} from './types.js';

// ============================================
// Service Class
// ============================================

export class UpsellSuccessService {
  private supabase: SupabaseClient | null = null;
  private inMemoryMeasurements: Map<string, UpsellSuccessMeasurement> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Create Measurement Plan
  // ============================================

  async createMeasurementPlan(request: CreateMeasurementRequest): Promise<UpsellSuccessMeasurement> {
    const closeDate = new Date(request.closeDate);
    const template = this.getTemplateForProducts(request.products);

    // Generate success criteria from template
    const successCriteria = {
      metrics: template.metrics.map((m, idx) => ({
        ...m,
        id: `metric_${Date.now()}_${idx}`,
        current: 0,
        baseline: 0,
        progressPercentage: 0,
        trend: 'flat' as const,
        valueHistory: [],
      })),
      goals: request.goals || this.generateDefaultGoals(request.products),
      benchmarks: template.benchmarks,
    };

    // Generate measurement plan with checkpoints
    const measurementPlan = {
      trackingStart: new Date(),
      checkpoints: template.checkpointDays.map((day, idx) => ({
        id: `checkpoint_${Date.now()}_${idx}`,
        day,
        type: this.getCheckpointType(day) as CheckpointType,
        status: 'pending' as const,
        scheduledDate: this.addDays(closeDate, day),
      })),
      dashboardUrl: undefined,
    };

    // Initial progress
    const progress: MeasurementProgress = {
      currentStatus: 'pending',
      metricsProgress: successCriteria.metrics.map((m) => ({
        metricId: m.id!,
        name: m.name,
        current: 0,
        target: m.target,
        percentage: 0,
        trend: 'flat' as const,
      })),
      lastUpdated: new Date(),
    };

    const measurement: UpsellSuccessMeasurement = {
      id: `usm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      customerId: request.customerId,
      upsellId: undefined,
      opportunityId: request.opportunityId,
      upsellDetails: {
        products: request.products,
        arrIncrease: request.arrIncrease,
        closeDate,
        salesRep: request.salesRep,
      },
      successCriteria,
      measurementPlan,
      progress,
      reviews: [],
      outcome: {
        status: 'pending',
        evidence: [],
        lessonsLearned: [],
        documentedAt: undefined,
      },
      source: request.source || 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('upsell_success_measurements')
        .insert({
          id: measurement.id,
          customer_id: measurement.customerId,
          opportunity_id: measurement.opportunityId,
          products: measurement.upsellDetails.products,
          arr_increase: measurement.upsellDetails.arrIncrease,
          close_date: measurement.upsellDetails.closeDate.toISOString(),
          sales_rep: measurement.upsellDetails.salesRep,
          success_criteria: measurement.successCriteria,
          measurement_plan: measurement.measurementPlan,
          progress_status: measurement.progress.currentStatus,
          metrics_progress: measurement.progress.metricsProgress,
          progress_last_updated: measurement.progress.lastUpdated.toISOString(),
          reviews: measurement.reviews,
          outcome_status: measurement.outcome.status,
          outcome_evidence: measurement.outcome.evidence,
          lessons_learned: measurement.outcome.lessonsLearned,
          source: measurement.source,
          metadata: measurement.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create measurement:', error);
        throw new Error(`Failed to create measurement: ${error.message}`);
      }

      // Insert metrics
      for (const metric of successCriteria.metrics) {
        await this.supabase
          .from('upsell_success_metrics')
          .insert({
            id: metric.id,
            measurement_id: measurement.id,
            name: metric.name,
            metric_type: metric.type,
            target_value: metric.target,
            current_value: metric.current || 0,
            baseline_value: metric.baseline || 0,
            unit: metric.unit,
            measurement_method: metric.measurement,
            progress_percentage: metric.progressPercentage || 0,
            trend: metric.trend || 'flat',
            value_history: metric.valueHistory || [],
          });
      }

      // Insert checkpoints
      for (const checkpoint of measurementPlan.checkpoints) {
        await this.supabase
          .from('measurement_checkpoints')
          .insert({
            id: checkpoint.id,
            measurement_id: measurement.id,
            day_number: checkpoint.day,
            checkpoint_type: checkpoint.type,
            scheduled_date: checkpoint.scheduledDate.toISOString().split('T')[0],
            status: checkpoint.status,
          });
      }

      return this.mapDbToMeasurement(data);
    }

    // In-memory fallback
    this.inMemoryMeasurements.set(measurement.id, measurement);
    return measurement;
  }

  // ============================================
  // Get Measurement
  // ============================================

  async getMeasurement(measurementId: string): Promise<UpsellSuccessMeasurement | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('upsell_success_measurements')
        .select('*')
        .eq('id', measurementId)
        .single();

      if (error || !data) return null;

      // Get metrics
      const { data: metrics } = await this.supabase
        .from('upsell_success_metrics')
        .select('*')
        .eq('measurement_id', measurementId);

      // Get checkpoints
      const { data: checkpoints } = await this.supabase
        .from('measurement_checkpoints')
        .select('*')
        .eq('measurement_id', measurementId)
        .order('day_number');

      return this.mapDbToMeasurement(data, metrics || [], checkpoints || []);
    }

    return this.inMemoryMeasurements.get(measurementId) || null;
  }

  // ============================================
  // Get Customer Measurements
  // ============================================

  async getCustomerMeasurements(customerId: string): Promise<UpsellSuccessMeasurement[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('upsell_success_measurements')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return Promise.all(data.map(async (row) => {
        const { data: metrics } = await this.supabase!
          .from('upsell_success_metrics')
          .select('*')
          .eq('measurement_id', row.id);

        const { data: checkpoints } = await this.supabase!
          .from('measurement_checkpoints')
          .select('*')
          .eq('measurement_id', row.id)
          .order('day_number');

        return this.mapDbToMeasurement(row, metrics || [], checkpoints || []);
      }));
    }

    return Array.from(this.inMemoryMeasurements.values())
      .filter((m) => m.customerId === customerId);
  }

  // ============================================
  // Update Progress
  // ============================================

  async updateProgress(measurementId: string, request: UpdateProgressRequest): Promise<UpsellSuccessMeasurement> {
    const measurement = await this.getMeasurement(measurementId);
    if (!measurement) {
      throw new Error('Measurement not found');
    }

    // Update metrics
    for (const update of request.metrics) {
      const metric = measurement.successCriteria.metrics.find((m) => m.id === update.metricId);
      if (metric) {
        const previousValue = metric.current || 0;
        metric.current = update.value;
        metric.progressPercentage = Math.min((update.value / metric.target) * 100, 100);
        metric.trend = update.value > previousValue ? 'up' : update.value < previousValue ? 'down' : 'flat';
        metric.valueHistory = [
          ...(metric.valueHistory || []),
          { value: update.value, timestamp: new Date() },
        ];

        if (this.supabase) {
          await this.supabase
            .from('upsell_success_metrics')
            .update({
              current_value: update.value,
              progress_percentage: metric.progressPercentage,
              trend: metric.trend,
              value_history: metric.valueHistory,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.metricId);
        }
      }
    }

    // Calculate new progress status
    const avgProgress = measurement.successCriteria.metrics.reduce(
      (sum, m) => sum + (m.progressPercentage || 0),
      0
    ) / measurement.successCriteria.metrics.length;

    const daysSinceClose = Math.floor(
      (Date.now() - measurement.upsellDetails.closeDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const expectedProgress = (daysSinceClose / 90) * 100; // Assuming 90-day goal

    let newStatus: ProgressStatus;
    if (avgProgress >= expectedProgress + 20) {
      newStatus = 'exceeding';
    } else if (avgProgress >= expectedProgress - 10) {
      newStatus = 'on_track';
    } else if (avgProgress >= expectedProgress - 25) {
      newStatus = 'at_risk';
    } else {
      newStatus = 'behind';
    }

    measurement.progress = {
      currentStatus: newStatus,
      metricsProgress: measurement.successCriteria.metrics.map((m) => ({
        metricId: m.id!,
        name: m.name,
        current: m.current || 0,
        target: m.target,
        percentage: m.progressPercentage || 0,
        trend: m.trend || 'flat',
      })),
      lastUpdated: new Date(),
    };

    if (this.supabase) {
      await this.supabase
        .from('upsell_success_measurements')
        .update({
          progress_status: newStatus,
          metrics_progress: measurement.progress.metricsProgress,
          progress_last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', measurementId);
    } else {
      this.inMemoryMeasurements.set(measurementId, measurement);
    }

    return measurement;
  }

  // ============================================
  // Record Review
  // ============================================

  async recordReview(measurementId: string, request: RecordReviewRequest): Promise<SuccessReview> {
    const measurement = await this.getMeasurement(measurementId);
    if (!measurement) {
      throw new Error('Measurement not found');
    }

    const review: SuccessReview = {
      id: `review_${Date.now()}`,
      checkpointDay: request.checkpointDay,
      reviewDate: new Date(),
      reviewedBy: request.reviewedBy,
      overallAssessment: request.overallAssessment,
      metricsSnapshot: measurement.progress.metricsProgress,
      findings: request.findings,
      recommendations: request.recommendations,
      nextSteps: request.nextSteps,
      documentUrl: request.documentUrl,
    };

    measurement.reviews.push(review);
    measurement.updatedAt = new Date();

    // Mark checkpoint as completed
    const checkpoint = measurement.measurementPlan.checkpoints.find(
      (c) => c.day === request.checkpointDay
    );
    if (checkpoint) {
      checkpoint.status = 'completed';
      checkpoint.completedDate = new Date();
      checkpoint.completedBy = request.reviewedBy;
      checkpoint.summary = request.findings.join('. ');
      checkpoint.recommendations = request.recommendations;

      if (this.supabase) {
        await this.supabase
          .from('measurement_checkpoints')
          .update({
            status: 'completed',
            completed_date: new Date().toISOString().split('T')[0],
            completed_by: request.reviewedBy,
            summary: checkpoint.summary,
            recommendations: request.recommendations,
            findings: request.findings,
            updated_at: new Date().toISOString(),
          })
          .eq('measurement_id', measurementId)
          .eq('day_number', request.checkpointDay);
      }
    }

    if (this.supabase) {
      await this.supabase
        .from('upsell_success_measurements')
        .update({
          reviews: measurement.reviews,
          measurement_plan: measurement.measurementPlan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', measurementId);
    } else {
      this.inMemoryMeasurements.set(measurementId, measurement);
    }

    return review;
  }

  // ============================================
  // Document Outcome
  // ============================================

  async documentOutcome(measurementId: string, request: DocumentOutcomeRequest): Promise<MeasurementOutcome> {
    const measurement = await this.getMeasurement(measurementId);
    if (!measurement) {
      throw new Error('Measurement not found');
    }

    measurement.outcome = {
      status: request.status,
      evidence: request.evidence,
      lessonsLearned: request.lessonsLearned,
      documentedAt: new Date(),
    };

    if (request.healthScoreAfter !== undefined) {
      measurement.healthScoreAfter = request.healthScoreAfter;
    }

    if (this.supabase) {
      await this.supabase
        .from('upsell_success_measurements')
        .update({
          outcome_status: request.status,
          outcome_evidence: request.evidence,
          lessons_learned: request.lessonsLearned,
          outcome_documented_at: new Date().toISOString(),
          health_score_after: request.healthScoreAfter,
          updated_at: new Date().toISOString(),
        })
        .eq('id', measurementId);

      // Create feedback entries for lessons learned
      for (const lesson of request.lessonsLearned) {
        await this.supabase
          .from('upsell_success_feedback')
          .insert({
            measurement_id: measurementId,
            feedback_type: request.status === 'success' ? 'success_factor' : 'risk_indicator',
            title: lesson.substring(0, 255),
            description: lesson,
            product_category: measurement.upsellDetails.products.join(', '),
          });
      }
    } else {
      this.inMemoryMeasurements.set(measurementId, measurement);
    }

    return measurement.outcome;
  }

  // ============================================
  // Get Summaries & Analytics
  // ============================================

  async getMeasurementSummaries(filters?: {
    status?: ProgressStatus;
    outcomeStatus?: OutcomeStatus;
    limit?: number;
  }): Promise<MeasurementSummary[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('v_upsell_measurements_summary')
        .select('*')
        .order('close_date', { ascending: false })
        .limit(filters?.limit || 50);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerArr: row.customer_arr,
        products: row.products,
        arrIncrease: row.arr_increase,
        closeDate: new Date(row.close_date),
        progressStatus: row.progress_status,
        outcomeStatus: row.outcome_status,
        daysSinceClose: row.days_since_close,
        completedCheckpoints: row.completed_checkpoints,
        totalCheckpoints: row.total_checkpoints,
        avgMetricProgress: row.avg_metric_progress || 0,
      }));
    }

    // In-memory fallback
    return Array.from(this.inMemoryMeasurements.values())
      .map((m) => ({
        id: m.id,
        customerId: m.customerId,
        customerName: 'Unknown',
        customerArr: 0,
        products: m.upsellDetails.products,
        arrIncrease: m.upsellDetails.arrIncrease,
        closeDate: m.upsellDetails.closeDate,
        progressStatus: m.progress.currentStatus,
        outcomeStatus: m.outcome.status,
        daysSinceClose: Math.floor(
          (Date.now() - m.upsellDetails.closeDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
        completedCheckpoints: m.measurementPlan.checkpoints.filter((c) => c.status === 'completed').length,
        totalCheckpoints: m.measurementPlan.checkpoints.length,
        avgMetricProgress: m.progress.metricsProgress.reduce((s, p) => s + p.percentage, 0) /
          m.progress.metricsProgress.length,
      }));
  }

  async getUpcomingCheckpoints(days: number = 7): Promise<UpcomingCheckpoint[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('v_upcoming_checkpoints')
        .select('*')
        .order('scheduled_date');

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        measurementId: row.measurement_id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        dayNumber: row.day_number,
        checkpointType: row.checkpoint_type,
        scheduledDate: new Date(row.scheduled_date),
        status: row.status,
        products: row.products,
        arrIncrease: row.arr_increase,
      }));
    }

    // In-memory fallback
    const now = new Date();
    const futureDate = this.addDays(now, days);

    return Array.from(this.inMemoryMeasurements.values())
      .flatMap((m) =>
        m.measurementPlan.checkpoints
          .filter(
            (c) =>
              c.status === 'pending' &&
              c.scheduledDate >= now &&
              c.scheduledDate <= futureDate
          )
          .map((c) => ({
            id: c.id!,
            measurementId: m.id,
            customerId: m.customerId,
            customerName: 'Unknown',
            dayNumber: c.day,
            checkpointType: c.type,
            scheduledDate: c.scheduledDate,
            status: c.status,
            products: m.upsellDetails.products,
            arrIncrease: m.upsellDetails.arrIncrease,
          }))
      )
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }

  async getOutcomeAnalysis(): Promise<OutcomeAnalysis[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('v_upsell_outcome_analysis')
        .select('*');

      if (error || !data) return [];

      return data.map((row) => ({
        outcomeStatus: row.outcome_status,
        count: row.count,
        avgArrIncrease: row.avg_arr_increase,
        avgHealthChange: row.avg_health_change || 0,
        productMix: row.product_mix || [],
      }));
    }

    // In-memory calculation
    const outcomes = new Map<OutcomeStatus, UpsellSuccessMeasurement[]>();
    for (const m of this.inMemoryMeasurements.values()) {
      if (!outcomes.has(m.outcome.status)) {
        outcomes.set(m.outcome.status, []);
      }
      outcomes.get(m.outcome.status)!.push(m);
    }

    return Array.from(outcomes.entries()).map(([status, measurements]) => ({
      outcomeStatus: status,
      count: measurements.length,
      avgArrIncrease:
        measurements.reduce((s, m) => s + m.upsellDetails.arrIncrease, 0) / measurements.length,
      avgHealthChange: 0,
      productMix: measurements.map((m) => m.upsellDetails.products),
    }));
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getTemplateForProducts(products: string[]): (typeof DEFAULT_SUCCESS_TEMPLATES)[0] {
    // Check if any product matches enterprise pattern
    const isEnterprise = products.some(
      (p) =>
        p.toLowerCase().includes('enterprise') ||
        p.toLowerCase().includes('premium') ||
        p.toLowerCase().includes('advanced')
    );

    return DEFAULT_SUCCESS_TEMPLATES.find(
      (t) => t.productCategory === (isEnterprise ? 'enterprise' : 'default')
    ) || DEFAULT_SUCCESS_TEMPLATES[0];
  }

  private generateDefaultGoals(products: string[]): string[] {
    return [
      `Achieve full adoption of ${products.join(', ')} within 90 days`,
      'Realize measurable ROI within first quarter',
      'Train all designated users on new features',
      'Integrate new capabilities into daily workflows',
    ];
  }

  private getCheckpointType(day: number): CheckpointType {
    if (day <= 30) return 'check';
    if (day <= 60) return 'review';
    return 'assessment';
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private mapDbToMeasurement(
    row: any,
    metrics: any[] = [],
    checkpoints: any[] = []
  ): UpsellSuccessMeasurement {
    return {
      id: row.id,
      customerId: row.customer_id,
      upsellId: row.upsell_id,
      opportunityId: row.opportunity_id,
      upsellDetails: {
        products: row.products || [],
        arrIncrease: parseFloat(row.arr_increase) || 0,
        closeDate: new Date(row.close_date),
        salesRep: row.sales_rep,
      },
      successCriteria: {
        metrics: metrics.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.metric_type,
          target: parseFloat(m.target_value),
          current: parseFloat(m.current_value) || 0,
          baseline: parseFloat(m.baseline_value) || 0,
          unit: m.unit,
          measurement: m.measurement_method,
          progressPercentage: parseFloat(m.progress_percentage) || 0,
          trend: m.trend,
          valueHistory: m.value_history || [],
        })),
        goals: row.success_criteria?.goals || [],
        benchmarks: row.success_criteria?.benchmarks || {},
      },
      measurementPlan: {
        trackingStart: new Date(row.measurement_plan?.trackingStart || row.created_at),
        checkpoints: checkpoints.map((c) => ({
          id: c.id,
          day: c.day_number,
          type: c.checkpoint_type,
          status: c.status,
          scheduledDate: new Date(c.scheduled_date),
          completedDate: c.completed_date ? new Date(c.completed_date) : undefined,
          completedBy: c.completed_by,
          summary: c.summary,
          findings: c.findings || [],
          recommendations: c.recommendations || [],
          actionItems: c.action_items || [],
          documentUrl: c.document_url,
          documentId: c.document_id,
        })),
        dashboardUrl: row.measurement_plan?.dashboardUrl,
      },
      progress: {
        currentStatus: row.progress_status,
        metricsProgress: row.metrics_progress || [],
        lastUpdated: new Date(row.progress_last_updated || row.updated_at),
      },
      reviews: row.reviews || [],
      outcome: {
        status: row.outcome_status,
        evidence: row.outcome_evidence || [],
        lessonsLearned: row.lessons_learned || [],
        documentedAt: row.outcome_documented_at ? new Date(row.outcome_documented_at) : undefined,
      },
      healthScoreBefore: row.health_score_before,
      healthScoreAfter: row.health_score_after,
      source: row.source,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const upsellSuccessService = new UpsellSuccessService();
