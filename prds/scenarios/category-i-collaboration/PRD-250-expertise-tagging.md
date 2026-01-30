# PRD-250: Expertise Tagging

## Metadata
- **PRD ID**: PRD-250
- **Title**: Expertise Tagging
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: User management, PRD-245 (Technical Resource Request)

---

## Problem Statement

When CSMs need help with specific topics (technical integration, industry knowledge, competitive situations), they don't know who on the team has relevant expertise. Finding the right person to ask requires asking around in Slack or guessing based on job titles.

## User Story

> As a CSM, I want to search for team members by expertise area so that I can quickly find the right person to help with customer challenges or learn from their experience.

---

## Functional Requirements

### FR-1: Expertise Definition
- **FR-1.1**: Predefined expertise categories (technical, product, industry, certification)
- **FR-1.2**: Admin can add/edit expertise tags
- **FR-1.3**: Tags have descriptions and icons
- **FR-1.4**: Hierarchical tags (e.g., Technical > API > REST)
- **FR-1.5**: Related tag suggestions

### FR-2: Self-Tagging
- **FR-2.1**: Users tag their own expertise areas
- **FR-2.2**: Set proficiency level (1-5)
- **FR-2.3**: Add notes about experience
- **FR-2.4**: Indicate willingness to help others
- **FR-2.5**: Specify preferred contact method

### FR-3: Verification & Endorsement
- **FR-3.1**: Manager verification of claimed expertise
- **FR-3.2**: Peer endorsements (LinkedIn-style)
- **FR-3.3**: Certification linking (external verification)
- **FR-3.4**: Auto-verify from activity (e.g., closed deals in industry)
- **FR-3.5**: Display verified badge

### FR-4: Expert Search
- **FR-4.1**: Search team by expertise tag
- **FR-4.2**: Filter by proficiency level
- **FR-4.3**: Filter by availability/willingness to help
- **FR-4.4**: Show relevant experience metrics
- **FR-4.5**: One-click contact/mention

### FR-5: Expert Recommendations
- **FR-5.1**: "Who can help with X?" from customer context
- **FR-5.2**: AI-suggested experts based on situation
- **FR-5.3**: Show past successful interactions
- **FR-5.4**: Recommend based on customer industry/tech stack

---

## Non-Functional Requirements

### NFR-1: Performance
- Expert search results < 500ms

### NFR-2: Privacy
- Users control visibility of their expertise profile

### NFR-3: Quality
- Verification process maintains trust in expertise claims

---

## Technical Approach

### Data Model Extensions

```sql
-- expertise_tags table
CREATE TABLE expertise_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'technical', 'product', 'industry', 'certification', 'skill'
  parent_tag_id UUID REFERENCES expertise_tags(id),
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_expertise table
CREATE TABLE user_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  tag_id UUID REFERENCES expertise_tags(id),

  -- Self-reported
  proficiency_level INTEGER DEFAULT 3, -- 1-5
  years_experience DECIMAL,
  notes TEXT,
  willing_to_help BOOLEAN DEFAULT true,
  preferred_contact VARCHAR(50), -- 'slack', 'email', 'call'

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  verification_type VARCHAR(50), -- 'manager', 'certification', 'auto'
  certification_url TEXT,

  -- Stats
  help_request_count INTEGER DEFAULT 0,
  endorsement_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tag_id)
);

-- expertise_endorsements table
CREATE TABLE expertise_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_expertise_id UUID REFERENCES user_expertise(id) ON DELETE CASCADE,
  endorsed_by_user_id UUID REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_expertise_id, endorsed_by_user_id)
);

-- expertise_help_requests (track when experts help)
CREATE TABLE expertise_help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_user_id UUID REFERENCES users(id),
  expert_user_id UUID REFERENCES users(id),
  tag_id UUID REFERENCES expertise_tags(id),
  customer_id UUID REFERENCES customers(id),
  context TEXT,
  outcome VARCHAR(50), -- 'helpful', 'somewhat_helpful', 'not_helpful'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_expertise_tag ON user_expertise(tag_id);
CREATE INDEX idx_user_expertise_user ON user_expertise(user_id);
CREATE INDEX idx_expertise_tags_category ON expertise_tags(category);
CREATE INDEX idx_expertise_tags_parent ON expertise_tags(parent_tag_id);
```

### Expert Matching Algorithm

```typescript
interface ExpertMatch {
  user_id: string;
  user_name: string;
  relevance_score: number;
  expertise: {
    tag_id: string;
    tag_name: string;
    proficiency_level: number;
    is_verified: boolean;
    endorsement_count: number;
  }[];
  availability: {
    willing_to_help: boolean;
    preferred_contact: string;
    recent_help_count: number;
  };
  experience: {
    similar_customers: number;
    successful_outcomes: number;
  };
}

async function findExperts(
  tagIds: string[],
  context?: { customerId?: string; industry?: string }
): Promise<ExpertMatch[]> {
  // Find users with matching expertise
  const experts = await db.query(`
    SELECT u.*, ue.*, et.name as tag_name,
           COUNT(e.id) as endorsement_count
    FROM users u
    JOIN user_expertise ue ON u.id = ue.user_id
    JOIN expertise_tags et ON ue.tag_id = et.id
    LEFT JOIN expertise_endorsements e ON ue.id = e.user_expertise_id
    WHERE ue.tag_id = ANY($1)
      AND ue.willing_to_help = true
    GROUP BY u.id, ue.id, et.id
    ORDER BY ue.proficiency_level DESC, endorsement_count DESC
  `, [tagIds]);

  // Enrich with context-specific scoring
  const matches = await Promise.all(experts.map(async expert => {
    const similarCustomers = context?.customerId
      ? await getSimilarCustomerExperience(expert.user_id, context.customerId)
      : 0;

    return {
      user_id: expert.user_id,
      user_name: expert.name,
      relevance_score: calculateRelevanceScore(expert, similarCustomers),
      expertise: formatExpertise(expert),
      availability: formatAvailability(expert),
      experience: { similar_customers: similarCustomers, successful_outcomes: expert.successful_outcomes }
    };
  }));

  return matches.sort((a, b) => b.relevance_score - a.relevance_score);
}
```

### API Endpoints

```typescript
// Expertise tags
GET    /api/expertise-tags
POST   /api/expertise-tags (admin)
PATCH  /api/expertise-tags/:id (admin)

// User expertise
GET    /api/users/:id/expertise
POST   /api/users/:id/expertise
PATCH  /api/users/:id/expertise/:tagId
DELETE /api/users/:id/expertise/:tagId

// Verification
POST   /api/users/:id/expertise/:tagId/verify
GET    /api/expertise/pending-verifications

// Endorsements
POST   /api/users/:id/expertise/:tagId/endorse
DELETE /api/users/:id/expertise/:tagId/endorse

// Expert search
GET    /api/experts/search?tags={tagIds}&proficiency={level}
GET    /api/experts/recommend?customer={id}&topic={text}

// Help tracking
POST   /api/expertise/help-requests
PATCH  /api/expertise/help-requests/:id/outcome
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Expertise profiles completed | 80% of users | Profile completion |
| Expert search usage | 5+ searches per CSM/week | Search analytics |
| Time to find expert | < 2 minutes | User tracking |
| Help request satisfaction | 4/5+ rating | Outcome tracking |

---

## Acceptance Criteria

- [ ] Admin can define expertise tags with categories
- [ ] Users can tag themselves with expertise areas
- [ ] Users can set proficiency level and willingness to help
- [ ] Managers can verify expertise claims
- [ ] Peers can endorse expertise
- [ ] Search finds experts by tag with filters
- [ ] Expert recommendations available from customer context
- [ ] One-click contact to reach expert
- [ ] Verification badges displayed on profiles

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 1 day |
| Expertise tag management | 2 days |
| User expertise UI | 2 days |
| Verification workflow | 2 days |
| Expert search | 2 days |
| Recommendation engine | 2 days |
| Integration with resource request | 1 day |
| Testing | 2 days |
| **Total** | **14 days** |

---

## Notes

- Consider gamification for building expertise profiles
- Add expertise leaderboards
- Future: AI-inferred expertise from activity patterns
- Future: External expertise marketplace
- Future: Learning path recommendations based on expertise gaps
