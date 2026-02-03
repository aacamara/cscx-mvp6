/**
 * QBR Generator Service
 * PRD-220: Intelligent QBR Generator
 *
 * AI-powered service for generating comprehensive QBR presentations
 * using Claude API and Google Slides integration.
 */

import { ClaudeService } from '../claude.js';
import { slidesService, type SlideContent, type SlideTemplate } from '../google/slides.js';
import { driveService } from '../google/drive.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

const claudeService = new ClaudeService();

// Types
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type QBRSectionType =
  | 'executive_summary'
  | 'partnership_health'
  | 'usage_metrics'
  | 'key_achievements'
  | 'challenges_addressed'
  | 'support_summary'
  | 'product_roadmap'
  | 'recommendations'
  | 'next_quarter_goals'
  | 'strategic_initiatives';

export interface QBRGenerateRequest {
  customerId: string;
  quarter: Quarter;
  year: number;
  format: 'presentation' | 'document' | 'both';
  includeSections?: QBRSectionType[];
  customData?: {
    highlights?: string[];
    challenges?: string[];
    goals?: string[];
    additionalContext?: string;
  };
}

export interface QBRContent {
  executiveSummary: string;
  partnershipHealth: {
    healthScore: number;
    trend: 'improving' | 'stable' | 'declining';
    keyMetrics: Array<{ name: string; value: string; trend: string }>;
    summary: string;
  };
  usageMetrics: {
    activeUsers: number;
    totalUsers: number;
    adoptionRate: number;
    loginFrequency: string;
    featureUsage: Array<{ feature: string; usage: number }>;
    summary: string;
  };
  achievements: Array<{
    title: string;
    description: string;
    impact: string;
    date: string;
  }>;
  challenges: Array<{
    issue: string;
    resolution: string;
    status: 'resolved' | 'ongoing' | 'monitoring';
  }>;
  supportSummary: {
    ticketCount: number;
    avgResolutionTime: string;
    satisfactionScore: number;
    highlights: string[];
  };
  roadmapHighlights: Array<{
    feature: string;
    releaseDate: string;
    relevance: string;
  }>;
  recommendations: Array<{
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    expectedOutcome: string;
  }>;
  nextQuarterGoals: Array<{
    goal: string;
    metric: string;
    target: string;
    owner: string;
  }>;
}

export interface QBRResult {
  id: string;
  customerId: string;
  customerName: string;
  quarter: Quarter;
  year: number;
  status: 'generating' | 'draft' | 'ready' | 'presented';
  presentationId?: string;
  presentationUrl?: string;
  documentId?: string;
  documentUrl?: string;
  content: QBRContent;
  generatedAt: Date;
}

export interface CustomerData {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  industry?: string;
  contractStartDate?: string;
  renewalDate?: string;
  csm?: string;
}

export interface UsageData {
  activeUsers: number;
  totalUsers: number;
  loginFrequency: number;
  featureAdoption: Record<string, number>;
  usageTrend: 'up' | 'stable' | 'down';
}

export interface SupportData {
  totalTickets: number;
  resolvedTickets: number;
  avgResolutionHours: number;
  satisfactionScore: number;
  openTickets: number;
}

/**
 * QBR Generator Service - Generates AI-powered QBR presentations
 */
export class QBRGeneratorService {
  /**
   * Generate a complete QBR package
   */
  async generateQBR(
    userId: string,
    request: QBRGenerateRequest
  ): Promise<QBRResult> {
    const { customerId, quarter, year, format, includeSections, customData } = request;

    // 1. Fetch customer data
    const customerData = await this.fetchCustomerData(customerId);
    if (!customerData) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // 2. Fetch metrics and historical data
    const [usageData, supportData, achievements, healthHistory] = await Promise.all([
      this.fetchUsageData(customerId, quarter, year),
      this.fetchSupportData(customerId, quarter, year),
      this.fetchAchievements(customerId, quarter, year),
      this.fetchHealthHistory(customerId)
    ]);

    // 3. Generate AI content for each section
    const content = await this.generateAIContent({
      customer: customerData,
      usage: usageData,
      support: supportData,
      achievements,
      healthHistory,
      quarter,
      year,
      customData
    });

    // 4. Create presentation/document based on format
    let presentationId: string | undefined;
    let presentationUrl: string | undefined;
    let documentId: string | undefined;
    let documentUrl: string | undefined;

    if (format === 'presentation' || format === 'both') {
      const presentation = await this.createPresentation(
        userId,
        customerData,
        content,
        quarter,
        year
      );
      presentationId = presentation.id;
      presentationUrl = presentation.webViewLink;
    }

    if (format === 'document' || format === 'both') {
      const document = await this.createDocument(
        userId,
        customerData,
        content,
        quarter,
        year
      );
      documentId = document.id;
      documentUrl = document.url;
    }

    // 5. Save QBR record
    const qbrId = `qbr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result: QBRResult = {
      id: qbrId,
      customerId,
      customerName: customerData.name,
      quarter,
      year,
      status: 'draft',
      presentationId,
      presentationUrl,
      documentId,
      documentUrl,
      content,
      generatedAt: new Date()
    };

    // Save to database
    await this.saveQBRRecord(result, userId);

    return result;
  }

  /**
   * Fetch customer data from database
   */
  private async fetchCustomerData(customerId: string): Promise<CustomerData | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      arr: data.arr || 0,
      healthScore: data.health_score || 70,
      industry: data.industry,
      contractStartDate: data.contract_start_date,
      renewalDate: data.renewal_date,
      csm: data.csm_name
    };
  }

  /**
   * Fetch usage metrics for the quarter
   */
  private async fetchUsageData(
    customerId: string,
    quarter: Quarter,
    year: number
  ): Promise<UsageData> {
    if (!supabase) {
      return this.getDefaultUsageData();
    }

    const { startDate, endDate } = this.getQuarterDates(quarter, year);

    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate)
      .order('metric_date', { ascending: false });

    if (!metrics || metrics.length === 0) {
      return this.getDefaultUsageData();
    }

    // Aggregate metrics
    const latest = metrics[0];
    const activeUsers = metrics.reduce((sum, m) => sum + (m.active_users || 0), 0) / metrics.length;
    const loginFrequency = metrics.reduce((sum, m) => sum + (m.login_count || 0), 0) / metrics.length;

    // Calculate trend
    let usageTrend: 'up' | 'stable' | 'down' = 'stable';
    if (metrics.length >= 2) {
      const recentAvg = metrics.slice(0, Math.ceil(metrics.length / 2))
        .reduce((sum, m) => sum + (m.active_users || 0), 0) / Math.ceil(metrics.length / 2);
      const oldAvg = metrics.slice(Math.ceil(metrics.length / 2))
        .reduce((sum, m) => sum + (m.active_users || 0), 0) / Math.floor(metrics.length / 2);
      if (recentAvg > oldAvg * 1.1) usageTrend = 'up';
      else if (recentAvg < oldAvg * 0.9) usageTrend = 'down';
    }

    return {
      activeUsers: Math.round(activeUsers),
      totalUsers: latest.total_users || Math.round(activeUsers * 1.5),
      loginFrequency: Math.round(loginFrequency),
      featureAdoption: latest.feature_adoption || {},
      usageTrend
    };
  }

  /**
   * Fetch support ticket data for the quarter
   */
  private async fetchSupportData(
    customerId: string,
    quarter: Quarter,
    year: number
  ): Promise<SupportData> {
    if (!supabase) {
      return this.getDefaultSupportData();
    }

    const { startDate, endDate } = this.getQuarterDates(quarter, year);

    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', customerId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (!tickets || tickets.length === 0) {
      return this.getDefaultSupportData();
    }

    const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    const avgResolutionHours = resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => {
          if (t.resolved_at && t.created_at) {
            const hours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }
          return sum;
        }, 0) / resolvedTickets.length
      : 24;

    const satisfactionScores = tickets
      .filter(t => t.satisfaction_score)
      .map(t => t.satisfaction_score);
    const avgSatisfaction = satisfactionScores.length > 0
      ? satisfactionScores.reduce((sum, s) => sum + s, 0) / satisfactionScores.length
      : 4.0;

    return {
      totalTickets: tickets.length,
      resolvedTickets: resolvedTickets.length,
      avgResolutionHours: Math.round(avgResolutionHours),
      satisfactionScore: Math.round(avgSatisfaction * 10) / 10,
      openTickets: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length
    };
  }

  /**
   * Fetch achievements/milestones for the quarter
   */
  private async fetchAchievements(
    customerId: string,
    quarter: Quarter,
    year: number
  ): Promise<Array<{ title: string; description: string; date: string }>> {
    if (!supabase) {
      return [];
    }

    const { startDate, endDate } = this.getQuarterDates(quarter, year);

    // Try milestones table
    const { data: milestones } = await supabase
      .from('onboarding_milestones')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lte('completed_at', endDate);

    if (milestones && milestones.length > 0) {
      return milestones.map(m => ({
        title: m.name,
        description: m.description || '',
        date: m.completed_at
      }));
    }

    // Fall back to activities
    const { data: activities } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .in('action_type', ['milestone_completed', 'goal_achieved', 'training_completed'])
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (activities && activities.length > 0) {
      return activities.map(a => ({
        title: a.action_data?.title || a.action_type,
        description: a.action_data?.description || '',
        date: a.created_at
      }));
    }

    return [];
  }

  /**
   * Fetch health score history
   */
  private async fetchHealthHistory(customerId: string): Promise<Array<{ date: string; score: number }>> {
    if (!supabase) {
      return [];
    }

    const { data } = await supabase
      .from('usage_metrics')
      .select('metric_date, health_score')
      .eq('customer_id', customerId)
      .not('health_score', 'is', null)
      .order('metric_date', { ascending: true })
      .limit(12);

    if (!data) return [];

    return data.map(d => ({
      date: d.metric_date,
      score: d.health_score
    }));
  }

  /**
   * Generate AI content for all QBR sections
   */
  private async generateAIContent(params: {
    customer: CustomerData;
    usage: UsageData;
    support: SupportData;
    achievements: Array<{ title: string; description: string; date: string }>;
    healthHistory: Array<{ date: string; score: number }>;
    quarter: Quarter;
    year: number;
    customData?: QBRGenerateRequest['customData'];
  }): Promise<QBRContent> {
    const { customer, usage, support, achievements, healthHistory, quarter, year, customData } = params;

    // Calculate health trend
    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (healthHistory.length >= 2) {
      const recentScores = healthHistory.slice(-3).map(h => h.score);
      const olderScores = healthHistory.slice(0, 3).map(h => h.score);
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
      if (recentAvg > olderAvg + 5) healthTrend = 'improving';
      else if (recentAvg < olderAvg - 5) healthTrend = 'declining';
    }

    // Build comprehensive prompt for Claude
    const prompt = `Generate comprehensive QBR (Quarterly Business Review) content for a customer. Return a JSON object with the following structure.

CUSTOMER CONTEXT:
- Name: ${customer.name}
- Industry: ${customer.industry || 'Technology'}
- ARR: $${customer.arr.toLocaleString()}
- Health Score: ${customer.healthScore}/100 (${healthTrend})
- Contract Start: ${customer.contractStartDate || 'Unknown'}
- Renewal Date: ${customer.renewalDate || 'Unknown'}
- CSM: ${customer.csm || 'Assigned CSM'}
- Quarter: ${quarter} ${year}

USAGE METRICS:
- Active Users: ${usage.activeUsers} of ${usage.totalUsers} (${Math.round((usage.activeUsers / usage.totalUsers) * 100)}% adoption)
- Login Frequency: ${usage.loginFrequency} logins/month average
- Usage Trend: ${usage.usageTrend}
- Feature Adoption: ${JSON.stringify(usage.featureAdoption)}

SUPPORT DATA:
- Total Tickets: ${support.totalTickets}
- Resolved: ${support.resolvedTickets}
- Open: ${support.openTickets}
- Avg Resolution Time: ${support.avgResolutionHours} hours
- Satisfaction Score: ${support.satisfactionScore}/5

ACHIEVEMENTS THIS QUARTER:
${achievements.length > 0 ? achievements.map(a => `- ${a.title}: ${a.description}`).join('\n') : '- No recorded milestones (infer reasonable achievements from metrics)'}

${customData?.additionalContext ? `ADDITIONAL CONTEXT:\n${customData.additionalContext}` : ''}
${customData?.highlights ? `CUSTOM HIGHLIGHTS:\n${customData.highlights.join('\n')}` : ''}
${customData?.challenges ? `KNOWN CHALLENGES:\n${customData.challenges.join('\n')}` : ''}
${customData?.goals ? `STATED GOALS:\n${customData.goals.join('\n')}` : ''}

Return a JSON object with this exact structure:
{
  "executiveSummary": "A 2-3 paragraph executive summary highlighting key achievements, partnership value, and outlook",
  "partnershipHealth": {
    "healthScore": ${customer.healthScore},
    "trend": "${healthTrend}",
    "keyMetrics": [
      { "name": "metric name", "value": "metric value", "trend": "up/down/stable" }
    ],
    "summary": "1-2 sentence summary of overall health"
  },
  "usageMetrics": {
    "activeUsers": ${usage.activeUsers},
    "totalUsers": ${usage.totalUsers},
    "adoptionRate": ${Math.round((usage.activeUsers / usage.totalUsers) * 100)},
    "loginFrequency": "${usage.loginFrequency}/month",
    "featureUsage": [
      { "feature": "feature name", "usage": percentage_number }
    ],
    "summary": "1-2 sentence summary of usage patterns"
  },
  "achievements": [
    { "title": "achievement title", "description": "what was achieved", "impact": "business impact", "date": "when" }
  ],
  "challenges": [
    { "issue": "challenge faced", "resolution": "how it was addressed", "status": "resolved/ongoing/monitoring" }
  ],
  "supportSummary": {
    "ticketCount": ${support.totalTickets},
    "avgResolutionTime": "${support.avgResolutionHours} hours",
    "satisfactionScore": ${support.satisfactionScore},
    "highlights": ["key support highlights"]
  },
  "roadmapHighlights": [
    { "feature": "upcoming feature", "releaseDate": "expected date", "relevance": "how it helps this customer" }
  ],
  "recommendations": [
    { "recommendation": "what to do", "priority": "high/medium/low", "expectedOutcome": "expected result" }
  ],
  "nextQuarterGoals": [
    { "goal": "goal description", "metric": "how to measure", "target": "target value", "owner": "who owns it" }
  ]
}

Return ONLY the JSON object, no markdown formatting or explanation. Make content specific to this customer and their metrics.`;

    const systemPrompt = `You are a Customer Success expert creating QBR presentations. Generate professional, data-driven content that:
1. Celebrates wins and quantifies value delivered
2. Addresses challenges honestly with solutions
3. Sets clear, achievable goals for the next quarter
4. Makes specific recommendations based on usage data
5. Maintains a positive, partnership-focused tone
6. Uses concrete numbers and metrics throughout`;

    try {
      const response = await claudeService.generate(prompt, systemPrompt, true);
      const content = this.parseJSONResponse(response);
      return content as QBRContent;
    } catch (error) {
      console.error('Failed to generate AI content:', error);
      // Return default content structure
      return this.getDefaultContent(customer, usage, support, achievements, healthTrend, quarter, year);
    }
  }

  /**
   * Create Google Slides presentation
   */
  private async createPresentation(
    userId: string,
    customer: CustomerData,
    content: QBRContent,
    quarter: Quarter,
    year: number
  ): Promise<{ id: string; webViewLink: string }> {
    // Create customer QBR folder if it doesn't exist
    let folderId: string | undefined;
    try {
      const folder = await driveService.findOrCreateCustomerFolder(
        userId,
        customer.id,
        customer.name
      );
      // Create QBR subfolder
      const qbrFolder = await driveService.createFolder(
        userId,
        `QBRs`,
        folder.id
      );
      folderId = qbrFolder.id;
    } catch (e) {
      console.warn('Could not create QBR folder:', e);
    }

    // Build template variables
    const variables: Record<string, string> = {
      customerName: customer.name,
      quarter: quarter,
      year: year.toString(),
      executiveSummary: content.executiveSummary,
      achievement1: content.achievements[0]?.title || 'Strong partnership progress',
      achievement2: content.achievements[1]?.title || 'Improved adoption metrics',
      achievement3: content.achievements[2]?.title || 'Enhanced team engagement',
      usageMetrics: `Active Users: ${content.usageMetrics.activeUsers}/${content.usageMetrics.totalUsers} (${content.usageMetrics.adoptionRate}%)\nLogin Frequency: ${content.usageMetrics.loginFrequency}\n\n${content.usageMetrics.summary}`,
      supportMetrics: `Tickets: ${content.supportSummary.ticketCount} | Resolution: ${content.supportSummary.avgResolutionTime} | Satisfaction: ${content.supportSummary.satisfactionScore}/5\n\n${content.supportSummary.highlights.join('\n')}`,
      roadmap: content.roadmapHighlights.map(r => `• ${r.feature} (${r.releaseDate}): ${r.relevance}`).join('\n'),
      actionItem1: content.nextQuarterGoals[0] ? `${content.nextQuarterGoals[0].goal} - ${content.nextQuarterGoals[0].owner}` : 'Set strategic goals',
      actionItem2: content.nextQuarterGoals[1] ? `${content.nextQuarterGoals[1].goal} - ${content.nextQuarterGoals[1].owner}` : 'Review adoption metrics',
      actionItem3: content.nextQuarterGoals[2] ? `${content.nextQuarterGoals[2].goal} - ${content.nextQuarterGoals[2].owner}` : 'Schedule follow-up'
    };

    // Create presentation using the QBR template
    const presentation = await slidesService.createFromTemplate(
      userId,
      'qbr',
      variables,
      folderId
    );

    return {
      id: presentation.id,
      webViewLink: presentation.webViewLink || `https://docs.google.com/presentation/d/${presentation.id}/edit`
    };
  }

  /**
   * Create Google Doc document
   */
  private async createDocument(
    userId: string,
    customer: CustomerData,
    content: QBRContent,
    quarter: Quarter,
    year: number
  ): Promise<{ id: string; url: string }> {
    // For now, return a placeholder - full document creation would use Google Docs API
    // This could be expanded to create a detailed written QBR report
    return {
      id: `doc_${Date.now()}`,
      url: '#'
    };
  }

  /**
   * Save QBR record to database
   */
  private async saveQBRRecord(result: QBRResult, userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('qbr_packages').insert({
      id: result.id,
      customer_id: result.customerId,
      user_id: userId,
      quarter: result.quarter,
      year: result.year,
      status: result.status,
      presentation_id: result.presentationId,
      presentation_url: result.presentationUrl,
      document_id: result.documentId,
      document_url: result.documentUrl,
      content: result.content,
      generated_at: result.generatedAt.toISOString()
    });

    // Log activity
    await supabase.from('agent_activity_log').insert({
      user_id: userId,
      customer_id: result.customerId,
      agent_type: 'orchestrator',
      action_type: 'qbr_generated',
      action_data: {
        qbrId: result.id,
        quarter: result.quarter,
        year: result.year,
        presentationUrl: result.presentationUrl
      },
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });
  }

  /**
   * Get quarter start and end dates
   */
  private getQuarterDates(quarter: Quarter, year: number): { startDate: string; endDate: string } {
    const quarterMonths: Record<Quarter, { start: number; end: number }> = {
      Q1: { start: 0, end: 2 },
      Q2: { start: 3, end: 5 },
      Q3: { start: 6, end: 8 },
      Q4: { start: 9, end: 11 }
    };

    const { start, end } = quarterMonths[quarter];
    const startDate = new Date(year, start, 1);
    const endDate = new Date(year, end + 1, 0); // Last day of the quarter

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Parse JSON response from Claude
   */
  private parseJSONResponse(text: string): any {
    let jsonString = text.trim();

    // Remove markdown code blocks
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.substring(7);
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.substring(3);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }

    jsonString = jsonString.trim();

    // Try to find JSON object
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    return JSON.parse(jsonString);
  }

  /**
   * Default usage data when no metrics available
   */
  private getDefaultUsageData(): UsageData {
    return {
      activeUsers: 50,
      totalUsers: 75,
      loginFrequency: 15,
      featureAdoption: { 'Core': 85, 'Analytics': 60, 'Integrations': 45 },
      usageTrend: 'stable'
    };
  }

  /**
   * Default support data when no tickets available
   */
  private getDefaultSupportData(): SupportData {
    return {
      totalTickets: 5,
      resolvedTickets: 4,
      avgResolutionHours: 24,
      satisfactionScore: 4.2,
      openTickets: 1
    };
  }

  /**
   * Default content when AI generation fails
   */
  private getDefaultContent(
    customer: CustomerData,
    usage: UsageData,
    support: SupportData,
    achievements: Array<{ title: string; description: string; date: string }>,
    healthTrend: 'improving' | 'stable' | 'declining',
    quarter: Quarter,
    year: number
  ): QBRContent {
    return {
      executiveSummary: `${customer.name} has demonstrated strong partnership performance in ${quarter} ${year}. With a health score of ${customer.healthScore}/100 (${healthTrend}), the account shows ${healthTrend === 'improving' ? 'positive momentum' : healthTrend === 'declining' ? 'areas for improvement' : 'steady engagement'}. Key highlights include ${usage.adoptionRate || Math.round((usage.activeUsers / usage.totalUsers) * 100)}% user adoption and ${support.satisfactionScore}/5 support satisfaction.`,
      partnershipHealth: {
        healthScore: customer.healthScore,
        trend: healthTrend,
        keyMetrics: [
          { name: 'Health Score', value: `${customer.healthScore}/100`, trend: healthTrend },
          { name: 'ARR', value: `$${customer.arr.toLocaleString()}`, trend: 'stable' },
          { name: 'Adoption', value: `${Math.round((usage.activeUsers / usage.totalUsers) * 100)}%`, trend: usage.usageTrend }
        ],
        summary: `Overall partnership health is ${healthTrend}, with strong engagement metrics.`
      },
      usageMetrics: {
        activeUsers: usage.activeUsers,
        totalUsers: usage.totalUsers,
        adoptionRate: Math.round((usage.activeUsers / usage.totalUsers) * 100),
        loginFrequency: `${usage.loginFrequency}/month`,
        featureUsage: Object.entries(usage.featureAdoption || {}).map(([feature, usage]) => ({
          feature,
          usage: typeof usage === 'number' ? usage : 0
        })),
        summary: `${usage.activeUsers} of ${usage.totalUsers} users are actively engaging with the platform.`
      },
      achievements: achievements.length > 0
        ? achievements.map(a => ({
            title: a.title,
            description: a.description,
            impact: 'Positive impact on overall adoption',
            date: a.date
          }))
        : [
            { title: 'Platform Adoption', description: 'Successfully onboarded key users', impact: 'Increased engagement', date: `${quarter} ${year}` }
          ],
      challenges: [
        { issue: 'No critical challenges identified', resolution: 'Proactive monitoring in place', status: 'resolved' as const }
      ],
      supportSummary: {
        ticketCount: support.totalTickets,
        avgResolutionTime: `${support.avgResolutionHours} hours`,
        satisfactionScore: support.satisfactionScore,
        highlights: [`${support.resolvedTickets} of ${support.totalTickets} tickets resolved`, `${support.satisfactionScore}/5 satisfaction rating`]
      },
      roadmapHighlights: [
        { feature: 'Enhanced Analytics', releaseDate: 'Next Quarter', relevance: 'Deeper insights into usage patterns' },
        { feature: 'Integration Updates', releaseDate: 'Ongoing', relevance: 'Improved workflow connectivity' }
      ],
      recommendations: [
        { recommendation: 'Increase user training sessions', priority: 'medium' as const, expectedOutcome: 'Higher adoption rate' },
        { recommendation: 'Schedule executive check-in', priority: 'high' as const, expectedOutcome: 'Strategic alignment' }
      ],
      nextQuarterGoals: [
        { goal: 'Achieve 90% user adoption', metric: 'Active users / Total users', target: '90%', owner: 'CSM' },
        { goal: 'Complete advanced training', metric: 'Training completion rate', target: '100%', owner: 'Customer' }
      ]
    };
  }

  /**
   * Get all QBRs for a customer
   */
  async getCustomerQBRs(customerId: string): Promise<QBRResult[]> {
    if (!supabase) return [];

    const { data } = await supabase
      .from('qbr_packages')
      .select('*')
      .eq('customer_id', customerId)
      .order('generated_at', { ascending: false });

    if (!data) return [];

    return data.map(d => ({
      id: d.id,
      customerId: d.customer_id,
      customerName: d.customer_name || '',
      quarter: d.quarter,
      year: d.year,
      status: d.status,
      presentationId: d.presentation_id,
      presentationUrl: d.presentation_url,
      documentId: d.document_id,
      documentUrl: d.document_url,
      content: d.content,
      generatedAt: new Date(d.generated_at)
    }));
  }

  /**
   * Get a specific QBR by ID
   */
  async getQBR(qbrId: string): Promise<QBRResult | null> {
    if (!supabase) return null;

    const { data } = await supabase
      .from('qbr_packages')
      .select('*')
      .eq('id', qbrId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name || '',
      quarter: data.quarter,
      year: data.year,
      status: data.status,
      presentationId: data.presentation_id,
      presentationUrl: data.presentation_url,
      documentId: data.document_id,
      documentUrl: data.document_url,
      content: data.content,
      generatedAt: new Date(data.generated_at)
    };
  }

  /**
   * Update QBR status
   */
  async updateQBRStatus(
    qbrId: string,
    status: QBRResult['status']
  ): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('qbr_packages')
      .update({ status })
      .eq('id', qbrId);
  }
}

// Singleton export
export const qbrGeneratorService = new QBRGeneratorService();
