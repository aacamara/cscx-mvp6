/**
 * Champion Departure Service
 * PRD-088: Handles detection and response to champion departures
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { slackService } from './slack/index.js';

// ============================================
// Types
// ============================================

export interface ChampionDepartureSignal {
  id?: string;
  stakeholderId: string;
  customerId: string;
  signalType: 'email_bounce' | 'linkedin_change' | 'login_stopped' | 'meeting_declines' | 'ooo_mention' | 'manual';
  confidence: number;
  evidence: string;
  evidenceData?: Record<string, any>;
  detectedAt?: Date;
}

export interface DepartureEvaluation {
  isDeparted: boolean;
  confidence: number;
  signals: ChampionDepartureSignal[];
  recommendedAction: 'trigger_alert' | 'monitor_closely' | 'no_action';
}

export interface Stakeholder {
  id: string;
  customerId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  isPrimary: boolean;
  isChampion: boolean;
  isExecSponsor: boolean;
  status: 'active' | 'departed' | 'inactive' | 'unknown';
  departureDetectedAt?: Date;
  departureDestination?: string;
  departureDestinationRole?: string;
  departureConfidence?: number;
  lastContactAt?: Date;
  lastLoginAt?: Date;
  interactionCount: number;
  engagementScore: number;
  sentiment?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskSignal {
  id: string;
  customerId: string;
  signalType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChampionCandidate {
  stakeholderId: string;
  name: string;
  role?: string;
  email?: string;
  score: number;
  reasons: string[];
}

export interface MarkDepartedInput {
  stakeholderId: string;
  departureDate?: Date;
  newCompany?: string;
  newRole?: string;
  reason?: string;
}

export interface ChampionStatusResponse {
  champions: Stakeholder[];
  atRiskChampions: Array<{
    stakeholder: Stakeholder;
    riskIndicators: string[];
    confidence: number;
  }>;
  recentDepartures: Array<{
    stakeholder: Stakeholder;
    departedAt: string;
    destination?: string;
  }>;
}

// Signal weight configuration
const SIGNAL_WEIGHTS: Record<string, number> = {
  linkedin_change: 0.4,
  email_bounce: 0.3,
  login_stopped: 0.15,
  meeting_declines: 0.1,
  ooo_mention: 0.05,
  manual: 0.5,
};

// ============================================
// Champion Departure Service
// ============================================

export class ChampionDepartureService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Signal Collection
  // ============================================

  /**
   * Record a departure signal for a stakeholder
   */
  async recordDepartureSignal(signal: ChampionDepartureSignal): Promise<ChampionDepartureSignal> {
    if (!this.supabase) throw new Error('Database not available');

    const { data, error } = await this.supabase
      .from('champion_departure_signals')
      .insert({
        id: uuidv4(),
        stakeholder_id: signal.stakeholderId,
        customer_id: signal.customerId,
        signal_type: signal.signalType,
        confidence: signal.confidence,
        evidence: signal.evidence,
        evidence_data: signal.evidenceData || {},
        detected_at: signal.detectedAt || new Date(),
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapSignal(data);
  }

  /**
   * Get all departure signals for a stakeholder
   */
  async getDepartureSignals(stakeholderId: string): Promise<ChampionDepartureSignal[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('champion_departure_signals')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .order('detected_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.mapSignal);
  }

  // ============================================
  // Departure Evaluation
  // ============================================

  /**
   * Evaluate champion departure status based on collected signals
   */
  async evaluateChampionStatus(stakeholderId: string): Promise<DepartureEvaluation> {
    const signals = await this.getDepartureSignals(stakeholderId);

    // Filter to recent signals (last 30 days)
    const recentSignals = signals.filter(
      (s) => s.detectedAt && new Date(s.detectedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    // Calculate weighted confidence
    let totalConfidence = 0;
    for (const signal of recentSignals) {
      const weight = SIGNAL_WEIGHTS[signal.signalType] || 0.1;
      totalConfidence += signal.confidence * weight;
    }

    // Normalize confidence to 0-100
    totalConfidence = Math.min(Math.round(totalConfidence), 100);

    // Determine recommended action
    let recommendedAction: 'trigger_alert' | 'monitor_closely' | 'no_action';
    if (totalConfidence >= 70) {
      recommendedAction = 'trigger_alert';
    } else if (totalConfidence >= 40) {
      recommendedAction = 'monitor_closely';
    } else {
      recommendedAction = 'no_action';
    }

    return {
      isDeparted: totalConfidence >= 70,
      confidence: totalConfidence,
      signals: recentSignals,
      recommendedAction,
    };
  }

  // ============================================
  // Manual Departure Marking
  // ============================================

  /**
   * Manually mark a stakeholder as departed
   */
  async markDeparted(input: MarkDepartedInput, userId?: string): Promise<Stakeholder> {
    if (!this.supabase) throw new Error('Database not available');

    // Get stakeholder details first
    const { data: stakeholder, error: stakeholderError } = await this.supabase
      .from('stakeholders')
      .select('*, customers(id, name, arr, health_score)')
      .eq('id', input.stakeholderId)
      .single();

    if (stakeholderError || !stakeholder) {
      throw new Error('Stakeholder not found');
    }

    // Update stakeholder status
    const { data, error } = await this.supabase
      .from('stakeholders')
      .update({
        status: 'departed',
        departure_detected_at: input.departureDate || new Date(),
        departure_destination: input.newCompany,
        departure_destination_role: input.newRole,
        departure_confidence: 100, // Manual marking is 100% confidence
        updated_at: new Date(),
      })
      .eq('id', input.stakeholderId)
      .select()
      .single();

    if (error) throw error;

    // Record manual signal
    await this.recordDepartureSignal({
      stakeholderId: input.stakeholderId,
      customerId: stakeholder.customer_id,
      signalType: 'manual',
      confidence: 100,
      evidence: input.reason || 'Manually marked as departed',
      evidenceData: {
        markedBy: userId,
        newCompany: input.newCompany,
        newRole: input.newRole,
      },
    });

    // Create risk signal if this is a champion
    if (stakeholder.is_champion || stakeholder.is_primary) {
      await this.createChampionLeftRiskSignal(stakeholder, input);
    }

    return this.mapStakeholder(data);
  }

  // ============================================
  // Risk Signal Management
  // ============================================

  /**
   * Create a risk signal for champion departure
   */
  async createChampionLeftRiskSignal(
    stakeholder: any,
    input: MarkDepartedInput
  ): Promise<RiskSignal> {
    if (!this.supabase) throw new Error('Database not available');

    const customer = stakeholder.customers;
    const severity = stakeholder.is_exec_sponsor ? 'critical' : stakeholder.is_champion ? 'high' : 'medium';

    // Get remaining contacts count
    const { count: remainingContacts } = await this.supabase
      .from('stakeholders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', stakeholder.customer_id)
      .eq('status', 'active');

    // Get suggested new champions
    const suggestions = await this.suggestNewChampions(stakeholder.customer_id);

    const metadata = {
      stakeholder_id: stakeholder.id,
      stakeholder_name: stakeholder.name,
      stakeholder_role: stakeholder.role,
      was_primary_contact: stakeholder.is_primary,
      was_exec_sponsor: stakeholder.is_exec_sponsor,
      was_champion: stakeholder.is_champion,
      detection_method: 'manual',
      confidence: 100,
      new_company: input.newCompany,
      new_role: input.newRole,
      evidence: [
        { type: 'manual', data: input.reason || 'Manually marked as departed' },
      ],
      remaining_contacts: remainingContacts || 0,
      suggested_new_champions: suggestions.map((s) => `${s.name} (${s.role})`),
    };

    const { data, error } = await this.supabase
      .from('risk_signals')
      .insert({
        id: uuidv4(),
        customer_id: stakeholder.customer_id,
        signal_type: 'champion_left',
        severity,
        title: `Champion departed: ${stakeholder.name} at ${customer?.name || 'Unknown'}`,
        description: `${stakeholder.name} (${stakeholder.role}) has left ${customer?.name || 'the company'}${input.newCompany ? ` for ${input.newCompany}` : ''}.`,
        metadata,
        resolved: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Create response tasks
    await this.createDepartureTasks(stakeholder, data.id);

    // Update health score
    await this.adjustHealthScore(stakeholder.customer_id, -20, 'Champion departure detected');

    return this.mapRiskSignal(data);
  }

  /**
   * Adjust customer health score
   */
  async adjustHealthScore(customerId: string, adjustment: number, reason: string): Promise<void> {
    if (!this.supabase) return;

    const { data: customer } = await this.supabase
      .from('customers')
      .select('health_score')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    const newScore = Math.max(0, Math.min(100, (customer.health_score || 50) + adjustment));

    await this.supabase
      .from('customers')
      .update({
        health_score: newScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    // Log the adjustment
    await this.supabase.from('activity_log').insert({
      customer_id: customerId,
      action: 'health_score_adjusted',
      entity_type: 'customer',
      entity_id: customerId,
      old_values: { health_score: customer.health_score },
      new_values: { health_score: newScore, reason },
    });
  }

  /**
   * Create tasks for departure response workflow
   */
  async createDepartureTasks(stakeholder: any, riskSignalId: string): Promise<void> {
    if (!this.supabase) return;

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const tasks = [
      {
        id: uuidv4(),
        stakeholder_id: stakeholder.id,
        customer_id: stakeholder.customer_id,
        risk_signal_id: riskSignalId,
        task_type: 'establish_contact',
        title: `URGENT: Champion departed at ${stakeholder.customers?.name || 'account'} - establish new contact`,
        description: `${stakeholder.name} has left. Need to quickly establish relationships with remaining stakeholders.`,
        priority: 'critical',
        status: 'pending',
        due_at: oneDayFromNow.toISOString(),
      },
      {
        id: uuidv4(),
        stakeholder_id: stakeholder.id,
        customer_id: stakeholder.customer_id,
        risk_signal_id: riskSignalId,
        task_type: 'identify_champion',
        title: `Identify new champion at ${stakeholder.customers?.name || 'account'}`,
        description: 'Review stakeholder map and identify potential new champion candidates.',
        priority: 'high',
        status: 'pending',
        due_at: threeDaysFromNow.toISOString(),
      },
      {
        id: uuidv4(),
        stakeholder_id: stakeholder.id,
        customer_id: stakeholder.customer_id,
        risk_signal_id: riskSignalId,
        task_type: 'update_stakeholder_map',
        title: `Update stakeholder map for ${stakeholder.customers?.name || 'account'}`,
        description: 'Mark departed champion and update stakeholder relationships.',
        priority: 'medium',
        status: 'pending',
        due_at: oneDayFromNow.toISOString(),
      },
    ];

    await this.supabase.from('champion_departure_tasks').insert(tasks);
  }

  // ============================================
  // Champion Status Queries
  // ============================================

  /**
   * Get champion status for a customer
   */
  async getChampionStatus(customerId: string): Promise<ChampionStatusResponse> {
    if (!this.supabase) {
      return { champions: [], atRiskChampions: [], recentDepartures: [] };
    }

    // Get all stakeholders for the customer
    const { data: stakeholders, error } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_champion', { ascending: false })
      .order('is_primary', { ascending: false });

    if (error) throw error;

    const mapped = (stakeholders || []).map(this.mapStakeholder);

    // Get active champions
    const champions = mapped.filter((s) => s.isChampion && s.status === 'active');

    // Get at-risk champions (with departure signals but not yet departed)
    const atRiskChampions: ChampionStatusResponse['atRiskChampions'] = [];
    for (const champion of champions) {
      const evaluation = await this.evaluateChampionStatus(champion.id);
      if (evaluation.confidence >= 40 && !evaluation.isDeparted) {
        atRiskChampions.push({
          stakeholder: champion,
          riskIndicators: evaluation.signals.map((s) => s.evidence),
          confidence: evaluation.confidence,
        });
      }
    }

    // Get recent departures (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentDepartures = mapped
      .filter(
        (s) =>
          s.status === 'departed' &&
          s.departureDetectedAt &&
          new Date(s.departureDetectedAt) > ninetyDaysAgo
      )
      .map((s) => ({
        stakeholder: s,
        departedAt: s.departureDetectedAt?.toISOString() || '',
        destination: s.departureDestination,
      }));

    return { champions, atRiskChampions, recentDepartures };
  }

  /**
   * Suggest new champion candidates for a customer
   */
  async suggestNewChampions(customerId: string, limit: number = 5): Promise<ChampionCandidate[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .eq('is_champion', false)
      .order('engagement_score', { ascending: false })
      .limit(limit * 2); // Get more to filter

    if (error || !data) return [];

    // Score and rank candidates
    const candidates: ChampionCandidate[] = data.map((s) => {
      const reasons: string[] = [];
      let score = 0;

      // Engagement score contribution
      const engagementScore = s.engagement_score || 0;
      score += engagementScore;
      if (engagementScore >= 70) {
        reasons.push('High engagement score');
      }

      // Interaction count contribution
      const interactionCount = s.interaction_count || 0;
      score += interactionCount * 2;
      if (interactionCount >= 5) {
        reasons.push(`${interactionCount} interactions`);
      }

      // Primary contact bonus
      if (s.is_primary) {
        score += 20;
        reasons.push('Primary contact');
      }

      // Seniority bonus
      const role = (s.role || '').toLowerCase();
      if (
        role.includes('director') ||
        role.includes('vp') ||
        role.includes('head') ||
        role.includes('chief')
      ) {
        score += 15;
        reasons.push('Senior role');
      }

      // Recent contact bonus
      if (s.last_contact_at) {
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(s.last_contact_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact <= 30) {
          score += 10;
          reasons.push('Recent contact');
        }
      }

      return {
        stakeholderId: s.id,
        name: s.name,
        role: s.role,
        email: s.email,
        score,
        reasons,
      };
    });

    // Sort by score and return top candidates
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ============================================
  // Stakeholder Management
  // ============================================

  /**
   * Get stakeholders for a customer
   */
  async getStakeholders(customerId: string): Promise<Stakeholder[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_champion', { ascending: false })
      .order('is_primary', { ascending: false })
      .order('name');

    if (error) throw error;

    return (data || []).map(this.mapStakeholder);
  }

  /**
   * Get a single stakeholder by ID
   */
  async getStakeholder(stakeholderId: string): Promise<Stakeholder | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('id', stakeholderId)
      .single();

    if (error || !data) return null;

    return this.mapStakeholder(data);
  }

  /**
   * Update stakeholder details
   */
  async updateStakeholder(
    stakeholderId: string,
    updates: Partial<Stakeholder>
  ): Promise<Stakeholder> {
    if (!this.supabase) throw new Error('Database not available');

    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.linkedinUrl !== undefined) dbUpdates.linkedin_url = updates.linkedinUrl;
    if (updates.isPrimary !== undefined) dbUpdates.is_primary = updates.isPrimary;
    if (updates.isChampion !== undefined) dbUpdates.is_champion = updates.isChampion;
    if (updates.isExecSponsor !== undefined) dbUpdates.is_exec_sponsor = updates.isExecSponsor;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.engagementScore !== undefined) dbUpdates.engagement_score = updates.engagementScore;
    if (updates.sentiment !== undefined) dbUpdates.sentiment = updates.sentiment;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { data, error } = await this.supabase
      .from('stakeholders')
      .update(dbUpdates)
      .eq('id', stakeholderId)
      .select()
      .single();

    if (error) throw error;

    return this.mapStakeholder(data);
  }

  /**
   * Record an interaction with a stakeholder
   */
  async recordInteraction(
    stakeholderId: string,
    interactionType: string,
    title?: string,
    description?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const stakeholder = await this.getStakeholder(stakeholderId);
    if (!stakeholder) return;

    await this.supabase.from('stakeholder_interactions').insert({
      id: uuidv4(),
      stakeholder_id: stakeholderId,
      customer_id: stakeholder.customerId,
      interaction_type: interactionType,
      title,
      description,
      occurred_at: new Date().toISOString(),
    });

    // Update stakeholder metrics
    await this.supabase
      .from('stakeholders')
      .update({
        last_contact_at: new Date().toISOString(),
        interaction_count: (stakeholder.interactionCount || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stakeholderId);
  }

  // ============================================
  // Draft Email Generation
  // ============================================

  /**
   * Generate multi-threading outreach email drafts
   */
  async generateOutreachDrafts(
    customerId: string,
    riskSignalId?: string
  ): Promise<Array<{ email: string; subject: string; body: string }>> {
    if (!this.supabase) return [];

    // Get customer details
    const { data: customer } = await this.supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    // Get active stakeholders
    const candidates = await this.suggestNewChampions(customerId, 3);

    const drafts = [];

    for (const candidate of candidates) {
      const subject = 'Continuing our partnership';
      const body = `Hi ${candidate.name.split(' ')[0]},

I hope this message finds you well. I'm reaching out as your Customer Success Manager for your ${customer?.name || 'company'}'s account.

I wanted to introduce myself and ensure we have a direct line of communication. I understand there have been some team changes recently, and I want to make sure our partnership continues smoothly.

As your CSM, I'm here to:
- Ensure you're getting maximum value from our platform
- Share best practices and new features relevant to your goals
- Address any questions or concerns you might have

I'd love to schedule a brief call to learn more about your priorities and how we can best support your team. Would you have 20 minutes this week or next?

Looking forward to connecting!

Best regards`;

      drafts.push({
        email: candidate.email || '',
        subject,
        body,
      });

      // Save draft to database
      if (candidate.email) {
        await this.supabase.from('draft_outreach_emails').insert({
          id: uuidv4(),
          customer_id: customerId,
          stakeholder_id: candidate.stakeholderId,
          triggered_by: riskSignalId,
          template_type: 'champion_transition',
          subject,
          body,
          recipient_email: candidate.email,
          recipient_name: candidate.name,
          status: 'draft',
        });
      }
    }

    return drafts;
  }

  // ============================================
  // Slack Notifications
  // ============================================

  /**
   * Send champion departure Slack alert
   */
  async sendSlackAlert(
    userId: string,
    stakeholder: any,
    customer: any,
    riskSignal: RiskSignal
  ): Promise<void> {
    try {
      const isConnected = await slackService.isConnected(userId);
      if (!isConnected) return;

      // Get remaining contacts
      const remainingContacts = riskSignal.metadata.remaining_contacts || 0;
      const suggestions = riskSignal.metadata.suggested_new_champions || [];

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `\u26a0\ufe0f CHAMPION DEPARTURE: ${customer.name}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${stakeholder.name}* (${stakeholder.role}) has left ${customer.name}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Detection:*\n${riskSignal.metadata.detection_method || 'Manual'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Confidence:*\n${riskSignal.metadata.confidence || 100}%`,
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Account ARR:*\n$${(customer.arr || 0).toLocaleString()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Remaining Contacts:*\n${remainingContacts}`,
            },
          ],
        },
      ];

      if (stakeholder.departure_destination) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New Company:* ${stakeholder.departure_destination}${stakeholder.departure_destination_role ? ` (${stakeholder.departure_destination_role})` : ''}`,
          },
        });
      }

      if (suggestions.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Suggested New Champions:*\n${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`,
          },
        });
      }

      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Stakeholder Map', emoji: true },
            url: `${config.frontendUrl || 'http://localhost:5173'}/customers/${customer.id}?tab=stakeholders`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Draft Outreach', emoji: true },
            style: 'primary',
            url: `${config.frontendUrl || 'http://localhost:5173'}/customers/${customer.id}?action=draft-outreach`,
          },
        ],
      });

      await slackService.sendMessage(userId, {
        channel: '#cscx-alerts', // Or user's DM
        text: `Champion Departure Alert: ${stakeholder.name} has left ${customer.name}`,
        blocks,
      });
    } catch (error) {
      console.error('[ChampionDeparture] Failed to send Slack alert:', error);
    }
  }

  // ============================================
  // Mappers
  // ============================================

  private mapSignal(row: any): ChampionDepartureSignal {
    return {
      id: row.id,
      stakeholderId: row.stakeholder_id,
      customerId: row.customer_id,
      signalType: row.signal_type,
      confidence: row.confidence,
      evidence: row.evidence,
      evidenceData: row.evidence_data,
      detectedAt: row.detected_at ? new Date(row.detected_at) : undefined,
    };
  }

  private mapStakeholder(row: any): Stakeholder {
    return {
      id: row.id,
      customerId: row.customer_id,
      name: row.name,
      role: row.role,
      email: row.email,
      phone: row.phone,
      linkedinUrl: row.linkedin_url,
      isPrimary: row.is_primary || false,
      isChampion: row.is_champion || false,
      isExecSponsor: row.is_exec_sponsor || false,
      status: row.status || 'active',
      departureDetectedAt: row.departure_detected_at ? new Date(row.departure_detected_at) : undefined,
      departureDestination: row.departure_destination,
      departureDestinationRole: row.departure_destination_role,
      departureConfidence: row.departure_confidence,
      lastContactAt: row.last_contact_at ? new Date(row.last_contact_at) : undefined,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      interactionCount: row.interaction_count || 0,
      engagementScore: row.engagement_score || 50,
      sentiment: row.sentiment,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRiskSignal(row: any): RiskSignal {
    return {
      id: row.id,
      customerId: row.customer_id,
      signalType: row.signal_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      metadata: row.metadata || {},
      resolved: row.resolved || false,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by,
      resolutionNotes: row.resolution_notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const championDepartureService = new ChampionDepartureService();
