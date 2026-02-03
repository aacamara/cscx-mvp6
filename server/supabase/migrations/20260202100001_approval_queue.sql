-- PRD-3: Agent Inbox - Approval Queue Table
-- Stores HITL approval requests from agents

-- Create approval_queue table
CREATE TABLE IF NOT EXISTS public.approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  execution_id TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_email', 'schedule_meeting', 'create_task', 'share_document',
    'create_document', 'create_spreadsheet',
    'onboarding_kickoff', 'onboarding_welcome_sequence',
    'renewal_value_summary',
    'risk_save_play', 'risk_escalation',
    'strategic_qbr_prep', 'strategic_exec_briefing', 'strategic_account_plan',
    'other'
  )),
  action_data JSONB NOT NULL DEFAULT '{}',
  original_content TEXT,
  modified_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified', 'expired')),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_approval_queue_user_id ON public.approval_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON public.approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_created_at ON public.approval_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_queue_expires_at ON public.approval_queue(expires_at);

-- Enable RLS
ALTER TABLE public.approval_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own approvals" ON public.approval_queue
  FOR SELECT USING (auth.uid()::text = user_id::text OR user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own approvals" ON public.approval_queue
  FOR UPDATE USING (auth.uid()::text = user_id::text OR user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Service role can insert approvals" ON public.approval_queue
  FOR INSERT WITH CHECK (true);

-- Create support_tickets table if not exists
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  customer_id UUID,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT DEFAULT 'general',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  reporter_email TEXT,
  reporter_name TEXT,
  assigned_to TEXT,
  ai_suggestions JSONB DEFAULT '[]',
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_id ON public.support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Enable RLS for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Service role can manage support tickets" ON public.support_tickets
  FOR ALL USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_approval_queue_updated_at
  BEFORE UPDATE ON public.approval_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS update_approval_queue_updated_at ON public.approval_queue;
-- DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
-- DROP TABLE IF EXISTS public.approval_queue;
-- DROP TABLE IF EXISTS public.support_tickets;
