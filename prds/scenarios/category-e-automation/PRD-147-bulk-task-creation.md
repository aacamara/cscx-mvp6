# PRD-147: Bulk Task Creation → Portfolio Actions

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-147 |
| **Title** | Bulk Task Creation → Portfolio Actions |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs managing large portfolios need to create similar tasks across multiple customers (e.g., QBR scheduling, renewal outreach, health checks). Manual task creation is time-consuming and error-prone.

## User Story
**As a** CSM
**I want** bulk task creation across my portfolio
**So that** I can efficiently manage portfolio-wide activities without repetitive manual work

## Functional Requirements

### FR-1: Bulk Task Trigger
- Support bulk task creation via:
  - Manual selection of customers
  - Segment-based selection
  - Filter-based selection
  - Saved customer lists
  - Campaign enrollment

### FR-2: Task Template
- Create task template:
  - Task name (with variables)
  - Description
  - Due date calculation
  - Priority
  - Task type
  - Assignee rules
- Save templates for reuse

### FR-3: Customer Personalization
- Personalize per customer:
  - `{{customer_name}}` substitution
  - `{{renewal_date}}` calculations
  - `{{csm_name}}` assignment
  - Customer-specific due dates
  - Priority based on segment

### FR-4: Execution Options
- Configure execution:
  - Immediate creation
  - Scheduled creation
  - Staggered creation (avoid overload)
  - Conditional creation (skip if task exists)

### FR-5: Progress Tracking
- Track bulk operation:
  - Total customers
  - Tasks created
  - Tasks skipped
  - Errors encountered
- Provide completion report

### FR-6: Task Management
- Manage created tasks:
  - View all tasks from bulk operation
  - Bulk update/complete
  - Filter by completion status
  - Export task list

### FR-7: Reporting
- Bulk task analytics:
  - Completion rates
  - Average time to complete
  - Portfolio coverage
  - Task effectiveness

## Non-Functional Requirements

### NFR-1: Performance
- Handle 1000+ customer selection
- Task creation < 1 second each

### NFR-2: Reliability
- No partial failures (all or nothing option)
- Retry failed creations

## Technical Specifications

### Data Model
```typescript
interface BulkTaskOperation {
  id: string;
  createdBy: string;
  template: {
    name: string;
    description: string;
    dueDateRule: string;
    priority: 'high' | 'medium' | 'low';
    taskType: string;
    assigneeRule: string;
  };
  selection: {
    type: 'manual' | 'segment' | 'filter' | 'list';
    criteria: Record<string, any>;
    customerIds: string[];
    totalCount: number;
  };
  execution: {
    mode: 'immediate' | 'scheduled' | 'staggered';
    scheduledAt: Date | null;
    staggerInterval: number | null;
    skipExisting: boolean;
  };
  progress: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    created: number;
    skipped: number;
    failed: number;
    taskIds: string[];
    errors: Error[];
    startedAt: Date | null;
    completedAt: Date | null;
  };
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/tasks/bulk` - Create bulk tasks
- `GET /api/tasks/bulk/:id` - Get operation status
- `GET /api/tasks/bulk/:id/tasks` - Get created tasks
- `PUT /api/tasks/bulk/:id/cancel` - Cancel operation
- `GET /api/tasks/templates` - List task templates

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Customer Data | IN | Customer selection |
| Tasks | OUT | Task creation |
| Calendar | OUT | Due date calculation |
| Notifications | OUT | Assignment alerts |

## UI/UX Requirements

### Bulk Task Wizard
- Customer selection step
- Template configuration
- Preview and confirm
- Progress indicator

### Task Template Library
- Saved templates
- Template categories
- Quick apply

### Progress Dashboard
- Operation status
- Task breakdown
- Error details

## Acceptance Criteria

- [ ] Customer selection works
- [ ] Templates save and apply
- [ ] Personalization accurate
- [ ] Bulk creation performs well
- [ ] Progress tracked correctly
- [ ] Tasks manageable

## Dependencies
- PRD-234: Natural Language Task Creation
- PRD-214: Intelligent Task Prioritization
- PRD-057: "What Accounts Need Attention?" Briefing

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Creation speed | < 1 sec/task | Bulk operation timing |
| Template usage | > 70% | Templated vs custom |
| CSM time saved | > 80% | Compared to manual |

## Implementation Notes
- Use batch processing for large operations
- Implement rate limiting for task creation
- Build customer variable resolution
- Support undo/rollback
