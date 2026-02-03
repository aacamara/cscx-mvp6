# PRD: Demo Customer Data Seeding

## Overview
Seed the database with realistic customer data that enables meaningful QBR generation and agent demonstrations.

## Problem Statement
Current demo lacks sufficient customer data to:
1. Generate realistic QBRs with actual metrics and trends
2. Demonstrate agent capabilities (risk detection, health analysis, etc.)
3. Show meaningful knowledge base integration
4. Display credible stakeholder information

## User Stories

### US-001: Create demo customers seed migration
- Create database/migrations/060_demo_customers.sql
- Insert 5 demo customers with varying profiles:
  - "Acme Corporation" - Healthy enterprise, $450K ARR
  - "TechStart Inc" - At-risk startup, $85K ARR
  - "Global Logistics" - Expansion opportunity, $320K ARR
  - "HealthFirst Medical" - New customer (onboarding), $150K ARR
  - "RetailMax" - Churning signals, $200K ARR
- Each customer has complete profile data
- Typecheck passes

### US-002: Seed health score history
- Create database/migrations/061_demo_health_scores.sql
- Insert 90 days of health score history for each demo customer
- Acme: stable 75-82 range
- TechStart: declining from 70 to 45
- Global Logistics: improving from 60 to 78
- HealthFirst: new, starting at 65
- RetailMax: volatile, recent drop to 52
- Typecheck passes

### US-003: Seed stakeholder contacts
- Create database/migrations/062_demo_stakeholders.sql
- Insert 3-5 stakeholders per customer
- Include: name, title, email, role (champion/sponsor/user), engagement_level
- Acme: strong champion, engaged sponsor
- TechStart: champion left (marked inactive), new contact
- Global Logistics: multiple champions across departments
- HealthFirst: single point of contact (risk)
- RetailMax: disengaged sponsor, frustrated users
- Typecheck passes

### US-004: Seed engagement metrics
- Create database/migrations/063_demo_engagement.sql
- Insert DAU/MAU, feature adoption, login frequency data
- 30 days of daily metrics per customer
- Metrics correlate with health score trends
- Include feature-level adoption percentages
- Typecheck passes

### US-005: Seed knowledge base articles
- Create database/migrations/064_demo_knowledge.sql
- Insert 10-15 knowledge base articles:
  - QBR best practices
  - Churn prevention playbook
  - Expansion conversation guide
  - Risk signal detection guide
  - Stakeholder mapping methodology
  - Onboarding checklist
  - Health score interpretation
- Tag articles with relevant categories and keywords
- Typecheck passes

### US-006: Seed agent activity history
- Create database/migrations/065_demo_agent_activities.sql
- Insert sample agent activities for demo customers
- Include: emails sent, meetings scheduled, tasks completed
- Show agent recommendations and outcomes
- Provide conversation history samples
- Typecheck passes

## Acceptance Criteria
1. 5 demo customers with complete profiles visible in UI
2. Health score charts show realistic trends
3. QBR generation uses real customer data and produces meaningful content
4. Agent risk detection identifies TechStart and RetailMax as at-risk
5. Knowledge base search returns relevant articles

## Priority
P1 - Required for demo

## Dependencies
- Database schema exists
- Knowledge base table exists
