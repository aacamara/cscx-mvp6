# PRD-234: Natural Language Task Creation

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-234 |
| **Title** | Natural Language Task Creation |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Creating tasks in the system requires navigating forms, selecting fields, and manual data entry. CSMs often think of tasks in natural language ("remind me to follow up with Sarah next week about the renewal"). AI should understand these natural expressions and create properly structured tasks automatically, reducing friction and keeping CSMs in flow.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to type "follow up with TechCorp about pricing on Friday" and have a task created.
2. **As a CSM**, I want AI to infer customer, due date, and priority from context.
3. **As a CSM**, I want to create tasks via voice or chat without form navigation.
4. **As a CSM**, I want to review and confirm AI-created tasks before saving.
5. **As a CSM**, I want batch task creation from a list of items.

### Secondary User Stories
1. **As a CSM**, I want tasks created automatically from meeting action items.
2. **As a CSM**, I want to mention tasks in conversation and have them captured.
3. **As a CSM**, I want smart defaults based on task type and customer context.

## Acceptance Criteria

### Core Functionality
- [ ] Natural language task input via chat or dedicated input
- [ ] Automatic customer/stakeholder association
- [ ] Intelligent due date extraction (relative and absolute)
- [ ] Priority inference from language
- [ ] Task type classification
- [ ] Confirmation before creation

### Entity Extraction
- [ ] Customer name (fuzzy match to database)
- [ ] Stakeholder name (from customer contacts)
- [ ] Due date/time (absolute or relative)
- [ ] Priority (from urgency words)
- [ ] Task type (follow-up, send, schedule, review, etc.)
- [ ] Related context (meeting, email, deal)

### Input Formats
- [ ] Free text input ("Follow up with Sarah tomorrow")
- [ ] Voice input (transcribed to text)
- [ ] Bullet list (multiple tasks from a list)
- [ ] Email/meeting extraction ("Create tasks from these action items")

## Technical Specification

### Architecture

```
Natural Language Input → NLP Parser → Entity Extractor → Task Builder → Confirmation → Database
                              ↓
                        Customer/Stakeholder Matcher
```

### NLP Task Parser

```typescript
interface ParsedTask {
  raw_input: string;
  action_verb: string;
  description: string;
  entities: {
    customer?: CustomerMatch;
    stakeholder?: StakeholderMatch;
    due_date?: DateExtraction;
    priority?: PriorityExtraction;
    task_type?: TaskType;
    related_to?: RelatedEntity;
  };
  confidence: number;
  ambiguities: Ambiguity[];
}

interface DateExtraction {
  raw_text: string;
  parsed_date: Date;
  is_relative: boolean;
  confidence: number;
}

interface TaskType {
  type: 'follow_up' | 'send' | 'schedule' | 'review' | 'call' | 'email' | 'research' | 'other';
  confidence: number;
}
```

### Task Extraction Logic

```typescript
async function parseNaturalLanguageTask(
  input: string,
  context: UserContext
): Promise<ParsedTask> {
  const prompt = `
    Parse this task description and extract structured information.

    Input: "${input}"

    User context:
    - Current customer (if viewing): ${context.currentCustomerId}
    - Today's date: ${new Date().toISOString().split('T')[0]}
    - User timezone: ${context.timezone}

    Extract:
    1. Action verb (follow up, send, schedule, call, review, etc.)
    2. Task description (what needs to be done)
    3. Customer/company mentioned (if any)
    4. Person/stakeholder mentioned (if any)
    5. Due date (parse relative dates like "tomorrow", "next week", "Friday")
    6. Priority signals (urgent, ASAP, when you can, etc.)
    7. Task type classification

    Handle ambiguities:
    - If no customer mentioned, suggest current context or ask
    - If no date mentioned, suggest reasonable default
    - If multiple interpretations, list them

    Return as JSON.
  `;

  const parsed = await claude.parse(prompt);

  // Match customer and stakeholder to database
  if (parsed.customer_mention) {
    parsed.entities.customer = await fuzzyMatchCustomer(parsed.customer_mention);
  }

  if (parsed.stakeholder_mention && parsed.entities.customer) {
    parsed.entities.stakeholder = await matchStakeholder(
      parsed.stakeholder_mention,
      parsed.entities.customer.id
    );
  }

  return parsed;
}

const PRIORITY_KEYWORDS = {
  high: ['urgent', 'asap', 'immediately', 'critical', 'important', 'high priority'],
  medium: ['soon', 'this week', 'when possible'],
  low: ['eventually', 'when you can', 'low priority', 'nice to have']
};

function extractPriority(text: string): PriorityExtraction {
  const lowerText = text.toLowerCase();

  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some(k => lowerText.includes(k))) {
      return { priority, confidence: 0.9 };
    }
  }

  return { priority: 'medium', confidence: 0.5 };  // Default
}
```

### API Endpoints

#### POST /api/tasks/parse
```json
{
  "input": "Follow up with Sarah at TechCorp about the renewal next Tuesday",
  "context": {
    "current_customer_id": "optional-uuid"
  }
}
```

Response:
```json
{
  "parsed": {
    "raw_input": "Follow up with Sarah at TechCorp about the renewal next Tuesday",
    "action_verb": "follow_up",
    "description": "Follow up about the renewal",
    "entities": {
      "customer": {
        "id": "uuid",
        "name": "TechCorp Industries",
        "match_confidence": 0.95
      },
      "stakeholder": {
        "id": "uuid",
        "name": "Sarah Chen",
        "match_confidence": 0.92
      },
      "due_date": {
        "raw_text": "next Tuesday",
        "parsed_date": "2026-02-04",
        "is_relative": true,
        "confidence": 0.98
      },
      "priority": {
        "priority": "medium",
        "confidence": 0.5
      },
      "task_type": {
        "type": "follow_up",
        "confidence": 0.95
      }
    },
    "confidence": 0.91
  },
  "suggested_task": {
    "title": "Follow up with Sarah Chen about renewal",
    "description": "Follow up about the renewal (from natural language: \"Follow up with Sarah at TechCorp about the renewal next Tuesday\")",
    "customer_id": "uuid",
    "customer_name": "TechCorp Industries",
    "stakeholder_id": "uuid",
    "due_date": "2026-02-04",
    "priority": "medium",
    "task_type": "follow_up"
  },
  "ambiguities": [],
  "confirmations_needed": []
}
```

#### POST /api/tasks/create-from-nl
```json
{
  "input": "Follow up with Sarah at TechCorp about the renewal next Tuesday",
  "auto_confirm": false
}
```

#### POST /api/tasks/batch-parse
```json
{
  "items": [
    "Send pricing to TechCorp by Friday",
    "Schedule QBR with Acme Corp next month",
    "Review GlobalCo health score"
  ],
  "source": "meeting_notes"
}
```

Response:
```json
{
  "tasks": [
    {
      "input": "Send pricing to TechCorp by Friday",
      "suggested_task": { ... },
      "confidence": 0.89
    },
    {
      "input": "Schedule QBR with Acme Corp next month",
      "suggested_task": { ... },
      "confidence": 0.92
    },
    {
      "input": "Review GlobalCo health score",
      "suggested_task": { ... },
      "confidence": 0.85
    }
  ],
  "total_parsed": 3,
  "high_confidence": 2,
  "needs_review": 1
}
```

### Database Schema

Uses existing tasks table with source tracking:
```sql
ALTER TABLE tasks ADD COLUMN source VARCHAR(50);
ALTER TABLE tasks ADD COLUMN source_input TEXT;
ALTER TABLE tasks ADD COLUMN parse_confidence DECIMAL(3,2);
```

## UI/UX Design

### Quick Task Input
```
┌─────────────────────────────────────────────────────────┐
│ ➕ Quick Add Task                                        │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Follow up with Sarah at TechCorp next Tuesday       │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Press Enter to parse]                                  │
│                                                         │
│ PREVIEW                                                 │
│ ─────────                                               │
│ ✓ Customer: TechCorp Industries (95% match)            │
│ ✓ Contact: Sarah Chen (92% match)                      │
│ ✓ Due: Tuesday, Feb 4, 2026                            │
│ ✓ Type: Follow-up                                       │
│ ○ Priority: Medium (inferred - no urgency detected)    │
│                                                         │
│ [Create Task] [Edit Before Creating] [Cancel]           │
└─────────────────────────────────────────────────────────┘
```

### Bulk Task Creation from Action Items
```
┌─────────────────────────────────────────────────────────┐
│ CREATE TASKS FROM MEETING NOTES                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Detected action items:                                  │
│                                                         │
│ ☑ Send pricing comparison to Sarah                     │
│   → TechCorp | Due: Jan 31 | Priority: High            │
│                                                         │
│ ☑ Schedule training session with engineering team       │
│   → TechCorp | Due: Feb 7 | Priority: Medium           │
│                                                         │
│ ☐ Review Q1 roadmap internally                          │
│   → Internal | Due: Feb 14 | Priority: Low             │
│   ⚠️ No customer match - create as internal task?       │
│                                                         │
│ [Create 2 Selected Tasks] [Edit] [Add More]             │
└─────────────────────────────────────────────────────────┘
```

### Chat Task Creation
```
User: "remind me to follow up with techcorp about the renewal
       pricing next tuesday"

AI: I'll create a task for you:

📋 **Follow up about renewal pricing**
Customer: TechCorp Industries
Due: Tuesday, Feb 4, 2026
Priority: Medium

[Create Task] [Edit] [Cancel]
```

## Dependencies

### Required Infrastructure
- Claude API for NLP parsing
- Fuzzy matching for customers/stakeholders
- Date parsing library
- Tasks database

### Related PRDs
- PRD-213: AI Meeting Summarization (action item extraction)
- PRD-214: Intelligent Task Prioritization
- PRD-225: Voice Note Transcription

## Success Metrics

### Quantitative
- Parse accuracy > 90% for customer/date extraction
- Task creation time reduced by 70%
- Adoption: 50% of tasks created via NL within 60 days
- Correction rate < 10% (tasks edited after creation)

### Qualitative
- CSMs find NL input natural and fast
- Reduced friction in task capture
- Better task completion rates (easier capture = more tasks tracked)

## Rollout Plan

### Phase 1: Basic Parsing (Week 1-2)
- Customer and date extraction
- Simple task creation
- Manual confirmation

### Phase 2: Intelligence (Week 3-4)
- Stakeholder matching
- Priority inference
- Task type classification

### Phase 3: Integration (Week 5-6)
- Batch creation from meeting notes
- Chat interface integration
- Voice input support

### Phase 4: Automation (Week 7-8)
- Auto-confirmation for high-confidence
- Smart defaults
- Learning from corrections

## Open Questions
1. Should high-confidence tasks be created without confirmation?
2. How do we handle tasks with missing customer context?
3. Should we support recurring task creation ("every Monday")?
4. How do we handle corrections to improve the model?
