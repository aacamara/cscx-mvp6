# PRD: Production Launch - Compound Product Gaps

## Overview
This PRD consolidates the missing compound-product methodology elements for the CSCX.AI production launch. It complements the existing engineering PRDs with marketing, analytics, and user experience optimizations.

## Problem Statement
The existing PRDs cover technical implementation comprehensively but lack:
1. Analytics and event tracking for measuring success
2. Launch strategy for design partner outreach
3. Onboarding conversion optimization
4. User feedback collection mechanisms
5. Consistent copywriting and messaging

---

## 1. Analytics & Tracking Plan

### Key Events to Track

#### Activation Funnel
| Event | Description | Success Criteria |
|-------|-------------|------------------|
| `invite_code_entered` | User enters invite code | Track valid vs invalid |
| `invite_code_validated` | Code accepted | 95%+ for valid codes |
| `google_signin_started` | User clicks Google Sign-In | 80%+ of validated codes |
| `google_signin_completed` | OAuth successful | 95%+ of started |
| `welcome_modal_shown` | First-run modal displayed | 100% of new users |
| `welcome_modal_dismissed` | User clicks "Start Exploring" | Track time on modal |
| `first_feature_explored` | User tries any feature | 70%+ in first session |

#### Feature Engagement
| Event | Description | Target |
|-------|-------------|--------|
| `customer_list_viewed` | Views customer list | 90%+ of users |
| `demo_customer_clicked` | Opens demo customer detail | 60%+ of users |
| `csv_template_downloaded` | Downloads import template | 30%+ of users |
| `csv_import_started` | Opens import modal | 25%+ of users |
| `csv_import_completed` | Successfully imports customers | 80%+ of started |
| `contract_upload_started` | Starts contract upload | 40%+ of users |
| `contract_parsed` | AI extracts contract data | 90%+ of uploads |
| `onboarding_started` | Begins AI chat onboarding | 50%+ of users |
| `agent_action_approved` | Approves HITL action | Track approval rate |

#### Session Metrics
| Metric | Target |
|--------|--------|
| Avg. session duration | > 10 minutes |
| Pages per session | > 5 |
| Return visit rate (7 day) | > 40% |
| Feature discovery rate | > 50% of features tried |

### Implementation

```typescript
// services/analytics.ts
interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp: Date;
}

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  // Send to Supabase analytics table
  supabase.from('analytics_events').insert({
    event,
    properties,
    user_id: getCurrentUserId(),
    session_id: getSessionId(),
    timestamp: new Date().toISOString()
  });

  // Optional: Send to external analytics (Mixpanel, Amplitude)
  if (window.mixpanel) {
    window.mixpanel.track(event, properties);
  }
};
```

### Database Migration

```sql
-- Analytics events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_event ON public.analytics_events(event);
CREATE INDEX idx_analytics_user ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_timestamp ON public.analytics_events(timestamp);
```

---

## 2. Launch Strategy

### Phase 1: Soft Launch (Week 1)
**Target:** 5 hand-picked design partners

**Outreach Template:**
```
Subject: You're invited to test CSCX.AI - AI-Powered Customer Success

Hi [Name],

I'm personally inviting you to be one of our first design partners for CSCX.AI.

What you'll get:
- Early access to our AI-powered Customer Success platform
- Direct line to me for feedback
- Influence on product direction

Your invite code: 2362369

Start here: https://app.cscx.ai

What I'd love your feedback on:
1. First impressions of the onboarding flow
2. How intuitive is the AI chat assistant?
3. What's missing for your workflow?

Thanks for being an early partner!
Aziz
```

### Phase 2: Expanded Beta (Weeks 2-4)
**Target:** 20 additional design partners

**Actions:**
- [ ] Create LinkedIn post announcing beta
- [ ] Personal outreach to CS community contacts
- [ ] Set up Calendly for onboarding calls
- [ ] Create feedback form (Typeform/Google Form)

### Phase 3: Public Beta (Month 2)
**Target:** 100+ users

**Actions:**
- [ ] Product Hunt launch
- [ ] CS community posts (Gain Grow Retain, CS Insider)
- [ ] Landing page optimization
- [ ] Referral program for design partners

### Success Criteria by Phase

| Phase | Users | Activation Rate | Feedback Sessions |
|-------|-------|-----------------|-------------------|
| Soft Launch | 5 | 80%+ | 5 calls |
| Expanded Beta | 25 | 70%+ | 10 calls |
| Public Beta | 100 | 60%+ | 25 surveys |

---

## 3. Onboarding Optimization

### First-Run Experience Checklist

#### Welcome Modal Content
```markdown
# Welcome to CSCX.AI!

You're now a Design Partner with full access to explore our AI-powered
Customer Success platform.

## What You Can Try:

**1. Mock Onboarding** (5 min)
Start a simulated customer onboarding to see our AI agents in action.

**2. Import Your Data** (2 min)
Upload a contract or import customers via CSV to test with real data.

**3. Explore Demo Customers** (3 min)
Browse our sample customers to see health scores, AI insights, and more.

[Start Exploring →]
```

### Progressive Disclosure
1. **First visit:** Show welcome modal + highlight "Try Mock Onboarding"
2. **After mock onboarding:** Suggest "Now try with your own data"
3. **After first import:** Celebrate + suggest next features
4. **Return visits:** Show progress "You've explored 4/8 features"

### Activation Milestones

| Milestone | Definition | Reward/Message |
|-----------|------------|----------------|
| Signed Up | Completed OAuth | Welcome email |
| Activated | Tried 1 feature | "Great start!" toast |
| Engaged | Tried 3 features | Progress badge |
| Power User | Imported data + onboarding | "You're a power user!" |

### Email Sequences

#### Day 0: Welcome
```
Subject: Welcome to CSCX.AI - Here's how to get started

Hi [Name],

Welcome aboard! You now have access to CSCX.AI.

Quick start:
1. Try the Mock Onboarding (takes 5 minutes)
2. See AI draft emails, create documents, and book meetings
3. Approve or edit any AI action

→ Start your first onboarding: [link]

Questions? Reply to this email.

Aziz
```

#### Day 2: Check-in (if not activated)
```
Subject: Need help getting started with CSCX.AI?

Hi [Name],

I noticed you haven't tried the mock onboarding yet.

It only takes 5 minutes and shows you exactly how our AI agents work.

→ Try it now: [link]

Or if you'd prefer, book a 15-min walkthrough with me: [calendly]

Aziz
```

#### Day 7: Feedback Request
```
Subject: Quick feedback on CSCX.AI?

Hi [Name],

You've been using CSCX.AI for a week. I'd love your honest feedback.

3 quick questions:
1. What's the most useful feature so far?
2. What's confusing or missing?
3. Would you recommend this to a colleague?

→ Share feedback (2 min): [typeform]

Your input directly shapes what we build next.

Thanks!
Aziz
```

---

## 4. User Feedback Collection

### In-App Feedback

#### Feedback Widget (Bottom Right)
```typescript
// components/FeedbackWidget.tsx
const FeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4">
      <button onClick={() => setIsOpen(true)}>
        💬 Feedback
      </button>
      {isOpen && (
        <FeedbackModal onSubmit={submitFeedback} onClose={() => setIsOpen(false)} />
      )}
    </div>
  );
};
```

#### Contextual Feedback Prompts
- After completing onboarding: "How was this experience?"
- After importing data: "Was the import easy?"
- After 3 sessions: "What's missing for your workflow?"

### Feedback Database

```sql
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'general', 'feature_request', 'bug', 'praise'
  context TEXT, -- Where in app feedback was given
  message TEXT NOT NULL,
  rating INTEGER, -- 1-5 if applicable
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### NPS Survey (Day 14)
```
On a scale of 0-10, how likely are you to recommend CSCX.AI to a colleague?

[0] [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]

What's the main reason for your score?
[text field]
```

---

## 5. Copywriting Guidelines

### Voice & Tone
- **Professional but approachable** - Not corporate speak
- **Action-oriented** - Lead with verbs
- **Confident but not arrogant** - "Here's how" not "The best way"
- **Helpful** - Focus on user benefit

### UI Microcopy Standards

| Element | Good | Avoid |
|---------|------|-------|
| Empty states | "No customers yet. Import your first one →" | "No data found" |
| Errors | "Couldn't parse the contract. Try a clearer PDF." | "Error: Invalid input" |
| Success | "Customer imported!" | "Success" |
| Loading | "Analyzing contract..." | "Loading..." |
| CTAs | "Start Onboarding" | "Submit" |

### Key Messages

**Tagline:** "AI-Powered Customer Success"

**Value Props:**
1. "Automate 80% of CS admin work"
2. "AI agents that draft, don't send"
3. "Human-in-the-loop for every important action"

**Demo Descriptions:**
- Mock Onboarding: "See AI agents create emails, docs, and meetings for a sample customer"
- Contract Upload: "Upload a contract and watch AI extract all the key details"
- CSV Import: "Bring your existing customers to see the platform in action"

---

## 6. Success Metrics Dashboard

### Key Metrics to Display

```
┌─────────────────────────────────────────────────────────────┐
│  CSCX.AI Launch Metrics                    Last 7 days     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Signups          Activated         Imported Data           │
│    12              9 (75%)           4 (33%)                │
│                                                             │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  Avg Session       Features Tried     NPS Score             │
│    14 min            4.2               8.5                  │
│                                                             │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  Top Features Used:                                         │
│  1. Mock Onboarding (9 users)                              │
│  2. Customer List (12 users)                               │
│  3. CSV Import (4 users)                                   │
│  4. Contract Upload (3 users)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Week 1 (Before Launch)
1. [ ] Add analytics tracking to key events
2. [ ] Create welcome modal with proper copy
3. [ ] Set up feedback widget
4. [ ] Prepare launch email templates

### Week 2 (Soft Launch)
1. [ ] Send invites to 5 design partners
2. [ ] Schedule onboarding calls
3. [ ] Monitor activation metrics daily
4. [ ] Collect qualitative feedback

### Week 3-4 (Iterate)
1. [ ] Address top feedback items
2. [ ] Optimize low-conversion steps
3. [ ] Expand to more design partners
4. [ ] Send NPS survey

---

## Dependencies
- Analytics events require database migration
- Email sequences require email service (existing or new)
- Feedback widget requires new component
- Metrics dashboard requires admin view

## Non-Goals
- Full marketing site (separate project)
- Paid advertising (post-beta)
- Referral program (post-validation)
- A/B testing framework (post-launch)
