/**
 * Issue Clustering Service
 * PRD-004: Cluster support tickets into meaningful categories
 *
 * Uses a combination of:
 * - Keyword extraction
 * - Category detection
 * - Theme identification
 * - AI-powered semantic clustering (optional)
 */

import { ClaudeService } from '../claude.js';
import type { ParsedTicket } from '../tickets/ticketParser.js';

// ============================================
// Types
// ============================================

export interface IssueCluster {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  ticketCount: number;
  ticketIds: string[];
  percentOfTotal: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercent: number;
  avgResolutionTime?: number;
  avgCsatScore?: number;
  topCustomers: Array<{ email: string; name?: string; count: number }>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sampleTickets: Array<{ id: string; subject: string; }>;
}

export interface ClusteringResult {
  clusters: IssueCluster[];
  uncategorized: {
    count: number;
    ticketIds: string[];
  };
  totalTickets: number;
  processingTime: number;
}

export interface TrendAnalysis {
  period1: { start: Date; end: Date; count: number };
  period2: { start: Date; end: Date; count: number };
  percentChange: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ============================================
// Category Definitions
// ============================================

const ISSUE_CATEGORIES: Record<string, {
  name: string;
  description: string;
  keywords: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}> = {
  login_auth: {
    name: 'Login/Authentication',
    description: 'Issues with user login, passwords, SSO, and access',
    keywords: [
      'login', 'log in', 'sign in', 'password', 'forgot password', 'reset password',
      'authentication', 'auth', 'sso', 'saml', 'okta', 'oauth', '2fa', 'mfa',
      'two-factor', 'locked out', 'account locked', 'access denied', 'permission',
      'cant access', "can't access", 'unable to login', 'session', 'token expired'
    ],
    severity: 'high',
  },
  api_integration: {
    name: 'API/Integration Errors',
    description: 'Problems with API endpoints, integrations, and webhooks',
    keywords: [
      'api', 'integration', 'webhook', 'endpoint', '500 error', '404', '401', '403',
      'timeout', 'connection', 'sync', 'synchronization', 'zapier', 'salesforce',
      'hubspot', 'slack integration', 'rest api', 'graphql', 'rate limit', 'api key'
    ],
    severity: 'high',
  },
  performance: {
    name: 'Performance Issues',
    description: 'Slow load times, latency, and system performance',
    keywords: [
      'slow', 'performance', 'latency', 'loading', 'takes forever', 'hanging',
      'freeze', 'frozen', 'unresponsive', 'lag', 'delay', 'speed', 'timeout',
      'page load', 'response time', 'sluggish', 'not loading'
    ],
    severity: 'high',
  },
  billing: {
    name: 'Billing/Payments',
    description: 'Invoices, payments, subscriptions, and pricing questions',
    keywords: [
      'billing', 'invoice', 'payment', 'charge', 'subscription', 'pricing',
      'upgrade', 'downgrade', 'refund', 'credit', 'receipt', 'cost', 'price',
      'plan', 'tier', 'cancel subscription', 'renewal', 'overcharged', 'discount'
    ],
    severity: 'medium',
  },
  feature_request: {
    name: 'Feature Requests',
    description: 'New features, enhancements, and product feedback',
    keywords: [
      'feature request', 'feature', 'enhancement', 'suggestion', 'would be nice',
      'please add', 'can you add', 'ability to', 'wish', 'roadmap', 'upcoming',
      'future', 'improvement', 'better if', 'need ability'
    ],
    severity: 'low',
  },
  data_export: {
    name: 'Data/Export Issues',
    description: 'Problems with data export, import, and reporting',
    keywords: [
      'export', 'import', 'download', 'csv', 'excel', 'report', 'data',
      'analytics', 'dashboard', 'metrics', 'bulk export', 'missing data',
      'wrong data', 'incorrect', 'format'
    ],
    severity: 'medium',
  },
  bug: {
    name: 'Bugs/Errors',
    description: 'Software bugs, errors, and unexpected behavior',
    keywords: [
      'bug', 'error', 'broken', 'not working', 'doesnt work', "doesn't work",
      'issue', 'problem', 'crash', 'exception', 'unexpected', 'wrong',
      'incorrect', 'failed', 'failing', 'glitch'
    ],
    severity: 'high',
  },
  training: {
    name: 'Training/How-to',
    description: 'Questions about how to use features and training requests',
    keywords: [
      'how to', 'how do i', 'training', 'documentation', 'docs', 'help',
      'guide', 'tutorial', 'learn', 'understand', 'explain', 'walkthrough',
      'onboarding', 'best practice', 'setup'
    ],
    severity: 'low',
  },
  mobile: {
    name: 'Mobile App Issues',
    description: 'Problems specific to mobile apps',
    keywords: [
      'mobile', 'app', 'ios', 'android', 'iphone', 'ipad', 'tablet',
      'mobile app', 'phone', 'responsive', 'touch'
    ],
    severity: 'medium',
  },
  security: {
    name: 'Security Concerns',
    description: 'Security-related inquiries and concerns',
    keywords: [
      'security', 'secure', 'vulnerability', 'breach', 'hack', 'suspicious',
      'unauthorized', 'phishing', 'encryption', 'compliance', 'gdpr', 'soc2',
      'audit', 'privacy'
    ],
    severity: 'critical',
  },
};

// ============================================
// Issue Clustering Service
// ============================================

export class IssueClusteringService {
  private claudeService: ClaudeService;

  constructor() {
    this.claudeService = new ClaudeService();
  }

  /**
   * Cluster tickets into issue categories
   */
  async clusterTickets(tickets: ParsedTicket[]): Promise<ClusteringResult> {
    const startTime = Date.now();
    const clusters: Map<string, {
      ticketIds: string[];
      tickets: ParsedTicket[];
    }> = new Map();

    const uncategorizedIds: string[] = [];

    // Initialize clusters
    for (const categoryId of Object.keys(ISSUE_CATEGORIES)) {
      clusters.set(categoryId, { ticketIds: [], tickets: [] });
    }

    // Categorize each ticket
    for (const ticket of tickets) {
      const categoryId = this.categorizeTicket(ticket);

      if (categoryId) {
        const cluster = clusters.get(categoryId)!;
        cluster.ticketIds.push(ticket.id);
        cluster.tickets.push(ticket);
      } else {
        uncategorizedIds.push(ticket.id);
      }
    }

    // Build cluster results
    const clusterResults: IssueCluster[] = [];

    for (const [categoryId, clusterData] of clusters.entries()) {
      if (clusterData.ticketIds.length === 0) continue;

      const category = ISSUE_CATEGORIES[categoryId];
      const clusterTickets = clusterData.tickets;

      // Calculate trend
      const trend = this.calculateTrend(clusterTickets);

      // Calculate avg resolution time
      const resolvedTickets = clusterTickets.filter(t => t.resolvedAt && t.createdAt);
      let avgResolutionTime: number | undefined;
      if (resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((sum, t) => {
          const hours = (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgResolutionTime = Math.round(totalHours / resolvedTickets.length * 10) / 10;
      }

      // Calculate avg CSAT
      const csatTickets = clusterTickets.filter(t => t.csatScore !== undefined);
      let avgCsatScore: number | undefined;
      if (csatTickets.length > 0) {
        avgCsatScore = Math.round(
          csatTickets.reduce((sum, t) => sum + (t.csatScore || 0), 0) / csatTickets.length * 10
        ) / 10;
      }

      // Find top customers
      const customerCounts = new Map<string, { name?: string; count: number }>();
      for (const ticket of clusterTickets) {
        if (ticket.customerEmail) {
          const existing = customerCounts.get(ticket.customerEmail) || { name: ticket.customerName, count: 0 };
          existing.count++;
          customerCounts.set(ticket.customerEmail, existing);
        }
      }

      const topCustomers = Array.from(customerCounts.entries())
        .map(([email, data]) => ({ email, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get sample tickets
      const sampleTickets = clusterTickets
        .slice(0, 5)
        .map(t => ({ id: t.id, subject: t.subject }));

      // Extract most common keywords
      const keywords = this.extractKeywords(clusterTickets, category.keywords);

      clusterResults.push({
        id: categoryId,
        name: category.name,
        description: category.description,
        keywords,
        ticketCount: clusterData.ticketIds.length,
        ticketIds: clusterData.ticketIds,
        percentOfTotal: Math.round((clusterData.ticketIds.length / tickets.length) * 100),
        trend: trend.trend,
        trendPercent: trend.percentChange,
        avgResolutionTime,
        avgCsatScore,
        topCustomers,
        severity: category.severity,
        sampleTickets,
      });
    }

    // Sort by ticket count descending
    clusterResults.sort((a, b) => b.ticketCount - a.ticketCount);

    return {
      clusters: clusterResults,
      uncategorized: {
        count: uncategorizedIds.length,
        ticketIds: uncategorizedIds,
      },
      totalTickets: tickets.length,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Categorize a single ticket based on keywords
   */
  private categorizeTicket(ticket: ParsedTicket): string | null {
    const searchText = `${ticket.subject} ${ticket.description || ''} ${ticket.tags.join(' ')}`.toLowerCase();

    let bestMatch: { categoryId: string; score: number } | null = null;

    for (const [categoryId, category] of Object.entries(ISSUE_CATEGORIES)) {
      let score = 0;

      for (const keyword of category.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          // Longer keywords get higher scores
          score += keyword.length;
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { categoryId, score };
      }
    }

    // Also check existing category/tags
    if (ticket.category) {
      const normalizedCategory = ticket.category.toLowerCase();
      for (const [categoryId, category] of Object.entries(ISSUE_CATEGORIES)) {
        if (category.name.toLowerCase().includes(normalizedCategory) ||
            normalizedCategory.includes(category.name.toLowerCase().split('/')[0])) {
          if (!bestMatch || bestMatch.score < 10) {
            return categoryId;
          }
        }
      }
    }

    return bestMatch?.categoryId || null;
  }

  /**
   * Calculate trend based on ticket dates
   */
  private calculateTrend(tickets: ParsedTicket[]): TrendAnalysis {
    if (tickets.length < 2) {
      return {
        period1: { start: new Date(), end: new Date(), count: tickets.length },
        period2: { start: new Date(), end: new Date(), count: 0 },
        percentChange: 0,
        trend: 'stable',
      };
    }

    // Sort by date
    const sorted = [...tickets].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const midIndex = Math.floor(sorted.length / 2);

    const period1Tickets = sorted.slice(0, midIndex);
    const period2Tickets = sorted.slice(midIndex);

    const period1 = {
      start: period1Tickets[0]?.createdAt || new Date(),
      end: period1Tickets[period1Tickets.length - 1]?.createdAt || new Date(),
      count: period1Tickets.length,
    };

    const period2 = {
      start: period2Tickets[0]?.createdAt || new Date(),
      end: period2Tickets[period2Tickets.length - 1]?.createdAt || new Date(),
      count: period2Tickets.length,
    };

    // Calculate change
    const percentChange = period1.count > 0
      ? Math.round(((period2.count - period1.count) / period1.count) * 100)
      : 0;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (percentChange > 10) trend = 'increasing';
    else if (percentChange < -10) trend = 'decreasing';

    return { period1, period2, percentChange, trend };
  }

  /**
   * Extract most common keywords from tickets
   */
  private extractKeywords(tickets: ParsedTicket[], categoryKeywords: string[]): string[] {
    const keywordCounts = new Map<string, number>();

    for (const ticket of tickets) {
      const text = `${ticket.subject} ${ticket.description || ''}`.toLowerCase();

      for (const keyword of categoryKeywords) {
        if (text.includes(keyword.toLowerCase())) {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
      }
    }

    return Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);
  }

  /**
   * Use AI to identify custom clusters from uncategorized tickets
   */
  async identifyCustomClusters(tickets: ParsedTicket[]): Promise<{
    themes: Array<{ name: string; keywords: string[]; count: number }>;
  }> {
    if (tickets.length < 5) {
      return { themes: [] };
    }

    const ticketSummaries = tickets.slice(0, 50).map(t => ({
      subject: t.subject,
      description: t.description?.substring(0, 200),
      tags: t.tags,
    }));

    const prompt = `Analyze these support tickets and identify common themes or categories that they share.
Return JSON with this structure:
{
  "themes": [
    { "name": "Theme Name", "keywords": ["keyword1", "keyword2"], "description": "Brief description" }
  ]
}

Tickets:
${JSON.stringify(ticketSummaries, null, 2)}

Return ONLY valid JSON, no explanation.`;

    try {
      const response = await this.claudeService.generate(prompt);
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        return {
          themes: (result.themes || []).map((t: any) => ({
            name: t.name,
            keywords: t.keywords || [],
            count: tickets.filter(ticket => {
              const text = `${ticket.subject} ${ticket.description || ''}`.toLowerCase();
              return t.keywords?.some((k: string) => text.includes(k.toLowerCase()));
            }).length,
          })),
        };
      }
    } catch (error) {
      console.error('[IssueClustering] AI clustering failed:', error);
    }

    return { themes: [] };
  }
}

// Singleton instance
export const issueClusteringService = new IssueClusteringService();
export default issueClusteringService;
