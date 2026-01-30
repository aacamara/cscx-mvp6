# PRD-259: Knowledge Capture

## Metadata
- **PRD ID**: PRD-259
- **Title**: Knowledge Capture
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-254 (Best Practice Sharing), Knowledge base, AI capabilities

---

## Problem Statement

Valuable knowledge from customer interactions, problem-solving sessions, and successful strategies is lost because there's no easy way to capture and organize it in the moment. CSMs intend to document learnings later but rarely do, and even when they do, the information is hard to find and apply.

## User Story

> As a CSM, I want to quickly capture knowledge nuggets from my daily work and have AI help organize and surface them when relevant so that team knowledge compounds over time.

---

## Functional Requirements

### FR-1: Quick Capture
- **FR-1.1**: One-click capture button from any page
- **FR-1.2**: Capture from chat/email context
- **FR-1.3**: Voice note capture with transcription
- **FR-1.4**: Screenshot/image capture with annotation
- **FR-1.5**: Capture from meeting summary

### FR-2: Smart Tagging
- **FR-2.1**: AI-suggested tags based on content
- **FR-2.2**: Auto-link to related customers
- **FR-2.3**: Category classification (tip, warning, process, template)
- **FR-2.4**: Skill/topic tagging
- **FR-2.5**: Confidence/usefulness rating

### FR-3: Knowledge Organization
- **FR-3.1**: Personal knowledge library
- **FR-3.2**: Share to team knowledge base
- **FR-3.3**: Link related knowledge items
- **FR-3.4**: Version tracking as knowledge evolves
- **FR-3.5**: Archive outdated knowledge

### FR-4: Knowledge Surfacing
- **FR-4.1**: Contextual suggestions during work
- **FR-4.2**: Search across all captured knowledge
- **FR-4.3**: "Similar situations" recommendations
- **FR-4.4**: Include in AI assistant context
- **FR-4.5**: Weekly knowledge digest

### FR-5: Knowledge Quality
- **FR-5.1**: Peer validation of shared knowledge
- **FR-5.2**: Usage tracking (was it helpful?)
- **FR-5.3**: Expiration reminders for time-sensitive info
- **FR-5.4**: Manager curation for team library
- **FR-5.5**: Quality scoring algorithm

---

## Non-Functional Requirements

### NFR-1: Frictionless
- Capture in < 10 seconds

### NFR-2: Intelligent
- AI tagging accuracy > 80%

### NFR-3: Discoverable
- Relevant knowledge surfaces in context

---

## Technical Approach

### Data Model Extensions

```sql
-- knowledge_captures table
CREATE TABLE knowledge_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Content
  capture_type VARCHAR(50) NOT NULL, -- 'text', 'voice', 'image', 'link', 'meeting_excerpt'
  title VARCHAR(500),
  content TEXT NOT NULL,
  raw_content TEXT, -- Original before processing (e.g., voice transcript)
  attachments JSONB DEFAULT '[]',

  -- Classification
  category VARCHAR(50), -- 'tip', 'warning', 'process', 'template', 'insight', 'question'
  tags TEXT[] DEFAULT '{}',
  ai_suggested_tags TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',

  -- Context
  source_context JSONB, -- Where it was captured from
  customer_ids UUID[] DEFAULT '{}',
  related_entity_type VARCHAR(50),
  related_entity_id UUID,

  -- Visibility
  visibility VARCHAR(20) DEFAULT 'private', -- 'private', 'team', 'public'
  shared_at TIMESTAMPTZ,

  -- Quality
  usefulness_rating INTEGER, -- Self-rating 1-5
  usage_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  quality_score DECIMAL,

  -- Lifecycle
  expires_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,

  -- Embeddings for similarity search
  embedding VECTOR(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge_validations
CREATE TABLE knowledge_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID REFERENCES knowledge_captures(id) ON DELETE CASCADE,
  validated_by_user_id UUID REFERENCES users(id),
  is_valid BOOLEAN,
  feedback TEXT,
  validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge_usage
CREATE TABLE knowledge_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID REFERENCES knowledge_captures(id),
  used_by_user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  context VARCHAR(100), -- Where it was surfaced/used
  was_helpful BOOLEAN,
  feedback TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge_links (related knowledge)
CREATE TABLE knowledge_links (
  source_knowledge_id UUID REFERENCES knowledge_captures(id) ON DELETE CASCADE,
  target_knowledge_id UUID REFERENCES knowledge_captures(id) ON DELETE CASCADE,
  link_type VARCHAR(50) DEFAULT 'related', -- 'related', 'supersedes', 'contradicts'
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_knowledge_id, target_knowledge_id)
);

CREATE INDEX idx_knowledge_user ON knowledge_captures(captured_by_user_id);
CREATE INDEX idx_knowledge_tags ON knowledge_captures USING GIN(tags);
CREATE INDEX idx_knowledge_topics ON knowledge_captures USING GIN(topics);
CREATE INDEX idx_knowledge_customers ON knowledge_captures USING GIN(customer_ids);
CREATE INDEX idx_knowledge_embedding ON knowledge_captures USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_search ON knowledge_captures
  USING GIN(to_tsvector('english', title || ' ' || content));
```

### AI Processing Pipeline

```typescript
interface ProcessedKnowledge {
  title: string;
  content: string;
  suggested_tags: string[];
  suggested_topics: string[];
  suggested_category: string;
  linked_customers: string[];
  embedding: number[];
  expiration_suggestion?: Date;
}

async function processKnowledgeCapture(raw: RawCapture): Promise<ProcessedKnowledge> {
  // Transcribe if voice
  let content = raw.content;
  if (raw.capture_type === 'voice') {
    content = await transcribeAudio(raw.audio_data);
  }

  // Extract structured info with AI
  const extraction = await claude.complete({
    prompt: `Analyze this knowledge capture from a Customer Success Manager:

"${content}"

Extract:
1. A concise title (max 80 chars)
2. Relevant tags (max 5)
3. Topics/skills this relates to
4. Category: tip, warning, process, template, insight, or question
5. Any customer names mentioned
6. If time-sensitive, when it might expire

Return JSON format.`
  });

  const parsed = JSON.parse(extraction);

  // Generate embedding for similarity search
  const embedding = await generateEmbedding(content);

  // Match mentioned customers
  const linkedCustomers = await matchCustomerNames(parsed.customer_mentions);

  return {
    title: parsed.title || content.slice(0, 80),
    content: content,
    suggested_tags: parsed.tags,
    suggested_topics: parsed.topics,
    suggested_category: parsed.category,
    linked_customers: linkedCustomers,
    embedding: embedding,
    expiration_suggestion: parsed.expiration_date ? new Date(parsed.expiration_date) : undefined
  };
}
```

### Knowledge Surfacing

```typescript
interface KnowledgeSuggestion {
  knowledge_id: string;
  relevance_score: number;
  match_reasons: string[];
}

async function getRelevantKnowledge(context: {
  customer_id?: string;
  current_task?: string;
  recent_chat?: string;
  current_page?: string;
}): Promise<KnowledgeSuggestion[]> {
  // Build context string for embedding
  const contextString = [
    context.current_task,
    context.recent_chat,
    await getCustomerContext(context.customer_id)
  ].filter(Boolean).join(' ');

  const contextEmbedding = await generateEmbedding(contextString);

  // Find similar knowledge by embedding
  const similar = await db.query(`
    SELECT k.*, 1 - (k.embedding <=> $1) as similarity
    FROM knowledge_captures k
    WHERE k.visibility IN ('team', 'public')
      AND k.is_archived = false
      AND (k.expires_at IS NULL OR k.expires_at > NOW())
    ORDER BY k.embedding <=> $1
    LIMIT 10
  `, [contextEmbedding]);

  // Filter and rank
  return similar
    .filter(k => k.similarity > 0.7)
    .map(k => ({
      knowledge_id: k.id,
      relevance_score: k.similarity * (1 + k.quality_score * 0.2),
      match_reasons: getMatchReasons(k, context)
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5);
}
```

### API Endpoints

```typescript
// Capture
POST   /api/knowledge/capture
POST   /api/knowledge/capture/voice
POST   /api/knowledge/capture/image

// CRUD
GET    /api/knowledge
GET    /api/knowledge/:id
PATCH  /api/knowledge/:id
DELETE /api/knowledge/:id

// Sharing
POST   /api/knowledge/:id/share
POST   /api/knowledge/:id/archive

// Validation
POST   /api/knowledge/:id/validate
GET    /api/knowledge/:id/validations

// Usage tracking
POST   /api/knowledge/:id/use
POST   /api/knowledge/:id/feedback

// Surfacing
GET    /api/knowledge/relevant
GET    /api/knowledge/search?q={query}
GET    /api/knowledge/similar/:id

// Personal library
GET    /api/knowledge/my
GET    /api/knowledge/team
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Captures per CSM per week | 5+ | Capture tracking |
| AI tag acceptance rate | 70%+ | Tag modifications |
| Knowledge reuse rate | 30% items used by others | Usage tracking |
| Helpful rating | 80%+ | Feedback tracking |

---

## Acceptance Criteria

- [ ] One-click capture from any page
- [ ] Voice capture with transcription
- [ ] AI suggests tags and category
- [ ] Knowledge auto-linked to customers
- [ ] Personal library accessible
- [ ] Share to team with visibility control
- [ ] Contextual suggestions appear during work
- [ ] Search across all knowledge
- [ ] Usage and helpfulness tracked
- [ ] Expiration reminders sent

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Capture UI (all types) | 3 days |
| AI processing pipeline | 3 days |
| Embedding & search | 2 days |
| Knowledge surfacing | 3 days |
| API endpoints | 2 days |
| Library UI | 2 days |
| Testing | 2 days |
| **Total** | **19 days** |

---

## Notes

- Consider browser extension for external capture
- Add Slack integration for capturing from messages
- Future: Auto-capture insights from meeting transcripts
- Future: Knowledge graph visualization
- Future: Automated knowledge synthesis from multiple captures
