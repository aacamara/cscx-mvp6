# PRD-253: Peer Review Workflow

## Metadata
- **PRD ID**: PRD-253
- **Title**: Peer Review Workflow
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-241 (@Mention), PRD-248 (Collaborative Notes)

---

## Problem Statement

Before sending important customer communications (renewal proposals, escalation responses, executive emails) or executing high-stakes actions, CSMs want peer feedback to catch errors and improve quality. Currently, this requires informal Slack messages or email threads with no structured process or tracking.

## User Story

> As a CSM, I want to request peer reviews on important communications and actions before sending, track feedback, and demonstrate approval for compliance purposes so that I can improve quality and reduce risk.

---

## Functional Requirements

### FR-1: Review Request Creation
- **FR-1.1**: Request review from any outgoing communication draft
- **FR-1.2**: Select review type (Quality, Accuracy, Compliance, Coaching)
- **FR-1.3**: Choose reviewer(s) or let system suggest
- **FR-1.4**: Set urgency/turnaround time needed
- **FR-1.5**: Add specific areas to focus on

### FR-2: Reviewer Experience
- **FR-2.1**: Review queue with pending requests
- **FR-2.2**: Side-by-side view of content and customer context
- **FR-2.3**: Inline commenting on specific sections
- **FR-2.4**: Overall feedback and rating
- **FR-2.5**: Approve/Request Changes/Reject actions

### FR-3: Feedback Management
- **FR-3.1**: Author receives notification on feedback
- **FR-3.2**: View all comments in context
- **FR-3.3**: Resolve comments as addressed
- **FR-3.4**: Request re-review after changes
- **FR-3.5**: Feedback history on content

### FR-4: Approval Tracking
- **FR-4.1**: Track review status (Pending, Approved, Changes Requested)
- **FR-4.2**: Require approval before sending (optional policy)
- **FR-4.3**: Audit log of all reviews and decisions
- **FR-4.4**: Multi-reviewer consensus options
- **FR-4.5**: Time-bound auto-approval if no response

### FR-5: Analytics & Improvement
- **FR-5.1**: Review turnaround time metrics
- **FR-5.2**: Common feedback themes
- **FR-5.3**: Reviewer workload distribution
- **FR-5.4**: Quality improvement trends
- **FR-5.5**: Peer review leaderboard

---

## Non-Functional Requirements

### NFR-1: Performance
- Review queue loads < 1 second
- Comment saving < 500ms

### NFR-2: Compliance
- Full audit trail for regulated industries
- Immutable review history

### NFR-3: Usability
- Minimal friction for quick reviews

---

## Technical Approach

### Data Model Extensions

```sql
-- review_requests table
CREATE TABLE review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID REFERENCES users(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),

  -- Content being reviewed
  content_type VARCHAR(50) NOT NULL, -- 'email_draft', 'proposal', 'document', 'action'
  content_id UUID, -- Link to specific content
  content_snapshot TEXT, -- Snapshot of content at review time
  content_metadata JSONB,

  -- Request details
  review_type VARCHAR(50), -- 'quality', 'accuracy', 'compliance', 'coaching'
  focus_areas TEXT,
  urgency VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  due_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_review', 'approved', 'changes_requested', 'rejected', 'expired'
  requires_approval BOOLEAN DEFAULT false,
  auto_approve_at TIMESTAMPTZ, -- If no response by this time, auto-approve

  -- Consensus settings
  required_approvals INTEGER DEFAULT 1,
  approval_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- review_assignments table
CREATE TABLE review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES review_requests(id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'declined'
  decision VARCHAR(50), -- 'approved', 'changes_requested', 'rejected'
  overall_feedback TEXT,
  rating INTEGER, -- 1-5 quality rating
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- review_comments table
CREATE TABLE review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES review_assignments(id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES users(id),

  -- Comment location
  comment_type VARCHAR(50) DEFAULT 'inline', -- 'inline', 'general'
  selection_start INTEGER, -- Character position
  selection_end INTEGER,
  selection_text TEXT,

  -- Comment content
  comment TEXT NOT NULL,
  suggestion TEXT, -- Suggested replacement text
  severity VARCHAR(20) DEFAULT 'suggestion', -- 'critical', 'important', 'suggestion'

  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolved_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- review_audit_log
CREATE TABLE review_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES review_requests(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50), -- 'requested', 'assigned', 'commented', 'approved', 'rejected', 'sent'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_requests_author ON review_requests(requested_by_user_id);
CREATE INDEX idx_review_requests_status ON review_requests(status);
CREATE INDEX idx_review_assignments_reviewer ON review_assignments(reviewer_user_id, status);
CREATE INDEX idx_review_comments_assignment ON review_comments(assignment_id);
```

### Reviewer Suggestion Algorithm

```typescript
async function suggestReviewers(request: ReviewRequest): Promise<User[]> {
  const author = await getUser(request.requested_by_user_id);
  const customer = await getCustomer(request.customer_id);

  const candidates: { user: User; score: number }[] = [];

  // Team members
  const teamMembers = await getTeamMembers(author.team_id);

  for (const member of teamMembers) {
    if (member.id === author.id) continue;

    let score = 0;

    // Prefer experienced reviewers
    score += (await getReviewCount(member.id)) * 0.1;

    // Prefer those with customer/industry experience
    if (await hasCustomerExperience(member.id, customer.industry)) {
      score += 20;
    }

    // Consider current workload
    const pendingReviews = await getPendingReviewCount(member.id);
    score -= pendingReviews * 5;

    // Prefer those who've reviewed this author before (continuity)
    if (await hasPriorReviewRelationship(member.id, author.id)) {
      score += 10;
    }

    candidates.push({ user: member, score });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(c => c.user);
}
```

### API Endpoints

```typescript
// Review requests
POST   /api/review-requests
GET    /api/review-requests
GET    /api/review-requests/:id
PATCH  /api/review-requests/:id

// Assignments
POST   /api/review-requests/:id/assign
GET    /api/review-requests/:id/assignments
PATCH  /api/review-assignments/:id

// Comments
POST   /api/review-assignments/:id/comments
GET    /api/review-assignments/:id/comments
PATCH  /api/review-comments/:id
POST   /api/review-comments/:id/resolve

// Decisions
POST   /api/review-assignments/:id/approve
POST   /api/review-assignments/:id/request-changes
POST   /api/review-assignments/:id/reject
POST   /api/review-assignments/:id/decline

// My queue
GET    /api/reviews/queue
GET    /api/reviews/my-requests

// Analytics
GET    /api/reviews/analytics
GET    /api/reviews/analytics/turnaround
GET    /api/reviews/analytics/themes
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Review adoption rate | 50% of critical comms | Request tracking |
| Average turnaround time | < 2 hours | Timestamp analysis |
| Error catch rate | Track issues found | Comment analysis |
| Quality improvement | Positive trend | Rating history |

---

## Acceptance Criteria

- [ ] User can request review from email draft or document
- [ ] System suggests appropriate reviewers
- [ ] Reviewer sees content with customer context
- [ ] Reviewer can add inline comments on specific text
- [ ] Reviewer can approve or request changes
- [ ] Author receives notification on feedback
- [ ] Comments can be resolved as addressed
- [ ] Approval required before sending (when configured)
- [ ] Full audit trail of review process
- [ ] Analytics show review metrics

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Reviewer suggestion | 1 day |
| API endpoints | 2 days |
| Request creation UI | 2 days |
| Review interface | 4 days |
| Comment system | 2 days |
| Approval workflow | 2 days |
| Analytics | 1 day |
| Testing | 2 days |
| **Total** | **18 days** |

---

## Notes

- Consider integration with email approval flow (PRD-029)
- Add review templates for common content types
- Future: AI-assisted pre-review suggestions
- Future: Calibration reviews for training
- Future: Review quality ratings for reviewers
