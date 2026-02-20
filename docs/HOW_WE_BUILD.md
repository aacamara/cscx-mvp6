# How We Build: The CSCX.AI Code Factory

> A solo founder's system for shipping production software where AI agents write and review 100% of the code.

---

## The Philosophy

CSCX.AI is built by one person and an army of agents. Every line of code — application logic, tests, CI configuration, documentation — is written by Claude Code. Humans steer. Agents execute.

This isn't "vibe coding." It's a disciplined system inspired by two sources:

1. **Ryan Carson's Code Factory** — a control-plane pattern where the repo itself enforces quality, not humans reviewing every line.
2. **OpenAI's Harness Engineering** — the methodology behind building a million-line codebase with zero manually-written code.

The core insight from both: **when agents write your code, the engineering work shifts from writing code to designing environments, specifying intent, and building feedback loops.**

When something breaks, the fix is never "try harder." The question is always: *what capability is missing, and how do we make it legible and enforceable for the agent?*

---

## The Loop

Every change flows through one loop:

```
Agent writes code
    → Repo classifies risk tier
        → Policy gate enforces required checks
            → Code review agent validates the PR
                → If findings → remediation agent auto-fixes
                    → Loop repeats until clean
                        → Evidence captured, findings become permanent harness cases
```

This loop is deterministic. It runs the same whether Aziz is awake or asleep. It treats every PR identically — no shortcuts for "quick fixes," no skipped reviews for "obvious changes."

---

## The Contract

Everything starts with one file: `.github/risk-policy.json`.

This is the machine-readable contract. Every CI job, every review tool, every remediation agent reads from this single source of truth. It defines three tiers:

**Critical** — Authentication, org isolation, database migrations. These paths protect customer data across tenants. A mistake here means data leaks between organizations. Every change requires: code review, human approval, passing tests, clean TypeScript, and browser evidence proving the flow works.

**High** — AI agents, LangChain integration, CADG document generation, API routes, infrastructure files. These paths affect how the system behaves. Changes require: code review, passing tests, and clean TypeScript. No human approval needed — the automated reviewers are sufficient.

**Low** — UI components, hooks, styles, documentation. These paths are internal. They still get reviewed and tested, but with lighter scrutiny.

The default for any unclassified file is **high**. We err on the side of caution.

---

## Risk-Aware Code Review

CodeRabbit reviews every PR with path-specific instructions that mirror the risk tiers. When it sees a change to `server/src/middleware/auth.ts`, it knows to verify that every code path sets `organizationId`, that no bypass paths exist, and that the Supabase service_role key is never exposed.

When it sees a change to `server/src/middleware/orgFilter.ts`, it verifies that `applyOrgFilter` is used consistently and that no raw queries bypass the filtering.

This isn't generic AI review. The review instructions encode our specific domain knowledge about multi-tenant isolation, agent approval policies, and CADG system boundaries.

---

## Delta-Only Enforcement

CSCX.AI has ~1,200 pre-existing TypeScript errors. They're legacy debt from rapid prototyping. We don't pretend they don't exist, and we don't let them block progress.

Instead, we enforce a simple rule: **no new errors in changed files.**

Every PR runs TypeScript and ESLint only on the files that were modified. If you touch `CustomerDetail.tsx` and introduce a type error, the PR fails. If `CustomerDetail.tsx` already had 5 errors before your change, those are ignored.

This creates a ratchet effect. Over time, every touched file gets cleaner. The codebase heals itself as agents work through it.

---

## The Remediation Loop

When CodeRabbit flags an issue or the delta checks fail, Claude Code automatically attempts to fix it:

1. Read the review comments and CI failure logs
2. Fix the actual issue (never suppress with `@ts-ignore`)
3. Run local validation
4. Push a fix commit to the same PR branch

The fix commit triggers the loop again — CI re-runs, CodeRabbit re-reviews, the policy gate re-evaluates. If everything passes, bot-only review threads auto-resolve.

Humans may review pull requests, but aren't required to for high and low tier changes. Over time, we push more review effort toward being handled agent-to-agent.

**Guardrails on the remediation agent:**
- It can only read/write files and run specific commands (tsc, eslint, tests)
- It cannot modify policy files or workflow configurations
- It has a 10-minute timeout to prevent runaway costs
- It uses Sonnet (not Opus) for cost efficiency

---

## Browser Evidence

For critical-tier changes — auth flows, org isolation, database migrations — we require machine-verifiable proof that the feature works.

Playwright captures screenshots and writes structured evidence manifests:

```json
{
  "capturedAt": "2026-02-20T14:30:00Z",
  "tier": "critical",
  "flow": "auth",
  "steps": [
    {
      "step": 1,
      "action": "navigate to /",
      "screenshot": "auth-01-initial-load.png",
      "timestamp": 1740060600000
    }
  ],
  "apiCalls": [
    { "url": "/api/customers", "status": 200 }
  ]
}
```

This isn't just screenshots in PR text. It's CI assertions: required flows exist, expected entrypoints were used, expected account identity is present for logged-in flows, artifacts are fresh and valid.

Over time, this builds a library of working-state evidence — invaluable for investor demos and regression detection.

---

## Harness Gap Loop

Every production bug becomes a permanent test case. This is non-negotiable.

The flow:
1. Bug found in production → file a `harness-gap` issue with reproduction steps and proposed test
2. Fix PR must reference the issue (`closes #N`)
3. CI verifies the PR includes a test file change
4. If no test → the PR cannot merge

This keeps fixes from becoming one-off patches. The system gets smarter with every incident. Coverage grows organically from real-world failures, not arbitrary percentage targets.

---

## Knowledge Architecture

The repository is the system of record. If it's not in the repo, it doesn't exist for agents.

We learned from OpenAI's mistake with "one big AGENTS.md." Context is scarce. A giant instruction file crowds out the task. Too much guidance becomes non-guidance. It rots instantly.

Instead, CLAUDE.md is the **table of contents** (~100 lines). It tells agents where to look:

```
CLAUDE.md          → Map (project overview, tech stack, key commands)
docs/
├── architecture/  → Domain map, agent system, multi-tenancy, CADG
├── design-docs/   → Design decisions (versioned)
├── exec-plans/    → Active and completed execution plans
├── product-specs/ → Product requirements
├── quality/       → Quality grades per domain
├── security/      → Auth flow, org isolation rules
└── references/    → External API docs
```

This enables progressive disclosure: agents start with a small, stable entry point and discover deeper context as needed.

We enforce this mechanically. A weekly cleanup agent scans for stale documentation that doesn't match code behavior and opens fix-up PRs.

---

## Enforcing Architecture, Not Implementations

Agents work best with strict boundaries and predictable structure. We enforce invariants, not specific implementations.

**What we enforce mechanically:**
- Every route file imports auth middleware (custom linter with remediation instructions in error messages)
- Every database query uses `applyOrgFilter` for org scoping
- Every new migration includes `organization_id` on new tables
- No `@ts-ignore` or `@ts-expect-error` in changed files
- Agent actions respect the HITL approval matrix

**What we leave to agent discretion:**
- How a feature is implemented within those boundaries
- Which React patterns to use for UI components
- How test assertions are structured
- Code style within the lint rules

When documentation falls short, we promote the rule into code. A lint rule beats a written guideline every time.

---

## Garbage Collection

Full agent autonomy introduces drift. Agents replicate patterns that already exist — even suboptimal ones.

Instead of manual cleanup, we run a weekly garbage collection agent that:
1. Scans for org filtering gaps (routes missing `applyOrgFilter`)
2. Checks for stale documentation
3. Identifies unused imports and dead code
4. Opens targeted fix PRs with `chore(cleanup):` prefix

Technical debt is a high-interest loan. It's better to pay it down continuously in small increments than to let it compound. Human taste is captured once, then enforced continuously on every line of code.

---

## The Stack

| Layer | Tool | Role |
|-------|------|------|
| Coding agent | Claude Code | Writes all code, fixes review findings |
| Code review | CodeRabbit | AI-powered PR review with path-specific instructions |
| Risk classification | GitHub Actions + risk-policy.json | Classifies PRs by risk tier |
| Delta enforcement | Custom bash scripts | Fails only on NEW TypeScript/lint errors |
| Browser evidence | Playwright | Machine-verifiable proof for critical flows |
| Remediation | claude-code-action | Auto-fixes review findings and CI failures |
| Garbage collection | Weekly Claude Code workflow | Continuous cleanup and doc gardening |
| Harness gaps | Issue template + CI enforcement | Every bug becomes a test case |

---

## What This Means for CSCX.AI

As a solo founder building an AI-native Customer Success platform, this system is the difference between "I can't ship fast enough" and "I ship while I sleep."

The risk tiers protect what matters most — multi-tenant data isolation, authentication, and the AI agent system that powers the product. The remediation loop means most issues get fixed automatically. The harness gap loop means every production bug makes the system permanently smarter.

The agents don't just write code. They review it, fix it, prove it works, and clean up after themselves.

**Humans steer. Agents execute. The repo enforces the rules.**

---

## Principles to Remember

1. **Map, not manual** — Keep CLAUDE.md short. Point to structured docs.
2. **Enforce invariants, not implementations** — Strict boundaries, local autonomy.
3. **Agent failures = missing capabilities** — When the agent struggles, the fix is never "try harder." Ask: what's missing?
4. **Custom lint errors = remediation instructions** — Error messages tell agents how to fix.
5. **Garbage collection beats spring cleaning** — Continuous small cleanup over periodic painful bursts.
6. **Repository = system of record** — Slack messages and Google Docs are invisible to agents.
7. **Delta enforcement over perfection** — Fix what you touch. Ignore what you don't.
8. **Every bug is a test case** — The harness gap loop is non-negotiable.
9. **Evidence is machine-verifiable** — Screenshots in PR text aren't evidence. CI assertions are.
10. **The loop is the product** — The Code Factory itself compounds in value with every PR.

---

*Built with Claude Code. Reviewed by CodeRabbit. Enforced by the repo.*

*Inspired by [Ryan Carson's Code Factory](https://x.com/ryancarson/status/2023452909883609111) and [OpenAI's Harness Engineering](https://openai.com/index/harness-engineering/).*
