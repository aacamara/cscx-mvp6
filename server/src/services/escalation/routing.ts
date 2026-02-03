/**
 * PRD-236: Intelligent Escalation Routing Service
 *
 * Routes escalations to the appropriate resources based on:
 * - Issue type and category
 * - Urgency and severity
 * - Customer tier and ARR
 * - Required expertise
 * - Team availability
 * - Current workload
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { issueClassifier, ClassificationResult } from './classifier.js';
import type {
  EscalationCategory,
  EscalationSeverity,
  ParticipantRole,
} from '../../../types/escalation.js';

// ============================================
// Types
// ============================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  slackUserId?: string;
  isAvailable: boolean;
  currentLoad: number; // Number of active escalations
  expertise: Array<{
    area: string;
    proficiencyLevel: number; // 1-5
  }>;
  timezone?: string;
}

export interface RoutingDecision {
  id: string;
  escalationId?: string;
  primary: RoutedMember;
  secondary: RoutedMember[];
  executiveSponsor?: RoutedMember;
  standbyTeam: string[];
  estimatedResponseTime: number; // minutes
  routingReason: string;
  classification: ClassificationResult;
  createdAt: Date;
}

export interface RoutedMember {
  userId: string;
  userName: string;
  email: string;
  role: ParticipantRole;
  slackUserId?: string;
  matchScore: number;
  matchReasons: string[];
  availability: 'online' | 'away' | 'offline';
  currentLoad: number;
}

export interface RoutingPreviewRequest {
  title: string;
  description: string;
  customerId: string;
  customerName?: string;
  customerTier?: string;
  customerARR?: number;
  healthScore?: number;
  severity?: EscalationSeverity;
  category?: EscalationCategory;
}

export interface RoutingConfig {
  maxEscalationsPerPerson: number;
  requireExecutiveForP1: boolean;
  requireExecutiveForEnterpriseP1: boolean;
  autoAssignmentEnabled: boolean;
  slaTargets: Record<EscalationSeverity, number>; // minutes
}

// Default routing configuration
const DEFAULT_CONFIG: RoutingConfig = {
  maxEscalationsPerPerson: 5,
  requireExecutiveForP1: true,
  requireExecutiveForEnterpriseP1: true,
  autoAssignmentEnabled: true,
  slaTargets: {
    P1: 30,  // 30 minutes
    P2: 120, // 2 hours
    P3: 480, // 8 hours
  },
};

// Expertise area mapping to escalation categories
const CATEGORY_EXPERTISE_MAP: Record<EscalationCategory, string[]> = {
  technical: ['api', 'integration', 'engineering', 'infrastructure', 'backend', 'frontend'],
  support: ['support', 'troubleshooting', 'customer-service', 'training'],
  product: ['product', 'roadmap', 'feature-design', 'ux'],
  commercial: ['account-management', 'finance', 'contracts', 'pricing', 'negotiation'],
  relationship: ['executive', 'customer-success', 'account-strategy', 'retention'],
};

// ============================================
// Routing Service
// ============================================

export class EscalationRoutingService {
  private supabase: SupabaseClient | null = null;
  private config: RoutingConfig = DEFAULT_CONFIG;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Preview routing for an escalation before submission
   */
  async previewRouting(request: RoutingPreviewRequest): Promise<RoutingDecision> {
    console.log('[Routing] Generating routing preview');

    // 1. Classify the issue
    const classification = await issueClassifier.classifyIssue({
      title: request.title,
      description: request.description,
      customerId: request.customerId,
      customerName: request.customerName,
      customerTier: request.customerTier,
      customerARR: request.customerARR,
      healthScore: request.healthScore,
    });

    // Override with provided values if specified
    if (request.severity) {
      classification.severity = request.severity;
    }
    if (request.category) {
      classification.category = request.category;
    }

    // 2. Get available team members
    const teamMembers = await this.getAvailableTeamMembers();

    // 3. Route based on classification
    const decision = this.calculateRouting(
      classification,
      teamMembers,
      request.customerTier,
      request.customerARR
    );

    return decision;
  }

  /**
   * Route an existing escalation
   */
  async routeEscalation(
    escalationId: string,
    classification: ClassificationResult,
    customerTier?: string,
    customerARR?: number
  ): Promise<RoutingDecision> {
    console.log(`[Routing] Routing escalation ${escalationId}`);

    // Get available team members
    const teamMembers = await this.getAvailableTeamMembers();

    // Calculate routing
    const decision = this.calculateRouting(
      classification,
      teamMembers,
      customerTier,
      customerARR
    );

    // Set escalation ID
    decision.escalationId = escalationId;

    // Save routing decision for learning
    await this.saveRoutingDecision(decision);

    return decision;
  }

  /**
   * Reassign an escalation to a new team member
   */
  async reassignEscalation(
    escalationId: string,
    newAssigneeId: string,
    reason: string
  ): Promise<RoutedMember> {
    console.log(`[Routing] Reassigning escalation ${escalationId} to ${newAssigneeId}`);

    const member = await this.getTeamMember(newAssigneeId);
    if (!member) {
      throw new Error('Team member not found');
    }

    // Save reassignment for learning
    await this.saveReassignment(escalationId, newAssigneeId, reason);

    return {
      userId: member.id,
      userName: member.name,
      email: member.email,
      role: 'owner',
      slackUserId: member.slackUserId,
      matchScore: 0.8,
      matchReasons: [reason],
      availability: member.isAvailable ? 'online' : 'offline',
      currentLoad: member.currentLoad,
    };
  }

  /**
   * Calculate optimal routing based on classification and team availability
   */
  private calculateRouting(
    classification: ClassificationResult,
    teamMembers: TeamMember[],
    customerTier?: string,
    customerARR?: number
  ): RoutingDecision {
    const { category, severity, requiredExpertise } = classification;
    const isEnterprise = customerTier === 'enterprise' || (customerARR && customerARR >= 100000);
    const isP1 = severity === 'P1';

    // Score and rank team members
    const scoredMembers = teamMembers.map(member => ({
      member,
      score: this.calculateMemberScore(member, classification),
    }));

    // Sort by score (highest first)
    scoredMembers.sort((a, b) => b.score - a.score);

    // Find primary assignee (best match who is available)
    const primaryCandidate = scoredMembers.find(
      sm => sm.member.isAvailable && sm.member.currentLoad < this.config.maxEscalationsPerPerson
    ) || scoredMembers[0];

    const primary: RoutedMember = {
      userId: primaryCandidate.member.id,
      userName: primaryCandidate.member.name,
      email: primaryCandidate.member.email,
      role: 'owner',
      slackUserId: primaryCandidate.member.slackUserId,
      matchScore: primaryCandidate.score,
      matchReasons: this.getMatchReasons(primaryCandidate.member, classification),
      availability: primaryCandidate.member.isAvailable ? 'online' : 'away',
      currentLoad: primaryCandidate.member.currentLoad,
    };

    // Find secondary team members (different expertise areas)
    const secondary: RoutedMember[] = [];
    const usedExpertise = new Set(primaryCandidate.member.expertise.map(e => e.area));

    for (const sm of scoredMembers) {
      if (sm.member.id === primary.userId) continue;
      if (secondary.length >= 2) break;

      // Check if this member adds different expertise
      const hasNewExpertise = sm.member.expertise.some(e => !usedExpertise.has(e.area));
      if (hasNewExpertise && sm.score > 0.3) {
        const role = this.determineSecondaryRole(sm.member, category);
        secondary.push({
          userId: sm.member.id,
          userName: sm.member.name,
          email: sm.member.email,
          role,
          slackUserId: sm.member.slackUserId,
          matchScore: sm.score,
          matchReasons: this.getMatchReasons(sm.member, classification),
          availability: sm.member.isAvailable ? 'online' : 'away',
          currentLoad: sm.member.currentLoad,
        });
        sm.member.expertise.forEach(e => usedExpertise.add(e.area));
      }
    }

    // Determine if executive sponsor needed
    let executiveSponsor: RoutedMember | undefined;
    if (
      (isP1 && this.config.requireExecutiveForP1) ||
      (isEnterprise && isP1 && this.config.requireExecutiveForEnterpriseP1)
    ) {
      const executive = teamMembers.find(m =>
        m.expertise.some(e => e.area === 'executive' || e.area === 'leadership')
      );
      if (executive) {
        executiveSponsor = {
          userId: executive.id,
          userName: executive.name,
          email: executive.email,
          role: 'executive',
          slackUserId: executive.slackUserId,
          matchScore: 0.9,
          matchReasons: ['Executive sponsor required for P1'],
          availability: executive.isAvailable ? 'online' : 'away',
          currentLoad: executive.currentLoad,
        };
      }
    }

    // Determine standby team based on category
    const standbyTeam = this.getStandbyTeam(category);

    // Calculate estimated response time based on severity and availability
    const estimatedResponseTime = this.calculateResponseTime(severity, primary.availability);

    // Build routing reason
    const routingReason = this.buildRoutingReason(
      classification,
      primary,
      isEnterprise,
      customerARR
    );

    return {
      id: `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      primary,
      secondary,
      executiveSponsor,
      standbyTeam,
      estimatedResponseTime,
      routingReason,
      classification,
      createdAt: new Date(),
    };
  }

  /**
   * Calculate a match score for a team member
   */
  private calculateMemberScore(member: TeamMember, classification: ClassificationResult): number {
    let score = 0;
    const { category, requiredExpertise, estimatedComplexity } = classification;

    // Expertise match (0-40 points)
    const categoryExpertise = CATEGORY_EXPERTISE_MAP[category] || [];
    for (const expertise of member.expertise) {
      // Check if expertise matches required
      if (requiredExpertise.includes(expertise.area)) {
        score += expertise.proficiencyLevel * 4; // Up to 20 points per match
      }
      // Check if expertise matches category
      if (categoryExpertise.includes(expertise.area)) {
        score += expertise.proficiencyLevel * 2; // Up to 10 points per match
      }
    }
    score = Math.min(score, 40);

    // Availability bonus (0-20 points)
    if (member.isAvailable) {
      score += 20;
    }

    // Workload factor (0-20 points)
    const loadFactor = Math.max(0, 1 - (member.currentLoad / this.config.maxEscalationsPerPerson));
    score += loadFactor * 20;

    // Complexity matching (0-10 points)
    // For high complexity, prefer more senior members
    if (estimatedComplexity === 'high') {
      const maxProficiency = Math.max(...member.expertise.map(e => e.proficiencyLevel), 0);
      score += maxProficiency * 2;
    }

    // Normalize to 0-1
    return score / 100;
  }

  /**
   * Get reasons why a member was matched
   */
  private getMatchReasons(member: TeamMember, classification: ClassificationResult): string[] {
    const reasons: string[] = [];
    const { category, requiredExpertise } = classification;

    // Check expertise matches
    for (const expertise of member.expertise) {
      if (requiredExpertise.includes(expertise.area)) {
        reasons.push(`${expertise.area} expertise (Level ${expertise.proficiencyLevel}/5)`);
      }
    }

    // Availability
    if (member.isAvailable) {
      reasons.push('Currently available');
    }

    // Workload
    if (member.currentLoad < 2) {
      reasons.push('Low current workload');
    }

    return reasons.slice(0, 4);
  }

  /**
   * Determine the role for a secondary team member
   */
  private determineSecondaryRole(member: TeamMember, category: EscalationCategory): ParticipantRole {
    const expertiseAreas = member.expertise.map(e => e.area);

    if (expertiseAreas.includes('engineering') || expertiseAreas.includes('api')) {
      return 'engineering';
    }
    if (expertiseAreas.includes('product') || expertiseAreas.includes('roadmap')) {
      return 'product';
    }
    if (expertiseAreas.includes('executive') || expertiseAreas.includes('leadership')) {
      return 'executive';
    }
    return 'support';
  }

  /**
   * Get standby team for a category
   */
  private getStandbyTeam(category: EscalationCategory): string[] {
    const standbyMap: Record<EscalationCategory, string[]> = {
      technical: ['Engineering On-Call', 'Platform Team'],
      support: ['Support Tier 2', 'Technical Support'],
      product: ['Product Team', 'UX Team'],
      commercial: ['Finance Team', 'Legal'],
      relationship: ['Executive Team', 'Account Strategy'],
    };
    return standbyMap[category] || ['Customer Success Team'];
  }

  /**
   * Calculate estimated response time in minutes
   */
  private calculateResponseTime(severity: EscalationSeverity, availability: string): number {
    const baseSLA = this.config.slaTargets[severity];

    // Adjust based on availability
    if (availability === 'online') {
      return Math.round(baseSLA * 0.5); // 50% of SLA if online
    } else if (availability === 'away') {
      return Math.round(baseSLA * 0.75); // 75% of SLA if away
    }
    return baseSLA;
  }

  /**
   * Build a human-readable routing reason
   */
  private buildRoutingReason(
    classification: ClassificationResult,
    primary: RoutedMember,
    isEnterprise: boolean,
    customerARR?: number
  ): string {
    const parts: string[] = [];

    parts.push(`${classification.severity} ${classification.category} escalation`);

    if (isEnterprise) {
      parts.push(`Enterprise customer ($${((customerARR || 0) / 1000).toFixed(0)}K ARR)`);
    }

    parts.push(`Routed to ${primary.userName} based on ${primary.matchReasons[0] || 'best available match'}`);

    if (classification.urgencyIndicators.length > 0) {
      parts.push(`Urgency: ${classification.urgencyIndicators[0]}`);
    }

    return parts.join('. ');
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Get available team members with expertise
   */
  private async getAvailableTeamMembers(): Promise<TeamMember[]> {
    if (!this.supabase) {
      // Return mock data if no database
      return this.getMockTeamMembers();
    }

    try {
      // Get users with their expertise
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id, name, email, role, slack_user_id')
        .in('role', ['csm', 'support', 'engineering', 'product', 'executive', 'admin']);

      if (usersError || !users) {
        console.error('[Routing] Error fetching users:', usersError);
        return this.getMockTeamMembers();
      }

      // Get expertise for each user
      const { data: expertise, error: expertiseError } = await this.supabase
        .from('team_expertise')
        .select('user_id, expertise_area, proficiency_level');

      if (expertiseError) {
        console.error('[Routing] Error fetching expertise:', expertiseError);
      }

      // Get current escalation loads
      const { data: escalations, error: escError } = await this.supabase
        .from('escalations')
        .select('owner_id')
        .in('status', ['active', 'post_mortem']);

      const loadMap = new Map<string, number>();
      if (escalations) {
        for (const esc of escalations) {
          loadMap.set(esc.owner_id, (loadMap.get(esc.owner_id) || 0) + 1);
        }
      }

      // Build team member objects
      const expertiseMap = new Map<string, Array<{ area: string; proficiencyLevel: number }>>();
      if (expertise) {
        for (const exp of expertise) {
          if (!expertiseMap.has(exp.user_id)) {
            expertiseMap.set(exp.user_id, []);
          }
          expertiseMap.get(exp.user_id)!.push({
            area: exp.expertise_area,
            proficiencyLevel: exp.proficiency_level,
          });
        }
      }

      return users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        slackUserId: user.slack_user_id,
        isAvailable: true, // TODO: Integrate with real availability system
        currentLoad: loadMap.get(user.id) || 0,
        expertise: expertiseMap.get(user.id) || [],
      }));
    } catch (error) {
      console.error('[Routing] Error getting team members:', error);
      return this.getMockTeamMembers();
    }
  }

  /**
   * Get a specific team member
   */
  private async getTeamMember(userId: string): Promise<TeamMember | null> {
    const members = await this.getAvailableTeamMembers();
    return members.find(m => m.id === userId) || null;
  }

  /**
   * Save routing decision for learning
   */
  private async saveRoutingDecision(decision: RoutingDecision): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('routing_decisions').insert({
        id: decision.id,
        escalation_id: decision.escalationId,
        primary_assignee_id: decision.primary.userId,
        secondary_assignee_ids: decision.secondary.map(s => s.userId),
        executive_sponsor_id: decision.executiveSponsor?.userId,
        classification: decision.classification,
        routing_reason: decision.routingReason,
        estimated_response_time: decision.estimatedResponseTime,
        created_at: decision.createdAt.toISOString(),
      });
    } catch (error) {
      console.error('[Routing] Error saving routing decision:', error);
    }
  }

  /**
   * Save reassignment for learning
   */
  private async saveReassignment(
    escalationId: string,
    newAssigneeId: string,
    reason: string
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('routing_reassignments').insert({
        escalation_id: escalationId,
        new_assignee_id: newAssigneeId,
        reason,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Routing] Error saving reassignment:', error);
    }
  }

  /**
   * Mock team members for development/testing
   */
  private getMockTeamMembers(): TeamMember[] {
    return [
      {
        id: 'user_james',
        name: 'James Wilson',
        email: 'james.wilson@company.com',
        role: 'engineering',
        slackUserId: 'U123456',
        isAvailable: true,
        currentLoad: 2,
        expertise: [
          { area: 'api', proficiencyLevel: 5 },
          { area: 'integration', proficiencyLevel: 4 },
          { area: 'engineering', proficiencyLevel: 5 },
        ],
      },
      {
        id: 'user_sarah',
        name: 'Sarah Chen',
        email: 'sarah.chen@company.com',
        role: 'csm',
        slackUserId: 'U234567',
        isAvailable: true,
        currentLoad: 1,
        expertise: [
          { area: 'customer-success', proficiencyLevel: 5 },
          { area: 'account-management', proficiencyLevel: 4 },
          { area: 'retention', proficiencyLevel: 5 },
        ],
      },
      {
        id: 'user_mike',
        name: 'Mike Johnson',
        email: 'mike.johnson@company.com',
        role: 'product',
        slackUserId: 'U345678',
        isAvailable: false,
        currentLoad: 3,
        expertise: [
          { area: 'product', proficiencyLevel: 5 },
          { area: 'roadmap', proficiencyLevel: 4 },
          { area: 'feature-design', proficiencyLevel: 4 },
        ],
      },
      {
        id: 'user_lisa',
        name: 'Lisa Park',
        email: 'lisa.park@company.com',
        role: 'executive',
        slackUserId: 'U456789',
        isAvailable: true,
        currentLoad: 0,
        expertise: [
          { area: 'executive', proficiencyLevel: 5 },
          { area: 'leadership', proficiencyLevel: 5 },
          { area: 'account-strategy', proficiencyLevel: 4 },
        ],
      },
      {
        id: 'user_david',
        name: 'David Kim',
        email: 'david.kim@company.com',
        role: 'support',
        slackUserId: 'U567890',
        isAvailable: true,
        currentLoad: 2,
        expertise: [
          { area: 'support', proficiencyLevel: 5 },
          { area: 'troubleshooting', proficiencyLevel: 5 },
          { area: 'training', proficiencyLevel: 3 },
        ],
      },
    ];
  }
}

// Singleton instance
export const escalationRoutingService = new EscalationRoutingService();
