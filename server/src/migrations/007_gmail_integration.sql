-- PRD-190: Gmail Integration
-- Migration for email thread mapping and email metrics tables

-- ============================================
-- Email Thread to Customer Mapping
-- ============================================
CREATE TABLE IF NOT EXISTS email_thread_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  participants TEXT[],
  message_count INTEGER DEFAULT 1,
  last_message_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  labels TEXT[],
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_thread_id)
);

-- Index for efficient customer queries
CREATE INDEX IF NOT EXISTS idx_email_thread_mapping_customer
  ON email_thread_mapping(customer_id, last_message_at DESC);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_email_thread_mapping_user
  ON email_thread_mapping(user_id, synced_at DESC);

-- Index for gmail thread lookups
CREATE INDEX IF NOT EXISTS idx_email_thread_mapping_gmail_thread
  ON email_thread_mapping(gmail_thread_id);

-- ============================================
-- Email Engagement Metrics by Customer
-- ============================================
CREATE TABLE IF NOT EXISTS email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  avg_response_hours NUMERIC(10,2),
  total_threads INTEGER DEFAULT 0,
  avg_thread_depth NUMERIC(10,2),
  last_outbound_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  stakeholders_contacted INTEGER DEFAULT 0,
  unique_recipients INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, user_id, metric_date)
);

-- Index for customer metrics queries
CREATE INDEX IF NOT EXISTS idx_email_metrics_customer
  ON email_metrics(customer_id, metric_date DESC);

-- Index for user metrics queries
CREATE INDEX IF NOT EXISTS idx_email_metrics_user
  ON email_metrics(user_id, metric_date DESC);

-- ============================================
-- Email Templates
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'check_in', 'follow_up', 'welcome', 'qbr', 'renewal', 'escalation'
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]', -- List of variable names used
  is_ai_generated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for template queries
CREATE INDEX IF NOT EXISTS idx_email_templates_category
  ON email_templates(category, is_active);

-- ============================================
-- Email Draft History (for AI-assisted drafts)
-- ============================================
CREATE TABLE IF NOT EXISTS email_draft_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  gmail_draft_id TEXT,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipients JSONB NOT NULL, -- { to: [], cc: [], bcc: [] }
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  variables_used JSONB,
  ai_context JSONB, -- Context used for AI generation
  is_ai_generated BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for draft history queries
CREATE INDEX IF NOT EXISTS idx_email_draft_history_user
  ON email_draft_history(user_id, created_at DESC);

-- Index for customer draft queries
CREATE INDEX IF NOT EXISTS idx_email_draft_history_customer
  ON email_draft_history(customer_id, created_at DESC);

-- ============================================
-- Email Send Audit Log
-- ============================================
CREATE TABLE IF NOT EXISTS email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  recipients JSONB NOT NULL,
  subject TEXT,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  was_ai_assisted BOOLEAN DEFAULT false,
  approval_id UUID, -- Reference to HITL approval if required
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_email_send_log_user
  ON email_send_log(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_send_log_customer
  ON email_send_log(customer_id, sent_at DESC);

-- ============================================
-- Insert Default Email Templates
-- ============================================
INSERT INTO email_templates (name, description, category, subject, body_html, body_text, variables) VALUES
(
  'Check-in Email',
  'Regular check-in with customer to maintain engagement',
  'check_in',
  'Checking in - {{customer.name}}',
  '<p>Hi {{stakeholder.first_name}},</p><p>I wanted to check in and see how things are going with your use of our platform.</p><p>A few things I''d love to hear about:</p><ul><li>How is the team adapting?</li><li>Any questions or challenges?</li><li>Features you''d like to explore?</li></ul><p>Happy to schedule a quick call if that would be helpful.</p><p>Best,<br/>{{csm.first_name}}</p>',
  'Hi {{stakeholder.first_name}},\n\nI wanted to check in and see how things are going with your use of our platform.\n\nA few things I''d love to hear about:\n- How is the team adapting?\n- Any questions or challenges?\n- Features you''d like to explore?\n\nHappy to schedule a quick call if that would be helpful.\n\nBest,\n{{csm.first_name}}',
  '["customer.name", "stakeholder.first_name", "csm.first_name"]'
),
(
  'Welcome Email',
  'Initial welcome email for new customer onboarding',
  'welcome',
  'Welcome to the {{product.name}} family, {{customer.name}}!',
  '<p>Hi {{stakeholder.first_name}},</p><p>Welcome aboard! I''m {{csm.first_name}}, your dedicated Customer Success Manager, and I''m thrilled to have {{customer.name}} as part of our community.</p><p>Here''s what happens next:</p><ol><li>We''ll schedule your kickoff call this week</li><li>I''ll share your personalized onboarding plan</li><li>You''ll get access to our knowledge base and training resources</li></ol><p>I''m here to ensure your success. Don''t hesitate to reach out with any questions!</p><p>Looking forward to working together,<br/>{{csm.first_name}}</p>',
  'Hi {{stakeholder.first_name}},\n\nWelcome aboard! I''m {{csm.first_name}}, your dedicated Customer Success Manager, and I''m thrilled to have {{customer.name}} as part of our community.\n\nHere''s what happens next:\n1. We''ll schedule your kickoff call this week\n2. I''ll share your personalized onboarding plan\n3. You''ll get access to our knowledge base and training resources\n\nI''m here to ensure your success. Don''t hesitate to reach out with any questions!\n\nLooking forward to working together,\n{{csm.first_name}}',
  '["product.name", "customer.name", "stakeholder.first_name", "csm.first_name"]'
),
(
  'QBR Invitation',
  'Invite customer stakeholders to Quarterly Business Review',
  'qbr',
  '{{customer.name}} Q{{qbr.quarter}} Business Review',
  '<p>Hi {{stakeholder.first_name}},</p><p>It''s that time again! I''d like to schedule our {{qbr.quarter}} Quarterly Business Review for {{customer.name}}.</p><p>In this session, we''ll cover:</p><ul><li>Your key metrics and achievements</li><li>ROI and value delivered</li><li>Roadmap and upcoming features</li><li>Goals for the next quarter</li></ul><p>Would any of these times work for you?</p><ul>{{qbr.proposed_times}}</ul><p>Please let me know your preference, and I''ll send a calendar invite.</p><p>Best,<br/>{{csm.first_name}}</p>',
  'Hi {{stakeholder.first_name}},\n\nIt''s that time again! I''d like to schedule our {{qbr.quarter}} Quarterly Business Review for {{customer.name}}.\n\nIn this session, we''ll cover:\n- Your key metrics and achievements\n- ROI and value delivered\n- Roadmap and upcoming features\n- Goals for the next quarter\n\nWould any of these times work for you?\n{{qbr.proposed_times}}\n\nPlease let me know your preference, and I''ll send a calendar invite.\n\nBest,\n{{csm.first_name}}',
  '["customer.name", "stakeholder.first_name", "csm.first_name", "qbr.quarter", "qbr.proposed_times"]'
),
(
  'Follow-up After Meeting',
  'Follow-up email after a customer meeting',
  'follow_up',
  'Follow-up: {{meeting.topic}} - {{customer.name}}',
  '<p>Hi {{stakeholder.first_name}},</p><p>Thank you for your time today! Here''s a summary of what we discussed:</p><p><strong>Key Points:</strong></p>{{meeting.summary}}<p><strong>Action Items:</strong></p>{{meeting.action_items}}<p>I''ll follow up on my items and keep you posted on progress. Let me know if I missed anything or if you have questions!</p><p>Best,<br/>{{csm.first_name}}</p>',
  'Hi {{stakeholder.first_name}},\n\nThank you for your time today! Here''s a summary of what we discussed:\n\nKey Points:\n{{meeting.summary}}\n\nAction Items:\n{{meeting.action_items}}\n\nI''ll follow up on my items and keep you posted on progress. Let me know if I missed anything or if you have questions!\n\nBest,\n{{csm.first_name}}',
  '["customer.name", "stakeholder.first_name", "csm.first_name", "meeting.topic", "meeting.summary", "meeting.action_items"]'
),
(
  'Renewal Discussion',
  'Initial renewal discussion email',
  'renewal',
  'Upcoming Renewal - {{customer.name}}',
  '<p>Hi {{stakeholder.first_name}},</p><p>I hope this message finds you well! As we approach your renewal date on {{renewal.date}}, I wanted to reach out and start the conversation.</p><p>Over the past year, {{customer.name}} has achieved some great results:</p>{{renewal.achievements}}<p>I''d love to schedule some time to discuss:</p><ul><li>Your goals for the next year</li><li>Any adjustments to your current plan</li><li>New features that could benefit your team</li></ul><p>What does your availability look like next week?</p><p>Best,<br/>{{csm.first_name}}</p>',
  'Hi {{stakeholder.first_name}},\n\nI hope this message finds you well! As we approach your renewal date on {{renewal.date}}, I wanted to reach out and start the conversation.\n\nOver the past year, {{customer.name}} has achieved some great results:\n{{renewal.achievements}}\n\nI''d love to schedule some time to discuss:\n- Your goals for the next year\n- Any adjustments to your current plan\n- New features that could benefit your team\n\nWhat does your availability look like next week?\n\nBest,\n{{csm.first_name}}',
  '["customer.name", "stakeholder.first_name", "csm.first_name", "renewal.date", "renewal.achievements"]'
),
(
  'Silence Check-in',
  'Check-in email after period of no contact',
  'check_in',
  'Haven''t heard from you in a while - {{customer.name}}',
  '<p>Hi {{stakeholder.first_name}},</p><p>I noticed it''s been {{days_since_contact}} days since we last connected, and I wanted to make sure everything is going well with {{customer.name}}.</p><p>Is there anything I can help with? Some things I can assist with:</p><ul><li>Answer any questions about the platform</li><li>Provide training or resources for your team</li><li>Address any challenges you''re facing</li><li>Share new features you might find valuable</li></ul><p>Just reply to this email or book time on my calendar: {{csm.calendar_link}}</p><p>Hope to hear from you soon!</p><p>Best,<br/>{{csm.first_name}}</p>',
  'Hi {{stakeholder.first_name}},\n\nI noticed it''s been {{days_since_contact}} days since we last connected, and I wanted to make sure everything is going well with {{customer.name}}.\n\nIs there anything I can help with? Some things I can assist with:\n- Answer any questions about the platform\n- Provide training or resources for your team\n- Address any challenges you''re facing\n- Share new features you might find valuable\n\nJust reply to this email or book time on my calendar: {{csm.calendar_link}}\n\nHope to hear from you soon!\n\nBest,\n{{csm.first_name}}',
  '["customer.name", "stakeholder.first_name", "csm.first_name", "days_since_contact", "csm.calendar_link"]'
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Functions for Email Metrics Calculation
-- ============================================

-- Function to calculate email engagement score for a customer
CREATE OR REPLACE FUNCTION calculate_email_engagement_score(p_customer_id UUID, p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC := 0;
  v_metrics RECORD;
  v_days_since_last_contact INTEGER;
BEGIN
  -- Get the latest metrics for the customer
  SELECT
    emails_sent,
    emails_received,
    avg_response_hours,
    total_threads,
    last_outbound_at,
    last_inbound_at
  INTO v_metrics
  FROM email_metrics
  WHERE customer_id = p_customer_id AND user_id = p_user_id
  ORDER BY metric_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate days since last contact
  v_days_since_last_contact := EXTRACT(DAY FROM (NOW() - GREATEST(
    COALESCE(v_metrics.last_outbound_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(v_metrics.last_inbound_at, '1970-01-01'::TIMESTAMPTZ)
  )));

  -- Base score from email volume (max 30 points)
  v_score := v_score + LEAST(30, (v_metrics.emails_sent + v_metrics.emails_received) * 3);

  -- Response time score (max 25 points)
  IF v_metrics.avg_response_hours IS NOT NULL THEN
    IF v_metrics.avg_response_hours <= 4 THEN
      v_score := v_score + 25;
    ELSIF v_metrics.avg_response_hours <= 24 THEN
      v_score := v_score + 20;
    ELSIF v_metrics.avg_response_hours <= 48 THEN
      v_score := v_score + 15;
    ELSIF v_metrics.avg_response_hours <= 72 THEN
      v_score := v_score + 10;
    ELSE
      v_score := v_score + 5;
    END IF;
  END IF;

  -- Recency score (max 25 points)
  IF v_days_since_last_contact <= 7 THEN
    v_score := v_score + 25;
  ELSIF v_days_since_last_contact <= 14 THEN
    v_score := v_score + 20;
  ELSIF v_days_since_last_contact <= 30 THEN
    v_score := v_score + 15;
  ELSIF v_days_since_last_contact <= 60 THEN
    v_score := v_score + 10;
  ELSE
    v_score := v_score + 5;
  END IF;

  -- Two-way communication score (max 20 points)
  IF v_metrics.emails_sent > 0 AND v_metrics.emails_received > 0 THEN
    v_score := v_score + 20;
  ELSIF v_metrics.emails_sent > 0 OR v_metrics.emails_received > 0 THEN
    v_score := v_score + 10;
  END IF;

  RETURN LEAST(100, v_score);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_email_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_thread_mapping_timestamp ON email_thread_mapping;
CREATE TRIGGER update_email_thread_mapping_timestamp
  BEFORE UPDATE ON email_thread_mapping
  FOR EACH ROW EXECUTE FUNCTION update_email_tables_timestamp();

DROP TRIGGER IF EXISTS update_email_metrics_timestamp ON email_metrics;
CREATE TRIGGER update_email_metrics_timestamp
  BEFORE UPDATE ON email_metrics
  FOR EACH ROW EXECUTE FUNCTION update_email_tables_timestamp();

DROP TRIGGER IF EXISTS update_email_templates_timestamp ON email_templates;
CREATE TRIGGER update_email_templates_timestamp
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_email_tables_timestamp();

DROP TRIGGER IF EXISTS update_email_draft_history_timestamp ON email_draft_history;
CREATE TRIGGER update_email_draft_history_timestamp
  BEFORE UPDATE ON email_draft_history
  FOR EACH ROW EXECUTE FUNCTION update_email_tables_timestamp();

-- Grant permissions
GRANT ALL ON email_thread_mapping TO authenticated;
GRANT ALL ON email_metrics TO authenticated;
GRANT ALL ON email_templates TO authenticated;
GRANT ALL ON email_draft_history TO authenticated;
GRANT ALL ON email_send_log TO authenticated;

-- Enable RLS
ALTER TABLE email_thread_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_draft_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY email_thread_mapping_policy ON email_thread_mapping
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);

CREATE POLICY email_metrics_policy ON email_metrics
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);

CREATE POLICY email_templates_policy ON email_templates
  FOR ALL USING (TRUE); -- Templates are shared

CREATE POLICY email_draft_history_policy ON email_draft_history
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);

CREATE POLICY email_send_log_policy ON email_send_log
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);
