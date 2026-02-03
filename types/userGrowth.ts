/**
 * User Growth Alert Types (PRD-111)
 * Types for detecting and alerting on user growth at customer accounts
 */

// Types of user growth metrics tracked
export type UserGrowthMetricType = 'active_users' | 'invited_users' | 'seat_utilization';

// Severity levels based on growth patterns
export type UserGrowthSeverity = 'info' | 'medium' | 'high';

// Alert types for different growth scenarios
export type UserGrowthAlertType =
  | 'rapid_growth'        // >20% user growth in 30 days
  | 'approaching_limit'   // >80% seat utilization
  | 'exceeds_limit';      // Over contracted seat count

// Department/team growth breakdown
export interface DepartmentGrowth {
  department: string;
  previousCount: number;
  currentCount: number;
  newUsers: number;
  percentChange: number;
}

// User growth analysis result
export interface UserGrowthAnalysis {
  customerId: string;
  customerName: string;
  currentUsers: number;
  previousUsers: number;  // 30 days ago
  contractedSeats: number;
  seatUtilization: number;  // currentUsers / contractedSeats
  growthRate: number;       // Percentage growth
  newUsersByDepartment: DepartmentGrowth[];
  analyzedAt: string;
}

// Individual growth alert
export interface UserGrowthAlert {
  id: string;
  customerId: string;
  customerName: string;
  alertType: UserGrowthAlertType;
  severity: UserGrowthSeverity;

  // User counts
  currentUsers: number;
  previousUsers: number;
  growthCount: number;
  growthRate: number;

  // Seat information
  contractedSeats: number;
  seatUtilization: number;
  overageCount?: number;  // Users above contracted seats

  // Department breakdown
  departmentGrowth: DepartmentGrowth[];

  // Expansion opportunity
  estimatedExpansionRevenue?: number;
  pricePerSeat?: number;

  // Timestamps
  comparisonPeriod: string;
  detectedAt: string;
  cooldownExpiresAt: string;

  // Status
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

// Detection configuration
export interface UserGrowthDetectionConfig {
  growthThresholdPercent?: number;      // Default: 20
  seatUtilizationWarning?: number;      // Default: 0.8 (80%)
  seatUtilizationCritical?: number;     // Default: 1.0 (100%)
  minimumUserBaseline?: number;         // Default: 5 users
  cooldownDays?: number;                // Default: 14
  comparisonDays?: number;              // Default: 30
}

// Detection result for a single customer
export interface UserGrowthDetectionResult {
  customerId: string;
  customerName: string;
  alerts: UserGrowthAlert[];
  analysis: UserGrowthAnalysis;
  skipped: boolean;
  skipReason?: string;
}

// Batch detection results
export interface UserGrowthBatchResult {
  processed: number;
  alertsGenerated: number;
  results: UserGrowthDetectionResult[];
  executedAt: string;
}

// Slack alert data
export interface UserGrowthSlackData {
  customerId: string;
  customerName: string;
  alertType: UserGrowthAlertType;
  severity: UserGrowthSeverity;
  currentUsers: number;
  previousUsers: number;
  growthCount: number;
  growthRate: number;
  contractedSeats: number;
  seatUtilization: number;
  overageCount?: number;
  topDepartments: Array<{
    name: string;
    newUsers: number;
  }>;
  estimatedRevenue?: number;
  arr?: number;
  healthScore?: number;
  csmName?: string;
}

// Suggested actions for expansion
export interface ExpansionSuggestion {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  talkingPoints?: string[];
}

// Email draft for expansion outreach
export interface UserGrowthEmailDraft {
  id: string;
  customerId: string;
  alertId: string;
  to: string;
  subject: string;
  body: string;
  expansionSuggestions: ExpansionSuggestion[];
  status: 'pending_approval' | 'approved' | 'sent' | 'rejected';
  createdAt: string;
}

// Customer context for workflow
export interface UserGrowthCustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  contractedSeats: number;
  pricePerSeat?: number;
  csmId?: string;
  csmName?: string;
  csmEmail?: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
}

// Workflow execution result
export interface UserGrowthWorkflowResult {
  success: boolean;
  workflowId: string;
  steps: Array<{
    stepId: string;
    stepName: string;
    success: boolean;
    data?: unknown;
    error?: string;
    executedAt: string;
  }>;
  error?: string;
}

// API response types
export interface UserGrowthAlertsResponse {
  success: boolean;
  data: {
    alerts: UserGrowthAlert[];
    summary: {
      total: number;
      byType: Record<UserGrowthAlertType, number>;
      bySeverity: Record<UserGrowthSeverity, number>;
      totalEstimatedRevenue: number;
    };
  };
  meta: {
    fetchedAt: string;
  };
}

export interface UserGrowthDetectionResponse {
  success: boolean;
  data: UserGrowthDetectionResult;
  meta: {
    detectedAt: string;
    responseTimeMs: number;
  };
}

export interface UserGrowthScanResponse {
  success: boolean;
  data: {
    results: UserGrowthDetectionResult[];
    summary: {
      totalScanned: number;
      customersWithGrowth: number;
      totalAlerts: number;
      alertsByType: Record<UserGrowthAlertType, number>;
      totalEstimatedRevenue: number;
    };
  };
  meta: {
    scannedAt: string;
    responseTimeMs: number;
  };
}
