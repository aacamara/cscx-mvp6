/**
 * User Offboard Service
 * PRD-140: Handles detection and processing of user offboarding events
 *
 * Features:
 * - Offboard detection (deactivation, bounce, SSO, inactivity, manual)
 * - License impact analysis
 * - CSM notification workflow
 * - Champion departure integration
 * - Bulk offboard handling
 * - License tracking and optimization
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { championDepartureService } from './championDeparture.js';
import { sendSlackAlert, SlackAlertType } from './notifications/slack.js';
import { triggerEngine } from '../triggers/engine.js';

// ============================================
// Types
// ============================================

export type OffboardDetectionMethod =
  | 'deactivation'
  | 'bounce'
  | 'sso'
  | 'inactivity'
  | 'manual';

export type DetectionConfidence = 'high' | 'medium' | 'low';

export type LicenseType =
  | 'standard'
  | 'professional'
  | 'enterprise'
  | 'admin'
  | 'viewer'
  | 'custom';

export interface UserOffboardEvent {
  id: string;
  customerId: string;
  customerName?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
    licenseType: LicenseType;
    department?: string;
    lastActiveAt?: Date;
  };
  detection: {
    method: OffboardDetectionMethod;
    detectedAt: Date;
    confidence: DetectionConfidence;
    evidence?: string;
    evidenceData?: Record<string, unknown>;
  };
  impact: {
    licenseFreed: boolean;
    licenseCost: number;
    isChampion: boolean;
    isStakeholder: boolean;
    riskSignalCreated: boolean;
    healthScoreImpact?: number;
  };
  licenseImpact: {
    licenseFreed: boolean;
    licenseCost: number;
    monthlyCost: number;
    annualCost: number;
    utilizationRateBefore: number;
    utilizationRateAfter: number;
    recommendation: 'reallocate' | 'downgrade' | 'hold' | 'optimize';
    potentialSavings: number;
  };
  actions: {
    csmNotified: boolean;
    csmNotifiedAt?: Date;
    customerNotified: boolean;
    customerNotifiedAt?: Date;
    licenseReclaimed: boolean;
    licenseReclaimedAt?: Date;
    stakeholderMapUpdated: boolean;
    stakeholderMapUpdatedAt?: Date;
  };
  notes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LicenseStatus {
  customerId: string;
  totalLicenses: number;
  usedLicenses: number;
  availableLicenses: number;
  utilizationRate: number;
  monthlyLicenseCost: number;
  annualLicenseCost: number;
  allocations: Array<{
    type: LicenseType;
    total: number;
    used: number;
    available: number;
    costPerLicense: number;
  }>;
  recentOffboards: number;
  reclaimedThisMonth: number;
  potentialSavings: number;
}

export interface BulkOffboardEvent {
  id: string;
  customerId: string;
  customerName: string;
  eventType: 'restructure' | 'layoff' | 'merger' | 'department_closure' | 'other';
  affectedUsers: number;
  affectedLicenses: number;
  totalCostImpact: number;
  detectedAt: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  riskEscalated: boolean;
  notes?: string;
}

export interface RecordOffboardInput {
  customerId: string;
  user: {
    email: string;
    name: string;
    role?: string;
    licenseType: LicenseType;
    department?: string;
  };
  detectionMethod: OffboardDetectionMethod;
  confidence?: DetectionConfidence;
  evidence?: string;
  evidenceData?: Record<string, unknown>;
  notes?: string;
}

// License cost configuration (monthly per license)
const LICENSE_COSTS: Record<LicenseType, number> = {
  standard: 50,
  professional: 100,
  enterprise: 200,
  admin: 150,
  viewer: 25,
  custom: 75,
};

// Confidence weights for detection methods
const DETECTION_CONFIDENCE: Record<OffboardDetectionMethod, DetectionConfidence> = {
  deactivation: 'high',
  bounce: 'high',
  sso: 'high',
  manual: 'high',
  inactivity: 'medium',
};

// Inactivity threshold (days)
const INACTIVITY_THRESHOLD_DAYS = 90;

// ============================================
// User Offboard Service
// ============================================

export class UserOffboardService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Offboard Detection
  // ============================================

  /**
   * Record a user offboard event
   */
  async recordOffboard(input: RecordOffboardInput, userId?: string): Promise<UserOffboardEvent> {
    if (!this.supabase) throw new Error('Database not available');

    // Get customer details
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('id, name, arr, health_score')
      .eq('id', input.customerId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    // Check if user is a stakeholder/champion
    const { data: stakeholder } = await this.supabase
      .from('stakeholders')
      .select('id, is_champion, is_primary, is_exec_sponsor')
      .eq('customer_id', input.customerId)
      .eq('email', input.user.email)
      .single();

    const isChampion = stakeholder?.is_champion || false;
    const isStakeholder = !!stakeholder;

    // Calculate license impact
    const licenseImpact = await this.calculateLicenseImpact(input.customerId, input.user.licenseType);

    // Generate offboard event
    const offboardEvent: Partial<UserOffboardEvent> = {
      id: uuidv4(),
      customerId: input.customerId,
      customerName: customer.name,
      user: {
        id: uuidv4(),
        email: input.user.email,
        name: input.user.name,
        role: input.user.role,
        licenseType: input.user.licenseType,
        department: input.user.department,
      },
      detection: {
        method: input.detectionMethod,
        detectedAt: new Date(),
        confidence: input.confidence || DETECTION_CONFIDENCE[input.detectionMethod],
        evidence: input.evidence,
        evidenceData: input.evidenceData,
      },
      impact: {
        licenseFreed: true,
        licenseCost: LICENSE_COSTS[input.user.licenseType] || 50,
        isChampion,
        isStakeholder,
        riskSignalCreated: false,
      },
      licenseImpact,
      actions: {
        csmNotified: false,
        customerNotified: false,
        licenseReclaimed: false,
        stakeholderMapUpdated: false,
      },
      notes: input.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert into database
    const { data, error } = await this.supabase
      .from('user_offboard_events')
      .insert({
        id: offboardEvent.id,
        customer_id: offboardEvent.customerId,
        user_id: offboardEvent.user?.id,
        user_email: offboardEvent.user?.email,
        user_name: offboardEvent.user?.name,
        user_role: offboardEvent.user?.role,
        user_license_type: offboardEvent.user?.licenseType,
        user_department: offboardEvent.user?.department,
        detection_method: offboardEvent.detection?.method,
        detected_at: offboardEvent.detection?.detectedAt,
        detection_confidence: offboardEvent.detection?.confidence,
        detection_evidence: offboardEvent.detection?.evidence,
        detection_evidence_data: offboardEvent.detection?.evidenceData,
        license_freed: offboardEvent.impact?.licenseFreed,
        license_cost: offboardEvent.impact?.licenseCost,
        is_champion: offboardEvent.impact?.isChampion,
        is_stakeholder: offboardEvent.impact?.isStakeholder,
        risk_signal_created: offboardEvent.impact?.riskSignalCreated,
        license_monthly_cost: offboardEvent.licenseImpact?.monthlyCost,
        license_annual_cost: offboardEvent.licenseImpact?.annualCost,
        utilization_rate_before: offboardEvent.licenseImpact?.utilizationRateBefore,
        utilization_rate_after: offboardEvent.licenseImpact?.utilizationRateAfter,
        license_recommendation: offboardEvent.licenseImpact?.recommendation,
        potential_savings: offboardEvent.licenseImpact?.potentialSavings,
        csm_notified: false,
        customer_notified: false,
        license_reclaimed: false,
        stakeholder_map_updated: false,
        notes: offboardEvent.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Handle champion/stakeholder departure
    if (isChampion || isStakeholder) {
      await this.handleChampionDeparture(offboardEvent as UserOffboardEvent, stakeholder);
    }

    // Process through trigger engine
    await triggerEngine.processEvent({
      id: uuidv4(),
      type: 'user_offboarded',
      customerId: input.customerId,
      data: {
        userName: input.user.name,
        userEmail: input.user.email,
        userRole: input.user.role,
        licenseType: input.user.licenseType,
        detectionMethod: input.detectionMethod,
        isChampion,
        isStakeholder,
        licenseCost: LICENSE_COSTS[input.user.licenseType],
      },
      timestamp: new Date(),
    });

    // Notify CSM
    await this.notifyCSM(offboardEvent as UserOffboardEvent, customer);

    return this.mapOffboardEvent(data);
  }

  /**
   * Calculate license impact for an offboard
   */
  private async calculateLicenseImpact(
    customerId: string,
    licenseType: LicenseType
  ): Promise<UserOffboardEvent['licenseImpact']> {
    const licenseCost = LICENSE_COSTS[licenseType] || 50;
    const monthlyCost = licenseCost;
    const annualCost = licenseCost * 12;

    // Get current license utilization
    const licenseStatus = await this.getLicenseStatus(customerId);
    const utilizationBefore = licenseStatus?.utilizationRate || 100;
    const totalLicenses = licenseStatus?.totalLicenses || 1;
    const usedAfter = (licenseStatus?.usedLicenses || 1) - 1;
    const utilizationAfter = Math.round((usedAfter / totalLicenses) * 100);

    // Determine recommendation
    let recommendation: 'reallocate' | 'downgrade' | 'hold' | 'optimize' = 'hold';
    if (utilizationAfter < 50) {
      recommendation = 'downgrade';
    } else if (utilizationAfter < 75) {
      recommendation = 'optimize';
    } else if (licenseStatus && licenseStatus.availableLicenses > 0) {
      recommendation = 'reallocate';
    }

    return {
      licenseFreed: true,
      licenseCost,
      monthlyCost,
      annualCost,
      utilizationRateBefore: utilizationBefore,
      utilizationRateAfter: utilizationAfter,
      recommendation,
      potentialSavings: annualCost,
    };
  }

  /**
   * Handle champion/stakeholder departure
   */
  private async handleChampionDeparture(
    event: UserOffboardEvent,
    stakeholder: { id: string; is_champion?: boolean; is_primary?: boolean; is_exec_sponsor?: boolean }
  ): Promise<void> {
    if (!this.supabase) return;

    // Mark stakeholder as departed
    if (stakeholder) {
      await championDepartureService.markDeparted({
        stakeholderId: stakeholder.id,
        departureDate: event.detection.detectedAt,
        reason: `Detected via ${event.detection.method}`,
      });
    }

    // Update offboard event
    await this.supabase
      .from('user_offboard_events')
      .update({
        risk_signal_created: true,
        stakeholder_map_updated: true,
        stakeholder_map_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  }

  /**
   * Notify CSM of offboard event
   */
  private async notifyCSM(
    event: UserOffboardEvent,
    customer: { id: string; name: string; arr?: number; health_score?: number }
  ): Promise<void> {
    if (!this.supabase) return;

    // Create notification record
    const notification = {
      id: uuidv4(),
      offboard_event_id: event.id,
      customer_id: event.customerId,
      type: event.impact.isChampion ? 'champion_left' : 'offboard_detected',
      severity: event.impact.isChampion ? 'high' : 'medium',
      title: event.impact.isChampion
        ? `Champion departed at ${customer.name}`
        : `User offboarded at ${customer.name}`,
      message: `${event.user.name} (${event.user.email}) has been detected as departed. License type: ${event.user.licenseType}. Monthly cost: $${event.impact.licenseCost}.`,
      context: {
        userName: event.user.name,
        userRole: event.user.role,
        licenseType: event.user.licenseType,
        licenseCost: event.impact.licenseCost,
        wasChampion: event.impact.isChampion,
        wasStakeholder: event.impact.isStakeholder,
      },
      recommended_actions: [
        'Review license allocation for reallocation opportunity',
        event.impact.isChampion ? 'Identify new champion candidate' : null,
        event.impact.isStakeholder ? 'Update stakeholder map' : null,
        'Contact customer admin about available license',
      ].filter(Boolean),
      read: false,
    };

    await this.supabase.from('offboard_notifications').insert(notification);

    // Update offboard event
    await this.supabase
      .from('user_offboard_events')
      .update({
        csm_notified: true,
        csm_notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  }

  // ============================================
  // License Management
  // ============================================

  /**
   * Get license status for a customer
   */
  async getLicenseStatus(customerId: string): Promise<LicenseStatus | null> {
    if (!this.supabase) return null;

    // Get customer license data
    const { data: licenseData, error } = await this.supabase
      .from('customer_licenses')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error || !licenseData) {
      // Return default if no license data
      return {
        customerId,
        totalLicenses: 0,
        usedLicenses: 0,
        availableLicenses: 0,
        utilizationRate: 0,
        monthlyLicenseCost: 0,
        annualLicenseCost: 0,
        allocations: [],
        recentOffboards: 0,
        reclaimedThisMonth: 0,
        potentialSavings: 0,
      };
    }

    // Get recent offboards count
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count: recentOffboards } = await this.supabase
      .from('user_offboard_events')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .gte('detected_at', thirtyDaysAgo.toISOString());

    // Get reclaimed count this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count: reclaimedThisMonth } = await this.supabase
      .from('user_offboard_events')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('license_reclaimed', true)
      .gte('license_reclaimed_at', startOfMonth.toISOString());

    const totalLicenses = licenseData.total_licenses || 0;
    const usedLicenses = licenseData.used_licenses || 0;
    const availableLicenses = totalLicenses - usedLicenses;
    const utilizationRate = totalLicenses > 0 ? Math.round((usedLicenses / totalLicenses) * 100) : 0;

    return {
      customerId,
      totalLicenses,
      usedLicenses,
      availableLicenses,
      utilizationRate,
      monthlyLicenseCost: licenseData.monthly_cost || 0,
      annualLicenseCost: (licenseData.monthly_cost || 0) * 12,
      allocations: licenseData.allocations || [],
      recentOffboards: recentOffboards || 0,
      reclaimedThisMonth: reclaimedThisMonth || 0,
      potentialSavings: availableLicenses * (licenseData.cost_per_license || 50) * 12,
    };
  }

  /**
   * Reclaim a license from an offboarded user
   */
  async reclaimLicense(
    offboardEventId: string,
    action: 'reclaim' | 'reassign' | 'hold',
    userId?: string,
    reassignTo?: string,
    notes?: string
  ): Promise<UserOffboardEvent> {
    if (!this.supabase) throw new Error('Database not available');

    const { data: event, error: eventError } = await this.supabase
      .from('user_offboard_events')
      .select('*, customers(id, name)')
      .eq('id', offboardEventId)
      .single();

    if (eventError || !event) {
      throw new Error('Offboard event not found');
    }

    if (event.license_reclaimed) {
      throw new Error('License already reclaimed');
    }

    // Update event
    const updates: Record<string, unknown> = {
      license_reclaimed: action === 'reclaim' || action === 'reassign',
      license_reclaimed_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      notes: notes ? `${event.notes || ''}\n${notes}` : event.notes,
      updated_at: new Date().toISOString(),
    };

    if (action === 'reassign' && reassignTo) {
      updates.reassigned_to = reassignTo;
    }

    const { data, error } = await this.supabase
      .from('user_offboard_events')
      .update(updates)
      .eq('id', offboardEventId)
      .select()
      .single();

    if (error) throw error;

    // Update license count
    if (action === 'reclaim') {
      await this.supabase.rpc('decrement_used_licenses', {
        p_customer_id: event.customer_id,
        p_count: 1,
      });
    }

    return this.mapOffboardEvent(data);
  }

  // ============================================
  // Queries
  // ============================================

  /**
   * Get offboard events for a customer
   */
  async getCustomerOffboards(
    customerId: string,
    options: {
      status?: 'pending' | 'reclaimed' | 'dismissed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ events: UserOffboardEvent[]; total: number }> {
    if (!this.supabase) return { events: [], total: 0 };

    const { status, limit = 50, offset = 0 } = options;

    let query = this.supabase
      .from('user_offboard_events')
      .select('*, customers(id, name)', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'pending') {
      query = query.eq('license_reclaimed', false).is('resolved_at', null);
    } else if (status === 'reclaimed') {
      query = query.eq('license_reclaimed', true);
    } else if (status === 'dismissed') {
      query = query.eq('license_reclaimed', false).not('resolved_at', 'is', null);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      events: (data || []).map(this.mapOffboardEvent),
      total: count || 0,
    };
  }

  /**
   * Get all offboard events (portfolio view)
   */
  async getAllOffboards(options: {
    status?: 'pending' | 'reclaimed' | 'dismissed';
    isChampion?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ events: UserOffboardEvent[]; total: number }> {
    if (!this.supabase) return { events: [], total: 0 };

    const { status, isChampion, dateFrom, dateTo, limit = 50, offset = 0 } = options;

    let query = this.supabase
      .from('user_offboard_events')
      .select('*, customers(id, name)', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'pending') {
      query = query.eq('license_reclaimed', false).is('resolved_at', null);
    } else if (status === 'reclaimed') {
      query = query.eq('license_reclaimed', true);
    } else if (status === 'dismissed') {
      query = query.eq('license_reclaimed', false).not('resolved_at', 'is', null);
    }

    if (isChampion !== undefined) {
      query = query.eq('is_champion', isChampion);
    }

    if (dateFrom) {
      query = query.gte('detected_at', dateFrom.toISOString());
    }

    if (dateTo) {
      query = query.lte('detected_at', dateTo.toISOString());
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      events: (data || []).map(this.mapOffboardEvent),
      total: count || 0,
    };
  }

  /**
   * Get offboard summary statistics
   */
  async getOffboardSummary(): Promise<{
    totalOffboards: number;
    pendingReclaims: number;
    reclaimedThisMonth: number;
    totalSavings: number;
    championDepartures: number;
    bulkEvents: number;
  }> {
    if (!this.supabase) {
      return {
        totalOffboards: 0,
        pendingReclaims: 0,
        reclaimedThisMonth: 0,
        totalSavings: 0,
        championDepartures: 0,
        bulkEvents: 0,
      };
    }

    // Get counts
    const { count: totalOffboards } = await this.supabase
      .from('user_offboard_events')
      .select('id', { count: 'exact', head: true });

    const { count: pendingReclaims } = await this.supabase
      .from('user_offboard_events')
      .select('id', { count: 'exact', head: true })
      .eq('license_reclaimed', false)
      .is('resolved_at', null);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: reclaimedThisMonth } = await this.supabase
      .from('user_offboard_events')
      .select('id', { count: 'exact', head: true })
      .eq('license_reclaimed', true)
      .gte('license_reclaimed_at', startOfMonth.toISOString());

    // Get total savings from reclaimed licenses
    const { data: savingsData } = await this.supabase
      .from('user_offboard_events')
      .select('license_annual_cost')
      .eq('license_reclaimed', true);

    const totalSavings = (savingsData || []).reduce(
      (sum, event) => sum + (event.license_annual_cost || 0),
      0
    );

    const { count: championDepartures } = await this.supabase
      .from('user_offboard_events')
      .select('id', { count: 'exact', head: true })
      .eq('is_champion', true);

    const { count: bulkEvents } = await this.supabase
      .from('bulk_offboard_events')
      .select('id', { count: 'exact', head: true });

    return {
      totalOffboards: totalOffboards || 0,
      pendingReclaims: pendingReclaims || 0,
      reclaimedThisMonth: reclaimedThisMonth || 0,
      totalSavings,
      championDepartures: championDepartures || 0,
      bulkEvents: bulkEvents || 0,
    };
  }

  // ============================================
  // Bulk Offboard Handling
  // ============================================

  /**
   * Detect and record a bulk offboard event
   */
  async recordBulkOffboard(
    customerId: string,
    users: RecordOffboardInput['user'][],
    eventType: BulkOffboardEvent['eventType'],
    notes?: string,
    userId?: string
  ): Promise<BulkOffboardEvent> {
    if (!this.supabase) throw new Error('Database not available');

    const { data: customer } = await this.supabase
      .from('customers')
      .select('id, name, arr')
      .eq('id', customerId)
      .single();

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Calculate total impact
    const totalCostImpact = users.reduce(
      (sum, user) => sum + (LICENSE_COSTS[user.licenseType] || 50) * 12,
      0
    );

    // Determine severity
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    if (users.length >= 50 || totalCostImpact >= 100000) {
      severity = 'critical';
    } else if (users.length >= 20 || totalCostImpact >= 50000) {
      severity = 'high';
    } else if (users.length >= 10) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    const bulkEvent: BulkOffboardEvent = {
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      eventType,
      affectedUsers: users.length,
      affectedLicenses: users.length,
      totalCostImpact,
      detectedAt: new Date(),
      severity,
      riskEscalated: severity === 'critical' || severity === 'high',
      notes,
    };

    // Insert bulk event
    const { error } = await this.supabase.from('bulk_offboard_events').insert({
      id: bulkEvent.id,
      customer_id: bulkEvent.customerId,
      event_type: bulkEvent.eventType,
      affected_users: bulkEvent.affectedUsers,
      affected_licenses: bulkEvent.affectedLicenses,
      total_cost_impact: bulkEvent.totalCostImpact,
      detected_at: bulkEvent.detectedAt,
      severity: bulkEvent.severity,
      risk_escalated: bulkEvent.riskEscalated,
      notes: bulkEvent.notes,
      created_by: userId,
    });

    if (error) throw error;

    // Record individual offboard events
    for (const user of users) {
      await this.recordOffboard(
        {
          customerId,
          user,
          detectionMethod: 'manual',
          confidence: 'high',
          evidence: `Part of bulk offboard event: ${eventType}`,
          evidenceData: { bulkEventId: bulkEvent.id },
        },
        userId
      );
    }

    // Trigger risk escalation if needed
    if (bulkEvent.riskEscalated) {
      await triggerEngine.processEvent({
        id: uuidv4(),
        type: 'bulk_offboard_detected',
        customerId,
        data: {
          eventType,
          affectedUsers: users.length,
          totalCostImpact,
          severity,
        },
        timestamp: new Date(),
      });
    }

    return bulkEvent;
  }

  /**
   * Get bulk offboard events
   */
  async getBulkOffboards(
    customerId?: string,
    limit: number = 20
  ): Promise<BulkOffboardEvent[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('bulk_offboard_events')
      .select('*, customers(id, name)')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers?.name || '',
      eventType: row.event_type,
      affectedUsers: row.affected_users,
      affectedLicenses: row.affected_licenses,
      totalCostImpact: row.total_cost_impact,
      detectedAt: new Date(row.detected_at),
      severity: row.severity,
      riskEscalated: row.risk_escalated,
      notes: row.notes,
    }));
  }

  // ============================================
  // Inactivity Detection
  // ============================================

  /**
   * Detect inactive users (for scheduled job)
   */
  async detectInactiveUsers(): Promise<number> {
    if (!this.supabase) return 0;

    const thresholdDate = new Date(Date.now() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // Get users who haven't logged in past threshold
    const { data: inactiveUsers, error } = await this.supabase
      .from('customer_users')
      .select('*, customers(id, name)')
      .lt('last_active_at', thresholdDate.toISOString())
      .eq('status', 'active');

    if (error || !inactiveUsers) return 0;

    let detectedCount = 0;

    for (const user of inactiveUsers) {
      // Check if already recorded
      const { count } = await this.supabase
        .from('user_offboard_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', user.email)
        .eq('customer_id', user.customer_id);

      if (count === 0) {
        await this.recordOffboard({
          customerId: user.customer_id,
          user: {
            email: user.email,
            name: user.name,
            role: user.role,
            licenseType: user.license_type || 'standard',
          },
          detectionMethod: 'inactivity',
          confidence: 'medium',
          evidence: `No login activity for ${INACTIVITY_THRESHOLD_DAYS}+ days`,
          evidenceData: {
            lastActiveAt: user.last_active_at,
            daysSinceActive: Math.floor(
              (Date.now() - new Date(user.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
            ),
          },
        });
        detectedCount++;
      }
    }

    return detectedCount;
  }

  // ============================================
  // License Optimization
  // ============================================

  /**
   * Get license optimization recommendations
   */
  async getLicenseOptimizations(): Promise<
    Array<{
      customerId: string;
      customerName: string;
      currentPlan: string;
      recommendedAction: 'downgrade' | 'rightsize' | 'maintain' | 'upsell';
      reason: string;
      potentialSavings: number;
      unusedLicenses: number;
      utilizationRate: number;
    }>
  > {
    if (!this.supabase) return [];

    const { data: customers, error } = await this.supabase
      .from('customer_licenses')
      .select('*, customers(id, name, arr)')
      .lt('utilization_rate', 75);

    if (error || !customers) return [];

    return customers.map((c) => {
      const utilizationRate = c.utilization_rate || 0;
      const unusedLicenses = (c.total_licenses || 0) - (c.used_licenses || 0);
      const potentialSavings = unusedLicenses * (c.cost_per_license || 50) * 12;

      let recommendedAction: 'downgrade' | 'rightsize' | 'maintain' | 'upsell' = 'maintain';
      let reason = '';

      if (utilizationRate < 30) {
        recommendedAction = 'downgrade';
        reason = 'Very low utilization suggests significant oversizing';
      } else if (utilizationRate < 50) {
        recommendedAction = 'rightsize';
        reason = 'Low utilization offers optimization opportunity';
      } else if (utilizationRate < 75) {
        recommendedAction = 'maintain';
        reason = 'Moderate utilization with some unused capacity';
      }

      return {
        customerId: c.customer_id,
        customerName: c.customers?.name || '',
        currentPlan: c.plan_name || 'Standard',
        recommendedAction,
        reason,
        potentialSavings,
        unusedLicenses,
        utilizationRate,
      };
    });
  }

  // ============================================
  // Mappers
  // ============================================

  private mapOffboardEvent(row: Record<string, unknown>): UserOffboardEvent {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      customerName: (row.customers as { name?: string })?.name,
      user: {
        id: row.user_id as string,
        email: row.user_email as string,
        name: row.user_name as string,
        role: row.user_role as string | undefined,
        licenseType: (row.user_license_type as LicenseType) || 'standard',
        department: row.user_department as string | undefined,
        lastActiveAt: row.user_last_active_at ? new Date(row.user_last_active_at as string) : undefined,
      },
      detection: {
        method: row.detection_method as OffboardDetectionMethod,
        detectedAt: new Date(row.detected_at as string),
        confidence: (row.detection_confidence as DetectionConfidence) || 'medium',
        evidence: row.detection_evidence as string | undefined,
        evidenceData: row.detection_evidence_data as Record<string, unknown> | undefined,
      },
      impact: {
        licenseFreed: row.license_freed as boolean,
        licenseCost: row.license_cost as number,
        isChampion: row.is_champion as boolean,
        isStakeholder: row.is_stakeholder as boolean,
        riskSignalCreated: row.risk_signal_created as boolean,
        healthScoreImpact: row.health_score_impact as number | undefined,
      },
      licenseImpact: {
        licenseFreed: row.license_freed as boolean,
        licenseCost: row.license_cost as number,
        monthlyCost: row.license_monthly_cost as number,
        annualCost: row.license_annual_cost as number,
        utilizationRateBefore: row.utilization_rate_before as number,
        utilizationRateAfter: row.utilization_rate_after as number,
        recommendation: (row.license_recommendation as 'reallocate' | 'downgrade' | 'hold' | 'optimize') || 'hold',
        potentialSavings: row.potential_savings as number,
      },
      actions: {
        csmNotified: row.csm_notified as boolean,
        csmNotifiedAt: row.csm_notified_at ? new Date(row.csm_notified_at as string) : undefined,
        customerNotified: row.customer_notified as boolean,
        customerNotifiedAt: row.customer_notified_at ? new Date(row.customer_notified_at as string) : undefined,
        licenseReclaimed: row.license_reclaimed as boolean,
        licenseReclaimedAt: row.license_reclaimed_at ? new Date(row.license_reclaimed_at as string) : undefined,
        stakeholderMapUpdated: row.stakeholder_map_updated as boolean,
        stakeholderMapUpdatedAt: row.stakeholder_map_updated_at ? new Date(row.stakeholder_map_updated_at as string) : undefined,
      },
      notes: row.notes as string | undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      resolvedBy: row.resolved_by as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Singleton instance
export const userOffboardService = new UserOffboardService();
