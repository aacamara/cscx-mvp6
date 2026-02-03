-- ============================================
-- PRD: Demo Customer Data Seeding
-- Migration: 065_demo_agent_activities.sql
-- Description: Insert sample agent activities for demo customers
-- ============================================

-- ============================================
-- AGENT ACTIVITY HISTORY
-- ============================================
-- Activity types: email, meeting, task, recommendation, analysis
-- Show variety of agent actions over past 60 days
-- ============================================

-- Clear existing demo agent activities
DELETE FROM agent_activity_log
WHERE customer_id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005'
);

-- ============================================
-- Acme Corporation Agent Activities
-- Healthy account - focus on growth and optimization
-- ============================================
INSERT INTO agent_activity_log (
  customer_id, agent_type, action_type, action_data, result_data, status, started_at, completed_at, duration_ms
) VALUES
-- Strategic QBR prep
(
  'd0000000-0000-0000-0000-000000000001',
  'strategic',
  'qbr_prep',
  '{"quarter": "Q1 2026", "stakeholders": ["Sarah Mitchell", "James Chen"], "topics": ["expansion", "roadmap", "value summary"]}',
  '{"presentation_created": true, "slides_count": 18, "data_sources": ["usage_metrics", "health_scores", "support_tickets"]}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '45 days',
  CURRENT_TIMESTAMP - INTERVAL '45 days' + INTERVAL '8 minutes',
  480000
),
-- Email sequence for expansion
(
  'd0000000-0000-0000-0000-000000000001',
  'adoption',
  'email_sequence',
  '{"sequence_type": "expansion_nurture", "recipients": ["sarah.mitchell@acmecorp.com"], "steps": 3}',
  '{"emails_sent": 3, "opens": 3, "replies": 2, "meeting_scheduled": true}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '30 days',
  CURRENT_TIMESTAMP - INTERVAL '30 days' + INTERVAL '2 minutes',
  120000
),
-- Usage analysis
(
  'd0000000-0000-0000-0000-000000000001',
  'adoption',
  'usage_analysis',
  '{"period": "last_30_days", "focus_areas": ["feature_adoption", "user_growth"]}',
  '{"dau_trend": "growing", "feature_adoption": 78, "recommendation": "Good candidate for advanced analytics module"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '15 days',
  CURRENT_TIMESTAMP - INTERVAL '15 days' + INTERVAL '3 minutes',
  180000
),
-- Meeting scheduled
(
  'd0000000-0000-0000-0000-000000000001',
  'onboarding',
  'meeting_scheduled',
  '{"meeting_type": "check_in", "attendees": ["James Chen", "Emily Rodriguez"], "duration_minutes": 30}',
  '{"calendar_event_id": "evt_abc123", "confirmed": true}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '7 days',
  CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '1 minute',
  60000
),
-- Expansion recommendation
(
  'd0000000-0000-0000-0000-000000000001',
  'renewal',
  'expansion_analysis',
  '{"current_arr": 450000, "license_utilization": 92}',
  '{"expansion_opportunity": true, "recommended_products": ["Advanced Analytics", "Enterprise API"], "potential_value": 75000}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '5 minutes',
  300000
);

-- ============================================
-- TechStart Inc Agent Activities
-- At-risk account - focus on intervention and save
-- ============================================
INSERT INTO agent_activity_log (
  customer_id, agent_type, action_type, action_data, result_data, status, started_at, completed_at, duration_ms
) VALUES
-- Risk detection
(
  'd0000000-0000-0000-0000-000000000002',
  'risk',
  'risk_assessment',
  '{"trigger": "health_score_drop", "previous_score": 62, "current_score": 45}',
  '{"risk_signals": ["champion_departed", "usage_declining", "support_tickets_up"], "severity": "high", "recommended_action": "save_play"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '50 days',
  CURRENT_TIMESTAMP - INTERVAL '50 days' + INTERVAL '4 minutes',
  240000
),
-- Outreach email
(
  'd0000000-0000-0000-0000-000000000002',
  'risk',
  'outreach_email',
  '{"recipient": "ryan.patel@techstart.io", "template": "health_check", "urgency": "high"}',
  '{"email_sent": true, "opened": true, "replied": false}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '45 days',
  CURRENT_TIMESTAMP - INTERVAL '45 days' + INTERVAL '30 seconds',
  30000
),
-- Follow-up attempt
(
  'd0000000-0000-0000-0000-000000000002',
  'risk',
  'outreach_email',
  '{"recipient": "ashley.brooks@techstart.io", "template": "new_contact_intro", "context": "champion_left"}',
  '{"email_sent": true, "opened": true, "replied": true}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '40 days',
  CURRENT_TIMESTAMP - INTERVAL '40 days' + INTERVAL '30 seconds',
  30000
),
-- Save play initiated
(
  'd0000000-0000-0000-0000-000000000002',
  'risk',
  'save_play',
  '{"arr_at_risk": 85000, "days_to_renewal": 90, "root_cause": "champion_departure"}',
  '{"save_play_created": true, "action_plan_items": 5, "escalation_level": 1}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '35 days',
  CURRENT_TIMESTAMP - INTERVAL '35 days' + INTERVAL '6 minutes',
  360000
),
-- Meeting request (still pending response)
(
  'd0000000-0000-0000-0000-000000000002',
  'risk',
  'meeting_request',
  '{"meeting_type": "executive_alignment", "requested_attendees": ["Ryan Patel"], "purpose": "relationship_recovery"}',
  '{"status": "pending", "attempts": 2}',
  'pending',
  CURRENT_TIMESTAMP - INTERVAL '20 days',
  NULL,
  NULL
);

-- ============================================
-- Global Logistics Agent Activities
-- Expansion account - focus on growth opportunities
-- ============================================
INSERT INTO agent_activity_log (
  customer_id, agent_type, action_type, action_data, result_data, status, started_at, completed_at, duration_ms
) VALUES
-- Usage analysis showing growth
(
  'd0000000-0000-0000-0000-000000000003',
  'adoption',
  'usage_analysis',
  '{"period": "last_60_days", "focus_areas": ["department_adoption", "feature_usage"]}',
  '{"growth_rate": 22, "new_departments": ["Warehouse West", "Procurement"], "power_users_identified": 8}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '55 days',
  CURRENT_TIMESTAMP - INTERVAL '55 days' + INTERVAL '4 minutes',
  240000
),
-- Cross-sell opportunity
(
  'd0000000-0000-0000-0000-000000000003',
  'renewal',
  'expansion_analysis',
  '{"trigger": "usage_threshold", "current_tier": "professional", "usage_level": "approaching_limit"}',
  '{"recommendation": "enterprise_upgrade", "potential_arr_increase": 80000, "confidence": 0.85}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '40 days',
  CURRENT_TIMESTAMP - INTERVAL '40 days' + INTERVAL '3 minutes',
  180000
),
-- Email to new champion
(
  'd0000000-0000-0000-0000-000000000003',
  'adoption',
  'email_sent',
  '{"recipient": "diana.santos@globallogistics.com", "subject": "Congrats on the CX award - partnership opportunity", "type": "relationship_building"}',
  '{"sent": true, "opened": true, "replied": true, "sentiment": "positive"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '30 days',
  CURRENT_TIMESTAMP - INTERVAL '30 days' + INTERVAL '1 minute',
  60000
),
-- Multi-department training
(
  'd0000000-0000-0000-0000-000000000003',
  'onboarding',
  'training_scheduled',
  '{"training_type": "advanced_features", "departments": ["Supply Chain", "Customer Experience"], "attendees": 12}',
  '{"event_created": true, "registrations": 12, "completion_rate": 0.92}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '20 days',
  CURRENT_TIMESTAMP - INTERVAL '20 days' + INTERVAL '2 minutes',
  120000
),
-- Stakeholder mapping update
(
  'd0000000-0000-0000-0000-000000000003',
  'strategic',
  'stakeholder_analysis',
  '{"trigger": "quarterly_review"}',
  '{"stakeholders_mapped": 8, "new_champions_identified": 2, "multi_threading_score": 85}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '10 days',
  CURRENT_TIMESTAMP - INTERVAL '10 days' + INTERVAL '5 minutes',
  300000
);

-- ============================================
-- HealthFirst Medical Agent Activities
-- Onboarding account - focus on adoption and time-to-value
-- ============================================
INSERT INTO agent_activity_log (
  customer_id, agent_type, action_type, action_data, result_data, status, started_at, completed_at, duration_ms
) VALUES
-- Kickoff completed
(
  'd0000000-0000-0000-0000-000000000004',
  'onboarding',
  'kickoff_call',
  '{"attendees": ["Dr. Katherine Hayes", "Brandon Lee"], "duration_minutes": 60, "objectives_defined": 3}',
  '{"success_plan_created": true, "timeline_agreed": true, "next_steps": 5}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '58 days',
  CURRENT_TIMESTAMP - INTERVAL '58 days' + INTERVAL '65 minutes',
  3900000
),
-- Technical setup assistance
(
  'd0000000-0000-0000-0000-000000000004',
  'onboarding',
  'integration_setup',
  '{"integration": "ehr_system", "complexity": "medium"}',
  '{"status": "connected", "data_flowing": true, "records_synced": 1250}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '50 days',
  CURRENT_TIMESTAMP - INTERVAL '50 days' + INTERVAL '45 minutes',
  2700000
),
-- Training session
(
  'd0000000-0000-0000-0000-000000000004',
  'onboarding',
  'training_completed',
  '{"training_type": "admin_basics", "attendees": ["Brandon Lee", "Nancy Cooper"], "modules": 4}',
  '{"completion_rate": 1.0, "quiz_score_avg": 88, "feedback": "positive"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '40 days',
  CURRENT_TIMESTAMP - INTERVAL '40 days' + INTERVAL '90 minutes',
  5400000
),
-- First value milestone
(
  'd0000000-0000-0000-0000-000000000004',
  'adoption',
  'milestone_achieved',
  '{"milestone": "first_value", "metric": "patient_response_time", "improvement": "25%"}',
  '{"documented": true, "shared_with_executive": true, "ttv_days": 35}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '25 days',
  CURRENT_TIMESTAMP - INTERVAL '25 days' + INTERVAL '2 minutes',
  120000
),
-- Weekly check-in
(
  'd0000000-0000-0000-0000-000000000004',
  'onboarding',
  'check_in_call',
  '{"week_number": 6, "topics": ["adoption_progress", "user_feedback", "blockers"]}',
  '{"issues_identified": 1, "action_items": 2, "health_score_trend": "improving"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '14 days',
  CURRENT_TIMESTAMP - INTERVAL '14 days' + INTERVAL '30 minutes',
  1800000
);

-- ============================================
-- RetailMax Agent Activities
-- Churning account - focus on issue resolution and recovery
-- ============================================
INSERT INTO agent_activity_log (
  customer_id, agent_type, action_type, action_data, result_data, status, started_at, completed_at, duration_ms
) VALUES
-- Churn signal detected
(
  'd0000000-0000-0000-0000-000000000005',
  'risk',
  'churn_signal_detected',
  '{"signal_type": "competitor_mention", "source": "support_ticket", "competitor": "CompetitorX"}',
  '{"severity": "high", "alert_sent": true, "escalation": true}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '55 days',
  CURRENT_TIMESTAMP - INTERVAL '55 days' + INTERVAL '1 minute',
  60000
),
-- Executive outreach
(
  'd0000000-0000-0000-0000-000000000005',
  'risk',
  'executive_outreach',
  '{"recipient": "victoria.chang@retailmax.com", "approach": "value_reminder", "assets_attached": ["value_summary.pdf"]}',
  '{"email_sent": true, "opened": false, "replied": false}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '50 days',
  CURRENT_TIMESTAMP - INTERVAL '50 days' + INTERVAL '2 minutes',
  120000
),
-- Support analysis
(
  'd0000000-0000-0000-0000-000000000005',
  'risk',
  'support_analysis',
  '{"period": "last_90_days"}',
  '{"ticket_count": 23, "avg_resolution_time": "48h", "recurring_issues": ["sync_errors", "slow_reports"], "sentiment": "negative"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '40 days',
  CURRENT_TIMESTAMP - INTERVAL '40 days' + INTERVAL '5 minutes',
  300000
),
-- Remediation plan
(
  'd0000000-0000-0000-0000-000000000005',
  'risk',
  'remediation_plan',
  '{"issues": ["sync_errors", "slow_reports"], "proposed_solutions": ["dedicated_support", "performance_optimization"]}',
  '{"plan_created": true, "approved_by_manager": true, "resources_allocated": 2}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '35 days',
  CURRENT_TIMESTAMP - INTERVAL '35 days' + INTERVAL '15 minutes',
  900000
),
-- Meeting with frustated user
(
  'd0000000-0000-0000-0000-000000000005',
  'risk',
  'relationship_recovery',
  '{"stakeholder": "Derek Johnson", "purpose": "listen_and_address_concerns"}',
  '{"meeting_completed": true, "issues_documented": 3, "commitment_made": true, "sentiment_change": "neutral"}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '25 days',
  CURRENT_TIMESTAMP - INTERVAL '25 days' + INTERVAL '45 minutes',
  2700000
),
-- Performance fix deployed
(
  'd0000000-0000-0000-0000-000000000005',
  'adoption',
  'issue_resolution',
  '{"issue": "slow_reports", "solution": "query_optimization"}',
  '{"improvement": "65% faster", "user_notified": true, "feedback_requested": true}',
  'completed',
  CURRENT_TIMESTAMP - INTERVAL '15 days',
  CURRENT_TIMESTAMP - INTERVAL '15 days' + INTERVAL '5 minutes',
  300000
),
-- Ongoing monitoring
(
  'd0000000-0000-0000-0000-000000000005',
  'risk',
  'health_monitoring',
  '{"frequency": "daily", "focus": ["usage", "support_tickets", "sentiment"]}',
  '{"status": "active", "alerts_configured": true, "escalation_path": "manager"}',
  'pending',
  CURRENT_TIMESTAMP - INTERVAL '10 days',
  NULL,
  NULL
);

-- ============================================
-- Verify insertion
-- ============================================
DO $$
DECLARE
  activity_count INT;
BEGIN
  SELECT COUNT(*) INTO activity_count
  FROM agent_activity_log
  WHERE customer_id IN (
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005'
  );

  RAISE NOTICE 'Demo agent activities inserted: % (expected ~27)', activity_count;
END $$;
