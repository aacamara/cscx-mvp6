/**
 * Training Invitation Generator Service
 * PRD-038: Training Invitation Personalization
 *
 * Generates personalized training invitations based on:
 * - Stakeholder role analysis
 * - Feature adoption gaps
 * - Skill gap assessment
 * - Training session relevance matching
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  generateTrainingInviteEmail,
  generateBulkTrainingInvites,
  TrainingInviteData,
  TrainingInviteResult,
} from '../../templates/emails/training-invite.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export interface TrainingSession {
  id: string;
  title: string;
  description: string;
  topic: string;
  format: 'webinar' | 'workshop' | 'self-paced' | 'one-on-one';
  duration_minutes: number;
  scheduled_at: string;
  timezone: string;
  presenter_name?: string;
  presenter_email?: string;
  meeting_url?: string;
  target_roles: string[];
  target_features: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  status: string;
}

export interface StakeholderAnalysis {
  stakeholder: {
    id: string;
    name: string;
    email: string;
    role: string;
    customer_id: string;
  };
  adoptionGaps: string[];
  skillGaps: string[];
  relevanceScore: number;
  personalizationAngle: string;
  benefits: string[];
}

export interface TrainingGapAnalysis {
  customerId: string;
  customerName: string;
  stakeholderAnalyses: StakeholderAnalysis[];
  recommendedSessions: TrainingSession[];
  summary: string;
}

export interface GenerateInvitationsParams {
  customerId: string;
  trainingSessionId: string;
  stakeholderIds?: string[]; // Optional: specific stakeholders, otherwise analyze all
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  registrationUrl?: string;
}

export interface GeneratedInvitation {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderEmail: string;
  stakeholderRole: string;
  email: TrainingInviteResult;
  personalization: {
    angle: string;
    adoptionGaps: string[];
    skillGaps: string[];
    benefits: string[];
    relevanceScore: number;
  };
}

/**
 * Training Invitation Generator Class
 */
export class TrainingInvitationGenerator {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  /**
   * Analyze training gaps for a customer
   */
  async analyzeTrainingGaps(customerId: string): Promise<TrainingGapAnalysis> {
    if (!supabase) {
      throw new Error('Database connection required for training gap analysis');
    }

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Get stakeholders
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId);

    // Get usage metrics for adoption analysis
    const { data: usageMetrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(30);

    // Get training progress to avoid recommending completed training
    const { data: trainingProgress } = await supabase
      .from('training_progress')
      .select('*, training_modules(*)')
      .eq('customer_id', customerId);

    // Get available training sessions
    const { data: trainingSessions } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    // Analyze each stakeholder
    const stakeholderAnalyses: StakeholderAnalysis[] = [];

    for (const stakeholder of stakeholders || []) {
      if (!stakeholder.email) continue;

      const analysis = await this.analyzeStakeholder(
        stakeholder,
        usageMetrics || [],
        trainingProgress || [],
        trainingSessions || []
      );

      if (analysis) {
        stakeholderAnalyses.push(analysis);
      }
    }

    // Determine recommended sessions
    const recommendedSessions = this.matchSessionsToGaps(
      stakeholderAnalyses,
      trainingSessions || []
    );

    // Generate summary
    const summary = this.generateGapSummary(stakeholderAnalyses, recommendedSessions);

    return {
      customerId,
      customerName: customer.name,
      stakeholderAnalyses,
      recommendedSessions,
      summary,
    };
  }

  /**
   * Analyze a single stakeholder for training needs
   */
  private async analyzeStakeholder(
    stakeholder: any,
    usageMetrics: any[],
    trainingProgress: any[],
    availableSessions: any[]
  ): Promise<StakeholderAnalysis | null> {
    const role = stakeholder.role?.toLowerCase() || '';

    // Identify adoption gaps based on usage metrics
    const adoptionGaps = this.identifyAdoptionGaps(usageMetrics, role);

    // Identify skill gaps based on role and completed training
    const completedModules = trainingProgress
      .filter((tp: any) => tp.stakeholder_id === stakeholder.id && tp.status === 'completed')
      .map((tp: any) => tp.training_modules?.category);

    const skillGaps = this.identifySkillGaps(role, completedModules, availableSessions);

    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(adoptionGaps, skillGaps, role);

    // Generate personalization angle using AI if available
    const personalizationAngle = await this.generatePersonalizationAngle(
      stakeholder,
      adoptionGaps,
      skillGaps
    );

    // Generate benefits list
    const benefits = this.generateBenefits(adoptionGaps, skillGaps, role);

    return {
      stakeholder: {
        id: stakeholder.id,
        name: stakeholder.name,
        email: stakeholder.email,
        role: stakeholder.role || 'Team Member',
        customer_id: stakeholder.customer_id,
      },
      adoptionGaps,
      skillGaps,
      relevanceScore,
      personalizationAngle,
      benefits,
    };
  }

  /**
   * Identify feature adoption gaps from usage metrics
   */
  private identifyAdoptionGaps(usageMetrics: any[], role: string): string[] {
    const gaps: string[] = [];

    // Feature adoption thresholds
    const featureThresholds: Record<string, number> = {
      dashboards: 30,
      custom_reports: 20,
      analytics: 40,
      automations: 25,
      integrations: 20,
      api: 15,
      workflows: 30,
    };

    // Aggregate recent usage
    const recentMetrics = usageMetrics.slice(0, 7); // Last 7 days
    const featureUsage: Record<string, number> = {};

    for (const metric of recentMetrics) {
      const features = metric.feature_usage || {};
      for (const [feature, usage] of Object.entries(features)) {
        featureUsage[feature] = (featureUsage[feature] || 0) + (usage as number);
      }
    }

    // Check against thresholds
    for (const [feature, threshold] of Object.entries(featureThresholds)) {
      const usage = featureUsage[feature] || 0;
      if (usage < threshold) {
        gaps.push(this.formatFeatureName(feature));
      }
    }

    // Role-specific gap prioritization
    if (role.includes('director') || role.includes('manager')) {
      // Prioritize dashboard and reporting gaps
      return gaps.filter(g =>
        g.toLowerCase().includes('dashboard') ||
        g.toLowerCase().includes('report') ||
        g.toLowerCase().includes('analytics')
      ).concat(gaps.filter(g =>
        !g.toLowerCase().includes('dashboard') &&
        !g.toLowerCase().includes('report') &&
        !g.toLowerCase().includes('analytics')
      ));
    }

    return gaps.slice(0, 5); // Return top 5 gaps
  }

  /**
   * Identify skill gaps based on role and training history
   */
  private identifySkillGaps(
    role: string,
    completedCategories: string[],
    availableSessions: any[]
  ): string[] {
    const gaps: string[] = [];

    // Role-based expected skills
    const roleSkillMap: Record<string, string[]> = {
      administrator: ['user_management', 'permissions', 'integrations', 'api'],
      director: ['analytics', 'reporting', 'strategic_planning'],
      manager: ['team_workflows', 'automation', 'reporting'],
      analyst: ['advanced_analytics', 'data_export', 'custom_reports'],
      executive: ['executive_dashboard', 'roi_metrics', 'strategic_insights'],
    };

    // Find matching role
    const roleLower = role.toLowerCase();
    for (const [roleKey, skills] of Object.entries(roleSkillMap)) {
      if (roleLower.includes(roleKey)) {
        for (const skill of skills) {
          if (!completedCategories.includes(skill)) {
            gaps.push(this.formatFeatureName(skill));
          }
        }
        break;
      }
    }

    // Check what training is available and not completed
    for (const session of availableSessions) {
      if (session.target_roles?.some((r: string) => roleLower.includes(r.toLowerCase()))) {
        if (!completedCategories.includes(session.topic)) {
          if (!gaps.includes(session.topic)) {
            gaps.push(session.topic);
          }
        }
      }
    }

    return gaps.slice(0, 4); // Return top 4 skill gaps
  }

  /**
   * Calculate relevance score for training
   */
  private calculateRelevanceScore(
    adoptionGaps: string[],
    skillGaps: string[],
    role: string
  ): number {
    let score = 50; // Base score

    // More gaps = higher relevance
    score += adoptionGaps.length * 8;
    score += skillGaps.length * 6;

    // Role-based adjustment
    if (role.toLowerCase().includes('executive') || role.toLowerCase().includes('director')) {
      score += 10; // High-value stakeholders
    }

    return Math.min(score, 100);
  }

  /**
   * Generate personalization angle using AI
   */
  private async generatePersonalizationAngle(
    stakeholder: any,
    adoptionGaps: string[],
    skillGaps: string[]
  ): Promise<string> {
    // Default personalization if AI not available
    if (!this.anthropic) {
      if (adoptionGaps.length > 0) {
        return `I noticed your team hasn't fully explored our ${adoptionGaps[0]} capabilities yet - and I think they could save you significant time on your workflows.`;
      }
      if (skillGaps.length > 0) {
        return `Based on your role as ${stakeholder.role || 'a team member'}, I thought this training would help you get even more value from the platform.`;
      }
      return `I wanted to share an upcoming training opportunity that I think would be valuable for you and your team.`;
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Generate a single personalized opening sentence for a training invitation email.

Recipient: ${stakeholder.name}
Role: ${stakeholder.role || 'Team Member'}
Adoption Gaps: ${adoptionGaps.join(', ') || 'None identified'}
Skill Gaps: ${skillGaps.join(', ') || 'None identified'}

Requirements:
- Be warm but professional
- Reference specific gaps if relevant
- Focus on value they'll gain
- Keep it to 1-2 sentences
- Don't start with "Hi" or greetings

Return only the sentence, no quotes or extra formatting.`,
          },
        ],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text.trim() : this.getDefaultAngle(adoptionGaps);
    } catch (error) {
      console.error('Error generating personalization:', error);
      return this.getDefaultAngle(adoptionGaps);
    }
  }

  /**
   * Get default personalization angle
   */
  private getDefaultAngle(adoptionGaps: string[]): string {
    if (adoptionGaps.length > 0) {
      return `I noticed your team hasn't fully explored our ${adoptionGaps[0]} capabilities yet - and I think they could save you significant time.`;
    }
    return `I wanted to share an upcoming training opportunity that I think would be valuable for you.`;
  }

  /**
   * Generate benefits list based on gaps
   */
  private generateBenefits(
    adoptionGaps: string[],
    skillGaps: string[],
    role: string
  ): string[] {
    const benefits: string[] = [];

    // Add gap-specific benefits
    for (const gap of adoptionGaps.slice(0, 2)) {
      benefits.push(`Master ${gap} to streamline your workflows`);
    }

    for (const skill of skillGaps.slice(0, 2)) {
      benefits.push(`Develop ${skill} skills for greater efficiency`);
    }

    // Role-specific benefits
    const roleLower = role.toLowerCase();
    if (roleLower.includes('executive') || roleLower.includes('director')) {
      benefits.push('Get executive-level insights at a glance');
    } else if (roleLower.includes('admin')) {
      benefits.push('Learn advanced configuration options');
    } else if (roleLower.includes('analyst')) {
      benefits.push('Unlock powerful data analysis techniques');
    }

    // General benefits
    benefits.push('Connect with experts during live Q&A');

    return benefits.slice(0, 4);
  }

  /**
   * Match training sessions to identified gaps
   */
  private matchSessionsToGaps(
    analyses: StakeholderAnalysis[],
    sessions: TrainingSession[]
  ): TrainingSession[] {
    // Collect all gaps
    const allGaps = new Set<string>();
    for (const analysis of analyses) {
      analysis.adoptionGaps.forEach(g => allGaps.add(g.toLowerCase()));
      analysis.skillGaps.forEach(g => allGaps.add(g.toLowerCase()));
    }

    // Score each session
    const scoredSessions = sessions.map(session => {
      let score = 0;

      // Check feature coverage
      for (const feature of session.target_features || []) {
        if (allGaps.has(feature.toLowerCase())) {
          score += 10;
        }
      }

      // Check topic relevance
      if (allGaps.has(session.topic.toLowerCase())) {
        score += 15;
      }

      // Check role matching
      const stakeholderRoles = analyses.map(a => a.stakeholder.role.toLowerCase());
      for (const targetRole of session.target_roles || []) {
        if (stakeholderRoles.some(r => r.includes(targetRole.toLowerCase()))) {
          score += 5;
        }
      }

      return { session, score };
    });

    // Sort by score and return top matches
    return scoredSessions
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.session);
  }

  /**
   * Generate gap analysis summary
   */
  private generateGapSummary(
    analyses: StakeholderAnalysis[],
    sessions: TrainingSession[]
  ): string {
    const highRelevance = analyses.filter(a => a.relevanceScore >= 70).length;
    const totalGaps = new Set([
      ...analyses.flatMap(a => a.adoptionGaps),
      ...analyses.flatMap(a => a.skillGaps),
    ]).size;

    return `Identified ${totalGaps} training opportunities across ${analyses.length} stakeholders. ` +
      `${highRelevance} stakeholder(s) show high training relevance. ` +
      `${sessions.length} matching training session(s) available.`;
  }

  /**
   * Generate personalized invitations for a training session
   */
  async generateInvitations(params: GenerateInvitationsParams): Promise<GeneratedInvitation[]> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    // Get training session
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', params.trainingSessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Training session not found: ${params.trainingSessionId}`);
    }

    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.customerId)
      .single();

    // Get stakeholders
    let stakeholderQuery = supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', params.customerId);

    if (params.stakeholderIds && params.stakeholderIds.length > 0) {
      stakeholderQuery = stakeholderQuery.in('id', params.stakeholderIds);
    }

    const { data: stakeholders } = await stakeholderQuery;

    if (!stakeholders || stakeholders.length === 0) {
      throw new Error('No stakeholders found for customer');
    }

    // Analyze gaps and generate invitations
    const gapAnalysis = await this.analyzeTrainingGaps(params.customerId);

    const invitations: GeneratedInvitation[] = [];

    for (const stakeholder of stakeholders) {
      if (!stakeholder.email) continue;

      // Find stakeholder analysis
      const analysis = gapAnalysis.stakeholderAnalyses.find(
        a => a.stakeholder.id === stakeholder.id
      );

      // Generate personalization
      const personalization = analysis
        ? {
            angle: analysis.personalizationAngle,
            adoptionGaps: analysis.adoptionGaps,
            skillGaps: analysis.skillGaps,
            benefits: analysis.benefits,
            relevanceScore: analysis.relevanceScore,
          }
        : await this.generateDefaultPersonalization(stakeholder, session);

      // Generate email
      const emailData: TrainingInviteData = {
        recipient: {
          name: stakeholder.name,
          email: stakeholder.email,
          role: stakeholder.role,
          company: customer?.name,
        },
        training: {
          title: session.title,
          description: session.description || '',
          topic: session.topic,
          format: session.format,
          scheduledAt: session.scheduled_at,
          timezone: session.timezone || 'America/New_York',
          durationMinutes: session.duration_minutes || 60,
          presenterName: session.presenter_name,
          meetingUrl: session.meeting_url,
          registrationUrl: params.registrationUrl,
        },
        personalization: {
          angle: personalization.angle,
          adoptionGaps: personalization.adoptionGaps,
          skillGaps: personalization.skillGaps,
          benefits: personalization.benefits,
        },
        csm: {
          name: params.csmName,
          email: params.csmEmail,
          title: params.csmTitle,
        },
        customer: customer
          ? {
              name: customer.name,
              healthScore: customer.health_score,
            }
          : undefined,
      };

      const email = generateTrainingInviteEmail(emailData);

      invitations.push({
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
        stakeholderEmail: stakeholder.email,
        stakeholderRole: stakeholder.role || 'Team Member',
        email,
        personalization,
      });
    }

    return invitations;
  }

  /**
   * Generate default personalization when analysis not available
   */
  private async generateDefaultPersonalization(
    stakeholder: any,
    session: any
  ): Promise<{
    angle: string;
    adoptionGaps: string[];
    skillGaps: string[];
    benefits: string[];
    relevanceScore: number;
  }> {
    const role = stakeholder.role?.toLowerCase() || '';
    const isRelevantRole = session.target_roles?.some((r: string) =>
      role.includes(r.toLowerCase())
    );

    return {
      angle: isRelevantRole
        ? `Based on your role as ${stakeholder.role}, I thought this training would be particularly valuable for you.`
        : `I wanted to share this upcoming training that I think could benefit your work.`,
      adoptionGaps: [],
      skillGaps: [],
      benefits: [
        `Learn ${session.topic} best practices`,
        'Get hands-on experience with key features',
        'Connect with experts during live Q&A',
      ],
      relevanceScore: isRelevantRole ? 60 : 40,
    };
  }

  /**
   * Save generated invitations to database
   */
  async saveInvitations(
    invitations: GeneratedInvitation[],
    trainingSessionId: string,
    customerId: string,
    createdBy?: string
  ): Promise<string[]> {
    if (!supabase) {
      throw new Error('Database connection required');
    }

    const savedIds: string[] = [];

    for (const inv of invitations) {
      const { data, error } = await supabase
        .from('training_invitations')
        .insert({
          training_session_id: trainingSessionId,
          customer_id: customerId,
          stakeholder_id: inv.stakeholderId,
          recipient_email: inv.stakeholderEmail,
          recipient_name: inv.stakeholderName,
          recipient_role: inv.stakeholderRole,
          personalization_angle: inv.personalization.angle,
          adoption_gaps: inv.personalization.adoptionGaps,
          skill_gaps: inv.personalization.skillGaps,
          email_subject: inv.email.subject,
          email_body_html: inv.email.bodyHtml,
          email_body_text: inv.email.bodyText,
          status: 'draft',
          created_by: createdBy,
        })
        .select('id')
        .single();

      if (!error && data) {
        savedIds.push(data.id);
      }
    }

    return savedIds;
  }

  /**
   * Format feature name for display
   */
  private formatFeatureName(feature: string): string {
    return feature
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}

// Singleton instance
export const trainingInvitationGenerator = new TrainingInvitationGenerator();

export default trainingInvitationGenerator;
