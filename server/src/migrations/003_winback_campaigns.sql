-- Win-Back Campaign Migration
-- PRD-030: Win-Back Campaign Generator

-- Add churn tracking columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS churned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS churn_reason TEXT,
ADD COLUMN IF NOT EXISTS churn_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS previous_arr DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS tenure_months INTEGER,
ADD COLUMN IF NOT EXISTS last_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS product_updates_since_churn JSONB DEFAULT '[]'::jsonb;

-- Create win-back campaigns table
CREATE TABLE IF NOT EXISTS winback_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Campaign details
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  approach VARCHAR(50) NOT NULL DEFAULT 'product_update',

  -- Targeting
  target_contact_name VARCHAR(255),
  target_contact_email VARCHAR(255),

  -- Campaign metrics
  total_emails INTEGER NOT NULL DEFAULT 5,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  emails_opened INTEGER NOT NULL DEFAULT 0,
  emails_clicked INTEGER NOT NULL DEFAULT 0,
  emails_replied INTEGER NOT NULL DEFAULT 0,

  -- Timing
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,

  -- Outcome tracking
  outcome VARCHAR(50),
  outcome_date TIMESTAMPTZ,
  outcome_notes TEXT,
  won_back_arr DECIMAL(12, 2),

  -- Context data
  churn_analysis JSONB,
  product_updates JSONB,
  custom_offer TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_winback_campaigns_customer_id ON winback_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS idx_winback_campaigns_user_id ON winback_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_winback_campaigns_status ON winback_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_winback_campaigns_outcome ON winback_campaigns(outcome);

-- Create win-back campaign items table (individual emails)
CREATE TABLE IF NOT EXISTS winback_campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES winback_campaigns(id) ON DELETE CASCADE,

  -- Email details
  item_order INTEGER NOT NULL,
  day_offset INTEGER NOT NULL,
  send_time VARCHAR(10) NOT NULL DEFAULT '09:00',
  purpose VARCHAR(50) NOT NULL,

  -- Content
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,

  -- Targeting
  to_email VARCHAR(255) NOT NULL,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,

  -- Engagement
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Gmail integration
  gmail_message_id VARCHAR(255),
  gmail_thread_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(campaign_id, item_order)
);

-- Create index for sequence items
CREATE INDEX IF NOT EXISTS idx_winback_campaign_items_campaign_id ON winback_campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_winback_campaign_items_status ON winback_campaign_items(status);
CREATE INDEX IF NOT EXISTS idx_winback_campaign_items_scheduled_at ON winback_campaign_items(scheduled_at);

-- Create win-back success metrics view
CREATE OR REPLACE VIEW winback_success_metrics AS
SELECT
  user_id,
  COUNT(*) as total_campaigns,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_campaigns,
  COUNT(*) FILTER (WHERE outcome = 'won_back') as successful_campaigns,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'won_back')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status = 'completed'), 0)::numeric * 100,
    2
  ) as success_rate,
  SUM(won_back_arr) as total_won_back_arr,
  AVG(won_back_arr) FILTER (WHERE outcome = 'won_back') as avg_won_back_arr,
  COUNT(*) FILTER (WHERE emails_replied > 0) as campaigns_with_replies,
  ROUND(
    AVG(emails_opened::numeric / NULLIF(emails_sent, 0)::numeric * 100),
    2
  ) as avg_open_rate,
  ROUND(
    AVG(emails_clicked::numeric / NULLIF(emails_opened, 0)::numeric * 100),
    2
  ) as avg_click_rate
FROM winback_campaigns
GROUP BY user_id;

-- Create churned customers view for targeting
CREATE OR REPLACE VIEW churned_customers AS
SELECT
  c.id,
  c.name,
  c.industry,
  c.arr as current_arr,
  c.previous_arr,
  c.churned_at,
  c.churn_reason,
  c.churn_category,
  c.tenure_months,
  c.last_contact_name,
  c.last_contact_email,
  c.product_updates_since_churn,
  c.created_at,
  EXTRACT(MONTH FROM AGE(NOW(), c.churned_at)) as months_since_churn,
  (
    SELECT COUNT(*)
    FROM winback_campaigns wc
    WHERE wc.customer_id = c.id
  ) as previous_winback_attempts,
  (
    SELECT MAX(wc.created_at)
    FROM winback_campaigns wc
    WHERE wc.customer_id = c.id
  ) as last_winback_attempt
FROM customers c
WHERE c.stage = 'churned'
  AND c.churned_at IS NOT NULL;

-- Add RLS policies
ALTER TABLE winback_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE winback_campaign_items ENABLE ROW LEVEL SECURITY;

-- Policies for winback_campaigns
CREATE POLICY winback_campaigns_select ON winback_campaigns
  FOR SELECT USING (true);

CREATE POLICY winback_campaigns_insert ON winback_campaigns
  FOR INSERT WITH CHECK (true);

CREATE POLICY winback_campaigns_update ON winback_campaigns
  FOR UPDATE USING (true);

CREATE POLICY winback_campaigns_delete ON winback_campaigns
  FOR DELETE USING (true);

-- Policies for winback_campaign_items
CREATE POLICY winback_campaign_items_select ON winback_campaign_items
  FOR SELECT USING (true);

CREATE POLICY winback_campaign_items_insert ON winback_campaign_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY winback_campaign_items_update ON winback_campaign_items
  FOR UPDATE USING (true);

CREATE POLICY winback_campaign_items_delete ON winback_campaign_items
  FOR DELETE USING (true);

-- Create function to update campaign metrics when items change
CREATE OR REPLACE FUNCTION update_winback_campaign_metrics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE winback_campaigns
  SET
    emails_sent = (SELECT COUNT(*) FROM winback_campaign_items WHERE campaign_id = NEW.campaign_id AND status = 'sent'),
    emails_opened = (SELECT COUNT(*) FROM winback_campaign_items WHERE campaign_id = NEW.campaign_id AND opened_at IS NOT NULL),
    emails_clicked = (SELECT COUNT(*) FROM winback_campaign_items WHERE campaign_id = NEW.campaign_id AND clicked_at IS NOT NULL),
    emails_replied = (SELECT COUNT(*) FROM winback_campaign_items WHERE campaign_id = NEW.campaign_id AND replied_at IS NOT NULL),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for metric updates
DROP TRIGGER IF EXISTS winback_campaign_items_metrics_trigger ON winback_campaign_items;
CREATE TRIGGER winback_campaign_items_metrics_trigger
  AFTER INSERT OR UPDATE ON winback_campaign_items
  FOR EACH ROW
  EXECUTE FUNCTION update_winback_campaign_metrics();

COMMENT ON TABLE winback_campaigns IS 'Win-back email campaigns for churned customers (PRD-030)';
COMMENT ON TABLE winback_campaign_items IS 'Individual emails in win-back campaigns';
COMMENT ON VIEW winback_success_metrics IS 'Aggregated win-back campaign success metrics by user';
COMMENT ON VIEW churned_customers IS 'View of churned customers with win-back targeting data';
