-- Migration: Stripe Billing Integration (PRD-199)
-- Created: 2026-01-29
-- Description: Tables for Stripe billing data sync and revenue tracking

-- Stripe customer mapping table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  matched_by VARCHAR(50) DEFAULT 'manual' CHECK (matched_by IN ('email_domain', 'company_name', 'metadata', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer ON stripe_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON stripe_customers(email);

-- Stripe subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'paused')),
  plan_id TEXT,
  plan_name TEXT,
  plan_interval VARCHAR(10) CHECK (plan_interval IN ('day', 'week', 'month', 'year')),
  mrr_cents INTEGER DEFAULT 0,
  arr_cents INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  current_period_start DATE,
  current_period_end DATE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_period_end ON stripe_subscriptions(current_period_end);

-- Stripe invoices table
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT,
  amount_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER DEFAULT 0,
  amount_due_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  billing_reason VARCHAR(50),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  attempt_count INTEGER DEFAULT 0,
  next_payment_attempt TIMESTAMPTZ,
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer ON stripe_invoices(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_due_date ON stripe_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_subscription ON stripe_invoices(stripe_subscription_id);

-- Stripe payment methods table
CREATE TABLE IF NOT EXISTS stripe_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_checks JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_customer ON stripe_payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_status ON stripe_payment_methods(status);

-- Stripe webhook events log
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  stripe_customer_id TEXT,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_customer ON stripe_webhook_events(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Stripe sync log table
CREATE TABLE IF NOT EXISTS stripe_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  integration_id UUID,
  object_type VARCHAR(50) NOT NULL CHECK (object_type IN ('customers', 'subscriptions', 'invoices', 'payment_methods', 'full')),
  sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'push', 'webhook')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('pull', 'push')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_sync_log_user ON stripe_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sync_log_status ON stripe_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_stripe_sync_log_started ON stripe_sync_log(started_at DESC);

-- Billing risk signals table
CREATE TABLE IF NOT EXISTS billing_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN (
    'payment_failed',
    'subscription_downgrade',
    'subscription_canceled',
    'subscription_past_due',
    'card_expiring',
    'card_expired',
    'dunning_in_progress',
    'invoice_overdue',
    'chargeback'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_risk_signals_customer ON billing_risk_signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_risk_signals_type ON billing_risk_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_billing_risk_signals_severity ON billing_risk_signals(severity);
CREATE INDEX IF NOT EXISTS idx_billing_risk_signals_resolved ON billing_risk_signals(resolved);

-- Add Stripe integration connection support
-- This extends the integration_connections table pattern used for Salesforce

-- Add stripe-specific columns if integration_connections exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_connections') THEN
    -- Add stripe_webhook_secret if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'integration_connections' AND column_name = 'stripe_webhook_secret'
    ) THEN
      ALTER TABLE integration_connections ADD COLUMN stripe_webhook_secret TEXT;
    END IF;

    -- Add stripe_account_id if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'integration_connections' AND column_name = 'stripe_account_id'
    ) THEN
      ALTER TABLE integration_connections ADD COLUMN stripe_account_id TEXT;
    END IF;
  END IF;
END $$;

-- Add billing-related columns to customers table
DO $$
BEGIN
  -- Add billing_health_score
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'billing_health_score'
  ) THEN
    ALTER TABLE customers ADD COLUMN billing_health_score INTEGER;
  END IF;

  -- Add last_payment_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'last_payment_status'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_payment_status VARCHAR(20);
  END IF;

  -- Add mrr_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'mrr_cents'
  ) THEN
    ALTER TABLE customers ADD COLUMN mrr_cents INTEGER;
  END IF;

  -- Add stripe_customer_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE stripe_customers IS 'Maps Stripe customers to CSCX customers for billing sync (PRD-199)';
COMMENT ON TABLE stripe_subscriptions IS 'Synced subscription data from Stripe including MRR/ARR calculations';
COMMENT ON TABLE stripe_invoices IS 'Invoice history and payment tracking from Stripe';
COMMENT ON TABLE stripe_payment_methods IS 'Payment method status including expiration tracking';
COMMENT ON TABLE stripe_webhook_events IS 'Log of processed Stripe webhook events for audit and debugging';
COMMENT ON TABLE stripe_sync_log IS 'Sync operation history for Stripe integration';
COMMENT ON TABLE billing_risk_signals IS 'Billing-related risk signals for health score calculation';
