# PRD: Enhanced Customer Table with Rich Demo Data

## Overview
Expand the customer table in Dashboard > Customers to include comprehensive CSM metrics and populate with diverse demo data for analysis and demonstrations.

---

## Part 1: Enhanced Customer Table Columns

### Current Columns
- Customer Name
- ARR
- Health Score
- Status
- Renewal Date
- Workspace Links

### New Columns to Add

| Column | Description | Priority |
|--------|-------------|----------|
| **Industry** | Customer's industry vertical | High |
| **Tier/Segment** | Enterprise, Strategic, Commercial, SMB | High |
| **CSM** | Assigned CSM name | High |
| **Contract Start** | When customer signed | Medium |
| **Last Activity** | Days since last engagement | High |
| **NPS Score** | Net Promoter Score (-100 to 100) | High |
| **Product Adoption** | % of features adopted | High |
| **Open Tickets** | Support tickets open | Medium |
| **Expansion Potential** | Low/Medium/High | Medium |
| **Risk Level** | None/Low/Medium/High/Critical | High |
| **MRR** | Monthly Recurring Revenue | Medium |
| **Contacts** | Number of stakeholders | Low |

### Column Display Order (Left to Right)
1. Customer Name (with industry subtitle)
2. Tier
3. ARR / MRR
4. Health Score (visual bar)
5. NPS
6. Adoption %
7. Risk Level
8. Status
9. Last Activity
10. Renewal Date
11. CSM
12. Actions

---

## Part 2: Rich Demo Data (20+ Customers)

### Data Variety Requirements
- Multiple industries (Tech, Finance, Healthcare, Retail, Manufacturing, Media, Education)
- All status types (active, onboarding, at_risk, churned)
- ARR range from $15K to $800K
- Health scores from 25 to 98
- Mix of tiers (Enterprise, Strategic, Commercial, SMB)
- Various CSMs assigned
- Realistic company names
- Different renewal timelines (some overdue, some soon, some far out)

### Sample Data Set

```
| Company | Industry | Tier | ARR | Health | NPS | Adoption | Status | Risk |
|---------|----------|------|-----|--------|-----|----------|--------|------|
| Acme Global | Technology | Enterprise | $450K | 92 | 72 | 85% | active | None |
| TechStart Inc | SaaS | Commercial | $45K | 62 | 35 | 45% | active | Medium |
| Global Finance | Finance | Strategic | $680K | 38 | -15 | 30% | at_risk | Critical |
| HealthCare Plus | Healthcare | Commercial | $95K | 78 | 55 | 70% | active | Low |
| Retail Giants | Retail | Enterprise | $520K | 91 | 80 | 90% | active | None |
| DataFlow Systems | Technology | Strategic | $280K | 55 | 20 | 55% | at_risk | High |
| MediaMax Corp | Media | Commercial | $120K | 85 | 65 | 75% | active | Low |
| EduLearn Pro | Education | SMB | $28K | 70 | 45 | 60% | active | Medium |
| CloudNine Tech | Technology | Enterprise | $390K | 88 | 70 | 82% | active | None |
| SecureBank Ltd | Finance | Strategic | $550K | 42 | 5 | 40% | at_risk | High |
| FreshMart | Retail | Commercial | $85K | 75 | 50 | 65% | onboarding | Low |
| MedTech Solutions | Healthcare | Enterprise | $720K | 95 | 85 | 92% | active | None |
| StartupHub | SaaS | SMB | $18K | 60 | 30 | 50% | onboarding | Medium |
| ManufacturePro | Manufacturing | Strategic | $340K | 68 | 40 | 58% | active | Medium |
| StreamMedia | Media | Commercial | $150K | 80 | 60 | 72% | active | Low |
| FinanceFirst | Finance | Commercial | $110K | 48 | 10 | 35% | at_risk | High |
| LearnQuick | Education | SMB | $22K | 82 | 55 | 78% | active | None |
| RetailEdge | Retail | Strategic | $480K | 35 | -25 | 28% | churned | Critical |
| TechVentures | Technology | Commercial | $95K | 72 | 45 | 62% | active | Low |
| HealthFirst | Healthcare | Strategic | $410K | 89 | 75 | 88% | active | None |
```

---

## Files to Modify

1. **`components/Observability.tsx`** - Update Customer interface and table columns
2. **`server/src/routes/customers.ts`** - Update Customer type with new fields
3. **`database/seed-demo-data.ts`** (new) - Create demo data seeding script
4. **API or in-memory fallback** - Populate with demo data

---

## Acceptance Criteria

1. Customer table displays all new columns
2. Table is responsive (horizontal scroll on mobile)
3. All columns are sortable
4. 20+ demo customers with diverse data
5. Data supports meaningful analysis (health trends, ARR distribution, etc.)
6. Risk levels visually distinguished (color-coded badges)
