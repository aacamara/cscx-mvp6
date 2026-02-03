# Scripts - Agent Instructions

## Overview

Automation scripts for deployment, database operations, and AI agent loops (Ralph, Compound).

## Directory Structure

```
scripts/
├── AGENTS.md           # This file
├── ralph/              # Ralph autonomous loop
│   ├── ralph.sh       # Main loop script
│   ├── CLAUDE.md      # Agent instructions
│   └── prd.json.example
├── compound/           # Compound Product automation
│   ├── auto-compound.sh
│   ├── loop.sh
│   ├── analyze-report.sh
│   ├── AGENTS.md
│   └── CLAUDE.md
├── deploy-gcp.sh       # Cloud Run deployment
├── run-migration.js    # Database migrations
└── setup-supabase.sh   # Initial Supabase setup
```

## Ralph Loop

### Purpose
Autonomous AI agent loop that executes PRD tasks without human intervention.

### Usage
```bash
# From project root
./scripts/ralph/ralph.sh --tool claude 10

# Arguments:
# --tool claude|amp    Which AI CLI to use
# 10                   Max iterations (default: 10)
```

### How It Works
1. Reads `prd.json` for task list
2. Picks highest-priority task where `passes: false`
3. Calls AI agent to implement task
4. Runs quality checks (typecheck)
5. If checks pass: commits, marks task `passes: true`
6. Appends learnings to `progress.txt`
7. Repeats until all tasks pass or max iterations

### Creating prd.json
```bash
# 1. Create PRD markdown
# Ask Claude: "Load the prd skill. Create a PRD for [feature]"
# Output: tasks/prd-[feature-name].md

# 2. Convert to JSON
# Ask Claude: "Load the tasks skill. Convert tasks/prd-[feature-name].md to prd.json"
# Output: scripts/ralph/prd.json
```

## Compound Product

### Purpose
Nightly automation that reads reports, identifies priorities, and implements fixes.

### Usage
```bash
# Dry run (preview what it would do)
./scripts/compound/auto-compound.sh --dry-run

# Full run
./scripts/compound/auto-compound.sh

# Just run the loop (if prd.json already exists)
./scripts/compound/loop.sh 25
```

### Pipeline
```
reports/*.md → analyze-report.sh → PRD → tasks → loop.sh → PR
```

### Configuration
Edit `compound.config.json`:
```json
{
  "tool": "claude",
  "reportsDir": "./reports",
  "outputDir": "./scripts/compound",
  "qualityChecks": ["npx tsc --noEmit"],
  "maxIterations": 25,
  "branchPrefix": "compound/"
}
```

## Database Scripts

### run-migration.js
```bash
# Run pending migrations
node scripts/run-migration.js

# Applies all .sql files in database/migrations/
# in numeric order (001_*, 002_*, etc.)
```

### setup-supabase.sh
```bash
# Initial Supabase setup
./scripts/setup-supabase.sh

# Creates tables, indexes, RLS policies
# Only run once on new project
```

## Deployment

### deploy-gcp.sh
```bash
# Deploy to Cloud Run
./scripts/deploy-gcp.sh

# Steps:
# 1. Builds Docker image
# 2. Pushes to Container Registry
# 3. Deploys to Cloud Run
# 4. Sets environment variables
```

## Common Gotchas

### 1. Make scripts executable
```bash
chmod +x scripts/*.sh
chmod +x scripts/ralph/*.sh
chmod +x scripts/compound/*.sh
```

### 2. Run from project root
```bash
# ❌ BAD - wrong working directory
cd scripts/ralph && ./ralph.sh

# ✅ GOOD - from project root
./scripts/ralph/ralph.sh
```

### 3. Environment variables
```bash
# Ensure .env or .env.local is loaded
source .env.local
./scripts/compound/auto-compound.sh
```

### 4. Git state
```bash
# Ralph/Compound creates branches and commits
# Ensure you're on a clean branch before running
git status  # Should show no uncommitted changes
```

## Memory Files

### progress.txt
- Created during Ralph/Compound loops
- Contains learnings from each iteration
- Persists between agent contexts
- Location: `scripts/ralph/progress.txt` or `scripts/compound/progress.txt`

### AGENTS.md / CLAUDE.md
- Long-term memory for agent
- Update with patterns and gotchas discovered
- Agents read these before each iteration
