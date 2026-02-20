# CADG System (Context-Aware Document Generation)

## Overview

24 document types across 5 agents + 4 General Mode cards.

## Card Types by Agent

| Agent | Card Types |
|-------|------------|
| Onboarding | kickoff_plan, milestone_plan, stakeholder_map, training_schedule |
| Adoption | usage_analysis, feature_campaign, champion_development, training_program |
| Renewal | renewal_forecast, value_summary, expansion_proposal, negotiation_brief |
| Risk | risk_assessment, save_play, escalation_report, resolution_plan |
| Strategic | qbr_generation, executive_briefing, account_plan, transformation_roadmap |
| General Mode | portfolio_dashboard, team_metrics, renewal_pipeline, at_risk_overview |

## Task Classifier

- Phrase pattern matching (0.95 confidence)
- Keyword matching with synonym expansion
- Word-level fuzzy matching with stemming
- LLM fallback for ambiguous queries (Haiku 4.5)
- Contextual agent boosting (+0.15 for active agent's cards)

## Key Files

- `server/src/services/cadg/taskClassifier.ts` - Classification engine
- `server/src/services/cadg/contextAggregator.ts` - Context collection
- `server/src/services/cadg/reasoningEngine.ts` - LLM reasoning
- `server/src/services/cadg/planService.ts` - Plan generation
- `server/src/services/cadg/artifactGenerator.ts` - Document generation

## Adding New Card Types

New CADG card types require updates to:
1. `taskClassifier.ts` - Add classification patterns
2. `contextAggregator.ts` - Define context requirements
3. `reasoningEngine.ts` - Add reasoning template
