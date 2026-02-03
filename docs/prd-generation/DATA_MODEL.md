# CSCX.AI Data Model

> Complete database schema and entity relationships

---

## 1. Core Entities

### 1.1 Customers
**Table**: `customers`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Customer/company name |
| `arr` | NUMERIC | Annual Recurring Revenue |
| `industry` | TEXT | Industry classification |
| `stage` | TEXT | Lifecycle stage (prospect, onboarding, active, at_risk, churned) |
| `health_score` | INTEGER | Current health score (0-100) |
| `csm_id` | UUID | Assigned CSM user ID |
| `salesforce_id` | TEXT | Salesforce account ID |
| `hubspot_id` | TEXT | HubSpot company ID |
| `segment` | TEXT | Customer segment |
| `renewal_date` | DATE | Next renewal date |
| `metadata` | JSONB | Additional custom fields |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Indexes**: `name`, `stage`

---

### 1.2 Stakeholders
**Table**: `stakeholders`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `name` | TEXT | Stakeholder name |
| `role` | TEXT | Job title/role |
| `email` | TEXT | Email address |
| `phone` | TEXT | Phone number |
| `linkedin_url` | TEXT | LinkedIn profile |
| `is_primary` | BOOLEAN | Primary contact flag |
| `sentiment` | TEXT | Relationship sentiment |
| `notes` | TEXT | Additional notes |
| `metadata` | JSONB | Custom fields |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships**: Many-to-one with `customers`
**Indexes**: `customer_id`, `email`

---

### 1.3 Contracts
**Table**: `contracts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `file_url` | TEXT | Uploaded file URL |
| `file_name` | TEXT | Original filename |
| `raw_text` | TEXT | Extracted raw text |
| `company_name` | TEXT | Extracted company name |
| `arr` | NUMERIC | Contract ARR |
| `contract_term` | TEXT | Term description |
| `start_date` | DATE | Contract start date |
| `end_date` | DATE | Contract end date |
| `status` | TEXT | Contract status (active, expired, etc.) |
| `parsed_data` | JSONB | AI-extracted structured data |
| `pricing_terms` | JSONB | Pricing structure |
| `technical_requirements` | JSONB | Technical requirements |
| `missing_info` | JSONB | Identified missing info |
| `next_steps` | JSONB | Recommended next steps |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships**: Many-to-one with `customers`
**Indexes**: `customer_id`, `status`

---

### 1.4 Entitlements
**Table**: `entitlements`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `contract_id` | UUID | FK to contracts |
| `name` | TEXT | Entitlement name |
| `description` | TEXT | Description |
| `quantity` | INTEGER | Quantity/units |
| `unit` | TEXT | Unit of measure |
| `price` | NUMERIC | Price per unit |
| `category` | TEXT | Category classification |
| `metadata` | JSONB | Custom fields |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Relationships**: Many-to-one with `contracts`
**Indexes**: `contract_id`

---

## 2. Agent System Entities

### 2.1 Agent Sessions
**Table**: `agent_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `user_id` | UUID | CSM user ID |
| `status` | TEXT | Session status (active, completed, failed) |
| `active_agent` | TEXT | Currently active agent |
| `deployed_agents` | TEXT[] | List of deployed agents |
| `context` | JSONB | Session context data |
| `created_at` | TIMESTAMPTZ | Session start |
| `updated_at` | TIMESTAMPTZ | Last activity |
| `ended_at` | TIMESTAMPTZ | Session end |

**Relationships**: Many-to-one with `customers`
**Indexes**: `customer_id`, `status`

---

### 2.2 Agent Messages
**Table**: `agent_messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to agent_sessions |
| `agent_id` | TEXT | Agent identifier |
| `role` | TEXT | Message role (user, assistant, system) |
| `content` | TEXT | Message content |
| `thinking` | BOOLEAN | Is thinking/internal |
| `requires_approval` | BOOLEAN | Needs HITL approval |
| `deployed_agent` | TEXT | Which agent generated |
| `tool_calls` | JSONB | Tool invocations |
| `metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Relationships**: Many-to-one with `agent_sessions`
**Indexes**: `session_id`, `created_at`

---

### 2.3 Agent Activity Log
**Table**: `agent_activity_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `user_id` | UUID | CSM user ID |
| `agent_type` | VARCHAR(50) | Agent type |
| `action_type` | VARCHAR(100) | Action performed |
| `action_data` | JSONB | Input parameters |
| `result_data` | JSONB | Output results |
| `status` | VARCHAR(20) | Status (completed, failed, etc.) |
| `error_message` | TEXT | Error details |
| `started_at` | TIMESTAMPTZ | Start time |
| `completed_at` | TIMESTAMPTZ | Completion time |
| `duration_ms` | INTEGER | Duration in ms |
| `session_id` | VARCHAR(100) | Session identifier |
| `parent_action_id` | UUID | Parent action (for nesting) |

**Indexes**: `customer_id`, `agent_type`, `session_id`

---

### 2.4 Chat Messages
**Table**: `chat_messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers (optional) |
| `user_id` | TEXT | User identifier |
| `role` | TEXT | Message role |
| `content` | TEXT | Message content |
| `agent_type` | TEXT | Agent that responded |
| `tool_calls` | JSONB | Tool invocations |
| `session_id` | TEXT | Chat session ID |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Indexes**: `customer_id`, `session_id`, `user_id`

---

## 3. Approvals & HITL

### 3.1 Approvals
**Table**: `approvals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to agent_sessions |
| `agent_id` | TEXT | Requesting agent |
| `action` | TEXT | Action type |
| `details` | TEXT | Action details |
| `status` | TEXT | Status (pending, approved, rejected) |
| `resolved_by` | UUID | User who resolved |
| `resolved_at` | TIMESTAMPTZ | Resolution timestamp |
| `comment` | TEXT | Reviewer comment |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Indexes**: `session_id`, `status`

---

### 3.2 Google Pending Approvals
**Table**: `google_pending_approvals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User ID |
| `agent_type` | TEXT | Agent type |
| `action_type` | TEXT | Google action type |
| `action_data` | JSONB | Action parameters |
| `preview_data` | JSONB | Preview for UI |
| `customer_id` | UUID | FK to customers |
| `status` | TEXT | Approval status |
| `decided_by` | TEXT | Approver ID |
| `decided_at` | TIMESTAMPTZ | Decision timestamp |
| `decision_note` | TEXT | Approver note |
| `expires_at` | TIMESTAMPTZ | Expiration time |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Indexes**: `user_id`, `status`

---

## 4. Customer Intelligence

### 4.1 Usage Metrics
**Table**: `usage_metrics`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `metric_date` | DATE | Metric date |
| `dau` | INTEGER | Daily Active Users |
| `wau` | INTEGER | Weekly Active Users |
| `mau` | INTEGER | Monthly Active Users |
| `login_count` | INTEGER | Total logins |
| `api_calls` | INTEGER | API usage |
| `session_duration_avg` | INTEGER | Avg session (minutes) |
| `active_users` | INTEGER | Unique active users |
| `feature_adoption` | JSONB | Feature usage map |
| `usage_trend` | VARCHAR(20) | Trend direction |
| `adoption_score` | INTEGER | Adoption score (0-100) |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Unique Constraint**: `(customer_id, metric_date)`
**Indexes**: `customer_id + metric_date`, `usage_trend`

---

### 4.2 Usage Events
**Table**: `usage_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `event_type` | TEXT | Event type |
| `user_id` | TEXT | End-user identifier |
| `timestamp` | TIMESTAMPTZ | Event timestamp |
| `metadata` | JSONB | Event data |
| `created_at` | TIMESTAMPTZ | Ingestion timestamp |

**Indexes**: `customer_id + timestamp`

---

### 4.3 Risk Signals
**Table**: `risk_signals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `signal_type` | VARCHAR(50) | Type of risk signal |
| `severity` | VARCHAR(20) | Severity level |
| `description` | TEXT | Signal description |
| `detected_at` | TIMESTAMPTZ | Detection timestamp |
| `resolved_at` | TIMESTAMPTZ | Resolution timestamp |
| `resolution_notes` | TEXT | Resolution details |
| `auto_detected` | BOOLEAN | System vs manual |
| `source` | VARCHAR(50) | Signal source |
| `metadata` | JSONB | Additional data |

**Indexes**: `customer_id`, `severity`, unresolved signals

---

### 4.4 Health Score History
**Table**: `health_score_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `score` | INTEGER | Health score |
| `components` | JSONB | Score breakdown |
| `recorded_at` | TIMESTAMPTZ | Recording timestamp |

**Indexes**: `customer_id + recorded_at`

---

## 5. Renewal & Expansion

### 5.1 Renewal Pipeline
**Table**: `renewal_pipeline`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `renewal_date` | DATE | Renewal date |
| `current_arr` | DECIMAL | Current ARR |
| `proposed_arr` | DECIMAL | Proposed ARR |
| `probability` | INTEGER | Win probability (0-100) |
| `stage` | VARCHAR(50) | Pipeline stage |
| `risk_factors` | JSONB | Risk factors array |
| `expansion_potential` | DECIMAL | Expansion value |
| `champion_engaged` | BOOLEAN | Champion engagement status |
| `exec_sponsor_engaged` | BOOLEAN | Exec sponsor status |
| `qbr_completed` | BOOLEAN | QBR done |
| `value_summary_sent` | BOOLEAN | Value summary sent |
| `proposal_sent` | BOOLEAN | Proposal sent |
| `verbal_commit` | BOOLEAN | Verbal commitment |
| `contract_signed` | BOOLEAN | Contract signed |
| `notes` | TEXT | Notes |
| `owner_id` | UUID | Owner CSM |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**: `renewal_date`, `stage`, `customer_id`

---

### 5.2 Expansion Opportunities
**Table**: `expansion_opportunities`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `opportunity_type` | VARCHAR(50) | Type (upsell, cross-sell, etc.) |
| `product_line` | VARCHAR(100) | Product/service |
| `estimated_value` | DECIMAL | Estimated value |
| `probability` | INTEGER | Win probability |
| `stage` | VARCHAR(50) | Pipeline stage |
| `champion_id` | UUID | FK to stakeholders |
| `use_case` | TEXT | Use case description |
| `competitive_threat` | VARCHAR(100) | Competitive info |
| `timeline` | VARCHAR(50) | Expected timeline |
| `blockers` | JSONB | Blocker array |
| `next_steps` | TEXT | Next actions |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**: `customer_id`, `stage`

---

### 5.3 Save Plays
**Table**: `save_plays`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `playbook_id` | UUID | FK to playbooks |
| `status` | VARCHAR(50) | Status |
| `risk_level` | VARCHAR(20) | Risk level |
| `primary_issue` | TEXT | Main issue |
| `root_cause` | TEXT | Root cause |
| `action_plan` | JSONB | Action items |
| `success_criteria` | TEXT | Success definition |
| `deadline` | DATE | Target deadline |
| `owner_id` | UUID | Owner CSM |
| `escalation_level` | INTEGER | Escalation tier |
| `outcome` | VARCHAR(50) | Final outcome |
| `outcome_notes` | TEXT | Outcome details |
| `arr_at_risk` | DECIMAL | ARR at risk |
| `arr_saved` | DECIMAL | ARR saved |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `closed_at` | TIMESTAMPTZ | Closure timestamp |

**Indexes**: `customer_id`, `status`, `risk_level`

---

## 6. Meetings & Intelligence

### 6.1 Meetings
**Table**: `meetings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `session_id` | UUID | FK to agent_sessions |
| `title` | TEXT | Meeting title |
| `description` | TEXT | Description |
| `scheduled_at` | TIMESTAMPTZ | Scheduled time |
| `duration` | INTEGER | Duration (minutes) |
| `status` | TEXT | Status |
| `meeting_url` | TEXT | Video link |
| `calendar_event_id` | TEXT | Google Calendar ID |
| `attendees` | JSONB | Attendee list |
| `agenda` | JSONB | Agenda items |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**: `customer_id`, `scheduled_at`

---

### 6.2 Transcripts
**Table**: `transcripts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `meeting_id` | UUID | FK to meetings |
| `content` | TEXT | Transcript text |
| `duration` | INTEGER | Duration (seconds) |
| `speakers` | JSONB | Speaker list |
| `word_count` | INTEGER | Word count |
| `language` | TEXT | Language code |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Indexes**: `meeting_id`

---

### 6.3 Meeting Analyses
**Table**: `meeting_analyses`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `meeting_id` | TEXT | Meeting identifier |
| `customer_id` | UUID | FK to customers |
| `summary` | TEXT | Meeting summary |
| `overall_sentiment` | TEXT | Sentiment (positive/neutral/negative/mixed) |
| `sentiment_score` | INTEGER | Sentiment score |
| `action_items` | JSONB | Extracted action items |
| `commitments` | JSONB | Commitments made |
| `follow_ups` | JSONB | Follow-up tasks |
| `risk_signals` | JSONB | Risk signals detected |
| `risk_level` | TEXT | Overall risk level |
| `expansion_signals` | JSONB | Expansion signals |
| `expansion_potential` | TEXT | Expansion potential |
| `stakeholder_insights` | JSONB | Stakeholder insights |
| `competitor_mentions` | JSONB | Competitor mentions |
| `confidence` | INTEGER | Analysis confidence |
| `analyzed_at` | TIMESTAMPTZ | Analysis timestamp |

**Indexes**: `customer_id`, `analyzed_at`

---

## 7. QBRs & Account Plans

### 7.1 QBRs
**Table**: `qbrs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `quarter` | VARCHAR(10) | Quarter (Q1 2026, etc.) |
| `scheduled_date` | DATE | Scheduled date |
| `completed_date` | DATE | Completion date |
| `status` | VARCHAR(50) | Status |
| `attendees` | JSONB | Attendee list |
| `exec_sponsor_attended` | BOOLEAN | Exec attendance |
| `presentation_url` | TEXT | Slides URL |
| `recording_url` | TEXT | Recording URL |
| `summary` | TEXT | QBR summary |
| `wins` | JSONB | Achievements |
| `challenges` | JSONB | Challenges |
| `action_items` | JSONB | Action items |
| `nps_score` | INTEGER | NPS at time of QBR |
| `health_score_at_qbr` | INTEGER | Health score at QBR |
| `expansion_discussed` | BOOLEAN | Expansion discussed |
| `renewal_discussed` | BOOLEAN | Renewal discussed |
| `created_by` | UUID | Creator user ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Indexes**: `customer_id`, `quarter`, `status`

---

### 7.2 Account Plans
**Table**: `account_plans`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to customers |
| `fiscal_year` | VARCHAR(10) | Fiscal year |
| `status` | VARCHAR(50) | Status |
| `strategic_objectives` | JSONB | Objectives |
| `success_metrics` | JSONB | Metrics |
| `stakeholder_map` | JSONB | Stakeholder relationships |
| `relationship_goals` | JSONB | Relationship objectives |
| `expansion_targets` | JSONB | Expansion targets |
| `risk_mitigation` | JSONB | Risk mitigation plans |
| `qbr_schedule` | JSONB | QBR schedule |
| `resource_allocation` | JSONB | Team assignments |
| `competitive_landscape` | TEXT | Competitive info |
| `notes` | TEXT | Notes |
| `owner_id` | UUID | Owner CSM |
| `approved_by` | UUID | Approver |
| `approved_at` | TIMESTAMPTZ | Approval timestamp |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Unique Constraint**: `(customer_id, fiscal_year)`
**Indexes**: `customer_id`, `fiscal_year`, `status`

---

## 8. Integrations & Tokens

### 8.1 Google Tokens
**Table**: `google_tokens`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User identifier |
| `access_token` | TEXT | OAuth access token |
| `refresh_token` | TEXT | OAuth refresh token |
| `token_type` | TEXT | Token type |
| `expires_at` | TIMESTAMPTZ | Token expiration |
| `scopes` | TEXT[] | Granted scopes |
| `email` | TEXT | Google email |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Unique Constraint**: `user_id`

---

### 8.2 Integrations
**Table**: `integrations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User identifier |
| `provider` | TEXT | Provider name (salesforce, hubspot) |
| `access_token` | TEXT | OAuth access token |
| `refresh_token` | TEXT | OAuth refresh token |
| `instance_url` | TEXT | Instance URL |
| `expires_at` | TIMESTAMPTZ | Token expiration |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Unique Constraint**: `(user_id, provider)`

---

### 8.3 Slack Connections
**Table**: `slack_connections`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | User identifier |
| `team_id` | TEXT | Slack team ID |
| `bot_token` | TEXT | Bot OAuth token |
| `user_token` | TEXT | User OAuth token |
| `scopes` | TEXT[] | Granted scopes |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Unique Constraint**: `user_id`

---

## 9. Knowledge & Playbooks

### 9.1 Knowledge Base
**Table**: `knowledge_base`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `title` | TEXT | Article title |
| `content` | TEXT | Article content |
| `category` | TEXT | Category |
| `tags` | TEXT[] | Tags array |
| `is_public` | BOOLEAN | Public visibility |
| `view_count` | INTEGER | View count |
| `helpful_count` | INTEGER | Helpful votes |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**: `category`, `tags` (GIN)

---

### 9.2 CSM Playbooks
**Table**: `csm_playbooks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `title` | TEXT | Playbook title |
| `category` | TEXT | Category |
| `content` | TEXT | Playbook content |
| `embedding` | VECTOR | Embedding vector |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Indexes**: `category`, vector similarity search

---

## 10. Automation & Triggers

### 10.1 Triggers
**Table**: `triggers`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | TEXT | Owner user ID |
| `customer_id` | UUID | FK to customers (null = global) |
| `name` | TEXT | Trigger name |
| `description` | TEXT | Description |
| `type` | TEXT | Trigger type |
| `condition` | JSONB | Trigger condition |
| `actions` | JSONB | Actions to execute |
| `cooldown_minutes` | INTEGER | Cooldown period |
| `max_fires_per_day` | INTEGER | Daily limit |
| `enabled` | BOOLEAN | Is enabled |
| `last_fired_at` | TIMESTAMPTZ | Last fire time |
| `fire_count` | INTEGER | Total fires |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

---

### 10.2 Trigger Events
**Table**: `trigger_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `trigger_id` | UUID | FK to triggers |
| `customer_id` | UUID | FK to customers |
| `event_type` | TEXT | Event type |
| `event_data` | JSONB | Event data |
| `actions_executed` | JSONB | Actions executed |
| `success` | BOOLEAN | Overall success |
| `error_message` | TEXT | Error message |
| `fired_at` | TIMESTAMPTZ | Fire timestamp |

---

### 10.3 Automations
**Table**: `automations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Automation name |
| `description` | TEXT | Description |
| `type` | TEXT | Automation type |
| `nl_description` | TEXT | Natural language description |
| `steps` | JSONB | Automation steps |
| `schedule` | JSONB | Schedule config |
| `trigger` | JSONB | Trigger config |
| `scope` | JSONB | Scope definition |
| `enabled` | BOOLEAN | Is enabled |
| `created_by` | TEXT | Creator user ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

---

## 11. Entity Relationship Diagram

```
                    ┌───────────────┐
                    │   customers   │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  stakeholders │   │   contracts   │   │  usage_metrics│
└───────────────┘   └───────┬───────┘   └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ entitlements  │
                    └───────────────┘

                    ┌───────────────┐
                    │   customers   │
                    └───────┬───────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│meetings│ │qbrs    │ │renewal_│ │risk_   │ │save_   │
│        │ │        │ │pipeline│ │signals │ │plays   │
└────┬───┘ └────────┘ └────────┘ └────────┘ └────────┘
     │
     ▼
┌────────────────┐
│  transcripts   │
└────────────────┘

                    ┌───────────────┐
                    │agent_sessions │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│agent_messages │   │   approvals   │   │chat_messages  │
└───────────────┘   └───────────────┘   └───────────────┘
```
