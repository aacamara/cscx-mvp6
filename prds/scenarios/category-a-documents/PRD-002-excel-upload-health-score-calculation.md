# PRD-002: Excel Upload → Health Score Calculation

## Metadata
- **PRD ID**: PRD-002
- **Category**: A - Documents & Data Processing
- **Priority**: P0
- **Estimated Complexity**: Medium
- **Dependencies**: Health score calculation engine, usage_metrics table

## Scenario Description
A CSM receives an Excel file containing customer engagement metrics (login frequency, feature usage, support tickets, NPS scores) and wants to calculate or update health scores for multiple customers at once. The system parses the Excel file, maps data to existing customers, calculates health scores using the standard algorithm, and updates customer records.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload an Excel file with customer metrics and have health scores calculated automatically,
**So that** I can keep my portfolio health scores current without manual data entry.

## Trigger
CSM uploads an Excel file (.xlsx, .xls) via the Chat UI with a message like "Calculate health scores from this data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Health score calculation | `server/src/services/` | Implemented | Uses usage, engagement, sentiment signals |
| Health score history | `health_score_history` table | Implemented | Tracks score over time |
| Usage metrics storage | `usage_metrics` table | Implemented | Stores DAU, WAU, MAU, etc. |
| Excel parsing | Not implemented | Gap | No Excel file handler |
| Bulk customer update | Not implemented | Gap | Single customer updates only |

### What's Missing
- [ ] Excel file upload and parsing service (xlsx, xls support)
- [ ] Customer matching algorithm (by name, email, or ID)
- [ ] Batch health score recalculation endpoint
- [ ] Conflict resolution UI (when uploaded data differs from existing)
- [ ] Health score update preview before committing

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM uploads Excel file via Chat UI
**System Response**:
- Validates file type (xlsx, xls)
- Parses worksheets and displays available sheets
- Asks CSM to select the sheet containing customer data

### Step 2: Column Mapping
**User Action**: CSM selects worksheet
**System Response**:
- Displays detected columns
- Auto-maps common column names (Customer, Usage, NPS, etc.)
- Asks CSM to confirm or adjust mappings for health score components

### Step 3: Customer Matching
**User Action**: CSM confirms column mappings
**System Response**:
- Matches rows to existing customers in database
- Reports match statistics: "Matched 45/50 customers"
- Lists unmatched rows for review
- Asks how to handle unmatched (skip, create new, manual match)

### Step 4: Health Score Calculation
**User Action**: CSM approves customer matching
**System Response**:
- Calculates health score for each matched customer
- Shows before/after comparison
- Highlights significant changes (>10 point swing)
- Asks for confirmation before updating

### Step 5: Commit Updates
**User Action**: CSM approves updates
**System Response**:
- Updates health scores in customer records
- Creates health_score_history entries
- Triggers any configured alerts for score changes
- Displays summary report

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/fileUpload/excelParser.ts` | Parse Excel files (xlsx, xls) |
| `server/src/services/healthScore/batchCalculator.ts` | Batch health score calculation |
| `server/src/services/matching/customerMatcher.ts` | Match uploaded rows to customers |
| `components/FileUpload/ExcelUploader.tsx` | Excel upload UI component |
| `components/HealthScore/BatchUpdatePreview.tsx` | Preview health score changes |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/upload/excel` | POST | Upload and parse Excel file |
| `POST /api/upload/excel/map-columns` | POST | Confirm column mappings |
| `POST /api/customers/match` | POST | Match rows to existing customers |
| `POST /api/health-scores/batch-calculate` | POST | Calculate scores for multiple customers |
| `PUT /api/health-scores/batch-update` | PUT | Commit score updates |

### Database Changes
| Table | Change |
|-------|--------|
| `uploaded_files` | Track Excel uploads |
| `batch_operations` | Track batch update operations |
| `health_score_history` | Add `batch_operation_id` for traceability |

## Chat UI Flow
```
CSM: [Uploads Q4_customer_metrics.xlsx]
System: I've received your Excel file. It contains 3 worksheets:
1. "Customer Metrics" (50 rows)
2. "Summary" (1 row)
3. "Charts" (no data)

Which worksheet should I use for health score calculation?

CSM: Customer Metrics

System: Great! I found these columns in "Customer Metrics":
- Customer Name → Customer identifier ✓
- Monthly Logins → Usage signal ✓
- Feature Adoption % → Engagement signal ✓
- Support Tickets (Open) → Risk signal ✓
- NPS Score → Sentiment signal ✓
- Last Activity Date → Engagement signal ✓

Does this mapping look correct?

CSM: Yes, calculate health scores

System: Matching customers to your portfolio...

✅ Customer Matching Results:
- Matched: 45 customers
- Unmatched: 5 rows (names not found)

Unmatched rows:
1. "Acme Corporation" - Did you mean "Acme Corp"?
2. "Tech Startup LLC" - No similar match found
[... 3 more ...]

How would you like to handle unmatched rows?
[Skip All] [Match Manually] [Create New Customers]

CSM: Match "Acme Corporation" to "Acme Corp", skip the rest

System: Calculating health scores for 46 customers...

📊 Health Score Update Preview:

| Customer | Current | New | Change |
|----------|---------|-----|--------|
| Acme Corp | 72 | 68 | ⬇️ -4 |
| Beta Inc | 85 | 91 | ⬆️ +6 |
| **TechStart** | **78** | **52** | **⬇️ -26** ⚠️ |
| Delta Co | 65 | 67 | ⬆️ +2 |
[... 42 more ...]

⚠️ 3 customers have significant score changes (>15 points):
- TechStart: 78 → 52 (low feature adoption, high tickets)
- Omega LLC: 81 → 58 (no logins in 30 days)
- Zeta Corp: 45 → 71 (improved NPS from 2 to 8)

Would you like to apply these updates?

CSM: Yes, apply all updates

System: ✅ Health scores updated for 46 customers!

Summary:
- Scores increased: 22 customers
- Scores decreased: 18 customers
- Scores unchanged: 6 customers
- Average change: -2.3 points

🔔 Triggered alerts:
- TechStart added to at-risk watch list
- Omega LLC added to at-risk watch list

All changes logged to health score history.
```

## Acceptance Criteria
- [ ] System accepts .xlsx and .xls file formats up to 25MB
- [ ] Multi-sheet Excel files display sheet selection
- [ ] Column auto-mapping correctly identifies common metric names
- [ ] Customer matching uses fuzzy matching for name variations
- [ ] Health score calculation uses same algorithm as real-time calculation
- [ ] Preview shows before/after with clear change indicators
- [ ] Significant changes (configurable threshold) are highlighted
- [ ] All updates create proper audit trail in health_score_history
- [ ] Configured triggers fire for health score changes
- [ ] Error handling for corrupt Excel files with clear messaging

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-002-COMPLETE</promise>
```

### Success Metrics
- Processing time < 30 seconds for 500 rows
- Customer matching accuracy > 95%
- Zero data loss during batch updates
