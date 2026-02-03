/**
 * PRD-112: Feature Request Update Types
 *
 * Type definitions for feature request tracking and status alerts.
 * Enables CSMs to close the loop on feature requests with customers.
 */

// ============================================
// Feature Request Types
// ============================================

export type FeatureRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'released'
  | 'declined';

export type FeatureRequestPriority = 'low' | 'medium' | 'high' | 'critical';

export type ProductArea =
  | 'core'
  | 'analytics'
  | 'integrations'
  | 'reporting'
  | 'automation'
  | 'api'
  | 'ui_ux'
  | 'performance'
  | 'security'
  | 'other';

// ============================================
// Feature Request Entity
// ============================================

export interface FeatureRequest {
  id: string;
  customerId: string;
  customerName: string;
  requestedByStakeholderId?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  requestedByRole?: string;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  productArea: ProductArea;
  priority: FeatureRequestPriority;
  productNotes?: string;
  declineReason?: string;
  targetRelease?: string;
  releaseVersion?: string;
  releasedAt?: Date;
  releaseDocumentationUrl?: string;
  csmNotifiedAt?: Date;
  customerNotifiedAt?: Date;
  votesCount: number;
  relatedCustomerIds?: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Feature Request Alert
// ============================================

export type AlertType =
  | 'status_changed'
  | 'accepted'
  | 'scheduled'
  | 'released'
  | 'declined';

export type AlertPriority = 'low' | 'medium' | 'high';

export interface FeatureRequestAlert {
  id: string;
  featureRequestId: string;
  customerId: string;
  customerName: string;
  csmUserId: string;
  alertType: AlertType;
  priority: AlertPriority;
  title: string;
  summary: string;
  previousStatus?: FeatureRequestStatus;
  newStatus: FeatureRequestStatus;
  featureTitle: string;
  featureDescription: string;
  productNotes?: string;
  releaseDetails?: ReleaseDetails;
  declineDetails?: DeclineDetails;
  requestedBy?: {
    name: string;
    email?: string;
    role?: string;
  };
  originalRequestDate: Date;
  otherCustomersCount: number;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  customerNotified: boolean;
  customerNotifiedAt?: Date;
  createdAt: Date;
}

export interface ReleaseDetails {
  version: string;
  releaseDate: Date;
  documentationUrl?: string;
  changelogUrl?: string;
  highlights?: string[];
}

export interface DeclineDetails {
  reason: string;
  alternativeSuggestion?: string;
  mayReconsider: boolean;
}

// ============================================
// Status History
// ============================================

export interface StatusHistoryEntry {
  id: string;
  featureRequestId: string;
  previousStatus: FeatureRequestStatus | null;
  newStatus: FeatureRequestStatus;
  notes?: string;
  changedBy: string;
  changedAt: Date;
}

// ============================================
// Customer Feature Request Summary
// ============================================

export interface CustomerFeatureRequestSummary {
  customerId: string;
  customerName: string;
  totalRequests: number;
  byStatus: Record<FeatureRequestStatus, number>;
  recentlyReleased: FeatureRequest[];
  pending: FeatureRequest[];
  declined: FeatureRequest[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateFeatureRequestInput {
  customerId: string;
  requestedByStakeholderId?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  requestedByRole?: string;
  title: string;
  description: string;
  productArea: ProductArea;
  priority?: FeatureRequestPriority;
  tags?: string[];
}

export interface UpdateFeatureRequestStatusInput {
  status: FeatureRequestStatus;
  productNotes?: string;
  targetRelease?: string;
  releaseVersion?: string;
  releaseDocumentationUrl?: string;
  declineReason?: string;
}

export interface FeatureRequestFilters {
  customerId?: string;
  status?: FeatureRequestStatus | FeatureRequestStatus[];
  productArea?: ProductArea;
  priority?: FeatureRequestPriority;
  createdAfter?: Date;
  createdBefore?: Date;
  releasedAfter?: Date;
  releasedBefore?: Date;
  search?: string;
}

export interface FeatureRequestListResponse {
  requests: FeatureRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlertFilters {
  csmUserId?: string;
  customerId?: string;
  alertType?: AlertType | AlertType[];
  acknowledged?: boolean;
  customerNotified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface AlertListResponse {
  alerts: FeatureRequestAlert[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// Feature Request Metrics
// ============================================

export interface FeatureRequestMetrics {
  totalOpen: number;
  byStatus: Record<FeatureRequestStatus, number>;
  byProductArea: Record<string, number>;
  releasedThisMonth: number;
  releasedThisQuarter: number;
  avgTimeToRelease: number; // in days
  pendingAlerts: number;
  customerNotificationRate: number; // percentage
}

// ============================================
// Draft Email for Customer Notification
// ============================================

export interface FeatureAnnouncementDraft {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  featureRequestId: string;
  customerId: string;
}

// ============================================
// Slack Alert Format (for integrations)
// ============================================

export interface SlackFeatureAlert {
  customerName: string;
  featureTitle: string;
  status: FeatureRequestStatus;
  requestedBy: {
    name: string;
    role?: string;
  };
  originalRequestDate: Date;
  releaseDetails?: ReleaseDetails;
  declineDetails?: DeclineDetails;
  otherCustomersCount: number;
  suggestedMessage?: string;
  actionButtons: Array<{
    text: string;
    action: string;
    url?: string;
  }>;
}

// ============================================
// Notification Preferences
// ============================================

export type NotificationChannel = 'in_app' | 'email' | 'slack';

export interface FeatureRequestNotificationPreferences {
  userId: string;
  channels: NotificationChannel[];
  alertOnAccepted: boolean;
  alertOnScheduled: boolean;
  alertOnReleased: boolean;
  alertOnDeclined: boolean;
  digestFrequency: 'immediate' | 'daily' | 'weekly';
}
