# PRD-063: Stakeholder Relationship Map

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a visual, interactive map of all stakeholders within a customer account showing their roles, relationships, influence levels, sentiment, and engagement status. This tool helps CSMs understand the political landscape, identify gaps in multi-threading, and strategically build relationships across the organization.

## User Story
As a CSM, I want to see a visual map of all stakeholders and their relationships so that I can understand the decision-making structure, identify champions and detractors, and develop a strategic engagement plan.

As a CS Leader, I want to see stakeholder coverage across accounts so that I can identify accounts with single-threaded risk and coach CSMs on relationship building.

## Trigger
- Navigation: Customer Detail > Stakeholders Tab
- Natural language: "Show me the stakeholder map for [Account]"
- Variations: "Who are the key contacts at [Account]?", "Org chart for [Account]", "Relationship map"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to display |
| View Mode | String | No | "org_chart", "influence_map", "engagement_view" |
| Include Former | Boolean | No | Show departed stakeholders |

## Stakeholder Data Model
```typescript
interface Stakeholder {
  id: string;
  customerId: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;

  // Relationship attributes
  role: 'champion' | 'sponsor' | 'influencer' | 'user' | 'detractor' | 'blocker';
  influenceLevel: 'high' | 'medium' | 'low';
  decisionMaker: boolean;
  budgetAuthority: boolean;

  // Engagement tracking
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  engagementLevel: 'high' | 'medium' | 'low' | 'none';
  lastContactDate: Date;
  preferredChannel: 'email' | 'phone' | 'slack' | 'in_person';

  // Organizational
  reportsTo?: string;  // stakeholder ID
  directReports?: string[];  // stakeholder IDs

  // Status
  status: 'active' | 'departed' | 'on_leave';
  departureDate?: Date;
  notes: string;
}

interface StakeholderRelationship {
  fromId: string;
  toId: string;
  relationshipType: 'reports_to' | 'collaborates_with' | 'influences' | 'blocks';
  strength: 'strong' | 'moderate' | 'weak';
}
```

## View Modes
### 1. Org Chart View
Traditional hierarchical view showing reporting structure
```
                    ┌─────────────────┐
                    │   CEO           │
                    │   Tom Williams  │
                    │   ★ Exec Sponsor│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │VP Ops   │         │VP Eng   │         │CFO      │
    │Sarah Chen│         │Mike Lee │         │Jane Doe │
    │★ Champion│         │☺ User  │         │☹ Blocker│
    └────┬────┘         └────┬────┘         └─────────┘
         │                   │
    ┌────▼────┐         ┌────▼────┐
    │Manager  │         │Lead Dev │
    │Bob Smith│         │Amy Wang │
    │☺ User   │         │☺ User   │
    └─────────┘         └─────────┘
```

### 2. Influence Map View
Concentric circles showing influence levels with sentiment colors
```
        ┌──────────────────────────────────────────────┐
        │                  LOW INFLUENCE               │
        │   ┌──────────────────────────────────────┐  │
        │   │           MEDIUM INFLUENCE           │  │
        │   │   ┌──────────────────────────────┐   │  │
        │   │   │        HIGH INFLUENCE        │   │  │
        │   │   │   ┌──────────────────────┐   │   │  │
        │   │   │   │  DECISION MAKERS     │   │   │  │
        │   │   │   │    [Tom W.]          │   │   │  │
        │   │   │   │    [Jane D.]         │   │   │  │
        │   │   │   └──────────────────────┘   │   │  │
        │   │   │  [Sarah C.★]  [Mike L.]      │   │  │
        │   │   └──────────────────────────────┘   │  │
        │   │      [Bob S.]    [Amy W.]            │  │
        │   └──────────────────────────────────────┘  │
        │       [Other Users...]                      │
        └──────────────────────────────────────────────┘

        Legend: ★ Champion  ● Positive  ○ Neutral  ◐ Negative
```

### 3. Engagement View
Focus on interaction recency and frequency
```
| Stakeholder | Last Contact | Frequency | Sentiment | Action Needed |
|-------------|--------------|-----------|-----------|---------------|
| Sarah Chen  | 3 days ago   | Weekly    | Positive  | -             |
| Tom Williams| 45 days ago  | Quarterly | Neutral   | Schedule call |
| Jane Doe    | 60 days ago  | Rare      | Negative  | Re-engage     |
| Mike Lee    | 7 days ago   | Bi-weekly | Positive  | -             |
```

## Output Format
```markdown
## Stakeholder Map: Acme Corp
Last Updated: [Timestamp]

### Coverage Summary
| Metric | Value | Status |
|--------|-------|--------|
| Total Stakeholders | 8 | |
| Decision Makers | 2 | ✓ Covered |
| Executive Sponsor | 1 | ✓ |
| Champion | 1 | ✓ |
| Blockers/Detractors | 1 | ⚠ |
| Engagement Gaps | 2 | ⚠ (>30 days no contact) |
| Departments Covered | 3/5 | ⚠ Missing: Marketing, HR |

### Key Relationships

#### Champions & Sponsors
- **Sarah Chen** (VP Operations) - PRIMARY CHAMPION
  - Influence: High | Sentiment: Positive
  - Last Contact: 3 days ago
  - Key Interests: Efficiency, reporting, team adoption
  - [View Profile] [Schedule Meeting] [Send Email]

- **Tom Williams** (CEO) - EXEC SPONSOR
  - Influence: High | Sentiment: Neutral
  - Last Contact: 45 days ago ⚠
  - Key Interests: ROI, strategic alignment
  - **Action**: Schedule quarterly alignment call
  - [View Profile] [Schedule Meeting]

#### Risk Contacts
- **Jane Doe** (CFO) - POTENTIAL BLOCKER
  - Influence: High | Sentiment: Negative
  - Concern: Questioning ROI, cost-focused
  - Last Contact: 60 days ago ⚠
  - **Strategy**: Share value report, schedule ROI review
  - [View Profile] [Draft Email]

### Multi-Threading Score: 65/100
**Analysis**: Good champion and exec sponsor coverage, but:
- Only 1 champion (single-threaded risk)
- CFO not engaged - risk to renewal
- 2 departments not represented

**Recommendations**:
1. Identify secondary champion in Engineering
2. Schedule CFO relationship-building meeting
3. Explore Marketing department contact

### Relationship Actions
| Contact | Relationship Goal | Next Step | Due |
|---------|-------------------|-----------|-----|
| Tom Williams | Maintain exec sponsorship | Quarterly call | Feb 15 |
| Jane Doe | Convert to neutral | Share ROI report | This week |
| Marketing TBD | New contact | Get intro from Sarah | Feb 10 |

### [Interactive Map View]
[Toggle: Org Chart | Influence Map | Engagement View]
```

## Acceptance Criteria
- [ ] All three view modes functional (org chart, influence, engagement)
- [ ] Visual indicators for role types (champion, sponsor, etc.)
- [ ] Sentiment shown with colors (green/yellow/red)
- [ ] Last contact date displayed with warning for gaps
- [ ] Multi-threading score calculated
- [ ] Gap analysis identifies missing relationships
- [ ] Click on stakeholder opens detail panel
- [ ] Quick actions (email, schedule, call) from map
- [ ] Departed stakeholders shown (toggleable)
- [ ] Edit stakeholder relationships inline
- [ ] Export org chart as image/PDF

## API Endpoint
```
GET /api/intelligence/stakeholder-map/:customerId
  Query: ?view=influence_map&includeFormer=false

POST /api/intelligence/stakeholder-map/:customerId/relationships
  Body: {
    "fromId": "uuid",
    "toId": "uuid",
    "relationshipType": "reports_to"
  }
```

## Data Sources
| Source | Table | Data |
|--------|-------|------|
| Stakeholders | `stakeholders` | Contact info, roles |
| Meetings | `meetings` | Last contact date |
| Emails | Gmail API | Communication history |
| Notes | Internal notes | Relationship notes |
| Contracts | `contracts` | Contract signers |

## Multi-Threading Score Calculation
```typescript
const multiThreadingScore = (
  (hasChampion ? 20 : 0) +
  (hasExecSponsor ? 20 : 0) +
  (decisionMakersCovered / totalDecisionMakers * 20) +
  (departmentsCovered / totalDepartments * 20) +
  (avgSentimentScore * 10) +
  (noEngagementGaps ? 10 : 0)
);
```

## Success Metrics
| Metric | Target |
|--------|--------|
| Multi-Threading Score Avg | > 70 |
| Stakeholder Updates/Month | > 2 per account |
| Engagement Gap Resolution | < 7 days |
| Accounts with Exec Sponsor | > 80% |
| Champion Backup Identified | > 60% |

## Future Enhancements
- LinkedIn integration for profile updates
- Automated stakeholder discovery from emails
- Departure prediction (LinkedIn job changes)
- Relationship strength scoring from interactions
- Cross-account relationship mapping (holding companies)

## Related PRDs
- PRD-082: Decision Maker Analysis
- PRD-088: Champion Departure Alert
- PRD-044: Multi-Threading Introduction
- PRD-014: Customer Org Chart Upload
