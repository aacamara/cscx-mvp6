/**
 * User Offboard and License Reclaim Types (PRD-140)
 *
 * Type definitions for user offboarding detection and license management.
 * Supports automatic detection of user departures, license impact analysis,
 * and reclaim workflow for subscription optimization.
 */

// ============================================
// Core Detection Types
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

export type OffboardActionStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export type OffboardSeverity = 'critical' | 'high' | 'medium' | 'low';

// ============================================
// User Offboard Event
// ============================================

export interface OffboardedUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  licenseType: LicenseType;
  department?: string;
  lastActiveAt?: string;
  joinedAt?: string;
}

export interface OffboardDetection {
  method: OffboardDetectionMethod;
  detectedAt: string;
  confidence: DetectionConfidence;
  evidence?: string;
  evidenceData?: Record<string, unknown>;
}

export interface LicenseImpact {
  licenseFreed: boolean;
  licenseCost: number;
  monthlyCost: number;
  annualCost: number;
  utilizationRateBefore: number;
  utilizationRateAfter: number;
  recommendation: 'reallocate' | 'downgrade' | 'hold' | 'optimize';
  potentialSavings: number;
}

export interface OffboardImpact {
  licenseFreed: boolean;
  licenseCost: number;
  isChampion: boolean;
  isStakeholder: boolean;
  riskSignalCreated: boolean;
  healthScoreImpact?: number;
}

export interface OffboardActions {
  csmNotified: boolean;
  csmNotifiedAt?: string;
  customerNotified: boolean;
  customerNotifiedAt?: string;
  licenseReclaimed: boolean;
  licenseReclaimedAt?: string;
  stakeholderMapUpdated: boolean;
  stakeholderMapUpdatedAt?: string;
}

export interface UserOffboardEvent {
  id: string;
  customerId: string;
  customerName?: string;
  user: OffboardedUser;
  detection: OffboardDetection;
  impact: OffboardImpact;
  licenseImpact: LicenseImpact;
  actions: OffboardActions;
  notes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// License Status
// ============================================

export interface LicenseAllocation {
  type: LicenseType;
  total: number;
  used: number;
  available: number;
  costPerLicense: number;
  monthlyTotal: number;
}

export interface CustomerLicenseStatus {
  customerId: string;
  customerName: string;
  totalLicenses: number;
  usedLicenses: number;
  availableLicenses: number;
  utilizationRate: number;
  monthlyLicenseCost: number;
  annualLicenseCost: number;
  allocations: LicenseAllocation[];
  recentOffboards: number;
  reclaimedThisMonth: number;
  potentialSavings: number;
  lastUpdated: string;
}

// ============================================
// Bulk Offboard Support
// ============================================

export interface BulkOffboardEvent {
  id: string;
  customerId: string;
  customerName: string;
  eventType: 'restructure' | 'layoff' | 'merger' | 'department_closure' | 'other';
  affectedUsers: number;
  affectedLicenses: number;
  totalCostImpact: number;
  detectedAt: string;
  severity: OffboardSeverity;
  riskEscalated: boolean;
  users: UserOffboardEvent[];
  notes?: string;
  createdAt: string;
}

// ============================================
// CSM Notifications
// ============================================

export interface OffboardNotification {
  id: string;
  offboardEventId: string;
  customerId: string;
  type: 'offboard_detected' | 'champion_left' | 'bulk_offboard' | 'license_available';
  severity: OffboardSeverity;
  title: string;
  message: string;
  context: {
    userName?: string;
    userRole?: string;
    licenseType?: LicenseType;
    licenseCost?: number;
    wasChampion?: boolean;
    wasStakeholder?: boolean;
    affectedCount?: number;
  };
  recommendedActions: string[];
  read: boolean;
  readAt?: string;
  createdAt: string;
}

// ============================================
// License Tracking
// ============================================

export interface LicenseUtilizationTrend {
  period: string;
  totalLicenses: number;
  usedLicenses: number;
  utilizationRate: number;
  offboards: number;
  reclaims: number;
}

export interface LicenseOptimizationRecommendation {
  customerId: string;
  customerName: string;
  currentPlan: string;
  recommendedAction: 'downgrade' | 'rightsize' | 'maintain' | 'upsell';
  reason: string;
  potentialSavings: number;
  unusedLicenses: number;
  utilizationRate: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface RecordOffboardRequest {
  customerId: string;
  user: {
    email: string;
    name: string;
    role?: string;
    licenseType: LicenseType;
  };
  detectionMethod: OffboardDetectionMethod;
  confidence?: DetectionConfidence;
  evidence?: string;
  notes?: string;
}

export interface ReclaimLicenseRequest {
  offboardEventId: string;
  reclaimAction: 'reclaim' | 'reassign' | 'hold';
  reassignTo?: string;
  notes?: string;
}

export interface GetOffboardsRequest {
  customerId?: string;
  status?: 'pending' | 'reclaimed' | 'dismissed';
  dateFrom?: string;
  dateTo?: string;
  isChampion?: boolean;
  limit?: number;
  offset?: number;
}

export interface OffboardSummary {
  totalOffboards: number;
  pendingReclaims: number;
  reclaimedThisMonth: number;
  totalSavings: number;
  championDepartures: number;
  bulkEvents: number;
}

export interface OffboardListResponse {
  success: boolean;
  data: {
    events: UserOffboardEvent[];
    summary: OffboardSummary;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface LicenseStatusResponse {
  success: boolean;
  data: CustomerLicenseStatus;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Dashboard Types
// ============================================

export interface OffboardDashboardData {
  summary: OffboardSummary;
  recentOffboards: UserOffboardEvent[];
  pendingActions: UserOffboardEvent[];
  bulkEvents: BulkOffboardEvent[];
  licenseOptimizations: LicenseOptimizationRecommendation[];
  utilizationTrends: LicenseUtilizationTrend[];
}

export interface CustomerOffboardDetailData {
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
  };
  licenseStatus: CustomerLicenseStatus;
  offboardHistory: UserOffboardEvent[];
  championDepartures: UserOffboardEvent[];
  pendingReclaims: UserOffboardEvent[];
  utilizationTrend: LicenseUtilizationTrend[];
}
