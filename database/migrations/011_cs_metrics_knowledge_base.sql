-- Migration: 011_cs_metrics_knowledge_base.sql
-- Description: Add comprehensive CS & ARR Metrics Framework to knowledge base
-- Created: 2026-01-22

-- ============================================
-- CS METRICS FRAMEWORK PLAYBOOKS
-- ============================================

-- 1. Revenue Metrics (MRR/ARR) Playbook
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'revenue', 'Revenue Metrics Framework (MRR/ARR)',
'Complete guide to calculating and tracking Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR) with all component breakdowns.',
$CONTENT$
# Revenue Metrics Framework (MRR/ARR)

## Monthly Recurring Revenue (MRR)

### Basic MRR Formula
MRR = Sum of all recurring revenue normalized to monthly basis
MRR = ARPU × Number of Active Subscribers

### MRR Components

| Component | Formula | Description |
|-----------|---------|-------------|
| **New MRR** | Sum of MRR from newly acquired customers | Revenue from new customers in the period |
| **Expansion MRR** | Sum of (Current MRR - Previous MRR) for upgraded accounts | Additional revenue from upsells, cross-sells, add-ons |
| **Contraction MRR** | Sum of (Previous MRR - Current MRR) for downgraded accounts | Revenue lost from downgrades, removed add-ons |
| **Churned MRR** | Sum of MRR from cancelled subscriptions | Revenue lost from customer cancellations |
| **Reactivation MRR** | Sum of MRR from previously churned customers returning | Revenue from win-back customers |

### Net New MRR Formula
Net New MRR = New MRR + Expansion MRR + Reactivation MRR - Contraction MRR - Churned MRR

### MRR Calculations for Different Billing Cycles
- Monthly subscription: MRR = Monthly_Price × Number_of_Customers
- Annual subscription: MRR = (Annual_Price / 12) × Number_of_Customers
- Quarterly subscription: MRR = (Quarterly_Price / 3) × Number_of_Customers
- Multi-year contract: MRR = (Total_Contract_Value / Total_Months) × Number_of_Customers

### MRR Growth Rate
MRR Growth Rate (%) = ((MRR_End - MRR_Start) / MRR_Start) × 100

### Expansion MRR Rate
Expansion MRR Rate (%) = (Expansion MRR / Beginning MRR) × 100

## Annual Recurring Revenue (ARR)

### Basic ARR Formula
ARR = MRR × 12

### Comprehensive ARR Formula
ARR = (Sum of subscription revenue for the year + Recurring revenue from add-ons/upgrades) - Revenue lost from cancellations and downgrades

### ARR Components
Beginning ARR + New ARR + Expansion ARR - Contraction ARR - Churned ARR = Ending ARR

### ARR from Different Contract Types
- Monthly contracts: ARR = MRR × 12
- Annual contracts: ARR = Sum of all annual contract values
- Multi-year contracts: ARR = Total_Contract_Value / Number_of_Years
- Quarterly contracts: ARR = Quarterly_Recurring_Revenue × 4

### Committed ARR (CARR)
CARR = ARR + Signed but not yet live contracts - Known future churns

## Average Revenue Per User/Account (ARPU/ARPA)

### ARPU Formula
ARPU = Total Revenue / Total Number of Active Users

### ARPA Formula
ARPA = Total Revenue / Total Number of Active Accounts

### Monthly ARPU
Monthly ARPU = MRR / Number of Active Customers

### Annual ARPU
Annual ARPU = ARR / Number of Active Customers
$CONTENT$,
ARRAY['revenue_tracking', 'arr_calculation', 'mrr_analysis', 'financial_reporting', 'expansion_tracking'],
ARRAY['mrr', 'arr', 'revenue', 'arpu', 'arpa', 'expansion', 'contraction', 'churn', 'metrics']);

-- 2. Retention Metrics Playbook
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'retention', 'Retention Metrics Framework (NRR/GRR)',
'Complete guide to Net Revenue Retention, Gross Revenue Retention, and churn metrics with benchmarks.',
$CONTENT$
# Retention Metrics Framework

## Net Revenue Retention (NRR) / Net Dollar Retention (NDR)

### NRR Formula
NRR (%) = ((Beginning MRR + Expansion MRR - Contraction MRR - Churned MRR) / Beginning MRR) × 100

### Alternative NRR Formula
NRR (%) = ((Ending MRR from existing customers) / Beginning MRR) × 100

### NRR Calculation Example
Beginning_MRR = $100,000
Expansion_MRR = $15,000
Contraction_MRR = $5,000
Churned_MRR = $8,000

NRR = (($100,000 + $15,000 - $5,000 - $8,000) / $100,000) × 100
NRR = ($102,000 / $100,000) × 100
NRR = 102%

### NRR Benchmarks
| Rating | NRR Range |
|--------|-----------|
| Excellent | >120% |
| Good | 100-120% |
| Fair | 90-100% |
| Poor | <90% |

## Gross Revenue Retention (GRR)

### GRR Formula
GRR (%) = ((Beginning MRR - Contraction MRR - Churned MRR) / Beginning MRR) × 100

### GRR Benchmarks
| Rating | GRR Range |
|--------|-----------|
| Excellent | >95% |
| Good | 90-95% |
| Fair | 85-90% |
| Poor | <85% |

**Key Difference: GRR can never exceed 100%, while NRR can exceed 100% with expansion.**

## Customer Retention Rate (CRR)

### CRR Formula
CRR (%) = ((Customers at End - New Customers) / Customers at Start) × 100

### Logo Retention Rate
Logo Retention Rate (%) = ((Total Customers at Start - Churned Customers) / Total Customers at Start) × 100

## Churn Metrics

### Customer Churn Rate
Customer Churn Rate (%) = (Customers Lost / Customers at Start of Period) × 100

### Revenue Churn Rate (Gross MRR Churn)
Gross MRR Churn Rate (%) = ((Churned MRR + Contraction MRR) / Beginning MRR) × 100

### Net MRR Churn Rate
Net MRR Churn Rate (%) = ((Churned MRR + Contraction MRR - Expansion MRR) / Beginning MRR) × 100

### Negative Churn (Net Negative Churn)
Achieved when: Expansion MRR > (Churned MRR + Contraction MRR)
Net Negative Churn (%) = Revenue_Churn% - Expansion_Revenue%

### Churn Benchmarks
| Metric | Good | Excellent |
|--------|------|-----------|
| Monthly Customer Churn | <1% | <0.5% |
| Annual Customer Churn | 5-7% | <5% |
| Gross MRR Churn (monthly) | <2% | <1% |
| Net MRR Churn | 0% or negative | Negative |
$CONTENT$,
ARRAY['retention_analysis', 'churn_prevention', 'revenue_retention', 'customer_retention', 'benchmarking'],
ARRAY['nrr', 'grr', 'retention', 'churn', 'ndr', 'logo_retention', 'metrics']);

-- 3. Customer Lifetime Value Playbook
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'ltv', 'Customer Lifetime Value & CAC Framework',
'Complete guide to calculating LTV, CAC, LTV:CAC ratio, and CAC payback period with benchmarks.',
$CONTENT$
# Customer Lifetime Value & Acquisition Framework

## Customer Lifetime Value (CLV/LTV)

### Basic LTV Formula
LTV = Average Revenue Per Customer × Average Customer Lifespan

### LTV with Gross Margin
LTV = (ARPA × Gross Margin %) / Churn Rate

### Monthly LTV Calculation
LTV = (Monthly ARPU × Gross Margin %) / Monthly Churn Rate

### LTV with Discount Rate
LTV = (ARPA × Gross Margin %) / (Churn Rate + Discount Rate)

### Detailed LTV Methods
Method 1 (Using churn): LTV = ARPU / Churn_Rate
Method 2 (Using retention): Average_Customer_Lifespan = 1 / Churn_Rate; LTV = ARPU × Average_Customer_Lifespan
Method 3 (Historical): LTV = Average_Purchase_Value × Average_Purchase_Frequency × Average_Customer_Lifespan

## Customer Acquisition Cost (CAC)

### Basic CAC Formula
CAC = Total Sales & Marketing Costs / Number of New Customers Acquired

### Fully Loaded CAC
CAC = (Marketing Costs + Sales Costs + Salaries + Tools + Overhead) / New Customers Acquired

### Blended vs Paid CAC
Blended CAC (includes organic): Total S&M Spend / All New Customers
Paid CAC (paid channels only): Paid Marketing Spend / Customers from Paid Channels

## LTV:CAC Ratio

### LTV:CAC Formula
LTV:CAC Ratio = Customer Lifetime Value / Customer Acquisition Cost

### LTV:CAC Benchmarks
| Ratio | Interpretation |
|-------|----------------|
| <1:1 | Unsustainable - losing money on each customer |
| 1:1 - 2:1 | Break-even to marginal |
| 3:1 | Healthy - industry standard target |
| 4:1 - 5:1 | Very efficient |
| >5:1 | May indicate underinvestment in growth |

## CAC Payback Period

### CAC Payback Formula
CAC Payback (months) = CAC / (Monthly ARPU × Gross Margin %)

### CAC Payback Benchmarks
| Rating | Payback Period |
|--------|---------------|
| Excellent | <6 months |
| Good | 6-12 months |
| Fair | 12-18 months |
| Poor | >18 months |
$CONTENT$,
ARRAY['ltv_calculation', 'cac_analysis', 'unit_economics', 'growth_planning', 'financial_modeling'],
ARRAY['ltv', 'cac', 'clv', 'payback', 'unit_economics', 'acquisition', 'metrics']);

-- 4. Customer Health Score Playbook
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'health', 'Customer Health Score Framework',
'Complete guide to building and calculating customer health scores with weighted components and categorization.',
$CONTENT$
# Customer Health Score Framework

## Health Score Formula

### Weighted Score Formula
Customer Health Score = Σ (Metric_Score × Metric_Weight)

### Detailed Calculation Example
Step 1: Define metrics and weights (must sum to 100%)
- product_usage: weight 0.30, score 85
- feature_adoption: weight 0.20, score 70
- support_tickets: weight 0.15, score 60 (inverted - lower is better)
- nps_score: weight 0.15, score 80
- engagement_score: weight 0.10, score 75
- csm_sentiment: weight 0.10, score 90

Step 2: Calculate weighted score
Health_Score = (85 × 0.30) + (70 × 0.20) + (60 × 0.15) + (80 × 0.15) + (75 × 0.10) + (90 × 0.10)
Health_Score = 25.5 + 14 + 9 + 12 + 7.5 + 9 = 77

### Action-Based Health Score
Health Score = Σ(Positive Action Values) - Σ(Negative Action Values)

Positive Actions Example:
- Feature usage (weight: 10) × 5 occurrences = +50
- Login frequency (weight: 3) × 20 occurrences = +60
- Support satisfaction (weight: 5) × 2 positive = +10

Negative Actions Example:
- Support tickets (weight: -5) × 3 = -15
- Login decline (weight: -8) × 1 = -8

Health Score = (50 + 60 + 10) - (15 + 8) = 97

## Health Score Categories

| Score Range | Category | Color | Action |
|-------------|----------|-------|--------|
| 0-30 | Critical | Red | Immediate intervention |
| 31-50 | At Risk | Orange | Proactive outreach |
| 51-70 | Neutral | Yellow | Monitor closely |
| 71-85 | Healthy | Light Green | Standard engagement |
| 86-100 | Champion | Green | Expansion opportunity |

## Health Score Components

### Product Usage Score
Usage Score = (Actual_Usage / Expected_Usage) × 100
Or: Usage Score = (DAU / Total_Users) × 100

### Feature Adoption Score
Feature_Adoption = (Features_Used / Total_Features_Available) × 100
Or: Feature_Adoption = (Users_Using_Core_Features / Total_Users) × 100

### License Utilization
License_Utilization = (Active_Seats / Purchased_Seats) × 100

### Engagement Score (Composite)
Engagement_Score = (Login_Frequency_Score × 0.25) + (Time_in_App_Score × 0.25) + (Feature_Depth_Score × 0.25) + (Integration_Usage_Score × 0.25)

### Support Health Component
Support_Score = 100 - ((Open_Tickets × 5) + (Avg_Resolution_Time_Days × 2) + (Escalations × 10))
$CONTENT$,
ARRAY['health_monitoring', 'risk_assessment', 'customer_segmentation', 'intervention_planning', 'csm_prioritization'],
ARRAY['health_score', 'customer_health', 'risk', 'adoption', 'engagement', 'metrics']);

-- 5. NPS/CSAT/CES Survey Framework
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'satisfaction', 'Customer Satisfaction Surveys (NPS/CSAT/CES)',
'Complete guide to Net Promoter Score, Customer Satisfaction Score, and Customer Effort Score with survey templates.',
$CONTENT$
# Customer Satisfaction Metrics Framework

## Net Promoter Score (NPS)

### NPS Formula
NPS = % Promoters - % Detractors

### Score Classification
| Score Range | Category | Description |
|-------------|----------|-------------|
| 9-10 | Promoters | Loyal enthusiasts who will refer others |
| 7-8 | Passives | Satisfied but vulnerable to competition |
| 0-6 | Detractors | Unhappy customers who may damage brand |

### NPS Calculation Example
Survey responses: 100 total
- Promoters (9-10) = 45
- Passives (7-8) = 35
- Detractors (0-6) = 20

NPS = (45/100 × 100) - (20/100 × 100) = 45% - 20% = +25

### NPS Benchmarks
- Above 0: Good
- Above 20: Great
- Above 50: Excellent
- Above 70: World-class

### Types of NPS Surveys

**Relational NPS (rNPS)**
- Question: "On a scale of 0-10, how likely are you to recommend [Company] to a friend or colleague?"
- Timing: Quarterly or bi-annually
- Purpose: Measure overall brand loyalty

**Transactional NPS (tNPS)**
- Question: "Based on your recent [interaction/purchase], how likely are you to recommend us?"
- Timing: Immediately after specific touchpoints
- Purpose: Measure experience at specific moments

**Employee NPS (eNPS)**
- Question: "On a scale of 0-10, how likely are you to recommend [Company] as a place to work?"
- Timing: Quarterly
- Purpose: Measure employee satisfaction

### NPS Follow-up Questions

For Promoters (9-10):
- "What do you love most about [Product]?"
- "What would make you even more likely to recommend us?"

For Passives (7-8):
- "What would we need to do to earn a higher score?"
- "What's holding you back from rating us higher?"

For Detractors (0-6):
- "We're sorry to hear that. What could we do better?"
- "What was the primary reason for your score?"

## Customer Satisfaction Score (CSAT)

### CSAT Formula
CSAT (%) = (Number of Satisfied Responses / Total Responses) × 100

### CSAT with 5-Point Scale
CSAT = (Count of 4s and 5s / Total Responses) × 100

### CSAT Survey Questions
Question: "How satisfied were you with [experience/product/service]?"
Scale Options:
- 5-point: Very Unsatisfied (1) to Very Satisfied (5)
- 7-point: Extremely Unsatisfied (1) to Extremely Satisfied (7)

### CSAT Benchmarks
| Rating | Score |
|--------|-------|
| Excellent | >90% |
| Good | 80-90% |
| Fair | 70-80% |
| Poor | <70% |

## Customer Effort Score (CES)

### CES Formula
CES = (Sum of All Scores / Number of Responses)
Or: CES (%) = (Number of Agree + Strongly Agree / Total Responses) × 100

### CES Survey Question
Statement: "[Company] made it easy for me to [complete task/resolve issue]."
Scale: 1 (Strongly Disagree) to 7 (Strongly Agree)

### CES Variations
- Support CES: "[Company] made it easy for me to resolve my issue today."
- Purchase CES: "It was easy to complete my purchase."
- Onboarding CES: "Getting started with [Product] was easy."
- Feature CES: "Using [Feature] to accomplish [Task] was easy."
$CONTENT$,
ARRAY['nps_surveys', 'csat_measurement', 'ces_tracking', 'voice_of_customer', 'satisfaction_monitoring'],
ARRAY['nps', 'csat', 'ces', 'survey', 'satisfaction', 'promoter', 'detractor', 'metrics']);

-- 6. Product Adoption Metrics Playbook
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'adoption', 'Product Adoption Metrics Framework',
'Complete guide to tracking product adoption, feature usage, activation rates, and stickiness metrics.',
$CONTENT$
# Product Adoption Metrics Framework

## Product Adoption Rate

### Product Adoption Formula
Product Adoption Rate (%) = (New Active Users / Total Sign-ups) × 100

### Alternative Formula
Adoption Rate = (Users Who Completed Activation / Total New Users) × 100

## Feature Adoption Rate

### Feature Adoption Formula
Feature Adoption Rate (%) = (Feature MAUs / Total Active Users) × 100

### Feature-Specific Adoption
Feature_Adoption = (Users_Using_Feature_X_Times / Total_Users_in_Segment) × 100

### Breadth of Adoption
Breadth = (Number of Features Used by User / Total Features Available) × 100

### Depth of Adoption
Depth = (Feature Usage Frequency / Expected Usage Frequency) × 100

## Time to Value (TTV)

### TTV Calculation
TTV = Time from Sign-up to First Value Milestone (Activation Point)

### TTV Metrics
- Average TTV: Sum(All_User_TTV) / Number_of_Users
- Median TTV: Middle_Value of sorted TTV list
- TTV by cohort: Average TTV for users in specific time period

## Daily/Monthly Active Users (DAU/MAU)

### DAU Formula
DAU = Count of unique users who performed qualifying action in a day

### MAU Formula
MAU = Count of unique users who performed qualifying action in a month

### DAU/MAU Ratio (Stickiness)
Stickiness (%) = (DAU / MAU) × 100

### Stickiness Benchmarks
| Rating | DAU/MAU Ratio |
|--------|---------------|
| Excellent | >25% |
| Good | 15-25% |
| Fair | 10-15% |
| Poor | <10% |

## Activation Rate

### Activation Rate Formula
Activation Rate (%) = (Users Reaching Activation Point / Total Sign-ups) × 100

### Activation Criteria Examples
Define activation based on key actions:
- created_first_project: true
- invited_team_member: true
- completed_onboarding: true
- used_core_feature: true

User activated when: All required criteria met OR threshold criteria met

## Benchmarks Quick Reference

| Metric | Poor | Fair | Good | Excellent |
|--------|------|------|------|-----------|
| DAU/MAU | <10% | 10-15% | 15-25% | >25% |
| Activation Rate | <20% | 20-40% | 40-60% | >60% |
| Feature Adoption | <30% | 30-50% | 50-70% | >70% |
| Time to Value | >14 days | 7-14 days | 3-7 days | <3 days |
$CONTENT$,
ARRAY['adoption_tracking', 'feature_analytics', 'activation_optimization', 'user_engagement', 'product_analytics'],
ARRAY['adoption', 'dau', 'mau', 'activation', 'ttv', 'stickiness', 'feature_usage', 'metrics']);

-- 7. Complete Metrics Reference
INSERT INTO csm_playbooks (category, subcategory, title, summary, content, use_cases, tags) VALUES
('metrics', 'reference', 'Complete CS Metrics Reference Guide',
'Quick reference guide with all Customer Success metrics formulas and benchmarks in one place.',
$CONTENT$
# Complete CS Metrics Reference Guide

## Summary of All Formulas

| Category | Metric | Formula |
|----------|--------|---------|
| **Revenue** | MRR | ARPU × Active Customers |
| | ARR | MRR × 12 |
| | Net New MRR | New + Expansion + Reactivation - Contraction - Churned |
| | ARPU | Total Revenue / Total Users |
| **Retention** | NRR | ((Start MRR + Expansion - Contraction - Churn) / Start MRR) × 100 |
| | GRR | ((Start MRR - Contraction - Churn) / Start MRR) × 100 |
| | Customer Churn Rate | (Lost Customers / Start Customers) × 100 |
| | Revenue Churn Rate | ((Churned + Contraction MRR) / Start MRR) × 100 |
| **LTV/CAC** | LTV | (ARPU × Gross Margin) / Churn Rate |
| | CAC | Total S&M Cost / New Customers |
| | LTV:CAC | LTV / CAC |
| | CAC Payback | CAC / (Monthly ARPU × Gross Margin) |
| **Health** | Health Score | Σ(Metric Score × Weight) |
| **NPS** | NPS | % Promoters - % Detractors |
| **CSAT** | CSAT | (Satisfied / Total) × 100 |
| **CES** | CES | Sum of Scores / Total Responses |
| **Adoption** | Product Adoption | (Active Users / Total Signups) × 100 |
| | Feature Adoption | (Feature Users / Total Active) × 100 |
| | DAU/MAU | (DAU / MAU) × 100 |
| | Activation Rate | (Activated / Signups) × 100 |

## Benchmarks Quick Reference

| Metric | Poor | Fair | Good | Excellent |
|--------|------|------|------|-----------|
| NRR | <90% | 90-100% | 100-120% | >120% |
| GRR | <85% | 85-90% | 90-95% | >95% |
| NPS | <0 | 0-20 | 20-50 | >50 |
| CSAT | <70% | 70-80% | 80-90% | >90% |
| LTV:CAC | <1:1 | 1:1-2:1 | 3:1 | >4:1 |
| CAC Payback | >18mo | 12-18mo | 6-12mo | <6mo |
| Monthly Churn | >2% | 1-2% | 0.5-1% | <0.5% |
| DAU/MAU | <10% | 10-15% | 15-25% | >25% |

## Health Score Categories

| Score | Category | Action |
|-------|----------|--------|
| 0-30 | Critical (Red) | Immediate intervention |
| 31-50 | At Risk (Orange) | Proactive outreach |
| 51-70 | Neutral (Yellow) | Monitor closely |
| 71-85 | Healthy (Light Green) | Standard engagement |
| 86-100 | Champion (Green) | Expansion opportunity |

## NPS Categories

| Score | Category | Action |
|-------|----------|--------|
| 9-10 | Promoter | Advocate program, referral asks |
| 7-8 | Passive | Improve experience, prevent churn |
| 0-6 | Detractor | Immediate outreach, save play |
$CONTENT$,
ARRAY['metrics_reference', 'quick_lookup', 'formula_guide', 'benchmarking', 'reporting'],
ARRAY['reference', 'formulas', 'benchmarks', 'metrics', 'cheatsheet']);

-- Update embeddings will need to be generated after this migration
-- Run: POST /api/playbooks/csm/generate-embeddings
