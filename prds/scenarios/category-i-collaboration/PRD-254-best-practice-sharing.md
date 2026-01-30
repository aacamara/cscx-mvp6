# PRD-254: Best Practice Sharing

## Metadata
- **PRD ID**: PRD-254
- **Title**: Best Practice Sharing
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-259 (Knowledge Capture), Knowledge base

---

## Problem Statement

CSMs frequently solve similar challenges but don't have an easy way to share what worked. Best practices are trapped in individual experiences, Slack threads, or tribal knowledge. New team members have no way to learn from collective team experience, leading to repeated mistakes and inconsistent customer experiences.

## User Story

> As a CSM, I want to easily share successful strategies and learn from my peers' experiences so that the whole team can benefit from collective knowledge and continuously improve.

---

## Functional Requirements

### FR-1: Best Practice Creation
- **FR-1.1**: Create best practice from successful outcome
- **FR-1.2**: Template-guided structure (Problem, Solution, Result)
- **FR-1.3**: Tag with categories (onboarding, renewal, expansion, risk, etc.)
- **FR-1.4**: Link to relevant customer(s) as proof points
- **FR-1.5**: Attach supporting materials (emails, decks, docs)

### FR-2: Content Structure
- **FR-2.1**: Problem statement / When to use
- **FR-2.2**: Step-by-step solution approach
- **FR-2.3**: Expected outcomes / Success metrics
- **FR-2.4**: Variations for different scenarios
- **FR-2.5**: Pitfalls to avoid

### FR-3: Discovery & Search
- **FR-3.1**: Browse by category/tag
- **FR-3.2**: Full-text search
- **FR-3.3**: Filter by author, date, rating
- **FR-3.4**: "Similar to current situation" recommendations
- **FR-3.5**: Most popular/highest rated view

### FR-4: Engagement
- **FR-4.1**: Upvote/downvote best practices
- **FR-4.2**: Comment with questions or additions
- **FR-4.3**: Share best practice with colleagues
- **FR-4.4**: Save to personal collection
- **FR-4.5**: Report as outdated or incorrect

### FR-5: Curation & Quality
- **FR-5.1**: Manager/admin review before publishing
- **FR-5.2**: Version history as practices evolve
- **FR-5.3**: Archive outdated practices
- **FR-5.4**: Featured/recommended practices
- **FR-5.5**: Contributor recognition

---

## Non-Functional Requirements

### NFR-1: Performance
- Search results < 1 second

### NFR-2: Discoverability
- Content surfaces at relevant moments in workflow

### NFR-3: Quality
- Curation process maintains high-quality content

---

## Technical Approach

### Data Model Extensions

```sql
-- best_practices table
CREATE TABLE best_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Content
  title VARCHAR(500) NOT NULL,
  problem_statement TEXT NOT NULL,
  solution TEXT NOT NULL,
  expected_outcomes TEXT,
  variations TEXT,
  pitfalls TEXT,

  -- Classification
  category VARCHAR(100), -- 'onboarding', 'renewal', 'expansion', 'risk', 'communication'
  tags TEXT[] DEFAULT '{}',
  customer_segment VARCHAR(50), -- Applicable segment
  applicable_industries TEXT[] DEFAULT '{}',

  -- Proof points
  linked_customer_ids UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending_review', 'published', 'archived'
  published_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0, -- Track when marked as "used"

  -- Featured
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMPTZ,

  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES best_practices(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- best_practice_votes
CREATE TABLE best_practice_votes (
  user_id UUID REFERENCES users(id),
  best_practice_id UUID REFERENCES best_practices(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL, -- 1 or -1
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, best_practice_id)
);

-- best_practice_comments
CREATE TABLE best_practice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  best_practice_id UUID REFERENCES best_practices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  parent_comment_id UUID REFERENCES best_practice_comments(id),
  content TEXT NOT NULL,
  is_question BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- best_practice_saves (personal collections)
CREATE TABLE best_practice_saves (
  user_id UUID REFERENCES users(id),
  best_practice_id UUID REFERENCES best_practices(id) ON DELETE CASCADE,
  collection VARCHAR(100) DEFAULT 'default',
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, best_practice_id)
);

-- best_practice_usage (track when someone uses it)
CREATE TABLE best_practice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  best_practice_id UUID REFERENCES best_practices(id),
  user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  outcome VARCHAR(50), -- 'helpful', 'somewhat_helpful', 'not_helpful'
  notes TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX idx_best_practices_search ON best_practices
  USING GIN(to_tsvector('english', title || ' ' || problem_statement || ' ' || solution));
CREATE INDEX idx_best_practices_tags ON best_practices USING GIN(tags);
CREATE INDEX idx_best_practices_category ON best_practices(category, status);
```

### Recommendation Algorithm

```typescript
interface BestPracticeRecommendation {
  best_practice_id: string;
  relevance_score: number;
  match_reasons: string[];
}

async function recommendBestPractices(
  context: {
    customerId?: string;
    situation?: string; // 'onboarding', 'at_risk', 'expansion', etc.
    industry?: string;
    keywords?: string[];
  }
): Promise<BestPracticeRecommendation[]> {
  const customer = context.customerId ? await getCustomer(context.customerId) : null;

  // Build query based on context
  const candidates = await db.query(`
    SELECT bp.*, ts_rank(
      to_tsvector('english', title || ' ' || problem_statement || ' ' || solution),
      plainto_tsquery('english', $1)
    ) as text_rank
    FROM best_practices bp
    WHERE bp.status = 'published'
      AND ($2::text IS NULL OR bp.category = $2)
      AND ($3::text[] IS NULL OR bp.applicable_industries && $3)
    ORDER BY
      CASE WHEN bp.is_featured THEN 1 ELSE 0 END DESC,
      bp.upvote_count - bp.downvote_count DESC,
      bp.use_count DESC
    LIMIT 20
  `, [
    context.keywords?.join(' ') || '',
    context.situation,
    customer?.industry ? [customer.industry] : null
  ]);

  // Score and rank
  return candidates.map(bp => ({
    best_practice_id: bp.id,
    relevance_score: calculateRelevance(bp, context, customer),
    match_reasons: getMatchReasons(bp, context, customer)
  })).sort((a, b) => b.relevance_score - a.relevance_score);
}
```

### API Endpoints

```typescript
// Best practice CRUD
POST   /api/best-practices
GET    /api/best-practices
GET    /api/best-practices/:id
PATCH  /api/best-practices/:id
DELETE /api/best-practices/:id

// Publishing workflow
POST   /api/best-practices/:id/submit
POST   /api/best-practices/:id/approve
POST   /api/best-practices/:id/reject
POST   /api/best-practices/:id/archive

// Engagement
POST   /api/best-practices/:id/vote
POST   /api/best-practices/:id/save
DELETE /api/best-practices/:id/save
POST   /api/best-practices/:id/use

// Comments
GET    /api/best-practices/:id/comments
POST   /api/best-practices/:id/comments
PATCH  /api/best-practice-comments/:id

// Discovery
GET    /api/best-practices/search?q={query}
GET    /api/best-practices/recommended
GET    /api/best-practices/featured
GET    /api/best-practices/popular

// Personal
GET    /api/best-practices/my
GET    /api/best-practices/saved
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Best practices created | 5+ per CSM per quarter | Creation tracking |
| Usage rate | 60% of CSMs use monthly | Usage tracking |
| Helpfulness rating | 80%+ rated helpful | Outcome tracking |
| Time to first value | New CSMs use within first week | Onboarding metrics |

---

## Acceptance Criteria

- [ ] User can create best practice with structured template
- [ ] Practices can be tagged and categorized
- [ ] Review workflow before publishing
- [ ] Full-text search across all practices
- [ ] Filter by category, rating, author
- [ ] Users can upvote/downvote
- [ ] Users can comment with questions
- [ ] Users can save to personal collection
- [ ] Recommendations appear in relevant context
- [ ] Contributor recognition displayed

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| CRUD & publishing workflow | 2 days |
| Search & filtering | 2 days |
| Engagement features | 2 days |
| Recommendation engine | 2 days |
| Best practice UI | 4 days |
| Personal collections | 1 day |
| Testing | 2 days |
| **Total** | **17 days** |

---

## Notes

- Consider gamification for contributors
- Add weekly digest of new best practices
- Future: AI-generated best practices from successful outcomes
- Future: Integration with onboarding curriculum
- Future: Best practice templates with fill-in-the-blanks
