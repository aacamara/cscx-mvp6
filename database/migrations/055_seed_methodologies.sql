-- PRD: Knowledge Base Population & CSM Capability Index
-- Seed initial methodologies for core capabilities

-- Clear existing methodologies for re-seeding
DELETE FROM methodologies;

-- QBR Generation Methodology
INSERT INTO methodologies (id, name, category, applicable_to, steps, quality_criteria, common_mistakes, templates, examples) VALUES
('qbr_methodology', 'QBR Best Practices', 'document_generation', ARRAY['qbr_generation'],
 '[
   {"order": 1, "name": "Data Gathering", "description": "Collect all relevant customer data", "actions": ["Pull customer 360 profile", "Get health score trends (last 2 quarters)", "Retrieve engagement metrics", "Find previous QBR for comparison", "Check for open risks and opportunities"], "dataNeeded": ["customer_360", "health_trends", "engagement_metrics", "previous_qbr"], "tips": ["Look for patterns, not just numbers", "Compare to cohort averages"]},
   {"order": 2, "name": "Executive Summary", "description": "Create a compelling 30-second overview", "actions": ["Summarize relationship health in one sentence", "Highlight top 3 wins", "Note 1-2 focus areas", "Include renewal/expansion status"], "dataNeeded": ["health_score", "wins", "risks", "renewal_date"], "tips": ["Lead with positive", "Be specific with numbers", "End with forward-looking statement"]},
   {"order": 3, "name": "Metrics Deep Dive", "description": "Show the data that tells the story", "actions": ["Present health score with trend", "Show product adoption metrics", "Include usage statistics", "Compare to goals set last quarter"], "dataNeeded": ["health_trends", "adoption_metrics", "usage_data", "previous_goals"], "tips": ["Use visualizations", "Show quarter-over-quarter change", "Benchmark against peers"]},
   {"order": 4, "name": "Wins & Value", "description": "Celebrate successes and quantify value", "actions": ["List major milestones achieved", "Calculate ROI or value delivered", "Include customer quotes if available", "Reference success metrics from kickoff"], "dataNeeded": ["milestones", "value_metrics", "customer_feedback"], "tips": ["Use customer words when possible", "Tie wins to their business goals"]},
   {"order": 5, "name": "Risks & Challenges", "description": "Address concerns proactively", "actions": ["Identify current risk signals", "Acknowledge known issues", "Present mitigation plans", "Show progress on previous concerns"], "dataNeeded": ["risk_signals", "open_tickets", "previous_action_items"], "tips": ["Be honest but solution-oriented", "Show you are on top of issues"]},
   {"order": 6, "name": "Roadmap & Future", "description": "Look ahead and align on next steps", "actions": ["Share relevant product roadmap items", "Discuss expansion opportunities", "Align on Q+1 goals", "Address renewal if applicable"], "dataNeeded": ["product_roadmap", "expansion_opportunities", "renewal_info"], "tips": ["Tie roadmap to their needs", "Create excitement for what is coming"]}
 ]'::jsonb,
 '["Executive summary fits in 30 seconds", "Every metric has context (trend, benchmark)", "Wins are quantified with business impact", "Risks have mitigation plans", "Clear action items with owners and dates"]'::jsonb,
 '["Too many slides (keep under 15)", "Data without insights", "Ignoring elephants in the room", "No clear ask or next steps", "Generic content not personalized to customer"]'::jsonb,
 '[{"name": "Executive Summary Slide", "format": "text", "content": "# Q{quarter} Business Review\\n## {customer_name}\\n\\n**Relationship Health:** {health_score}% ({trend})\\n\\n**Key Wins:**\\n• {win_1}\\n• {win_2}\\n• {win_3}\\n\\n**Focus Areas:**\\n• {focus_1}\\n• {focus_2}\\n\\n**Renewal Status:** {renewal_status}"}]'::jsonb,
 '[{"scenario": "Healthy enterprise customer", "input": {"healthScore": 85, "trend": "improving", "hasExpansion": true}, "output": "Focus on expansion discussion and roadmap alignment"}, {"scenario": "At-risk customer", "input": {"healthScore": 55, "trend": "declining", "hasTickets": true}, "output": "Lead with acknowledgment, show mitigation plan, focus on stabilization"}]'::jsonb),

-- Onboarding Plan Methodology
('onboarding_methodology', 'Onboarding Best Practices', 'onboarding', ARRAY['onboarding_plan'],
 '[
   {"order": 1, "name": "Discovery & Goals", "description": "Understand customer objectives and success criteria", "actions": ["Review sales handoff notes", "Identify key stakeholders", "Document success metrics", "Understand technical requirements"], "dataNeeded": ["sales_handoff", "stakeholders", "contract_details"], "tips": ["Ask about their definition of success", "Understand their timeline pressure"]},
   {"order": 2, "name": "Kickoff Planning", "description": "Plan and schedule kickoff meeting", "actions": ["Create kickoff agenda", "Invite all stakeholders", "Prepare onboarding materials", "Set expectations for timeline"], "dataNeeded": ["stakeholder_calendar", "templates"], "tips": ["Include executive sponsor if possible", "Share agenda in advance"]},
   {"order": 3, "name": "Technical Setup", "description": "Configure product and integrations", "actions": ["Complete technical onboarding checklist", "Configure integrations", "Set up user accounts", "Test configurations"], "dataNeeded": ["technical_requirements", "integration_needs"], "tips": ["Document any blockers immediately", "Involve technical contacts early"]},
   {"order": 4, "name": "Training & Adoption", "description": "Train users and drive initial adoption", "actions": ["Schedule training sessions", "Create training materials", "Track completion", "Gather feedback"], "dataNeeded": ["user_list", "training_needs"], "tips": ["Customize training to their use cases", "Create champions among power users"]},
   {"order": 5, "name": "Go-Live & Support", "description": "Launch and provide hypercare support", "actions": ["Confirm go-live date", "Establish support escalation path", "Monitor early usage", "Address issues quickly"], "dataNeeded": ["launch_date", "support_contacts"], "tips": ["Be highly available in first 2 weeks", "Celebrate early wins"]},
   {"order": 6, "name": "Success Review", "description": "Review progress and transition to steady state", "actions": ["Review against success metrics", "Document learnings", "Transition to regular cadence", "Plan first QBR"], "dataNeeded": ["metrics", "feedback"], "tips": ["Capture customer quotes", "Set up health monitoring"]}
 ]'::jsonb,
 '["Clear success metrics defined", "All stakeholders engaged", "Training completed before go-live", "Usage metrics tracked from day 1", "Smooth transition to steady state"]'::jsonb,
 '["Rushing to go-live without proper training", "Ignoring executive sponsor", "Not documenting blockers", "Waiting too long to address issues", "No clear success criteria"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb),

-- Risk Assessment Methodology
('risk_methodology', 'Risk Assessment Best Practices', 'risk_management', ARRAY['risk_assessment', 'churn_analysis'],
 '[
   {"order": 1, "name": "Signal Detection", "description": "Identify and categorize risk signals", "actions": ["Review health score components", "Check engagement trends", "Analyze support tickets", "Review payment status", "Check for champion changes"], "dataNeeded": ["health_score", "engagement_metrics", "tickets", "payments", "contacts"], "tips": ["Look for sudden changes", "Multiple weak signals can indicate major risk"]},
   {"order": 2, "name": "Root Cause Analysis", "description": "Understand the underlying causes", "actions": ["Talk to customer contacts", "Review recent interactions", "Analyze product usage data", "Check for external factors"], "dataNeeded": ["interaction_history", "usage_data", "news"], "tips": ["Ask open-ended questions", "Look for patterns across data"]},
   {"order": 3, "name": "Risk Scoring", "description": "Quantify and prioritize the risk", "actions": ["Score each risk factor", "Calculate overall risk level", "Compare to similar accounts", "Determine urgency"], "dataNeeded": ["risk_signals", "cohort_data"], "tips": ["Consider ARR in prioritization", "Account for renewal timeline"]},
   {"order": 4, "name": "Mitigation Planning", "description": "Develop action plan to address risks", "actions": ["Identify appropriate save plays", "Assign ownership", "Set timeline", "Define success metrics"], "dataNeeded": ["playbooks", "resources"], "tips": ["Act quickly on critical risks", "Involve leadership for high-value accounts"]},
   {"order": 5, "name": "Execution & Tracking", "description": "Execute plan and monitor progress", "actions": ["Execute save play", "Track customer response", "Adjust approach as needed", "Document learnings"], "dataNeeded": ["action_items", "customer_feedback"], "tips": ["Be persistent but not pushy", "Celebrate small wins"]}
 ]'::jsonb,
 '["All risk signals identified", "Root cause understood", "Clear mitigation plan", "Ownership assigned", "Progress tracked"]'::jsonb,
 '["Waiting too long to act", "Focusing on symptoms not causes", "Not involving leadership", "One-size-fits-all approach", "Not documenting learnings"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb),

-- Renewal Forecast Methodology
('renewal_methodology', 'Renewal Forecast Best Practices', 'renewal', ARRAY['renewal_forecast'],
 '[
   {"order": 1, "name": "Health Assessment", "description": "Evaluate current customer health", "actions": ["Review health score and trend", "Check NPS/CSAT scores", "Analyze product adoption", "Review support history"], "dataNeeded": ["health_score", "nps", "adoption", "tickets"], "tips": ["Look at trajectory not just current state", "Compare to pre-renewal baseline"]},
   {"order": 2, "name": "Relationship Mapping", "description": "Understand key stakeholder positions", "actions": ["Identify decision makers", "Assess champion strength", "Check for stakeholder changes", "Map competitive threats"], "dataNeeded": ["contacts", "org_changes", "competitive_intel"], "tips": ["Know who signs the check", "Watch for champion departures"]},
   {"order": 3, "name": "Value Documentation", "description": "Quantify delivered value", "actions": ["Calculate ROI metrics", "Document achieved outcomes", "Gather customer testimonials", "Compare to original goals"], "dataNeeded": ["metrics", "goals", "feedback"], "tips": ["Use their numbers not ours", "Tie to business outcomes"]},
   {"order": 4, "name": "Probability Calculation", "description": "Score renewal probability", "actions": ["Weight health factors", "Factor in relationship strength", "Consider external factors", "Account for competitive pressure"], "dataNeeded": ["all_signals"], "tips": ["Be realistic not optimistic", "Document assumptions"]},
   {"order": 5, "name": "Action Planning", "description": "Develop renewal strategy", "actions": ["Identify risks to address", "Plan executive engagement", "Prepare value presentation", "Determine pricing strategy"], "dataNeeded": ["risks", "value_metrics", "pricing"], "tips": ["Start early (90+ days)", "Involve leadership for strategic accounts"]}
 ]'::jsonb,
 '["Comprehensive health assessment", "All stakeholders mapped", "Value clearly documented", "Realistic probability score", "Clear action plan"]'::jsonb,
 '["Starting too late", "Overconfidence in health scores", "Ignoring champion changes", "Not documenting value", "One-size-fits-all pricing"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb),

-- Expansion Analysis Methodology
('expansion_methodology', 'Expansion Analysis Best Practices', 'expansion', ARRAY['expansion_analysis'],
 '[
   {"order": 1, "name": "Opportunity Identification", "description": "Identify expansion signals", "actions": ["Review usage patterns", "Identify power users", "Check for growth indicators", "Analyze feature requests"], "dataNeeded": ["usage_data", "users", "requests"], "tips": ["Look for usage ceiling hits", "Watch for new use cases emerging"]},
   {"order": 2, "name": "Fit Assessment", "description": "Evaluate fit for additional products", "actions": ["Match needs to offerings", "Assess technical readiness", "Check budget cycle timing", "Evaluate stakeholder appetite"], "dataNeeded": ["products", "budget_info", "contacts"], "tips": ["Time with budget cycles", "Find internal champions"]},
   {"order": 3, "name": "Value Modeling", "description": "Build business case for expansion", "actions": ["Calculate additional ROI", "Model productivity gains", "Project cost savings", "Create comparison scenarios"], "dataNeeded": ["pricing", "usage", "benchmarks"], "tips": ["Use their success metrics", "Show conservative and optimistic scenarios"]},
   {"order": 4, "name": "Strategy Development", "description": "Create expansion approach", "actions": ["Identify decision makers", "Plan stakeholder engagement", "Prepare proposal", "Determine timing"], "dataNeeded": ["contacts", "calendar"], "tips": ["Build internal consensus first", "Start with quick wins"]},
   {"order": 5, "name": "Execution", "description": "Execute expansion play", "actions": ["Schedule expansion discussions", "Present business case", "Handle objections", "Close and implement"], "dataNeeded": ["proposal", "objection_handlers"], "tips": ["Listen more than pitch", "Be patient but persistent"]}
 ]'::jsonb,
 '["Clear expansion signals identified", "Strong business case", "Decision makers engaged", "Timing aligned with budget", "Internal champions identified"]'::jsonb,
 '["Pushing too hard too fast", "Ignoring adoption issues", "Not building internal consensus", "Generic pitch not customized", "Poor timing with budget cycles"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb);

-- Create indexes for the new data
ANALYZE methodologies;
