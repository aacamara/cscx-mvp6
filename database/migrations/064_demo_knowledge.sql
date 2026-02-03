-- ============================================
-- PRD: Demo Customer Data Seeding
-- Migration: 064_demo_knowledge.sql
-- Description: Insert 10-15 knowledge base articles for RAG demos
-- ============================================

-- ============================================
-- KNOWLEDGE BASE ARTICLES
-- ============================================
-- QBR best practices
-- Churn prevention playbook
-- Expansion conversation guide
-- Risk signal detection
-- Stakeholder mapping
-- Onboarding checklist
-- Health score interpretation
-- Renewal strategy
-- Success metrics
-- Customer segmentation
-- Executive communication
-- Crisis management
-- Feature adoption tactics
-- NPS action framework
-- Value realization tracking
-- ============================================

-- Clear existing demo knowledge base articles
DELETE FROM knowledge_base
WHERE category IN ('cs-playbook', 'methodology', 'best-practices', 'frameworks')
AND layer = 'universal'
AND source_type = 'demo-seed';

-- Insert knowledge base articles
INSERT INTO knowledge_base (
  id,
  title,
  content,
  category,
  tags,
  layer,
  source_type,
  is_public,
  word_count
) VALUES

-- 1. QBR Best Practices
(
  'kb000000-0000-0000-0000-000000000001',
  'Quarterly Business Review Best Practices',
  E'# Quarterly Business Review Best Practices\n\n## Overview\nA Quarterly Business Review (QBR) is a strategic meeting between your company and key customer stakeholders to review progress, align on goals, and strengthen the partnership. Unlike tactical check-ins, QBRs focus on business outcomes and future strategy.\n\n## Preparation Checklist\n\n### 2 Weeks Before\n- Review all health metrics and trends\n- Compile ROI and value realization data\n- Identify 2-3 success stories to highlight\n- Prepare roadmap items relevant to customer''s goals\n- Confirm attendee list with customer champion\n\n### 1 Week Before\n- Share agenda with stakeholders\n- Finalize presentation deck\n- Brief internal team on customer context\n- Prepare discussion questions for each section\n\n## QBR Structure (60-90 minutes)\n\n### 1. Business Review (15 min)\n- Customer business updates and changes\n- Review stated objectives from last period\n- Discuss market or competitive changes\n\n### 2. Value Delivered (20 min)\n- Key metrics and improvements\n- ROI calculations and evidence\n- Success stories and wins\n- Feature adoption highlights\n\n### 3. Looking Ahead (20 min)\n- Upcoming objectives and priorities\n- Product roadmap alignment\n- Training and enablement needs\n- Growth opportunities\n\n### 4. Action Items (10 min)\n- Summarize commitments from both sides\n- Set timeline and owners\n- Schedule follow-up cadence\n\n## Best Practices\n\n- **Executive presence**: Ensure economic buyer attends at least annually\n- **80/20 rule**: Spend 80% on future, 20% on past\n- **Data-driven**: Back every claim with specific metrics\n- **Collaborative**: QBR is a dialogue, not a presentation\n- **Action-oriented**: Every QBR ends with clear next steps',
  'best-practices',
  ARRAY['qbr', 'executive', 'strategy', 'presentation'],
  'universal',
  'demo-seed',
  TRUE,
  320
),

-- 2. Churn Prevention Playbook
(
  'kb000000-0000-0000-0000-000000000002',
  'Churn Prevention Playbook',
  E'# Churn Prevention Playbook\n\n## Early Warning Signals\n\nRecognizing churn risk early is critical. Watch for these indicators:\n\n### Engagement Signals\n- Login frequency drops 30%+ vs baseline\n- Key users stop accessing product\n- Support tickets increase significantly\n- Response time to emails lengthens\n- Meeting cancellations increase\n\n### Relationship Signals\n- Champion leaves or changes role\n- Budget holder changes\n- M&A activity announced\n- Negative NPS or CSAT feedback\n- Escalations to management\n\n### Business Signals\n- Downsizing or layoffs announced\n- Competitor mentioned in conversations\n- Contract discussions delayed\n- Pricing pushback increases\n- Feature requests stop coming\n\n## Response Framework\n\n### Green Zone (Health Score 80+)\n- Maintain regular cadence\n- Focus on expansion opportunities\n- Document value being delivered\n- Strengthen multi-threading\n\n### Yellow Zone (Health Score 50-79)\n- Increase touchpoint frequency\n- Conduct health check call\n- Review product usage in detail\n- Identify and address blockers\n- Engage executive sponsor\n\n### Red Zone (Health Score <50)\n- Immediate escalation to leadership\n- Executive-to-executive outreach\n- Root cause analysis within 48 hours\n- Create formal save plan\n- Daily internal status updates\n\n## Save Play Execution\n\n1. **Diagnose**: Understand true root cause (not symptoms)\n2. **Align**: Get internal resources and approval\n3. **Present**: Offer concrete remediation plan\n4. **Execute**: Deliver on commitments perfectly\n5. **Verify**: Confirm issue resolved with customer',
  'cs-playbook',
  ARRAY['churn', 'retention', 'risk', 'save-play'],
  'universal',
  'demo-seed',
  TRUE,
  285
),

-- 3. Expansion Conversation Guide
(
  'kb000000-0000-0000-0000-000000000003',
  'Expansion Conversation Guide',
  E'# Expansion Conversation Guide\n\n## Identifying Expansion Opportunities\n\n### Usage-Based Signals\n- Approaching license limit (>80% utilization)\n- High adoption of current tier features\n- Users requesting advanced capabilities\n- API usage nearing limits\n- Multiple departments now using product\n\n### Business Signals\n- Company growth (hiring, funding, expansion)\n- New initiatives that align with your product\n- Budget cycle timing favorable\n- Successful ROI demonstration\n- Champion expressing strategic needs\n\n## Conversation Framework\n\n### Discovery Phase\nAsk open-ended questions to understand:\n- What business goals are top priority next quarter?\n- How has [product] impacted your team''s workflow?\n- What capabilities would help you scale further?\n- Are there other teams who could benefit?\n\n### Value Articulation\nConnect expansion to outcomes:\n- \"Based on the 40% efficiency gain we measured, expanding to [team] could unlock [specific value].\"\n- Quantify potential ROI of expansion\n- Reference similar customer success stories\n\n### Handling Objections\n\n**\"We don''t have budget\"**\nResponse: \"I understand. Let''s look at the ROI you''ve achieved so far. If we can demonstrate similar value for [new use case], would that help make the case for additional investment?\"\n\n**\"We need to focus on adoption first\"**\nResponse: \"That makes sense. Let me share how customers at your stage have actually accelerated adoption by bringing in [specific feature/team].\"\n\n**\"We''re evaluating alternatives\"**\nResponse: \"I appreciate your transparency. Can you share what capabilities you''re looking for? I want to make sure you have complete information about our roadmap and current offerings.\"\n\n## Best Practices\n- Expansion should feel like a natural next step, not a sales pitch\n- Lead with value delivered, not features\n- Involve champion in building the business case\n- Time expansion conversations to budget cycles',
  'cs-playbook',
  ARRAY['expansion', 'upsell', 'growth', 'sales'],
  'universal',
  'demo-seed',
  TRUE,
  340
),

-- 4. Risk Signal Detection
(
  'kb000000-0000-0000-0000-000000000004',
  'Risk Signal Detection Guide',
  E'# Risk Signal Detection Guide\n\n## Automated Risk Indicators\n\n### Usage Metrics\n| Signal | Threshold | Severity |\n|--------|-----------|----------|\n| DAU Drop | >30% vs 30-day avg | High |\n| Login Streak Break | >14 days no login | Medium |\n| Feature Abandonment | Key feature unused 30+ days | Medium |\n| API Errors | >5% error rate | High |\n| Session Duration | <50% of baseline | Low |\n\n### Health Score Components\n- **Product Score**: Usage depth, feature adoption, technical health\n- **Risk Score**: Support tickets, escalations, sentiment\n- **Outcome Score**: Goal achievement, value metrics\n- **Voice Score**: NPS, CSAT, feedback sentiment\n- **Engagement Score**: Meeting attendance, response rates\n\n## Human Intelligence Signals\n\n### In Conversations\n- Competitor names mentioned\n- Budget constraints discussed\n- Reorganization or leadership changes\n- Frustration with specific features\n- Requests for pricing flexibility\n- Silence or evasiveness about renewal\n\n### Environmental\n- Glassdoor reviews mention layoffs\n- Company in news for negative reasons\n- LinkedIn shows key contacts leaving\n- Industry downturn affecting segment\n\n## Response Matrix\n\n| Risk Level | Response Time | Escalation | Action |\n|------------|---------------|------------|--------|\n| Critical | 4 hours | VP + Exec | Save play initiated |\n| High | 24 hours | Manager | Intervention call scheduled |\n| Medium | 48 hours | CSM | Health check outreach |\n| Low | 1 week | CSM | Monitor, note in timeline |\n\n## Documentation Requirements\n\nWhen logging risk signals:\n1. Specific observation or data point\n2. Date/source of detection\n3. Potential impact assessment\n4. Recommended action\n5. Owner and timeline',
  'methodology',
  ARRAY['risk', 'health-score', 'signals', 'monitoring'],
  'universal',
  'demo-seed',
  TRUE,
  295
),

-- 5. Stakeholder Mapping
(
  'kb000000-0000-0000-0000-000000000005',
  'Stakeholder Mapping and Multi-threading',
  E'# Stakeholder Mapping and Multi-threading\n\n## Why Multi-threading Matters\n\nSingle-threaded accounts (only one contact) face 3x higher churn risk. When your champion leaves, you lose everything. Multi-threading creates resilience and expands influence.\n\n## Key Stakeholder Roles\n\n### Economic Buyer\n- Controls budget allocation\n- Signs contracts\n- Focus: ROI, business outcomes, competitive advantage\n- Engagement: Quarterly EBRs, strategic updates\n\n### Champion\n- Internal advocate for your solution\n- Influences adoption and expansion\n- Focus: Product success, team productivity\n- Engagement: Weekly/bi-weekly touchpoints\n\n### Technical Champion\n- Owns implementation and integration\n- Influences technical decisions\n- Focus: Reliability, roadmap, API capabilities\n- Engagement: Technical reviews, beta programs\n\n### End Users\n- Daily product users\n- Source of feedback and feature requests\n- Focus: Usability, efficiency, support\n- Engagement: Training, community, NPS surveys\n\n## Mapping Exercise\n\nFor each account, document:\n1. **Name and title** of each stakeholder\n2. **Role type** (Economic Buyer, Champion, User)\n3. **Sentiment** (Positive, Neutral, Negative)\n4. **Engagement level** (High, Medium, Low)\n5. **Influence** on renewal/expansion decisions\n6. **Relationships** to other stakeholders\n\n## Multi-threading Tactics\n\n### Expanding from Champion\n- Ask champion to introduce you to their manager\n- Request invitation to team meetings\n- Offer executive-to-executive introduction\n\n### Creating New Champions\n- Identify power users from usage data\n- Invite to customer advisory board\n- Feature in case studies or webinars\n\n### Engaging Executives\n- Share industry insights and benchmarks\n- Invite to exclusive executive events\n- Provide peer networking opportunities\n\n## Target Multi-threading Depth\n\n| Account Tier | Minimum Contacts | Goal |\n|--------------|------------------|------|\n| Enterprise | 5 | 8+ |\n| Commercial | 3 | 5+ |\n| SMB | 2 | 3+ |',
  'methodology',
  ARRAY['stakeholders', 'multi-threading', 'relationships', 'champion'],
  'universal',
  'demo-seed',
  TRUE,
  350
),

-- 6. Onboarding Checklist
(
  'kb000000-0000-0000-0000-000000000006',
  'Customer Onboarding Checklist',
  E'# Customer Onboarding Checklist\n\n## Phase 1: Kickoff (Days 1-7)\n\n### Administrative\n- [ ] Welcome email sent within 24 hours of contract signature\n- [ ] Account provisioned in all systems\n- [ ] Kickoff meeting scheduled\n- [ ] Project timeline shared with customer\n- [ ] Communication channels established (Slack, email aliases)\n\n### Kickoff Meeting Agenda\n- [ ] Introductions and role clarity\n- [ ] Reconfirm business objectives and success criteria\n- [ ] Review implementation timeline\n- [ ] Identify key stakeholders for each phase\n- [ ] Establish cadence and escalation paths\n\n## Phase 2: Foundation (Days 8-30)\n\n### Technical Setup\n- [ ] SSO/authentication configured\n- [ ] Primary integrations connected\n- [ ] Initial data import completed\n- [ ] Security review passed\n- [ ] Test environment validated\n\n### Training\n- [ ] Admin training completed\n- [ ] First user cohort trained\n- [ ] Self-service resources shared\n- [ ] Support process explained\n\n### Documentation\n- [ ] Success plan created and shared\n- [ ] Key metrics baseline established\n- [ ] Stakeholder map documented\n- [ ] Risk factors identified\n\n## Phase 3: Adoption (Days 31-60)\n\n### Usage Milestones\n- [ ] 25% of licensed users active\n- [ ] Primary use case in production\n- [ ] First value metric achieved\n- [ ] User feedback collected\n\n### Relationship Building\n- [ ] Executive sponsor check-in completed\n- [ ] Second stakeholder relationship established\n- [ ] Community/peer group introduced\n- [ ] Roadmap preview shared\n\n## Phase 4: Value Confirmation (Days 61-90)\n\n### Success Validation\n- [ ] Value metrics documented\n- [ ] ROI calculation completed\n- [ ] Customer testimonial requested (if appropriate)\n- [ ] Case study opportunity assessed\n\n### Transition to BAU\n- [ ] Steady-state cadence established\n- [ ] Health score in green zone\n- [ ] Expansion opportunities identified\n- [ ] First QBR scheduled\n\n## Onboarding Success Metrics\n\n| Metric | Target | Red Flag |\n|--------|--------|----------|\n| Time to First Value | <30 days | >45 days |\n| User Activation | 50% by Day 30 | <25% |\n| Health Score at Day 90 | 70+ | <50 |\n| Stakeholder Count | 3+ | 1 |',
  'cs-playbook',
  ARRAY['onboarding', 'implementation', 'checklist', 'kickoff'],
  'universal',
  'demo-seed',
  TRUE,
  380
),

-- 7. Health Score Interpretation
(
  'kb000000-0000-0000-0000-000000000007',
  'Health Score Interpretation Guide',
  E'# Health Score Interpretation Guide\n\n## PROVE Framework Overview\n\nThe PROVE framework measures customer health across five dimensions, each weighted based on predictive importance for retention:\n\n| Dimension | Weight | What It Measures |\n|-----------|--------|------------------|\n| Product | 30% | Usage depth, feature adoption, technical stability |\n| Risk | 20% | Support issues, escalations, negative signals |\n| Outcomes | 20% | Goal achievement, value realization, ROI |\n| Voice | 15% | NPS, CSAT, sentiment from interactions |\n| Engagement | 15% | Meeting attendance, response rates, participation |\n\n## Score Ranges and Actions\n\n### Green (80-100)\n**Status**: Healthy, engaged, achieving value\n\n**Characteristics**:\n- High feature adoption and consistent usage\n- Positive sentiment in all interactions\n- Proactively shares feedback and success stories\n- Renewal is not in question\n\n**CSM Actions**:\n- Focus on expansion opportunities\n- Request referrals and case studies\n- Invite to advisory boards\n- Maintain regular cadence\n\n### Yellow (50-79)\n**Status**: Attention needed, some risk factors present\n\n**Characteristics**:\n- Usage may be declining or flat\n- Some stakeholders disengaged\n- Value realization unclear or undocumented\n- Minor issues unresolved\n\n**CSM Actions**:\n- Conduct health check call immediately\n- Review each PROVE dimension for root cause\n- Increase touchpoint frequency\n- Create action plan with customer\n- Brief manager on situation\n\n### Red (0-49)\n**Status**: At risk, immediate intervention required\n\n**Characteristics**:\n- Significant usage decline\n- Multiple escalations or complaints\n- Key stakeholders unresponsive or negative\n- Renewal at serious risk\n\n**CSM Actions**:\n- Escalate to leadership within 24 hours\n- Initiate save play protocol\n- Executive-to-executive engagement\n- Daily internal updates\n- Document everything meticulously\n\n## Dimension Deep Dives\n\n### Product (30%)\n- DAU/WAU/MAU trends\n- Feature adoption breadth and depth\n- Technical health (errors, latency)\n- Integration usage\n\n### Risk (20%)\n- Support ticket volume and severity\n- Escalation history\n- Known issues pending resolution\n- Competitive threat indicators\n\n### Outcomes (20%)\n- Success plan progress\n- Documented value metrics\n- Goal achievement rate\n- Time to value achieved\n\n### Voice (15%)\n- Last NPS/CSAT score\n- Sentiment from calls/emails\n- Quote sentiment (positive/negative)\n- Willingness to advocate\n\n### Engagement (15%)\n- Meeting show rate\n- Email response time\n- Initiative participation\n- Stakeholder accessibility',
  'methodology',
  ARRAY['health-score', 'prove', 'metrics', 'assessment'],
  'universal',
  'demo-seed',
  TRUE,
  420
),

-- 8. Renewal Strategy
(
  'kb000000-0000-0000-0000-000000000008',
  'Renewal Strategy and Execution',
  E'# Renewal Strategy and Execution\n\n## Renewal Timeline\n\n### 120 Days Out\n- Review health score and PROVE dimensions\n- Assess value delivered vs promised\n- Identify any outstanding issues\n- Begin internal alignment with renewals team\n\n### 90 Days Out\n- Conduct renewal health check call\n- Document ROI and value summary\n- Discuss renewal intent with champion\n- Identify potential expansion opportunities\n- Address any blockers or concerns\n\n### 60 Days Out\n- Complete pre-renewal QBR/EBR\n- Share formal value summary document\n- Present renewal proposal if appropriate\n- Confirm decision-maker engagement\n- Resolve any outstanding technical issues\n\n### 30 Days Out\n- Final negotiation and terms alignment\n- Address last-minute objections\n- Confirm signature timeline and process\n- Prepare for post-renewal engagement\n\n## Value Documentation\n\n### What to Include\n- Quantified business outcomes (time saved, revenue gained, cost reduced)\n- Before/after comparisons\n- User testimonials and quotes\n- Usage statistics and adoption metrics\n- Benchmark comparisons to peers\n\n### Presentation Format\n- Executive summary (1 page)\n- Detailed metrics section\n- Forward-looking value projection\n- Partnership roadmap\n\n## Common Renewal Objections\n\n### \"Price is too high\"\n- Reframe to ROI: \"Your investment of $X delivered $Y in value\"\n- Offer multi-year discount if appropriate\n- Explore reduced scope vs cancellation\n\n### \"We''re not seeing value\"\n- Dig into specific unmet expectations\n- Propose remediation plan before renewal\n- Offer executive engagement to resolve\n\n### \"We''re evaluating alternatives\"\n- Understand specific gaps or needs\n- Share roadmap items addressing concerns\n- Offer competitive migration support\n\n### \"Budget is being cut\"\n- Quantify cost of not renewing\n- Propose reduced scope as alternative\n- Extend current term if helpful\n\n## Post-Renewal\n- Send thank you and confirmation\n- Schedule kick-off for new term\n- Reset success plan with updated goals\n- Identify expansion timeline',
  'cs-playbook',
  ARRAY['renewal', 'negotiation', 'value', 'retention'],
  'universal',
  'demo-seed',
  TRUE,
  365
),

-- 9. Success Metrics Framework
(
  'kb000000-0000-0000-0000-000000000009',
  'Customer Success Metrics Framework',
  E'# Customer Success Metrics Framework\n\n## Leading Indicators\n\nThese metrics predict future outcomes:\n\n### Adoption Metrics\n- **Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)**: Core usage frequency\n- **Feature Adoption Rate**: % of available features actively used\n- **Time to Value (TTV)**: Days from signature to first value milestone\n- **Onboarding Completion**: % completing all onboarding steps\n\n### Engagement Metrics\n- **Login Frequency**: Average logins per user per week\n- **Session Duration**: Average time per session\n- **Meeting Attendance Rate**: % of scheduled meetings attended\n- **Email Response Time**: Average hours to respond\n\n### Health Metrics\n- **Health Score Trend**: Direction of health score over 30/60/90 days\n- **Support Ticket Trend**: Volume and severity trend\n- **NPS Trend**: Movement in NPS score over time\n\n## Lagging Indicators\n\nThese measure outcomes:\n\n### Revenue Metrics\n- **Net Revenue Retention (NRR)**: Revenue kept + expansion - churn\n- **Gross Revenue Retention (GRR)**: Revenue kept (excluding expansion)\n- **Expansion Revenue**: Additional ARR from existing customers\n- **Contraction Revenue**: Reduced ARR from downgrades\n\n### Customer Metrics\n- **Logo Retention Rate**: % of customers retained\n- **Churn Rate**: % of customers or revenue lost\n- **Customer Lifetime Value (CLV)**: Total value over relationship\n\n## Benchmarks by Segment\n\n| Metric | SMB | Commercial | Enterprise |\n|--------|-----|------------|------------|\n| NRR | 100%+ | 110%+ | 120%+ |\n| GRR | 85%+ | 90%+ | 95%+ |\n| Logo Retention | 85%+ | 90%+ | 95%+ |\n| NPS | 30+ | 40+ | 50+ |\n| TTV | <14 days | <30 days | <45 days |\n\n## Measurement Cadence\n\n| Metric Type | Review Frequency |\n|-------------|------------------|\n| Usage/Adoption | Weekly |\n| Health Scores | Weekly |\n| Engagement | Bi-weekly |\n| NPS/CSAT | Quarterly |\n| Revenue (NRR/GRR) | Monthly |\n| Churn Analysis | Monthly |',
  'frameworks',
  ARRAY['metrics', 'kpi', 'nrr', 'churn'],
  'universal',
  'demo-seed',
  TRUE,
  340
),

-- 10. Customer Segmentation
(
  'kb000000-0000-0000-0000-000000000010',
  'Customer Segmentation Strategy',
  E'# Customer Segmentation Strategy\n\n## Segmentation Dimensions\n\n### By ARR Tier\n\n| Tier | ARR Range | CSM Ratio | Touch Model |\n|------|-----------|-----------|-------------|\n| Enterprise | $250K+ | 1:10 | High touch |\n| Commercial | $50K-$249K | 1:30 | Medium touch |\n| SMB | <$50K | 1:100+ | Tech touch + pooled |\n\n### By Lifecycle Stage\n\n**Onboarding** (0-90 days)\n- Focus: Time to first value\n- Cadence: Weekly\n- Priority: Adoption, training, integration\n\n**Adoption** (90-180 days)\n- Focus: Broadening usage, adding users\n- Cadence: Bi-weekly\n- Priority: Feature adoption, stakeholder expansion\n\n**Growth** (180+ days, healthy)\n- Focus: Expansion, advocacy\n- Cadence: Monthly\n- Priority: Cross-sell, upsell, referrals\n\n**Renewal** (90 days pre-renewal)\n- Focus: Value documentation, retention\n- Cadence: Weekly\n- Priority: ROI demonstration, negotiation\n\n**At Risk** (Health <50)\n- Focus: Issue resolution, save play\n- Cadence: As needed (often daily)\n- Priority: Root cause, remediation\n\n### By Health Score\n\n**Green Zone (80+)**: Expansion opportunities, advocacy requests\n**Yellow Zone (50-79)**: Proactive intervention, health checks\n**Red Zone (<50)**: Save play, executive engagement\n\n## Segmentation-Specific Playbooks\n\n### High Touch (Enterprise)\n- Dedicated CSM relationship\n- Quarterly EBRs with executives\n- Custom success plans\n- Proactive roadmap influence\n- White-glove support\n\n### Medium Touch (Commercial)\n- Named CSM with pooled support\n- Semi-annual business reviews\n- Templated success plans\n- Webinar-based training\n- Self-service with escalation\n\n### Tech Touch (SMB)\n- Automated engagement sequences\n- In-app guidance and tours\n- Community-based support\n- On-demand training content\n- Trigger-based CSM intervention\n\n## Segmentation Reviews\n\nReassess segmentation quarterly based on:\n- ARR changes (upgrades/downgrades)\n- Health score shifts\n- Strategic importance changes\n- Risk level changes',
  'methodology',
  ARRAY['segmentation', 'tiering', 'strategy', 'portfolio'],
  'universal',
  'demo-seed',
  TRUE,
  360
),

-- 11. Executive Communication
(
  'kb000000-0000-0000-0000-000000000011',
  'Executive Communication Best Practices',
  E'# Executive Communication Best Practices\n\n## Principles for Executive Engagement\n\n### Brevity\nExecutives have limited time. Lead with the headline, then provide supporting details only if asked. Aim for 30-second summaries with optional 5-minute deep dives.\n\n### Outcome Focus\nExecutives care about business impact, not features or activities. Always translate your message into:\n- Revenue impact\n- Cost savings\n- Risk mitigation\n- Competitive advantage\n- Strategic alignment\n\n### Preparation\nNever go into an executive conversation unprepared. Know:\n- Their current priorities and challenges\n- Recent company news and changes\n- Your specific ask or objective\n- Potential objections and responses\n\n## Communication Templates\n\n### Status Update Email\n```\nSubject: [Customer Name] Q2 Update - 15% efficiency gain achieved\n\nHi [Executive],\n\nQuick update on [Customer Name]:\n\n✅ WINS: Achieved 15% efficiency improvement in customer support, saving ~$50K annually\n⚠️ WATCH: Champion Sarah transitioning roles next month\n🎯 NEXT: Scheduling executive alignment for renewal in 90 days\n\nDetails available if helpful. Happy to discuss at your convenience.\n\nBest,\n[CSM]\n```\n\n### Escalation Request\n```\nSubject: [URGENT] Executive support needed - [Customer Name] renewal risk\n\nSituation: $450K renewal at risk due to [specific issue]\nImpact: Potential churn in 60 days\nAsk: 30-min call with their CEO to address concerns\nContext: [2-3 bullets on background]\n\nCan you help facilitate introduction?\n```\n\n### Value Summary\n```\nSubject: [Customer Name] Partnership Impact - FY26\n\nYear 1 Results:\n• $1.2M in documented savings\n• 45% reduction in time-to-resolution\n• NPS improved from 32 to 58\n\nKey to success: [one sentence on what drove results]\n\n[Optional: attach 1-page value summary]\n```\n\n## Meeting with Executives\n\n### Before\n- Research their LinkedIn, recent news\n- Prepare 3 key points max\n- Know your ask clearly\n- Brief your champion on approach\n\n### During\n- Start with their priorities, not yours\n- Listen more than you speak\n- Take notes visibly\n- Confirm understanding and next steps\n\n### After\n- Send summary within 24 hours\n- Include commitments from both sides\n- Cc relevant stakeholders\n- Set calendar reminder for follow-up',
  'best-practices',
  ARRAY['executive', 'communication', 'email', 'presentation'],
  'universal',
  'demo-seed',
  TRUE,
  400
),

-- 12. NPS Action Framework
(
  'kb000000-0000-0000-0000-000000000012',
  'NPS Response and Action Framework',
  E'# NPS Response and Action Framework\n\n## Score Categories\n\n### Promoters (9-10)\n**Profile**: Enthusiastic advocates, high satisfaction\n\n**Response Strategy**:\n- Thank personally within 24 hours\n- Request specific feedback on what''s working\n- Ask for referral or case study participation\n- Invite to customer advisory board\n- Identify expansion opportunities\n\n**Sample Response**:\n\"Thank you for the positive feedback! We''re thrilled to hear you''re finding value. Would you be open to sharing your experience with others? [Specific referral or case study ask]\"\n\n### Passives (7-8)\n**Profile**: Satisfied but not enthusiastic, vulnerable to competition\n\n**Response Strategy**:\n- Thank and acknowledge\n- Probe for improvement opportunities\n- Share upcoming features that address their needs\n- Increase engagement to build enthusiasm\n\n**Sample Response**:\n\"Thank you for your feedback. We''d love to learn more about what would make your experience even better. Could we schedule a brief call to discuss?\"\n\n### Detractors (0-6)\n**Profile**: Unhappy, at risk of churning or spreading negative word\n\n**Response Strategy**:\n- Respond within 4 hours (high priority)\n- Acknowledge concern without being defensive\n- Escalate to manager immediately\n- Schedule call to understand root cause\n- Create remediation plan within 48 hours\n- Follow up until issue resolved\n\n**Sample Response**:\n\"I''m sorry to hear about your experience. This isn''t the standard we hold ourselves to. I''d like to understand more and make this right. Can we schedule a call today or tomorrow?\"\n\n## NPS Program Best Practices\n\n### Survey Timing\n- Post-onboarding: 30 days after go-live\n- Steady state: Quarterly or semi-annually\n- Post-support: After ticket resolution (for transactional NPS)\n- Renewal: 60 days before renewal date\n\n### Closing the Loop\n\n| Score | Response Time | Follow-up Cadence |\n|-------|---------------|-------------------|\n| 0-6 | 4 hours | Daily until resolved |\n| 7-8 | 24 hours | Weekly for 2 weeks |\n| 9-10 | 48 hours | As appropriate for ask |\n\n### Trend Analysis\nTrack NPS trends by:\n- Customer segment\n- Lifecycle stage\n- Feature usage\n- CSM\n- Industry\n\nLook for patterns that indicate systemic issues or opportunities.',
  'frameworks',
  ARRAY['nps', 'survey', 'feedback', 'detractor'],
  'universal',
  'demo-seed',
  TRUE,
  380
);

-- ============================================
-- Verify insertion
-- ============================================
DO $$
DECLARE
  kb_count INT;
BEGIN
  SELECT COUNT(*) INTO kb_count
  FROM knowledge_base
  WHERE source_type = 'demo-seed';

  RAISE NOTICE 'Demo knowledge base articles inserted: % (expected 12)', kb_count;
END $$;
