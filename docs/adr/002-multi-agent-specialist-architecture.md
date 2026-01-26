# ADR-002: Multi-Agent Specialist Architecture

## Status
Accepted

## Context

Customer Success involves diverse tasks: onboarding, adoption tracking, renewal management, risk mitigation, executive relationships. A single "do everything" agent would need an enormous prompt and wouldn't develop expertise in any area.

We considered:
1. **Monolithic agent** - One agent with all capabilities
2. **Workflow-based** - Fixed pipelines for each task type
3. **Multi-specialist with orchestration** - Multiple expert agents with intelligent routing

## Decision

We chose **10 specialist agents with an orchestrator**.

**Specialists:**
- `onboarding` - New customer setup, kickoff meetings, 30-60-90 day plans
- `adoption` - Product usage tracking, feature enablement, training
- `renewal` - Renewal management, expansion, commercial negotiations
- `risk` - At-risk detection, save plays, escalation management
- `strategic` - Executive relationships, QBRs, strategic planning
- `email` - Customer communications, drafting
- `meeting` - Scheduling, preparation, follow-ups
- `knowledge` - Playbook search, best practices, documentation
- `research` - Company research, stakeholder mapping, news
- `analytics` - Health scoring, usage metrics, trend analysis

**Routing via 4-tier orchestrator:**
1. Follow-up detection - Continue with current specialist if conversational
2. Keyword matching - Match input against specialist keywords
3. Context routing - Route by health score, renewal proximity
4. LLM routing - Claude decides if above methods unclear

**Handoffs:** Specialists can transfer to other specialists mid-conversation using `handoff_to_specialist` tool, passing context forward.

## Consequences

**Benefits:**
- Focused expertise - Each specialist has domain-specific prompts and tools
- Scalable - Add new specialists without bloating existing ones
- Debuggable - Easy to see which specialist handled what
- Better routing - Can tune routing per specialist

**Drawbacks:**
- Complexity - More moving parts than single agent
- Handoff latency - Transfers add ~2-3 seconds
- Context limits - History must be summarized when passing between agents

**DO NOT consolidate specialists** - The separation exists because CS tasks are genuinely different and benefit from focused prompts.

## Metadata
- **Subsystem:** agents/orchestrator, agents/specialists
- **Key files:**
  - `server/src/langchain/agents/orchestrator.ts` (routing logic)
  - `server/src/langchain/agents/specialists/index.ts` (specialist definitions)
  - `server/src/langchain/agents/specialists/*.ts` (individual specialists)
- **Related ADRs:** ADR-001, ADR-003
