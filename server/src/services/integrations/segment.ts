/**
 * Segment Integration Service - PRD-198
 *
 * Implements Segment.io data sync:
 * - Webhook-based event ingestion
 * - Track, Identify, Group call processing
 * - Identity resolution and customer matching
 * - Event to CSCX signal mapping
 * - Real-time health score updates
 * - Dead letter queue for failed events
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import crypto from 'crypto';
import { EventEmitter } from 'events';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for database operations
const segmentCircuitBreaker = new CircuitBreaker('segment', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000 // 30 seconds
});

// Event emitter for real-time notifications
export const segmentEventEmitter = new EventEmitter();

// ============================================
// Types
// ============================================

export interface SegmentEvent {
  type: 'track' | 'identify' | 'group' | 'page' | 'screen' | 'alias';
  messageId?: string;
  userId?: string;
  anonymousId?: string;
  event?: string; // For track events
  properties?: Record<string, unknown>;
  traits?: Record<string, unknown>;
  groupId?: string;
  context?: {
    groupId?: string;
    ip?: string;
    userAgent?: string;
    locale?: string;
    timezone?: string;
    campaign?: Record<string, string>;
    device?: Record<string, string>;
    app?: Record<string, string>;
    [key: string]: unknown;
  };
  timestamp?: string;
  sentAt?: string;
  receivedAt?: string;
  integrations?: Record<string, boolean | object>;
}

export interface SegmentMapping {
  id: string;
  segmentEvent: string;
  cscxSignalType: string;
  propertyMappings: Record<string, string>;
  conditions?: {
    property: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists';
    value?: unknown;
  }[];
  signalPriority: 'low' | 'medium' | 'high' | 'critical';
  triggerHealthUpdate: boolean;
  triggerAlert: boolean;
  enabled: boolean;
}

export interface SegmentConnection {
  id: string;
  userId: string;
  writeKey: string;
  webhookSecret: string;
  enabled: boolean;
  processIdentify: boolean;
  processGroup: boolean;
  processTrack: boolean;
  matchByEmail: boolean;
  matchByUserId: boolean;
  matchByGroupId: boolean;
  createUnknownUsers: boolean;
  eventsReceived: number;
  eventsProcessed: number;
  eventsFailed: number;
  lastEventAt?: Date;
}

export interface ProcessingResult {
  success: boolean;
  eventId?: string;
  customerId?: string;
  signalType?: string;
  error?: string;
  healthUpdated?: boolean;
  alertTriggered?: boolean;
}

export interface EventStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
  bySignal: Record<string, number>;
}

// ============================================
// Segment Service Class
// ============================================

export class SegmentService {
  private maxRetries = 3;
  private processingLatencyTarget = 500; // ms

  /**
   * Check if Segment integration is configured
   */
  isConfigured(): boolean {
    return Boolean(supabase);
  }

  /**
   * Generate a new write key for a user
   */
  generateWriteKey(): string {
    return `cscx_seg_${crypto.randomBytes(24).toString('base64url')}`;
  }

  /**
   * Generate webhook secret for signature verification
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create or get Segment connection for a user
   */
  async getOrCreateConnection(userId: string): Promise<SegmentConnection> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    // Check if connection exists
    const { data: existing } = await supabase
      .from('segment_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return this.mapConnectionFromDb(existing);
    }

    // Create new connection
    const writeKey = this.generateWriteKey();
    const webhookSecret = this.generateWebhookSecret();

    const { data, error } = await supabase
      .from('segment_connections')
      .insert({
        user_id: userId,
        write_key: writeKey,
        webhook_secret: webhookSecret,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create Segment connection: ${error.message}`);
    }

    return this.mapConnectionFromDb(data);
  }

  /**
   * Get connection by write key (for webhook validation)
   */
  async getConnectionByWriteKey(writeKey: string): Promise<SegmentConnection | null> {
    if (!supabase) return null;

    const { data } = await supabase
      .from('segment_connections')
      .select('*')
      .eq('write_key', writeKey)
      .eq('enabled', true)
      .single();

    return data ? this.mapConnectionFromDb(data) : null;
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(
    event: SegmentEvent,
    connection: SegmentConnection
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Check if we should process this event type
      if (!this.shouldProcessEventType(event.type, connection)) {
        return { success: true, eventId: event.messageId };
      }

      // Check for duplicate (idempotency)
      if (event.messageId && await this.isDuplicateEvent(event.messageId)) {
        return { success: true, eventId: event.messageId, error: 'duplicate' };
      }

      // Store the event
      const storedEvent = await this.storeEvent(event, connection.userId);

      // Resolve identity
      const { customerId, stakeholderId } = await this.resolveIdentity(event, connection);

      // Update stored event with customer ID
      if (customerId && storedEvent.id) {
        await this.updateEventCustomerId(storedEvent.id, customerId);
      }

      // Process based on event type
      let result: ProcessingResult;
      switch (event.type) {
        case 'track':
          result = await this.processTrackEvent(event, customerId, storedEvent.id);
          break;
        case 'identify':
          result = await this.processIdentifyEvent(event, customerId, stakeholderId, connection);
          break;
        case 'group':
          result = await this.processGroupEvent(event, customerId, connection);
          break;
        default:
          result = { success: true, eventId: storedEvent.id };
      }

      // Mark event as processed
      await this.markEventProcessed(storedEvent.id, result);

      // Update connection statistics
      await this.updateConnectionStats(connection.id, true);

      // Log processing latency
      const latency = Date.now() - startTime;
      if (latency > this.processingLatencyTarget) {
        console.warn(`[Segment] Event processing exceeded target latency: ${latency}ms > ${this.processingLatencyTarget}ms`);
      }

      // Emit real-time event
      segmentEventEmitter.emit('event:processed', {
        ...result,
        eventType: event.type,
        eventName: event.event,
        latency,
      });

      return result;
    } catch (error) {
      console.error('[Segment] Event processing error:', error);

      // Update failure stats
      await this.updateConnectionStats(connection.id, false);

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if event type should be processed based on connection settings
   */
  private shouldProcessEventType(
    eventType: string,
    connection: SegmentConnection
  ): boolean {
    switch (eventType) {
      case 'track':
      case 'page':
      case 'screen':
        return connection.processTrack;
      case 'identify':
        return connection.processIdentify;
      case 'group':
        return connection.processGroup;
      default:
        return true;
    }
  }

  /**
   * Check for duplicate event using messageId
   */
  private async isDuplicateEvent(messageId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data } = await supabase
      .from('segment_events')
      .select('id')
      .eq('message_id', messageId)
      .single();

    return Boolean(data);
  }

  /**
   * Store incoming event in database
   */
  private async storeEvent(
    event: SegmentEvent,
    userId: string
  ): Promise<{ id: string }> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabase
      .from('segment_events')
      .insert({
        event_type: event.type,
        event_name: event.event,
        message_id: event.messageId,
        user_id: event.userId,
        anonymous_id: event.anonymousId,
        group_id: event.groupId || event.context?.groupId,
        properties: event.properties || {},
        traits: event.traits || {},
        context: event.context || {},
        original_timestamp: event.timestamp,
        sent_at: event.sentAt,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to store event: ${error.message}`);
    }

    return { id: data.id };
  }

  /**
   * Update event with customer ID after identity resolution
   */
  private async updateEventCustomerId(eventId: string, customerId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('segment_events')
      .update({ customer_id: customerId })
      .eq('id', eventId);
  }

  /**
   * Resolve Segment identities to CSCX customers/stakeholders
   */
  private async resolveIdentity(
    event: SegmentEvent,
    connection: SegmentConnection
  ): Promise<{ customerId?: string; stakeholderId?: string }> {
    if (!supabase) return {};

    let customerId: string | undefined;
    let stakeholderId: string | undefined;

    // Try to find existing identity link
    const identifiers = {
      user_id: event.userId,
      anonymous_id: event.anonymousId,
      group_id: event.groupId || event.context?.groupId,
    };

    // Check identity links table
    const { data: identityLink } = await supabase
      .from('segment_identity_links')
      .select('customer_id, stakeholder_id')
      .or(
        Object.entries(identifiers)
          .filter(([_, v]) => v)
          .map(([k, v]) => `segment_${k}.eq.${v}`)
          .join(',')
      )
      .order('confidence', { ascending: false })
      .limit(1)
      .single();

    if (identityLink) {
      customerId = identityLink.customer_id;
      stakeholderId = identityLink.stakeholder_id;
    }

    // If no link found, try to match by email
    if (!customerId && connection.matchByEmail) {
      const email =
        event.traits?.email ||
        event.context?.traits?.email ||
        event.properties?.email;

      if (email && typeof email === 'string') {
        // Try to find stakeholder by email
        const { data: stakeholder } = await supabase
          .from('stakeholders')
          .select('id, customer_id')
          .eq('email', email.toLowerCase())
          .single();

        if (stakeholder) {
          stakeholderId = stakeholder.id;
          customerId = stakeholder.customer_id;

          // Create identity link for future lookups
          await this.createIdentityLink({
            segmentUserId: event.userId,
            segmentAnonymousId: event.anonymousId,
            segmentGroupId: event.groupId,
            customerId,
            stakeholderId,
            source: 'email_match',
          });
        }
      }
    }

    // Match by group ID (external_id)
    if (!customerId && connection.matchByGroupId && (event.groupId || event.context?.groupId)) {
      const groupId = event.groupId || event.context?.groupId;

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('external_id', groupId)
        .single();

      if (customer) {
        customerId = customer.id;

        // Create identity link
        await this.createIdentityLink({
          segmentUserId: event.userId,
          segmentGroupId: groupId,
          customerId,
          source: 'group_match',
        });
      }
    }

    return { customerId, stakeholderId };
  }

  /**
   * Create identity link for future lookups
   */
  private async createIdentityLink(params: {
    segmentUserId?: string;
    segmentAnonymousId?: string;
    segmentGroupId?: string;
    customerId?: string;
    stakeholderId?: string;
    source: string;
  }): Promise<void> {
    if (!supabase) return;

    await supabase.from('segment_identity_links').upsert(
      {
        segment_user_id: params.segmentUserId,
        segment_anonymous_id: params.segmentAnonymousId,
        segment_group_id: params.segmentGroupId,
        customer_id: params.customerId,
        stakeholder_id: params.stakeholderId,
        source: params.source,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'segment_user_id',
        ignoreDuplicates: false,
      }
    );
  }

  /**
   * Process track event - map to CSCX signals
   */
  private async processTrackEvent(
    event: SegmentEvent,
    customerId?: string,
    eventId?: string
  ): Promise<ProcessingResult> {
    if (!supabase || !event.event) {
      return { success: true, eventId };
    }

    // Find matching mapping
    const { data: mapping } = await supabase
      .from('segment_mappings')
      .select('*')
      .eq('segment_event', event.event)
      .eq('enabled', true)
      .single();

    if (!mapping) {
      // No mapping found, just store the event
      return { success: true, eventId };
    }

    // Check conditions
    if (mapping.conditions && !this.evaluateConditions(mapping.conditions, event.properties || {})) {
      return { success: true, eventId };
    }

    // Map properties
    const mappedData = this.mapProperties(event.properties || {}, mapping.property_mappings);

    // Update event with mapping info
    await supabase
      .from('segment_events')
      .update({
        mapped_signal_type: mapping.cscx_signal_type,
        mapped_data: mappedData,
      })
      .eq('id', eventId);

    // Trigger health score update if configured
    let healthUpdated = false;
    if (mapping.trigger_health_update && customerId) {
      await this.triggerHealthUpdate(customerId, mapping.cscx_signal_type, mappedData);
      healthUpdated = true;
    }

    // Trigger alert if configured
    let alertTriggered = false;
    if (mapping.trigger_alert && customerId) {
      await this.triggerAlert(customerId, mapping.cscx_signal_type, event.event, mappedData);
      alertTriggered = true;
    }

    return {
      success: true,
      eventId,
      customerId,
      signalType: mapping.cscx_signal_type,
      healthUpdated,
      alertTriggered,
    };
  }

  /**
   * Process identify event - update user/stakeholder data
   */
  private async processIdentifyEvent(
    event: SegmentEvent,
    customerId?: string,
    stakeholderId?: string,
    connection?: SegmentConnection
  ): Promise<ProcessingResult> {
    if (!supabase) return { success: true };

    const traits = event.traits || {};

    // Update stakeholder if found
    if (stakeholderId) {
      const updateData: Record<string, unknown> = {};

      if (traits.name) updateData.name = traits.name;
      if (traits.firstName && traits.lastName) {
        updateData.name = `${traits.firstName} ${traits.lastName}`;
      }
      if (traits.title) updateData.title = traits.title;
      if (traits.phone) updateData.phone = traits.phone;
      if (traits.avatar) updateData.avatar_url = traits.avatar;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('stakeholders')
          .update(updateData)
          .eq('id', stakeholderId);
      }
    }

    // Update identity link with latest traits
    if (event.userId || event.anonymousId) {
      await this.createIdentityLink({
        segmentUserId: event.userId,
        segmentAnonymousId: event.anonymousId,
        customerId,
        stakeholderId,
        source: 'identify_call',
      });
    }

    return { success: true, customerId, stakeholderId };
  }

  /**
   * Process group event - update account/customer data
   */
  private async processGroupEvent(
    event: SegmentEvent,
    customerId?: string,
    connection?: SegmentConnection
  ): Promise<ProcessingResult> {
    if (!supabase || !event.groupId) return { success: true };

    const traits = event.traits || {};

    // Update customer if found
    if (customerId) {
      const updateData: Record<string, unknown> = {};

      if (traits.name) updateData.name = traits.name;
      if (traits.industry) updateData.industry = traits.industry;
      if (traits.employees || traits.employee_count) {
        updateData.employee_count = traits.employees || traits.employee_count;
      }
      if (traits.plan) updateData.plan = traits.plan;
      if (traits.website) updateData.website = traits.website;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customerId);
      }
    }

    // Create/update identity link
    await this.createIdentityLink({
      segmentGroupId: event.groupId,
      segmentUserId: event.userId,
      customerId,
      source: 'group_call',
    });

    return { success: true, customerId };
  }

  /**
   * Evaluate mapping conditions
   */
  private evaluateConditions(
    conditions: Array<{ property: string; operator: string; value?: unknown }>,
    properties: Record<string, unknown>
  ): boolean {
    return conditions.every((condition) => {
      const value = properties[condition.property];

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return typeof value === 'string' && value.includes(String(condition.value));
        case 'gt':
          return typeof value === 'number' && value > Number(condition.value);
        case 'lt':
          return typeof value === 'number' && value < Number(condition.value);
        case 'exists':
          return value !== undefined && value !== null;
        default:
          return true;
      }
    });
  }

  /**
   * Map properties using mapping configuration
   */
  private mapProperties(
    properties: Record<string, unknown>,
    mappings: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [segmentKey, cscxKey] of Object.entries(mappings)) {
      if (properties[segmentKey] !== undefined) {
        result[cscxKey] = properties[segmentKey];
      }
    }

    // Include unmapped properties as well
    result._raw = properties;

    return result;
  }

  /**
   * Trigger health score update based on signal
   */
  private async triggerHealthUpdate(
    customerId: string,
    signalType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!supabase) return;

    // Get current health score
    const { data: customer } = await supabase
      .from('customers')
      .select('health_score, health_trend')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    // Calculate adjustment based on signal type
    let adjustment = 0;
    switch (signalType) {
      case 'adoption':
        adjustment = 1; // Slight positive
        break;
      case 'expansion':
        adjustment = 3; // Positive
        break;
      case 'engagement':
        adjustment = 2; // Positive
        break;
      case 'risk':
        adjustment = -5; // Negative
        break;
      default:
        adjustment = 0;
    }

    // Apply adjustment (capped at 0-100)
    const currentScore = customer.health_score || 50;
    const newScore = Math.max(0, Math.min(100, currentScore + adjustment));
    const healthTrend = adjustment > 0 ? 'improving' : adjustment < 0 ? 'declining' : 'stable';

    await supabase
      .from('customers')
      .update({
        health_score: newScore,
        health_trend: healthTrend,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    // Emit health update event
    segmentEventEmitter.emit('health:updated', {
      customerId,
      previousScore: currentScore,
      newScore,
      signalType,
      adjustment,
    });
  }

  /**
   * Trigger alert for critical signals
   */
  private async triggerAlert(
    customerId: string,
    signalType: string,
    eventName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!supabase) return;

    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('name, csm_id')
      .eq('id', customerId)
      .single();

    if (!customer) return;

    // Create alert/notification (you can customize this based on your notification system)
    console.log(`[Segment Alert] ${signalType} signal for ${customer.name}: ${eventName}`);

    // Emit alert event for real-time notifications
    segmentEventEmitter.emit('alert:triggered', {
      customerId,
      customerName: customer.name,
      csmId: customer.csm_id,
      signalType,
      eventName,
      data,
    });
  }

  /**
   * Mark event as processed
   */
  private async markEventProcessed(eventId: string, result: ProcessingResult): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('segment_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: result.error,
      })
      .eq('id', eventId);
  }

  /**
   * Update connection statistics
   */
  private async updateConnectionStats(connectionId: string, success: boolean): Promise<void> {
    if (!supabase) return;

    const incrementField = success ? 'events_processed' : 'events_failed';

    await supabase.rpc('increment_segment_stats', {
      connection_id: connectionId,
      success_field: incrementField,
    }).catch(() => {
      // Fallback if RPC not available
      supabase!.from('segment_connections')
        .update({
          events_received: supabase!.raw('events_received + 1'),
          [incrementField]: supabase!.raw(`${incrementField} + 1`),
          last_event_at: new Date().toISOString(),
        })
        .eq('id', connectionId);
    });
  }

  /**
   * Add event to dead letter queue
   */
  async addToDeadLetterQueue(
    event: SegmentEvent,
    error: string,
    eventId?: string
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('segment_dead_letter_queue').insert({
      original_event_id: eventId,
      raw_payload: event,
      error_message: error,
    });
  }

  /**
   * Get event mappings
   */
  async getMappings(): Promise<SegmentMapping[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('segment_mappings')
      .select('*')
      .order('segment_event');

    if (error) {
      throw new Error(`Failed to get mappings: ${error.message}`);
    }

    return (data || []).map(this.mapMappingFromDb);
  }

  /**
   * Update mappings
   */
  async updateMappings(mappings: Partial<SegmentMapping>[]): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    for (const mapping of mappings) {
      if (mapping.id) {
        await supabase
          .from('segment_mappings')
          .update({
            segment_event: mapping.segmentEvent,
            cscx_signal_type: mapping.cscxSignalType,
            property_mappings: mapping.propertyMappings,
            conditions: mapping.conditions,
            signal_priority: mapping.signalPriority,
            trigger_health_update: mapping.triggerHealthUpdate,
            trigger_alert: mapping.triggerAlert,
            enabled: mapping.enabled,
          })
          .eq('id', mapping.id);
      } else {
        await supabase.from('segment_mappings').insert({
          segment_event: mapping.segmentEvent,
          cscx_signal_type: mapping.cscxSignalType,
          property_mappings: mapping.propertyMappings || {},
          conditions: mapping.conditions || {},
          signal_priority: mapping.signalPriority || 'medium',
          trigger_health_update: mapping.triggerHealthUpdate ?? true,
          trigger_alert: mapping.triggerAlert ?? false,
          enabled: mapping.enabled ?? true,
        });
      }
    }
  }

  /**
   * Delete mapping
   */
  async deleteMapping(mappingId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    await supabase.from('segment_mappings').delete().eq('id', mappingId);
  }

  /**
   * Get events for a customer
   */
  async getCustomerEvents(
    customerId: string,
    options: { limit?: number; offset?: number; eventType?: string } = {}
  ): Promise<{ events: unknown[]; total: number }> {
    if (!supabase) {
      return { events: [], total: 0 };
    }

    const { limit = 50, offset = 0, eventType } = options;

    let query = supabase
      .from('segment_events')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('received_at', { ascending: false });

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }

    return { events: data || [], total: count || 0 };
  }

  /**
   * Get event statistics
   */
  async getEventStats(userId: string): Promise<EventStats> {
    if (!supabase) {
      return {
        total: 0,
        processed: 0,
        failed: 0,
        pending: 0,
        byType: {},
        bySignal: {},
      };
    }

    // Get connection stats
    const { data: connection } = await supabase
      .from('segment_connections')
      .select('events_received, events_processed, events_failed')
      .eq('user_id', userId)
      .single();

    // Get breakdown by type
    const { data: typeStats } = await supabase
      .from('segment_events')
      .select('event_type')
      .eq('processed', true);

    const byType: Record<string, number> = {};
    typeStats?.forEach((e) => {
      byType[e.event_type] = (byType[e.event_type] || 0) + 1;
    });

    // Get breakdown by signal
    const { data: signalStats } = await supabase
      .from('segment_events')
      .select('mapped_signal_type')
      .not('mapped_signal_type', 'is', null);

    const bySignal: Record<string, number> = {};
    signalStats?.forEach((e) => {
      if (e.mapped_signal_type) {
        bySignal[e.mapped_signal_type] = (bySignal[e.mapped_signal_type] || 0) + 1;
      }
    });

    return {
      total: connection?.events_received || 0,
      processed: connection?.events_processed || 0,
      failed: connection?.events_failed || 0,
      pending: (connection?.events_received || 0) - (connection?.events_processed || 0) - (connection?.events_failed || 0),
      byType,
      bySignal,
    };
  }

  /**
   * Update connection settings
   */
  async updateConnectionSettings(
    userId: string,
    settings: Partial<SegmentConnection>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const updateData: Record<string, unknown> = {};

    if (settings.enabled !== undefined) updateData.enabled = settings.enabled;
    if (settings.processIdentify !== undefined) updateData.process_identify = settings.processIdentify;
    if (settings.processGroup !== undefined) updateData.process_group = settings.processGroup;
    if (settings.processTrack !== undefined) updateData.process_track = settings.processTrack;
    if (settings.matchByEmail !== undefined) updateData.match_by_email = settings.matchByEmail;
    if (settings.matchByUserId !== undefined) updateData.match_by_user_id = settings.matchByUserId;
    if (settings.matchByGroupId !== undefined) updateData.match_by_group_id = settings.matchByGroupId;
    if (settings.createUnknownUsers !== undefined) updateData.create_unknown_users = settings.createUnknownUsers;

    await supabase
      .from('segment_connections')
      .update(updateData)
      .eq('user_id', userId);
  }

  /**
   * Regenerate write key
   */
  async regenerateWriteKey(userId: string): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const newWriteKey = this.generateWriteKey();

    await supabase
      .from('segment_connections')
      .update({ write_key: newWriteKey })
      .eq('user_id', userId);

    return newWriteKey;
  }

  /**
   * Get dead letter queue entries
   */
  async getDeadLetterQueue(options: { limit?: number; offset?: number; resolved?: boolean } = {}): Promise<{ entries: unknown[]; total: number }> {
    if (!supabase) {
      return { entries: [], total: 0 };
    }

    const { limit = 50, offset = 0, resolved } = options;

    let query = supabase
      .from('segment_dead_letter_queue')
      .select('*', { count: 'exact' })
      .order('failed_at', { ascending: false });

    if (resolved !== undefined) {
      query = query.eq('resolved', resolved);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get DLQ entries: ${error.message}`);
    }

    return { entries: data || [], total: count || 0 };
  }

  /**
   * Retry dead letter queue entry
   */
  async retryDeadLetterEntry(entryId: string, connection: SegmentConnection): Promise<ProcessingResult> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { data: entry } = await supabase
      .from('segment_dead_letter_queue')
      .select('*')
      .eq('id', entryId)
      .single();

    if (!entry) {
      throw new Error('DLQ entry not found');
    }

    // Retry processing
    const result = await this.processWebhookEvent(entry.raw_payload, connection);

    if (result.success) {
      // Mark as resolved
      await supabase
        .from('segment_dead_letter_queue')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Automatically resolved via retry',
        })
        .eq('id', entryId);
    } else {
      // Increment retry count
      await supabase
        .from('segment_dead_letter_queue')
        .update({ retry_count: entry.retry_count + 1 })
        .eq('id', entryId);
    }

    return result;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return segmentCircuitBreaker.getStats();
  }

  /**
   * Map database row to SegmentConnection type
   */
  private mapConnectionFromDb(row: any): SegmentConnection {
    return {
      id: row.id,
      userId: row.user_id,
      writeKey: row.write_key,
      webhookSecret: row.webhook_secret,
      enabled: row.enabled,
      processIdentify: row.process_identify,
      processGroup: row.process_group,
      processTrack: row.process_track,
      matchByEmail: row.match_by_email,
      matchByUserId: row.match_by_user_id,
      matchByGroupId: row.match_by_group_id,
      createUnknownUsers: row.create_unknown_users,
      eventsReceived: row.events_received,
      eventsProcessed: row.events_processed,
      eventsFailed: row.events_failed,
      lastEventAt: row.last_event_at ? new Date(row.last_event_at) : undefined,
    };
  }

  /**
   * Map database row to SegmentMapping type
   */
  private mapMappingFromDb(row: any): SegmentMapping {
    return {
      id: row.id,
      segmentEvent: row.segment_event,
      cscxSignalType: row.cscx_signal_type,
      propertyMappings: row.property_mappings || {},
      conditions: row.conditions,
      signalPriority: row.signal_priority,
      triggerHealthUpdate: row.trigger_health_update,
      triggerAlert: row.trigger_alert,
      enabled: row.enabled,
    };
  }
}

// Singleton instance
export const segmentService = new SegmentService();
export default segmentService;
