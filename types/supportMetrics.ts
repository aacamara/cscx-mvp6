/**
 * Support Metrics Types
 * PRD-156: Support Metrics Dashboard / Support Ticket Analysis Report
 */

// ============================================
// Core Support Ticket Types
// ============================================

export interface SupportTicket {
  id: string;
  externalId: string;
  customerId: string;
  subject: string;
  description?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee?: string;
  reporterEmail?: string;
  reporterName?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;

  // SLA tracking
  slaFirstResponseTargetHours?: number;
  slaResolutionTargetHours?: number;
  slaFirstResponseMet?: boolean;
  slaResolutionMet?: boolean;

  // Escalation
  isEscalated: boolean;
  escalationLevel: number;
  escalationReason?: string;

  // Satisfaction
  csatScore?: number;
  csatFeedback?: string;

  // Source
  source: string;
  externalUrl?: string;
}

export type TicketCategory = 'technical' | 'billing' | 'training' | 'feature_request' | 'general' | 'integration' | 'performance';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low' | 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

// ============================================
// SLA Types
// ============================================

export interface SLAConfig {
  id: string;
  customerId?: string;
  tier: 'standard' | 'premium' | 'enterprise';

  // First response targets (in hours)
  p1FirstResponseHours: number;
  p2FirstResponseHours: number;
  p3FirstResponseHours: number;
  p4FirstResponseHours: number;

  // Resolution targets (in hours)
  p1ResolutionHours: number;
  p2ResolutionHours: number;
  p3ResolutionHours: number;
  p4ResolutionHours: number;

  isDefault: boolean;
}

export interface SLAMetrics {
  firstResponseMetPct: number;
  firstResponseBreachedPct: number;
  resolutionMetPct: number;
  resolutionBreachedPct: number;
  avgFirstResponseHours: number;
  avgResolutionHours: number;
}

// ============================================
// Customer Support Metrics
// ============================================

export interface CustomerSupportMetrics {
  customerId: string;
  customerName?: string;
  period: string; // e.g., "2026-01" or "2026-01-15"

  tickets: {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    closed: number;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  };

  sla: SLAMetrics;

  satisfaction: {
    avgCsat: number;
    csatResponses: number;
    csatResponseRate: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  escalations: {
    total: number;
    open: number;
    rate: number;
    avgTimeToEscalation?: number;
  };
}

// ============================================
// Portfolio Support Overview
// ============================================

export interface PortfolioSupportSummary {
  period: string;
  totalCustomers: number;
  customersWithTickets: number;

  tickets: {
    total: number;
    open: number;
    resolved: number;
    avgPerCustomer: number;
    changeFromPrevious: number; // percentage
  };

  sla: SLAMetrics & {
    targetFirstResponse: number;
    targetResolution: number;
  };

  satisfaction: {
    avgCsat: number;
    csatResponses: number;
    lowCsatCustomers: number; // customers with CSAT < 3.5
    trend: 'improving' | 'stable' | 'declining';
  };

  escalations: {
    total: number;
    open: number;
    rate: number;
  };
}

export interface CustomerSupportSummary {
  customerId: string;
  customerName: string;
  arr?: number;
  healthScore?: number;

  openTickets: number;
  totalTicketsThisPeriod: number;
  avgCsat?: number;
  escalationCount: number;
  isSpike: boolean;
  spikeMultiplier?: number;

  // Flags for attention
  needsAttention: boolean;
  attentionReasons: string[];
}

// ============================================
// Support Alerts
// ============================================

export interface SupportAlert {
  id: string;
  customerId: string;
  customerName?: string;
  type: SupportAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export type SupportAlertType =
  | 'ticket_spike'
  | 'low_csat'
  | 'escalation'
  | 'sla_breach'
  | 'high_priority_ticket'
  | 'recurring_issue';

// ============================================
// Trend Data
// ============================================

export interface SupportTrendData {
  date: string;
  ticketCount: number;
  openTickets: number;
  resolvedTickets: number;
  avgCsat?: number;
  escalations: number;
  slaMetPct: number;
}

export interface SupportTrendAnalysis {
  period: string;
  dataPoints: SupportTrendData[];
  summary: {
    ticketTrend: 'increasing' | 'stable' | 'decreasing';
    ticketChangePercent: number;
    csatTrend: 'improving' | 'stable' | 'declining';
    csatChangePoints: number;
    slaTrend: 'improving' | 'stable' | 'declining';
    slaChangePercent: number;
  };
}

// ============================================
// API Response Types
// ============================================

export interface SupportMetricsResponse {
  customer: CustomerSupportMetrics;
  tickets: SupportTicket[];
  trends: SupportTrendData[];
  alerts: SupportAlert[];
}

export interface PortfolioSupportResponse {
  summary: PortfolioSupportSummary;
  customers: CustomerSupportSummary[];
  alerts: SupportAlert[];
  trends: SupportTrendData[];
}

export interface SupportCorrelationData {
  period: string;
  dataPoints: Array<{
    customerId: string;
    customerName: string;
    ticketVolume: number;
    healthScore: number;
    churnRisk: number;
    arr: number;
  }>;
  correlations: {
    ticketVsHealth: number; // correlation coefficient
    ticketVsChurnRisk: number;
    csatVsHealth: number;
  };
}

// ============================================
// Report Configuration
// ============================================

export interface SupportReportConfig {
  period: 'day' | 'week' | 'month' | 'quarter';
  customStartDate?: string;
  customEndDate?: string;
  csmId?: string;
  customerIds?: string[];
  includeTicketDetails: boolean;
  includeTrends: boolean;
  includeAlerts: boolean;
  sortBy: 'tickets' | 'csat' | 'escalations' | 'arr';
  sortOrder: 'asc' | 'desc';
  minTickets?: number;
  maxCsat?: number;
}
