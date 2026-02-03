-- ============================================
-- CSM SEED DATA
-- Run AFTER 006_csm_core_tables.sql
-- ============================================

-- GLOSSARY (25 essential terms)
INSERT INTO glossary (term, abbreviation, definition, category, related_terms, usage_example) VALUES
('Annual Recurring Revenue', 'ARR', 'The annualized value of recurring subscription revenue. Calculated as MRR × 12.', 'Metrics', ARRAY['MRR', 'NRR', 'GRR'], 'The customer has $150K ARR with renewal in 90 days.'),
('Net Revenue Retention', 'NRR', 'Revenue retained from existing customers including expansion, minus churn and contraction. Formula: (Starting ARR + Expansion - Churn - Contraction) / Starting ARR × 100. Target: >120%', 'Metrics', ARRAY['ARR', 'GRR', 'Churn'], 'Our NRR of 115% indicates healthy expansion from existing customers.'),
('Gross Revenue Retention', 'GRR', 'Revenue retained excluding expansion. Cannot exceed 100%. Formula: (Starting ARR - Churn - Contraction) / Starting ARR × 100. Target: >95%', 'Metrics', ARRAY['ARR', 'NRR', 'Churn'], 'GRR of 92% suggests we need to focus on reducing churn.'),
('Customer Success Manager', 'CSM', 'Professional responsible for customer relationships, adoption, health, and retention for assigned book of business.', 'Roles', ARRAY['CSE', 'TAM'], 'The CSM scheduled a quarterly business review with the customer.'),
('Executive Business Review', 'EBR', 'Strategic partnership meeting with customer executives to review progress and align on priorities. 90% forward-looking, 10% retrospective. NOT a sales call.', 'Processes', ARRAY['QBR', 'Success Plan'], 'The annual EBR requires Economic Buyer attendance.'),
('Call to Action', 'CTA', 'Task or alert requiring CSM attention. Types: Risk (red), Opportunity (green), Lifecycle (blue), Objective (purple).', 'Gainsight', ARRAY['Playbook', 'Cockpit'], 'A Risk CTA was auto-created when health score dropped to Red.'),
('Success Plan', NULL, 'Roadmap connecting customer business outcomes to solutions. Contains objectives with measurable criteria.', 'Processes', ARRAY['Objective', 'EBR'], 'Every Enterprise customer must have an active Success Plan.'),
('PROVE Framework', 'PROVE', 'Health scoring methodology: Product (30%), Risk (20%), Outcomes (20%), Voice (15%), Engagement (15%).', 'Health Scoring', ARRAY['Health Score', 'Stage Adoption'], 'PROVE analysis showed Risk and Engagement as the weakest dimensions.'),
('Stage Adoption', NULL, 'Percentage of users active in a product capability area. >25% = Adopted, <25% = Pilot. #1 predictor of churn.', 'Health Scoring', ARRAY['PROVE', 'License Utilization'], 'Stage adoption below 25% indicates the feature is still in pilot.'),
('Time to Value', 'TTV', 'Duration from contract signature to first value milestone. Target: <30 days excellent, 30-60 good, >90 concerning.', 'Metrics', ARRAY['Onboarding', 'First Value'], 'We reduced TTV from 60 to 25 days with the new onboarding program.'),
('Health Score', NULL, 'Composite metric (0-100) indicating customer wellbeing. Green: 80-100, Yellow: 50-79, Red: 0-49.', 'Health Scoring', ARRAY['PROVE', 'Triage'], 'Health score dropped to Yellow, triggering proactive outreach.'),
('Churn', NULL, 'Customer termination or non-renewal. Logo churn = customer count, Revenue churn = ARR lost.', 'Metrics', ARRAY['GRR', 'Retention'], 'Annual churn rate of 8% is slightly above our 5% target.'),
('Expansion', NULL, 'Additional revenue from existing customers through upsell, cross-sell, or seat expansion.', 'Metrics', ARRAY['NRR', 'Upsell'], 'Expansion opportunities identified during the EBR.'),
('Onboarding', NULL, 'Initial customer journey phase from contract to first value. Typically 30-90 days.', 'Processes', ARRAY['TTV', 'Kickoff'], 'Structured onboarding reduced time-to-value by 40%.'),
('Cadence Call', NULL, 'Regular customer touchpoint. Enterprise: monthly, Commercial: quarterly in steady-state.', 'Processes', ARRAY['EBR', 'Timeline'], 'Weekly cadence calls during onboarding transition to monthly.'),
('Customer 360', 'C360', 'Consolidated view of all customer information: health, plans, timeline, contacts, support.', 'Gainsight', ARRAY['Health Score', 'Timeline'], 'Review Customer 360 before every customer call.'),
('Playbook', NULL, 'Pre-defined task sequence for standard CSM processes. Attached to CTAs.', 'Gainsight', ARRAY['CTA', 'Onboarding'], 'The triage playbook has 12 tasks over 14 days.'),
('Economic Buyer', NULL, 'Person with budget authority and final purchase decision power.', 'Stakeholders', ARRAY['Champion', 'Sponsor'], 'Economic Buyer attendance is required for EBRs.'),
('Champion', NULL, 'Internal customer advocate who actively promotes your solution.', 'Stakeholders', ARRAY['Sponsor', 'Economic Buyer'], 'Losing your champion is a significant risk indicator.'),
('Executive Sponsor', NULL, 'Senior customer stakeholder with strategic interest in partnership success.', 'Stakeholders', ARRAY['Champion', 'Economic Buyer'], 'Executive sponsor departure triggers immediate outreach.'),
('Triage', NULL, 'Urgent intervention process for Red health accounts. 14-day timeline.', 'Processes', ARRAY['Health Score', 'Risk'], 'Account triage CTA auto-fires when health drops to Red.'),
('License Utilization', NULL, 'Percentage of purchased licenses actively used. >80% healthy, <50% concerning.', 'Metrics', ARRAY['Stage Adoption', 'Health Score'], 'License utilization of 45% suggests adoption issues.'),
('Quarterly Business Review', 'QBR', 'Regular strategic meeting with customer stakeholders. Similar to EBR but typically less executive-focused.', 'Processes', ARRAY['EBR', 'Cadence Call'], 'QBRs are scheduled every 3 months for commercial accounts.'),
('Book of Business', 'BoB', 'Portfolio of customers assigned to a CSM. Measured by count, ARR, and health distribution.', 'Roles', ARRAY['CSM', 'Portfolio'], 'My book of business includes 35 customers totaling $4.2M ARR.'),
('Trusted Advisor', NULL, 'CSM positioning where customer seeks strategic guidance beyond product. Built through expertise and reliability.', 'Core Concepts', ARRAY['CSM', 'EBR'], 'A trusted advisor is invited to strategic planning meetings.')
ON CONFLICT (term) DO NOTHING;

-- PLAYBOOKS (8 essential playbooks)
INSERT INTO playbooks (code, name, description, type, trigger_conditions, duration_days, phases, success_criteria, is_active) VALUES
('PB-ONB', 'Customer Onboarding', 'Guide new customers from contract to first value realization', 'lifecycle', 'New customer contract signed', 90,
 '[{"phase": 1, "name": "Kickoff", "duration_days": 7, "tasks": ["Send welcome email", "Schedule kickoff call", "Conduct kickoff meeting", "Identify stakeholders"]},
   {"phase": 2, "name": "Foundation", "duration_days": 21, "tasks": ["Validate technical setup", "Create Success Plan", "Begin weekly cadence", "Configure integrations"]},
   {"phase": 3, "name": "Adoption", "duration_days": 35, "tasks": ["Drive first use case", "Conduct enablement sessions", "Monitor usage metrics", "Address blockers"]},
   {"phase": 4, "name": "Value Confirmation", "duration_days": 27, "tasks": ["Document first value", "Transition to steady-state", "Update health score", "Schedule first EBR"]}]'::jsonb,
 '["First value milestone documented", "Health score Green", "Steady-state cadence established"]'::jsonb, true),

('PB-EBR', 'Executive Business Review', 'Prepare and execute strategic EBR with customer executives', 'lifecycle', 'EBR due (quarterly/annual)', 21,
 '[{"phase": 1, "name": "Planning", "duration_days": 7, "tasks": ["Confirm date with customer", "Identify required attendees", "Review Success Plan progress", "Gather ROI data"]},
   {"phase": 2, "name": "Content Development", "duration_days": 7, "tasks": ["Build presentation", "Create usage story", "Prepare roadmap items", "Create EBR Fact Sheet"]},
   {"phase": 3, "name": "Execution", "duration_days": 5, "tasks": ["Share agenda with champion", "Confirm attendance", "Deliver EBR", "Conduct debrief"]},
   {"phase": 4, "name": "Follow-up", "duration_days": 2, "tasks": ["Send summary email", "Log in Timeline", "Update Success Plan", "Create action CTAs"]}]'::jsonb,
 '["Economic Buyer attended", "Action items documented", "Next EBR scheduled"]'::jsonb, true),

('PB-TRI', 'Health Score Triage', 'Urgent intervention for Red health accounts', 'risk', 'Health score drops to Red', 14,
 '[{"phase": 1, "name": "Assessment", "duration_days": 2, "tasks": ["Review health components", "Identify root causes", "Review recent interactions", "Check support tickets"]},
   {"phase": 2, "name": "Alignment", "duration_days": 2, "tasks": ["Brief CSM Manager", "Sync with AE", "Engage Support if needed", "Create remediation plan"]},
   {"phase": 3, "name": "Engagement", "duration_days": 3, "tasks": ["Schedule urgent call", "Conduct discovery", "Validate hypothesis", "Agree on action plan"]},
   {"phase": 4, "name": "Resolution", "duration_days": 7, "tasks": ["Execute action plan", "Provide progress updates", "Confirm resolution", "Update health score"]}]'::jsonb,
 '["Health score improved to Yellow or Green", "Root cause addressed", "Customer confirmed satisfied"]'::jsonb, true),

('PB-NEC', 'Non-Engaged Customer Recovery', 'Re-engage customers with no contact for 60+ days', 'risk', 'No engagement logged for 60+ days', 30,
 '[{"phase": 1, "name": "Analysis", "duration_days": 3, "tasks": ["Review last interactions", "Check usage data", "Review support tickets", "Sync with AE"]},
   {"phase": 2, "name": "Multi-Channel Outreach", "duration_days": 14, "tasks": ["Send personalized email", "LinkedIn follow-up", "AE outreach", "Phone attempts"]},
   {"phase": 3, "name": "Value Refresh", "duration_days": 7, "tasks": ["Prepare re-engagement message", "Highlight new features", "Offer enablement session"]},
   {"phase": 4, "name": "Resolution", "duration_days": 6, "tasks": ["Escalate if no response", "Document final status", "Close or continue CTA"]}]'::jsonb,
 '["Customer re-engaged", "Cadence re-established", "Health score updated"]'::jsonb, true),

('PB-REN', 'Renewal Preparation', 'Ensure successful renewal 120 days out', 'lifecycle', 'Renewal date in 120 days', 120,
 '[{"phase": 1, "name": "Health Assessment", "duration_days": 30, "tasks": ["Review customer health", "Assess value realization", "Identify outstanding issues", "Sync with Renewals"]},
   {"phase": 2, "name": "Value Documentation", "duration_days": 30, "tasks": ["Compile ROI metrics", "Document success stories", "Prepare renewal business case"]},
   {"phase": 3, "name": "Stakeholder Alignment", "duration_days": 30, "tasks": ["Conduct pre-renewal EBR", "Confirm renewal intent", "Address concerns"]},
   {"phase": 4, "name": "Execution", "duration_days": 30, "tasks": ["Support Renewals Manager", "Address last-minute issues", "Confirm satisfaction", "Celebrate renewal"]}]'::jsonb,
 '["Renewal confirmed", "Contract signed", "Expansion identified"]'::jsonb, true),

('PB-CHU', 'Churn Prevention', 'Urgent save effort for customers indicating churn', 'risk', 'Customer indicates churn intent', 30,
 '[{"phase": 1, "name": "Urgent Assessment", "duration_days": 2, "tasks": ["Understand churn reason", "Assess save potential", "Identify decision maker", "Brief leadership"]},
   {"phase": 2, "name": "Discovery", "duration_days": 5, "tasks": ["Deep dive on concerns", "Understand alternatives", "Identify leverage points"]},
   {"phase": 3, "name": "Save Plan", "duration_days": 7, "tasks": ["Develop save strategy", "Get internal approvals", "Prepare offer if needed"]},
   {"phase": 4, "name": "Execution", "duration_days": 16, "tasks": ["Present save plan", "Execute commitments", "Monitor closely", "Document outcome"]}]'::jsonb,
 '["Customer saved OR clean churn processed", "Learnings documented"]'::jsonb, true),

('PB-EXP', 'Expansion Opportunity', 'Qualify and progress expansion opportunities', 'opportunity', 'Expansion signal identified', 60,
 '[{"phase": 1, "name": "Identification", "duration_days": 7, "tasks": ["Document expansion signal", "Review current usage", "Identify growth areas"]},
   {"phase": 2, "name": "Qualification", "duration_days": 14, "tasks": ["Conduct discovery", "Understand business drivers", "Identify stakeholders"]},
   {"phase": 3, "name": "Value Building", "duration_days": 21, "tasks": ["Build business case", "Demonstrate ROI", "Get champion buy-in"]},
   {"phase": 4, "name": "Handoff", "duration_days": 18, "tasks": ["Brief AE", "Facilitate introduction", "Support deal progression"]}]'::jsonb,
 '["Opportunity qualified", "Handed to sales", "Deal in pipeline"]'::jsonb, true),

('PB-HND', 'Account Handoff', 'Transition account between CSMs', 'lifecycle', 'CSM change required', 14,
 '[{"phase": 1, "name": "Documentation", "duration_days": 3, "tasks": ["Document account history", "Update Success Plans", "Close or transfer CTAs"]},
   {"phase": 2, "name": "Internal Handoff", "duration_days": 4, "tasks": ["Handoff meeting with new CSM", "Review all documentation", "Transfer ownership"]},
   {"phase": 3, "name": "Customer Introduction", "duration_days": 5, "tasks": ["Send transition email", "Warm handoff call", "Introduce new CSM"]},
   {"phase": 4, "name": "Completion", "duration_days": 2, "tasks": ["New CSM first call", "Close handoff CTA", "Verify transition"]}]'::jsonb,
 '["New CSM owns account", "Customer comfortable", "No information lost"]'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

-- SAMPLE CUSTOMERS (5 demo customers)
INSERT INTO customers (id, name, arr, segment, industry, health_score, health_color, renewal_date, contract_start_date, tier) VALUES
('c1000000-0000-0000-0000-000000000001', 'Acme Corporation', 150000, 'enterprise', 'Technology', 85, 'green', '2026-06-15', '2025-06-15', 'platinum'),
('c1000000-0000-0000-0000-000000000002', 'TechStart Inc', 45000, 'commercial', 'SaaS', 62, 'yellow', '2026-04-01', '2025-04-01', 'gold'),
('c1000000-0000-0000-0000-000000000003', 'Global Finance Ltd', 280000, 'enterprise', 'Financial Services', 35, 'red', '2026-03-15', '2024-03-15', 'platinum'),
('c1000000-0000-0000-0000-000000000004', 'HealthCare Plus', 95000, 'commercial', 'Healthcare', 78, 'yellow', '2026-08-01', '2025-08-01', 'gold'),
('c1000000-0000-0000-0000-000000000005', 'Retail Giants', 520000, 'enterprise', 'Retail', 91, 'green', '2026-12-01', '2024-12-01', 'platinum')
ON CONFLICT (id) DO UPDATE SET
  arr = EXCLUDED.arr,
  segment = EXCLUDED.segment,
  health_score = EXCLUDED.health_score,
  health_color = EXCLUDED.health_color;

-- SAMPLE HEALTH SCORES
INSERT INTO health_scores (customer_id, overall, overall_color, product, risk, outcomes, voice, engagement) VALUES
('c1000000-0000-0000-0000-000000000001', 85, 'green', 90, 80, 85, 80, 85),
('c1000000-0000-0000-0000-000000000002', 62, 'yellow', 70, 50, 60, 70, 60),
('c1000000-0000-0000-0000-000000000003', 35, 'red', 30, 20, 40, 50, 35),
('c1000000-0000-0000-0000-000000000004', 78, 'yellow', 80, 75, 75, 80, 80),
('c1000000-0000-0000-0000-000000000005', 91, 'green', 95, 90, 90, 85, 90);

-- SAMPLE CTAs
INSERT INTO ctas (customer_id, type, reason, priority, due_date, status) VALUES
('c1000000-0000-0000-0000-000000000003', 'risk', 'Health Score Triage - Red Account', 'high', CURRENT_DATE + INTERVAL '7 days', 'open'),
('c1000000-0000-0000-0000-000000000002', 'lifecycle', 'EBR Due - Q1 Review', 'medium', CURRENT_DATE + INTERVAL '14 days', 'open'),
('c1000000-0000-0000-0000-000000000001', 'opportunity', 'Expansion Signal - New Department', 'medium', CURRENT_DATE + INTERVAL '30 days', 'open'),
('c1000000-0000-0000-0000-000000000004', 'lifecycle', 'Renewal Prep - 6 Months Out', 'low', CURRENT_DATE + INTERVAL '60 days', 'open'),
('c1000000-0000-0000-0000-000000000005', 'opportunity', 'Upsell - Additional Licenses', 'high', CURRENT_DATE + INTERVAL '21 days', 'in_progress');

-- SAMPLE SUCCESS PLANS
INSERT INTO success_plans (customer_id, name, type, status, target_date) VALUES
('c1000000-0000-0000-0000-000000000001', 'Acme 2026 Growth Plan', 'expand', 'active', '2026-06-15'),
('c1000000-0000-0000-0000-000000000002', 'TechStart Adoption Plan', 'land', 'active', '2026-04-01'),
('c1000000-0000-0000-0000-000000000003', 'Global Finance Recovery Plan', 'renewal', 'active', '2026-03-15'),
('c1000000-0000-0000-0000-000000000005', 'Retail Giants Enterprise Expansion', 'expand', 'active', '2026-12-01');

-- SAMPLE TIMELINE ACTIVITIES
INSERT INTO timeline_activities (customer_id, type, subject, content) VALUES
('c1000000-0000-0000-0000-000000000001', 'call', 'Monthly Cadence Call', 'Discussed Q1 adoption metrics. Customer pleased with progress. Identified potential expansion in marketing team.'),
('c1000000-0000-0000-0000-000000000003', 'email', 'Urgent: Health Check Follow-up', 'Sent follow-up after missed cadence calls. Awaiting response from primary contact.'),
('c1000000-0000-0000-0000-000000000002', 'milestone', 'Completed Phase 2 Onboarding', 'Customer successfully completed technical setup. Moving to adoption phase.'),
('c1000000-0000-0000-0000-000000000005', 'in_person', 'Executive QBR', 'Met with CTO and VP Engineering. Very positive sentiment. Discussed 2026 roadmap alignment.');
