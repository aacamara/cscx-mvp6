# Tasks - Agent Instructions

## Overview

PRD (Product Requirements Document) files for Ralph loop execution.

## File Naming

```
tasks/
├── AGENTS.md                           # This file
├── prd-[feature-name].md              # Individual PRD files
├── prd-playbook-execution-engine.md
├── prd-predictive-analytics.md
├── prd-multi-channel-communications.md
├── prd-crm-bidirectional-sync.md
├── prd-executive-command-center.md
├── prd-customer-self-service-portal.md
├── prd-multi-user-team-management.md
├── prd-agent-chat-ui-backend.md
└── prd-new-onboarding-experience.md
```

## PRD Structure

Each PRD should contain:

1. **Introduction** - What problem this solves
2. **Goals** - Measurable objectives
3. **User Stories** - US-001, US-002, etc.
4. **Functional Requirements** - FR-1, FR-2, etc.
5. **Non-Goals** - What's out of scope
6. **Technical Considerations** - Implementation notes
7. **Success Metrics** - How to measure success
8. **Open Questions** - Unresolved issues

## Creating a PRD

```
# Tell Claude:
Load the prd skill. Create a PRD for [your feature description]

# The skill will:
1. Ask clarifying questions (or self-clarify)
2. Generate structured PRD
3. Save to tasks/prd-[feature-name].md
```

## Converting PRD to prd.json

```
# Tell Claude:
Load the tasks skill. Convert tasks/prd-[feature-name].md to prd.json

# Output location depends on which loop:
# - Ralph: scripts/ralph/prd.json
# - Compound: scripts/compound/prd.json
```

## prd.json Format

```json
{
  "project": "CSCX.AI",
  "branchName": "compound/feature-name",
  "description": "One-line description",
  "tasks": [
    {
      "id": "T-001",
      "title": "Implement [specific thing]",
      "description": "What to do and why",
      "acceptanceCriteria": [
        "Specific verifiable criterion",
        "Run `npx tsc --noEmit` - exits with code 0"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Task Granularity Rules

### Target: 8-15 tasks per PRD

- Each task should be completable in ONE iteration
- Split investigation from implementation
- One concern per task

### Good Task Size
- Check one configuration file
- Test one user interaction
- Make one code change
- Add one component

### Too Big (Split These)
- "Test the entire signup flow"
- "Add authentication"
- "Build the dashboard"

## Acceptance Criteria Rules

### Must Be Machine-Verifiable

```
❌ BAD:
- "Works correctly"
- "Review the configuration"
- "Verify it looks good"

✅ GOOD:
- "Run `npx tsc --noEmit` - exits with code 0"
- "File `src/config.ts` contains `enabled: true`"
- "Navigate to /signup - page loads without errors"
```

## Current PRDs

| PRD | Status | Priority |
|-----|--------|----------|
| prd-playbook-execution-engine.md | Ready | High |
| prd-predictive-analytics.md | Ready | High |
| prd-multi-channel-communications.md | Ready | Medium |
| prd-crm-bidirectional-sync.md | Ready | Medium |
| prd-executive-command-center.md | Ready | Medium |
| prd-customer-self-service-portal.md | Ready | Medium |
| prd-multi-user-team-management.md | Ready | High |
| prd-agent-chat-ui-backend.md | Ready | High |
| prd-new-onboarding-experience.md | Ready | High |

## Workflow

1. **Plan** (60+ minutes)
   - Define the feature thoroughly
   - Identify edge cases
   - Create PRD with `prd` skill

2. **Convert**
   - Use `tasks` skill to create prd.json
   - Review generated tasks
   - Ensure 8-15 granular tasks

3. **Execute**
   - Run Ralph or Compound loop
   - Monitor progress.txt
   - Review commits

4. **Review**
   - Check generated PR
   - Verify acceptance criteria met
   - Merge or request changes
