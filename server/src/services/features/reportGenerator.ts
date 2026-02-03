/**
 * Product Report Generator Service
 * PRD-016: Feature Request List Prioritization Scoring
 *
 * Generates comprehensive product team reports with:
 * - Executive summary
 * - Prioritized feature list with justification
 * - Customer quotes and context
 * - Risk analysis
 * - Discussion points
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import Anthropic from '@anthropic-ai/sdk';
import {
  PriorityScore,
  ProductTeamReport,
  ReportSummary,
  ReportTheme,
  CustomerRiskSummary,
  FeatureCategory,
} from './types.js';

class ReportGeneratorService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Generate a comprehensive product team report
   */
  async generateReport(
    scores: PriorityScore[],
    uploadId: string,
    options: {
      generatedBy: string;
      periodStart?: string;
      periodEnd?: string;
      includeRiskAnalysis?: boolean;
    }
  ): Promise<ProductTeamReport> {
    const now = new Date();

    // Categorize by priority level
    const priority1 = scores.filter(s => s.overallScore >= 80);
    const priority2 = scores.filter(s => s.overallScore >= 60 && s.overallScore < 80);
    const priority3 = scores.filter(s => s.overallScore < 60);

    // Build summary
    const summary = this.buildSummary(scores);

    // Identify themes
    const themes = this.identifyThemes(scores);

    // Identify customers at risk
    const customersAtRisk = options.includeRiskAnalysis
      ? await this.identifyCustomersAtRisk(scores)
      : [];

    // Generate discussion points using AI
    const discussionPoints = await this.generateDiscussionPoints(priority1, themes);

    const report: ProductTeamReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      title: `Customer Feature Request Report - ${this.formatPeriod(options.periodStart, options.periodEnd)}`,
      generatedAt: now,
      generatedBy: options.generatedBy,
      period: {
        start: options.periodStart || this.getDefaultPeriodStart(),
        end: options.periodEnd || now.toISOString().split('T')[0],
      },
      summary,
      priority1Requests: priority1,
      priority2Requests: priority2,
      priority3Requests: priority3,
      themes,
      customersAtRisk,
      discussionPoints,
      exportFormats: ['pdf', 'xlsx', 'json'],
    };

    // Save report to database
    if (this.supabase) {
      await this.saveReport(uploadId, report);
    }

    return report;
  }

  /**
   * Build report summary
   */
  private buildSummary(scores: PriorityScore[]): ReportSummary {
    const totalRequests = scores.reduce((sum, s) => sum + s.requestingCustomers.length, 0);
    const uniqueCustomerIds = new Set(scores.flatMap(s => s.requestingCustomers.map(c => c.customerId)));
    const totalArrImpacted = scores.reduce((sum, s) => sum + s.totalArrImpact, 0);
    const avgPriorityScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;

    // Find top category
    const categoryCounts: Record<string, number> = {};
    for (const score of scores) {
      // Determine category from the group (would need to track this in score)
      const category = 'other'; // Default, would be enriched from group data
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    const topCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as FeatureCategory || 'other';

    const urgentCount = scores.filter(s =>
      s.urgencyLevel === 'critical' || s.urgencyLevel === 'high'
    ).length;

    return {
      totalRequests,
      uniqueRequests: scores.length,
      totalCustomers: uniqueCustomerIds.size,
      totalArrImpacted,
      avgPriorityScore: Math.round(avgPriorityScore),
      topCategory,
      urgentCount,
    };
  }

  /**
   * Identify themes from scored requests
   */
  private identifyThemes(scores: PriorityScore[]): ReportTheme[] {
    // Group by common keywords/patterns
    const themePatterns = [
      { name: 'Security & Compliance', keywords: ['sso', 'saml', 'security', 'compliance', 'audit', 'mfa'] },
      { name: 'Data Access & Reporting', keywords: ['report', 'analytics', 'export', 'dashboard', 'api'] },
      { name: 'Integrations', keywords: ['integration', 'connect', 'sync', 'webhook', 'api'] },
      { name: 'User Experience', keywords: ['ui', 'mobile', 'usability', 'interface', 'navigation'] },
      { name: 'Automation & Workflows', keywords: ['automation', 'workflow', 'trigger', 'schedule'] },
    ];

    const themes: ReportTheme[] = [];

    for (const pattern of themePatterns) {
      const matchingScores = scores.filter(s => {
        const titleLower = s.title.toLowerCase();
        const descLower = s.description.toLowerCase();
        return pattern.keywords.some(k => titleLower.includes(k) || descLower.includes(k));
      });

      if (matchingScores.length > 0) {
        const totalArr = matchingScores.reduce((sum, s) => sum + s.totalArrImpact, 0);

        themes.push({
          name: pattern.name,
          description: `${matchingScores.length} related requests from customers`,
          requestCount: matchingScores.length,
          arrImpact: totalArr,
          trend: this.determineTrend(matchingScores),
        });
      }
    }

    return themes.sort((a, b) => b.arrImpact - a.arrImpact);
  }

  /**
   * Determine trend for a set of scores
   */
  private determineTrend(scores: PriorityScore[]): 'growing' | 'stable' | 'declining' {
    // For now, base on average urgency
    const avgUrgency = scores.reduce((sum, s) => sum + s.breakdown.urgency.normalized, 0) / scores.length;

    if (avgUrgency >= 70) return 'growing';
    if (avgUrgency >= 40) return 'stable';
    return 'declining';
  }

  /**
   * Identify customers at risk without requested features
   */
  private async identifyCustomersAtRisk(scores: PriorityScore[]): Promise<CustomerRiskSummary[]> {
    const riskCustomers: CustomerRiskSummary[] = [];

    // Look at high-priority requests with critical urgency
    const criticalScores = scores.filter(s =>
      s.overallScore >= 70 && (s.urgencyLevel === 'critical' || s.urgencyLevel === 'high')
    );

    for (const score of criticalScores) {
      for (const customer of score.requestingCustomers) {
        if (customer.urgency === 'critical' || customer.urgency === 'high') {
          // Determine risk level
          let riskLevel: 'high' | 'medium' | 'low' = 'medium';
          let riskReason = 'Feature request with high urgency';

          if (customer.urgency === 'critical') {
            riskLevel = 'high';
            riskReason = 'Critical feature blocking security/compliance approval';
          } else if (customer.arr >= 100000) {
            riskLevel = 'high';
            riskReason = 'High-value customer with unmet feature need';
          }

          // Only add if not already in list
          if (!riskCustomers.some(rc => rc.customerId === customer.customerId)) {
            riskCustomers.push({
              customerId: customer.customerId,
              customerName: customer.customerName,
              arr: customer.arr,
              primaryRequest: score.title,
              riskLevel,
              riskReason,
            });
          }
        }
      }
    }

    // Sort by ARR (highest first)
    return riskCustomers.sort((a, b) => b.arr - a.arr).slice(0, 10);
  }

  /**
   * Generate discussion points using AI
   */
  private async generateDiscussionPoints(
    priority1: PriorityScore[],
    themes: ReportTheme[]
  ): Promise<string[]> {
    if (!this.anthropic || priority1.length === 0) {
      return this.getDefaultDiscussionPoints(priority1);
    }

    try {
      const prompt = `Based on this feature request analysis, generate 4-5 discussion points for a product team meeting.

Top Priority Requests:
${priority1.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (Score: ${s.overallScore}, ARR: $${s.totalArrImpact.toLocaleString()}, ${s.customerCount} customers)`).join('\n')}

Key Themes:
${themes.slice(0, 3).map(t => `- ${t.name}: ${t.requestCount} requests, $${t.arrImpact.toLocaleString()} ARR`).join('\n')}

Generate practical, actionable discussion points. Respond with a JSON array of strings:
["Discussion point 1", "Discussion point 2", ...]`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return this.getDefaultDiscussionPoints(priority1);
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.getDefaultDiscussionPoints(priority1);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[ReportGenerator] Discussion points error:', error);
      return this.getDefaultDiscussionPoints(priority1);
    }
  }

  /**
   * Get default discussion points
   */
  private getDefaultDiscussionPoints(priority1: PriorityScore[]): string[] {
    const points = [];

    if (priority1.length > 0) {
      points.push(`${priority1[0].title}: Can we accelerate delivery? What's blocking?`);
    }
    if (priority1.length > 1) {
      points.push(`Review resource allocation for top ${priority1.length} priority items`);
    }

    points.push('Are there any quick wins we can deliver this quarter?');
    points.push('What customer communication should accompany roadmap updates?');

    return points;
  }

  /**
   * Format period for report title
   */
  private formatPeriod(start?: string, end?: string): string {
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${quarter} ${now.getFullYear()}`;
  }

  /**
   * Get default period start (3 months ago)
   */
  private getDefaultPeriodStart(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  }

  /**
   * Save report to database
   */
  private async saveReport(uploadId: string, report: ProductTeamReport): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('feature_reports').insert({
        id: report.id,
        upload_id: uploadId,
        title: report.title,
        generated_by: report.generatedBy,
        period_start: report.period.start,
        period_end: report.period.end,
        summary: report.summary,
        themes: report.themes,
        customers_at_risk: report.customersAtRisk,
        discussion_points: report.discussionPoints,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[ReportGenerator] Error saving report:', error);
    }
  }

  /**
   * Export report to different formats
   */
  async exportReport(
    report: ProductTeamReport,
    format: 'pdf' | 'xlsx' | 'json'
  ): Promise<{ content: string | Buffer; mimeType: string; filename: string }> {
    const dateStr = new Date().toISOString().split('T')[0];
    const baseFilename = `feature-requests-${dateStr}`;

    switch (format) {
      case 'json':
        return {
          content: JSON.stringify(report, null, 2),
          mimeType: 'application/json',
          filename: `${baseFilename}.json`,
        };

      case 'xlsx':
        // Generate CSV as a simple alternative (would use xlsx library in production)
        return this.exportToCsv(report, baseFilename);

      case 'pdf':
        // Generate markdown as a simple alternative (would use PDF library in production)
        return this.exportToMarkdown(report, baseFilename);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCsv(
    report: ProductTeamReport,
    baseFilename: string
  ): { content: string; mimeType: string; filename: string } {
    const headers = ['Rank', 'Request', 'Score', 'Customers', 'ARR Impact', 'Urgency', 'Recommendation'];

    const allRequests = [
      ...report.priority1Requests,
      ...report.priority2Requests,
      ...report.priority3Requests,
    ];

    const rows = allRequests.map(r => [
      r.rank,
      `"${r.title.replace(/"/g, '""')}"`,
      r.overallScore,
      r.customerCount,
      r.totalArrImpact,
      r.urgencyLevel,
      `"${r.recommendation.replace(/"/g, '""')}"`,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return {
      content: csv,
      mimeType: 'text/csv',
      filename: `${baseFilename}.csv`,
    };
  }

  /**
   * Export to Markdown format
   */
  private exportToMarkdown(
    report: ProductTeamReport,
    baseFilename: string
  ): { content: string; mimeType: string; filename: string } {
    let md = `# ${report.title}

**Prepared by:** ${report.generatedBy}
**Date:** ${report.generatedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
**Data Source:** ${report.summary.totalRequests} requests from ${report.summary.totalCustomers} customers

---

## Executive Summary

We've consolidated customer feature requests into ${report.summary.uniqueRequests} unique items, prioritized by customer impact.

**Key Stats:**
- Total ARR Impacted: $${report.summary.totalArrImpacted.toLocaleString()}
- Average Priority Score: ${report.summary.avgPriorityScore}
- Urgent Requests: ${report.summary.urgentCount}

**Key Themes:**
${report.themes.map(t => `- ${t.name}: ${t.requestCount} requests, $${t.arrImpact.toLocaleString()} ARR`).join('\n')}

---

## Priority 1 Requests (Score > 80)

${report.priority1Requests.map((r, i) => `
### ${i + 1}. ${r.title} (Score: ${r.overallScore})
- **Customer Impact:** $${r.totalArrImpact.toLocaleString()} ARR, ${r.customerCount} customers
- **Urgency:** ${r.urgencyLevel}
- **Recommendation:** ${r.recommendation}

${r.quotes.length > 0 ? `**Customer Quotes:**\n${r.quotes.slice(0, 2).map(q => `> "${q.quote}" - ${q.customerName}`).join('\n\n')}` : ''}
`).join('\n')}

---

## Customers at Risk

${report.customersAtRisk.length > 0 ? report.customersAtRisk.map(c =>
      `| ${c.customerName} | $${c.arr.toLocaleString()} | ${c.primaryRequest} | ${c.riskLevel} |`
    ).join('\n') : 'No customers identified as high risk at this time.'}

---

## Recommended Discussion Points

${report.discussionPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

---

*Generated by CSCX.AI Feature Request Prioritization*
`;

    return {
      content: md,
      mimeType: 'text/markdown',
      filename: `${baseFilename}.md`,
    };
  }
}

// Singleton instance
export const reportGenerator = new ReportGeneratorService();
export default reportGenerator;
