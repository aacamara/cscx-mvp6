# PRD: Predictive Analytics Dashboard

## Introduction

The Predictive Analytics Dashboard provides ML-powered insights for churn prediction, expansion opportunity scoring, and health forecasting. By analyzing historical patterns across usage, engagement, support tickets, and renewal outcomes, the system generates actionable predictions that help CSMs prioritize accounts and proactively address risks before they escalate.

This transforms CSCX from reactive (responding to signals) to proactive (predicting outcomes before they happen).

## Goals

- Predict customer churn risk with 80%+ accuracy 90 days in advance
- Score expansion opportunities based on likelihood and potential value
- Forecast health score trajectories for early intervention
- Surface leading indicators that drive predictions
- Enable CSMs to prioritize accounts based on predicted outcomes
- Provide explainable predictions (not black box)

## User Stories

### US-001: Churn prediction score
**Description:** As a CSM, I want to see a churn risk prediction for each customer so that I can prioritize at-risk accounts.

**Acceptance Criteria:**
- [ ] Churn risk score (0-100) displayed on customer card and detail page
- [ ] Risk category: Low (<30), Medium (30-60), High (>60)
- [ ] Prediction confidence level shown
- [ ] Trend indicator (increasing, stable, decreasing risk)
- [ ] Prediction updated daily
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Churn prediction factors
**Description:** As a CSM, I want to see the factors driving churn prediction so that I know what to address.

**Acceptance Criteria:**
- [ ] Top 5 factors contributing to churn risk
- [ ] Factor impact score (how much each factor affects prediction)
- [ ] Historical comparison (factor value vs healthy customer average)
- [ ] Actionable recommendations per factor
- [ ] Drill-down to underlying data
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Expansion opportunity scoring
**Description:** As a CSM, I want to see expansion opportunity scores so that I can focus on high-potential accounts.

**Acceptance Criteria:**
- [ ] Expansion score (0-100) per customer
- [ ] Estimated expansion potential (ARR value)
- [ ] Expansion type: upsell (more seats), cross-sell (new products), upgrade (higher tier)
- [ ] Readiness indicators (budget cycle, champion influence, usage patterns)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Health forecast chart
**Description:** As a CSM, I want to see health score forecasts so that I can anticipate future health trends.

**Acceptance Criteria:**
- [ ] 30/60/90 day health score forecast
- [ ] Confidence interval bands on forecast
- [ ] Historical trend line for context
- [ ] Key events overlay (renewal date, QBR, etc.)
- [ ] Scenario comparison (with/without intervention)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Predictions overview dashboard
**Description:** As a CS leader, I want a portfolio-level predictions dashboard so that I can see risk distribution across accounts.

**Acceptance Criteria:**
- [ ] ARR at risk (sum of ARR for high churn risk accounts)
- [ ] Expansion pipeline (sum of predicted expansion value)
- [ ] Risk distribution chart (customers by risk category)
- [ ] Top 10 at-risk accounts with drill-down
- [ ] Top 10 expansion opportunities with drill-down
- [ ] Predictions accuracy tracking (predicted vs actual outcomes)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Prediction alerts
**Description:** As a CSM, I want to be alerted when predictions change significantly so that I can respond quickly.

**Acceptance Criteria:**
- [ ] Alert when churn risk increases by >15 points in 7 days
- [ ] Alert when expansion score crosses threshold (>70)
- [ ] Alert when health forecast drops below renewal threshold
- [ ] Alerts appear in notification center and agent context
- [ ] Alert configurable thresholds per user
- [ ] Typecheck passes

### US-007: Model training pipeline
**Description:** As a system, I need to train prediction models on historical data so that predictions improve over time.

**Acceptance Criteria:**
- [ ] Nightly model retraining job
- [ ] Training data: 12+ months of usage, health, renewal outcomes
- [ ] Features: usage metrics, engagement, support tickets, health score history
- [ ] Model versioning with performance comparison
- [ ] Automatic rollback if new model underperforms
- [ ] Typecheck passes

### US-008: Prediction API for agents
**Description:** As an agent, I want to access prediction data so that I can incorporate forecasts into recommendations.

**Acceptance Criteria:**
- [ ] `get_churn_prediction(customer_id)` tool returns risk score and factors
- [ ] `get_expansion_score(customer_id)` tool returns opportunity details
- [ ] `get_health_forecast(customer_id, days)` tool returns trajectory
- [ ] Agents use predictions to prioritize recommendations
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Churn prediction model uses gradient boosting (XGBoost) on 50+ features
- FR-2: Features include: usage trends, engagement recency, support ticket sentiment, NPS, health score trajectory, contract value, time to renewal
- FR-3: Predictions stored in `predictions` table with customer_id, prediction_type, score, factors (JSONB), confidence, calculated_at
- FR-4: Model training runs nightly at 2 AM UTC, takes ~30 minutes
- FR-5: Expansion scoring uses separate model trained on expansion outcomes
- FR-6: Health forecast uses time series analysis (ARIMA or Prophet)
- FR-7: Prediction factors extracted using SHAP values for explainability
- FR-8: Alerts evaluated after prediction update, stored in `alerts` table
- FR-9: Historical predictions retained for accuracy tracking
- FR-10: Minimum 100 customers required for meaningful model training

## Non-Goals

- No real-time prediction updates (daily batch is sufficient)
- No custom model training per customer (one model fits all)
- No external data enrichment (company news, funding, etc.)
- No prescriptive actions (predictions inform, CSM decides)
- No revenue forecasting (that's a separate finance concern)

## Technical Considerations

- Consider Python microservice for ML model training/inference
- Use Cloud Run Jobs for nightly training pipeline
- Store model artifacts in Cloud Storage with versioning
- Consider BigQuery for historical feature aggregation
- SHAP values computation can be slow; cache factor explanations
- Start with simple logistic regression, upgrade to XGBoost once data volume sufficient

## Design Considerations

- Predictions should feel trustworthy (show confidence, explain factors)
- Risk scores should be visually prominent but not alarming
- Expansion opportunities should feel actionable (clear next steps)
- Dashboard should load fast (cache aggregations)
- Factor explanations should use plain language, not ML jargon

## Success Metrics

- Churn prediction accuracy >80% at 90-day horizon
- Expansion opportunity conversion rate >30% for high-score accounts
- CSM time to identify at-risk accounts reduced by 70%
- Retention rate for accounts with proactive intervention >90%

## Open Questions

- What minimum data history is needed before showing predictions?
- Should predictions be visible to customers in self-service portal?
- How to handle predictions for brand new customers (cold start)?
- Should we weight recent data more heavily than historical?
