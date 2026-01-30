# PRD-025: Bulk Contact Upload → Data Enrichment

## Metadata
- **PRD ID**: PRD-025
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Stakeholder management, external data APIs

## Scenario Description
A CSM uploads a bulk list of contacts (from a CRM export, event list, or spreadsheet) and the system enriches the data with additional information (titles, LinkedIn profiles, company context), deduplicates against existing records, identifies key stakeholders, and updates the stakeholder database.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload a list of contacts and have them enriched and deduplicated,
**So that** I can maintain accurate stakeholder records without manual research.

## Trigger
CSM uploads contact list via Chat UI with a message like "Enrich and import these contacts."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Stakeholders table | `stakeholders` | Implemented | Stores contacts |
| Contract stakeholder extraction | Contract parsing | Implemented | Extracts from PDFs |
| Stakeholder mapping | Account plans | Partial | Basic relationship data |
| Duplicate detection | Not implemented | Gap | No deduplication |

### What's Missing
- [ ] Bulk contact upload endpoint
- [ ] Data enrichment service integration
- [ ] Duplicate detection algorithm
- [ ] Contact merge workflow
- [ ] LinkedIn profile lookup
- [ ] Role/persona classification
- [ ] Contact quality scoring

## Detailed Workflow

### Step 1: Contact Upload
**User Action**: CSM uploads contact list
**System Response**:
- Accepts CSV/Excel with contact data
- Parses fields: name, email, company, title, phone
- Associates with customer records
- Reports: "Found 156 contacts for 23 customers"

### Step 2: Deduplication
**User Action**: System processes automatically
**System Response**:
- Checks against existing stakeholder records
- Identifies exact matches and potential duplicates
- Shows merge candidates
- Reports: "Found 34 new contacts, 89 existing, 33 potential duplicates"

### Step 3: Data Enrichment
**User Action**: CSM requests enrichment
**System Response**:
- Looks up additional data (LinkedIn, company info)
- Validates and standardizes data
- Classifies personas/roles
- Calculates contact quality score

### Step 4: Import & Merge
**User Action**: CSM reviews and confirms
**System Response**:
- Creates new stakeholder records
- Merges duplicates per CSM selection
- Updates existing records with new data
- Links to customer records

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/contacts/bulkParser.ts` | Parse contact uploads |
| `server/src/services/contacts/deduplicator.ts` | Duplicate detection |
| `server/src/services/contacts/enricher.ts` | Data enrichment |
| `components/Contacts/ImportWizard.tsx` | Import workflow UI |
| `components/Contacts/MergeResolver.tsx` | Duplicate resolution |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/contacts/upload` | POST | Upload contact list |
| `POST /api/contacts/deduplicate` | POST | Find duplicates |
| `POST /api/contacts/enrich` | POST | Enrich contact data |
| `POST /api/contacts/import` | POST | Import confirmed contacts |

### Enrichment Data Points
| Data Point | Source | Description |
|------------|--------|-------------|
| Full Title | LinkedIn/Clearbit | Complete job title |
| LinkedIn URL | LinkedIn | Profile link |
| Company Size | Clearbit | Employee count |
| Industry | Clearbit | Company industry |
| Seniority | Derived | Executive/Manager/IC |
| Department | Derived | From title keywords |
| Contact Score | Calculated | Data quality rating |

## Chat UI Flow
```
CSM: [Uploads event_attendees_conference_2026.xlsx] Enrich and import these contacts

System: 📊 Processing contact list...

**Upload Summary:**
- Total contacts: 156
- Customers matched: 23 (from email domains)
- Unknown companies: 12

Checking for duplicates...

---

**🔄 Deduplication Results**

| Status | Count | Action |
|--------|-------|--------|
| ✅ New Contacts | 34 | Ready to import |
| ✅ Existing (unchanged) | 67 | No action needed |
| ✅ Existing (updateable) | 22 | New data available |
| ⚠️ Potential Duplicates | 33 | Review needed |

---

**⚠️ Duplicate Review Required**

**Potential Duplicates (Top 5):**

1. **Sara Chen** vs **Sarah Chen**
   | Field | Uploaded | Existing |
   |-------|----------|----------|
   | Email | sara.chen@acme.com | sarah.chen@acme.com |
   | Title | VP Operations | VP of Operations |
   | Phone | (555) 123-4567 | (555) 123-4567 |

   Confidence: 95% same person
   [Merge] [Keep Both] [Skip]

2. **Mike Johnson** vs **Michael Johnson**
   | Field | Uploaded | Existing |
   |-------|----------|----------|
   | Email | mike.j@acme.com | m.johnson@acme.com |
   | Title | IT Director | Director of IT |
   | Phone | None | (555) 234-5678 |

   Confidence: 88% same person
   [Merge] [Keep Both] [Skip]

[... 31 more duplicates ...]

[Auto-Merge High Confidence (>90%)] [Review All] [Skip Duplicates]

CSM: Auto-merge high confidence and enrich all contacts

System: ✅ Auto-merging 18 high-confidence duplicates...

Now enriching 34 new contacts + 22 updateable...

---

**✨ Enrichment Results**

**Enrichment Success Rate: 89%**

| Data Point | Found | Not Found |
|------------|-------|-----------|
| LinkedIn URL | 48 | 8 |
| Full Title | 52 | 4 |
| Seniority Level | 54 | 2 |
| Department | 51 | 5 |
| Company Info | 56 | 0 |

---

**👤 New Contacts Summary**

**By Seniority:**
| Level | Count | Examples |
|-------|-------|----------|
| Executive (C/VP) | 8 | CEO, VP Sales, CTO |
| Director | 12 | IT Director, Director of CS |
| Manager | 9 | Product Manager, CS Manager |
| Individual | 5 | Developer, Analyst |

**By Customer:**
| Customer | New Contacts | Key Additions |
|----------|--------------|---------------|
| Acme Corp | 5 | CEO John Smith, CTO Amy Park |
| TechStart | 4 | VP Engineering, Product Lead |
| CloudMax | 3 | Head of IT, Security Lead |
| [20 more...] | 22 | Various |

---

**🌟 High-Value Contacts Identified**

| Contact | Title | Customer | Opportunity |
|---------|-------|----------|-------------|
| John Smith | CEO | Acme Corp | Exec sponsor candidate |
| Amy Park | CTO | Acme Corp | Technical decision maker |
| Lisa Wong | VP Sales | TechStart | Cross-sell opportunity |
| David Chen | CFO | CloudMax | Renewal decision maker |

**Recommendation:** These executives were not in your records - prioritize relationship building.

---

**📊 Contact Quality Scores**

| Quality Level | Count | Description |
|---------------|-------|-------------|
| ⭐⭐⭐⭐⭐ Complete | 32 | All fields present |
| ⭐⭐⭐⭐ Good | 18 | Missing 1 field |
| ⭐⭐⭐ Fair | 6 | Missing 2+ fields |
| ⭐⭐ Basic | 0 | Name and email only |

---

**📋 Import Summary**

Ready to import:
- 34 new contacts
- 22 updates to existing contacts
- 18 merged duplicates

[Confirm Import] [Review Before Import] [Export Changes]

CSM: Confirm import

System: ✅ Import Complete!

**Results:**
- ✅ 34 new stakeholders created
- ✅ 22 existing stakeholders updated
- ✅ 18 duplicates merged
- ⏭️ 15 duplicates skipped (require manual review)
- ❌ 0 errors

---

**📌 Key Actions Recommended:**

1. **New Executive Contacts** (4 found)
   Consider scheduling introductions:
   - John Smith (CEO, Acme Corp) - [Create task]
   - Amy Park (CTO, Acme Corp) - [Create task]
   - Lisa Wong (VP Sales, TechStart) - [Create task]
   - David Chen (CFO, CloudMax) - [Create task]

2. **Manual Duplicate Review** (15 pending)
   These require your decision:
   - [Review duplicates]

3. **Missing Data** (8 contacts)
   Could not enrich:
   - [View contacts] [Research manually]

---

All contacts linked to customer records. Stakeholder database updated!
```

## Acceptance Criteria
- [ ] Supports CSV/Excel contact uploads up to 5,000 records
- [ ] Correctly parses various name formats
- [ ] Matches contacts to customers by email domain
- [ ] Identifies duplicates using fuzzy matching
- [ ] Provides confidence scores for duplicate detection
- [ ] Enriches with LinkedIn profiles where available
- [ ] Classifies seniority and department from titles
- [ ] Calculates contact quality scores
- [ ] Handles merge/skip decisions gracefully
- [ ] Creates proper audit trail for imports
- [ ] Processing completes within 2 minutes for 500 contacts

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-025-COMPLETE</promise>
```

### Success Metrics
- Contact enrichment success rate > 80%
- Duplicate detection accuracy > 90%
- Time saved vs manual entry > 75%
- Stakeholder database quality score improvement > 20%
