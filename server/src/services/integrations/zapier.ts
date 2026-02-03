/**
 * Zapier Webhook Integration Service - PRD-210
 *
 * Implements Zapier webhook functionality:
 * - Outbound webhooks (CSCX.AI -> Zapier) with secure signing
 * - Inbound webhooks (Zapier -> CSCX.AI) with token authentication
 * - Webhook delivery tracking with retry logic
 * - Dead letter queue for failed deliveries
 * - Event type configuration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import crypto from 'crypto';
import { EventEmitter } from 'events';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for webhook delivery
const zapierCircuitBreaker = new CircuitBreaker('zapier', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// Event emitter for real-time notifications
export const zapierEventEmitter = new EventEmitter();

// ============================================
// Types
// ============================================

export type WebhookEventType =
  | 'health_score.changed'
  | 'health_score.critical'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'risk_signal.created'
  | 'risk_signal.resolved'
  | 'renewal.approaching'
  | 'renewal.at_risk'
  | 'task.created'
  | 'task.completed'
  | 'approval.requested'
  | 'approval.completed'
  | 'nps.received'
  | 'support_ticket.created'
  | 'support_ticket.escalated'
  | 'meeting.scheduled'
  | 'meeting.completed';

export interface OutboundWebhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  active: boolean;
  secret: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  deliveredAt?: Date;
  retryCount: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  error?: string;
}

export interface InboundWebhookToken {
  id: string;
  userId: string;
  token: string;
  name: string;
  actionType: InboundActionType;
  fieldMapping?: Record<string, string>;
  active: boolean;
  createdAt: Date;
}

export type InboundActionType =
  | 'create_customer'
  | 'update_customer'
  | 'add_stakeholder'
  | 'log_activity'
  | 'create_task'
  | 'create_risk_signal'
  | 'update_health_score';

export interface InboundWebhookLog {
  id: string;
  tokenId: string;
  payload: Record<string, unknown>;
  processed: boolean;
  errorMessage?: string;
  receivedAt: Date;
  processedAt?: Date;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}

export interface DeliveryResult {
  success: boolean;
  deliveryId?: string;
  error?: string;
  responseStatus?: number;
}

export interface InboundProcessingResult {
  success: boolean;
  actionType: InboundActionType;
  recordId?: string;
  error?: string;
}

export interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  successRate: number;
  avgLatencyMs: number;
}

// ============================================
// Zapier Service Class
// ============================================

export class ZapierService {
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 30000]; // 1s, 5s, 30s
  private deliveryTimeout = 5000; // 5 second timeout per PRD

  /**
   * Check if Zapier integration is configured
   */
  isConfigured(): boolean {
    return Boolean(supabase);
  }

  /**
   * Generate webhook secret for HMAC signing
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate inbound webhook token
   */
  generateToken(): string {
    return `zapier_${crypto.randomBytes(24).toString('base64url')}`;
  }

  /**
   * Sign webhook payload with HMAC-SHA256
   */
  signPayload(payload: string, secret: string): string {
    return `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.signPayload(payload, secret);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ============================================
  // Outbound Webhook Management
  // ============================================

  /**
   * Create a new outbound webhook
   */
  async createOutboundWebhook(
    userId: string,
    name: string,
    url: string,
    events: WebhookEventType[],
    headers?: Record<string, string>
  ): Promise<OutboundWebhook> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const secret = this.generateSecret();

    const { data, error } = await supabase
      .from('outbound_webhooks')
      .insert({
        user_id: userId,
        name,
        url,
        events,
        headers: headers || {},
        secret,
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook: ${error.message}`);
    }

    return this.mapOutboundWebhookFromDb(data);
  }

  /**
   * Get all outbound webhooks for a user
   */
  async getOutboundWebhooks(userId: string): Promise<OutboundWebhook[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('outbound_webhooks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get webhooks: ${error.message}`);
    }

    return (data || []).map(this.mapOutboundWebhookFromDb);
  }

  /**
   * Get a specific outbound webhook
   */
  async getOutboundWebhook(webhookId: string): Promise<OutboundWebhook | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('outbound_webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (error) return null;

    return data ? this.mapOutboundWebhookFromDb(data) : null;
  }

  /**
   * Update an outbound webhook
   */
  async updateOutboundWebhook(
    webhookId: string,
    updates: Partial<{
      name: string;
      url: string;
      events: WebhookEventType[];
      headers: Record<string, string>;
      active: boolean;
    }>
  ): Promise<OutboundWebhook> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.url !== undefined) updateData.url = updates.url;
    if (updates.events !== undefined) updateData.events = updates.events;
    if (updates.headers !== undefined) updateData.headers = updates.headers;
    if (updates.active !== undefined) updateData.active = updates.active;

    const { data, error } = await supabase
      .from('outbound_webhooks')
      .update(updateData)
      .eq('id', webhookId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update webhook: ${error.message}`);
    }

    return this.mapOutboundWebhookFromDb(data);
  }

  /**
   * Delete an outbound webhook
   */
  async deleteOutboundWebhook(webhookId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { error } = await supabase
      .from('outbound_webhooks')
      .delete()
      .eq('id', webhookId);

    if (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const newSecret = this.generateSecret();

    await supabase
      .from('outbound_webhooks')
      .update({ secret: newSecret, updated_at: new Date().toISOString() })
      .eq('id', webhookId);

    return newSecret;
  }

  // ============================================
  // Webhook Delivery
  // ============================================

  /**
   * Trigger webhooks for an event
   */
  async triggerEvent(
    userId: string,
    eventType: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<DeliveryResult[]> {
    if (!supabase) return [];

    // Get all active webhooks subscribed to this event
    const { data: webhooks } = await supabase
      .from('outbound_webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('events', [eventType]);

    if (!webhooks || webhooks.length === 0) {
      return [];
    }

    const results: DeliveryResult[] = [];

    for (const webhook of webhooks) {
      const result = await this.deliverWebhook(
        this.mapOutboundWebhookFromDb(webhook),
        eventType,
        data
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Deliver a single webhook
   */
  private async deliverWebhook(
    webhook: OutboundWebhook,
    eventType: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<DeliveryResult> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.signPayload(payloadString, webhook.secret);
    payload.signature = signature;

    // Create delivery record
    const { data: delivery, error: deliveryError } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload,
        status: 'pending',
        retry_count: 0,
      })
      .select()
      .single();

    if (deliveryError) {
      return { success: false, error: `Failed to create delivery record: ${deliveryError.message}` };
    }

    // Attempt delivery
    return this.attemptDelivery(webhook, delivery.id, payload, 0);
  }

  /**
   * Attempt webhook delivery with retries
   */
  private async attemptDelivery(
    webhook: OutboundWebhook,
    deliveryId: string,
    payload: WebhookPayload,
    retryCount: number
  ): Promise<DeliveryResult> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const startTime = Date.now();

    try {
      const result = await zapierCircuitBreaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.deliveryTimeout);

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSCX-Signature': payload.signature || '',
              'X-CSCX-Event': payload.event,
              'X-CSCX-Delivery': deliveryId,
              ...webhook.headers,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const responseBody = await response.text().catch(() => '');
          const latencyMs = Date.now() - startTime;

          // Update delivery record
          await supabase
            .from('webhook_deliveries')
            .update({
              response_status: response.status,
              response_body: responseBody.substring(0, 1000), // Limit response size
              delivered_at: new Date().toISOString(),
              status: response.ok ? 'delivered' : 'failed',
              latency_ms: latencyMs,
              retry_count: retryCount,
              error: response.ok ? null : `HTTP ${response.status}`,
            })
            .eq('id', deliveryId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
          }

          // Emit success event
          zapierEventEmitter.emit('delivery:success', {
            webhookId: webhook.id,
            deliveryId,
            eventType: payload.event,
            latencyMs,
          });

          return { success: true, deliveryId, responseStatus: response.status };
        } finally {
          clearTimeout(timeoutId);
        }
      });

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Check if we should retry
      if (retryCount < this.maxRetries) {
        // Update delivery status to retrying
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'retrying',
            retry_count: retryCount + 1,
            error: errorMessage,
          })
          .eq('id', deliveryId);

        // Schedule retry with exponential backoff
        const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];

        setTimeout(async () => {
          await this.attemptDelivery(webhook, deliveryId, payload, retryCount + 1);
        }, delay);

        return { success: false, deliveryId, error: `Delivery failed, retry scheduled in ${delay}ms` };
      }

      // Max retries exceeded - add to dead letter queue
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          retry_count: retryCount,
          error: errorMessage,
        })
        .eq('id', deliveryId);

      // Add to dead letter queue
      await this.addToDeadLetterQueue(deliveryId, webhook.id, payload, errorMessage);

      // Emit failure event
      zapierEventEmitter.emit('delivery:failed', {
        webhookId: webhook.id,
        deliveryId,
        eventType: payload.event,
        error: errorMessage,
      });

      return { success: false, deliveryId, error: errorMessage };
    }
  }

  /**
   * Add failed delivery to dead letter queue
   */
  private async addToDeadLetterQueue(
    deliveryId: string,
    webhookId: string,
    payload: WebhookPayload,
    error: string
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('webhook_dead_letter_queue').insert({
      delivery_id: deliveryId,
      webhook_id: webhookId,
      payload,
      error_message: error,
    });
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<DeliveryResult> {
    const webhook = await this.getOutboundWebhook(webhookId);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const testData = {
      customer_id: 'test_customer_123',
      customer_name: 'Test Customer',
      test: true,
      timestamp: new Date().toISOString(),
    };

    return this.deliverWebhook(webhook, 'customer.updated', testData);
  }

  /**
   * Get webhook delivery logs
   */
  async getDeliveryLogs(
    webhookId: string,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<{ logs: WebhookDelivery[]; total: number }> {
    if (!supabase) return { logs: [], total: 0 };

    const { limit = 50, offset = 0, status } = options;

    let query = supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact' })
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get delivery logs: ${error.message}`);
    }

    return {
      logs: (data || []).map(this.mapDeliveryFromDb),
      total: count || 0,
    };
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<DeliveryResult> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { data: delivery, error } = await supabase
      .from('webhook_deliveries')
      .select('*, outbound_webhooks(*)')
      .eq('id', deliveryId)
      .single();

    if (error || !delivery) {
      return { success: false, error: 'Delivery not found' };
    }

    const webhook = this.mapOutboundWebhookFromDb(delivery.outbound_webhooks);

    // Reset retry count and attempt delivery
    await supabase
      .from('webhook_deliveries')
      .update({ status: 'pending', retry_count: 0 })
      .eq('id', deliveryId);

    return this.attemptDelivery(webhook, deliveryId, delivery.payload, 0);
  }

  // ============================================
  // Inbound Webhook Management
  // ============================================

  /**
   * Create an inbound webhook token
   */
  async createInboundWebhook(
    userId: string,
    name: string,
    actionType: InboundActionType,
    fieldMapping?: Record<string, string>
  ): Promise<InboundWebhookToken> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const token = this.generateToken();

    const { data, error } = await supabase
      .from('inbound_webhook_tokens')
      .insert({
        user_id: userId,
        token,
        name,
        action_type: actionType,
        field_mapping: fieldMapping || {},
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create inbound webhook: ${error.message}`);
    }

    return this.mapInboundWebhookFromDb(data);
  }

  /**
   * Get all inbound webhook tokens for a user
   */
  async getInboundWebhooks(userId: string): Promise<InboundWebhookToken[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('inbound_webhook_tokens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get inbound webhooks: ${error.message}`);
    }

    return (data || []).map(this.mapInboundWebhookFromDb);
  }

  /**
   * Get inbound webhook by token
   */
  async getInboundWebhookByToken(token: string): Promise<InboundWebhookToken | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('inbound_webhook_tokens')
      .select('*')
      .eq('token', token)
      .eq('active', true)
      .single();

    if (error) return null;

    return data ? this.mapInboundWebhookFromDb(data) : null;
  }

  /**
   * Update inbound webhook
   */
  async updateInboundWebhook(
    tokenId: string,
    updates: Partial<{
      name: string;
      actionType: InboundActionType;
      fieldMapping: Record<string, string>;
      active: boolean;
    }>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const updateData: Record<string, unknown> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.actionType !== undefined) updateData.action_type = updates.actionType;
    if (updates.fieldMapping !== undefined) updateData.field_mapping = updates.fieldMapping;
    if (updates.active !== undefined) updateData.active = updates.active;

    const { error } = await supabase
      .from('inbound_webhook_tokens')
      .update(updateData)
      .eq('id', tokenId);

    if (error) {
      throw new Error(`Failed to update inbound webhook: ${error.message}`);
    }
  }

  /**
   * Delete inbound webhook
   */
  async deleteInboundWebhook(tokenId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { error } = await supabase
      .from('inbound_webhook_tokens')
      .delete()
      .eq('id', tokenId);

    if (error) {
      throw new Error(`Failed to delete inbound webhook: ${error.message}`);
    }
  }

  /**
   * Process incoming webhook
   */
  async processInboundWebhook(
    token: string,
    payload: Record<string, unknown>
  ): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'log_activity', error: 'Database not configured' };
    }

    // Get webhook configuration
    const webhook = await this.getInboundWebhookByToken(token);
    if (!webhook) {
      return { success: false, actionType: 'log_activity', error: 'Invalid or inactive webhook token' };
    }

    // Log the incoming webhook
    const { data: log, error: logError } = await supabase
      .from('inbound_webhook_logs')
      .insert({
        token_id: webhook.id,
        payload,
        processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log inbound webhook:', logError);
    }

    try {
      // Map fields if mapping is configured
      const mappedData = this.applyFieldMapping(payload, webhook.fieldMapping || {});

      // Process based on action type
      let result: InboundProcessingResult;

      switch (webhook.actionType) {
        case 'create_customer':
          result = await this.processCreateCustomer(mappedData);
          break;
        case 'update_customer':
          result = await this.processUpdateCustomer(mappedData);
          break;
        case 'add_stakeholder':
          result = await this.processAddStakeholder(mappedData);
          break;
        case 'log_activity':
          result = await this.processLogActivity(mappedData);
          break;
        case 'create_task':
          result = await this.processCreateTask(mappedData);
          break;
        case 'create_risk_signal':
          result = await this.processCreateRiskSignal(mappedData);
          break;
        case 'update_health_score':
          result = await this.processUpdateHealthScore(mappedData);
          break;
        default:
          result = { success: false, actionType: webhook.actionType, error: 'Unknown action type' };
      }

      // Update log with result
      if (log) {
        await supabase
          .from('inbound_webhook_logs')
          .update({
            processed: result.success,
            processed_at: new Date().toISOString(),
            error_message: result.error,
            result_record_id: result.recordId,
          })
          .eq('id', log.id);
      }

      // Emit event
      zapierEventEmitter.emit('inbound:processed', {
        tokenId: webhook.id,
        actionType: webhook.actionType,
        success: result.success,
        recordId: result.recordId,
      });

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Update log with error
      if (log) {
        await supabase
          .from('inbound_webhook_logs')
          .update({
            processed: false,
            error_message: errorMessage,
          })
          .eq('id', log.id);
      }

      return { success: false, actionType: webhook.actionType, error: errorMessage };
    }
  }

  /**
   * Apply field mapping to payload
   */
  private applyFieldMapping(
    payload: Record<string, unknown>,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    if (Object.keys(mapping).length === 0) {
      return payload;
    }

    const result: Record<string, unknown> = { _raw: payload };

    for (const [sourceField, targetField] of Object.entries(mapping)) {
      const value = this.getNestedValue(payload, sourceField);
      if (value !== undefined) {
        result[targetField] = value;
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }

  // ============================================
  // Inbound Action Processors
  // ============================================

  private async processCreateCustomer(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'create_customer', error: 'Database not configured' };
    }

    const name = data.name || data.customer_name;
    if (!name) {
      return { success: false, actionType: 'create_customer', error: 'Customer name is required' };
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        name,
        industry: data.industry,
        arr: data.arr || data.annual_revenue,
        mrr: data.mrr || data.monthly_revenue,
        employee_count: data.employee_count || data.employees,
        website: data.website,
        health_score: 50, // Default
        external_id: data.external_id || data.id,
        metadata: data._raw || data,
      })
      .select()
      .single();

    if (error) {
      return { success: false, actionType: 'create_customer', error: error.message };
    }

    return { success: true, actionType: 'create_customer', recordId: customer.id };
  }

  private async processUpdateCustomer(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'update_customer', error: 'Database not configured' };
    }

    const customerId = data.customer_id || data.id;
    const externalId = data.external_id;

    if (!customerId && !externalId) {
      return { success: false, actionType: 'update_customer', error: 'Customer ID or external ID is required' };
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name) updates.name = data.name;
    if (data.industry) updates.industry = data.industry;
    if (data.arr !== undefined) updates.arr = data.arr;
    if (data.mrr !== undefined) updates.mrr = data.mrr;
    if (data.employee_count !== undefined) updates.employee_count = data.employee_count;
    if (data.website) updates.website = data.website;

    let query = supabase.from('customers').update(updates);

    if (customerId) {
      query = query.eq('id', customerId);
    } else {
      query = query.eq('external_id', externalId);
    }

    const { data: customer, error } = await query.select().single();

    if (error) {
      return { success: false, actionType: 'update_customer', error: error.message };
    }

    return { success: true, actionType: 'update_customer', recordId: customer?.id };
  }

  private async processAddStakeholder(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'add_stakeholder', error: 'Database not configured' };
    }

    const customerId = data.customer_id;
    const email = data.email;
    const name = data.name;

    if (!customerId || !email) {
      return { success: false, actionType: 'add_stakeholder', error: 'Customer ID and email are required' };
    }

    const { data: stakeholder, error } = await supabase
      .from('stakeholders')
      .insert({
        customer_id: customerId,
        email: (email as string).toLowerCase(),
        name,
        title: data.title || data.job_title,
        phone: data.phone,
        role: data.role || 'user',
        is_champion: data.is_champion || false,
        is_decision_maker: data.is_decision_maker || false,
      })
      .select()
      .single();

    if (error) {
      return { success: false, actionType: 'add_stakeholder', error: error.message };
    }

    return { success: true, actionType: 'add_stakeholder', recordId: stakeholder.id };
  }

  private async processLogActivity(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'log_activity', error: 'Database not configured' };
    }

    const customerId = data.customer_id;
    if (!customerId) {
      return { success: false, actionType: 'log_activity', error: 'Customer ID is required' };
    }

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        customer_id: customerId,
        type: data.activity_type || data.type || 'other',
        description: data.description || data.message || data.note,
        occurred_at: data.occurred_at || new Date().toISOString(),
        source: 'zapier',
        metadata: data._raw || data,
      })
      .select()
      .single();

    if (error) {
      return { success: false, actionType: 'log_activity', error: error.message };
    }

    return { success: true, actionType: 'log_activity', recordId: activity.id };
  }

  private async processCreateTask(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'create_task', error: 'Database not configured' };
    }

    const customerId = data.customer_id;
    const title = data.title || data.name;

    if (!customerId || !title) {
      return { success: false, actionType: 'create_task', error: 'Customer ID and title are required' };
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        customer_id: customerId,
        title,
        description: data.description,
        due_date: data.due_date,
        priority: data.priority || 'medium',
        status: 'open',
        source: 'zapier',
      })
      .select()
      .single();

    if (error) {
      return { success: false, actionType: 'create_task', error: error.message };
    }

    return { success: true, actionType: 'create_task', recordId: task.id };
  }

  private async processCreateRiskSignal(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'create_risk_signal', error: 'Database not configured' };
    }

    const customerId = data.customer_id;
    const signalType = data.signal_type || data.type;

    if (!customerId || !signalType) {
      return { success: false, actionType: 'create_risk_signal', error: 'Customer ID and signal type are required' };
    }

    const { data: signal, error } = await supabase
      .from('risk_signals')
      .insert({
        customer_id: customerId,
        signal_type: signalType,
        severity: data.severity || 'medium',
        title: data.title || `Risk Signal: ${signalType}`,
        description: data.description,
        source: 'zapier',
        metadata: data._raw || data,
      })
      .select()
      .single();

    if (error) {
      return { success: false, actionType: 'create_risk_signal', error: error.message };
    }

    return { success: true, actionType: 'create_risk_signal', recordId: signal.id };
  }

  private async processUpdateHealthScore(data: Record<string, unknown>): Promise<InboundProcessingResult> {
    if (!supabase) {
      return { success: false, actionType: 'update_health_score', error: 'Database not configured' };
    }

    const customerId = data.customer_id;
    const component = data.component || data.score_component;
    const value = data.value || data.score;

    if (!customerId) {
      return { success: false, actionType: 'update_health_score', error: 'Customer ID is required' };
    }

    // If specific component, update that. Otherwise update overall health score
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (component) {
      // Update specific component score in health_components JSONB
      const { data: customer } = await supabase
        .from('customers')
        .select('health_components')
        .eq('id', customerId)
        .single();

      const healthComponents = (customer?.health_components || {}) as Record<string, number>;
      healthComponents[component as string] = Number(value);
      updates.health_components = healthComponents;
    } else if (value !== undefined) {
      updates.health_score = Math.max(0, Math.min(100, Number(value)));
    }

    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId);

    if (error) {
      return { success: false, actionType: 'update_health_score', error: error.message };
    }

    return { success: true, actionType: 'update_health_score', recordId: customerId as string };
  }

  // ============================================
  // Statistics and Monitoring
  // ============================================

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string): Promise<WebhookStats> {
    if (!supabase) {
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        successRate: 0,
        avgLatencyMs: 0,
      };
    }

    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select('status, latency_ms')
      .eq('webhook_id', webhookId);

    if (!deliveries || deliveries.length === 0) {
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        successRate: 0,
        avgLatencyMs: 0,
      };
    }

    const total = deliveries.length;
    const successful = deliveries.filter((d) => d.status === 'delivered').length;
    const failed = deliveries.filter((d) => d.status === 'failed').length;
    const pending = deliveries.filter((d) => d.status === 'pending' || d.status === 'retrying').length;

    const latencies = deliveries
      .filter((d) => d.latency_ms)
      .map((d) => d.latency_ms);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    return {
      totalDeliveries: total,
      successfulDeliveries: successful,
      failedDeliveries: failed,
      pendingDeliveries: pending,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgLatencyMs: Math.round(avgLatency),
    };
  }

  /**
   * Get inbound webhook logs
   */
  async getInboundLogs(
    tokenId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ logs: InboundWebhookLog[]; total: number }> {
    if (!supabase) return { logs: [], total: 0 };

    const { limit = 50, offset = 0 } = options;

    const { data, count, error } = await supabase
      .from('inbound_webhook_logs')
      .select('*', { count: 'exact' })
      .eq('token_id', tokenId)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get inbound logs: ${error.message}`);
    }

    return {
      logs: (data || []).map(this.mapInboundLogFromDb),
      total: count || 0,
    };
  }

  /**
   * Get dead letter queue entries
   */
  async getDeadLetterQueue(
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ entries: unknown[]; total: number }> {
    if (!supabase) return { entries: [], total: 0 };

    const { limit = 50, offset = 0 } = options;

    const { data, count, error } = await supabase
      .from('webhook_dead_letter_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get DLQ: ${error.message}`);
    }

    return {
      entries: data || [],
      total: count || 0,
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return zapierCircuitBreaker.getStats();
  }

  // ============================================
  // Mappers
  // ============================================

  private mapOutboundWebhookFromDb(row: Record<string, unknown>): OutboundWebhook {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      url: row.url as string,
      events: row.events as WebhookEventType[],
      headers: row.headers as Record<string, string> | undefined,
      active: row.active as boolean,
      secret: row.secret as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapDeliveryFromDb(row: Record<string, unknown>): WebhookDelivery {
    return {
      id: row.id as string,
      webhookId: row.webhook_id as string,
      eventType: row.event_type as WebhookEventType,
      payload: row.payload as Record<string, unknown>,
      responseStatus: row.response_status as number | undefined,
      responseBody: row.response_body as string | undefined,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at as string) : undefined,
      retryCount: row.retry_count as number,
      status: row.status as WebhookDelivery['status'],
      error: row.error as string | undefined,
    };
  }

  private mapInboundWebhookFromDb(row: Record<string, unknown>): InboundWebhookToken {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      token: row.token as string,
      name: row.name as string,
      actionType: row.action_type as InboundActionType,
      fieldMapping: row.field_mapping as Record<string, string> | undefined,
      active: row.active as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapInboundLogFromDb(row: Record<string, unknown>): InboundWebhookLog {
    return {
      id: row.id as string,
      tokenId: row.token_id as string,
      payload: row.payload as Record<string, unknown>,
      processed: row.processed as boolean,
      errorMessage: row.error_message as string | undefined,
      receivedAt: new Date(row.received_at as string),
      processedAt: row.processed_at ? new Date(row.processed_at as string) : undefined,
    };
  }
}

// Singleton instance
export const zapierService = new ZapierService();
export default zapierService;
