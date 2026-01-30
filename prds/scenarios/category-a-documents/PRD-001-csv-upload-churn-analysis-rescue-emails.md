# PRD-001: CSV Upload → Churn Analysis → Rescue Emails

## Metadata
- **PRD ID**: PRD-001
- **Category**: A - Documents & Data Processing
- **Priority**: P0
- **Estimated Complexity**: High
- **Dependencies**: Gmail integration, AI analysis engine, trigger system

## Scenario Description
A CSM receives a CSV export of customer usage data or health indicators and wants to quickly identify accounts at risk of churning. The system analyzes the data, flags at-risk accounts based on configurable thresholds, and drafts personalized rescue emails for each flagged account.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload a CSV of customer data and have the system identify churn risks and draft rescue emails,
**So that** I can proactively intervene with at-risk accounts before they churn.

## Trigger
CSM uploads a CSV file via the Chat UI with a message like "Analyze this customer data for churn risk and draft rescue emails for anyone at risk."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Risk signal detection | `server/src/services/` | Partial | Detects signals but not from CSV uploads |
| Churn prediction | CAPABILITIES_INVENTORY.md | Basic | Based on existing signals, not uploaded data |
| Email drafting | Gmail service + Communicator agent | Implemented | Can draft emails with approval |
| CSV parsing | Not implemented | Gap | No file upload handler for CSVs |
| Bulk email generation | Not implemented | Gap | Single email only |

### What's Missing
- [ ] CSV file upload endpoint for Chat UI
- [ ] CSV parsing and validation service
- [ ] Churn risk scoring algorithm for uploaded data
- [ ] Batch email generation with personalization
- [ ] Preview UI for multiple draft emails
- [ ] Bulk approval workflow for multiple emails

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM drags and drops CSV file into Chat UI or clicks upload button
**System Response**:
- Validates file type (CSV only)
- Parses CSV headers and displays column summary
- Asks CSM to confirm column mappings (customer name, usage metric, etc.)

### Step 2: Data Analysis
**User Action**: CSM confirms column mappings
**System Response**:
- AI analyzes each row against churn indicators
- Calculates risk score (0-100) per customer
- Flags accounts with risk score > threshold (default 70)
- Displays summary: "Found 12 accounts at high churn risk out of 150 total"

### Step 3: Draft Generation
**User Action**: CSM requests "Draft rescue emails for the high-risk accounts"
**System Response**:
- Generates personalized email for each flagged account
- Uses customer context (name, usage patterns, specific concerns)
- Displays email previews in expandable cards
- Shows "Approve All" and individual approve/edit buttons

### Step 4: Send with Approval
**User Action**: CSM reviews, edits if needed, and approves emails
**System Response**:
- Creates pending approvals for each email (HITL)
- Sends approved emails via Gmail
- Logs all activities to customer timeline
- Reports: "Sent 12 rescue emails successfully"

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/fileUpload/csvParser.ts` | Parse and validate CSV uploads |
| `server/src/services/analysis/churnScoring.ts` | Calculate churn risk from uploaded data |
| `server/src/routes/upload.ts` | File upload endpoint |
| `components/FileUpload/CSVUploader.tsx` | UI component for CSV upload |
| `components/EmailPreview/BulkEmailPreview.tsx` | Preview multiple draft emails |
| `server/src/agents/specialists/dataAnalyst.ts` | New agent for data analysis tasks |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/upload/csv` | POST | Upload and parse CSV file |
| `POST /api/analysis/churn-risk` | POST | Analyze data for churn risk |
| `POST /api/emails/bulk-draft` | POST | Generate multiple draft emails |
| `POST /api/approvals/bulk` | POST | Approve multiple actions at once |

### Database Changes
| Table | Change |
|-------|--------|
| `uploaded_files` | New table for tracking uploads |
| `bulk_operations` | New table for tracking batch operations |
| `risk_signals` | Add `source_file_id` foreign key |

## Chat UI Flow
```
CSM: [Uploads customer_usage_q4.csv]
System: I've received your CSV file with 150 rows and 8 columns. I detected these fields:
- Customer Name (column A)
- Monthly Active Users (column B)
- Login Frequency (column C)
- Last Login Date (column D)
- Support Tickets (column E)

Does this mapping look correct? I'll use this to analyze churn risk.

CSM: Yes, analyze for churn risk

System: Analyzing 150 accounts...

[Analysis Complete]
📊 Churn Risk Summary:
- High Risk (70-100): 12 accounts
- Medium Risk (40-69): 28 accounts
- Low Risk (0-39): 110 accounts

Key patterns detected:
- 8 accounts haven't logged in for 30+ days
- 4 accounts have declining MAU trend
- 3 accounts have open escalated tickets

Would you like me to draft rescue emails for the 12 high-risk accounts?

CSM: Yes, draft rescue emails

System: [Generates 12 email previews]

I've drafted 12 personalized rescue emails. Each email addresses the specific risk factors for that customer:

1. **Acme Corp** - Focus: No login for 45 days
   Subject: "We miss you at [Product]..."
   [Preview] [Edit] [Approve]

2. **TechStart Inc** - Focus: 60% MAU decline
   Subject: "Let's get your team back on track..."
   [Preview] [Edit] [Approve]

[... 10 more ...]

[Approve All] [Edit All]

CSM: [Clicks Approve All]

System: ✅ 12 emails queued for sending. All sent successfully!

Activities logged for each customer.
```

## Acceptance Criteria
- [ ] CSM can upload CSV files up to 10MB via Chat UI
- [ ] System correctly parses CSV with various encodings (UTF-8, ISO-8859-1)
- [ ] Column mapping UI allows CSM to confirm or adjust field detection
- [ ] Churn risk scoring produces consistent results for same data
- [ ] Each draft email is personalized with specific risk factors
- [ ] Bulk approval creates individual approval records for audit trail
- [ ] All sent emails are logged to respective customer timelines
- [ ] Error handling for malformed CSVs with clear user feedback
- [ ] Progress indicator during analysis and email generation

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-001-COMPLETE</promise>
```

### Success Metrics
- Time from upload to emails sent < 5 minutes
- CSM edits required < 20% of generated emails
- Churn risk accuracy validated against actual churn > 70%
