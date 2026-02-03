-- ============================================
-- PRD-042: CONTRACT AMENDMENT REQUEST
-- Migration for contract amendment tracking
-- ============================================

-- Contract Amendments Table
CREATE TABLE IF NOT EXISTS contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,

  -- Amendment request details
  amendment_type TEXT CHECK (amendment_type IN (
    'seat_addition',
    'seat_reduction',
    'feature_upgrade',
    'feature_downgrade',
    'term_extension',
    'term_modification',
    'scope_adjustment',
    'pricing_change',
    'other'
  )) NOT NULL,

  -- Current contract terms (snapshot)
  current_seats INT,
  current_arr DECIMAL(12,2),
  current_term_end DATE,
  current_features JSONB DEFAULT '[]'::jsonb,

  -- Proposed changes
  proposed_seats INT,
  proposed_arr DECIMAL(12,2),
  proposed_term_end DATE,
  proposed_features JSONB DEFAULT '[]'::jsonb,

  -- Financial impact
  prorated_cost DECIMAL(12,2),
  months_remaining INT,
  new_annual_rate DECIMAL(12,2),
  financial_impact_details JSONB DEFAULT '{}'::jsonb,

  -- Status tracking
  status TEXT CHECK (status IN (
    'draft',
    'pending_review',
    'pending_customer',
    'pending_legal',
    'pending_approval',
    'approved',
    'rejected',
    'executed',
    'cancelled'
  )) DEFAULT 'draft',

  -- Approval workflow
  requires_legal_review BOOLEAN DEFAULT FALSE,
  requires_executive_approval BOOLEAN DEFAULT FALSE,
  legal_approved_at TIMESTAMPTZ,
  legal_approved_by UUID,
  executive_approved_at TIMESTAMPTZ,
  executive_approved_by UUID,

  -- Communication tracking
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  email_to TEXT[],
  email_cc TEXT[],
  email_subject TEXT,
  email_body TEXT,

  -- Customer response
  customer_acknowledged BOOLEAN DEFAULT FALSE,
  customer_acknowledged_at TIMESTAMPTZ,
  customer_signed BOOLEAN DEFAULT FALSE,
  customer_signed_at TIMESTAMPTZ,
  docusign_envelope_id TEXT,

  -- Ownership
  requested_by UUID,
  requested_by_name TEXT,
  csm_id UUID,
  ae_id UUID,

  -- Description and notes
  description TEXT,
  reason TEXT,
  internal_notes TEXT,
  customer_facing_summary TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Amendment History Table (audit trail)
CREATE TABLE IF NOT EXISTS contract_amendment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id UUID REFERENCES contract_amendments(id) ON DELETE CASCADE,

  -- Change details
  previous_status TEXT,
  new_status TEXT,
  action TEXT NOT NULL,
  action_details JSONB DEFAULT '{}'::jsonb,

  -- Actor
  actor_id UUID,
  actor_name TEXT,
  actor_type TEXT CHECK (actor_type IN ('csm', 'ae', 'legal', 'executive', 'customer', 'system')),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Amendment Templates Table (reusable amendment scenarios)
CREATE TABLE IF NOT EXISTS contract_amendment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amendment_type TEXT NOT NULL,
  description TEXT,

  -- Template content
  email_subject_template TEXT,
  email_body_template TEXT,
  customer_summary_template TEXT,

  -- Default settings
  default_requires_legal BOOLEAN DEFAULT FALSE,
  default_requires_executive BOOLEAN DEFAULT FALSE,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_amendments_customer ON contract_amendments(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_contract ON contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_status ON contract_amendments(status);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_type ON contract_amendments(amendment_type);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_created ON contract_amendments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amendment_history_amendment ON contract_amendment_history(amendment_id);
CREATE INDEX IF NOT EXISTS idx_amendment_history_created ON contract_amendment_history(created_at DESC);

-- Update trigger for amendments
CREATE OR REPLACE FUNCTION update_amendment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contract_amendments_timestamp
  BEFORE UPDATE ON contract_amendments
  FOR EACH ROW EXECUTE FUNCTION update_amendment_timestamp();

-- Function to calculate prorated cost
CREATE OR REPLACE FUNCTION calculate_prorated_amendment_cost(
  p_current_arr DECIMAL,
  p_proposed_arr DECIMAL,
  p_months_remaining INT
) RETURNS DECIMAL AS $$
DECLARE
  annual_difference DECIMAL;
  prorated_amount DECIMAL;
BEGIN
  annual_difference := p_proposed_arr - p_current_arr;
  prorated_amount := (annual_difference / 12.0) * p_months_remaining;
  RETURN ROUND(prorated_amount, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-populate amendment history on status change
CREATE OR REPLACE FUNCTION record_amendment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO contract_amendment_history (
      amendment_id,
      previous_status,
      new_status,
      action,
      actor_type,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      'status_change',
      'system',
      'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_amendment_history
  AFTER UPDATE ON contract_amendments
  FOR EACH ROW EXECUTE FUNCTION record_amendment_status_change();

-- Insert default amendment templates
INSERT INTO contract_amendment_templates (id, name, amendment_type, description, email_subject_template, email_body_template, customer_summary_template, default_requires_legal, default_requires_executive)
VALUES
  (
    gen_random_uuid(),
    'Seat Addition',
    'seat_addition',
    'Add additional user seats to the contract',
    '{{customerName}} Contract Amendment - {{seatCount}} Additional Users',
    'Hi {{contactName}},

Great news - I''m excited to formalize the expansion we discussed! Here''s a summary of the proposed contract amendment:

**Current Agreement:**
- Users: {{currentSeats}}
- Annual Rate: ${{currentArr}}
- Term: Through {{termEndDate}}

**Proposed Amendment:**
- Additional Users: +{{additionalSeats}}
- New Total: {{newTotalSeats}} users
- Prorated Cost ({{monthsRemaining}} months): ${{proratedCost}}
- New Annual Rate (starting {{nextTermStart}}): ${{newAnnualRate}}

**Next Steps:**
1. Review and confirm the above details
2. I''ll generate the formal amendment document
3. Electronic signature via DocuSign
4. New users provisioned within 24 hours of signature

Please let me know if you have any questions or if anything needs adjustment.

Best regards,
{{csmName}}',
    'We are adding {{additionalSeats}} additional seats to your account, bringing your total to {{newTotalSeats}} users. The prorated cost for the remainder of your current term is ${{proratedCost}}, with your new annual rate effective upon renewal being ${{newAnnualRate}}.',
    FALSE,
    FALSE
  ),
  (
    gen_random_uuid(),
    'Feature Upgrade',
    'feature_upgrade',
    'Upgrade to additional product features or tiers',
    '{{customerName}} Contract Amendment - Feature Upgrade',
    'Hi {{contactName}},

I''m pleased to share the details of your proposed feature upgrade:

**Current Agreement:**
- Plan: {{currentPlan}}
- Features: {{currentFeatures}}
- Annual Rate: ${{currentArr}}

**Proposed Upgrade:**
- New Plan: {{proposedPlan}}
- Additional Features: {{additionalFeatures}}
- New Annual Rate: ${{newAnnualRate}}
- Prorated Cost ({{monthsRemaining}} months): ${{proratedCost}}

**Benefits of This Upgrade:**
{{upgradebenefits}}

**Next Steps:**
1. Review the proposed changes
2. Schedule a brief call to discuss implementation
3. Execute the amendment
4. Begin feature enablement

Best regards,
{{csmName}}',
    'Your account is being upgraded to include {{additionalFeatures}}. This upgrade will be available immediately upon execution of this amendment.',
    FALSE,
    TRUE
  ),
  (
    gen_random_uuid(),
    'Term Extension',
    'term_extension',
    'Extend the contract term',
    '{{customerName}} Contract Amendment - Term Extension',
    'Hi {{contactName}},

Thank you for your continued partnership! Here are the details for extending your agreement:

**Current Agreement:**
- End Date: {{currentTermEnd}}
- Annual Rate: ${{currentArr}}

**Proposed Extension:**
- New End Date: {{proposedTermEnd}}
- Extension Period: {{extensionMonths}} months
- Any Rate Changes: {{rateChange}}

**Benefits of This Extension:**
- Price lock for the extended period
- Continued access to all current features
- Priority support maintained

Please let me know if you have any questions.

Best regards,
{{csmName}}',
    'Your contract term is being extended from {{currentTermEnd}} to {{proposedTermEnd}}, a {{extensionMonths}}-month extension.',
    TRUE,
    FALSE
  )
ON CONFLICT DO NOTHING;
