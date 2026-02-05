# PRD: CADG Fuzzy/Semantic Trigger Matching

## Problem
Currently, the CADG task classifier requires near-exact keyword matches. If a user types "I need to put together something for the quarterly review" instead of "create a QBR", the system fails to classify it correctly. The LLM fallback exists but the confidence thresholds and flow aren't optimized.

## Current Architecture
The classifier has 3 layers in `server/src/services/cadg/taskClassifier.ts`:
1. **Phrase patterns** (regex) - 0.95 confidence
2. **Keyword matching** (`query.includes()`) - capped at 0.9
3. **LLM fallback** (Claude Haiku) - only called when confidence < 0.5

### The Problem
- Keywords require exact substring match: "kickoff plan" matches but "put together a plan for our kickoff" may not
- The LLM fallback uses an older model (`claude-3-haiku-20240307`)
- The confidence threshold (0.5) for LLM fallback is too high — many partial matches score 0.5-0.7 and skip the LLM
- No word stemming or fuzzy string matching
- No synonym expansion

## Solution

### 1. Enhanced Keyword Matching with Word-Level Fuzzy Logic
Instead of exact `query.includes(keyword)`, use tokenized word matching with:
- Individual word matching (not just exact phrase)
- Levenshtein distance for typo tolerance (1-2 character edits)
- Word stemming (e.g., "forecasting" → "forecast", "planned" → "plan")
- Stop word removal before matching

### 2. Synonym Expansion Layer
Add a synonym map that expands queries before matching:
```typescript
const SYNONYMS: Record<string, string[]> = {
  'create': ['make', 'build', 'generate', 'put together', 'draft', 'prepare', 'write', 'set up', 'design'],
  'plan': ['strategy', 'roadmap', 'blueprint', 'playbook', 'approach', 'framework'],
  'review': ['assessment', 'evaluation', 'analysis', 'audit', 'check', 'overview'],
  'meeting': ['call', 'session', 'sync', 'standup', 'discussion', 'conversation'],
  'customer': ['client', 'account', 'company', 'organization', 'prospect'],
  'risk': ['danger', 'threat', 'concern', 'issue', 'problem', 'warning'],
  'renewal': ['contract', 'subscription', 'license', 'agreement'],
  // ... more synonyms for each domain
};
```

### 3. Lower LLM Fallback Threshold
- Drop from 0.5 to 0.3 confidence threshold
- Always use LLM when confidence < 0.7 (double-check ambiguous matches)
- Upgrade to `claude-haiku-4-5-20251001` for better classification

### 4. Intent Detection Pre-Processing
Before keyword matching, detect the user's intent category:
- **Generative**: "create", "build", "generate", "make", "prepare"
- **Analytical**: "analyze", "assess", "evaluate", "show me"
- **Informational**: "what is", "tell me about", "explain"

This narrows the search space and improves accuracy.

### 5. Contextual Boosting
If the user is on a specific agent (e.g., Onboarding), boost confidence for that agent's card types by +0.15.

## Files to Modify
- `server/src/services/cadg/taskClassifier.ts` - Main classifier logic

## Test Cases
These should ALL classify correctly:

### Kickoff Plan
- "I need to prepare something for our first meeting with the new client"
- "let's set up the kickoff"
- "can you help me plan the intro call"
- "prepare the welcome meeting materials"

### QBR
- "I need to get ready for the quarterly review"
- "put together the business review deck"
- "time to do the QBR"
- "prep materials for our Q2 meeting"

### Risk Assessment
- "this account doesn't look good, can you check it"
- "I'm worried about this customer churning"
- "evaluate the health of this account"
- "are there any red flags here"

### Value Summary
- "show them what we've delivered"
- "quantify the ROI for the renewal discussion"
- "put together a summary of our impact"
- "what value have they gotten from us"

### General variations
- "I think we should do a risk check" → risk_assessment
- "prep for the exec meeting" → executive_briefing
- "show me my book of business" → portfolio_dashboard
- "which customers need help" → at_risk_overview
