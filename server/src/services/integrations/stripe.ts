/**
 * Stripe Billing Integration Service - PRD-199
 *
 * Implements Stripe billing data sync:
 * - OAuth/API key authentication
 * - Customer matching (email, company name, metadata)
 * - Subscription data sync
 * - Invoice history tracking
 * - Payment status monitoring
 * - Webhook event processing
 * - MRR/ARR calculation
 * - Billing risk signal creation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import crypto from 'crypto';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for Stripe API calls
const stripeCircuitBreaker = new CircuitBreaker('stripe', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000 // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface StripeConnection {
  id?: string;
  apiKey: string;
  webhookSecret?: string;
  accountId?: string;
  livemode?: boolean;
}

export interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
  created: number;
  metadata?: Record<string, string>;
  default_source?: string;
  invoice_settings?: {
    default_payment_method?: string;
  };
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
  trial_start?: number;
  trial_end?: number;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        nickname?: string;
        unit_amount?: number;
        recurring?: {
          interval: 'day' | 'week' | 'month' | 'year';
          interval_count: number;
        };
      };
      quantity?: number;
    }>;
  };
  metadata?: Record<string, string>;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  due_date?: number;
  paid?: boolean;
  billing_reason?: string;
  attempt_count: number;
  next_payment_attempt?: number;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  lines?: {
    data: Array<{
      id: string;
      description?: string;
      amount: number;
      quantity?: number;
    }>;
  };
  created: number;
}

export interface StripePaymentMethod {
  id: string;
  customer?: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    checks?: {
      cvc_check?: string;
      address_line1_check?: string;
      address_postal_code_check?: string;
    };
  };
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface BillingStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
}

export interface CustomerBillingData {
  stripeCustomerId: string;
  subscriptions: Array<{
    id: string;
    status: string;
    planName?: string;
    mrrCents: number;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  }>;
  invoices: Array<{
    id: string;
    status: string;
    amountCents: number;
    dueDate?: string;
    paidAt?: string;
    attemptCount: number;
  }>;
  paymentMethods: Array<{
    id: string;
    type: string;
    cardBrand?: string;
    cardLast4?: string;
    expMonth?: number;
    expYear?: number;
    status: string;
  }>;
  mrrCents: number;
  arrCents: number;
  billingHealth: 'healthy' | 'at_risk' | 'critical';
  riskSignals: Array<{
    type: string;
    severity: string;
    title: string;
    createdAt: string;
  }>;
}

// ============================================
// Stripe Service Class
// ============================================

export class StripeService {
  private baseUrl = 'https://api.stripe.com/v1';
  private apiVersion = '2024-11-20.acacia';

  constructor() {}

  /**
   * Check if Stripe integration is configured
   */
  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY);
  }

  /**
   * Get API key from environment or connection
   */
  private getApiKey(connection?: StripeConnection): string {
    if (connection?.apiKey) return connection.apiKey;
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || '';
  }

  /**
   * Make authenticated request to Stripe API
   */
  private async stripeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE';
      body?: Record<string, unknown>;
      apiKey?: string;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, apiKey } = options;
    const key = apiKey || this.getApiKey();

    return withRetry(
      async () => {
        return stripeCircuitBreaker.execute(async () => {
          const fetchOptions: RequestInit = {
            method,
            headers: {
              'Authorization': `Bearer ${key}`,
              'Stripe-Version': this.apiVersion,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          };

          if (body && method === 'POST') {
            fetchOptions.body = new URLSearchParams(
              this.flattenObject(body)
            ).toString();
          }

          const res = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error?.message || `Stripe API error: ${res.status}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        retryableErrors: ['rate limit', 'timeout', '503', '429', 'ECONNRESET'],
        onRetry: (attempt, error) => {
          console.log(`[Stripe] Retry attempt ${attempt}: ${error.message}`);
        },
      }
    );
  }

  /**
   * Flatten nested object for URL encoding
   */
  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            Object.assign(result, this.flattenObject(item as Record<string, unknown>, `${fullKey}[${index}]`));
          } else {
            result[`${fullKey}[${index}]`] = String(item);
          }
        });
      } else if (value !== undefined && value !== null) {
        result[fullKey] = String(value);
      }
    }

    return result;
  }

  /**
   * List all Stripe customers
   */
  async listCustomers(
    apiKey?: string,
    options: { limit?: number; starting_after?: string } = {}
  ): Promise<{ data: StripeCustomer[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.starting_after) params.set('starting_after', options.starting_after);

    return this.stripeRequest<{ data: StripeCustomer[]; has_more: boolean }>(
      `/customers?${params.toString()}`,
      { apiKey }
    );
  }

  /**
   * Get a single Stripe customer
   */
  async getCustomer(customerId: string, apiKey?: string): Promise<StripeCustomer> {
    return this.stripeRequest<StripeCustomer>(`/customers/${customerId}`, { apiKey });
  }

  /**
   * List subscriptions for a customer
   */
  async listSubscriptions(
    stripeCustomerId: string,
    apiKey?: string,
    options: { status?: string } = {}
  ): Promise<{ data: StripeSubscription[]; has_more: boolean }> {
    const params = new URLSearchParams();
    params.set('customer', stripeCustomerId);
    if (options.status) params.set('status', options.status);
    else params.set('status', 'all');

    return this.stripeRequest<{ data: StripeSubscription[]; has_more: boolean }>(
      `/subscriptions?${params.toString()}`,
      { apiKey }
    );
  }

  /**
   * List invoices for a customer
   */
  async listInvoices(
    stripeCustomerId: string,
    apiKey?: string,
    options: { limit?: number } = {}
  ): Promise<{ data: StripeInvoice[]; has_more: boolean }> {
    const params = new URLSearchParams();
    params.set('customer', stripeCustomerId);
    params.set('limit', String(options.limit || 100));

    return this.stripeRequest<{ data: StripeInvoice[]; has_more: boolean }>(
      `/invoices?${params.toString()}`,
      { apiKey }
    );
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(
    stripeCustomerId: string,
    apiKey?: string
  ): Promise<{ data: StripePaymentMethod[] }> {
    const params = new URLSearchParams();
    params.set('customer', stripeCustomerId);
    params.set('type', 'card');

    return this.stripeRequest<{ data: StripePaymentMethod[] }>(
      `/payment_methods?${params.toString()}`,
      { apiKey }
    );
  }

  /**
   * Calculate MRR from subscription
   */
  calculateMRR(subscription: StripeSubscription): number {
    let totalMRR = 0;

    for (const item of subscription.items.data) {
      const unitAmount = item.price.unit_amount || 0;
      const quantity = item.quantity || 1;
      const interval = item.price.recurring?.interval || 'month';
      const intervalCount = item.price.recurring?.interval_count || 1;

      // Convert to monthly
      let monthlyAmount = unitAmount * quantity;
      switch (interval) {
        case 'day':
          monthlyAmount = (monthlyAmount / intervalCount) * 30;
          break;
        case 'week':
          monthlyAmount = (monthlyAmount / intervalCount) * 4.33;
          break;
        case 'month':
          monthlyAmount = monthlyAmount / intervalCount;
          break;
        case 'year':
          monthlyAmount = monthlyAmount / (intervalCount * 12);
          break;
      }

      totalMRR += Math.round(monthlyAmount);
    }

    return totalMRR;
  }

  /**
   * Sync all Stripe customers to CSCX
   */
  async syncCustomers(
    userId: string,
    connection?: StripeConnection
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    const syncLog = await this.startSyncLog(userId, 'customers', 'full', 'pull');
    result.syncLogId = syncLog?.id;

    try {
      const apiKey = connection?.apiKey || this.getApiKey();
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const { data: customers, has_more } = await this.listCustomers(apiKey, {
          limit: 100,
          starting_after: startingAfter,
        });

        for (const customer of customers) {
          try {
            // Check if already mapped
            const { data: existing } = await supabase
              .from('stripe_customers')
              .select('id, customer_id')
              .eq('stripe_customer_id', customer.id)
              .single();

            if (existing) {
              // Update existing
              await supabase
                .from('stripe_customers')
                .update({
                  email: customer.email,
                  name: customer.name,
                  metadata: customer.metadata,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
              result.updated++;
            } else {
              // Try to match to CSCX customer
              const cscxCustomerId = await this.matchStripeCustomer(customer);

              await supabase.from('stripe_customers').insert({
                customer_id: cscxCustomerId,
                stripe_customer_id: customer.id,
                email: customer.email,
                name: customer.name,
                metadata: customer.metadata,
                matched_by: cscxCustomerId ? 'email_domain' : 'manual',
              });
              result.created++;

              // Update CSCX customer with Stripe ID if matched
              if (cscxCustomerId) {
                await supabase
                  .from('customers')
                  .update({ stripe_customer_id: customer.id })
                  .eq('id', cscxCustomerId);
              }
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to sync customer ${customer.id}: ${(err as Error).message}`);
          }

          startingAfter = customer.id;
        }

        hasMore = has_more;
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Match Stripe customer to CSCX customer
   */
  private async matchStripeCustomer(stripeCustomer: StripeCustomer): Promise<string | null> {
    if (!supabase) return null;

    // Try metadata customer_id first
    if (stripeCustomer.metadata?.customer_id) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('id', stripeCustomer.metadata.customer_id)
        .single();
      if (data) return data.id;
    }

    // Try email domain match
    if (stripeCustomer.email) {
      const domain = stripeCustomer.email.split('@')[1];
      if (domain) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .ilike('name', `%${domain.split('.')[0]}%`)
          .limit(1)
          .single();
        if (data) return data.id;
      }
    }

    // Try company name match
    if (stripeCustomer.name) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', `%${stripeCustomer.name}%`)
        .limit(1)
        .single();
      if (data) return data.id;
    }

    return null;
  }

  /**
   * Sync subscriptions for a Stripe customer
   */
  async syncSubscriptions(
    userId: string,
    stripeCustomerId: string,
    connection?: StripeConnection
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    try {
      const apiKey = connection?.apiKey || this.getApiKey();
      const { data: subscriptions } = await this.listSubscriptions(stripeCustomerId, apiKey);

      for (const sub of subscriptions) {
        try {
          const mrrCents = this.calculateMRR(sub);
          const arrCents = mrrCents * 12;
          const planName = sub.items.data[0]?.price.nickname || 'Unknown Plan';

          const { data: existing } = await supabase
            .from('stripe_subscriptions')
            .select('id')
            .eq('stripe_subscription_id', sub.id)
            .single();

          const subscriptionData = {
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: sub.id,
            status: sub.status,
            plan_id: sub.items.data[0]?.price.id,
            plan_name: planName,
            plan_interval: sub.items.data[0]?.price.recurring?.interval,
            mrr_cents: mrrCents,
            arr_cents: arrCents,
            quantity: sub.items.data[0]?.quantity || 1,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString().split('T')[0],
            current_period_end: new Date(sub.current_period_end * 1000).toISOString().split('T')[0],
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            metadata: sub.metadata,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase
              .from('stripe_subscriptions')
              .update(subscriptionData)
              .eq('id', existing.id);
            result.updated++;
          } else {
            await supabase.from('stripe_subscriptions').insert(subscriptionData);
            result.created++;
          }

          result.synced++;

          // Create risk signals based on subscription status
          await this.createSubscriptionRiskSignals(stripeCustomerId, sub);
        } catch (err) {
          result.errors.push(`Failed to sync subscription ${sub.id}: ${(err as Error).message}`);
        }
      }

      // Update customer MRR/ARR
      await this.updateCustomerMRR(stripeCustomerId);
    } catch (error) {
      result.errors.push(`Subscription sync failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Sync invoices for a Stripe customer
   */
  async syncInvoices(
    userId: string,
    stripeCustomerId: string,
    connection?: StripeConnection
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    try {
      const apiKey = connection?.apiKey || this.getApiKey();
      const { data: invoices } = await this.listInvoices(stripeCustomerId, apiKey, { limit: 100 });

      for (const invoice of invoices) {
        try {
          const { data: existing } = await supabase
            .from('stripe_invoices')
            .select('id')
            .eq('stripe_invoice_id', invoice.id)
            .single();

          const invoiceData = {
            stripe_customer_id: stripeCustomerId,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription || null,
            amount_cents: invoice.amount_due,
            amount_paid_cents: invoice.amount_paid,
            amount_due_cents: invoice.amount_remaining,
            currency: invoice.currency,
            status: invoice.status,
            billing_reason: invoice.billing_reason,
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString().split('T')[0] : null,
            paid_at: invoice.paid ? new Date(invoice.created * 1000).toISOString() : null,
            attempt_count: invoice.attempt_count,
            next_payment_attempt: invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000).toISOString()
              : null,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            line_items: invoice.lines?.data || [],
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from('stripe_invoices').update(invoiceData).eq('id', existing.id);
            result.updated++;
          } else {
            await supabase.from('stripe_invoices').insert(invoiceData);
            result.created++;
          }

          result.synced++;

          // Create risk signals for failed payments
          if (invoice.status === 'open' && invoice.attempt_count > 0) {
            await this.createInvoiceRiskSignal(stripeCustomerId, invoice);
          }
        } catch (err) {
          result.errors.push(`Failed to sync invoice ${invoice.id}: ${(err as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Invoice sync failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Sync payment methods for a Stripe customer
   */
  async syncPaymentMethods(
    userId: string,
    stripeCustomerId: string,
    connection?: StripeConnection
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    try {
      const apiKey = connection?.apiKey || this.getApiKey();
      const { data: paymentMethods } = await this.listPaymentMethods(stripeCustomerId, apiKey);

      for (const pm of paymentMethods) {
        try {
          // Determine card status based on expiration
          let status = 'active';
          if (pm.card) {
            const now = new Date();
            const expDate = new Date(pm.card.exp_year, pm.card.exp_month - 1);
            const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry < 30) {
              status = 'expiring_soon';
            }
          }

          const { data: existing } = await supabase
            .from('stripe_payment_methods')
            .select('id')
            .eq('stripe_payment_method_id', pm.id)
            .single();

          const pmData = {
            stripe_customer_id: stripeCustomerId,
            stripe_payment_method_id: pm.id,
            type: pm.type,
            card_brand: pm.card?.brand,
            card_last4: pm.card?.last4,
            card_exp_month: pm.card?.exp_month,
            card_exp_year: pm.card?.exp_year,
            card_checks: pm.card?.checks,
            status,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from('stripe_payment_methods').update(pmData).eq('id', existing.id);
            result.updated++;
          } else {
            await supabase.from('stripe_payment_methods').insert(pmData);
            result.created++;
          }

          result.synced++;

          // Create risk signal for expiring/expired cards
          if (status !== 'active') {
            await this.createPaymentMethodRiskSignal(stripeCustomerId, pm, status);
          }
        } catch (err) {
          result.errors.push(`Failed to sync payment method ${pm.id}: ${(err as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Payment method sync failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Full sync for a Stripe customer
   */
  async fullSyncCustomer(
    userId: string,
    stripeCustomerId: string,
    connection?: StripeConnection
  ): Promise<{
    subscriptions: SyncResult;
    invoices: SyncResult;
    paymentMethods: SyncResult;
    totalDuration: number;
  }> {
    const startTime = Date.now();

    const subscriptions = await this.syncSubscriptions(userId, stripeCustomerId, connection);
    const invoices = await this.syncInvoices(userId, stripeCustomerId, connection);
    const paymentMethods = await this.syncPaymentMethods(userId, stripeCustomerId, connection);

    return {
      subscriptions,
      invoices,
      paymentMethods,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Get billing data for a customer
   */
  async getCustomerBillingData(customerId: string): Promise<CustomerBillingData | null> {
    if (!supabase) return null;

    // Get Stripe customer mapping
    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('customer_id', customerId)
      .single();

    if (!stripeCustomer) return null;

    const stripeCustomerId = stripeCustomer.stripe_customer_id;

    // Get subscriptions
    const { data: subscriptions } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .order('current_period_end', { ascending: false });

    // Get recent invoices
    const { data: invoices } = await supabase
      .from('stripe_invoices')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get payment methods
    const { data: paymentMethods } = await supabase
      .from('stripe_payment_methods')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId);

    // Get risk signals
    const { data: riskSignals } = await supabase
      .from('billing_risk_signals')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    // Calculate totals
    const totalMRR = subscriptions
      ?.filter((s) => s.status === 'active' || s.status === 'trialing')
      .reduce((sum, s) => sum + (s.mrr_cents || 0), 0) || 0;

    // Determine billing health
    let billingHealth: 'healthy' | 'at_risk' | 'critical' = 'healthy';
    const hasPastDue = subscriptions?.some((s) => s.status === 'past_due');
    const hasFailedPayments = invoices?.some((i) => i.status === 'open' && i.attempt_count > 1);
    const hasExpiredCard = paymentMethods?.some((pm) => pm.status === 'expired');
    const hasCriticalSignals = riskSignals?.some((s) => s.severity === 'critical');

    if (hasCriticalSignals || hasPastDue) {
      billingHealth = 'critical';
    } else if (hasFailedPayments || hasExpiredCard) {
      billingHealth = 'at_risk';
    }

    return {
      stripeCustomerId,
      subscriptions: (subscriptions || []).map((s) => ({
        id: s.stripe_subscription_id,
        status: s.status,
        planName: s.plan_name,
        mrrCents: s.mrr_cents,
        currentPeriodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
      })),
      invoices: (invoices || []).map((i) => ({
        id: i.stripe_invoice_id,
        status: i.status,
        amountCents: i.amount_cents,
        dueDate: i.due_date,
        paidAt: i.paid_at,
        attemptCount: i.attempt_count,
      })),
      paymentMethods: (paymentMethods || []).map((pm) => ({
        id: pm.stripe_payment_method_id,
        type: pm.type,
        cardBrand: pm.card_brand,
        cardLast4: pm.card_last4,
        expMonth: pm.card_exp_month,
        expYear: pm.card_exp_year,
        status: pm.status,
      })),
      mrrCents: totalMRR,
      arrCents: totalMRR * 12,
      billingHealth,
      riskSignals: (riskSignals || []).map((s) => ({
        type: s.signal_type,
        severity: s.severity,
        title: s.title,
        createdAt: s.created_at,
      })),
    };
  }

  /**
   * Calculate MRR for a customer
   */
  async getMRR(customerId: string): Promise<{ mrrCents: number; arrCents: number }> {
    if (!supabase) return { mrrCents: 0, arrCents: 0 };

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('customer_id', customerId)
      .single();

    if (!stripeCustomer) return { mrrCents: 0, arrCents: 0 };

    const { data: subscriptions } = await supabase
      .from('stripe_subscriptions')
      .select('mrr_cents, status')
      .eq('stripe_customer_id', stripeCustomer.stripe_customer_id);

    const mrrCents = subscriptions
      ?.filter((s) => s.status === 'active' || s.status === 'trialing')
      .reduce((sum, s) => sum + (s.mrr_cents || 0), 0) || 0;

    return { mrrCents, arrCents: mrrCents * 12 };
  }

  /**
   * Process Stripe webhook event
   */
  async processWebhook(
    payload: string,
    signature: string,
    webhookSecret: string
  ): Promise<{ success: boolean; eventType?: string; error?: string }> {
    // Verify signature
    if (!this.verifyWebhookSignature(payload, signature, webhookSecret)) {
      return { success: false, error: 'Invalid signature' };
    }

    const event: StripeWebhookEvent = JSON.parse(payload);

    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Log the event
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_customer_id: (event.data.object as { customer?: string }).customer,
      data: event.data,
      processed: false,
    });

    try {
      const obj = event.data.object as Record<string, unknown>;

      switch (event.type) {
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(obj);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(obj);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(obj);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(obj);
          break;

        case 'payment_method.updated':
          await this.handlePaymentMethodUpdated(obj);
          break;

        case 'customer.updated':
          await this.handleCustomerUpdated(obj);
          break;
      }

      // Mark as processed
      await supabase
        .from('stripe_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('stripe_event_id', event.id);

      return { success: true, eventType: event.type };
    } catch (error) {
      // Log error
      await supabase
        .from('stripe_webhook_events')
        .update({ error: (error as Error).message })
        .eq('stripe_event_id', event.id);

      return { success: false, eventType: event.type, error: (error as Error).message };
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const parts = signature.split(',');
      let timestamp = '';
      let v1Signature = '';

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value;
        if (key === 'v1') v1Signature = value;
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(v1Signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ============================================
  // Webhook Event Handlers
  // ============================================

  private async handlePaymentFailed(invoice: Record<string, unknown>): Promise<void> {
    const stripeCustomerId = invoice.customer as string;
    const attemptCount = invoice.attempt_count as number;

    if (!supabase) return;

    // Update invoice
    await supabase
      .from('stripe_invoices')
      .update({
        status: 'open',
        attempt_count: attemptCount,
        next_payment_attempt: invoice.next_payment_attempt
          ? new Date((invoice.next_payment_attempt as number) * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_invoice_id', invoice.id);

    // Create risk signal
    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    await supabase.from('billing_risk_signals').insert({
      customer_id: stripeCustomer?.customer_id,
      stripe_customer_id: stripeCustomerId,
      signal_type: 'payment_failed',
      severity: attemptCount >= 3 ? 'critical' : attemptCount >= 2 ? 'high' : 'medium',
      title: `Payment failed (attempt ${attemptCount})`,
      description: `Invoice ${invoice.id} payment failed on attempt ${attemptCount}`,
      metadata: { invoice_id: invoice.id, attempt_count: attemptCount },
    });

    // Update customer billing health score
    await this.updateCustomerBillingHealth(stripeCustomerId);
  }

  private async handleInvoicePaid(invoice: Record<string, unknown>): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('stripe_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_invoice_id', invoice.id);

    // Resolve any payment_failed signals for this invoice
    await supabase
      .from('billing_risk_signals')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', invoice.customer)
      .eq('signal_type', 'payment_failed')
      .eq('resolved', false);

    await this.updateCustomerBillingHealth(invoice.customer as string);
  }

  private async handleSubscriptionUpdated(subscription: Record<string, unknown>): Promise<void> {
    if (!supabase) return;

    const status = subscription.status as string;
    const stripeCustomerId = subscription.customer as string;

    // Update subscription
    await supabase
      .from('stripe_subscriptions')
      .update({
        status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    // Create risk signals for concerning statuses
    if (status === 'past_due') {
      const { data: stripeCustomer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      await supabase.from('billing_risk_signals').insert({
        customer_id: stripeCustomer?.customer_id,
        stripe_customer_id: stripeCustomerId,
        signal_type: 'subscription_past_due',
        severity: 'high',
        title: 'Subscription is past due',
        description: `Subscription ${subscription.id} is past due`,
        metadata: { subscription_id: subscription.id },
      });
    }

    if (subscription.cancel_at_period_end) {
      const { data: stripeCustomer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      await supabase.from('billing_risk_signals').insert({
        customer_id: stripeCustomer?.customer_id,
        stripe_customer_id: stripeCustomerId,
        signal_type: 'subscription_canceled',
        severity: 'critical',
        title: 'Subscription set to cancel',
        description: `Subscription ${subscription.id} will cancel at period end`,
        metadata: { subscription_id: subscription.id },
      });
    }

    await this.updateCustomerMRR(stripeCustomerId);
    await this.updateCustomerBillingHealth(stripeCustomerId);
  }

  private async handleSubscriptionDeleted(subscription: Record<string, unknown>): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('stripe_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    await this.updateCustomerMRR(subscription.customer as string);
  }

  private async handlePaymentMethodUpdated(pm: Record<string, unknown>): Promise<void> {
    if (!supabase) return;

    const card = pm.card as { exp_month: number; exp_year: number } | undefined;
    if (!card) return;

    let status = 'active';
    const now = new Date();
    const expDate = new Date(card.exp_year, card.exp_month - 1);
    const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      status = 'expired';
    } else if (daysUntilExpiry < 30) {
      status = 'expiring_soon';
    }

    await supabase
      .from('stripe_payment_methods')
      .update({
        card_exp_month: card.exp_month,
        card_exp_year: card.exp_year,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_method_id', pm.id);
  }

  private async handleCustomerUpdated(customer: Record<string, unknown>): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('stripe_customers')
      .update({
        email: customer.email,
        name: customer.name,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customer.id);
  }

  // ============================================
  // Risk Signal Creation
  // ============================================

  private async createSubscriptionRiskSignals(
    stripeCustomerId: string,
    subscription: StripeSubscription
  ): Promise<void> {
    if (!supabase) return;

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (subscription.status === 'past_due') {
      await supabase.from('billing_risk_signals').upsert({
        customer_id: stripeCustomer?.customer_id,
        stripe_customer_id: stripeCustomerId,
        signal_type: 'subscription_past_due',
        severity: 'high',
        title: 'Subscription is past due',
        description: `Subscription ${subscription.id} payment is overdue`,
        metadata: { subscription_id: subscription.id },
      }, { onConflict: 'customer_id,signal_type' });
    }

    if (subscription.cancel_at_period_end) {
      await supabase.from('billing_risk_signals').upsert({
        customer_id: stripeCustomer?.customer_id,
        stripe_customer_id: stripeCustomerId,
        signal_type: 'subscription_canceled',
        severity: 'critical',
        title: 'Subscription set to cancel',
        description: `Subscription will cancel on ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`,
        metadata: { subscription_id: subscription.id, cancel_date: subscription.current_period_end },
      }, { onConflict: 'customer_id,signal_type' });
    }
  }

  private async createInvoiceRiskSignal(
    stripeCustomerId: string,
    invoice: StripeInvoice
  ): Promise<void> {
    if (!supabase) return;

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    await supabase.from('billing_risk_signals').insert({
      customer_id: stripeCustomer?.customer_id,
      stripe_customer_id: stripeCustomerId,
      signal_type: 'payment_failed',
      severity: invoice.attempt_count >= 3 ? 'critical' : 'high',
      title: `Payment failed (${invoice.attempt_count} attempts)`,
      description: `Invoice for ${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency.toUpperCase()} has failed ${invoice.attempt_count} times`,
      metadata: { invoice_id: invoice.id, attempt_count: invoice.attempt_count, amount_cents: invoice.amount_due },
    });
  }

  private async createPaymentMethodRiskSignal(
    stripeCustomerId: string,
    pm: StripePaymentMethod,
    status: string
  ): Promise<void> {
    if (!supabase) return;

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    const signalType = status === 'expired' ? 'card_expired' : 'card_expiring';
    const severity = status === 'expired' ? 'high' : 'medium';

    await supabase.from('billing_risk_signals').upsert({
      customer_id: stripeCustomer?.customer_id,
      stripe_customer_id: stripeCustomerId,
      signal_type: signalType,
      severity,
      title: status === 'expired' ? 'Payment card expired' : 'Payment card expiring soon',
      description: `${pm.card?.brand} ending in ${pm.card?.last4} ${status === 'expired' ? 'has expired' : 'expires soon'}`,
      metadata: { payment_method_id: pm.id, card_last4: pm.card?.last4 },
    }, { onConflict: 'customer_id,signal_type' });
  }

  // ============================================
  // Customer MRR/Health Updates
  // ============================================

  private async updateCustomerMRR(stripeCustomerId: string): Promise<void> {
    if (!supabase) return;

    const { data: subscriptions } = await supabase
      .from('stripe_subscriptions')
      .select('mrr_cents, status')
      .eq('stripe_customer_id', stripeCustomerId);

    const mrrCents = subscriptions
      ?.filter((s) => s.status === 'active' || s.status === 'trialing')
      .reduce((sum, s) => sum + (s.mrr_cents || 0), 0) || 0;

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (stripeCustomer?.customer_id) {
      await supabase
        .from('customers')
        .update({ mrr_cents: mrrCents })
        .eq('id', stripeCustomer.customer_id);
    }
  }

  private async updateCustomerBillingHealth(stripeCustomerId: string): Promise<void> {
    if (!supabase) return;

    // Get current risk signals
    const { data: signals } = await supabase
      .from('billing_risk_signals')
      .select('severity')
      .eq('stripe_customer_id', stripeCustomerId)
      .eq('resolved', false);

    // Calculate billing health score (100 = healthy, 0 = critical)
    let healthScore = 100;

    for (const signal of signals || []) {
      switch (signal.severity) {
        case 'critical':
          healthScore -= 40;
          break;
        case 'high':
          healthScore -= 25;
          break;
        case 'medium':
          healthScore -= 15;
          break;
        case 'low':
          healthScore -= 5;
          break;
      }
    }

    healthScore = Math.max(0, healthScore);

    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (stripeCustomer?.customer_id) {
      await supabase
        .from('customers')
        .update({ billing_health_score: healthScore })
        .eq('id', stripeCustomer.customer_id);
    }
  }

  // ============================================
  // Connection & Sync Management
  // ============================================

  /**
   * Save Stripe connection
   */
  async saveConnection(
    userId: string,
    apiKey: string,
    webhookSecret?: string
  ): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'stripe',
          access_token: apiKey,
          stripe_webhook_secret: webhookSecret || crypto.randomBytes(32).toString('hex'),
          sync_enabled: true,
        },
        { onConflict: 'user_id,provider' }
      )
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get Stripe connection
   */
  async getConnection(userId: string): Promise<StripeConnection | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'stripe')
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      apiKey: data.access_token,
      webhookSecret: data.stripe_webhook_secret,
      accountId: data.stripe_account_id,
    };
  }

  /**
   * Disconnect Stripe integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('integration_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'stripe');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<BillingStatus> {
    if (!supabase) {
      return { connected: false };
    }

    const connection = await this.getConnection(userId);
    if (!connection) {
      return { connected: false };
    }

    const { data: latestSync } = await supabase
      .from('stripe_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      recordsSynced: latestSync?.records_processed,
      syncErrors: latestSync?.error_details,
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ logs: unknown[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    if (!supabase) {
      return { logs: [], total: 0 };
    }

    const { data, count, error } = await supabase
      .from('stripe_sync_log')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get sync history: ${error.message}`);
    }

    return { logs: data || [], total: count || 0 };
  }

  /**
   * Start sync log
   */
  private async startSyncLog(
    userId: string,
    objectType: string,
    syncType: string,
    direction: string
  ): Promise<{ id: string } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('stripe_sync_log')
      .insert({
        user_id: userId,
        object_type: objectType,
        sync_type: syncType,
        direction,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to start sync log:', error);
      return null;
    }

    return data;
  }

  /**
   * Complete sync log
   */
  private async completeSyncLog(
    syncLogId: string | undefined,
    result: SyncResult,
    status: 'completed' | 'failed'
  ): Promise<void> {
    if (!supabase || !syncLogId) return;

    await supabase.from('stripe_sync_log').update({
      status,
      records_processed: result.synced,
      records_created: result.created,
      records_updated: result.updated,
      records_skipped: result.skipped,
      records_failed: result.errors.length,
      error_details: result.errors,
      completed_at: new Date().toISOString(),
    }).eq('id', syncLogId);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return stripeCircuitBreaker.getStats();
  }
}

// Singleton instance
export const stripeService = new StripeService();
export default stripeService;
