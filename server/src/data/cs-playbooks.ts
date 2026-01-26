/**
 * Customer Success Playbooks
 * Knowledge base content for RAG-powered agent responses
 */

export interface Playbook {
  title: string;
  category: string;
  content: string;
}

export const CS_PLAYBOOKS: Playbook[] = [
  // ===========================================
  // ONBOARDING PLAYBOOKS
  // ===========================================
  {
    title: "Enterprise Onboarding Best Practices",
    category: "onboarding",
    content: `# Enterprise Customer Onboarding Framework

## Overview
Enterprise onboarding requires a structured 90-day approach with clear milestones and stakeholder engagement.

## Phase 1: Foundation (Days 1-30)
**Goals:** Establish relationships, confirm expectations, technical setup

### Key Activities:
1. **Kickoff Meeting** (Day 1-3)
   - Introduce CSM and support team
   - Review contract terms and entitlements
   - Identify key stakeholders and their roles
   - Set success metrics and timeline

2. **Technical Onboarding** (Days 3-14)
   - Complete SSO/SCIM configuration
   - Set up integrations (Salesforce, Slack, etc.)
   - Conduct data migration if applicable
   - Verify security compliance requirements

3. **Champion Enablement** (Days 7-21)
   - Train internal champions on product
   - Provide admin documentation
   - Set up pilot user group
   - Establish feedback channels

4. **Success Plan Alignment** (Days 21-30)
   - Document agreed success metrics
   - Create 30-60-90 milestone tracker
   - Schedule recurring check-ins
   - Identify early adoption blockers

## Phase 2: Adoption (Days 31-60)
**Goals:** Drive user adoption, measure engagement, resolve issues

### Key Activities:
1. Roll out to broader user base
2. Track feature adoption metrics
3. Conduct user training sessions
4. Address technical issues promptly
5. Gather and act on feedback

## Phase 3: Value Realization (Days 61-90)
**Goals:** Demonstrate ROI, plan for expansion

### Key Activities:
1. Prepare first QBR deck
2. Calculate and share value metrics
3. Identify expansion opportunities
4. Transition to steady-state support
5. Document customer success story

## Red Flags to Watch:
- Executive sponsor disengagement
- Declining login/usage metrics
- Delayed technical milestones
- Lack of internal champion activity
- Unresolved support tickets

## Success Indicators:
- On-time milestone completion
- User adoption > 80% of licensed seats
- NPS > 40 at 90 days
- Active engagement in QBR planning`
  },
  {
    title: "First 30 Days Checklist",
    category: "onboarding",
    content: `# Customer Success First 30 Days Checklist

## Week 1: Discovery & Setup
- [ ] Send welcome email within 24 hours of deal close
- [ ] Schedule kickoff call with all stakeholders
- [ ] Review contract for entitlements and terms
- [ ] Set up customer in CRM with accurate data
- [ ] Create shared success plan document
- [ ] Identify executive sponsor and champion

## Week 2: Technical Foundation
- [ ] Complete technical kickoff with IT team
- [ ] Provide SSO/security documentation
- [ ] Begin integration setup
- [ ] Create admin accounts
- [ ] Share implementation timeline
- [ ] Set up support ticket process

## Week 3: Training & Enablement
- [ ] Conduct admin training session
- [ ] Provide user documentation and videos
- [ ] Set up pilot user group (5-10 users)
- [ ] Create custom training materials if needed
- [ ] Establish office hours schedule
- [ ] Share best practices guide

## Week 4: Validation & Planning
- [ ] Verify all technical setup complete
- [ ] Review pilot user feedback
- [ ] Adjust timeline if needed
- [ ] Document lessons learned
- [ ] Plan Phase 2 rollout
- [ ] Schedule 30-day review call

## Communication Cadence:
- Daily: Monitor support tickets
- Weekly: Check-in email/call with champion
- Bi-weekly: Executive summary to sponsor
- Monthly: Formal review meeting`
  },
  // ===========================================
  // EMAIL TEMPLATES
  // ===========================================
  {
    title: "Welcome Email Template",
    category: "email-templates",
    content: `# Welcome Email Template

**Subject:** Welcome to [Product]! Your Customer Success Team

---

Hi [First Name],

Welcome to [Product]! I'm [CSM Name], your dedicated Customer Success Manager, and I'm excited to partner with you on your journey.

**What happens next:**
1. **Kickoff Call** - I'll reach out to schedule our kickoff meeting this week
2. **Technical Setup** - Our implementation team will guide your technical onboarding
3. **Training** - We'll provide comprehensive training for your team

**Key Resources:**
- Documentation: [link]
- Support Portal: [link]
- Community: [link]

**Your Success Team:**
- Customer Success Manager: [CSM Name]
- Technical Support: support@company.com
- Account Executive: [AE Name]

I'm looking forward to helping [Company Name] achieve [main goal mentioned in sales process].

Best regards,
[CSM Name]

---

**Best Practices:**
- Send within 24 hours of contract signature
- Personalize with specific goals from sales handoff
- Include direct calendar link for scheduling
- Cc the executive sponsor`
  },
  {
    title: "QBR Meeting Request Template",
    category: "email-templates",
    content: `# QBR Meeting Request Template

**Subject:** Quarterly Business Review - [Company Name] + [Product]

---

Hi [Executive Sponsor],

I hope this message finds you well. As we approach the end of Q[X], I'd like to schedule our Quarterly Business Review to discuss [Company Name]'s success with [Product].

**Proposed Agenda:**
1. Review of key metrics and achievements
2. Progress against success plan goals
3. Feature roadmap preview
4. Discussion of expansion opportunities
5. Planning for Q[X+1]

**Suggested Time:** [2-3 specific options]
**Duration:** 60 minutes
**Attendees:** [List key stakeholders]

I've prepared a preliminary success report showing [brief positive metric]. I'm excited to discuss how we can build on this momentum.

Would any of these times work for you? I'm happy to adjust to accommodate your schedule.

Best regards,
[CSM Name]

---

**Tips:**
- Send 3-4 weeks before desired QBR date
- Include preliminary win to build interest
- Offer specific times rather than open-ended
- Follow up within 3 days if no response`
  },
  // ===========================================
  // RISK MANAGEMENT
  // ===========================================
  {
    title: "At-Risk Customer Playbook",
    category: "risk-management",
    content: `# At-Risk Customer Intervention Playbook

## Risk Identification Criteria
A customer is considered at-risk when they exhibit:
- Health score drops below 60
- No login activity in 14+ days
- Open critical support tickets > 7 days
- Executive sponsor departure
- Budget/headcount reduction announced
- Competitor evaluation mentioned
- Contract term ending within 90 days without renewal discussion

## Risk Levels and Response

### Level 1: Early Warning (Score 50-60)
**Timeline:** Respond within 48 hours

**Actions:**
1. Send personalized check-in email
2. Review recent support tickets
3. Analyze usage trends
4. Schedule call with champion
5. Document findings in CRM

### Level 2: Active Risk (Score 35-49)
**Timeline:** Respond within 24 hours

**Actions:**
1. Escalate to CSM Manager
2. Conduct emergency business review
3. Create recovery plan with milestones
4. Engage executive sponsor
5. Involve Product/Engineering if technical issues
6. Weekly check-ins until stabilized

### Level 3: Critical Risk (Score < 35)
**Timeline:** Same-day response required

**Actions:**
1. Immediate escalation to VP CS
2. Executive-to-executive outreach
3. Concession options prepared (if appropriate)
4. Daily monitoring
5. Document all interactions for legal

## Recovery Conversation Framework

**Opening:**
"I wanted to reach out because I noticed [specific observation] and want to make sure we're supporting you effectively."

**Discovery Questions:**
- "What's changed in your organization recently?"
- "How is [Product] being used currently?"
- "What would make this successful for you?"
- "What concerns can I help address?"

**Recovery Offer:**
- Additional training sessions
- Executive business review
- Product roadmap preview
- Success plan realignment
- Temporary service credits (with approval)

## Prevention Best Practices
- Maintain bi-weekly touchpoints
- Monitor usage metrics weekly
- Build relationships beyond one contact
- Document institutional knowledge
- Proactive value reinforcement`
  },
  {
    title: "Churn Prevention Strategies",
    category: "risk-management",
    content: `# Churn Prevention Strategies

## Proactive Retention Tactics

### 1. Multi-Threading
Never rely on a single point of contact.

**Minimum Relationships:**
- Executive Sponsor (VP+)
- Day-to-day Champion
- Technical Contact
- Power Users (2-3)

**How to Multi-Thread:**
- Request introductions to other departments
- Invite multiple stakeholders to QBRs
- Create user community/advisory board
- Offer training to broader team

### 2. Value Documentation
Continuously demonstrate ROI.

**Metrics to Track:**
- Time saved vs. previous solution
- Revenue influenced/generated
- Efficiency improvements
- User satisfaction scores

**Communication:**
- Monthly value summaries
- Quarterly ROI reports
- Annual business reviews
- Success story documentation

### 3. Sticky Integrations
Deeper integrations = harder to leave.

**Priority Integrations:**
- Single Sign-On (SSO)
- CRM/Salesforce
- Communication tools (Slack, Teams)
- Data warehouse connections

### 4. Expansion Strategy
Growing accounts are retained accounts.

**Expansion Triggers:**
- New department interest
- Usage hitting limits
- New use case identified
- Headcount growth
- Budget cycle timing

### 5. Executive Engagement
C-level relationships protect accounts.

**Engagement Tactics:**
- Executive Business Reviews
- Customer Advisory Board
- Executive dinners/events
- Thought leadership invitations

## Warning Signs Hierarchy
1. Champion leaves company
2. Usage decline >20% month-over-month
3. Support tickets go unanswered
4. QBR declined or postponed
5. Competitor mentioned in conversations
6. Budget cuts announced
7. Requests for contract terms/pricing`
  },
  // ===========================================
  // RENEWAL PLAYBOOKS
  // ===========================================
  {
    title: "Renewal Process Guide",
    category: "renewal",
    content: `# Customer Renewal Process Guide

## Timeline Overview

### T-180 Days (6 months out)
- [ ] Generate renewal forecast
- [ ] Review account health score
- [ ] Identify expansion opportunities
- [ ] Schedule executive sponsor check-in
- [ ] Document value delivered to date

### T-120 Days (4 months out)
- [ ] Conduct pre-renewal QBR
- [ ] Present value summary
- [ ] Discuss expansion/contraction signals
- [ ] Identify decision makers for renewal
- [ ] Begin pricing discussions if needed

### T-90 Days (3 months out)
- [ ] Send renewal proposal
- [ ] Schedule renewal discussion meeting
- [ ] Address any concerns or blockers
- [ ] Involve AE for commercial discussions
- [ ] Prepare negotiation parameters

### T-60 Days (2 months out)
- [ ] Follow up on proposal
- [ ] Negotiate terms if needed
- [ ] Obtain verbal commitment
- [ ] Begin contract paperwork
- [ ] Plan post-renewal success strategy

### T-30 Days (1 month out)
- [ ] Finalize contract terms
- [ ] Process signatures
- [ ] Update CRM records
- [ ] Celebrate with customer
- [ ] Plan expansion roadmap

### T-0 (Renewal Date)
- [ ] Confirm contract executed
- [ ] Update all systems
- [ ] Send renewal confirmation
- [ ] Schedule post-renewal kickoff
- [ ] Document lessons learned

## Renewal Conversation Framework

**Opening:**
"As we approach your renewal, I wanted to reflect on the value we've delivered and discuss our continued partnership."

**Value Review:**
- Specific metrics achieved
- Goals accomplished
- Team feedback
- Support responsiveness

**Future Vision:**
- Product roadmap alignment
- Expansion opportunities
- New use cases
- Partnership growth

**Ask:**
"Based on our success together, I'd like to discuss renewing for [term]. What questions do you have?"

## Negotiation Guidelines
- Always know your walk-away point
- Lead with value, not price
- Offer multi-year discounts strategically
- Get executive approval for exceptions
- Document all commitments`
  },
  // ===========================================
  // MEETING GUIDES
  // ===========================================
  {
    title: "Effective QBR Guide",
    category: "meetings",
    content: `# Quarterly Business Review (QBR) Guide

## Purpose
QBRs are strategic alignment meetings that reinforce value, deepen relationships, and identify growth opportunities.

## Preparation (1-2 weeks before)

### Data Gathering:
- Usage metrics and trends
- Support ticket summary
- Feature adoption rates
- NPS/CSAT scores
- ROI calculations

### Stakeholder Prep:
- Confirm attendees and roles
- Brief internal team
- Prepare executive summary
- Create presentation deck
- Develop discussion questions

## Agenda Template (60 minutes)

### 1. Welcome & Objectives (5 min)
- Thank attendees
- State meeting goals
- Confirm agenda

### 2. Partnership Review (15 min)
- Key metrics dashboard
- Successes and wins
- Support summary
- Usage trends

### 3. Customer Feedback (10 min)
- What's working well?
- Areas for improvement?
- Feature requests

### 4. Product Roadmap (10 min)
- Upcoming features
- Alignment with customer needs
- Beta opportunities

### 5. Success Planning (15 min)
- Goals for next quarter
- Action items
- Expansion discussion

### 6. Wrap-up (5 min)
- Summarize commitments
- Next steps
- Schedule follow-up

## Best Practices

**Do:**
- Send agenda 1 week in advance
- Start with customer wins
- Use specific data points
- Ask open-ended questions
- Document action items real-time
- Follow up within 24 hours

**Don't:**
- Make it a product demo
- Dominate the conversation
- Avoid difficult topics
- Promise without alignment
- Skip the executive summary`
  },
  {
    title: "Effective Customer Call Guide",
    category: "meetings",
    content: `# Customer Call Best Practices

## Before the Call

### Preparation Checklist:
- [ ] Review recent support tickets
- [ ] Check usage metrics
- [ ] Note last interaction summary
- [ ] Prepare specific questions
- [ ] Have relevant resources ready
- [ ] Test video/audio

### Information to Have Ready:
- Customer health score
- Contract details and term
- Key stakeholder map
- Recent product updates
- Pending action items

## During the Call

### Opening (2-3 minutes)
"Hi [Name], thanks for making time today. Before we dive in, how are things going on your end?"

*Build rapport before business*

### Active Listening
- Take notes on key points
- Repeat back to confirm understanding
- Ask clarifying questions
- Note emotional cues

### Effective Questions
- "What's your biggest priority this quarter?"
- "How is the team finding [specific feature]?"
- "What would make this more valuable?"
- "Who else should be involved in this conversation?"

### Handling Objections
1. Acknowledge the concern
2. Ask clarifying questions
3. Provide relevant context
4. Offer solutions
5. Confirm resolution

### Closing
- Summarize discussion points
- Confirm action items (who, what, when)
- Schedule next touchpoint
- Thank them for their time

## After the Call

### Within 24 Hours:
- [ ] Send summary email
- [ ] Update CRM notes
- [ ] Create follow-up tasks
- [ ] Share updates with team
- [ ] Complete any promises made

### Follow-up Email Template:
Subject: Summary: [Company] + [Your Company] Call - [Date]

Hi [Name],

Thank you for the productive conversation today! Here's a quick summary:

**Key Discussion Points:**
- [Point 1]
- [Point 2]

**Action Items:**
- [Your Company] will: [Action] by [Date]
- [Customer] will: [Action] by [Date]

**Next Steps:**
- [Scheduled meeting/call]

Please let me know if I missed anything. Looking forward to our continued partnership!

Best,
[Your Name]`
  },
  // ===========================================
  // ADOPTION STRATEGIES
  // ===========================================
  {
    title: "Feature Adoption Framework",
    category: "adoption",
    content: `# Feature Adoption Framework

## Adoption Funnel

### Stage 1: Awareness
Customer knows the feature exists.

**Tactics:**
- Release notes and announcements
- In-app notifications
- Email campaigns
- CSM mentions in calls
- Webinar demonstrations

### Stage 2: Interest
Customer understands the value.

**Tactics:**
- ROI calculators
- Case studies
- Demo sessions
- Use case examples
- Competitive comparisons

### Stage 3: Evaluation
Customer tries the feature.

**Tactics:**
- Guided tutorials
- Sandbox environments
- Pilot programs
- Free trials
- Office hours support

### Stage 4: Adoption
Customer uses regularly.

**Tactics:**
- Personalized training
- Success metrics tracking
- Champion programs
- Best practice sharing
- Certification programs

### Stage 5: Advocacy
Customer promotes internally.

**Tactics:**
- Internal success stories
- Executive presentations
- User group creation
- Reference programs
- Case study participation

## Measuring Adoption

### Key Metrics:
- Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
- Feature utilization rate
- Time to first value
- Depth of use (actions per session)
- User retention (30/60/90 day)

### Adoption Score Calculation:
(Active Users / Licensed Users) × Feature Depth × Frequency

### Benchmarks:
- Excellent: >80% adoption
- Good: 60-80% adoption
- Needs attention: 40-60% adoption
- At risk: <40% adoption

## Driving Adoption

### For Low Adoption:
1. Identify blockers (survey, interviews)
2. Simplify onboarding
3. Provide targeted training
4. Create quick wins
5. Celebrate early adopters

### For Declining Adoption:
1. Understand what changed
2. Re-engage champions
3. Address competitive threats
4. Refresh training
5. Consider product feedback loop`
  },
  // ===========================================
  // EXPANSION & UPSELL
  // ===========================================
  {
    title: "Expansion Playbook",
    category: "expansion",
    content: `# Customer Expansion Playbook

## Expansion Triggers

### Usage-Based Triggers:
- Approaching seat/usage limits
- New team/department usage
- Power user emergence
- Feature ceiling reached

### Business-Based Triggers:
- Funding announcement
- Headcount growth
- New office/region
- M&A activity
- Budget cycle timing

### Relationship Triggers:
- Champion promotion
- New executive hire
- Strong NPS feedback
- Reference participation

## Expansion Conversation Framework

### Discovery:
"I noticed [trigger]. Tell me more about what's driving that."

### Quantify Impact:
"If we could help [department] achieve similar results, what would that mean for [Company]?"

### Propose Solution:
"Based on what you've shared, I think [expansion option] would help you [specific outcome]."

### Handle Objections:
"I understand [concern]. Here's how other customers have addressed that..."

### Close:
"What would need to happen to move forward with this?"

## Expansion Options

### Seat Expansion:
- Additional user licenses
- New department rollout
- International offices

### Product Expansion:
- Additional modules
- Premium features
- Add-on products

### Service Expansion:
- Premium support
- Professional services
- Training packages
- Dedicated resources

## Best Practices

**Do:**
- Lead with value, not sales
- Use customer success metrics
- Involve champions in proposals
- Time with budget cycles
- Document everything

**Don't:**
- Surprise customers with upsells
- Ignore timing signals
- Skip stakeholder mapping
- Promise without delivery plan
- Rush the process`
  }
];

export default CS_PLAYBOOKS;
