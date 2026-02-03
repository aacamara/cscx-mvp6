# Ralph Loop & Compound Engineering Workflow Documentation

## Overview

This document outlines the complete workflow for implementing autonomous AI agent loops (Ralph) and compound engineering practices. It serves as both documentation and a reference guide that Claude CLI should consult before executing any Ralph-related operations.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Ralph Loop Fundamentals](#ralph-loop-fundamentals)
3. [Compound Engineering](#compound-engineering)
4. [Compound Product (Nightly Automation)](#compound-product-nightly-automation)
5. [Implementation Checklist](#implementation-checklist)
6. [Claude CLI Prompt Template](#claude-cli-prompt-template)
7. [Important Rules & Reminders](#important-rules--reminders)

---

## Core Concepts

### What is Ralph?

Ralph is a bash script-based autonomous loop that allows AI agents to work continuously on tasks without human intervention. It picks up tasks from a prioritized list, implements them, commits changes, and repeats until all tasks are complete.

### What is Compound Engineering?

Compound engineering is the practice of extracting learnings from each coding session and persisting them into your codebase documentation (AGENTS.md or CLAUDE.md files). This creates institutional memory that makes the agent smarter over time.

### The Compounding Stack

```
Level 1: Ralph Loop (Basic autonomous task execution)
    ↓
Level 2: Compound Engineering (Learning extraction during pairing)
    ↓
Level 3: Compound Product (Nightly automation with data-driven priorities)
    ↓
Level 4: Compound Learning (Automated daily review of all threads)
```

---

## Ralph Loop Fundamentals

### How Ralph Works

1. **PRD Creation**: You spend 60+ minutes planning and specifying what needs to be built
2. **Task Breakdown**: The PRD is converted to JSON with atomic user stories/tasks
3. **Acceptance Criteria**: Each task has clear, agent-verifiable acceptance criteria (no human-in-the-loop)
4. **Loop Execution**: The bash script calls the agent repeatedly
5. **Task Completion**: Agent picks a task, implements it, commits, updates status
6. **Progress Tracking**: Updates are written to progress.txt (medium-term memory)
7. **Learning Capture**: Important learnings are written to AGENTS.md files (long-term memory)
8. **PR Creation**: Once all tasks pass, a PR is created for review

### Critical Requirements for Tasks

- **Atomic**: Each task should be small and standalone
- **Self-contained**: Task should have enough context without needing other documents
- **Verifiable**: Acceptance criteria must be runnable by the agent
- **No human dependency**: The agent should be able to complete it without human input

### Memory Structure

| Memory Type | Location | Purpose |
|-------------|----------|---------|
| Long-term | AGENTS.md / CLAUDE.md files | Persistent learnings about the repo |
| Medium-term | progress.txt | Current Ralph loop state and progress |
| Short-term | Thread context | Current conversation context |

### AGENTS.md File Distribution

**IMPORTANT**: You should have nested AGENTS.md files throughout your repository, not just one at the root. Aim for 20-30+ files covering different areas of your codebase.

```
project/
├── AGENTS.md                    # Root-level project context
├── src/
│   ├── AGENTS.md                # Source code patterns
│   ├── components/
│   │   └── AGENTS.md            # Component conventions
│   └── utils/
│       └── AGENTS.md            # Utility function patterns
├── scripts/
│   └── AGENTS.md                # Script execution rules
└── tests/
    └── AGENTS.md                # Testing conventions
```

---

## Compound Engineering

### The Compound Engineering Skill

The compound engineering practice has sub-skills:
- **Plan**: Planning phase
- **Execute**: Implementation phase
- **Test**: Testing phase
- **Compound**: Learning extraction phase (most commonly used)

### When to Compound

- After hitting problems or gotchas during development
- When the agent makes mistakes that should be remembered
- At the end of each significant coding session
- When discovering patterns that would benefit future work

### What Gets Compounded

- Gotchas and edge cases discovered
- Mistakes the agent made and how to avoid them
- Patterns that worked well
- Context that future agents would need

### Manual Compound Trigger

At any point during pairing with your agent, you can say:

```
Is there any knowledge we should compound? Look for gotchas, mistakes,
or important patterns from this session and update the relevant AGENTS.md files.
```

---

## Compound Product (Nightly Automation)

### The Two-Part Nightly Loop

| Time | Job | Purpose |
|------|-----|---------|
| 10:30 PM | Compound Review | Reviews threads, extracts missed learnings, updates AGENTS.md |
| 11:00 PM | Auto-Compound | Pulls latest, picks #1 priority from data, implements, creates PR |

**Order matters**: Review runs first so the implementation job has the most up-to-date learnings.

### Compound Review Script

```bash
#!/bin/bash
# scripts/daily-compound-review.sh
# Runs BEFORE auto-compound.sh to update AGENTS.md with learnings

cd ~/projects/your-project

# Ensure we're on main and up to date
git checkout main
git pull origin main

# Use your agent CLI (amp or claude code)
claude "Load the compound-engineering skill. Look through and read each
thread from the last 24 hours. For any thread where we did NOT use the
Compound Engineering skill to compound our learnings at the end, do so now -
extract the key learnings from that thread and update the relevant AGENTS.md
files so we can learn from our work and mistakes. Commit your changes and
push to main."
```

### Auto-Compound Script (Simplified)

```bash
#!/bin/bash
# scripts/compound/auto-compound.sh

set -e
cd ~/projects/your-project
source .env.local

# Fetch latest (including tonight's AGENTS.md updates)
git fetch origin main
git reset --hard origin/main

# Find the latest prioritized report
LATEST_REPORT=$(ls -t reports/*.md | head -1)

# Analyze and pick #1 priority
ANALYSIS=$(./scripts/compound/analyze-report.sh "$LATEST_REPORT")
PRIORITY_ITEM=$(echo "$ANALYSIS" | jq -r '.priority_item')
BRANCH_NAME=$(echo "$ANALYSIS" | jq -r '.branch_name')

# Create feature branch
git checkout -b "$BRANCH_NAME"

# Create PRD and convert to tasks
claude "Load the prd skill. Create a PRD for: $PRIORITY_ITEM"
claude "Load the tasks skill. Convert the PRD to scripts/compound/prd.json"

# Run the Ralph execution loop
./scripts/compound/loop.sh 25

# Create PR
git push -u origin "$BRANCH_NAME"
gh pr create --draft --title "Compound: $PRIORITY_ITEM" --base main
```

### Data-Driven Priority Pipeline

```
Your Metrics (Postgres/Mixpanel/etc)
    ↓
Cron Job: Gather data into reports/{date}-report.md
    ↓
analyze-report.sh: Feed report to LLM, get prioritized tasks
    ↓
PRD Creation: Create PRD from top priority
    ↓
Task Breakdown: Convert to prd.json with user stories
    ↓
Ralph Loop: Execute until complete
    ↓
PR Created: Wake up to a draft PR
```

---

## Implementation Checklist

### Before Starting Ralph Loops

- [x] Multiple AGENTS.md files distributed throughout the repo (20-30+)
- [x] Clear documentation of project patterns and conventions
- [x] Git repository properly set up
- [x] Agent CLI configured (Claude Code)

### Before Each Ralph Loop

- [ ] Spend 60+ minutes on PRD/planning phase
- [ ] Ask agent multiple times: "Is there anything that's not clear?"
- [ ] Ensure tasks are atomic and self-contained
- [ ] Verify acceptance criteria are agent-verifiable
- [ ] Set max iterations flag if concerned about runaway loops

### After Each Ralph Loop

- [ ] Review the generated PR
- [ ] Check if compound engineering captured relevant learnings
- [ ] Verify AGENTS.md files were updated appropriately

### For Nightly Automation

- [ ] Set up launchd plist files for scheduled jobs
- [ ] Configure caffeinate to keep Mac awake during automation window
- [ ] Set up data collection for metrics/reports
- [ ] Create analyze-report.sh script for your specific metrics

---

## Claude CLI Prompt Template

Use this prompt when starting work on your project with Claude CLI:

```
# RALPH & COMPOUND ENGINEERING WORKFLOW

Before proceeding with any task, please acknowledge and follow these guidelines:

## Core Principles

1. **Always Check AGENTS.md Files First**
   - Read all relevant AGENTS.md files in the directory structure before making changes
   - These contain critical context and learned patterns
   - Location: Throughout the repo, not just root level

2. **Task Specification Requirements**
   - If I ask you to implement a feature without proper specification, STOP and ask me to clarify
   - Each task needs: clear scope, acceptance criteria, and context
   - Remind me to spend adequate time on planning (60+ min for significant features)

3. **Compound Engineering**
   - At the end of each significant session, offer to compound learnings
   - Look for: gotchas, mistakes, patterns, context for future work
   - Update the appropriate AGENTS.md file(s)
   - Commit these updates separately with clear commit messages

4. **Progress Tracking**
   - For Ralph loops, maintain progress.txt for medium-term memory
   - Update task status in prd.json as tasks complete
   - Commit progress updates

5. **Before Making Changes**
   - Always explain what you plan to do and why
   - Wait for my confirmation before executing significant changes
   - If something is unclear in the task, ask before proceeding

## When I Say "Set up Ralph"
1. Point me to the Ralph repo: https://github.com/snarktank/ralph
2. Help me create the skill in my project
3. Guide me through creating my first PRD
4. Help set up the bash script loop

## When I Say "Compound"
1. Review the current thread/session
2. Identify learnings, gotchas, and patterns
3. Determine which AGENTS.md file(s) should be updated
4. Present the proposed updates for my approval
5. Make the updates and commit

## When I Say "Start Ralph Loop"
1. Verify PRD exists and tasks are specified
2. Check that acceptance criteria are agent-verifiable
3. Confirm max iterations setting
4. Proceed with the loop

## Questions to Ask Me
- "Have we spent enough time specifying this feature? Is the PRD complete?"
- "Are there any acceptance criteria that require human verification?"
- "Should I compound the learnings from this session?"
- "Which AGENTS.md file should this learning go in?"

Please confirm you understand these guidelines before we proceed.
```

---

## Important Rules & Reminders

### Do's

✅ Spend 60+ minutes planning before kicking off Ralph loops
✅ Have 20-30+ AGENTS.md files distributed throughout your repo
✅ Make tasks atomic with clear, agent-verifiable acceptance criteria
✅ Use compound engineering to capture learnings after each session
✅ Run compound review BEFORE compound product in nightly automation
✅ Set max iterations flag to prevent runaway loops
✅ Use Git for safety (you can always revert)
✅ Get hands on keyboard and iterate—learning by doing

### Don'ts

❌ Don't try to use Ralph loop inside the agent (handoff doesn't work well)
❌ Don't have only one CLAUDE.md file at the root
❌ Don't skip the planning phase
❌ Don't create tasks that require human verification
❌ Don't hide learnings inside skills directories—use AGENTS.md
❌ Don't over-engineer token management (well-specified tasks are efficient)

### Key Insights

> "If you're not doing compound engineering, you will lose—you're not going to survive in this new world. The faster you can speed up your learning loop, the faster you're going to win and survive."

> "Ralph loops should really be something that you're like, 'Okay, we've specified something that's pretty hard, but the agent should be able to do it.'"

> "The PRD is almost for you to flesh out what is this feature. It will help you spot gaps where you haven't specified clearly enough."

> "Your AGENTS.md files become institutional memory. Your agent becomes an expert in your codebase."

---

## Resources

- **Ralph Repository**: https://github.com/snarktank/ralph
- **Compound Engineering Plugin**: https://github.com/EveryInc/compound-engineering-plugin
- **Compound Product**: https://github.com/snarktank/compound-product

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-28 | 1.0 | Initial documentation |

---

*This document should be reviewed and updated as you gain experience with the workflow. The compound engineering practice applies to this document as well—update it when you learn something new!*
