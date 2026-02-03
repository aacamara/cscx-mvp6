-- Migration: 009_seed_agent_knowledge_base.sql
-- Description: Seed 25 comprehensive CSM playbooks for all 5 agents
-- Created: 2026-01-22

-- ============================================
-- CREATE TABLE IF NOT EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS csm_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  use_cases TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  embedding vector(768),
  source TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csm_playbooks_category ON csm_playbooks(category);
CREATE INDEX IF NOT EXISTS idx_csm_playbooks_tags ON csm_playbooks USING GIN(tags);

-- ============================================
-- ONBOARDING AGENT PLAYBOOKS (5)
-- ============================================

INSERT INTO csm_playbooks (category, subcategory, title, content, summary, use_cases, tags, source)
VALUES
-- 1. Onboarding Kickoff Playbook
('onboarding', 'kickoff', 'Customer Kickoff Meeting Playbook',
$$# Customer Kickoff Meeting Playbook

## Overview
The kickoff meeting is the most critical touchpoint in the customer journey. It sets expectations, builds relationships, and establishes the foundation for a successful partnership.

## Pre-Meeting Preparation (T-7 days)
1. **Review Contract & Entitlements**
   - Confirm ARR, contract terms, and included features
   - Identify any custom agreements or SLAs
   - Note renewal date for planning

2. **Research the Company**
   - Industry trends and challenges
   - Recent news and announcements
   - Competitive landscape
   - Key stakeholders on LinkedIn

3. **Create Kickoff Deck**
   - Customize template with customer logo
   - Include relevant case studies from their industry
   - Prepare product roadmap highlights

4. **Schedule & Invite**
   - Send calendar invite with agenda
   - Include all key stakeholders
   - Attach pre-reading materials

## Meeting Agenda (60 minutes)

### Opening (5 min)
- Welcome and introductions
- Meeting objectives overview
- Confirm attendee roles

### Discovery (15 min)
**Questions to Ask:**
- "What does success look like in 90 days?"
- "What challenges prompted you to choose us?"
- "Who are the key users and what are their goals?"
- "What's your timeline for full deployment?"
- "Are there any concerns we should address early?"

### Solution Overview (15 min)
- Review purchased products/features
- Highlight value propositions
- Share relevant success stories

### Onboarding Plan (15 min)
- Present 30-60-90 day roadmap
- Assign ownership for milestones
- Discuss training schedule
- Set communication cadence

### Next Steps (10 min)
- Confirm first milestone date
- Schedule technical setup call
- Share resource library access
- Exchange contact information

## Post-Meeting Actions
- [ ] Send meeting notes within 24 hours
- [ ] Create customer folder in Drive
- [ ] Update CRM with meeting outcomes
- [ ] Schedule follow-up touchpoints
- [ ] Begin technical setup process

## Success Metrics
- Meeting held within 5 business days of contract signing
- All key stakeholders attended
- Clear 90-day goals documented
- First milestone scheduled within 2 weeks
$$,
'Comprehensive playbook for conducting effective customer kickoff meetings with agenda, discovery questions, and follow-up actions',
ARRAY['kickoff meetings', 'new customer onboarding', 'relationship building', 'expectation setting'],
ARRAY['onboarding', 'kickoff', 'meeting', 'discovery', 'stakeholder'],
'CSCX Platform'
),

-- 2. 30-60-90 Day Framework
('onboarding', 'planning', '30-60-90 Day Onboarding Framework',
$$# 30-60-90 Day Onboarding Framework

## Overview
A structured approach to customer onboarding that ensures consistent value delivery and measurable progress.

## Days 1-30: Foundation Phase

### Goals
- Complete technical setup and integration
- Train primary administrators
- Achieve first value milestone

### Key Activities
**Week 1:**
- Kickoff meeting completed
- Technical requirements gathered
- Integration planning session
- Admin accounts provisioned

**Week 2:**
- Core integrations configured
- Data migration initiated (if applicable)
- Admin training session 1

**Week 3:**
- Integration testing completed
- Admin training session 2
- Initial configuration review

**Week 4:**
- Go-live readiness assessment
- First value milestone achieved
- 30-day health check call

### Success Criteria
- [ ] All integrations live
- [ ] Admins trained and certified
- [ ] First use case deployed
- [ ] Baseline metrics established

## Days 31-60: Adoption Phase

### Goals
- Expand user adoption
- Demonstrate initial ROI
- Identify power users/champions

### Key Activities
**Week 5-6:**
- End-user training rollout
- Champion identification
- Usage monitoring setup

**Week 7-8:**
- Feature adoption campaigns
- Best practice sharing
- First value report

### Success Criteria
- [ ] 50%+ user adoption
- [ ] Champion identified
- [ ] ROI metrics captured
- [ ] No critical support issues

## Days 61-90: Optimization Phase

### Goals
- Optimize workflows
- Plan for expansion
- Prepare for first QBR

### Key Activities
**Week 9-10:**
- Workflow optimization review
- Advanced feature training
- Usage analysis

**Week 11-12:**
- Expansion opportunity assessment
- QBR preparation
- 90-day success review

### Success Criteria
- [ ] 75%+ user adoption
- [ ] Workflow improvements documented
- [ ] Expansion roadmap created
- [ ] QBR scheduled

## Health Checkpoints

| Day | Checkpoint | Green | Yellow | Red |
|-----|-----------|-------|--------|-----|
| 14 | Tech setup | Complete | In progress | Not started |
| 30 | First value | Achieved | Close | No progress |
| 45 | Adoption | >40% | 20-40% | <20% |
| 60 | ROI | Documented | Partial | None |
| 90 | Expansion | Ready | Maybe | At risk |

## Escalation Triggers
- No kickoff within 7 days
- Technical blockers >5 days
- Adoption <20% at day 45
- No engagement for 14 days
- Negative stakeholder feedback
$$,
'Structured onboarding framework with milestones, success criteria, and health checkpoints for 30-60-90 day periods',
ARRAY['onboarding planning', 'milestone tracking', 'adoption phases', 'success metrics'],
ARRAY['onboarding', '30-60-90', 'framework', 'milestones', 'adoption'],
'CSCX Platform'
),

-- 3. Stakeholder Mapping Guide
('onboarding', 'stakeholders', 'Stakeholder Mapping & Engagement Guide',
$$# Stakeholder Mapping & Engagement Guide

## Overview
Effective stakeholder management is critical for onboarding success. This guide helps identify, categorize, and engage key stakeholders.

## Stakeholder Categories

### 1. Executive Sponsor
**Characteristics:**
- Budget owner / decision maker
- Sets strategic direction
- Removes organizational blockers

**Engagement Strategy:**
- Quarterly touchpoints
- ROI-focused communications
- Business outcome updates
- Escalation path for issues

**Questions to Ask:**
- "What business outcomes matter most?"
- "How do you measure success for this investment?"
- "What would make this a career-defining project?"

### 2. Champion
**Characteristics:**
- Internal advocate
- Day-to-day decision maker
- Drives adoption

**Engagement Strategy:**
- Weekly/bi-weekly calls
- Early access to new features
- Recognition and rewards
- Feedback collection

**Questions to Ask:**
- "What would make you look like a hero?"
- "What obstacles do you face internally?"
- "Who else should we be talking to?"

### 3. Technical Lead
**Characteristics:**
- Owns implementation
- Integration decisions
- Technical requirements

**Engagement Strategy:**
- Technical deep dives
- Documentation access
- Direct support channel
- Architecture reviews

**Questions to Ask:**
- "What technical constraints should we know?"
- "How does this fit your tech stack?"
- "What security requirements exist?"

### 4. End Users
**Characteristics:**
- Daily product users
- Adoption drivers
- Feedback source

**Engagement Strategy:**
- Training sessions
- User communities
- Feature education
- Quick wins focus

**Questions to Ask:**
- "What tasks take too long today?"
- "What would make your job easier?"
- "What training format works best?"

## Stakeholder Map Template

```
                    HIGH INFLUENCE
                         |
    ECONOMIC BUYER      |      CHAMPION
    (Quarterly)         |      (Weekly)
                         |
LOW INTEREST -----+-----+----- HIGH INTEREST
                         |
    BLOCKER              |      END USER
    (Careful mgmt)       |      (Training)
                         |
                    LOW INFLUENCE
```

## Relationship Risk Indicators
- Champion leaves company
- Executive sponsor changes priorities
- No engagement for 30+ days
- Negative feedback patterns
- Internal reorganization

## Multi-Threading Strategy
**Goal:** Never rely on single point of contact

1. Identify 3+ engaged stakeholders
2. Build relationships at multiple levels
3. Document succession planning
4. Track engagement across contacts
$$,
'Guide to identifying, categorizing, and engaging key customer stakeholders with engagement strategies and risk indicators',
ARRAY['stakeholder management', 'relationship building', 'champion development', 'executive engagement'],
ARRAY['stakeholders', 'champion', 'executive', 'relationship', 'engagement'],
'CSCX Platform'
),

-- 4. Welcome Email Sequence Templates
('onboarding', 'communication', 'Welcome Email Sequence Templates',
$$# Welcome Email Sequence Templates

## Overview
A structured email sequence to guide new customers through onboarding milestones.

## Email 1: Welcome (Day 0)
**Subject:** Welcome to [Product] - Let's Get Started!

```
Hi [First Name],

Welcome to the [Product] family! We're thrilled to have [Company] on board.

I'm [Your Name], your dedicated Customer Success Manager. My job is to ensure you get maximum value from your investment.

Here's what happens next:
1. We'll schedule your kickoff call within the next 48 hours
2. You'll receive admin account credentials
3. We'll create your customized onboarding plan

In the meantime, here are some resources:
- [Link] Getting Started Guide
- [Link] Admin Training Videos
- [Link] Support Portal

I'm looking forward to partnering with you on this journey.

Best,
[Your Name]
```

## Email 2: Pre-Kickoff (Day 2)
**Subject:** Preparing for Your Kickoff - Quick Survey

```
Hi [First Name],

Our kickoff call is scheduled for [Date/Time]. To make the most of our time, please take 2 minutes to complete this brief survey:

[Survey Link]

This helps me understand your goals and prepare relevant materials.

Agenda for our call:
• Introductions (5 min)
• Your goals and success criteria (15 min)
• Product overview and your use cases (20 min)
• 30-60-90 day plan (15 min)
• Q&A and next steps (5 min)

See you soon!

[Your Name]
```

## Email 3: Post-Kickoff (Day 3)
**Subject:** Kickoff Recap + Next Steps

```
Hi [First Name],

Thank you for a great kickoff session! Here's a summary:

**Key Goals:**
- [Goal 1]
- [Goal 2]
- [Goal 3]

**Next Steps:**
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action 1] | [Name] | [Date] |
| [Action 2] | [Name] | [Date] |

**Resources Shared:**
- [Link to kickoff deck]
- [Link to onboarding tracker]
- [Link to training calendar]

Our next touchpoint is [Date] for [Topic]. Let me know if you have questions!

[Your Name]
```

## Email 4: Week 1 Check-In (Day 7)
**Subject:** How's Your First Week Going?

```
Hi [First Name],

You've been live for a week! I wanted to check in:

✓ How is the technical setup progressing?
✓ Have your admins completed initial training?
✓ Any questions or roadblocks?

Quick tip: [Relevant tip for their use case]

I'm here to help - just reply to this email or book time on my calendar: [Calendar Link]

[Your Name]
```

## Email 5: First Value Check (Day 14)
**Subject:** Celebrating Your First Milestone! 🎉

```
Hi [First Name],

Congratulations on [Specific Achievement]!

Here's what you've accomplished:
- [Metric 1]
- [Metric 2]
- [Metric 3]

**What's Next:**
We're now moving into the adoption phase. Here's the focus for the next 2 weeks:
- [Priority 1]
- [Priority 2]

Would you be open to a quick call to discuss [Topic]?

[Your Name]
```

## Email 6: 30-Day Review (Day 30)
**Subject:** Your 30-Day Journey - Review & Planning

```
Hi [First Name],

You've reached your 30-day milestone! Let's review your progress:

**Achievements:**
✓ [Achievement 1]
✓ [Achievement 2]
✓ [Achievement 3]

**Adoption Metrics:**
- Active users: [X]
- Feature adoption: [X%]
- Key workflows: [X] configured

**Next 30 Days Focus:**
1. [Goal 1]
2. [Goal 2]

I'd like to schedule a 30-minute call to plan the next phase. Here are some times: [Calendar Link]

[Your Name]
```
$$,
'Complete email sequence templates for customer onboarding from welcome through 30-day milestone',
ARRAY['email templates', 'customer communication', 'onboarding touchpoints', 'milestone emails'],
ARRAY['email', 'templates', 'communication', 'onboarding', 'sequence'],
'CSCX Platform'
),

-- 5. Early Warning Indicators
('onboarding', 'risk', 'Onboarding Early Warning Indicators',
$$# Onboarding Early Warning Indicators

## Overview
Early detection of onboarding issues allows for proactive intervention before problems escalate.

## Red Flag Categories

### 1. Engagement Red Flags

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| No kickoff within 7 days | High | Escalate to manager |
| Champion unresponsive 5+ days | Medium | Try alternate contacts |
| Meeting cancellations (2+) | Medium | Identify blockers |
| No login within 14 days | High | Executive outreach |
| Declining email engagement | Low | Change communication style |

### 2. Technical Red Flags

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Integration blocked >7 days | High | Involve solutions team |
| Data migration issues | Medium | Schedule technical review |
| Security review delays | High | Engage security team |
| API errors >5% | Medium | Technical health check |
| Performance complaints | Low | Optimization review |

### 3. Adoption Red Flags

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| <20% adoption at day 30 | High | Adoption campaign |
| Training no-shows | Medium | Reschedule + incentives |
| Support ticket surge | Medium | Training gap analysis |
| Feature non-usage | Low | Feature education |
| Negative user feedback | Medium | User interviews |

### 4. Organizational Red Flags

| Indicator | Risk Level | Action |
|-----------|------------|--------|
| Champion leaves | Critical | Immediate exec outreach |
| Budget freeze announced | High | Value reinforcement |
| Competitor evaluation | Critical | Executive business review |
| Reorg/layoffs | High | Stakeholder remapping |
| Priority shift | Medium | Realignment discussion |

## Risk Scoring Matrix

```
Score = Σ (Risk Level × Recency Weight)

Risk Levels:
- Critical: 10 points
- High: 7 points
- Medium: 4 points
- Low: 1 point

Recency Weights:
- Last 7 days: 2x
- 8-14 days: 1.5x
- 15-30 days: 1x
- 30+ days: 0.5x

Thresholds:
- Green: <10 points
- Yellow: 10-20 points
- Red: >20 points
```

## Intervention Playbooks

### High-Risk Intervention (Score >20)
1. Escalate to CS leadership within 24 hours
2. Request executive sponsor meeting
3. Create save play document
4. Daily monitoring until stabilized
5. Consider pause and restart

### Medium-Risk Intervention (Score 10-20)
1. Schedule same-week call with champion
2. Identify and remove blockers
3. Adjust onboarding timeline
4. Increase touchpoint frequency
5. Document in risk tracker

### Low-Risk Intervention (Score <10)
1. Note in customer record
2. Address in next scheduled call
3. Monitor for pattern
4. No escalation needed

## Proactive Health Checks

**Weekly Review Checklist:**
- [ ] Login activity trend
- [ ] Support ticket volume
- [ ] Training completion rate
- [ ] Integration status
- [ ] Stakeholder engagement
- [ ] Milestone progress

**Bi-Weekly Questions:**
- "What's working well?"
- "What could be better?"
- "Any concerns on your end?"
- "How are users responding?"
- "Do you have everything you need?"
$$,
'Comprehensive guide to identifying and responding to early warning signs during customer onboarding',
ARRAY['risk management', 'early warning', 'intervention', 'onboarding health'],
ARRAY['risk', 'warning', 'indicators', 'intervention', 'health'],
'CSCX Platform'
);

-- ============================================
-- ADOPTION AGENT PLAYBOOKS (5)
-- ============================================

INSERT INTO csm_playbooks (category, subcategory, title, content, summary, use_cases, tags, source)
VALUES
-- 6. Usage Analysis Framework
('adoption', 'analytics', 'Usage Analysis Framework',
$$# Usage Analysis Framework

## Overview
A systematic approach to analyzing customer usage data to drive adoption and identify opportunities.

## Key Metrics Hierarchy

### Tier 1: Health Indicators
| Metric | Formula | Benchmark | Alert Threshold |
|--------|---------|-----------|-----------------|
| DAU/MAU Ratio | Daily Active / Monthly Active | >20% | <10% |
| WAU/MAU Ratio | Weekly Active / Monthly Active | >50% | <30% |
| Adoption Rate | Active Users / Licensed Users | >70% | <50% |
| Stickiness | Days Active / Days in Period | >60% | <40% |

### Tier 2: Engagement Indicators
| Metric | Description | Target |
|--------|-------------|--------|
| Session Duration | Avg time per session | >10 min |
| Sessions/User/Week | Frequency of use | >3 |
| Feature Breadth | % features used | >40% |
| Actions/Session | Avg actions taken | >5 |

### Tier 3: Value Indicators
| Metric | Description | Target |
|--------|-------------|--------|
| Workflow Completion | % workflows finished | >80% |
| Goal Achievement | Business outcomes met | >70% |
| Time Savings | Hours saved vs baseline | >10hrs/week |
| Error Reduction | % fewer errors | >30% |

## Analysis Methodology

### Step 1: Data Collection
```
Sources:
- Product analytics (Mixpanel, Amplitude)
- Application logs
- API usage data
- Support tickets
- User surveys
```

### Step 2: Segmentation
**By Role:**
- Admins vs. End Users
- Power Users vs. Casual Users
- New vs. Tenured Users

**By Department:**
- Sales, Marketing, Support, etc.
- Regional differences
- Team-level patterns

### Step 3: Trend Analysis
**Time Series:**
- Weekly trends
- Month-over-month growth
- Seasonal patterns
- Post-training spikes

**Comparison:**
- vs. Baseline
- vs. Similar customers
- vs. Industry benchmarks

### Step 4: Insight Generation

**Positive Patterns (Amplify):**
- High-usage features → Expand training
- Power users → Champion program
- Growing departments → Replication

**Negative Patterns (Address):**
- Declining login frequency → Re-engagement
- Feature abandonment → Education
- Low adoption segments → Targeted outreach

## Reporting Templates

### Weekly Usage Summary
```
Customer: [Name]
Period: [Week]

Key Metrics:
- DAU: [X] (Δ [%] vs last week)
- WAU: [X] (Δ [%] vs last week)
- Adoption: [X]% of [Y] licenses

Top Features This Week:
1. [Feature] - [X] users
2. [Feature] - [X] users
3. [Feature] - [X] users

Trends to Watch:
- [Trend 1]
- [Trend 2]

Recommended Actions:
- [Action 1]
- [Action 2]
```

### Monthly Business Review
```
Executive Summary:
- Overall health: [Green/Yellow/Red]
- Adoption trajectory: [↑/→/↓]
- Value delivered: [X]

Detailed Metrics:
[Include Tier 1, 2, 3 metrics]

Recommendations:
[Strategic recommendations]
```
$$,
'Framework for analyzing customer usage data with metrics hierarchy, analysis methodology, and reporting templates',
ARRAY['usage analytics', 'adoption metrics', 'data analysis', 'reporting'],
ARRAY['analytics', 'usage', 'metrics', 'adoption', 'reporting'],
'CSCX Platform'
),

-- 7. Champion Development Playbook
('adoption', 'champions', 'Champion Development Playbook',
$$# Champion Development Playbook

## Overview
Champions are internal advocates who drive adoption and serve as your voice inside the customer organization. This playbook covers identification, nurturing, and leveraging champions.

## Champion Identification

### Behavioral Indicators
- **Usage Leaders:** Top 10% by login frequency
- **Feature Explorers:** Uses multiple features
- **Help Seekers:** Engages support productively
- **Content Consumers:** Reads documentation, attends webinars
- **Feedback Providers:** Submits feature requests, participates in surveys

### Profile Characteristics
- **Influence:** Respected by peers
- **Enthusiasm:** Genuine product believer
- **Communication:** Articulate and proactive
- **Position:** Enough authority to drive change

### Identification Questions
Ask your contacts:
- "Who on your team has become the go-to expert?"
- "Who's most excited about the results they're seeing?"
- "Who would be great to feature in a case study?"

## Champion Nurturing Program

### Tier 1: Recognition (Months 1-2)
**Activities:**
- Personal thank-you note
- Feature in internal newsletter
- Early access to beta features
- Direct line to product team

**Touchpoints:**
- Bi-weekly check-ins
- Slack/Teams channel access
- Priority support queue

### Tier 2: Empowerment (Months 3-6)
**Activities:**
- Advanced training certification
- "Super user" badge/title
- Invite to Customer Advisory Board
- Co-present at webinars

**Touchpoints:**
- Weekly office hours access
- Roadmap preview sessions
- Feature prioritization input

### Tier 3: Partnership (Months 6+)
**Activities:**
- Reference customer program
- Case study development
- Speaking opportunities
- Product co-innovation

**Touchpoints:**
- Monthly strategy calls
- Executive relationship building
- Conference VIP access

## Champion Engagement Calendar

| Month | Activity | Outcome |
|-------|----------|---------|
| 1 | Identification & outreach | Champion enrolled |
| 2 | Deep-dive training | Expertise built |
| 3 | First internal presentation | Visibility increased |
| 4 | Customer Advisory Board invite | Strategic input |
| 5 | Case study development | External reference |
| 6 | Annual conference invite | Relationship deepened |

## Champion Risk Management

### Warning Signs
- Decreased engagement
- Negative sentiment shift
- Role change announced
- Competitor mentions
- Reduced advocacy

### Retention Strategies
- Regular recognition
- Exclusive benefits
- Career development support
- Executive access
- Product influence

### Champion Transition Plan
When a champion leaves:
1. Thank them and maintain relationship
2. Ask for introduction to successor
3. Request LinkedIn recommendation
4. Invite to alumni program
5. Identify and develop new champion

## Measuring Champion Impact

| Metric | Description | Target |
|--------|-------------|--------|
| Adoption in Champion's team | vs. non-champion teams | +30% |
| Feature adoption rate | Champion-influenced features | +25% |
| Support ticket reduction | In champion's area | -40% |
| NPS score | Champion vs. average | +20 points |
| Expansion influence | Champion involvement in deals | 50% |
$$,
'Comprehensive playbook for identifying, nurturing, and leveraging customer champions to drive adoption',
ARRAY['champion program', 'customer advocacy', 'power user development', 'adoption drivers'],
ARRAY['champion', 'advocate', 'power user', 'nurturing', 'adoption'],
'CSCX Platform'
),

-- 8. Feature Adoption Campaigns
('adoption', 'campaigns', 'Feature Adoption Campaign Playbook',
$$# Feature Adoption Campaign Playbook

## Overview
Structured campaigns to drive adoption of specific features, ensuring customers realize full product value.

## Campaign Framework

### Phase 1: Planning (Week 1)

**Target Selection:**
- Choose underutilized feature with high value potential
- Identify customer segments with use case fit
- Set adoption target (e.g., +20% usage)

**Success Metrics:**
- Feature activation rate
- Feature usage frequency
- Feature retention (continued use after 30 days)
- Associated business outcome

**Resource Requirements:**
- Training materials
- In-app guidance
- Email templates
- Support documentation

### Phase 2: Awareness (Week 2)

**Communication Channels:**
1. **Email Campaign**
   - Subject: "[Feature] can help you [Outcome]"
   - Include: Problem statement, solution, CTA

2. **In-App Notification**
   - Tooltip or modal introducing feature
   - Link to getting started guide

3. **CSM Outreach**
   - Personalized message to key contacts
   - Offer enablement session

**Awareness Email Template:**
```
Hi [Name],

Did you know [Feature] can help you [Specific Outcome]?

Customers like [Similar Company] are seeing:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

Here's how to get started:
[3-step quick start guide]

Want a walkthrough? Reply to schedule a 15-minute session.

[Your Name]
```

### Phase 3: Enablement (Weeks 3-4)

**Training Delivery:**
1. Self-service: Video tutorials, documentation
2. Webinar: Live group training session
3. 1:1: Personalized enablement for key accounts

**Enablement Checklist:**
- [ ] Pre-training assessment sent
- [ ] Training session completed
- [ ] Hands-on exercise finished
- [ ] Q&A addressed
- [ ] Follow-up resources shared

### Phase 4: Activation (Weeks 5-6)

**Activation Tactics:**
- In-app challenges with rewards
- Success story sharing
- Office hours for questions
- Peer learning sessions

**Activation Tracking:**
```
Week 5:
- Activation target: 50% of campaign audience
- Current: [X]%
- Top blockers: [List]

Week 6:
- Activation target: 70%
- Current: [X]%
- Intervention needed: [Yes/No]
```

### Phase 5: Reinforcement (Weeks 7-8)

**Retention Tactics:**
- Usage tips drip campaign
- Advanced feature webinar
- Success celebration email
- Champion spotlight

**Reinforcement Email:**
```
Hi [Name],

You've been using [Feature] for 2 weeks now! Here's what we've noticed:

📈 Your usage: [X] times this week
💡 Your top use case: [Use case]
🏆 Pro tip: [Advanced tip]

Keep up the great work!

[Your Name]
```

## Campaign Performance Dashboard

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Reach (opened email) | 60% | | |
| Engagement (clicked CTA) | 25% | | |
| Activation (first use) | 50% | | |
| Adoption (regular use) | 30% | | |
| Retention (30-day) | 70% | | |

## Common Objections & Responses

| Objection | Response |
|-----------|----------|
| "We're too busy" | "15-minute session can save hours weekly" |
| "We don't need it" | "Let me show how [similar customer] uses it" |
| "It's too complex" | "Here's a simple 3-step getting started guide" |
| "We have other tools" | "This integrates with your existing workflow" |
$$,
'Structured playbook for planning and executing feature adoption campaigns with templates and metrics',
ARRAY['feature adoption', 'user education', 'campaign management', 'product engagement'],
ARRAY['features', 'adoption', 'campaign', 'enablement', 'training'],
'CSCX Platform'
),

-- 9. Training Program Templates
('adoption', 'training', 'Customer Training Program Templates',
$$# Customer Training Program Templates

## Overview
Structured training programs for different user personas and skill levels.

## Training Track: Administrator

### Module 1: Platform Fundamentals (60 min)
**Learning Objectives:**
- Navigate the admin console
- Understand user management
- Configure basic settings

**Agenda:**
1. Platform overview (10 min)
2. User management demo (20 min)
3. Settings configuration (20 min)
4. Hands-on exercise (10 min)

**Exercise:**
- Create 3 test users
- Configure role permissions
- Set up a team structure

### Module 2: Advanced Configuration (90 min)
**Learning Objectives:**
- Set up integrations
- Configure workflows
- Customize dashboards

**Agenda:**
1. Integration options (20 min)
2. Workflow builder (30 min)
3. Dashboard customization (25 min)
4. Best practices review (15 min)

### Module 3: Administration Best Practices (60 min)
**Learning Objectives:**
- Establish governance policies
- Monitor system health
- Troubleshoot common issues

---

## Training Track: End User

### Module 1: Getting Started (30 min)
**Learning Objectives:**
- Log in and navigate interface
- Complete basic tasks
- Find help resources

**Agenda:**
1. Welcome and overview (5 min)
2. Interface tour (10 min)
3. Core task walkthrough (10 min)
4. Q&A (5 min)

### Module 2: Daily Workflows (45 min)
**Learning Objectives:**
- Execute primary workflows
- Use collaboration features
- Track progress and status

### Module 3: Tips & Tricks (30 min)
**Learning Objectives:**
- Keyboard shortcuts
- Time-saving features
- Personal customization

---

## Training Track: Power User

### Module 1: Advanced Features (60 min)
**Learning Objectives:**
- Master advanced functionality
- Create custom solutions
- Optimize workflows

### Module 2: Data & Analytics (60 min)
**Learning Objectives:**
- Build custom reports
- Export and analyze data
- Create dashboards

### Module 3: Automation (60 min)
**Learning Objectives:**
- Set up automated workflows
- Create triggers and actions
- Monitor automation health

---

## Training Delivery Methods

### Self-Service
- Video library with progress tracking
- Interactive tutorials
- Documentation with examples
- Quizzes for certification

### Live Sessions
- Webinar format (up to 50)
- Small group (up to 10)
- 1:1 coaching

### Blended Learning
- Pre-work: Videos + reading
- Live session: Demo + Q&A
- Post-work: Exercises + certification

---

## Certification Program

### Level 1: Foundation
- Complete Module 1
- Pass quiz (80%+)
- Badge: [Product] Certified User

### Level 2: Proficient
- Complete Modules 1-2
- Complete 3 hands-on exercises
- Badge: [Product] Proficient User

### Level 3: Expert
- Complete all modules
- Pass comprehensive exam (85%+)
- Complete capstone project
- Badge: [Product] Certified Expert

---

## Training Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Training completion rate | >80% | LMS data |
| Quiz pass rate | >85% | Assessment scores |
| Training satisfaction | >4.5/5 | Post-training survey |
| Time to competency | <2 weeks | First successful task |
| Post-training adoption | +30% | Usage metrics |
$$,
'Comprehensive training program templates for administrators, end users, and power users with certification paths',
ARRAY['training programs', 'user education', 'certification', 'skill development'],
ARRAY['training', 'education', 'certification', 'onboarding', 'users'],
'CSCX Platform'
),

-- 10. Adoption Benchmarks
('adoption', 'benchmarks', 'Industry Adoption Benchmarks',
$$# Industry Adoption Benchmarks

## Overview
Reference benchmarks for measuring customer adoption against industry standards and peer groups.

## Universal Benchmarks

### Activation Metrics
| Metric | Good | Great | Best-in-Class |
|--------|------|-------|---------------|
| Time to First Value | <14 days | <7 days | <3 days |
| Setup Completion Rate | >70% | >85% | >95% |
| First Feature Use | >60% | >75% | >90% |
| Second Week Return | >50% | >70% | >85% |

### Engagement Metrics
| Metric | Good | Great | Best-in-Class |
|--------|------|-------|---------------|
| DAU/MAU Ratio | >15% | >25% | >35% |
| WAU/MAU Ratio | >40% | >55% | >70% |
| Sessions/User/Week | >2 | >4 | >7 |
| Avg Session Duration | >5 min | >10 min | >20 min |

### Adoption Metrics
| Metric | Good | Great | Best-in-Class |
|--------|------|-------|---------------|
| License Utilization | >60% | >75% | >90% |
| Feature Breadth | >30% | >50% | >70% |
| Power User % | >10% | >20% | >30% |
| Churned User Rate | <15% | <10% | <5% |

## Industry-Specific Benchmarks

### SaaS / Technology
- Adoption Rate: 75% (median)
- Time to Value: 14 days
- Feature Adoption: 45%
- Key Driver: Integration depth

### Financial Services
- Adoption Rate: 65% (median)
- Time to Value: 30 days
- Feature Adoption: 35%
- Key Driver: Security compliance

### Healthcare
- Adoption Rate: 55% (median)
- Time to Value: 45 days
- Feature Adoption: 30%
- Key Driver: Training completeness

### Retail / E-commerce
- Adoption Rate: 70% (median)
- Time to Value: 10 days
- Feature Adoption: 50%
- Key Driver: Quick wins

### Manufacturing
- Adoption Rate: 50% (median)
- Time to Value: 60 days
- Feature Adoption: 40%
- Key Driver: Process integration

## Segment-Specific Benchmarks

### By Company Size
| Segment | Adoption Rate | Time to Value | Support Tickets |
|---------|--------------|---------------|-----------------|
| SMB (<100 employees) | 75% | 7 days | 2/month |
| Mid-Market (100-1000) | 65% | 21 days | 5/month |
| Enterprise (1000+) | 55% | 45 days | 10/month |

### By ARR
| ARR Tier | Expected Adoption | Typical TTV | QBR Frequency |
|----------|-------------------|-------------|---------------|
| <$25K | 80% | 7 days | Annual |
| $25K-$100K | 70% | 14 days | Semi-annual |
| $100K-$500K | 60% | 30 days | Quarterly |
| $500K+ | 50% | 45 days | Monthly |

## Healthy vs. At-Risk Patterns

### Healthy Customer Profile
- Day 7: 30%+ users active
- Day 30: 50%+ adoption
- Day 60: Expanding usage
- Day 90: Feature requests coming

### At-Risk Customer Profile
- Day 7: <10% users active
- Day 30: <30% adoption
- Day 60: Usage declining
- Day 90: No engagement

## Using Benchmarks

### For Customer Conversations
"Based on similar companies, we typically see [X]% adoption by day 30. You're at [Y]%. Here's how we can close the gap..."

### For Internal Reviews
"This customer's DAU/MAU of 12% is below the 20% benchmark. Recommend adoption campaign focused on daily use cases."

### For Expansion Discussions
"Your adoption is in the top quartile at 85%. Customers at this level typically see value from [additional product]..."
$$,
'Industry benchmarks for measuring customer adoption performance against standards and peer groups',
ARRAY['benchmarks', 'industry standards', 'adoption metrics', 'performance comparison'],
ARRAY['benchmarks', 'metrics', 'industry', 'comparison', 'standards'],
'CSCX Platform'
);

-- ============================================
-- RENEWAL AGENT PLAYBOOKS (5)
-- ============================================

INSERT INTO csm_playbooks (category, subcategory, title, content, summary, use_cases, tags, source)
VALUES
-- 11. 120-Day Renewal Playbook
('renewal', 'process', '120-Day Renewal Playbook',
$$# 120-Day Renewal Playbook

## Overview
A structured approach to managing renewals from 120 days out through contract signature.

## Timeline Overview

```
Day 120 ──→ Day 90 ──→ Day 60 ──→ Day 30 ──→ Day 7 ──→ Renewal
   │          │          │          │         │
   │          │          │          │         └─ Final push
   │          │          │          └─ Negotiation
   │          │          └─ Proposal
   │          └─ Value confirmation
   └─ Health assessment
```

## Phase 1: Health Assessment (Day 120-90)

### Day 120 Activities
- [ ] Pull usage and health data
- [ ] Review support ticket history
- [ ] Assess stakeholder engagement
- [ ] Calculate value delivered

### Health Assessment Checklist
| Area | Green | Yellow | Red |
|------|-------|--------|-----|
| Usage | >70% adoption | 50-70% | <50% |
| Engagement | Monthly contact | Quarterly | No contact |
| Support | <5 tickets | 5-10 tickets | >10 tickets |
| Value | ROI documented | Partial | None |

### Day 110 Activities
- [ ] Schedule health check call
- [ ] Prepare value summary draft
- [ ] Identify expansion opportunities

### Day 100 Activities
- [ ] Conduct health check meeting
- [ ] Address any concerns
- [ ] Align on renewal timeline

## Phase 2: Value Confirmation (Day 90-60)

### Day 90 Activities
- [ ] Send value summary document
- [ ] Schedule business review
- [ ] Confirm renewal decision makers

### Value Confirmation Meeting
**Agenda:**
1. Review business outcomes achieved
2. Share usage and adoption metrics
3. Present ROI analysis
4. Discuss future roadmap
5. Introduce renewal discussion

### Day 75 Activities
- [ ] Document verbal renewal intent
- [ ] Identify any blockers
- [ ] Begin proposal preparation

### Day 60 Activities
- [ ] Present renewal proposal
- [ ] Include expansion options
- [ ] Set negotiation timeline

## Phase 3: Proposal & Negotiation (Day 60-30)

### Proposal Components
1. **Executive Summary**
   - Partnership highlights
   - Value delivered
   - Recommendation

2. **Renewal Terms**
   - Pricing (with options)
   - Contract term
   - Service levels

3. **Expansion Options**
   - Additional products
   - More users/capacity
   - Premium support

### Day 45 Activities
- [ ] Follow up on proposal
- [ ] Address questions/objections
- [ ] Refine terms if needed

### Day 30 Activities
- [ ] Confirm final terms
- [ ] Send contract for review
- [ ] Engage legal/procurement

## Phase 4: Close (Day 30-0)

### Day 21 Activities
- [ ] Check contract review status
- [ ] Address legal questions
- [ ] Confirm signature timeline

### Day 14 Activities
- [ ] Final negotiation if needed
- [ ] Escalate any blockers
- [ ] Prepare for close

### Day 7 Activities
- [ ] Signature follow-up
- [ ] Confirm payment terms
- [ ] Plan post-renewal activities

### Renewal Day Activities
- [ ] Confirm contract signed
- [ ] Process internally
- [ ] Send thank you note
- [ ] Schedule kickoff for new term

## Risk Mitigation

### High-Risk Indicators
- No champion/sponsor
- Declining usage
- Budget concerns
- Competitor evaluation
- Organizational change

### Escalation Triggers
- No response at day 90
- Negative feedback at health check
- Competitor mentioned
- Downgrade requested
- Legal delays >14 days

### Save Plays
- Executive intervention
- Extended trial of new features
- Custom pricing/terms
- Professional services
- Product roadmap commitments
$$,
'Comprehensive 120-day playbook for managing customer renewals with timeline, activities, and risk mitigation',
ARRAY['renewal management', 'contract renewal', 'customer retention', 'renewal timeline'],
ARRAY['renewal', '120-day', 'playbook', 'retention', 'contract'],
'CSCX Platform'
),

-- 12. Value Summary Framework
('renewal', 'value', 'Value Summary Framework',
$$# Value Summary Framework

## Overview
A structured approach to documenting and communicating value delivered to customers.

## Value Summary Structure

### 1. Executive Summary
```
During [time period], [Customer] achieved:
• [Primary outcome with metric]
• [Secondary outcome with metric]
• [Tertiary outcome with metric]

Total estimated value: $[X] / [ROI]%
```

### 2. Business Outcomes

**Quantitative Outcomes:**
| Outcome | Before | After | Improvement |
|---------|--------|-------|-------------|
| [Metric 1] | [X] | [Y] | [Z]% |
| [Metric 2] | [X] | [Y] | [Z]% |
| [Metric 3] | [X] | [Y] | [Z]% |

**Qualitative Outcomes:**
- [Improved process/capability 1]
- [Improved process/capability 2]
- [Improved process/capability 3]

### 3. Usage Highlights
```
Active Users: [X] of [Y] licensed ([Z]%)
Key Features Used: [List]
Total Actions: [X] this period
Peak Usage: [When/What]
```

### 4. ROI Calculation

**Time Savings:**
- Hours saved per user per week: [X]
- Total users: [Y]
- Weeks in period: [Z]
- Total hours saved: X × Y × Z = [Hours]
- Value at $[hourly rate]: $[Amount]

**Cost Reduction:**
- Previous solution cost: $[X]
- Current solution cost: $[Y]
- Annual savings: $[Z]

**Revenue Impact:**
- Deals influenced: [X]
- Average deal size: $[Y]
- Win rate improvement: [Z]%
- Revenue impact: $[Amount]

**Total ROI:**
```
Total Value = Time Savings + Cost Reduction + Revenue Impact
ROI = (Total Value - Investment) / Investment × 100%
```

### 5. Customer Testimonials
```
"[Quote from champion about specific outcome]"
- [Name], [Title], [Company]
```

### 6. Future Value Potential
- Expansion opportunity: [Description]
- Additional use cases: [List]
- Projected value: $[X] over [timeframe]

## Value Data Sources

### Quantitative
- Product analytics
- CRM/ERP integration
- Customer-provided metrics
- Survey responses
- Benchmark comparisons

### Qualitative
- Customer interviews
- Support ticket analysis
- User feedback
- Case study interviews
- QBR discussions

## Value Summary Templates

### One-Page Summary
For executive stakeholders:
- 3 key metrics
- ROI headline
- Visual chart
- Customer quote
- Next steps

### Detailed Report
For operational stakeholders:
- Full metrics breakdown
- Usage analysis
- ROI calculation details
- Recommendations
- Appendix with methodology

### Presentation Deck
For QBR/Business Review:
- Slide 1: Executive summary
- Slide 2-3: Outcomes achieved
- Slide 4: Usage highlights
- Slide 5: ROI analysis
- Slide 6: Future roadmap
- Slide 7: Discussion
$$,
'Framework for documenting and presenting customer value with ROI calculations and templates',
ARRAY['value documentation', 'ROI calculation', 'business outcomes', 'customer success'],
ARRAY['value', 'ROI', 'outcomes', 'summary', 'metrics'],
'CSCX Platform'
),

-- 13. Expansion Identification
('renewal', 'expansion', 'Expansion Opportunity Identification Guide',
$$# Expansion Opportunity Identification Guide

## Overview
A systematic approach to identifying and qualifying upsell and cross-sell opportunities.

## Expansion Signal Categories

### 1. Usage Signals
| Signal | Opportunity Type | Score |
|--------|-----------------|-------|
| Hitting usage limits | Capacity upsell | High |
| High adoption rate (>80%) | Add users | High |
| Feature request for premium | Product upsell | Medium |
| Multiple use cases emerging | Module add-on | Medium |
| Power users developing | Enterprise tier | Low |

### 2. Business Signals
| Signal | Opportunity Type | Score |
|--------|-----------------|-------|
| Company growth announced | Add users | High |
| New department interest | Cross-sell | High |
| M&A activity | Enterprise deal | High |
| Budget cycle starting | Multi-year | Medium |
| New initiative launched | New use case | Medium |

### 3. Relationship Signals
| Signal | Opportunity Type | Score |
|--------|-----------------|-------|
| Champion promoted | Expand scope | High |
| Executive sponsor engaged | Strategic deal | High |
| Referral provided | Advocacy → Deeper | Medium |
| Case study participation | Partnership | Medium |
| Advisory board interest | Strategic tier | Low |

## Qualification Framework

### MEDDIC for Expansion
- **Metrics:** What business outcomes justify expansion?
- **Economic Buyer:** Who approves additional budget?
- **Decision Criteria:** What factors influence the decision?
- **Decision Process:** How are expansion decisions made?
- **Identify Pain:** What problem does expansion solve?
- **Champion:** Who will advocate internally?

### Expansion Readiness Score
```
Score each 1-5:
- Current adoption level: [  ]
- Value realization: [  ]
- Champion engagement: [  ]
- Budget availability: [  ]
- Use case clarity: [  ]

Total: [  ] / 25

Threshold:
- 20+: Ready to propose
- 15-19: Nurture further
- <15: Focus on adoption first
```

## Discovery Questions

### For Additional Users
- "How many people could benefit from this?"
- "Are there teams we haven't talked to yet?"
- "What would it take to roll out company-wide?"

### For Premium Features
- "Have you explored [premium feature]?"
- "How much time do you spend on [task premium solves]?"
- "What would it mean to automate [process]?"

### For New Products
- "How are you handling [related problem] today?"
- "Would it help to have [capability] in one place?"
- "Who manages [related function]?"

## Expansion Conversation Starters

### The Success Story Approach
"Customers like you who've seen success with [current use case] often expand into [new area]. Would that be relevant?"

### The Benchmark Approach
"Companies your size typically use [X] licenses. You're at [Y]. Should we discuss growing?"

### The Roadmap Approach
"Our [new feature/product] launches next quarter. Based on your goals, this could help with [outcome]. Want a preview?"

### The Peer Approach
"[Similar company] recently added [product/feature] and saw [result]. Would you like to learn more?"

## Expansion Tracking

### Pipeline Stages
1. Identified - Signal detected
2. Qualified - MEDDIC completed
3. Proposed - Offer presented
4. Negotiating - Terms discussed
5. Closed Won/Lost

### Metrics to Track
| Metric | Target |
|--------|--------|
| Expansion opportunities identified | 2/customer/year |
| Qualification rate | >50% |
| Close rate | >40% |
| Average expansion value | >20% of current ARR |
| Time to close | <90 days |
$$,
'Guide to identifying, qualifying, and pursuing expansion opportunities with signals, frameworks, and conversation starters',
ARRAY['expansion', 'upsell', 'cross-sell', 'revenue growth', 'account growth'],
ARRAY['expansion', 'upsell', 'cross-sell', 'growth', 'opportunity'],
'CSCX Platform'
),

-- 14. Objection Handling Guide
('renewal', 'negotiation', 'Renewal Objection Handling Guide',
$$# Renewal Objection Handling Guide

## Overview
Common renewal objections and effective response strategies.

## Objection Categories

### 1. Price Objections

**"The price is too high"**
```
Acknowledge: "I understand budget is important."

Explore: "Help me understand what you're comparing us to.
Is it the previous price, a competitor, or internal budget?"

Respond (Previous Price):
"Our pricing reflects the enhanced value we've delivered.
Let me walk through the specific improvements and ROI..."

Respond (Competitor):
"I'd be happy to compare capabilities. Often what looks
cheaper initially has hidden costs in [area]. Let's review
total cost of ownership..."

Respond (Budget):
"Let's explore options that work within your budget
while maintaining the value you need..."
```

**"We need a discount"**
```
Acknowledge: "I want to find a solution that works."

Explore: "What would make this work for you? Is it the
total amount or the per-unit price?"

Respond:
"I can offer [X]% if you commit to [multi-year/expanded scope].
This provides stability for both of us and actually increases
your total value..."
```

### 2. Value Objections

**"We're not seeing ROI"**
```
Acknowledge: "That's concerning - ROI is critical."

Explore: "Walk me through what success would look like
and where we're falling short."

Respond:
"Let me share what similar customers are achieving.
I'll also bring in our success team to build a 90-day
value acceleration plan at no additional cost..."
```

**"We don't use it enough"**
```
Acknowledge: "Usage is definitely important to track."

Explore: "What's preventing broader adoption? Is it
awareness, training, or process fit?"

Respond:
"Many customers face this initially. Here's what worked
for [similar company]: [specific intervention]. Let's
implement this before renewal..."
```

### 3. Competitive Objections

**"We're evaluating alternatives"**
```
Acknowledge: "It makes sense to assess options."

Explore: "What's driving the evaluation? Is there
something we're not providing?"

Respond:
"I'd appreciate the chance to address any gaps before
you invest time elsewhere. Can we schedule a call with
our [product/exec] team this week?"
```

**"Competitor X is cheaper/better"**
```
Acknowledge: "Competition keeps us sharp."

Explore: "What specifically appeals to you about them?"

Respond:
"I've seen customers switch to [competitor] and come
back because of [specific differentiator]. The switching
cost and learning curve often outweigh any savings.
Let me show you our roadmap for [their strength]..."
```

### 4. Timing Objections

**"We need more time"**
```
Acknowledge: "I want you to feel confident in the decision."

Explore: "What information would help you decide sooner?"

Respond:
"I can extend the deadline by [X] days. In the meantime,
let's schedule a call to address any remaining questions.
Here's what I need by [date] to maintain your current terms..."
```

**"We'll renew but not now"**
```
Acknowledge: "I appreciate your intent to continue."

Explore: "What's driving the delay?"

Respond:
"I can offer a [short-term extension/bridge agreement]
to give you flexibility while we finalize terms. This
protects your pricing and ensures no service disruption..."
```

### 5. Authority Objections

**"I need to get approval"**
```
Acknowledge: "Of course, this is an important decision."

Explore: "Who else is involved? What do they typically
look for in these decisions?"

Respond:
"I'll prepare an executive summary for your leadership.
Would it help if I joined the conversation to address
any questions directly?"
```

## Response Framework: LAER

1. **Listen** - Fully understand the objection
2. **Acknowledge** - Show empathy and validate
3. **Explore** - Ask questions to uncover root cause
4. **Respond** - Address with relevant solution/evidence

## Escalation Guidelines

### When to Escalate
- Executive sponsor disengaged
- Competitor threat confirmed
- Legal/procurement impasse
- >20% discount requested
- Churn risk confirmed

### Who to Involve
| Situation | Escalate To |
|-----------|-------------|
| Pricing authority | Sales leadership |
| Product gaps | Product management |
| Technical issues | Solutions engineering |
| Executive relationship | CS leadership |
| Legal terms | Legal team |
$$,
'Comprehensive guide to handling common renewal objections with response frameworks and escalation guidelines',
ARRAY['objection handling', 'negotiation', 'renewal conversations', 'customer retention'],
ARRAY['objections', 'negotiation', 'renewal', 'responses', 'retention'],
'CSCX Platform'
),

-- 15. Pricing Negotiation Tactics
('renewal', 'pricing', 'Pricing & Negotiation Tactics',
$$# Pricing & Negotiation Tactics

## Overview
Strategic approaches to pricing discussions and negotiation during renewals.

## Pricing Principles

### 1. Value Before Price
Always establish value before discussing price:
```
Wrong: "The renewal price is $X"
Right: "Based on the $Y value delivered, continuing
       at $X represents excellent ROI"
```

### 2. Anchor High, Negotiate Down
Start negotiations with premium positioning:
- Lead with full-price renewal
- Include expansion options
- Make concessions strategically

### 3. Trade, Don't Give
Never give discounts without getting something:
```
Customer: "We need 15% off"
Response: "I can do 15% with a 3-year commitment and
          net-30 payment terms"
```

## Discount Authority Matrix

| Discount Level | Authority | Conditions |
|----------------|-----------|------------|
| 0-5% | CSM | Multi-year, annual payment |
| 5-10% | Manager | Strategic account, expansion |
| 10-15% | Director | Competitive threat, save play |
| 15-20% | VP | Executive approval, documented |
| >20% | C-level | Exception only |

## Negotiation Tactics

### Tactic 1: The Bundle
```
"I can't reduce the per-unit price, but I can include
[premium feature/additional users/support tier] at
no extra cost"
```

### Tactic 2: The Multi-Year
```
"A 10% discount isn't available on annual terms,
but I can offer that on a 3-year agreement with
price protection"
```

### Tactic 3: The Timeline
```
"I can offer 8% off if we sign by [date]. After that,
I can only do 5% due to [reason]"
```

### Tactic 4: The Trade-Off
```
"I can reduce the price by 10% if you can:
- Pay annually upfront
- Serve as a reference customer
- Participate in our case study program"
```

### Tactic 5: The Split
```
"What if we split the difference? You want $X,
we proposed $Y. Let's meet at $Z"
```

## Common Scenarios

### Scenario: Budget Crunch
**Customer:** "We only have $X budget this year"

**Response Options:**
1. Reduce term to fit budget (6-month renewal)
2. Remove features to reduce cost
3. Offer payment plan (quarterly)
4. Split across fiscal years

### Scenario: Procurement Pressure
**Procurement:** "We need 20% off across all vendors"

**Response Options:**
1. Request exception due to existing discount
2. Document unique value not comparable
3. Offer non-monetary concessions
4. Escalate to executive sponsor

### Scenario: Competitive Bid
**Customer:** "Competitor quoted 30% less"

**Response Options:**
1. Request to see competitive quote
2. Compare total cost of ownership
3. Highlight switching costs
4. Offer trial of competitive features

## Closing Techniques

### The Summary Close
"So we've agreed on [term, price, scope]. Shall I
send the contract for signature?"

### The Assumptive Close
"I'll get the paperwork over today for a January 1
start date. Who should I send it to?"

### The Alternative Close
"Would you prefer the 2-year at 8% off, or the
3-year at 12% off?"

### The Timeline Close
"To maintain your current pricing, we need signature
by [date]. What do you need from me to make that happen?"

## Walk-Away Points

Know when to hold firm:
- Below cost pricing
- Terms outside policy
- Scope reduction below minimum
- Risk of setting precedent
- Customer unlikely to be successful

## Documentation Requirements

After negotiation, document:
- [ ] Final agreed pricing
- [ ] All concessions made
- [ ] Conditions attached
- [ ] Approval chain followed
- [ ] Contract reflects terms
$$,
'Strategic pricing and negotiation tactics for renewal conversations with scenarios and closing techniques',
ARRAY['pricing', 'negotiation', 'discount strategy', 'contract terms'],
ARRAY['pricing', 'negotiation', 'discount', 'tactics', 'closing'],
'CSCX Platform'
);

-- ============================================
-- RISK AGENT PLAYBOOKS (5)
-- ============================================

INSERT INTO csm_playbooks (category, subcategory, title, content, summary, use_cases, tags, source)
VALUES
-- 16. Health Scoring Methodology
('risk', 'health', 'Customer Health Scoring Methodology',
$$# Customer Health Scoring Methodology

## Overview
A comprehensive approach to measuring and predicting customer health using multiple signal categories.

## Health Score Components

### Component Weights
| Component | Weight | Description |
|-----------|--------|-------------|
| Product Usage | 25% | Engagement with features |
| Customer Engagement | 20% | Interaction with CS team |
| Support Health | 15% | Ticket volume and sentiment |
| NPS/Sentiment | 15% | Customer satisfaction |
| Contract Health | 15% | Renewal and payment |
| Stakeholder Health | 10% | Champion and sponsor status |

## Detailed Scoring Criteria

### 1. Product Usage Score (25%)

| Metric | 100 pts | 75 pts | 50 pts | 25 pts | 0 pts |
|--------|---------|--------|--------|--------|-------|
| DAU/MAU | >30% | 20-30% | 15-20% | 10-15% | <10% |
| Adoption | >80% | 60-80% | 40-60% | 20-40% | <20% |
| Feature Breadth | >50% | 35-50% | 20-35% | 10-20% | <10% |
| Trend | ↑ | → | ↓ slight | ↓ moderate | ↓ severe |

### 2. Customer Engagement Score (20%)

| Metric | 100 pts | 75 pts | 50 pts | 25 pts | 0 pts |
|--------|---------|--------|--------|--------|-------|
| Last Contact | <14d | 14-30d | 30-60d | 60-90d | >90d |
| Meeting Attendance | 100% | 75%+ | 50%+ | 25%+ | <25% |
| Email Response | <24h | 24-48h | 48-72h | >72h | None |
| QBR Participation | Yes + Action | Yes | Partial | Declined | No show |

### 3. Support Health Score (15%)

| Metric | 100 pts | 75 pts | 50 pts | 25 pts | 0 pts |
|--------|---------|--------|--------|--------|-------|
| Tickets/Month | 0-2 | 3-5 | 6-10 | 11-20 | >20 |
| P1 Tickets | 0 | 1 | 2 | 3+ | Unresolved P1 |
| Resolution Time | <24h | 24-48h | 48-72h | >72h | >1 week |
| Ticket Trend | ↓ | → | ↑ slight | ↑ moderate | ↑ severe |

### 4. NPS/Sentiment Score (15%)

| Metric | 100 pts | 75 pts | 50 pts | 25 pts | 0 pts |
|--------|---------|--------|--------|--------|-------|
| NPS Score | 9-10 | 7-8 | 5-6 | 3-4 | 0-2 |
| Survey Response | Yes + Comments | Yes | Partial | Declined | Never |
| Sentiment Trend | Improving | Stable + | Stable | Declining | Severe decline |

### 5. Contract Health Score (15%)

| Metric | 100 pts | 75 pts | 50 pts | 25 pts | 0 pts |
|--------|---------|--------|--------|--------|-------|
| Days to Renewal | >120 | 90-120 | 60-90 | 30-60 | <30 |
| Renewal Intent | Confirmed | Likely | Uncertain | Unlikely | Confirmed churn |
| Payment Status | On time | Delayed once | Delayed 2x | >30 days late | Collections |
| Growth Trend | Expanding | Flat | Flat-risk | Downgade | Churn risk |

### 6. Stakeholder Health Score (10%)

| Metric | 100 pts | 75 pts | 50 pts | 25 pts | 0 pts |
|--------|---------|--------|--------|--------|-------|
| Champion Status | Active | Engaged | Passive | Disengaged | Left/None |
| Sponsor Status | Engaged | Available | Limited | Unavailable | Left/None |
| Multi-threading | 4+ contacts | 3 contacts | 2 contacts | 1 contact | 0 contacts |
| Org Stability | Stable | Minor change | Reorg | Major change | Crisis |

## Score Calculation

```
Overall Health Score =
  (Usage Score × 0.25) +
  (Engagement Score × 0.20) +
  (Support Score × 0.15) +
  (NPS Score × 0.15) +
  (Contract Score × 0.15) +
  (Stakeholder Score × 0.10)
```

## Health Grades

| Score Range | Grade | Color | Action |
|-------------|-------|-------|--------|
| 90-100 | A | Green | Advocate program |
| 80-89 | B | Green | Maintain |
| 70-79 | C | Yellow | Monitor closely |
| 60-69 | D | Yellow | Intervention needed |
| 40-59 | F | Red | Immediate action |
| <40 | Critical | Red | Executive escalation |

## Automated Alerts

| Condition | Alert Level | Action |
|-----------|-------------|--------|
| Score drops >10 points | Warning | Review immediately |
| Score drops >20 points | Critical | Same-day outreach |
| Grade changes from Green to Yellow | Warning | Weekly monitoring |
| Grade changes to Red | Critical | Save play initiation |
| Any component = 0 | Critical | Component-specific action |
$$,
'Comprehensive health scoring methodology with component weights, scoring criteria, and grade definitions',
ARRAY['health scoring', 'customer health', 'risk indicators', 'predictive analytics'],
ARRAY['health', 'scoring', 'risk', 'methodology', 'metrics'],
'CSCX Platform'
),

-- 17. Churn Signal Detection
('risk', 'signals', 'Churn Signal Detection Guide',
$$# Churn Signal Detection Guide

## Overview
Early warning signals that indicate potential customer churn and intervention strategies.

## Signal Categories

### Category 1: Usage Signals

| Signal | Risk Level | Detection Method |
|--------|------------|------------------|
| Login frequency down >30% | High | Weekly usage report |
| Feature usage decline | Medium | Feature analytics |
| API calls dropping | Medium | API monitoring |
| No login in 14+ days | High | Activity alerts |
| Power users inactive | Critical | User segmentation |

**Intervention:**
- Proactive outreach within 48 hours
- Usage review call
- Re-engagement campaign
- Training refresh offer

### Category 2: Engagement Signals

| Signal | Risk Level | Detection Method |
|--------|------------|------------------|
| No response to emails (3+) | High | Email tracking |
| Meeting cancellations | Medium | Calendar sync |
| Declined QBR | High | QBR tracking |
| Champion unresponsive | Critical | Contact tracking |
| Removed from Slack/Teams | High | Integration monitoring |

**Intervention:**
- Alternate contact outreach
- Executive sponsor engagement
- On-site visit request
- Value reinforcement email

### Category 3: Support Signals

| Signal | Risk Level | Detection Method |
|--------|------------|------------------|
| Support tickets up >50% | Medium | Ticket analytics |
| P1/Critical tickets | High | Escalation tracking |
| Negative ticket sentiment | High | Sentiment analysis |
| Same issue recurring | Medium | Ticket pattern analysis |
| Frustrated language | High | NLP analysis |

**Intervention:**
- Immediate ticket review
- Root cause analysis
- Executive escalation path
- Dedicated support allocation

### Category 4: Business Signals

| Signal | Risk Level | Detection Method |
|--------|------------|------------------|
| Budget cuts announced | High | News monitoring |
| Layoffs at company | High | LinkedIn/News |
| Key sponsor leaves | Critical | LinkedIn alerts |
| M&A activity | Variable | News monitoring |
| Competitor mentioned | Critical | Call/email tracking |

**Intervention:**
- Rapid stakeholder remapping
- Value demonstration
- Executive business review
- Competitive analysis response

### Category 5: Behavioral Signals

| Signal | Risk Level | Detection Method |
|--------|------------|------------------|
| Contract terms requested | Medium | Support/legal request |
| Data export requested | High | Feature usage |
| Integration disconnected | High | Integration monitoring |
| User deletion requests | High | Admin activity |
| Billing questions | Low | Support tickets |

**Intervention:**
- Same-day manager call
- Retention offer preparation
- Save play initiation
- Executive involvement

## Risk Scoring Matrix

### Signal Weighting
```
Critical signals: 10 points each
High signals: 7 points each
Medium signals: 4 points each
Low signals: 1 point each
```

### Risk Levels
```
0-10 points: Low risk (Green)
11-20 points: Moderate risk (Yellow)
21-30 points: High risk (Orange)
31+ points: Critical risk (Red)
```

## Detection Automation

### Daily Monitoring
- Login activity
- Feature usage
- API health
- Support tickets

### Weekly Monitoring
- Engagement metrics
- Usage trends
- NPS changes
- Stakeholder activity

### Monthly Monitoring
- Business news
- LinkedIn changes
- Contract review
- Competitive intel

## Intervention Timing

| Risk Level | Response Time | Escalation Level |
|------------|---------------|------------------|
| Critical | Same day | VP + Executive |
| High | 24 hours | Manager |
| Moderate | 48 hours | CSM |
| Low | Weekly review | CSM |
$$,
'Comprehensive guide to detecting churn signals across usage, engagement, support, business, and behavioral categories',
ARRAY['churn prediction', 'risk signals', 'early warning', 'customer retention'],
ARRAY['churn', 'signals', 'detection', 'risk', 'warning'],
'CSCX Platform'
),

-- 18. Save Play Templates
('risk', 'saveplay', 'Save Play Templates by Risk Type',
$$# Save Play Templates by Risk Type

## Overview
Structured intervention playbooks for different churn risk scenarios.

## Save Play 1: Usage Decline

### Risk Profile
- Usage down >30% over 30 days
- Key features abandoned
- Power users inactive

### 7-Day Intervention Plan

**Day 1: Discovery**
- [ ] Pull detailed usage analytics
- [ ] Identify specific decline patterns
- [ ] Review recent support tickets
- [ ] Prepare outreach

**Day 2: Outreach**
- [ ] Call champion (don't email first)
- [ ] Questions to ask:
  - "What's changed in your team/process?"
  - "Are there blockers we should know about?"
  - "How can we help re-engage users?"

**Day 3-4: Solution**
- [ ] Develop re-engagement plan
- [ ] Schedule training session
- [ ] Create quick-win roadmap

**Day 5-7: Execution**
- [ ] Conduct training
- [ ] Implement quick wins
- [ ] Monitor daily usage
- [ ] Follow up with champion

### Success Metrics
- Usage returns to baseline within 30 days
- Champion re-engaged
- Root cause documented and addressed

---

## Save Play 2: Champion Left

### Risk Profile
- Primary champion departed
- No identified backup
- Relationship at risk

### 14-Day Intervention Plan

**Day 1-2: Assessment**
- [ ] Confirm departure (LinkedIn, email)
- [ ] Identify interim contacts
- [ ] Map remaining stakeholders
- [ ] Assess sponsorship level

**Day 3-5: Outreach**
- [ ] Contact executive sponsor
- [ ] Reach out to known contacts
- [ ] Email template:
```
Subject: Continuing Your [Product] Success

Hi [Name],

I understand [Champion] has moved on. I wanted to
reach out to ensure continuity for your team.

[Product] remains valuable for [specific use case].
I'd love to schedule a brief call to:
1. Understand your current priorities
2. Identify the best person to partner with
3. Ensure your team's success continues

Would [Day/Time] work for a 15-minute call?

[CSM Name]
```

**Day 6-10: Rebuild**
- [ ] Conduct relationship mapping session
- [ ] Identify new champion candidate
- [ ] Schedule training/enablement
- [ ] Brief new contacts on value delivered

**Day 11-14: Stabilize**
- [ ] Confirm new primary contact
- [ ] Update stakeholder map
- [ ] Schedule ongoing cadence
- [ ] Document transition

### Success Metrics
- New champion identified within 14 days
- No usage decline
- Relationship restored

---

## Save Play 3: Competitive Threat

### Risk Profile
- Competitor mentioned
- RFP/evaluation started
- Pricing comparison requested

### Immediate Response Plan

**Hour 1-4: Assess**
- [ ] Confirm competitive situation
- [ ] Identify competitor(s)
- [ ] Gather competitive intel
- [ ] Alert sales/leadership

**Day 1: Executive Response**
- [ ] Executive sponsor call
- [ ] Questions to ask:
  - "What prompted this evaluation?"
  - "What are you hoping to find?"
  - "What would it take to stay?"
- [ ] Schedule business review

**Day 2-3: Value Defense**
- [ ] Prepare competitive comparison
- [ ] Document switching costs
- [ ] Create value summary
- [ ] Develop retention offer

**Day 4-7: Present**
- [ ] Executive business review
- [ ] Present value + roadmap
- [ ] Address competitive gaps
- [ ] Make retention offer

**Day 8-14: Close**
- [ ] Follow up on concerns
- [ ] Refine offer if needed
- [ ] Get verbal commitment
- [ ] Document outcome

### Success Metrics
- Customer stays
- Competitive threat neutralized
- Feedback incorporated into product

---

## Save Play 4: Support Crisis

### Risk Profile
- Multiple P1 tickets
- Frustrated customer
- Escalation threats

### Crisis Response Plan

**Hour 1-2: Mobilize**
- [ ] Acknowledge all open tickets
- [ ] Assign dedicated support
- [ ] Alert CS leadership
- [ ] Notify product team

**Hour 3-24: Stabilize**
- [ ] War room with support/engineering
- [ ] Hourly customer updates
- [ ] Root cause identification
- [ ] Temporary workarounds

**Day 2-5: Resolve**
- [ ] Implement permanent fix
- [ ] Test with customer
- [ ] Document resolution
- [ ] Conduct post-mortem

**Day 6-14: Recover**
- [ ] Executive apology call
- [ ] Compensation/credit discussion
- [ ] Process improvement plan
- [ ] Regular check-ins

### Success Metrics
- Issues resolved
- Trust restored
- No further escalations
$$,
'Ready-to-use save play templates for common churn risk scenarios including usage decline, champion departure, and competitive threats',
ARRAY['save plays', 'churn prevention', 'intervention', 'customer retention'],
ARRAY['save play', 'intervention', 'churn', 'risk', 'retention'],
'CSCX Platform'
),

-- 19. Escalation Framework
('risk', 'escalation', 'Escalation Framework & Procedures',
$$# Escalation Framework & Procedures

## Overview
Structured approach to escalating customer issues to ensure timely resolution.

## Escalation Levels

### Level 1: CSM-Led
**Trigger:** Standard issues, minor concerns
**Owner:** Customer Success Manager
**Response Time:** 24-48 hours

**Actions:**
- Acknowledge within 4 hours
- Create action plan
- Communicate next steps
- Monitor resolution

### Level 2: Manager Escalation
**Trigger:** Repeated issues, moderate risk
**Owner:** CS Manager
**Response Time:** 12-24 hours

**Criteria:**
- Issue unresolved for 7+ days
- Customer expresses frustration
- Renewal at risk
- Usage decline >20%

**Actions:**
- Manager reviews situation
- Direct customer outreach
- Cross-functional coordination
- Weekly status updates

### Level 3: Director Escalation
**Trigger:** Significant account risk
**Owner:** CS Director
**Response Time:** 4-12 hours

**Criteria:**
- Multiple failed resolution attempts
- Customer threatens cancellation
- ARR >$100K at risk
- Competitive evaluation confirmed

**Actions:**
- Director customer call
- Executive sponsor engagement
- Resource allocation
- Daily monitoring

### Level 4: VP/Executive Escalation
**Trigger:** Critical account situation
**Owner:** VP of Customer Success
**Response Time:** 2-4 hours

**Criteria:**
- Strategic account at risk
- Executive complaint received
- Legal or PR concern
- ARR >$500K at risk

**Actions:**
- Same-day executive response
- C-level engagement
- All-hands support
- Board-level visibility

## Escalation Process

### Step 1: Document
```
Escalation Brief Template:

Customer: [Name]
ARR: [Amount]
Issue Summary: [1-2 sentences]
Business Impact: [Customer's perspective]
Timeline: [How long, key dates]
Actions Taken: [What's been tried]
Root Cause: [Known/suspected]
Ask: [What you need]
```

### Step 2: Notify
**Required Communication:**
- Email to escalation owner
- Slack/Teams alert to channel
- CRM escalation flag

**Information to Include:**
- Customer context
- Issue details
- Recommended next step
- Urgency level

### Step 3: Coordinate
**Stakeholder Involvement:**
| Issue Type | Involve |
|------------|---------|
| Technical | Engineering, Support |
| Product | Product Management |
| Commercial | Sales, Finance |
| Relationship | CS Leadership |
| Legal | Legal, Compliance |

### Step 4: Resolve
**Resolution Checklist:**
- [ ] Customer acknowledged
- [ ] Solution implemented
- [ ] Customer confirmed satisfaction
- [ ] Root cause documented
- [ ] Prevention plan created

### Step 5: Post-Mortem
**Required for Level 3+:**
- What happened?
- Why wasn't it caught earlier?
- What's the fix?
- How do we prevent recurrence?

## SLA Matrix

| Priority | First Response | Update Frequency | Resolution Target |
|----------|----------------|------------------|-------------------|
| P1 Critical | 1 hour | Every 2 hours | 4 hours |
| P2 High | 4 hours | Daily | 24 hours |
| P3 Medium | 24 hours | Every 3 days | 7 days |
| P4 Low | 48 hours | Weekly | 30 days |

## Communication Templates

### Escalation Email to Leadership
```
Subject: [ESCALATION] [Customer] - [Issue Summary]

Priority: [P1/P2/P3/P4]
ARR at Risk: $[Amount]

Summary:
[2-3 sentence overview]

Current Status:
[What's happening now]

Ask:
[Specific request]

Next Steps:
[Planned actions]
```

### Customer Escalation Acknowledgment
```
Hi [Name],

I've escalated your concern to our leadership team.
[Manager/Director/VP Name] will reach out within
[timeframe] to discuss resolution.

In the meantime:
- [Immediate action being taken]
- [Temporary workaround if applicable]

You have my commitment that we will resolve this
to your satisfaction.

[CSM Name]
```
$$,
'Comprehensive escalation framework with levels, processes, SLAs, and communication templates',
ARRAY['escalation', 'issue management', 'customer support', 'crisis response'],
ARRAY['escalation', 'framework', 'levels', 'procedures', 'resolution'],
'CSCX Platform'
),

-- 20. Recovery Playbooks
('risk', 'recovery', 'Customer Recovery Playbooks',
$$# Customer Recovery Playbooks

## Overview
Strategies and tactics for recovering customer relationships after significant issues.

## Recovery Scenario 1: Service Outage

### Immediate Response (Hour 1-4)
- [ ] Acknowledge outage via all channels
- [ ] Provide status page updates every 30 min
- [ ] CSM personal outreach to strategic accounts
- [ ] Executive sponsor notification

### Short-Term (Day 1-3)
- [ ] Conduct post-mortem
- [ ] Prepare customer communication
- [ ] Calculate impact/credits
- [ ] Schedule follow-up calls

### Long-Term (Week 1-4)
- [ ] Share RCA with affected customers
- [ ] Process service credits
- [ ] Implement prevention measures
- [ ] Rebuild confidence campaign

**Recovery Communication Template:**
```
Subject: [Product] Service Disruption - Resolution & Next Steps

Dear [Name],

I want to personally follow up on the service
disruption that occurred on [date].

What Happened:
[Brief, honest explanation]

Impact to You:
[Specific impact acknowledgment]

What We're Doing:
1. [Prevention measure 1]
2. [Prevention measure 2]
3. [Ongoing monitoring]

Your Credit:
[Credit amount/description]

I'd welcome the opportunity to discuss this
further. Are you available for a call this week?

[Executive Name]
```

---

## Recovery Scenario 2: Failed Implementation

### Assessment (Week 1)
- [ ] Document what went wrong
- [ ] Identify customer impact
- [ ] Assess relationship damage
- [ ] Assign recovery owner

### Reset (Week 2-3)
- [ ] Executive apology meeting
- [ ] New implementation plan
- [ ] Dedicated resource assignment
- [ ] Clear success criteria

### Re-Implementation (Week 4-8)
- [ ] Fresh kickoff meeting
- [ ] Intensive support coverage
- [ ] Weekly progress reviews
- [ ] Early wins focus

**Recovery Offer Options:**
- Extended implementation support
- Additional training sessions
- Premium support tier (temporary)
- Service credit
- Reduced renewal pricing

---

## Recovery Scenario 3: Lost Champion Relationship

### Relationship Audit (Week 1)
- [ ] Honest assessment of what went wrong
- [ ] Gather internal feedback
- [ ] Understand champion's perspective
- [ ] Identify repair opportunity

### Outreach Strategy (Week 2)
- [ ] Prepare acknowledgment message
- [ ] Identify appropriate messenger (may need new CSM)
- [ ] Plan value demonstration
- [ ] Schedule bridge meeting

### Rebuild (Week 3-8)
- [ ] Regular value delivery
- [ ] No selling, only helping
- [ ] Small wins accumulation
- [ ] Trust measurement

**Bridge Meeting Framework:**
1. Listen first (let them share concerns)
2. Acknowledge mistakes (be specific)
3. Explain changes (what's different now)
4. Commit to action (concrete next steps)
5. Request opportunity (specific ask)

---

## Recovery Scenario 4: Product Disappointment

### Understanding (Week 1)
- [ ] Deep-dive into disappointment source
- [ ] Separate product vs. expectation issues
- [ ] Identify workarounds
- [ ] Engage product team

### Alignment (Week 2-3)
- [ ] Reset expectations appropriately
- [ ] Share relevant roadmap items
- [ ] Implement available solutions
- [ ] Document feature requests

### Alternative Value (Week 4+)
- [ ] Identify other valuable use cases
- [ ] Expand usage in strong areas
- [ ] Create custom success plan
- [ ] Regular check-ins on satisfaction

---

## Recovery Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Relationship score | Return to baseline | Customer survey |
| Engagement | Pre-incident levels | Meeting attendance |
| Usage | Pre-incident levels | Product analytics |
| NPS | Within 10 points | NPS survey |
| Renewal | Confirmed | Verbal/written |

## Recovery Timeline Expectations

| Severity | Initial Recovery | Full Recovery |
|----------|------------------|---------------|
| Minor | 2 weeks | 1 month |
| Moderate | 1 month | 3 months |
| Major | 3 months | 6 months |
| Critical | 6+ months | 12+ months |

## Key Recovery Principles

1. **Own it:** Take responsibility clearly
2. **Act fast:** Speed matters in recovery
3. **Over-communicate:** More is better
4. **Be human:** Empathy > corporate speak
5. **Follow through:** Do what you promise
6. **Measure progress:** Track recovery metrics
7. **Learn:** Prevent future occurrences
$$,
'Comprehensive recovery playbooks for service outages, failed implementations, lost relationships, and product disappointment',
ARRAY['customer recovery', 'relationship repair', 'service recovery', 'trust building'],
ARRAY['recovery', 'repair', 'relationship', 'restoration', 'playbook'],
'CSCX Platform'
);

-- ============================================
-- STRATEGIC AGENT PLAYBOOKS (5)
-- ============================================

INSERT INTO csm_playbooks (category, subcategory, title, content, summary, use_cases, tags, source)
VALUES
-- 21. QBR Preparation Guide
('strategic', 'qbr', 'QBR Preparation & Execution Guide',
$$# QBR Preparation & Execution Guide

## Overview
A structured approach to planning and delivering impactful Quarterly Business Reviews.

## QBR Timeline

### T-14 Days: Planning
- [ ] Confirm date and attendees
- [ ] Send pre-QBR survey
- [ ] Gather usage analytics
- [ ] Review previous QBR notes

### T-7 Days: Content Creation
- [ ] Build presentation deck
- [ ] Prepare value summary
- [ ] Draft discussion topics
- [ ] Identify expansion opportunities

### T-3 Days: Alignment
- [ ] Internal QBR prep meeting
- [ ] Executive sponsor briefing
- [ ] Finalize materials
- [ ] Send agenda to customer

### T-0: Execution
- [ ] Arrive early (virtual or in-person)
- [ ] Execute agenda
- [ ] Capture action items
- [ ] Set next meeting

### T+1 Day: Follow-Up
- [ ] Send meeting notes
- [ ] Share presentation
- [ ] Confirm action items
- [ ] Update CRM

## QBR Deck Structure

### Slide 1: Title
```
[Customer Logo] | [Your Logo]
Quarterly Business Review
[Quarter/Year]
[Date]
```

### Slide 2: Agenda (2 min)
- Review accomplishments
- Performance metrics
- Roadmap alignment
- Strategic discussion
- Action items

### Slide 3-4: Accomplishments (10 min)
**Business Outcomes:**
- [Outcome 1 + metric]
- [Outcome 2 + metric]
- [Outcome 3 + metric]

**Key Milestones:**
- [Milestone achieved]
- [Initiative completed]
- [Expansion implemented]

### Slide 5-6: Performance Metrics (10 min)
**Usage Dashboard:**
- Active users trend
- Feature adoption
- Key metrics

**Health Summary:**
- Overall health score
- Component breakdown
- Trend analysis

### Slide 7-8: Product Roadmap (10 min)
**Coming This Quarter:**
- [Feature 1] - [Benefit]
- [Feature 2] - [Benefit]

**On the Horizon:**
- [Future capability]
- [Strategic direction]

### Slide 9: Strategic Discussion (15 min)
**Questions to Explore:**
- What are your priorities for next quarter?
- How can we better support your goals?
- Are there additional use cases to explore?
- What feedback do you have for us?

### Slide 10: Action Items (5 min)
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action] | [Name] | [Date] |

### Slide 11: Thank You
Next QBR: [Date]
Contact: [CSM Info]

## QBR Best Practices

### Preparation
- Know the customer's business priorities
- Review all recent interactions
- Prepare talking points for concerns
- Practice the presentation

### Execution
- Start and end on time
- Let customer talk 40%+ of time
- Take visible notes
- Avoid surprises (pre-wire if needed)

### Follow-Up
- Send notes within 24 hours
- Track action items to completion
- Reference QBR in ongoing conversations

## Common QBR Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Too product-focused | Lead with business outcomes |
| One-way presentation | Build in discussion time |
| Wrong attendees | Confirm list in advance |
| No action items | Prepare suggested actions |
| Late materials | Set internal deadlines |
$$,
'Comprehensive guide to planning, creating, and delivering effective Quarterly Business Reviews',
ARRAY['QBR', 'quarterly review', 'executive meetings', 'business review'],
ARRAY['QBR', 'quarterly', 'review', 'presentation', 'executive'],
'CSCX Platform'
),

-- 22. Executive Engagement Playbook
('strategic', 'executive', 'Executive Engagement Playbook',
$$# Executive Engagement Playbook

## Overview
Strategies for building and maintaining executive relationships at strategic accounts.

## Executive Stakeholder Types

### C-Suite (CEO, CFO, COO)
**Focus:** Business transformation, ROI, strategic value
**Communication:** Quarterly, outcome-focused
**Content:** Executive summaries, ROI reports, benchmarks

### VP Level
**Focus:** Departmental goals, efficiency, innovation
**Communication:** Monthly, initiative-focused
**Content:** Progress reports, roadmap alignment, best practices

### Director Level
**Focus:** Team performance, operational excellence
**Communication:** Bi-weekly, tactical
**Content:** Usage reports, training recommendations, optimization

## Engagement Framework

### Phase 1: Identification
- Map org chart
- Identify key executives
- Research backgrounds (LinkedIn)
- Understand priorities

### Phase 2: Introduction
**Warm Introduction (Preferred):**
"[Champion], I'd love to meet [Executive] to ensure we're aligned with their vision. Would you be comfortable making an introduction?"

**Direct Outreach:**
```
Subject: [Company] Partnership Update

Dear [Executive],

As [Company]'s Customer Success partner, I wanted
to share how [Product] is supporting your team's goals:

[Key outcome with metric]

I'd welcome 15 minutes to understand your priorities
and ensure we're maximizing your investment.

[CSM Name]
```

### Phase 3: Value Delivery
**Executive Business Review (EBR):**
- Annual strategic review
- Business outcomes achieved
- Future roadmap alignment
- Strategic recommendations

**Regular Touchpoints:**
- Quarterly health summary email
- Relevant industry insights
- Peer success stories
- Product roadmap updates

### Phase 4: Deepening
**Advisory Board Invitation:**
- Strategic input on product direction
- Peer networking opportunities
- Early access to new features

**Speaking Opportunities:**
- Conference presentations
- Webinar participation
- Case study development

## Executive Communication Tips

### Do's
- Lead with business outcomes, not product features
- Respect their time (be concise)
- Bring insights and recommendations
- Quantify everything possible
- Connect to their stated priorities

### Don'ts
- Don't oversell or pitch constantly
- Don't bring problems without solutions
- Don't assume they know details
- Don't waste time on small talk (unless they initiate)
- Don't surprise them with bad news

## Executive Content Templates

### Quarterly Update Email
```
Subject: Q[X] [Product] Results - [Company]

[Executive Name],

Quick update on Q[X] results:

📈 Key Outcome: [Primary metric]
✅ Milestone: [Achievement]
🔮 Next Quarter: [Focus area]

Full report attached if you'd like details.

Questions? I'm always available.

[CSM Name]
```

### Strategic Recommendation
```
Subject: Strategic Recommendation - [Topic]

[Executive Name],

Based on our work with similar organizations, I recommend
considering [recommendation] for [timeframe].

Why now:
- [Reason 1]
- [Reason 2]
- [Reason 3]

Expected impact: [Outcome]

Happy to discuss in more detail.

[CSM Name]
```

## Measuring Executive Engagement

| Metric | Target |
|--------|--------|
| Exec sponsor identified | 100% of strategic accounts |
| EBR completion rate | >80% annually |
| Executive response rate | >50% |
| Advisory board participation | 10% of strategic accounts |
$$,
'Playbook for building and maintaining executive relationships at strategic customer accounts',
ARRAY['executive engagement', 'C-suite relationships', 'strategic accounts', 'leadership alignment'],
ARRAY['executive', 'engagement', 'C-suite', 'relationship', 'strategic'],
'CSCX Platform'
),

-- 23. Account Planning Framework
('strategic', 'planning', 'Strategic Account Planning Framework',
$$# Strategic Account Planning Framework

## Overview
A structured approach to strategic account planning for high-value customers.

## Account Plan Components

### 1. Account Overview
```
Customer: [Name]
Industry: [Sector]
ARR: $[Amount]
Contract Term: [Start] - [End]
Segment: [Enterprise/Strategic/Mid-Market]
CSM: [Name]
```

### 2. Business Context

**Company Overview:**
- Business model
- Market position
- Key competitors
- Recent news

**Strategic Priorities:**
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]

**Our Alignment:**
| Customer Priority | Our Solution |
|------------------|--------------|
| [Priority] | [How we help] |

### 3. Stakeholder Map

```
            [CEO/President]
                  │
    ┌─────────────┼─────────────┐
    │             │             │
[VP Sales]   [VP Ops]    [VP Product]
    │             │             │
[Dir Sales]  [Dir Ops]   [PM Team]
    ★ Champion
```

**Key Relationships:**
| Name | Title | Relationship | Engagement |
|------|-------|--------------|------------|
| | | Strong/Medium/Weak | High/Medium/Low |

### 4. Product Adoption

**Current State:**
- Products owned: [List]
- Users: [X] of [Y] licensed
- Adoption rate: [%]
- Top features: [List]

**White Space:**
- Products not owned: [List]
- Expansion potential: $[Amount]
- Blockers: [List]

### 5. Health Assessment

**Current Health Score:** [X]/100

| Component | Score | Trend |
|-----------|-------|-------|
| Usage | | ↑/→/↓ |
| Engagement | | |
| Support | | |
| Sentiment | | |

**Risk Factors:**
- [Risk 1]
- [Risk 2]

### 6. Strategic Objectives

**FY[Year] Goals:**

| Objective | Metric | Target | Current |
|-----------|--------|--------|---------|
| Retention | Renewal | Yes | On track |
| Expansion | ARR Growth | +$X | Pipeline $Y |
| Adoption | Active Users | +Z% | Currently W% |
| Advocacy | Reference | 1 case study | In progress |

### 7. Action Plan

**This Quarter:**
| Action | Owner | Due | Status |
|--------|-------|-----|--------|
| QBR | CSM | [Date] | Scheduled |
| Champion meeting | CSM | [Date] | Pending |
| Training session | CS | [Date] | Planned |

**Next Quarter:**
- [Planned initiative 1]
- [Planned initiative 2]

### 8. Competitive Intelligence

**Incumbent/Alternative Solutions:**
- [Competitor 1]: [Relationship]
- [Competitor 2]: [Threat level]

**Competitive Advantages:**
- [Advantage 1]
- [Advantage 2]

**Vulnerabilities:**
- [Vulnerability 1]
- [Mitigation]

## Account Planning Process

### Annual Planning (Q4)
1. Review year performance
2. Assess relationship health
3. Identify expansion opportunities
4. Set next year objectives
5. Create action plan

### Quarterly Review
1. Progress against objectives
2. Update stakeholder map
3. Refresh competitive intel
4. Adjust action plan

### Monthly Check
1. Action item progress
2. Health score review
3. Engagement tracking
4. Risk monitoring

## Account Plan Review Meeting

### Agenda (60 min)
1. Account overview (5 min)
2. Health assessment (10 min)
3. Objective progress (15 min)
4. Risk/opportunity discussion (15 min)
5. Action planning (10 min)
6. Next steps (5 min)

### Attendees
- CSM (owner)
- CS Manager
- Account Executive (if applicable)
- Solutions Architect (if applicable)
$$,
'Comprehensive framework for developing and maintaining strategic account plans',
ARRAY['account planning', 'strategic accounts', 'customer strategy', 'relationship management'],
ARRAY['account', 'planning', 'strategy', 'framework', 'management'],
'CSCX Platform'
),

-- 24. Success Story Template
('strategic', 'advocacy', 'Customer Success Story Template',
$$# Customer Success Story Template

## Overview
Framework for developing compelling customer success stories and case studies.

## Success Story Structure

### 1. Quick Facts (Sidebar)
```
Company: [Name]
Industry: [Sector]
Size: [Employees/Revenue]
Product: [What they use]
Use Case: [Primary use case]

Key Results:
• [Metric 1]: [X]% improvement
• [Metric 2]: [X]% reduction
• [Metric 3]: $[X] saved
```

### 2. Headline
**Formula:** [Company] [achieves/improves/reduces] [metric] with [Product]

**Examples:**
- "Acme Corp Reduces Customer Churn by 45% with [Product]"
- "TechStart Scales Support 10x Without Adding Headcount"
- "Global Retail Saves $2M Annually Through Automation"

### 3. Executive Summary (2-3 sentences)
```
[Company], a [brief description], faced [challenge].
Using [Product], they achieved [primary result] while
also [secondary benefit].
```

### 4. The Challenge
**Questions to answer:**
- What was the business problem?
- What was the impact of not solving it?
- What had they tried before?
- What were they looking for?

**Template:**
```
Before [Product], [Company] struggled with [problem].
This resulted in [negative impact]. "[Quote about the pain],"
said [Name, Title]. They needed a solution that could
[requirements].
```

### 5. The Solution
**Questions to answer:**
- Why did they choose your product?
- How did implementation go?
- What features/capabilities were key?
- How did adoption progress?

**Template:**
```
[Company] selected [Product] because [reason].
Implementation involved [brief process]. Key
capabilities included [features]. "[Quote about
solution]," explained [Name, Title].
```

### 6. The Results
**Questions to answer:**
- What quantitative results were achieved?
- What qualitative improvements occurred?
- What was the business impact?
- What's next for them?

**Template:**
```
Since implementing [Product], [Company] has achieved:

• [Metric 1]: [Result] compared to [baseline]
• [Metric 2]: [Result] enabling [benefit]
• [Metric 3]: [Result] worth $[amount]

"[Quote about results]," said [Name, Title].
```

### 7. Call to Action
```
Ready to achieve similar results? Contact us to learn
how [Product] can help your organization [outcome].

[CTA Button: Request Demo]
```

## Success Story Development Process

### Phase 1: Identification
**Criteria for good candidates:**
- Measurable results (quantifiable)
- Happy champion available
- Recognizable company/industry
- Relevant to target market
- Willing to be public

### Phase 2: Interview

**Interview Questions:**
1. What was happening before [Product]?
2. Why did you start looking for a solution?
3. Why did you choose [Product]?
4. Walk me through implementation.
5. What results have you achieved?
6. What surprised you most?
7. What would you tell others considering [Product]?
8. What's next for you with [Product]?

### Phase 3: Writing
1. Transcribe interview
2. Extract key quotes
3. Verify metrics
4. Draft story
5. Create visuals

### Phase 4: Approval
1. Customer review
2. Legal/PR approval
3. Revisions
4. Final sign-off

### Phase 5: Distribution
- Website case study page
- Sales collateral
- Social media
- Email campaigns
- Event presentations

## Visual Elements

### Required
- Company logo
- Key metrics callouts
- Customer photo/quote
- Product screenshot (optional)

### Optional
- Before/after comparison
- Results chart
- Implementation timeline
- Industry icon

## Success Story Formats

| Format | Length | Use |
|--------|--------|-----|
| One-pager | 1 page | Sales meetings |
| Full case study | 2-4 pages | Website, proposals |
| Video testimonial | 2-3 min | Website, events |
| Slide deck | 5-10 slides | Presentations |
| Blog post | 800-1200 words | Content marketing |
$$,
'Template and process for creating compelling customer success stories and case studies',
ARRAY['success stories', 'case studies', 'customer advocacy', 'testimonials'],
ARRAY['success story', 'case study', 'testimonial', 'advocacy', 'marketing'],
'CSCX Platform'
),

-- 25. Strategic Partnership Guide
('strategic', 'partnership', 'Strategic Partnership Guide',
$$# Strategic Partnership Guide

## Overview
Framework for developing deep, strategic partnerships with key accounts.

## Partnership Levels

### Level 1: Vendor Relationship
**Characteristics:**
- Transactional interactions
- Limited executive access
- Reactive engagement
- Single use case

**Goal:** Move to Level 2

### Level 2: Trusted Advisor
**Characteristics:**
- Proactive recommendations
- Regular executive touchpoints
- Multiple use cases
- Expansion conversations welcome

**Goal:** Move to Level 3

### Level 3: Strategic Partner
**Characteristics:**
- Joint planning sessions
- Product co-development
- Executive relationships at multiple levels
- Long-term roadmap alignment

**Goal:** Maintain and deepen

## Building Strategic Partnerships

### Foundation Elements

**1. Shared Vision**
- Understand their 3-5 year strategy
- Align your roadmap to their goals
- Identify mutual success metrics
- Create joint success plan

**2. Multi-Level Relationships**
| Their Level | Our Level |
|-------------|-----------|
| C-Suite | Executive Sponsor |
| VP | CS Director |
| Director | CSM |
| Manager | Support/PS |

**3. Value Co-Creation**
- Joint innovation initiatives
- Beta program participation
- Product advisory board
- Industry thought leadership

### Partnership Activities

**Quarterly:**
- Executive Business Review
- Roadmap alignment session
- Success metric review
- Relationship health check

**Annually:**
- Strategic planning workshop
- Partnership agreement renewal
- Joint marketing review
- Innovation summit

### Joint Go-to-Market

**Co-Marketing Opportunities:**
- Joint webinars
- Co-authored content
- Conference co-presenting
- Press release quotes

**Co-Selling Opportunities:**
- Reference calls
- Site visits
- Speaking engagements
- Industry awards

## Partnership Success Metrics

| Metric | Target |
|--------|--------|
| Relationship score | >90% |
| Executive engagement | Quarterly |
| Product feedback influence | 3+ features/year |
| Reference participation | 5+ activities/year |
| Renewal confidence | 95%+ |
| Expansion rate | >15% annually |

## Partnership Risk Management

### Warning Signs
- Executive sponsor departure
- Strategy shift away from your solution
- Reduced engagement frequency
- Competitor discussions
- Budget constraints

### Mitigation Strategies
- Multi-thread relationships
- Document value continuously
- Anticipate needs
- Maintain competitive awareness
- Build personal relationships

## Partnership Agreement Framework

### Elements to Include
1. **Shared Objectives**
   - Joint goals for the partnership
   - Success metrics
   - Review cadence

2. **Engagement Model**
   - Meeting frequency
   - Attendee expectations
   - Communication channels

3. **Investment Commitment**
   - Your resources allocated
   - Their participation expected
   - Joint funding (if applicable)

4. **Growth Roadmap**
   - Expansion milestones
   - Use case development
   - Timeline

### Sample Partnership Proposal
```
Partnership Proposal: [Customer] + [Your Company]

Objective:
Establish a strategic partnership focused on [goal].

Commitments:
We will provide:
- Dedicated executive sponsor
- Quarterly strategy sessions
- Priority product influence
- Joint marketing investment

We request:
- Executive access quarterly
- Product feedback participation
- Reference availability
- Expansion commitment of $[X] over [Y] years

Success Metrics:
- [Metric 1]
- [Metric 2]
- [Metric 3]

Next Steps:
1. [Action]
2. [Action]
3. [Action]
```
$$,
'Framework for developing and managing strategic customer partnerships beyond standard vendor relationships',
ARRAY['strategic partnership', 'customer relationship', 'executive alignment', 'account development'],
ARRAY['partnership', 'strategic', 'relationship', 'executive', 'development'],
'CSCX Platform'
);

-- Create indexes for new playbooks
CREATE INDEX IF NOT EXISTS idx_csm_playbooks_category_subcategory
ON csm_playbooks(category, subcategory);
