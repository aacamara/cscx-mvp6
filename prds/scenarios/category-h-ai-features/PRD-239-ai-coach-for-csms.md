# PRD-239: AI Coach for CSMs

## Metadata
- **PRD ID**: PRD-239
- **Category**: H - AI-Powered Features
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: PRD-214 (Task Prioritization), PRD-233 (Meeting Prep)

## Scenario Description
An AI coaching assistant that provides real-time guidance to CSMs on best practices, suggests improvements to their approach, and helps develop their skills through contextual recommendations and feedback.

## User Story
**As a** CSM looking to improve,
**I want** an AI coach that provides guidance,
**So that** I can develop my skills and improve customer outcomes.

## Trigger
- CSM asks: "How should I handle [situation]?"
- CSM requests feedback after customer interaction
- Weekly coaching summary generated
- Before high-stakes interactions

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Chat interface | AIPanel | Implemented | Conversational AI |
| Knowledge base | `knowledge_base` | Implemented | Best practices stored |
| Playbooks | `csm_playbooks` | Implemented | Recommended actions |
| Activity tracking | `agent_activity_log` | Implemented | CSM actions logged |

### What's Missing
- [ ] Coaching persona and prompts
- [ ] Skill assessment framework
- [ ] Personalized improvement recommendations
- [ ] Real-time situation guidance
- [ ] Post-interaction feedback loops
- [ ] Progress tracking over time

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/agents/specialists/coach.ts` | Create | AI coach agent |
| `server/src/services/coaching/skillAssessment.ts` | Create | Skill assessment |
| `components/AICoach.tsx` | Create | Coaching interface |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/coaching/guidance` | POST | Get situational guidance |
| `POST /api/coaching/feedback` | POST | Get interaction feedback |
| `GET /api/coaching/skills` | GET | Get skill assessment |
| `GET /api/coaching/progress` | GET | Get progress over time |

### Database Changes
```sql
CREATE TABLE csm_skill_assessments (
  id UUID PRIMARY KEY,
  user_id UUID,
  skill_area VARCHAR(50),
  proficiency_level INTEGER,
  assessed_at TIMESTAMPTZ,
  recommendations JSONB
);

CREATE TABLE coaching_interactions (
  id UUID PRIMARY KEY,
  user_id UUID,
  interaction_type VARCHAR(50),
  context JSONB,
  guidance_provided TEXT,
  feedback_received TEXT,
  created_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
CSM: My champion at Acme Corp just got promoted to VP. How should I handle this?
AI Coach: Great question! A champion promotion is a significant opportunity. Here's my guidance:

**Situation Analysis:**
This is generally positive - your champion now has more influence. However, there are risks to manage.

**Recommended Approach:**

1. **Congratulate Immediately** (Today)
   - Send a personal congratulations (not automated)
   - Reference specific wins you've achieved together
   - Express excitement for continued partnership

2. **Strategic Recalibration** (This Week)
   - Request a brief call to understand their new priorities
   - Ask about changes to their team and decision-making
   - Identify if they'll still be your day-to-day contact

3. **Expand Your Network** (Within 2 Weeks)
   - Ask for introductions to their backfill
   - Build relationship with new team members
   - Position yourself with executives they now report to

4. **Value Reinforcement** (Within 1 Month)
   - Prepare a success summary for their new stakeholders
   - Propose expanded engagement matching their new scope
   - Look for expansion opportunities aligned with their goals

**Watch Out For:**
⚠️ Champion may become too senior for day-to-day involvement
⚠️ Their priorities may shift away from your product
⚠️ Political dynamics with their former peers

**Template Ready:**
[Generate Congratulations Email] [Create Expansion Plan]

Would you like me to draft the congratulations email?
```

## Acceptance Criteria
- [ ] Provide real-time guidance for common CS situations
- [ ] Offer post-interaction feedback on approach
- [ ] Track skill areas and improvement over time
- [ ] Reference best practices from knowledge base
- [ ] Learn individual CSM strengths and growth areas
- [ ] Generate weekly coaching summaries
- [ ] Support multiple coaching modes (reactive, proactive)

## Ralph Loop Notes
- **Learning**: Track which guidance leads to successful outcomes
- **Optimization**: Improve coaching based on CSM feedback
- **Personalization**: Adapt coaching style to individual CSM

### Completion Signal
```
<promise>PRD-239-COMPLETE</promise>
```
