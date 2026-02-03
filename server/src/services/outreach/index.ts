/**
 * Outreach Service
 * PRD-191: Handles Outreach.io API operations for sequence management
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import { outreachOAuth } from './oauth.js';
import {
  OutreachSequence,
  OutreachProspect,
  CreateProspectRequest,
  OutreachSequenceState,
  EnrollProspectRequest,
  OutreachMapping,
  CreateMappingRequest,
  OutreachEnrollment,
  EnrollStakeholderRequest,
  StakeholderSequenceStatus,
  OutreachApiResponse,
  OutreachTriggerType,
  SequenceStateStatus,
  EnrollmentStatus,
  SequenceMetrics,
} from './types.js';

// ============================================
// Configuration
// ============================================

const OUTREACH_API_BASE = 'https://api.outreach.io/api/v2';

// Cache TTL in milliseconds
const SEQUENCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// Outreach Service
// ============================================

export class OutreachService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private circuitBreaker: CircuitBreaker;
  private sequenceCache: Map<string, { data: OutreachSequence[]; expiry: Date }> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.circuitBreaker = new CircuitBreaker('outreach', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
    });
  }

  // ============================================
  // API Helpers
  // ============================================

  private async request<T>(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await outreachOAuth.getValidAccessToken(userId);
    if (!accessToken) {
      throw new Error('Outreach not connected or token expired');
    }

    const url = `${OUTREACH_API_BASE}${endpoint}`;
    const response = await this.circuitBreaker.execute(() =>
      fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.api+json',
          ...options.headers,
        },
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Outreach API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors && errorJson.errors[0]) {
          errorMessage = errorJson.errors[0].detail || errorJson.errors[0].title;
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // ============================================
  // Sequence Operations (FR-2)
  // ============================================

  /**
   * List available sequences from Outreach
   */
  async listSequences(
    userId: string,
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<OutreachSequence[]> {
    // Check cache
    const cacheKey = `sequences:${userId}`;
    const cached = this.sequenceCache.get(cacheKey);
    if (cached && cached.expiry > new Date() && !options.forceRefresh) {
      return cached.data;
    }

    const limit = options.limit || 100;
    const response = await this.request<OutreachApiResponse<Array<{
      id: number;
      type: string;
      attributes: Record<string, unknown>;
    }>>>(userId, `/sequences?page[limit]=${limit}&sort=-updatedAt`);

    const sequences: OutreachSequence[] = response.data.map(seq => ({
      id: seq.id,
      name: seq.attributes.name as string,
      description: seq.attributes.description as string | undefined,
      sequenceType: seq.attributes.sequenceType as OutreachSequence['sequenceType'],
      stepCount: seq.attributes.stepCount as number || 0,
      bounceCount: seq.attributes.bounceCount as number || 0,
      clickCount: seq.attributes.clickCount as number || 0,
      deliverCount: seq.attributes.deliverCount as number || 0,
      failureCount: seq.attributes.failureCount as number || 0,
      negativeReplyCount: seq.attributes.negativeReplyCount as number || 0,
      neutralReplyCount: seq.attributes.neutralReplyCount as number || 0,
      openCount: seq.attributes.openCount as number || 0,
      optOutCount: seq.attributes.optOutCount as number || 0,
      positiveReplyCount: seq.attributes.positiveReplyCount as number || 0,
      replyCount: seq.attributes.replyCount as number || 0,
      scheduleCount: seq.attributes.scheduleCount as number || 0,
      enabled: seq.attributes.enabled as boolean || false,
      locked: seq.attributes.locked as boolean || false,
      createdAt: new Date(seq.attributes.createdAt as string),
      updatedAt: new Date(seq.attributes.updatedAt as string),
      tags: seq.attributes.tags as string[] | undefined,
    }));

    // Update cache
    this.sequenceCache.set(cacheKey, {
      data: sequences,
      expiry: new Date(Date.now() + SEQUENCE_CACHE_TTL),
    });

    return sequences;
  }

  /**
   * Get a specific sequence by ID
   */
  async getSequence(userId: string, sequenceId: number): Promise<OutreachSequence | null> {
    try {
      const response = await this.request<OutreachApiResponse<{
        id: number;
        type: string;
        attributes: Record<string, unknown>;
      }>>(userId, `/sequences/${sequenceId}`);

      const seq = response.data;
      return {
        id: seq.id,
        name: seq.attributes.name as string,
        description: seq.attributes.description as string | undefined,
        sequenceType: seq.attributes.sequenceType as OutreachSequence['sequenceType'],
        stepCount: seq.attributes.stepCount as number || 0,
        bounceCount: seq.attributes.bounceCount as number || 0,
        clickCount: seq.attributes.clickCount as number || 0,
        deliverCount: seq.attributes.deliverCount as number || 0,
        failureCount: seq.attributes.failureCount as number || 0,
        negativeReplyCount: seq.attributes.negativeReplyCount as number || 0,
        neutralReplyCount: seq.attributes.neutralReplyCount as number || 0,
        openCount: seq.attributes.openCount as number || 0,
        optOutCount: seq.attributes.optOutCount as number || 0,
        positiveReplyCount: seq.attributes.positiveReplyCount as number || 0,
        replyCount: seq.attributes.replyCount as number || 0,
        scheduleCount: seq.attributes.scheduleCount as number || 0,
        enabled: seq.attributes.enabled as boolean || false,
        locked: seq.attributes.locked as boolean || false,
        createdAt: new Date(seq.attributes.createdAt as string),
        updatedAt: new Date(seq.attributes.updatedAt as string),
        tags: seq.attributes.tags as string[] | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get sequence metrics
   */
  async getSequenceMetrics(userId: string, sequenceId: number): Promise<SequenceMetrics | null> {
    const sequence = await this.getSequence(userId, sequenceId);
    if (!sequence) return null;

    // Get sequence states for counts
    const response = await this.request<OutreachApiResponse<Array<{
      id: number;
      attributes: { state: string };
    }>>>(userId, `/sequenceStates?filter[sequence][id]=${sequenceId}&page[limit]=1000`);

    const states = response.data.map(s => s.attributes.state);
    const activeCount = states.filter(s => s === 'active').length;
    const pausedCount = states.filter(s => s === 'paused').length;
    const completedCount = states.filter(s => s === 'finished').length;
    const bouncedCount = states.filter(s => s === 'bounced').length;

    return {
      sequenceId,
      enrolledCount: states.length,
      activeCount,
      pausedCount,
      completedCount,
      bouncedCount,
      repliedCount: sequence.replyCount,
      openRate: sequence.deliverCount > 0 ? (sequence.openCount / sequence.deliverCount) * 100 : 0,
      clickRate: sequence.deliverCount > 0 ? (sequence.clickCount / sequence.deliverCount) * 100 : 0,
      replyRate: sequence.deliverCount > 0 ? (sequence.replyCount / sequence.deliverCount) * 100 : 0,
    };
  }

  // ============================================
  // Prospect Operations (FR-3)
  // ============================================

  /**
   * Create a prospect in Outreach
   */
  async createProspect(
    userId: string,
    prospect: CreateProspectRequest
  ): Promise<OutreachProspect> {
    const payload = {
      data: {
        type: 'prospect',
        attributes: {
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          emails: prospect.emails || [prospect.email],
          title: prospect.title,
          company: prospect.company,
          workPhones: prospect.phone ? [prospect.phone] : undefined,
          mobilePhones: prospect.mobilePhone ? [prospect.mobilePhone] : undefined,
          linkedInUrl: prospect.linkedInUrl,
          custom1: prospect.customFields?.custom1,
          custom2: prospect.customFields?.custom2,
        },
        relationships: prospect.accountId ? {
          account: {
            data: { type: 'account', id: prospect.accountId },
          },
        } : undefined,
      },
    };

    const response = await this.request<OutreachApiResponse<{
      id: number;
      attributes: Record<string, unknown>;
    }>>(userId, '/prospects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const p = response.data;
    return {
      id: p.id,
      firstName: p.attributes.firstName as string,
      lastName: p.attributes.lastName as string,
      email: (p.attributes.emails as string[])?.[0] || '',
      emails: p.attributes.emails as string[],
      title: p.attributes.title as string | undefined,
      company: p.attributes.company as string | undefined,
      phone: (p.attributes.workPhones as string[])?.[0],
      mobilePhone: (p.attributes.mobilePhones as string[])?.[0],
      linkedInUrl: p.attributes.linkedInUrl as string | undefined,
      createdAt: new Date(p.attributes.createdAt as string),
      updatedAt: new Date(p.attributes.updatedAt as string),
    };
  }

  /**
   * Find a prospect by email
   */
  async findProspectByEmail(userId: string, email: string): Promise<OutreachProspect | null> {
    try {
      const response = await this.request<OutreachApiResponse<Array<{
        id: number;
        attributes: Record<string, unknown>;
      }>>>(userId, `/prospects?filter[emails]=${encodeURIComponent(email)}`);

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const p = response.data[0];
      return {
        id: p.id,
        firstName: p.attributes.firstName as string,
        lastName: p.attributes.lastName as string,
        email: (p.attributes.emails as string[])?.[0] || '',
        emails: p.attributes.emails as string[],
        title: p.attributes.title as string | undefined,
        company: p.attributes.company as string | undefined,
        phone: (p.attributes.workPhones as string[])?.[0],
        mobilePhone: (p.attributes.mobilePhones as string[])?.[0],
        linkedInUrl: p.attributes.linkedInUrl as string | undefined,
        createdAt: new Date(p.attributes.createdAt as string),
        updatedAt: new Date(p.attributes.updatedAt as string),
      };
    } catch {
      return null;
    }
  }

  /**
   * Update a prospect
   */
  async updateProspect(
    userId: string,
    prospectId: number,
    updates: Partial<CreateProspectRequest>
  ): Promise<OutreachProspect> {
    const payload = {
      data: {
        type: 'prospect',
        id: prospectId,
        attributes: {
          firstName: updates.firstName,
          lastName: updates.lastName,
          emails: updates.emails || (updates.email ? [updates.email] : undefined),
          title: updates.title,
          company: updates.company,
          workPhones: updates.phone ? [updates.phone] : undefined,
          mobilePhones: updates.mobilePhone ? [updates.mobilePhone] : undefined,
          linkedInUrl: updates.linkedInUrl,
        },
      },
    };

    // Remove undefined values
    Object.keys(payload.data.attributes).forEach(key => {
      if ((payload.data.attributes as Record<string, unknown>)[key] === undefined) {
        delete (payload.data.attributes as Record<string, unknown>)[key];
      }
    });

    const response = await this.request<OutreachApiResponse<{
      id: number;
      attributes: Record<string, unknown>;
    }>>(userId, `/prospects/${prospectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    const p = response.data;
    return {
      id: p.id,
      firstName: p.attributes.firstName as string,
      lastName: p.attributes.lastName as string,
      email: (p.attributes.emails as string[])?.[0] || '',
      emails: p.attributes.emails as string[],
      title: p.attributes.title as string | undefined,
      company: p.attributes.company as string | undefined,
      phone: (p.attributes.workPhones as string[])?.[0],
      mobilePhone: (p.attributes.mobilePhones as string[])?.[0],
      linkedInUrl: p.attributes.linkedInUrl as string | undefined,
      createdAt: new Date(p.attributes.createdAt as string),
      updatedAt: new Date(p.attributes.updatedAt as string),
    };
  }

  /**
   * Sync a stakeholder to Outreach as a prospect
   */
  async syncStakeholderToProspect(
    userId: string,
    stakeholder: {
      id: string;
      name: string;
      email: string;
      role?: string;
      phone?: string;
      linkedinUrl?: string;
      customerId: string;
      customerName?: string;
    }
  ): Promise<OutreachProspect> {
    // Check if prospect already exists
    let prospect = await this.findProspectByEmail(userId, stakeholder.email);

    const nameParts = stakeholder.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const prospectData: CreateProspectRequest = {
      firstName,
      lastName,
      email: stakeholder.email,
      title: stakeholder.role,
      company: stakeholder.customerName,
      phone: stakeholder.phone,
      linkedInUrl: stakeholder.linkedinUrl,
      customFields: {
        custom1: stakeholder.customerId, // CSCX Customer ID
        custom2: stakeholder.id, // CSCX Stakeholder ID
      },
    };

    if (prospect) {
      // Update existing prospect
      prospect = await this.updateProspect(userId, prospect.id, prospectData);
    } else {
      // Create new prospect
      prospect = await this.createProspect(userId, prospectData);
    }

    // Save mapping to database
    await this.saveProspectMapping(userId, stakeholder.id, prospect.id);

    return prospect;
  }

  private async saveProspectMapping(
    userId: string,
    stakeholderId: string,
    outreachProspectId: number
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('outreach_prospect_mappings').upsert({
      user_id: userId,
      stakeholder_id: stakeholderId,
      outreach_prospect_id: outreachProspectId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stakeholder_id',
    });
  }

  async getProspectIdForStakeholder(
    userId: string,
    stakeholderId: string
  ): Promise<number | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('outreach_prospect_mappings')
      .select('outreach_prospect_id')
      .eq('stakeholder_id', stakeholderId)
      .single();

    return data?.outreach_prospect_id || null;
  }

  // ============================================
  // Sequence Enrollment Operations (FR-4)
  // ============================================

  /**
   * Enroll a prospect in a sequence
   */
  async enrollProspect(
    userId: string,
    request: EnrollProspectRequest
  ): Promise<OutreachSequenceState> {
    const payload = {
      data: {
        type: 'sequenceState',
        relationships: {
          prospect: {
            data: { type: 'prospect', id: request.prospectId },
          },
          sequence: {
            data: { type: 'sequence', id: request.sequenceId },
          },
          ...(request.mailboxId ? {
            mailbox: {
              data: { type: 'mailbox', id: request.mailboxId },
            },
          } : {}),
        },
      },
    };

    const response = await withRetry(
      () => this.request<OutreachApiResponse<{
        id: number;
        attributes: Record<string, unknown>;
      }>>(userId, '/sequenceStates', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      {
        ...retryStrategies.aiService,
        retryableErrors: ['rate limit', '429', '503', 'timeout'],
        onRetry: (attempt, error) => {
          console.log(`[OutreachService] Enrollment retry ${attempt}: ${error.message}`);
        },
      }
    );

    const state = response.data;
    return {
      id: state.id,
      prospectId: request.prospectId,
      sequenceId: request.sequenceId,
      state: (state.attributes.state as SequenceStateStatus) || 'active',
      activeAt: state.attributes.activeAt ? new Date(state.attributes.activeAt as string) : undefined,
      clickCount: state.attributes.clickCount as number || 0,
      deliverCount: state.attributes.deliverCount as number || 0,
      openCount: state.attributes.openCount as number || 0,
      replyCount: state.attributes.replyCount as number || 0,
      bounceCount: state.attributes.bounceCount as number || 0,
      createdAt: new Date(state.attributes.createdAt as string),
      updatedAt: new Date(state.attributes.updatedAt as string),
    };
  }

  /**
   * Pause a prospect in a sequence
   */
  async pauseSequenceState(
    userId: string,
    sequenceStateId: number
  ): Promise<OutreachSequenceState> {
    const payload = {
      data: {
        type: 'sequenceState',
        id: sequenceStateId,
        attributes: {
          state: 'paused',
        },
      },
    };

    const response = await this.request<OutreachApiResponse<{
      id: number;
      attributes: Record<string, unknown>;
    }>>(userId, `/sequenceStates/${sequenceStateId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    const state = response.data;
    return {
      id: state.id,
      prospectId: 0, // Not returned in update
      sequenceId: 0, // Not returned in update
      state: state.attributes.state as SequenceStateStatus,
      pausedAt: new Date(),
      clickCount: state.attributes.clickCount as number || 0,
      deliverCount: state.attributes.deliverCount as number || 0,
      openCount: state.attributes.openCount as number || 0,
      replyCount: state.attributes.replyCount as number || 0,
      bounceCount: state.attributes.bounceCount as number || 0,
      createdAt: new Date(state.attributes.createdAt as string),
      updatedAt: new Date(state.attributes.updatedAt as string),
    };
  }

  /**
   * Resume a paused sequence state
   */
  async resumeSequenceState(
    userId: string,
    sequenceStateId: number
  ): Promise<OutreachSequenceState> {
    const payload = {
      data: {
        type: 'sequenceState',
        id: sequenceStateId,
        attributes: {
          state: 'active',
        },
      },
    };

    const response = await this.request<OutreachApiResponse<{
      id: number;
      attributes: Record<string, unknown>;
    }>>(userId, `/sequenceStates/${sequenceStateId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    const state = response.data;
    return {
      id: state.id,
      prospectId: 0,
      sequenceId: 0,
      state: state.attributes.state as SequenceStateStatus,
      activeAt: new Date(),
      clickCount: state.attributes.clickCount as number || 0,
      deliverCount: state.attributes.deliverCount as number || 0,
      openCount: state.attributes.openCount as number || 0,
      replyCount: state.attributes.replyCount as number || 0,
      bounceCount: state.attributes.bounceCount as number || 0,
      createdAt: new Date(state.attributes.createdAt as string),
      updatedAt: new Date(state.attributes.updatedAt as string),
    };
  }

  /**
   * Remove a prospect from a sequence
   */
  async removeFromSequence(userId: string, sequenceStateId: number): Promise<void> {
    await this.request(userId, `/sequenceStates/${sequenceStateId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get sequence states for a prospect
   */
  async getProspectSequenceStates(
    userId: string,
    prospectId: number
  ): Promise<OutreachSequenceState[]> {
    const response = await this.request<OutreachApiResponse<Array<{
      id: number;
      attributes: Record<string, unknown>;
      relationships?: {
        sequence?: { data?: { id: number } };
      };
    }>>>(userId, `/sequenceStates?filter[prospect][id]=${prospectId}`);

    return response.data.map(state => ({
      id: state.id,
      prospectId,
      sequenceId: state.relationships?.sequence?.data?.id || 0,
      state: state.attributes.state as SequenceStateStatus,
      activeAt: state.attributes.activeAt ? new Date(state.attributes.activeAt as string) : undefined,
      pausedAt: state.attributes.pausedAt ? new Date(state.attributes.pausedAt as string) : undefined,
      finishedAt: state.attributes.finishedAt ? new Date(state.attributes.finishedAt as string) : undefined,
      errorReason: state.attributes.errorReason as string | undefined,
      clickCount: state.attributes.clickCount as number || 0,
      deliverCount: state.attributes.deliverCount as number || 0,
      openCount: state.attributes.openCount as number || 0,
      replyCount: state.attributes.replyCount as number || 0,
      bounceCount: state.attributes.bounceCount as number || 0,
      createdAt: new Date(state.attributes.createdAt as string),
      updatedAt: new Date(state.attributes.updatedAt as string),
    }));
  }

  // ============================================
  // Trigger Mappings (FR-5)
  // ============================================

  /**
   * Create or update a trigger-sequence mapping
   */
  async createMapping(
    userId: string,
    mapping: CreateMappingRequest
  ): Promise<OutreachMapping> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const id = uuidv4();
    const now = new Date();

    const { data, error } = await this.supabase
      .from('outreach_mappings')
      .insert({
        id,
        user_id: userId,
        trigger_type: mapping.triggerType,
        sequence_id: mapping.sequenceId,
        sequence_name: mapping.sequenceName,
        stakeholder_roles: mapping.stakeholderRoles || [],
        segment_filter: mapping.segmentFilter,
        health_threshold: mapping.healthThreshold,
        days_before_renewal: mapping.daysBeforeRenewal,
        enabled: mapping.enabled ?? true,
        requires_approval: mapping.requiresApproval ?? true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      triggerType: data.trigger_type,
      sequenceId: data.sequence_id,
      sequenceName: data.sequence_name,
      stakeholderRoles: data.stakeholder_roles,
      segmentFilter: data.segment_filter,
      healthThreshold: data.health_threshold,
      daysBeforeRenewal: data.days_before_renewal,
      enabled: data.enabled,
      requiresApproval: data.requires_approval,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * List all trigger mappings
   */
  async listMappings(userId: string): Promise<OutreachMapping[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('outreach_mappings')
      .select('*')
      .eq('user_id', userId)
      .order('trigger_type');

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      triggerType: row.trigger_type,
      sequenceId: row.sequence_id,
      sequenceName: row.sequence_name,
      stakeholderRoles: row.stakeholder_roles,
      segmentFilter: row.segment_filter,
      healthThreshold: row.health_threshold,
      daysBeforeRenewal: row.days_before_renewal,
      enabled: row.enabled,
      requiresApproval: row.requires_approval,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Update a mapping
   */
  async updateMapping(
    userId: string,
    mappingId: string,
    updates: Partial<CreateMappingRequest>
  ): Promise<OutreachMapping> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const { data, error } = await this.supabase
      .from('outreach_mappings')
      .update({
        trigger_type: updates.triggerType,
        sequence_id: updates.sequenceId,
        sequence_name: updates.sequenceName,
        stakeholder_roles: updates.stakeholderRoles,
        segment_filter: updates.segmentFilter,
        health_threshold: updates.healthThreshold,
        days_before_renewal: updates.daysBeforeRenewal,
        enabled: updates.enabled,
        requires_approval: updates.requiresApproval,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mappingId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      triggerType: data.trigger_type,
      sequenceId: data.sequence_id,
      sequenceName: data.sequence_name,
      stakeholderRoles: data.stakeholder_roles,
      segmentFilter: data.segment_filter,
      healthThreshold: data.health_threshold,
      daysBeforeRenewal: data.days_before_renewal,
      enabled: data.enabled,
      requiresApproval: data.requires_approval,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Delete a mapping
   */
  async deleteMapping(userId: string, mappingId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const { error } = await this.supabase
      .from('outreach_mappings')
      .delete()
      .eq('id', mappingId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Get mappings for a specific trigger type
   */
  async getMappingsForTrigger(
    userId: string,
    triggerType: OutreachTriggerType
  ): Promise<OutreachMapping[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('outreach_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('trigger_type', triggerType)
      .eq('enabled', true);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      triggerType: row.trigger_type,
      sequenceId: row.sequence_id,
      sequenceName: row.sequence_name,
      stakeholderRoles: row.stakeholder_roles,
      segmentFilter: row.segment_filter,
      healthThreshold: row.health_threshold,
      daysBeforeRenewal: row.days_before_renewal,
      enabled: row.enabled,
      requiresApproval: row.requires_approval,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // ============================================
  // Enrollment Management
  // ============================================

  /**
   * Enroll a stakeholder in a sequence
   */
  async enrollStakeholder(
    userId: string,
    request: EnrollStakeholderRequest,
    stakeholderData: {
      name: string;
      email: string;
      role?: string;
      customerId: string;
      customerName?: string;
    }
  ): Promise<OutreachEnrollment> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Get or create prospect in Outreach
    const prospect = await this.syncStakeholderToProspect(userId, {
      id: request.stakeholderId,
      ...stakeholderData,
    });

    // Get sequence info
    const sequence = await this.getSequence(userId, request.sequenceId);
    if (!sequence) {
      throw new Error('Sequence not found');
    }

    // Check if approval is required
    const mapping = request.triggerType
      ? (await this.getMappingsForTrigger(userId, request.triggerType))[0]
      : null;

    const requiresApproval = !request.skipApproval && (mapping?.requiresApproval ?? true);

    const enrollmentId = uuidv4();
    const now = new Date();

    const enrollment: OutreachEnrollment = {
      id: enrollmentId,
      stakeholderId: request.stakeholderId,
      customerId: stakeholderData.customerId,
      outreachProspectId: prospect.id,
      sequenceId: request.sequenceId,
      sequenceName: sequence.name,
      status: requiresApproval ? 'pending_approval' : 'enrolled',
      triggerType: request.triggerType,
      triggeredBy: userId,
      enrolledAt: requiresApproval ? undefined : now,
      createdAt: now,
      updatedAt: now,
    };

    // Save enrollment record
    await this.supabase.from('outreach_enrollments').insert({
      id: enrollment.id,
      user_id: userId,
      stakeholder_id: enrollment.stakeholderId,
      customer_id: enrollment.customerId,
      outreach_prospect_id: enrollment.outreachProspectId,
      sequence_id: enrollment.sequenceId,
      sequence_name: enrollment.sequenceName,
      status: enrollment.status,
      trigger_type: enrollment.triggerType,
      triggered_by: enrollment.triggeredBy,
      enrolled_at: enrollment.enrolledAt?.toISOString(),
      created_at: enrollment.createdAt.toISOString(),
      updated_at: enrollment.updatedAt.toISOString(),
    });

    // If no approval needed, enroll immediately
    if (!requiresApproval) {
      try {
        const sequenceState = await this.enrollProspect(userId, {
          prospectId: prospect.id,
          sequenceId: request.sequenceId,
          mailboxId: request.mailboxId,
        });

        // Update enrollment with sequence state
        await this.supabase
          .from('outreach_enrollments')
          .update({
            sequence_state_id: sequenceState.id,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollmentId);

        enrollment.sequenceStateId = sequenceState.id;
        enrollment.status = 'active';
      } catch (error) {
        // Mark as failed
        await this.supabase
          .from('outreach_enrollments')
          .update({
            status: 'failed',
            error_message: (error as Error).message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollmentId);

        enrollment.status = 'failed';
        enrollment.errorMessage = (error as Error).message;
      }
    }

    return enrollment;
  }

  /**
   * Approve a pending enrollment
   */
  async approveEnrollment(
    userId: string,
    enrollmentId: string,
    approvedBy: string
  ): Promise<OutreachEnrollment> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Get enrollment
    const { data: enrollmentData, error: fetchError } = await this.supabase
      .from('outreach_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (fetchError || !enrollmentData) {
      throw new Error('Enrollment not found');
    }

    if (enrollmentData.status !== 'pending_approval') {
      throw new Error('Enrollment is not pending approval');
    }

    // Enroll in Outreach
    try {
      const sequenceState = await this.enrollProspect(userId, {
        prospectId: enrollmentData.outreach_prospect_id,
        sequenceId: enrollmentData.sequence_id,
      });

      // Update enrollment
      const { data, error } = await this.supabase
        .from('outreach_enrollments')
        .update({
          status: 'active',
          sequence_state_id: sequenceState.id,
          approved_by: approvedBy,
          enrolled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)
        .select()
        .single();

      if (error) throw error;

      return this.mapEnrollmentRow(data);
    } catch (error) {
      // Mark as failed
      await this.supabase
        .from('outreach_enrollments')
        .update({
          status: 'failed',
          error_message: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      throw error;
    }
  }

  /**
   * Reject a pending enrollment
   */
  async rejectEnrollment(
    userId: string,
    enrollmentId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<OutreachEnrollment> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const { data, error } = await this.supabase
      .from('outreach_enrollments')
      .update({
        status: 'rejected',
        approved_by: rejectedBy, // Using same field for auditing
        error_message: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .eq('status', 'pending_approval')
      .select()
      .single();

    if (error) throw error;

    return this.mapEnrollmentRow(data);
  }

  /**
   * Pause an active enrollment
   */
  async pauseEnrollment(userId: string, enrollmentId: string): Promise<OutreachEnrollment> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Get enrollment
    const { data: enrollmentData } = await this.supabase
      .from('outreach_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (!enrollmentData || !enrollmentData.sequence_state_id) {
      throw new Error('Enrollment not found or not active');
    }

    // Pause in Outreach
    await this.pauseSequenceState(userId, enrollmentData.sequence_state_id);

    // Update local record
    const { data, error } = await this.supabase
      .from('outreach_enrollments')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) throw error;

    return this.mapEnrollmentRow(data);
  }

  /**
   * Resume a paused enrollment
   */
  async resumeEnrollment(userId: string, enrollmentId: string): Promise<OutreachEnrollment> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Get enrollment
    const { data: enrollmentData } = await this.supabase
      .from('outreach_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (!enrollmentData || !enrollmentData.sequence_state_id) {
      throw new Error('Enrollment not found');
    }

    // Resume in Outreach
    await this.resumeSequenceState(userId, enrollmentData.sequence_state_id);

    // Update local record
    const { data, error } = await this.supabase
      .from('outreach_enrollments')
      .update({
        status: 'active',
        paused_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) throw error;

    return this.mapEnrollmentRow(data);
  }

  /**
   * Remove a stakeholder from a sequence
   */
  async removeEnrollment(userId: string, enrollmentId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Get enrollment
    const { data: enrollmentData } = await this.supabase
      .from('outreach_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (!enrollmentData) {
      throw new Error('Enrollment not found');
    }

    // Remove from Outreach if there's a sequence state
    if (enrollmentData.sequence_state_id) {
      try {
        await this.removeFromSequence(userId, enrollmentData.sequence_state_id);
      } catch (error) {
        console.warn('[OutreachService] Failed to remove from Outreach:', error);
      }
    }

    // Delete local record
    await this.supabase
      .from('outreach_enrollments')
      .delete()
      .eq('id', enrollmentId);
  }

  // ============================================
  // Status Tracking (FR-6)
  // ============================================

  /**
   * Get sequence status for a stakeholder
   */
  async getStakeholderStatus(
    userId: string,
    stakeholderId: string
  ): Promise<StakeholderSequenceStatus | null> {
    if (!this.supabase) return null;

    // Get stakeholder info
    const { data: stakeholder } = await this.supabase
      .from('stakeholders')
      .select('id, name, email')
      .eq('id', stakeholderId)
      .single();

    if (!stakeholder) return null;

    // Get prospect ID
    const prospectId = await this.getProspectIdForStakeholder(userId, stakeholderId);

    // Get enrollments
    const { data: enrollments } = await this.supabase
      .from('outreach_enrollments')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .order('created_at', { ascending: false });

    const activeSequences: StakeholderSequenceStatus['activeSequences'] = [];
    const completedSequences: StakeholderSequenceStatus['completedSequences'] = [];
    const pendingEnrollments: StakeholderSequenceStatus['pendingEnrollments'] = [];

    for (const enrollment of enrollments || []) {
      if (enrollment.status === 'pending_approval') {
        pendingEnrollments.push({
          sequenceId: enrollment.sequence_id,
          sequenceName: enrollment.sequence_name,
          requestedAt: new Date(enrollment.created_at),
          triggerType: enrollment.trigger_type,
        });
      } else if (['active', 'paused'].includes(enrollment.status)) {
        activeSequences.push({
          sequenceId: enrollment.sequence_id,
          sequenceName: enrollment.sequence_name,
          status: enrollment.status as SequenceStateStatus,
          enrolledAt: new Date(enrollment.enrolled_at),
          lastActivityAt: new Date(enrollment.updated_at),
        });
      } else if (enrollment.status === 'completed') {
        completedSequences.push({
          sequenceId: enrollment.sequence_id,
          sequenceName: enrollment.sequence_name,
          completedAt: new Date(enrollment.completed_at),
        });
      }
    }

    return {
      stakeholderId,
      stakeholderName: stakeholder.name,
      stakeholderEmail: stakeholder.email,
      outreachProspectId: prospectId || undefined,
      activeSequences,
      completedSequences,
      pendingEnrollments,
    };
  }

  /**
   * Sync status from Outreach for all active enrollments
   */
  async syncEnrollmentStatus(userId: string): Promise<number> {
    if (!this.supabase) return 0;

    // Get active enrollments
    const { data: enrollments } = await this.supabase
      .from('outreach_enrollments')
      .select('*')
      .in('status', ['active', 'paused'])
      .not('sequence_state_id', 'is', null);

    if (!enrollments || enrollments.length === 0) return 0;

    let updated = 0;

    for (const enrollment of enrollments) {
      try {
        // Get current state from Outreach
        const states = await this.getProspectSequenceStates(
          userId,
          enrollment.outreach_prospect_id
        );

        const state = states.find(s => s.id === enrollment.sequence_state_id);
        if (!state) continue;

        // Map Outreach state to our status
        let newStatus: EnrollmentStatus = enrollment.status;
        let completedAt: Date | null = null;

        switch (state.state) {
          case 'finished':
            newStatus = 'completed';
            completedAt = state.finishedAt || new Date();
            break;
          case 'bounced':
            newStatus = 'bounced';
            break;
          case 'opted_out':
            newStatus = 'opted_out';
            break;
          case 'paused':
            newStatus = 'paused';
            break;
          case 'active':
            newStatus = 'active';
            break;
        }

        if (newStatus !== enrollment.status) {
          await this.supabase
            .from('outreach_enrollments')
            .update({
              status: newStatus,
              completed_at: completedAt?.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);

          updated++;
        }
      } catch (error) {
        console.error(`[OutreachService] Failed to sync enrollment ${enrollment.id}:`, error);
      }
    }

    return updated;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapEnrollmentRow(row: Record<string, unknown>): OutreachEnrollment {
    return {
      id: row.id as string,
      stakeholderId: row.stakeholder_id as string,
      customerId: row.customer_id as string,
      outreachProspectId: row.outreach_prospect_id as number,
      sequenceId: row.sequence_id as number,
      sequenceName: row.sequence_name as string,
      sequenceStateId: row.sequence_state_id as number | undefined,
      status: row.status as EnrollmentStatus,
      triggerType: row.trigger_type as OutreachTriggerType | undefined,
      triggeredBy: row.triggered_by as string | undefined,
      approvedBy: row.approved_by as string | undefined,
      enrolledAt: row.enrolled_at ? new Date(row.enrolled_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      pausedAt: row.paused_at ? new Date(row.paused_at as string) : undefined,
      errorMessage: row.error_message as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Clear sequence cache
   */
  clearCache(): void {
    this.sequenceCache.clear();
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Health check
   */
  async healthCheck(userId: string): Promise<boolean> {
    return outreachOAuth.validateConnection(userId);
  }
}

// Singleton instance
export const outreachService = new OutreachService();

// Re-export OAuth service and types
export { outreachOAuth } from './oauth.js';
export * from './types.js';
