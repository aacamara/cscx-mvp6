/**
 * Support Metrics Service
 * PRD-156: Support Metrics Dashboard / Support Ticket Analysis Report
 *
 * Provides comprehensive support analytics including:
 * - Customer-level support metrics
 * - Portfolio-wide support overview
 * - SLA performance tracking
 * - CSAT analysis
 * - Trend analysis
 * - Support-health correlation
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import type {
  CustomerSupportMetrics,
  PortfolioSupportSummary,
  CustomerSupportSummary,
  SupportAlert,
  SupportTrendData,
  SupportCorrelationData,
  SLAMetrics,
  SupportTicket,
  SupportReportConfig,
} from '../../../../types/supportMetrics.js';

// ============================================
// Service Class
// ============================================

export class SupportMetricsService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Customer Support Metrics
  // ============================================

  /**
   * Get comprehensive support metrics for a specific customer
   */
  async getCustomerSupportMetrics(
    customerId: string,
    options: {
      period?: string; // 'day', 'week', 'month', 'quarter'
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<CustomerSupportMetrics> {
    const { startDate, endDate } = this.calculateDateRange(options.period, options.startDate, options.endDate);

    if (!this.supabase) {
      return this.getMockCustomerMetrics(customerId, options.period || 'month');
    }

    // Get customer info
    const { data: customer } = await this.supabase
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .single();

    // Get tickets for the period
    const { data: tickets, error: ticketsError } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', customerId)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (ticketsError) {
      console.error('[SupportMetrics] Error fetching tickets:', ticketsError);
      throw ticketsError;
    }

    // Get CSAT data
    const { data: csatData } = await this.supabase
      .from('support_ticket_csat')
      .select('score')
      .eq('customer_id', customerId)
      .gte('responded_at', startDate)
      .lt('responded_at', endDate);

    // Calculate metrics
    const ticketMetrics = this.calculateTicketMetrics(tickets || []);
    const slaMetrics = this.calculateSLAMetrics(tickets || []);
    const csatMetrics = this.calculateCSATMetrics(csatData || [], tickets?.length || 0);
    const escalationMetrics = this.calculateEscalationMetrics(tickets || []);

    return {
      customerId,
      customerName: customer?.name,
      period: options.period || 'month',
      tickets: ticketMetrics,
      sla: slaMetrics,
      satisfaction: csatMetrics,
      escalations: escalationMetrics,
    };
  }

  /**
   * Get support tickets for a customer with optional filters
   */
  async getCustomerTickets(
    customerId: string,
    options: {
      period?: string;
      status?: string[];
      priority?: string[];
      category?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    if (!this.supabase) {
      return { tickets: this.getMockTickets(customerId), total: 12 };
    }

    const { startDate, endDate } = this.calculateDateRange(options.period);

    let query = this.supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: false });

    if (options.status?.length) {
      query = query.in('status', options.status);
    }
    if (options.priority?.length) {
      query = query.in('severity', options.priority);
    }
    if (options.category?.length) {
      query = query.in('category', options.category);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[SupportMetrics] Error fetching customer tickets:', error);
      return { tickets: [], total: 0 };
    }

    return {
      tickets: (data || []).map(this.mapDbTicket),
      total: count || 0,
    };
  }

  // ============================================
  // Portfolio Support Metrics
  // ============================================

  /**
   * Get portfolio-wide support overview
   */
  async getPortfolioSupportMetrics(
    options: {
      csmId?: string;
      period?: string;
      startDate?: string;
      endDate?: string;
      minTickets?: number;
      maxCsat?: number;
    } = {}
  ): Promise<{
    summary: PortfolioSupportSummary;
    customers: CustomerSupportSummary[];
    alerts: SupportAlert[];
  }> {
    const { startDate, endDate } = this.calculateDateRange(options.period, options.startDate, options.endDate);

    if (!this.supabase) {
      return this.getMockPortfolioMetrics(options.period || 'month');
    }

    // Get all customers (optionally filtered by CSM)
    let customersQuery = this.supabase
      .from('customers')
      .select('id, name, arr, health_score, status')
      .eq('status', 'active');

    if (options.csmId) {
      customersQuery = customersQuery.eq('csm_id', options.csmId);
    }

    const { data: customers } = await customersQuery;

    // Get all tickets for the period
    const customerIds = (customers || []).map(c => c.id);
    const { data: allTickets } = await this.supabase
      .from('support_tickets')
      .select('*')
      .in('customer_id', customerIds)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    // Get CSAT data
    const { data: allCsat } = await this.supabase
      .from('support_ticket_csat')
      .select('customer_id, score')
      .in('customer_id', customerIds)
      .gte('responded_at', startDate)
      .lt('responded_at', endDate);

    // Get alerts
    const { data: alertsData } = await this.supabase
      .from('risk_signals')
      .select('*')
      .in('customer_id', customerIds)
      .eq('signal_type', 'ticket_spike')
      .eq('status', 'active');

    // Calculate portfolio summary
    const portfolioTickets = allTickets || [];
    const portfolioCsat = allCsat || [];

    const summary = this.calculatePortfolioSummary(
      customers || [],
      portfolioTickets,
      portfolioCsat,
      options.period || 'month'
    );

    // Calculate per-customer summaries
    const customerSummaries = this.calculateCustomerSummaries(
      customers || [],
      portfolioTickets,
      portfolioCsat,
      alertsData || [],
      options
    );

    // Map alerts
    const alerts = (alertsData || []).map(a => this.mapDbAlert(a));

    return {
      summary,
      customers: customerSummaries,
      alerts,
    };
  }

  // ============================================
  // Trend Analysis
  // ============================================

  /**
   * Get support trend data for charting
   */
  async getSupportTrends(
    customerId?: string,
    options: {
      period?: string;
      granularity?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<SupportTrendData[]> {
    const granularity = options.granularity || 'day';
    const { startDate, endDate } = this.calculateDateRange(options.period);

    if (!this.supabase) {
      return this.getMockTrendData(granularity);
    }

    // Build query
    let ticketsQuery = this.supabase
      .from('support_tickets')
      .select('created_at, status, is_escalated, sla_first_response_met, sla_resolution_met')
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (customerId) {
      ticketsQuery = ticketsQuery.eq('customer_id', customerId);
    }

    const { data: tickets } = await ticketsQuery;

    // Get CSAT data
    let csatQuery = this.supabase
      .from('support_ticket_csat')
      .select('responded_at, score')
      .gte('responded_at', startDate)
      .lt('responded_at', endDate);

    if (customerId) {
      csatQuery = csatQuery.eq('customer_id', customerId);
    }

    const { data: csatData } = await csatQuery;

    // Group data by granularity
    return this.aggregateTrendData(tickets || [], csatData || [], granularity, startDate, endDate);
  }

  // ============================================
  // Support-Health Correlation
  // ============================================

  /**
   * Get correlation data between support metrics and health scores
   */
  async getSupportHealthCorrelation(
    options: {
      period?: string;
      csmId?: string;
    } = {}
  ): Promise<SupportCorrelationData> {
    const { startDate, endDate } = this.calculateDateRange(options.period);

    if (!this.supabase) {
      return this.getMockCorrelationData(options.period || 'month');
    }

    // Get customers with metrics
    let customersQuery = this.supabase
      .from('customers')
      .select('id, name, health_score, arr, status')
      .eq('status', 'active');

    if (options.csmId) {
      customersQuery = customersQuery.eq('csm_id', options.csmId);
    }

    const { data: customers } = await customersQuery;

    // Get ticket volumes per customer
    const { data: ticketCounts } = await this.supabase
      .from('support_tickets')
      .select('customer_id')
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    // Count tickets per customer
    const ticketsByCustomer: Record<string, number> = {};
    for (const t of ticketCounts || []) {
      ticketsByCustomer[t.customer_id] = (ticketsByCustomer[t.customer_id] || 0) + 1;
    }

    // Build data points
    const dataPoints = (customers || []).map(c => ({
      customerId: c.id,
      customerName: c.name,
      ticketVolume: ticketsByCustomer[c.id] || 0,
      healthScore: c.health_score || 50,
      churnRisk: 100 - (c.health_score || 50), // Simple inverse
      arr: c.arr || 0,
    }));

    // Calculate correlations (simplified Pearson correlation)
    const correlations = this.calculateCorrelations(dataPoints);

    return {
      period: options.period || 'month',
      dataPoints,
      correlations,
    };
  }

  // ============================================
  // Alert Management
  // ============================================

  /**
   * Get active support alerts
   */
  async getActiveAlerts(
    options: {
      customerId?: string;
      csmId?: string;
      alertTypes?: string[];
    } = {}
  ): Promise<SupportAlert[]> {
    if (!this.supabase) {
      return this.getMockAlerts();
    }

    let query = this.supabase
      .from('risk_signals')
      .select('*, customers!inner(name)')
      .eq('status', 'active')
      .in('signal_type', options.alertTypes || ['ticket_spike', 'low_csat', 'escalation', 'sla_breach'])
      .order('created_at', { ascending: false });

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SupportMetrics] Error fetching alerts:', error);
      return [];
    }

    return (data || []).map(a => this.mapDbAlert(a));
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private calculateDateRange(
    period?: string,
    customStart?: string,
    customEnd?: string
  ): { startDate: string; endDate: string } {
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }

    const now = new Date();
    const endDate = now.toISOString();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'month':
      default:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    return { startDate: startDate.toISOString(), endDate };
  }

  private calculateTicketMetrics(tickets: any[]): CustomerSupportMetrics['tickets'] {
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    let open = 0, pending = 0, resolved = 0, closed = 0;

    for (const t of tickets) {
      // Status counts
      switch (t.status) {
        case 'open': open++; break;
        case 'pending': pending++; break;
        case 'resolved': resolved++; break;
        case 'closed': closed++; break;
      }

      // Priority/severity breakdown
      const priority = t.severity || t.priority || 'unknown';
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      // Category breakdown
      const category = t.category || 'general';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    return {
      total: tickets.length,
      open,
      pending,
      resolved,
      closed,
      byPriority,
      byCategory,
    };
  }

  private calculateSLAMetrics(tickets: any[]): SLAMetrics {
    let frMet = 0, frBreached = 0, resMet = 0, resBreached = 0;
    let totalFrHours = 0, frCount = 0;
    let totalResHours = 0, resCount = 0;

    for (const t of tickets) {
      // First response SLA
      if (t.first_response_at && t.sla_first_response_met !== null) {
        if (t.sla_first_response_met) {
          frMet++;
        } else {
          frBreached++;
        }

        // Calculate hours
        const frHours = (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        totalFrHours += frHours;
        frCount++;
      }

      // Resolution SLA
      if (t.resolved_at && t.sla_resolution_met !== null) {
        if (t.sla_resolution_met) {
          resMet++;
        } else {
          resBreached++;
        }

        const resHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        totalResHours += resHours;
        resCount++;
      }
    }

    const frTotal = frMet + frBreached;
    const resTotal = resMet + resBreached;

    return {
      firstResponseMetPct: frTotal > 0 ? Math.round((frMet / frTotal) * 1000) / 10 : 100,
      firstResponseBreachedPct: frTotal > 0 ? Math.round((frBreached / frTotal) * 1000) / 10 : 0,
      resolutionMetPct: resTotal > 0 ? Math.round((resMet / resTotal) * 1000) / 10 : 100,
      resolutionBreachedPct: resTotal > 0 ? Math.round((resBreached / resTotal) * 1000) / 10 : 0,
      avgFirstResponseHours: frCount > 0 ? Math.round((totalFrHours / frCount) * 10) / 10 : 0,
      avgResolutionHours: resCount > 0 ? Math.round((totalResHours / resCount) * 10) / 10 : 0,
    };
  }

  private calculateCSATMetrics(csatData: any[], totalTickets: number): CustomerSupportMetrics['satisfaction'] {
    if (csatData.length === 0) {
      return {
        avgCsat: 0,
        csatResponses: 0,
        csatResponseRate: 0,
        trend: 'stable',
      };
    }

    const totalScore = csatData.reduce((sum, c) => sum + c.score, 0);
    const avgCsat = Math.round((totalScore / csatData.length) * 10) / 10;
    const responseRate = totalTickets > 0 ? Math.round((csatData.length / totalTickets) * 100) : 0;

    // Simple trend calculation (would need historical data for real trend)
    const trend = avgCsat >= 4 ? 'improving' : avgCsat >= 3 ? 'stable' : 'declining';

    return {
      avgCsat,
      csatResponses: csatData.length,
      csatResponseRate: responseRate,
      trend,
    };
  }

  private calculateEscalationMetrics(tickets: any[]): CustomerSupportMetrics['escalations'] {
    const escalatedTickets = tickets.filter(t => t.is_escalated);
    const openEscalations = escalatedTickets.filter(t => t.status === 'open' || t.status === 'pending');

    return {
      total: escalatedTickets.length,
      open: openEscalations.length,
      rate: tickets.length > 0 ? Math.round((escalatedTickets.length / tickets.length) * 1000) / 10 : 0,
    };
  }

  private calculatePortfolioSummary(
    customers: any[],
    tickets: any[],
    csatData: any[],
    period: string
  ): PortfolioSupportSummary {
    const customersWithTickets = new Set(tickets.map(t => t.customer_id)).size;
    const ticketMetrics = this.calculateTicketMetrics(tickets);
    const slaMetrics = this.calculateSLAMetrics(tickets);
    const csatMetrics = this.calculateCSATMetrics(csatData, tickets.length);
    const escalationMetrics = this.calculateEscalationMetrics(tickets);

    // Count low CSAT customers
    const csatByCustomer: Record<string, number[]> = {};
    for (const c of csatData) {
      if (!csatByCustomer[c.customer_id]) {
        csatByCustomer[c.customer_id] = [];
      }
      csatByCustomer[c.customer_id].push(c.score);
    }

    const lowCsatCustomers = Object.values(csatByCustomer).filter(scores => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return avg < 3.5;
    }).length;

    return {
      period,
      totalCustomers: customers.length,
      customersWithTickets,
      tickets: {
        total: ticketMetrics.total,
        open: ticketMetrics.open + ticketMetrics.pending,
        resolved: ticketMetrics.resolved + ticketMetrics.closed,
        avgPerCustomer: customers.length > 0 ? Math.round((ticketMetrics.total / customers.length) * 10) / 10 : 0,
        changeFromPrevious: 0, // Would need historical comparison
      },
      sla: {
        ...slaMetrics,
        targetFirstResponse: 90,
        targetResolution: 90,
      },
      satisfaction: {
        avgCsat: csatMetrics.avgCsat,
        csatResponses: csatMetrics.csatResponses,
        lowCsatCustomers,
        trend: csatMetrics.trend,
      },
      escalations: escalationMetrics,
    };
  }

  private calculateCustomerSummaries(
    customers: any[],
    tickets: any[],
    csatData: any[],
    alerts: any[],
    options: any
  ): CustomerSupportSummary[] {
    // Group tickets by customer
    const ticketsByCustomer: Record<string, any[]> = {};
    for (const t of tickets) {
      if (!ticketsByCustomer[t.customer_id]) {
        ticketsByCustomer[t.customer_id] = [];
      }
      ticketsByCustomer[t.customer_id].push(t);
    }

    // Group CSAT by customer
    const csatByCustomer: Record<string, number[]> = {};
    for (const c of csatData) {
      if (!csatByCustomer[c.customer_id]) {
        csatByCustomer[c.customer_id] = [];
      }
      csatByCustomer[c.customer_id].push(c.score);
    }

    // Map alerts by customer
    const alertsByCustomer: Record<string, any[]> = {};
    for (const a of alerts) {
      if (!alertsByCustomer[a.customer_id]) {
        alertsByCustomer[a.customer_id] = [];
      }
      alertsByCustomer[a.customer_id].push(a);
    }

    return customers
      .map(c => {
        const customerTickets = ticketsByCustomer[c.id] || [];
        const customerCsat = csatByCustomer[c.id] || [];
        const customerAlerts = alertsByCustomer[c.id] || [];

        const openTickets = customerTickets.filter(t => t.status === 'open' || t.status === 'pending').length;
        const escalations = customerTickets.filter(t => t.is_escalated).length;
        const avgCsat = customerCsat.length > 0
          ? Math.round((customerCsat.reduce((a, b) => a + b, 0) / customerCsat.length) * 10) / 10
          : undefined;

        const spikeAlert = customerAlerts.find(a => a.signal_type === 'ticket_spike');
        const isSpike = !!spikeAlert;
        const spikeMultiplier = spikeAlert?.metadata?.spike_multiplier;

        // Determine if needs attention
        const attentionReasons: string[] = [];
        if (isSpike) attentionReasons.push(`Ticket spike (${spikeMultiplier}x)`);
        if (avgCsat !== undefined && avgCsat < 3.5) attentionReasons.push(`Low CSAT (${avgCsat})`);
        if (escalations > 0) attentionReasons.push(`${escalations} escalated tickets`);
        if (openTickets >= 10) attentionReasons.push(`High open ticket count (${openTickets})`);

        return {
          customerId: c.id,
          customerName: c.name,
          arr: c.arr,
          healthScore: c.health_score,
          openTickets,
          totalTicketsThisPeriod: customerTickets.length,
          avgCsat,
          escalationCount: escalations,
          isSpike,
          spikeMultiplier,
          needsAttention: attentionReasons.length > 0,
          attentionReasons,
        };
      })
      .filter(c => {
        // Apply filters
        if (options.minTickets && c.totalTicketsThisPeriod < options.minTickets) return false;
        if (options.maxCsat && c.avgCsat !== undefined && c.avgCsat > options.maxCsat) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by attention needed first, then by tickets
        if (a.needsAttention && !b.needsAttention) return -1;
        if (!a.needsAttention && b.needsAttention) return 1;
        return b.totalTicketsThisPeriod - a.totalTicketsThisPeriod;
      });
  }

  private aggregateTrendData(
    tickets: any[],
    csatData: any[],
    granularity: 'day' | 'week' | 'month',
    startDate: string,
    endDate: string
  ): SupportTrendData[] {
    const result: SupportTrendData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Group tickets by date
    const ticketsByDate: Record<string, any[]> = {};
    for (const t of tickets) {
      const date = this.truncateDate(new Date(t.created_at), granularity);
      if (!ticketsByDate[date]) {
        ticketsByDate[date] = [];
      }
      ticketsByDate[date].push(t);
    }

    // Group CSAT by date
    const csatByDate: Record<string, number[]> = {};
    for (const c of csatData) {
      const date = this.truncateDate(new Date(c.responded_at), granularity);
      if (!csatByDate[date]) {
        csatByDate[date] = [];
      }
      csatByDate[date].push(c.score);
    }

    // Generate data points for each period
    let current = new Date(start);
    while (current < end) {
      const dateKey = this.truncateDate(current, granularity);
      const dayTickets = ticketsByDate[dateKey] || [];
      const dayCsat = csatByDate[dateKey] || [];

      const openTickets = dayTickets.filter(t => t.status === 'open' || t.status === 'pending').length;
      const resolvedTickets = dayTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
      const escalations = dayTickets.filter(t => t.is_escalated).length;
      const slaMet = dayTickets.filter(t => t.sla_first_response_met || t.sla_resolution_met).length;

      result.push({
        date: dateKey,
        ticketCount: dayTickets.length,
        openTickets,
        resolvedTickets,
        avgCsat: dayCsat.length > 0
          ? Math.round((dayCsat.reduce((a, b) => a + b, 0) / dayCsat.length) * 10) / 10
          : undefined,
        escalations,
        slaMetPct: dayTickets.length > 0 ? Math.round((slaMet / dayTickets.length) * 100) : 100,
      });

      // Increment date
      switch (granularity) {
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return result;
  }

  private truncateDate(date: Date, granularity: 'day' | 'week' | 'month'): string {
    switch (granularity) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
  }

  private calculateCorrelations(dataPoints: any[]): SupportCorrelationData['correlations'] {
    if (dataPoints.length < 3) {
      return {
        ticketVsHealth: 0,
        ticketVsChurnRisk: 0,
        csatVsHealth: 0,
      };
    }

    // Simple Pearson correlation calculation
    const pearson = (xs: number[], ys: number[]): number => {
      const n = xs.length;
      if (n !== ys.length || n === 0) return 0;

      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((total, x, i) => total + x * ys[i], 0);
      const sumX2 = xs.reduce((total, x) => total + x * x, 0);
      const sumY2 = ys.reduce((total, y) => total + y * y, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

      return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100) / 100;
    };

    const tickets = dataPoints.map(d => d.ticketVolume);
    const health = dataPoints.map(d => d.healthScore);
    const churn = dataPoints.map(d => d.churnRisk);

    return {
      ticketVsHealth: pearson(tickets, health),
      ticketVsChurnRisk: pearson(tickets, churn),
      csatVsHealth: 0, // Would need CSAT data per customer
    };
  }

  private mapDbTicket(row: any): SupportTicket {
    return {
      id: row.id,
      externalId: row.external_id,
      customerId: row.customer_id,
      subject: row.subject,
      description: row.description,
      category: row.category,
      priority: row.severity,
      status: row.status,
      assignee: row.assignee,
      reporterEmail: row.reporter_email,
      reporterName: row.reporter_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      firstResponseAt: row.first_response_at,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      slaFirstResponseTargetHours: row.sla_first_response_target_hours,
      slaResolutionTargetHours: row.sla_resolution_target_hours,
      slaFirstResponseMet: row.sla_first_response_met,
      slaResolutionMet: row.sla_resolution_met,
      isEscalated: row.is_escalated || false,
      escalationLevel: row.escalation_level || 0,
      escalationReason: row.escalation_reason,
      csatScore: row.csat_score,
      csatFeedback: row.csat_feedback,
      source: row.source || 'manual',
      externalUrl: row.external_url,
    };
  }

  private mapDbAlert(row: any): SupportAlert {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers?.name,
      type: row.signal_type as any,
      severity: row.severity,
      title: row.title,
      description: row.description || '',
      metadata: row.metadata || {},
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
    };
  }

  // ============================================
  // Mock Data Methods
  // ============================================

  private getMockCustomerMetrics(customerId: string, period: string): CustomerSupportMetrics {
    return {
      customerId,
      customerName: 'Acme Corp',
      period,
      tickets: {
        total: 45,
        open: 12,
        pending: 5,
        resolved: 20,
        closed: 8,
        byPriority: { P1: 3, P2: 12, P3: 22, P4: 8 },
        byCategory: { technical: 25, billing: 8, training: 7, feature_request: 5 },
      },
      sla: {
        firstResponseMetPct: 94,
        firstResponseBreachedPct: 6,
        resolutionMetPct: 87,
        resolutionBreachedPct: 13,
        avgFirstResponseHours: 2.3,
        avgResolutionHours: 18.5,
      },
      satisfaction: {
        avgCsat: 4.2,
        csatResponses: 32,
        csatResponseRate: 71,
        trend: 'stable',
      },
      escalations: {
        total: 5,
        open: 2,
        rate: 11.1,
      },
    };
  }

  private getMockPortfolioMetrics(period: string): {
    summary: PortfolioSupportSummary;
    customers: CustomerSupportSummary[];
    alerts: SupportAlert[];
  } {
    return {
      summary: {
        period,
        totalCustomers: 45,
        customersWithTickets: 28,
        tickets: {
          total: 156,
          open: 47,
          resolved: 109,
          avgPerCustomer: 3.5,
          changeFromPrevious: 12,
        },
        sla: {
          firstResponseMetPct: 94,
          firstResponseBreachedPct: 6,
          resolutionMetPct: 87,
          resolutionBreachedPct: 13,
          avgFirstResponseHours: 2.8,
          avgResolutionHours: 22.4,
          targetFirstResponse: 90,
          targetResolution: 90,
        },
        satisfaction: {
          avgCsat: 4.1,
          csatResponses: 98,
          lowCsatCustomers: 3,
          trend: 'stable',
        },
        escalations: {
          total: 12,
          open: 5,
          rate: 7.7,
        },
      },
      customers: [
        {
          customerId: '1',
          customerName: 'Acme Corp',
          arr: 125000,
          healthScore: 42,
          openTickets: 12,
          totalTicketsThisPeriod: 18,
          avgCsat: 3.1,
          escalationCount: 3,
          isSpike: true,
          spikeMultiplier: 3.5,
          needsAttention: true,
          attentionReasons: ['Ticket spike (3.5x)', 'Low CSAT (3.1)'],
        },
        {
          customerId: '2',
          customerName: 'TechStart Inc',
          arr: 85000,
          healthScore: 65,
          openTickets: 8,
          totalTicketsThisPeriod: 12,
          avgCsat: 3.8,
          escalationCount: 1,
          isSpike: false,
          needsAttention: true,
          attentionReasons: ['1 escalated tickets'],
        },
        {
          customerId: '3',
          customerName: 'DataFlow Systems',
          arr: 200000,
          healthScore: 85,
          openTickets: 3,
          totalTicketsThisPeriod: 5,
          avgCsat: 4.5,
          escalationCount: 0,
          isSpike: false,
          needsAttention: false,
          attentionReasons: [],
        },
      ],
      alerts: [
        {
          id: 'alert-1',
          customerId: '1',
          customerName: 'Acme Corp',
          type: 'ticket_spike',
          severity: 'high',
          title: 'Support ticket spike: 18 tickets (3.5x normal)',
          description: 'Customer experienced 3.5x their normal support ticket rate in the last 24 hours.',
          metadata: { ticket_count: 18, spike_multiplier: 3.5, themes: ['login', 'error', 'api'] },
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  private getMockTickets(customerId: string): SupportTicket[] {
    return [
      {
        id: 'ticket-1',
        externalId: '#4521',
        customerId,
        subject: 'Login issues after password reset',
        category: 'technical',
        priority: 'high',
        status: 'open',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        isEscalated: true,
        escalationLevel: 1,
        source: 'zendesk',
        slaFirstResponseMet: false,
      },
      {
        id: 'ticket-2',
        externalId: '#4518',
        customerId,
        subject: 'Export function not working',
        category: 'technical',
        priority: 'high',
        status: 'pending',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        isEscalated: false,
        escalationLevel: 0,
        source: 'zendesk',
        slaFirstResponseMet: true,
      },
    ];
  }

  private getMockTrendData(granularity: 'day' | 'week' | 'month'): SupportTrendData[] {
    const data: SupportTrendData[] = [];
    const now = new Date();

    const points = granularity === 'day' ? 30 : granularity === 'week' ? 12 : 6;

    for (let i = points - 1; i >= 0; i--) {
      const date = new Date(now);
      if (granularity === 'day') {
        date.setDate(date.getDate() - i);
      } else if (granularity === 'week') {
        date.setDate(date.getDate() - i * 7);
      } else {
        date.setMonth(date.getMonth() - i);
      }

      const baseTickets = Math.floor(Math.random() * 10) + 5;
      data.push({
        date: date.toISOString().split('T')[0],
        ticketCount: baseTickets,
        openTickets: Math.floor(baseTickets * 0.3),
        resolvedTickets: Math.floor(baseTickets * 0.7),
        avgCsat: 3.5 + Math.random() * 1.5,
        escalations: Math.floor(Math.random() * 3),
        slaMetPct: 85 + Math.floor(Math.random() * 15),
      });
    }

    return data;
  }

  private getMockCorrelationData(period: string): SupportCorrelationData {
    return {
      period,
      dataPoints: [
        { customerId: '1', customerName: 'High Tickets', ticketVolume: 25, healthScore: 45, churnRisk: 55, arr: 100000 },
        { customerId: '2', customerName: 'Medium Tickets', ticketVolume: 10, healthScore: 72, churnRisk: 28, arr: 150000 },
        { customerId: '3', customerName: 'Low Tickets', ticketVolume: 3, healthScore: 88, churnRisk: 12, arr: 200000 },
      ],
      correlations: {
        ticketVsHealth: -0.85,
        ticketVsChurnRisk: 0.78,
        csatVsHealth: 0.72,
      },
    };
  }

  private getMockAlerts(): SupportAlert[] {
    return [
      {
        id: 'alert-1',
        customerId: '1',
        customerName: 'Acme Corp',
        type: 'ticket_spike',
        severity: 'high',
        title: 'Support ticket spike detected',
        description: '12 tickets in the last 24 hours (3x normal rate)',
        metadata: { ticketCount: 12, multiplier: 3.0 },
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

// Singleton instance
export const supportMetricsService = new SupportMetricsService();
