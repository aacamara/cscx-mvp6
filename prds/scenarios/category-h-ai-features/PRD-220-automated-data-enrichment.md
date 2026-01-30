# PRD-220: Automated Data Enrichment

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-220 |
| **Title** | Automated Data Enrichment |
| **Category** | H: AI-Powered Features |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Customer and stakeholder records often have incomplete information. CSMs spend time manually researching company details, finding LinkedIn profiles, and gathering context. AI should automatically enrich records with publicly available data, keeping information current and reducing manual research time.

## User Stories

### Primary User Stories
1. **As a CSM**, I want new customers automatically enriched with company information (size, industry, funding, news).
2. **As a CSM**, I want stakeholder records enriched with LinkedIn data and professional background.
3. **As a CSM**, I want outdated information flagged and automatically updated.
4. **As a CSM**, I want to trigger enrichment on-demand for specific records.
5. **As a CSM**, I want to see data freshness and confidence scores.

### Secondary User Stories
1. **As a CSM**, I want alerts when significant company changes occur (acquisition, funding, layoffs).
2. **As a CSM**, I want competitive intelligence gathered automatically.
3. **As a CS Leader**, I want firmographic data for segmentation analysis.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic enrichment triggered on new customer/stakeholder creation
- [ ] Scheduled re-enrichment for existing records (weekly/monthly)
- [ ] On-demand enrichment via UI or command
- [ ] Data confidence scores indicating reliability
- [ ] Change tracking showing what was updated

### Customer Enrichment Fields
- [ ] Company size (employees)
- [ ] Industry classification (NAICS/SIC)
- [ ] Headquarters location
- [ ] Website URL
- [ ] Social media profiles
- [ ] Funding history (if startup)
- [ ] Recent news mentions
- [ ] Technology stack (if available)
- [ ] Key executives

### Stakeholder Enrichment Fields
- [ ] LinkedIn profile URL
- [ ] Current title (verified)
- [ ] Previous companies
- [ ] Education
- [ ] Tenure at company
- [ ] Professional interests/skills
- [ ] Mutual connections
- [ ] Recent LinkedIn activity

## Technical Specification

### Architecture

```
Trigger (New Record/Schedule/Manual) → Enrichment Queue → Data Providers → AI Consolidation → Database Update → Notification
```

### Data Providers

#### 1. Company Data Sources
- **Clearbit** - Company firmographics
- **Crunchbase** - Funding, investors, news
- **LinkedIn Company Pages** - Employee count, industry
- **News APIs** - Recent mentions
- **Website Scraping** - Technology detection

#### 2. Person Data Sources
- **LinkedIn** (via Sales Navigator API or scraping)
- **Clearbit Prospector**
- **Email verification services
- **Social media profiles**

### Enrichment Pipeline

```typescript
interface EnrichmentRequest {
  entity_type: 'customer' | 'stakeholder';
  entity_id: string;
  priority: 'high' | 'normal' | 'low';
  requested_fields?: string[];
  source_hints?: {
    domain?: string;
    email?: string;
    linkedin_url?: string;
  };
}

interface EnrichmentResult {
  entity_id: string;
  status: 'complete' | 'partial' | 'failed';
  fields_enriched: string[];
  data: Record<string, any>;
  confidence: Record<string, number>;
  sources: Record<string, string>;
  enriched_at: Date;
}
```

### AI Consolidation

When multiple sources provide conflicting data:

```typescript
async function consolidateData(
  sources: DataSourceResult[]
): Promise<ConsolidatedData> {
  // Use Claude to resolve conflicts
  const prompt = `
    Multiple data sources provided different values for these fields.
    Determine the most likely accurate value and confidence score.

    Source 1 (Clearbit): ${JSON.stringify(sources[0])}
    Source 2 (LinkedIn): ${JSON.stringify(sources[1])}
    Source 3 (Crunchbase): ${JSON.stringify(sources[2])}

    For each field, provide:
    - Selected value
    - Confidence (0-1)
    - Reasoning
  `;

  return await claude.analyze(prompt);
}
```

### API Endpoints

#### POST /api/enrichment/trigger
```json
{
  "entity_type": "customer",
  "entity_id": "uuid",
  "priority": "high",
  "fields": ["employees", "funding", "news"]
}
```

#### GET /api/enrichment/status/{entity_id}
```json
{
  "entity_id": "uuid",
  "entity_type": "customer",
  "status": "complete",
  "last_enriched": "2026-01-29T10:00:00Z",
  "next_scheduled": "2026-02-05T10:00:00Z",
  "fields": {
    "employees": {
      "value": 500,
      "confidence": 0.92,
      "source": "linkedin",
      "updated_at": "2026-01-29"
    },
    "funding_total": {
      "value": 25000000,
      "confidence": 0.98,
      "source": "crunchbase",
      "updated_at": "2026-01-29"
    }
  },
  "changes_detected": [
    {
      "field": "employees",
      "old_value": 450,
      "new_value": 500,
      "detected_at": "2026-01-29"
    }
  ]
}
```

#### GET /api/customers/{id}/enriched
Returns customer record with all enriched fields.

### Database Schema

```sql
CREATE TABLE enrichment_data (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_value JSONB,
  confidence DECIMAL(3,2),
  source VARCHAR(100),
  source_url TEXT,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(entity_type, entity_id, field_name)
);

CREATE TABLE enrichment_history (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  change_type VARCHAR(20),
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enrichment_queue (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  requested_fields TEXT[],
  status VARCHAR(20) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichment_entity ON enrichment_data(entity_type, entity_id);
CREATE INDEX idx_enrichment_queue_status ON enrichment_queue(status, priority);
```

## UI/UX Design

### Customer Profile Enrichment View
```
┌─────────────────────────────────────────────────────────┐
│ TechCorp Industries                       [Enrich Now]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ COMPANY INFORMATION                    Last: 3 days ago │
│ ──────────────────                                      │
│ Industry: Technology • Software (0.95)  ✓ LinkedIn      │
│ Employees: 500 (0.92)                   ✓ LinkedIn      │
│ Founded: 2015 (0.98)                    ✓ Crunchbase    │
│ HQ: San Francisco, CA (0.99)            ✓ Clearbit      │
│ Website: techcorp.com                   ✓ Direct        │
│                                                         │
│ FUNDING HISTORY                        Last: 7 days ago │
│ ───────────────                                         │
│ Total Raised: $25M                      ✓ Crunchbase    │
│ Last Round: Series B ($15M, 2024)       ✓ Crunchbase    │
│ Investors: Sequoia, a16z                ✓ Crunchbase    │
│                                                         │
│ RECENT NEWS                            Last: 1 day ago  │
│ ───────────                                             │
│ • "TechCorp expands to Europe" - TechCrunch, Jan 28     │
│ • "Q4 results exceed expectations" - PR Newswire, Jan 15│
│                                                         │
│ TECHNOLOGY STACK                       Last: 14 days    │
│ ────────────────                                        │
│ AWS, Salesforce, Slack, Zendesk        ✓ BuiltWith     │
│                                                         │
│ [View All Fields] [Enrichment History] [Report Issue]   │
└─────────────────────────────────────────────────────────┘
```

### Stakeholder Enrichment View
```
┌─────────────────────────────────────────────────────────┐
│ Sarah Chen                                [Enrich Now]  │
│ VP Product @ TechCorp Industries                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ PROFESSIONAL PROFILE                   Last: 5 days ago │
│ ────────────────────                                    │
│ Title: VP of Product (0.95)             ✓ LinkedIn      │
│ Tenure: 3 years (since 2023)            ✓ LinkedIn      │
│ Location: San Francisco Bay Area        ✓ LinkedIn      │
│                                                         │
│ CAREER HISTORY                                          │
│ ──────────────                                          │
│ • TechCorp Industries - VP Product (2023-present)       │
│ • Startup XYZ - Director PM (2020-2023)                │
│ • BigTech Inc - Senior PM (2017-2020)                   │
│                                                         │
│ EDUCATION                                               │
│ ─────────                                               │
│ • MBA, Stanford GSB (2017)                              │
│ • BS Computer Science, UC Berkeley (2012)               │
│                                                         │
│ CONNECTIONS                                             │
│ ───────────                                             │
│ • 3 mutual connections in your network                  │
│                                                         │
│ [View LinkedIn] [View History] [Report Issue]           │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Data provider API integrations (Clearbit, Crunchbase, etc.)
- Background job processing
- Claude API for data consolidation
- Scheduled task system

### Related PRDs
- PRD-025: Bulk Contact Upload → Data Enrichment
- PRD-068: Competitive Intelligence per Account
- PRD-082: Decision Maker Analysis

## Success Metrics

### Quantitative
- Field coverage: > 80% of records have enriched data
- Data accuracy: > 90% when spot-checked
- Enrichment latency: < 24 hours for new records
- Manual research time reduced by 70%

### Qualitative
- CSMs trust enriched data
- Data helps with meeting prep and outreach
- Changes are detected before CSMs notice

## Rollout Plan

### Phase 1: Basic Enrichment (Week 1-2)
- Company firmographics
- Single data source (Clearbit or similar)
- Manual trigger only

### Phase 2: Stakeholder Data (Week 3-4)
- LinkedIn integration
- Career history
- Automatic trigger on create

### Phase 3: Multi-Source (Week 5-6)
- Multiple data providers
- AI consolidation
- Scheduled re-enrichment

### Phase 4: Intelligence (Week 7-8)
- News monitoring
- Change detection alerts
- Technology stack detection

## Open Questions
1. Which data providers offer the best value/cost ratio?
2. How do we handle GDPR/privacy for stakeholder data?
3. What's the right frequency for re-enrichment?
4. Should users be able to override enriched data?
