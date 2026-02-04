-- PRD: CADG Complete Cards - Capability Seeds
-- Add capabilities for all 23+ CADG card types with comprehensive trigger patterns
-- Uses UPSERT to handle existing capabilities gracefully

-- ============================================================================
-- ONBOARDING SPECIALIST CARDS (4 cards)
-- ============================================================================

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('kickoff_plan', 'Kickoff Plan', 'onboarding', 'Generate a comprehensive kickoff meeting plan with agenda, attendees, goals, and next steps',
 '["kickoff plan", "build kickoff", "kickoff agenda", "kickoff meeting", "new customer kickoff", "kickoff deck", "kickoff prep", "prepare kickoff", "create kickoff", "customer kickoff", "implementation kickoff", "project kickoff", "welcome meeting", "initial meeting plan", "first meeting agenda", "onboarding kickoff", "kickoff session", "launch meeting", "go-live meeting", "customer welcome"]'::jsonb,
 ARRAY['kickoff', 'plan', 'agenda', 'meeting', 'onboarding', 'welcome', 'initial', 'first', 'launch', 'go-live', 'implementation'],
 '["Build me a kickoff plan for Acme Corp", "Create a kickoff meeting agenda", "Prepare the kickoff deck for our new customer", "Generate a customer welcome meeting plan"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Kickoff plan document"}]'::jsonb,
 '{"service": "CADGService", "method": "generateKickoffPlan", "requiresApproval": true, "estimatedDuration": "30-45 seconds"}'::jsonb,
 ARRAY['milestone_plan', 'stakeholder_map', 'onboarding_plan'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('milestone_plan', '30-60-90 Day Plan', 'onboarding', 'Generate a 30-60-90 day milestone plan with goals, milestones, success criteria, and owners for each phase',
 '["30-60-90", "30 60 90", "milestone plan", "first 90 days", "onboarding timeline", "implementation plan", "launch plan", "90 day plan", "first 30 days", "onboarding milestones", "success milestones", "phase plan", "implementation timeline", "customer journey plan", "adoption milestones", "onboarding roadmap", "time to value", "go-live timeline", "deployment plan", "rollout schedule"]'::jsonb,
 ARRAY['milestone', 'plan', '30', '60', '90', 'days', 'onboarding', 'timeline', 'implementation', 'phases', 'goals', 'roadmap'],
 '["Create a 30-60-90 day plan for Acme", "Build milestone plan for onboarding", "Generate a first 90 days roadmap", "Create implementation timeline"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "30-60-90 day milestone plan"}, {"type": "sheets", "format": "google_sheets", "description": "Milestone tracker"}]'::jsonb,
 '{"service": "CADGService", "method": "generateMilestonePlan", "requiresApproval": true, "estimatedDuration": "30-45 seconds"}'::jsonb,
 ARRAY['kickoff_plan', 'training_schedule', 'success_plan'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('stakeholder_map', 'Stakeholder Map', 'research', 'Generate a stakeholder map with contact cards, role classifications, influence levels, and relationships',
 '["stakeholder map", "stakeholder analysis", "key contacts", "org chart", "contact map", "decision makers", "power map", "influence map", "relationship map", "stakeholder mapping", "map stakeholders", "org structure", "customer contacts", "champion mapping", "executive mapping", "key players", "buying committee", "decision matrix", "political map", "relationship network"]'::jsonb,
 ARRAY['stakeholder', 'map', 'contacts', 'org', 'chart', 'decision', 'maker', 'champion', 'influence', 'relationship', 'executive'],
 '["Map stakeholders at Acme", "Create a stakeholder analysis", "Who are the key contacts?", "Build an org chart for this customer", "Identify decision makers"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "slides", "format": "google_slides", "description": "Stakeholder map visual"}, {"type": "docs", "format": "google_docs", "description": "Stakeholder details document"}]'::jsonb,
 '{"service": "CADGService", "method": "generateStakeholderMap", "requiresApproval": true, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['customer_research', 'champion_development', 'executive_briefing'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('training_schedule', 'Training Schedule', 'onboarding', 'Generate a training schedule with sessions, dates, attendee groups, topics, and trainers',
 '["training schedule", "training calendar", "training plan", "training sessions", "schedule training", "learning schedule", "education plan", "training agenda", "onboarding training", "user training", "admin training", "product training", "feature training", "certification schedule", "enablement schedule", "training roadmap", "training dates", "training logistics", "session planning", "training timetable"]'::jsonb,
 ARRAY['training', 'schedule', 'calendar', 'sessions', 'learning', 'education', 'enablement', 'certification', 'onboarding'],
 '["Create training schedule for Acme", "Build a training calendar", "Schedule training sessions", "Plan user training", "Generate onboarding training schedule"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "Training calendar"}, {"type": "docs", "format": "google_docs", "description": "Training schedule document"}]'::jsonb,
 '{"service": "CADGService", "method": "generateTrainingSchedule", "requiresApproval": true, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['training_program', 'milestone_plan', 'kickoff_plan'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

-- ============================================================================
-- ADOPTION SPECIALIST CARDS (4 cards)
-- ============================================================================

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('usage_analysis', 'Usage Analysis', 'data_analysis', 'Generate comprehensive usage analysis with metrics, feature adoption, user segments, and recommendations',
 '["usage analysis", "usage report", "analyze usage", "feature adoption", "adoption report", "engagement analysis", "user activity report", "product usage", "usage metrics", "usage trends", "adoption analysis", "feature usage", "user engagement", "activity analysis", "usage breakdown", "login analysis", "dau mau", "active users", "usage patterns", "engagement metrics"]'::jsonb,
 ARRAY['usage', 'analysis', 'adoption', 'engagement', 'metrics', 'activity', 'features', 'users', 'patterns', 'trends'],
 '["Analyze usage for Acme", "Generate usage report", "Show feature adoption", "Create engagement analysis", "What''s the usage trend?"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}, {"name": "timeRange", "type": "string", "source": "user", "required": false}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "Usage metrics data"}, {"type": "docs", "format": "google_docs", "description": "Usage analysis summary"}]'::jsonb,
 '{"service": "CADGService", "method": "generateUsageAnalysis", "requiresApproval": false, "estimatedDuration": "20-30 seconds"}'::jsonb,
 ARRAY['feature_campaign', 'health_analysis', 'engagement_report'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('feature_campaign', 'Feature Campaign', 'expansion', 'Generate a feature adoption campaign plan with targets, segments, timeline, messaging, and success metrics',
 '["feature campaign", "drive adoption", "increase adoption", "adoption campaign", "feature rollout", "promote feature", "underutilized features", "boost usage", "feature enablement", "adoption push", "feature promotion", "usage campaign", "engagement campaign", "adoption drive", "feature adoption plan", "adoption strategy", "feature marketing", "internal marketing", "feature launch", "adoption initiative"]'::jsonb,
 ARRAY['feature', 'campaign', 'adoption', 'promotion', 'rollout', 'usage', 'engagement', 'boost', 'drive', 'enable'],
 '["Create feature campaign for Acme", "Drive adoption of feature X", "Build an adoption campaign", "Promote underutilized features", "Generate feature rollout plan"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Feature campaign plan"}]'::jsonb,
 '{"service": "CADGService", "method": "generateFeatureCampaign", "requiresApproval": true, "estimatedDuration": "30-40 seconds"}'::jsonb,
 ARRAY['usage_analysis', 'champion_development', 'training_program'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('champion_development', 'Champion Development', 'expansion', 'Generate a champion development program with candidate selection, activities, rewards, timeline, and metrics',
 '["champion development", "champion program", "develop champions", "customer champions", "champion candidates", "identify champions", "nurture champions", "power users", "advocate program", "champion building", "super users", "champion network", "advocacy program", "champion cultivation", "user advocates", "internal champions", "product champions", "champion identification", "champion engagement", "champion strategy"]'::jsonb,
 ARRAY['champion', 'development', 'program', 'advocate', 'power', 'users', 'super', 'network', 'cultivation', 'engagement'],
 '["Create champion program for Acme", "Develop customer champions", "Identify champion candidates", "Build advocate program", "Generate champion development plan"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Champion development plan"}]'::jsonb,
 '{"service": "CADGService", "method": "generateChampionDevelopment", "requiresApproval": true, "estimatedDuration": "30-40 seconds"}'::jsonb,
 ARRAY['stakeholder_map', 'feature_campaign', 'expansion_analysis'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('training_program', 'Training Program', 'onboarding', 'Generate a comprehensive training curriculum with modules, objectives, assessments, and progress tracking',
 '["training program", "training curriculum", "learning program", "training modules", "training course", "learning path", "onboarding curriculum", "certification program", "education program", "enablement program", "training content", "learning objectives", "training assessment", "competency program", "skills program", "knowledge program", "training framework", "learning curriculum", "training materials", "course design"]'::jsonb,
 ARRAY['training', 'program', 'curriculum', 'learning', 'modules', 'course', 'certification', 'education', 'enablement', 'skills'],
 '["Create training program for Acme", "Build learning curriculum", "Design training modules", "Generate certification program", "Create onboarding curriculum"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Training curriculum document"}, {"type": "sheets", "format": "google_sheets", "description": "Progress tracker"}]'::jsonb,
 '{"service": "CADGService", "method": "generateTrainingProgram", "requiresApproval": true, "estimatedDuration": "35-45 seconds"}'::jsonb,
 ARRAY['training_schedule', 'feature_campaign', 'milestone_plan'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

-- ============================================================================
-- RENEWAL SPECIALIST CARDS (4 cards)
-- ============================================================================

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('renewal_forecast', 'Renewal Forecast', 'renewal', 'Generate a renewal probability forecast with scoring factors, risk analysis, positive signals, and recommended actions',
 '["renewal forecast", "renewal prediction", "renewal probability", "renewal likelihood", "forecast renewal", "predict renewal", "renewal outlook", "renewal projections", "will they renew", "renewal risk", "renewal chance", "renewal health", "renewal assessment", "renewal readiness", "churn prediction", "retention forecast", "renewal scoring", "renewal model", "renewal analysis", "renewal estimate"]'::jsonb,
 ARRAY['renewal', 'forecast', 'prediction', 'probability', 'likelihood', 'churn', 'retention', 'scoring', 'risk', 'readiness'],
 '["What''s the renewal forecast for Acme?", "Predict renewal probability", "Will this customer renew?", "Generate renewal prediction", "Assess renewal likelihood"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "Renewal forecast model"}]'::jsonb,
 '{"service": "CADGService", "method": "generateRenewalForecast", "requiresApproval": false, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['risk_assessment', 'value_summary', 'negotiation_brief'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('value_summary', 'Value Summary', 'renewal', 'Generate a value realization summary with metrics, success stories, testimonials, and ROI calculations',
 '["value summary", "value realization", "roi summary", "roi report", "roi calculation", "success metrics", "value delivered", "business value", "customer value", "demonstrate value", "show value", "prove value", "value report", "impact summary", "business impact", "value proposition", "outcomes report", "benefits summary", "value achieved", "success summary"]'::jsonb,
 ARRAY['value', 'summary', 'roi', 'realization', 'impact', 'success', 'benefits', 'outcomes', 'business', 'demonstrate'],
 '["Create value summary for Acme", "Generate ROI report", "Demonstrate value delivered", "Show business impact", "Build value realization summary"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "slides", "format": "google_slides", "description": "Value summary presentation"}]'::jsonb,
 '{"service": "CADGService", "method": "generateValueSummary", "requiresApproval": true, "estimatedDuration": "35-45 seconds"}'::jsonb,
 ARRAY['renewal_forecast', 'expansion_proposal', 'qbr_generation'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('expansion_proposal', 'Expansion Proposal', 'expansion', 'Generate an expansion proposal with products, pricing options, business case, and ROI projections',
 '["expansion proposal", "upsell proposal", "growth proposal", "upgrade proposal", "account expansion", "pricing proposal", "cross-sell", "expansion plan", "upsell plan", "growth plan", "upgrade plan", "add-on proposal", "expansion opportunity", "upsell opportunity", "commercial proposal", "deal proposal", "revenue proposal", "expansion quote", "expansion offer", "growth opportunity"]'::jsonb,
 ARRAY['expansion', 'proposal', 'upsell', 'growth', 'upgrade', 'pricing', 'cross-sell', 'commercial', 'deal', 'revenue'],
 '["Create expansion proposal for Acme", "Build upsell proposal", "Generate upgrade plan", "Create pricing proposal", "Propose account expansion"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Expansion proposal document"}]'::jsonb,
 '{"service": "CADGService", "method": "generateExpansionProposal", "requiresApproval": true, "estimatedDuration": "30-40 seconds"}'::jsonb,
 ARRAY['value_summary', 'negotiation_brief', 'expansion_analysis'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('negotiation_brief', 'Negotiation Brief', 'renewal', 'Generate a negotiation preparation brief with contract terms, leverage points, counter-strategies, and walk-away points',
 '["negotiation brief", "negotiation prep", "negotiation strategy", "renewal negotiation", "contract negotiation", "negotiate renewal", "prepare negotiation", "leverage points", "counter strategy", "walk-away", "walkaway", "bargaining", "deal terms", "negotiation plan", "negotiation tactics", "price negotiation", "contract terms", "deal strategy", "negotiation playbook", "commercial negotiation"]'::jsonb,
 ARRAY['negotiation', 'brief', 'prep', 'strategy', 'leverage', 'counter', 'walk-away', 'bargaining', 'terms', 'deal'],
 '["Create negotiation brief for Acme", "Prepare for renewal negotiation", "Build negotiation strategy", "Identify leverage points", "Generate negotiation prep"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Negotiation brief document"}]'::jsonb,
 '{"service": "CADGService", "method": "generateNegotiationBrief", "requiresApproval": true, "estimatedDuration": "30-40 seconds"}'::jsonb,
 ARRAY['renewal_forecast', 'expansion_proposal', 'value_summary'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

-- ============================================================================
-- RISK SPECIALIST CARDS (4 cards)
-- ============================================================================

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('risk_assessment', 'Risk Assessment', 'risk_management', 'Generate a comprehensive risk assessment with risk factors, severity analysis, mitigation actions, and tracking',
 '["risk assessment", "risk analysis", "churn risk", "at-risk", "at risk", "assess risk", "evaluate risk", "risk profile", "risk factors", "mitigation plan", "health risk", "account risk", "risk score", "risk evaluation", "risk identification", "risk review", "customer risk", "risk report", "threat assessment", "risk mitigation"]'::jsonb,
 ARRAY['risk', 'assessment', 'analysis', 'churn', 'at-risk', 'mitigation', 'factors', 'score', 'evaluation', 'threat'],
 '["Assess risk for Acme", "Generate risk analysis", "What are the risk factors?", "Create risk assessment", "Evaluate churn risk"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Risk assessment document"}, {"type": "sheets", "format": "google_sheets", "description": "Risk tracker"}]'::jsonb,
 '{"service": "CADGService", "method": "generateRiskAssessment", "requiresApproval": false, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['save_play', 'renewal_forecast', 'escalation_report'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('save_play', 'Save Play', 'risk_management', 'Generate a save play with root cause analysis, action items, owners, timeline, and success metrics',
 '["save play", "save this customer", "save the customer", "save account", "churn save", "retention play", "retention plan", "prevent churn", "rescue plan", "intervention plan", "turnaround plan", "win back", "save strategy", "recovery plan", "at-risk play", "churn prevention", "retention strategy", "save motion", "rescue strategy", "keep customer"]'::jsonb,
 ARRAY['save', 'play', 'retention', 'churn', 'rescue', 'intervention', 'turnaround', 'win', 'back', 'recovery', 'prevention'],
 '["Create save play for Acme", "Save this customer", "Build retention plan", "Generate rescue strategy", "Prevent churn for this account"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Save play document"}, {"type": "sheets", "format": "google_sheets", "description": "Action tracker"}]'::jsonb,
 '{"service": "CADGService", "method": "generateSavePlay", "requiresApproval": true, "estimatedDuration": "30-40 seconds"}'::jsonb,
 ARRAY['risk_assessment', 'escalation_report', 'resolution_plan'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('escalation_report', 'Escalation Report', 'risk_management', 'Generate an escalation report with timeline, impact metrics, resolution requests, and supporting evidence',
 '["escalation report", "escalation", "escalate this", "escalate issue", "executive escalation", "urgent escalation", "escalate to", "raise escalation", "formal escalation", "critical issue", "create escalation", "escalation document", "escalation summary", "management escalation", "leadership escalation", "escalation request", "urgent issue", "priority escalation", "issue escalation", "problem escalation"]'::jsonb,
 ARRAY['escalation', 'report', 'escalate', 'urgent', 'critical', 'issue', 'executive', 'management', 'leadership', 'priority'],
 '["Create escalation report for Acme", "Escalate this issue", "Generate executive escalation", "Build escalation document", "Raise formal escalation"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Escalation report document"}]'::jsonb,
 '{"service": "CADGService", "method": "generateEscalationReport", "requiresApproval": true, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['risk_assessment', 'save_play', 'resolution_plan'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('resolution_plan', 'Resolution Plan', 'risk_management', 'Generate a resolution plan with issues, action items, owners, dependencies, and status tracking',
 '["resolution plan", "action plan", "issue resolution", "problem resolution", "fix plan", "remediation plan", "corrective action", "resolve issues", "address issues", "issue tracker", "action tracker", "problem plan", "issue plan", "solution plan", "resolution strategy", "fix strategy", "problem solving", "issue management", "corrective plan", "recovery action"]'::jsonb,
 ARRAY['resolution', 'plan', 'action', 'issue', 'fix', 'remediation', 'corrective', 'solve', 'address', 'tracker'],
 '["Create resolution plan for Acme", "Generate action plan", "Build issue resolution plan", "Address open issues", "Create remediation plan"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Resolution plan document"}, {"type": "sheets", "format": "google_sheets", "description": "Issue tracker"}]'::jsonb,
 '{"service": "CADGService", "method": "generateResolutionPlan", "requiresApproval": true, "estimatedDuration": "30-40 seconds"}'::jsonb,
 ARRAY['escalation_report', 'save_play', 'risk_assessment'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

-- ============================================================================
-- STRATEGIC CSM CARDS (3 new cards, QBR exists)
-- ============================================================================

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('executive_briefing', 'Executive Briefing', 'document_generation', 'Generate a concise executive briefing with headlines, key metrics, strategic updates, and asks',
 '["executive briefing", "exec briefing", "executive summary", "leadership briefing", "board briefing", "executive deck", "executive presentation", "brief leadership", "leadership presentation", "stakeholder briefing", "account overview for exec", "account brief", "executive update", "c-level briefing", "management summary", "executive report", "leadership update", "board update", "senior leadership", "executive overview"]'::jsonb,
 ARRAY['executive', 'briefing', 'exec', 'leadership', 'board', 'summary', 'c-level', 'senior', 'management', 'stakeholder'],
 '["Create executive briefing for Acme", "Brief leadership on this account", "Generate exec summary", "Build executive deck", "Create board briefing"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "slides", "format": "google_slides", "description": "Executive briefing presentation (5-7 slides)"}]'::jsonb,
 '{"service": "CADGService", "method": "generateExecutiveBriefing", "requiresApproval": true, "estimatedDuration": "35-45 seconds"}'::jsonb,
 ARRAY['qbr_generation', 'account_plan', 'stakeholder_map'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('account_plan', 'Account Plan', 'document_generation', 'Generate a strategic account plan with objectives, actions, milestones, resources, and success criteria',
 '["account plan", "strategic plan", "strategic account plan", "account strategy", "account roadmap", "strategic roadmap", "customer plan", "annual plan", "success plan", "growth plan", "engagement plan", "partnership plan", "relationship plan", "customer strategy", "account management plan", "territory plan", "business plan", "strategic account", "key account plan", "major account plan"]'::jsonb,
 ARRAY['account', 'plan', 'strategic', 'strategy', 'roadmap', 'success', 'growth', 'engagement', 'partnership', 'territory'],
 '["Create account plan for Acme", "Build strategic account plan", "Generate customer strategy", "Create annual plan", "Build engagement plan"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Account plan document"}, {"type": "sheets", "format": "google_sheets", "description": "Milestone tracker"}]'::jsonb,
 '{"service": "CADGService", "method": "generateAccountPlan", "requiresApproval": true, "estimatedDuration": "35-45 seconds"}'::jsonb,
 ARRAY['executive_briefing', 'transformation_roadmap', 'expansion_proposal'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities) VALUES
('transformation_roadmap', 'Transformation Roadmap', 'document_generation', 'Generate a transformation roadmap with phases, milestones, success criteria, dependencies, and risk management',
 '["transformation roadmap", "transformation plan", "digital transformation", "transformation journey", "change roadmap", "transformation timeline", "maturity roadmap", "evolution roadmap", "adoption roadmap", "implementation roadmap", "rollout roadmap", "deployment roadmap", "transformation strategy", "change management", "modernization plan", "innovation roadmap", "capability roadmap", "technology roadmap", "process transformation", "business transformation"]'::jsonb,
 ARRAY['transformation', 'roadmap', 'plan', 'journey', 'change', 'maturity', 'evolution', 'adoption', 'implementation', 'modernization'],
 '["Create transformation roadmap for Acme", "Build digital transformation plan", "Generate change roadmap", "Create adoption roadmap", "Build implementation timeline"]'::jsonb,
 '[{"name": "customerId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "docs", "format": "google_docs", "description": "Transformation roadmap document"}, {"type": "slides", "format": "google_slides", "description": "Roadmap presentation"}]'::jsonb,
 '{"service": "CADGService", "method": "generateTransformationRoadmap", "requiresApproval": true, "estimatedDuration": "40-50 seconds"}'::jsonb,
 ARRAY['account_plan', 'milestone_plan', 'executive_briefing'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  updated_at = NOW();

-- ============================================================================
-- GENERAL MODE CARDS (4 cards - portfolio-level, no customer required)
-- ============================================================================

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities, prerequisites) VALUES
('portfolio_dashboard', 'Portfolio Dashboard', 'reporting', 'Generate a portfolio dashboard with customer health, ARR distribution, renewal timeline, and filtering options',
 '["portfolio dashboard", "portfolio overview", "customer portfolio", "my portfolio", "all customers", "all my customers", "customer list", "book of business", "account list", "show customers", "customer health dashboard", "portfolio health", "portfolio report", "my accounts", "customer summary", "account summary", "portfolio summary", "customer overview", "book overview", "territory dashboard"]'::jsonb,
 ARRAY['portfolio', 'dashboard', 'overview', 'customers', 'book', 'business', 'accounts', 'list', 'summary', 'territory'],
 '["Show my portfolio dashboard", "Give me a portfolio overview", "List all my customers", "Generate book of business report", "Create customer health dashboard"]'::jsonb,
 '[{"name": "userId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "Portfolio dashboard"}, {"type": "docs", "format": "google_docs", "description": "Portfolio summary"}]'::jsonb,
 '{"service": "CADGService", "method": "generatePortfolioDashboard", "requiresApproval": false, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['team_metrics', 'renewal_pipeline', 'at_risk_overview'],
 ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  required_inputs = EXCLUDED.required_inputs,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  prerequisites = EXCLUDED.prerequisites,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities, prerequisites) VALUES
('team_metrics', 'Team Metrics', 'reporting', 'Generate team performance metrics with CSM comparison, KPIs, benchmarks, and filtering options',
 '["team metrics", "team performance", "csm metrics", "csm performance", "team dashboard", "manager dashboard", "team report", "csm report", "team kpis", "csm kpis", "team health", "compare csms", "csm comparison", "my team", "team overview", "performance report", "csm scorecard", "team scorecard", "manager report", "team analysis"]'::jsonb,
 ARRAY['team', 'metrics', 'performance', 'csm', 'dashboard', 'manager', 'kpis', 'comparison', 'scorecard', 'analysis'],
 '["Show team metrics", "Generate CSM performance report", "Compare my team", "Create team dashboard", "Build CSM scorecard"]'::jsonb,
 '[{"name": "userId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "Team metrics dashboard"}, {"type": "slides", "format": "google_slides", "description": "Team performance presentation"}]'::jsonb,
 '{"service": "CADGService", "method": "generateTeamMetrics", "requiresApproval": false, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['portfolio_dashboard', 'renewal_pipeline', 'at_risk_overview'],
 ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  required_inputs = EXCLUDED.required_inputs,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  prerequisites = EXCLUDED.prerequisites,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities, prerequisites) VALUES
('renewal_pipeline', 'Renewal Pipeline', 'renewal', 'Generate a renewal pipeline report with date ranges, risk levels, ARR thresholds, and grouping options',
 '["renewal pipeline", "renewals pipeline", "upcoming renewals", "renewal forecast", "renewal calendar", "renewal schedule", "renewal tracker", "renewal list", "renewals this quarter", "renewals this month", "renewals due", "show renewals", "all renewals", "renewal report", "renewal overview", "upcoming contracts", "contract renewals", "renewal summary", "renewal timeline", "renewal queue"]'::jsonb,
 ARRAY['renewal', 'pipeline', 'upcoming', 'calendar', 'schedule', 'tracker', 'list', 'due', 'contracts', 'queue'],
 '["Show renewal pipeline", "List upcoming renewals", "Generate renewal forecast", "What renewals are due this quarter?", "Create renewal tracker"]'::jsonb,
 '[{"name": "userId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "Renewal pipeline report"}, {"type": "docs", "format": "google_docs", "description": "Renewal summary"}]'::jsonb,
 '{"service": "CADGService", "method": "generateRenewalPipeline", "requiresApproval": false, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['at_risk_overview', 'portfolio_dashboard', 'renewal_forecast'],
 ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  required_inputs = EXCLUDED.required_inputs,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  prerequisites = EXCLUDED.prerequisites,
  updated_at = NOW();

INSERT INTO capabilities (id, name, category, description, trigger_patterns, keywords, example_prompts, required_inputs, outputs, execution, related_capabilities, prerequisites) VALUES
('at_risk_overview', 'At-Risk Overview', 'risk_management', 'Generate an at-risk customer overview with risk scores, save play status, renewal urgency, and filtering options',
 '["at-risk overview", "at risk overview", "at-risk customers", "at risk customers", "customers at risk", "show at-risk", "show at risk", "risk overview", "churn risk overview", "high risk customers", "critical customers", "risky accounts", "accounts at risk", "risk dashboard", "at-risk report", "at risk report", "churn dashboard", "risk summary", "red accounts", "distressed accounts"]'::jsonb,
 ARRAY['at-risk', 'risk', 'overview', 'customers', 'churn', 'high', 'critical', 'accounts', 'dashboard', 'distressed'],
 '["Show at-risk customers", "Generate risk overview", "Which customers are at risk?", "List high-risk accounts", "Create at-risk dashboard"]'::jsonb,
 '[{"name": "userId", "type": "uuid", "source": "context", "required": true}]'::jsonb,
 '[{"type": "sheets", "format": "google_sheets", "description": "At-risk customer report"}, {"type": "docs", "format": "google_docs", "description": "At-risk overview summary"}]'::jsonb,
 '{"service": "CADGService", "method": "generateAtRiskOverview", "requiresApproval": false, "estimatedDuration": "25-35 seconds"}'::jsonb,
 ARRAY['risk_assessment', 'save_play', 'renewal_pipeline'],
 ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  keywords = EXCLUDED.keywords,
  example_prompts = EXCLUDED.example_prompts,
  required_inputs = EXCLUDED.required_inputs,
  outputs = EXCLUDED.outputs,
  execution = EXCLUDED.execution,
  related_capabilities = EXCLUDED.related_capabilities,
  prerequisites = EXCLUDED.prerequisites,
  updated_at = NOW();

-- Refresh indexes after bulk inserts
ANALYZE capabilities;
