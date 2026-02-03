-- Migration: Renewal Checklists (PRD-089)
-- Created: 2026-01-29
-- Description: Tables for renewal preparation checklist tracking

-- Renewal checklist tracking table
CREATE TABLE IF NOT EXISTS renewal_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  renewal_date DATE NOT NULL,
  milestone VARCHAR(20) NOT NULL CHECK (milestone IN ('90_day', '60_day', '30_day', '7_day')),
  milestone_name VARCHAR(100) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_rate INTEGER DEFAULT 0,
  arr NUMERIC(12, 2),
  health_score INTEGER,
  segment VARCHAR(50),
  documents JSONB DEFAULT '[]'::jsonb,
  stakeholder_status JSONB DEFAULT '{}'::jsonb,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(customer_id, milestone)
);

-- Index for efficient milestone queries
CREATE INDEX IF NOT EXISTS idx_renewal_checklists_customer ON renewal_checklists(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewal_checklists_renewal_date ON renewal_checklists(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_checklists_milestone ON renewal_checklists(milestone);
CREATE INDEX IF NOT EXISTS idx_renewal_checklists_completion ON renewal_checklists(completion_rate);

-- Renewal milestone alerts history
CREATE TABLE IF NOT EXISTS renewal_milestone_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES renewal_checklists(id) ON DELETE SET NULL,
  milestone VARCHAR(20) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  alert_severity VARCHAR(20) DEFAULT 'info' CHECK (alert_severity IN ('info', 'warning', 'critical')),
  channel VARCHAR(50),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_renewal_alerts_customer ON renewal_milestone_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewal_alerts_sent ON renewal_milestone_alerts(sent_at DESC);

-- Generated renewal documents
CREATE TABLE IF NOT EXISTS renewal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES renewal_checklists(id) ON DELETE SET NULL,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('value_summary', 'renewal_proposal')),
  document_name VARCHAR(255) NOT NULL,
  google_doc_id VARCHAR(255),
  google_drive_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_renewal_documents_customer ON renewal_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewal_documents_type ON renewal_documents(document_type);

-- Add renewal_date to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'renewal_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN renewal_date DATE;
  END IF;
END $$;

-- Add segment to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'segment'
  ) THEN
    ALTER TABLE customers ADD COLUMN segment VARCHAR(50) DEFAULT 'mid-market';
  END IF;
END $$;

-- Comment on tables
COMMENT ON TABLE renewal_checklists IS 'Tracks renewal preparation checklists at 90/60/30/7 day milestones (PRD-089)';
COMMENT ON TABLE renewal_milestone_alerts IS 'History of renewal milestone alerts sent to CSMs';
COMMENT ON TABLE renewal_documents IS 'Auto-generated value summaries and renewal proposals';

-- Checklist item structure:
-- {
--   "items": [
--     {
--       "id": "value_summary",
--       "title": "Create/update value summary document",
--       "description": "Compile ROI metrics, usage highlights, and achievements",
--       "priority": "high",
--       "status": "pending", -- pending, in_progress, completed, skipped
--       "completed_at": null,
--       "completed_by": null,
--       "due_offset_days": 80,
--       "document_id": null,
--       "auto_generated": true
--     }
--   ]
-- }
