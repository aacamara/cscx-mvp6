# PRD-146: Custom Object Created → Workflow

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-146 |
| **Title** | Custom Object Created → Workflow |
| **Category** | E: Workflow Automation |
| **Priority** | P3 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When custom objects are created in CSCX (projects, initiatives, custom tracking entities), there's no automatic workflow associated with them. Users must manually set up related tasks, notifications, and tracking.

## User Story
**As a** CS Operations Manager
**I want** automatic workflow generation when custom objects are created
**So that** consistent processes are followed regardless of who creates the object

## Functional Requirements

### FR-1: Custom Object Detection
- Detect custom object creation:
  - Project created
  - Initiative started
  - Custom entity added
  - Template instantiated
- Capture object type and properties

### FR-2: Workflow Template Matching
- Match to workflow templates:
  - Object type mapping
  - Property-based selection
  - Customer segment rules
  - User role rules
- Support multiple workflow types

### FR-3: Workflow Generation
- Generate associated workflows:
  - Task creation
  - Milestone setup
  - Notification rules
  - Approval workflows
  - Reporting configuration

### FR-4: Stakeholder Assignment
- Auto-assign stakeholders:
  - Owner assignment rules
  - Participant identification
  - Approval chain setup
  - Notification preferences

### FR-5: Timeline Configuration
- Set workflow timeline:
  - Calculate dates from creation
  - Adjust for customer context
  - Set reminders and escalations
  - Handle dependencies

### FR-6: Customization
- Allow workflow customization:
  - Add/remove tasks
  - Adjust timelines
  - Modify participants
  - Override defaults
- Save as new template

## Non-Functional Requirements

### NFR-1: Flexibility
- Support any custom object type
- Configurable workflow templates

### NFR-2: Consistency
- Same object type = same workflow
- Audit trail maintained

## Technical Specifications

### Data Model
```typescript
interface CustomObjectWorkflow {
  id: string;
  objectType: string;
  objectId: string;
  customerId: string;
  workflowTemplate: {
    id: string;
    name: string;
    version: number;
  };
  generatedElements: {
    tasks: TaskRef[];
    milestones: MilestoneRef[];
    notifications: NotificationRule[];
    approvals: ApprovalConfig[];
  };
  assignments: {
    owner: string;
    participants: string[];
    approvers: string[];
  };
  timeline: {
    startDate: Date;
    endDate: Date;
    milestones: TimelineEvent[];
  };
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
}

interface WorkflowTemplate {
  id: string;
  objectType: string;
  name: string;
  tasks: TaskTemplate[];
  milestones: MilestoneTemplate[];
  notificationRules: NotificationTemplate[];
  assignmentRules: AssignmentRule[];
  isDefault: boolean;
}
```

### API Endpoints
- `POST /api/workflows/generate` - Generate workflow
- `GET /api/workflows/object/:objectId` - Get object workflow
- `PUT /api/workflows/:id/customize` - Customize workflow
- `GET /api/workflows/templates` - List templates
- `POST /api/workflows/templates` - Create template

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Custom Objects | IN | Object creation |
| Tasks | OUT | Task creation |
| Calendar | OUT | Milestone scheduling |
| Notifications | OUT | Alert setup |

## Acceptance Criteria

- [ ] Custom objects detected
- [ ] Templates matched correctly
- [ ] Workflows generated accurately
- [ ] Assignments applied
- [ ] Timelines configured
- [ ] Customization works

## Dependencies
- PRD-234: Natural Language Task Creation
- PRD-214: Intelligent Task Prioritization

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflow coverage | > 80% | Objects with workflows |
| Template usage | > 90% | Generated vs custom |
| Process compliance | +30% | Steps followed |

## Implementation Notes
- Build workflow template engine
- Support conditional logic
- Enable dynamic variable substitution
- Consider versioning for templates
