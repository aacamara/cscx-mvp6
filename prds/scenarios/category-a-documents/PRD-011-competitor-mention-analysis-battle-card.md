# PRD-011: Competitor Mention Analysis → Battle Card

## Metadata
- **PRD ID**: PRD-011
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: Meeting analysis, AI competitive intelligence

## Scenario Description
A CSM uploads data containing competitor mentions (from meeting transcripts, support tickets, sales notes, or survey responses) and the system analyzes competitive threats, generates battle cards with positioning strategies, and creates talk tracks for specific competitive situations.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload customer communications and have competitor mentions analyzed,
**So that** I can understand competitive threats and have ready responses during customer conversations.

## Trigger
CSM uploads data with competitor mentions or requests "Analyze competitor mentions from this data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Competitor mentions in meetings | `meeting_analyses.competitor_mentions` | Implemented | Detects mentions |
| Competitive intelligence | Researcher agent | Partial | Can research companies |
| Knowledge base | `knowledge_base` table | Implemented | Could store battle cards |
| Playbook storage | `csm_playbooks` | Implemented | Could include competitive plays |

### What's Missing
- [ ] Competitor mention aggregation across sources
- [ ] Competitive threat scoring
- [ ] Dynamic battle card generation
- [ ] Talk track creation
- [ ] Win/loss tracking by competitor
- [ ] Competitive positioning recommendations

## Detailed Workflow

### Step 1: Data Upload
**User Action**: CSM uploads data with competitor mentions
**System Response**:
- Parses data (transcripts, tickets, notes, surveys)
- Identifies competitor mentions using NLP
- Tags mentions by context (pricing, features, migration, etc.)
- Reports: "Found 67 competitor mentions across 45 customers"

### Step 2: Competitive Analysis
**User Action**: CSM initiates analysis
**System Response**:
- Aggregates mentions by competitor
- Categorizes by threat type
- Identifies trends over time
- Calculates competitive risk score per customer

### Step 3: Battle Card Generation
**User Action**: CSM requests battle cards
**System Response**:
- Generates battle card per competitor
- Includes strengths, weaknesses, differentiators
- Provides talk tracks for common objections
- Lists customers at risk from each competitor

### Step 4: Action Recommendations
**User Action**: CSM reviews competitive intel
**System Response**:
- Suggests proactive outreach for at-risk accounts
- Recommends positioning strategies
- Creates competitive response tasks
- Updates customer records with competitive context

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/competitive/mentionExtractor.ts` | Extract competitor mentions |
| `server/src/services/competitive/battleCardGenerator.ts` | Generate battle cards |
| `server/src/services/competitive/talkTrackBuilder.ts` | Create talk tracks |
| `components/Competitive/BattleCard.tsx` | Battle card display |
| `components/Competitive/CompetitorDashboard.tsx` | Competitive overview |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/competitive/upload` | POST | Upload data for analysis |
| `POST /api/competitive/analyze` | POST | Run competitive analysis |
| `GET /api/competitive/battle-cards` | GET | Retrieve battle cards |
| `GET /api/competitive/at-risk` | GET | List customers at competitive risk |

### Battle Card Structure
| Section | Content |
|---------|---------|
| Competitor Overview | Company profile, market position |
| Head-to-Head | Feature comparison matrix |
| Their Strengths | What they do well |
| Their Weaknesses | Where we beat them |
| Our Differentiators | Unique value propositions |
| Common Objections | Objection handling scripts |
| Talk Tracks | Positioning statements |
| Win Stories | Customer success examples |
| At-Risk Accounts | Customers mentioning competitor |

## Chat UI Flow
```
CSM: [Uploads q4_meeting_transcripts.zip] Analyze competitor mentions from these transcripts

System: 📊 Analyzing meeting transcripts...

Processed: 89 meeting transcripts
Date range: October - December 2025
Customers: 67

Scanning for competitor mentions...

---

**🎯 Competitor Analysis Complete**

**Competitors Mentioned (by frequency)**

| Competitor | Mentions | Customers | Threat Level | Trend |
|------------|----------|-----------|--------------|-------|
| CompetitorA | 34 | 23 | 🔴 High | ⬆️ +45% |
| CompetitorB | 21 | 15 | 🟡 Medium | ➡️ Stable |
| CompetitorC | 12 | 9 | 🟢 Low | ⬇️ -20% |

---

**📋 Mention Context Analysis**

**CompetitorA Mentions:**
- Pricing comparison: 14 (41%)
- Feature comparison: 11 (32%)
- Migration consideration: 6 (18%)
- General awareness: 3 (9%)

**Key Themes:**
> "CompetitorA is 20% cheaper" - 8 mentions
> "CompetitorA has better mobile app" - 6 mentions
> "CompetitorA was mentioned by our CEO" - 4 mentions

---

**⚠️ At-Risk Accounts (Active Competitor Evaluation)**

| Customer | ARR | Competitor | Risk Signals |
|----------|-----|------------|--------------|
| **TechStart** | $125K | CompetitorA | Pricing RFP, exec meeting |
| **DataFlow** | $89K | CompetitorA | Demo scheduled |
| **CloudMax** | $156K | CompetitorB | Feature comparison request |

---

Would you like me to:
[Generate Battle Cards] [Create At-Risk Outreach] [Deep Dive on CompetitorA] [Export Analysis]

CSM: Generate battle card for CompetitorA

System: 🎯 Generating Battle Card: CompetitorA

---

# Battle Card: CompetitorA

## Company Overview
- **Founded:** 2019
- **Funding:** $45M Series B
- **Customers:** ~500
- **Focus:** SMB market, price-sensitive buyers

## Head-to-Head Comparison

| Capability | Us | CompetitorA | Advantage |
|------------|----|-----------| ----------|
| Enterprise Features | ✅ Full | ⚠️ Limited | **Us** |
| Mobile App | ⚠️ Basic | ✅ Strong | **Them** |
| API/Integrations | ✅ 50+ | ⚠️ 15 | **Us** |
| Pricing | $$$  | $$ | **Them** |
| Support SLA | 4hr | 24hr | **Us** |
| Analytics | ✅ Advanced | ⚠️ Basic | **Us** |

## Their Strengths
- ✓ Lower price point (20-30% cheaper)
- ✓ Superior mobile experience
- ✓ Faster initial deployment

## Their Weaknesses
- ✗ Limited enterprise features
- ✗ Fewer integrations
- ✗ Slower support response
- ✗ Basic reporting/analytics
- ✗ No dedicated CSM model

## Our Differentiators
1. **Enterprise-grade security** - SOC2, HIPAA, GDPR
2. **Advanced analytics** - AI-powered insights they don't have
3. **Dedicated CSM** - Proactive success vs reactive support
4. **Integration ecosystem** - 50+ integrations vs 15

---

## 🗣️ Talk Tracks

### On Pricing:
> "While CompetitorA may have a lower sticker price, let's look at total cost of ownership. Our customers report 40% faster time-to-value and 60% fewer support tickets. When you factor in the productivity gains and our proactive CSM support, the ROI typically exceeds the price difference within 6 months."

### On Mobile:
> "You're right that their mobile app is more feature-rich today. However, we're launching our enhanced mobile experience in Q2. In the meantime, our responsive web app works on all devices, and our integration depth means your team can access data from anywhere through tools they already use."

### On Evaluation:
> "I appreciate you considering all options. Many customers who evaluated both chose us for our enterprise capabilities and dedicated support model. Can I connect you with [Reference Customer] who went through a similar evaluation?"

---

## 📊 Your At-Risk Accounts

| Customer | ARR | Status | Recommended Action |
|----------|-----|--------|-------------------|
| TechStart | $125K | Active eval | Exec sponsor call, custom ROI |
| DataFlow | $89K | Demo scheduled | Counter-demo, reference call |

---

[Download PDF] [Share with Team] [Create Tasks for At-Risk Accounts]

CSM: Create tasks for at-risk accounts

System: ✅ Tasks Created!

📋 **TechStart - Competitive Defense**
- [ ] Schedule executive sponsor call by Feb 3
- [ ] Prepare custom ROI analysis vs CompetitorA
- [ ] Identify reference customer for peer call
- [ ] Review renewal terms for defensive positioning
- Due: Feb 7 (before their decision date)

📋 **DataFlow - Counter-Demo**
- [ ] Schedule our demo before their CompetitorA demo
- [ ] Prepare competitive comparison slide
- [ ] Arrange reference call with similar customer
- [ ] Check on pending feature requests
- Due: Feb 5

Battle card saved to knowledge base for future reference.
```

## Acceptance Criteria
- [ ] Accurately identifies competitor names from unstructured text
- [ ] Categorizes mentions by context (pricing, features, migration)
- [ ] Aggregates mentions across multiple data sources
- [ ] Battle cards include actionable talk tracks
- [ ] At-risk accounts identified with specific competitive context
- [ ] Win/loss tracking connects to competitor mentions
- [ ] Battle cards can be saved and shared with team
- [ ] Talk tracks are customized based on actual customer objections
- [ ] Processing handles 100+ documents in under 3 minutes
- [ ] Supports ongoing updates as new mentions are detected

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-011-COMPLETE</promise>
```

### Success Metrics
- Competitive win rate improvement > 10%
- At-risk accounts receiving intervention > 90%
- CSM confidence in competitive situations (survey) > 4/5
