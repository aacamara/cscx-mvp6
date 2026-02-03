/**
 * Timeline Builder Service
 * PRD-021: Multi-File Upload Cross-Reference Analysis
 *
 * Builds a unified timeline from multiple data sources,
 * normalizing events and creating a comprehensive view.
 */

import { v4 as uuidv4 } from 'uuid';
import { ExtractedEvent, FileProcessingResult } from './multiFileProcessor.js';

// ============================================
// TYPES
// ============================================

export type EventSource = 'usage' | 'support' | 'nps' | 'meeting' | 'invoice' | 'contract' | 'email' | 'system';
export type EventSeverity = 'positive' | 'neutral' | 'warning' | 'critical';

export interface TimelineEvent {
  id: string;
  date: string;
  source: EventSource;
  type: string;
  title: string;
  description: string;
  severity: EventSeverity;
  metrics?: Record<string, string | number>;
  relatedEvents?: string[];
  confidence: number;
}

export interface TimelineMilestone {
  date: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  significance: number;
}

export interface HealthSnapshot {
  date: string;
  score: number;
  components: {
    usage: number;
    engagement: number;
    sentiment: number;
    financial: number;
  };
}

export interface UnifiedTimeline {
  customerId: string;
  customerName: string;
  dateRange: {
    start: string;
    end: string;
  };
  events: TimelineEvent[];
  milestones: TimelineMilestone[];
  healthSnapshots: HealthSnapshot[];
  eventsByDate: Map<string, TimelineEvent[]>;
  eventsBySource: Map<EventSource, TimelineEvent[]>;
}

// ============================================
// TIMELINE BUILDER SERVICE
// ============================================

export class TimelineBuilder {
  /**
   * Build a unified timeline from multiple file processing results
   */
  buildTimeline(
    customerId: string,
    customerName: string,
    processingResults: FileProcessingResult[]
  ): UnifiedTimeline {
    // Collect all events
    const allEvents: TimelineEvent[] = [];

    for (const result of processingResults) {
      for (const event of result.extractedEvents) {
        allEvents.push({
          id: event.id,
          date: event.date,
          source: event.source as EventSource,
          type: event.type,
          title: event.title,
          description: event.description,
          severity: event.severity,
          metrics: event.metrics,
          confidence: event.confidence
        });
      }
    }

    // Sort by date
    allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate date range
    const dates = allEvents.map(e => e.date).filter(d => d);
    const dateRange = {
      start: dates[0] || new Date().toISOString().split('T')[0],
      end: dates[dates.length - 1] || new Date().toISOString().split('T')[0]
    };

    // Group events by date and source
    const eventsByDate = new Map<string, TimelineEvent[]>();
    const eventsBySource = new Map<EventSource, TimelineEvent[]>();

    for (const event of allEvents) {
      // By date
      const dateEvents = eventsByDate.get(event.date) || [];
      dateEvents.push(event);
      eventsByDate.set(event.date, dateEvents);

      // By source
      const sourceEvents = eventsBySource.get(event.source) || [];
      sourceEvents.push(event);
      eventsBySource.set(event.source, sourceEvents);
    }

    // Identify milestones
    const milestones = this.identifyMilestones(allEvents, eventsByDate);

    // Calculate health snapshots
    const healthSnapshots = this.calculateHealthSnapshots(eventsByDate, dateRange);

    // Find related events
    this.findRelatedEvents(allEvents);

    return {
      customerId,
      customerName,
      dateRange,
      events: allEvents,
      milestones,
      healthSnapshots,
      eventsByDate,
      eventsBySource
    };
  }

  /**
   * Identify significant milestones in the timeline
   */
  private identifyMilestones(
    events: TimelineEvent[],
    eventsByDate: Map<string, TimelineEvent[]>
  ): TimelineMilestone[] {
    const milestones: TimelineMilestone[] = [];

    // Look for significant events
    for (const event of events) {
      let significance = 0;
      let type: 'positive' | 'negative' | 'neutral' = 'neutral';

      // NPS changes are significant
      if (event.type === 'nps_response' && event.metrics) {
        const nps = event.metrics.nps_score as number;
        if (nps !== undefined) {
          significance = Math.abs(nps) / 2;
          type = nps >= 30 ? 'positive' : nps < 0 ? 'negative' : 'neutral';

          if (Math.abs(nps) >= 20 || nps < 0) {
            milestones.push({
              date: event.date,
              title: `NPS ${nps >= 0 ? '+' : ''}${nps}`,
              description: event.description,
              type,
              significance: Math.min(100, significance * 2)
            });
          }
        }
      }

      // Escalations are significant
      if (event.type === 'support_ticket' && event.metrics?.escalated === 1) {
        milestones.push({
          date: event.date,
          title: 'Support Escalation',
          description: event.title,
          type: 'negative',
          significance: 70
        });
      }

      // Large invoices or payment issues
      if (event.type === 'invoice' && event.metrics) {
        const amount = event.metrics.amount as number;
        const daysLate = event.metrics.days_late as number;

        if (daysLate > 15) {
          milestones.push({
            date: event.date,
            title: 'Payment Delayed',
            description: `Invoice $${amount?.toLocaleString()} is ${daysLate} days late`,
            type: 'negative',
            significance: Math.min(80, 40 + daysLate)
          });
        }
      }

      // Meeting with concerns
      if (event.type === 'meeting' && event.metrics?.concerns && (event.metrics.concerns as number) > 0) {
        milestones.push({
          date: event.date,
          title: 'Customer Raised Concerns',
          description: event.description,
          type: 'negative',
          significance: 60
        });
      }
    }

    // Look for significant date clusters (many events on one day)
    for (const [date, dateEvents] of eventsByDate) {
      const criticalEvents = dateEvents.filter(e => e.severity === 'critical');
      if (criticalEvents.length >= 2) {
        milestones.push({
          date,
          title: 'Multiple Critical Events',
          description: `${criticalEvents.length} critical events occurred`,
          type: 'negative',
          significance: 80
        });
      }
    }

    // Sort by date and significance
    milestones.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.significance - a.significance;
    });

    return milestones;
  }

  /**
   * Calculate health snapshots over time
   */
  private calculateHealthSnapshots(
    eventsByDate: Map<string, TimelineEvent[]>,
    dateRange: { start: string; end: string }
  ): HealthSnapshot[] {
    const snapshots: HealthSnapshot[] = [];
    const dates = Array.from(eventsByDate.keys()).sort();

    // Running scores
    let usageScore = 70;
    let engagementScore = 70;
    let sentimentScore = 70;
    let financialScore = 70;

    // Sample weekly
    const weeklyDates: string[] = [];
    let currentDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    while (currentDate <= endDate) {
      weeklyDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 7);
    }

    for (const date of weeklyDates) {
      // Get events up to this date
      const eventsToDate = dates
        .filter(d => d <= date)
        .flatMap(d => eventsByDate.get(d) || []);

      // Recalculate scores based on recent events
      const recentEvents = eventsToDate.filter(e => {
        const eventDate = new Date(e.date);
        const checkDate = new Date(date);
        const daysDiff = (checkDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30; // Last 30 days
      });

      // Usage score based on usage events
      const usageEvents = recentEvents.filter(e => e.source === 'usage');
      if (usageEvents.length > 0) {
        const avgUsage = usageEvents.reduce((sum, e) => {
          return sum + ((e.metrics?.total_events as number) || 0);
        }, 0) / usageEvents.length;
        usageScore = Math.min(100, Math.max(0, 50 + Math.log10(avgUsage + 1) * 20));
      }

      // Engagement score based on meetings and emails
      const engagementEvents = recentEvents.filter(e =>
        e.source === 'meeting' || e.source === 'email'
      );
      engagementScore = Math.min(100, 50 + engagementEvents.length * 5);

      // Sentiment score based on NPS and support
      const npsEvents = recentEvents.filter(e => e.source === 'nps');
      const supportEvents = recentEvents.filter(e => e.source === 'support');

      if (npsEvents.length > 0) {
        const latestNPS = npsEvents[npsEvents.length - 1];
        const npsScore = (latestNPS.metrics?.nps_score as number) || 0;
        sentimentScore = Math.min(100, Math.max(0, 50 + npsScore));
      }

      // Adjust sentiment for escalations
      const escalations = supportEvents.filter(e => e.metrics?.escalated === 1).length;
      sentimentScore = Math.max(0, sentimentScore - escalations * 10);

      // Financial score based on invoices
      const invoiceEvents = recentEvents.filter(e => e.source === 'invoice');
      if (invoiceEvents.length > 0) {
        const lateInvoices = invoiceEvents.filter(e =>
          (e.metrics?.days_late as number) > 0
        ).length;
        financialScore = Math.max(0, 100 - (lateInvoices / invoiceEvents.length) * 50);
      }

      // Calculate overall score
      const score = Math.round(
        usageScore * 0.3 +
        engagementScore * 0.2 +
        sentimentScore * 0.35 +
        financialScore * 0.15
      );

      snapshots.push({
        date,
        score,
        components: {
          usage: Math.round(usageScore),
          engagement: Math.round(engagementScore),
          sentiment: Math.round(sentimentScore),
          financial: Math.round(financialScore)
        }
      });
    }

    return snapshots;
  }

  /**
   * Find related events based on temporal proximity and content
   */
  private findRelatedEvents(events: TimelineEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const related: string[] = [];

      for (let j = 0; j < events.length; j++) {
        if (i === j) continue;

        const other = events[j];
        const daysDiff = Math.abs(
          (new Date(event.date).getTime() - new Date(other.date).getTime()) /
          (1000 * 60 * 60 * 24)
        );

        // Events within 14 days that could be related
        if (daysDiff <= 14) {
          // Different sources but potentially related
          if (event.source !== other.source) {
            // Support -> NPS correlation
            if (event.source === 'support' && other.source === 'nps') {
              related.push(other.id);
            }
            // Usage -> Support correlation
            if (event.source === 'usage' && other.source === 'support') {
              related.push(other.id);
            }
            // Meeting -> Any action correlation
            if (event.source === 'meeting') {
              related.push(other.id);
            }
            // Invoice issues and other problems
            if (event.source === 'invoice' && event.severity === 'critical') {
              related.push(other.id);
            }
          }
        }
      }

      if (related.length > 0) {
        event.relatedEvents = related.slice(0, 10); // Limit to 10
      }
    }
  }

  /**
   * Get timeline events for a specific date range
   */
  filterByDateRange(
    timeline: UnifiedTimeline,
    startDate: string,
    endDate: string
  ): TimelineEvent[] {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return timeline.events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= start && eventDate <= end;
    });
  }

  /**
   * Get timeline events for specific sources
   */
  filterBySources(
    timeline: UnifiedTimeline,
    sources: EventSource[]
  ): TimelineEvent[] {
    return timeline.events.filter(e => sources.includes(e.source));
  }

  /**
   * Get events grouped by week
   */
  groupByWeek(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
    const byWeek = new Map<string, TimelineEvent[]>();

    for (const event of events) {
      const date = new Date(event.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      const weekEvents = byWeek.get(weekKey) || [];
      weekEvents.push(event);
      byWeek.set(weekKey, weekEvents);
    }

    return byWeek;
  }

  /**
   * Generate a summary for a time period
   */
  generatePeriodSummary(events: TimelineEvent[]): {
    eventCount: number;
    bySeverity: Record<EventSeverity, number>;
    bySource: Record<EventSource, number>;
    criticalEvents: TimelineEvent[];
    positiveEvents: TimelineEvent[];
  } {
    const bySeverity: Record<EventSeverity, number> = {
      positive: 0,
      neutral: 0,
      warning: 0,
      critical: 0
    };

    const bySource: Partial<Record<EventSource, number>> = {};

    for (const event of events) {
      bySeverity[event.severity]++;
      bySource[event.source] = (bySource[event.source] || 0) + 1;
    }

    return {
      eventCount: events.length,
      bySeverity,
      bySource: bySource as Record<EventSource, number>,
      criticalEvents: events.filter(e => e.severity === 'critical'),
      positiveEvents: events.filter(e => e.severity === 'positive')
    };
  }
}

// Export singleton instance
export const timelineBuilder = new TimelineBuilder();
