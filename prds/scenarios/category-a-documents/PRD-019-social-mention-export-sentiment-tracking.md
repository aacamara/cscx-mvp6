# PRD-019: Social Mention Export → Sentiment Tracking

## Metadata
- **PRD ID**: PRD-019
- **Category**: A - Documents & Data Processing
- **Priority**: P3
- **Estimated Complexity**: Medium
- **Dependencies**: Sentiment analysis, alert system

## Scenario Description
A CSM uploads social media mention data (from social listening tools like Sprout Social, Hootsuite, Brandwatch) and the system analyzes sentiment, tracks brand perception over time, identifies customers who are advocates or detractors publicly, and alerts on negative mentions requiring response.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload social mentions and receive sentiment analysis,
**So that** I can identify public advocates and address negative sentiment quickly.

## Trigger
CSM uploads social mention data via Chat UI with a message like "Analyze sentiment from these social mentions."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Sentiment analysis | Meeting analyses | Implemented | Can analyze text |
| Risk signals | `risk_signals` table | Implemented | Can store alerts |
| Competitor mentions | Meeting analysis | Partial | Detects in meetings |
| Social monitoring | Not implemented | Gap | No social integration |

### What's Missing
- [ ] Social mention data upload
- [ ] Social sentiment analysis
- [ ] Public advocate identification
- [ ] Negative mention alerting
- [ ] Sentiment trend tracking
- [ ] Social-to-customer matching
- [ ] Response recommendation

## Detailed Workflow

### Step 1: Mention Upload
**User Action**: CSM uploads social mention export
**System Response**:
- Accepts CSV from social listening tools
- Maps fields: platform, author, content, date, engagement
- Attempts to match authors to customers
- Reports: "Found 234 mentions across Twitter, LinkedIn, G2"

### Step 2: Sentiment Analysis
**User Action**: System processes automatically
**System Response**:
- Analyzes sentiment of each mention
- Categorizes: positive, neutral, negative
- Identifies themes in mentions
- Calculates overall brand sentiment

### Step 3: Customer Matching
**User Action**: CSM reviews matches
**System Response**:
- Links mentions to customer records where possible
- Identifies advocates (positive public mentions)
- Flags detractors (negative public mentions)
- Shows unmatched high-impact mentions

### Step 4: Response & Action
**User Action**: CSM takes action
**System Response**:
- Prioritizes negative mentions for response
- Suggests response strategies
- Creates tasks for follow-up
- Updates customer sentiment records

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/social/mentionParser.ts` | Parse social mention data |
| `server/src/services/social/sentimentAnalyzer.ts` | Analyze mention sentiment |
| `server/src/services/social/customerMatcher.ts` | Match mentions to customers |
| `components/Social/SentimentDashboard.tsx` | Sentiment overview |
| `components/Social/MentionFeed.tsx` | Mention timeline |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/social/mentions/upload` | POST | Upload mention data |
| `GET /api/social/sentiment` | GET | Overall sentiment metrics |
| `GET /api/social/:customerId/mentions` | GET | Customer mentions |
| `POST /api/social/mentions/:id/respond` | POST | Track response |

### Sentiment Metrics
| Metric | Description |
|--------|-------------|
| Overall Sentiment | Aggregate positive/negative ratio |
| Sentiment Trend | Change over time |
| Share of Voice | Volume vs competitors |
| Engagement Rate | Likes, shares, comments |
| Response Rate | % of mentions responded to |

## Chat UI Flow
```
CSM: [Uploads social_mentions_jan2026.csv] Analyze sentiment from these social mentions

System: 📊 Processing social mentions...

Found: 234 mentions
Platforms: Twitter (145), LinkedIn (56), G2 (33)
Date range: January 1-29, 2026

Analyzing sentiment...

---

**📱 Social Sentiment Analysis**

**Overall Sentiment**
```
Positive:  ████████████████░░░░ 78% (182)
Neutral:   ███░░░░░░░░░░░░░░░░░ 14% (33)
Negative:  ██░░░░░░░░░░░░░░░░░░ 8% (19)
```

**Sentiment Score: +70** (Very Positive)
Trend: ⬆️ +12 from December

---

**📈 Platform Breakdown**

| Platform | Total | Positive | Neutral | Negative |
|----------|-------|----------|---------|----------|
| Twitter | 145 | 110 (76%) | 22 (15%) | 13 (9%) |
| LinkedIn | 56 | 48 (86%) | 6 (11%) | 2 (3%) |
| G2 | 33 | 24 (73%) | 5 (15%) | 4 (12%) |

---

**🌟 Top Positive Mentions**

1. **@TechCorpCTO** (Verified, 45K followers)
   > "Just wrapped our Q4 with @YourProduct - best decision we made for customer success. ROI has been incredible. 🚀"
   - Platform: Twitter
   - Engagement: 234 likes, 45 retweets
   - **Matched to: TechCorp (David Park - CTO)**

2. **Sarah Chen** (LinkedIn)
   > "Excited to share that implementing @YourProduct has transformed our customer operations. Highly recommend for any CS team."
   - Engagement: 156 reactions, 23 comments
   - **Matched to: Acme Corp (Sarah Chen - VP Ops)**

3. **G2 Review** (5 stars)
   > "Game changer for our CS team. The AI features save us hours every week."
   - **Matched to: CloudMax (Unknown reviewer)**

---

**⚠️ Negative Mentions (Require Attention)**

| # | Platform | Author | Sentiment | Engagement | Customer |
|---|----------|--------|-----------|------------|----------|
| 1 | Twitter | @frustrated_user | Very Negative | 89 likes | Unknown |
| 2 | G2 | Anonymous | Negative | N/A | OldCorp? |
| 3 | Twitter | @tech_reviewer | Mixed-Negative | 34 likes | Unknown |

**Priority #1: @frustrated_user**

> "Anyone else having issues with @YourProduct? Support has been unresponsive for 2 weeks. Considering switching. 😤"

- Posted: January 28, 2026
- Engagement: 89 likes, 12 replies (growing)
- Sentiment: Very Negative
- Customer Match: **Unknown** - needs identification

**Recommended Response:**
> "Hi [Name], I'm sorry to hear about your support experience. This isn't the level of service we aim to provide. Could you DM us your details? I'd like to personally ensure your issue gets resolved today."

---

**🔴 Priority #2: G2 Review (1 star)**

> "Started strong but quality has declined. Support response times have doubled. We're evaluating alternatives."

- Posted: January 25, 2026
- Customer Match: **Possible OldCorp** (based on review details)

**Recommended Action:**
- Verify if this is OldCorp
- If confirmed, escalate to account team
- Request opportunity to respond on G2

---

**📊 Themes in Mentions**

| Theme | Count | Sentiment | Notes |
|-------|-------|-----------|-------|
| Customer Support | 45 | Mixed (60% pos) | Polarized opinions |
| Product Features | 78 | Very Positive | AI features praised |
| Ease of Use | 34 | Positive | Onboarding mentioned |
| Pricing | 23 | Neutral | Some value concerns |
| Competition | 12 | Mixed | Comparison mentions |

---

**🎯 Customer Advocate Opportunities**

| Customer | Advocate | Platform | Followers | Opportunity |
|----------|----------|----------|-----------|-------------|
| TechCorp | David Park | Twitter | 45K | Amplify tweet, case study |
| Acme Corp | Sarah Chen | LinkedIn | 12K | Reference, speaking |
| CloudMax | Unknown | G2 | N/A | Identify reviewer |

---

Would you like me to:
[Create Advocacy Tasks] [Draft Response to Negative] [Match Unknown Authors] [Export Report]

CSM: Draft response to the frustrated user and try to match them

System: 📝 Analyzing @frustrated_user for customer match...

**Customer Matching Analysis:**

Checking profile details:
- Bio: "Product Manager at [redacted]"
- Location: Chicago
- Recent tweets mention "CS platform" and "renewal"

Cross-referencing with customer data...

**Possible Match: SmallBiz Inc**
- Location: Chicago ✓
- Recent support tickets: Yes (3 open) ✓
- Contact: No "frustrated_user" handle on file
- Renewal: Coming up in March ✓

**Confidence: 72%**

Would you like me to:
1. Reach out to SmallBiz contacts to confirm?
2. Check support ticket history for correlation?

---

**📧 Draft Public Response:**

**Option A: Empathetic + Action**
> "Hi there, I'm really sorry to hear about your support experience - this isn't what we want for our customers. I'd love to personally look into this. Could you DM us your account details? I'll make sure this gets priority attention today. 🙏"

**Option B: Direct + Escalation**
> "This isn't the experience we want you to have. I've flagged this with our support leadership. Please DM us your details so we can get this resolved immediately."

[Post Response A] [Post Response B] [Edit Response]

---

I've also created:
- ⚠️ Risk signal for potential SmallBiz issue
- 📋 Task to verify customer identity
- 📋 Task to check support ticket status
```

## Acceptance Criteria
- [ ] Supports exports from major social listening tools
- [ ] Sentiment analysis accuracy > 85%
- [ ] Matches mentions to customers using multiple signals
- [ ] Prioritizes negative mentions by engagement/reach
- [ ] Identifies themes across mentions
- [ ] Suggests response strategies for negative mentions
- [ ] Creates advocacy opportunities from positive mentions
- [ ] Tracks sentiment trends over time
- [ ] Integrates with customer health scoring
- [ ] Processing completes within 1 minute for 500 mentions

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-019-COMPLETE</promise>
```

### Success Metrics
- Negative mention response time < 4 hours
- Customer match rate > 50%
- Advocate conversion from positive mentions > 15%
