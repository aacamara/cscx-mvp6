# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for CSCX.AI.

## What are ADRs?

ADRs capture important architectural decisions along with their context and consequences. They serve as:
1. **Agent memory** - Coding agents read these to understand WHY decisions were made
2. **Onboarding docs** - New developers understand the reasoning behind the architecture
3. **Decision log** - Track how the system evolved and why

## For AI Coding Agents

**IMPORTANT:** Before making significant changes to any subsystem, read the relevant ADRs first. If you're about to "fix" something that seems suboptimal, check if there's an ADR explaining why it exists that way.

When proposing significant architectural changes, draft a new ADR explaining:
- What you're changing
- Why the current approach seems problematic
- What you propose instead
- What consequences this might have

## ADR Index

| ID | Title | Status | Subsystem | Date |
|----|-------|--------|-----------|------|
| [001](001-hitl-approval-pattern.md) | Human-in-the-Loop Approval Pattern | Accepted | agents/approval | 2026-01-15 |
| [002](002-multi-agent-specialist-architecture.md) | Multi-Agent Specialist Architecture | Accepted | agents/orchestrator | 2026-01-15 |
| [003](003-session-persistence-strategy.md) | Session Persistence Strategy | Accepted | services/session | 2026-01-15 |
| [004](004-ai-service-failover.md) | AI Service Failover with Circuit Breakers | Accepted | services/ai | 2026-01-15 |
| [005](005-monolithic-deployment.md) | Monolithic Frontend+Backend Deployment | Accepted | deployment | 2026-01-15 |
| [006](006-relative-api-urls.md) | Relative API URLs for Frontend | Accepted | frontend | 2026-01-15 |

## ADR Template

```markdown
# ADR-XXX: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-YYY

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult because of this change?

## Metadata
- **Subsystem:** e.g., agents/orchestrator, services/ai
- **Related ADRs:** e.g., ADR-001, ADR-003
- **Supersedes:** e.g., ADR-002 (if applicable)
```
