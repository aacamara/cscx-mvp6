# PRD-072: Account Team View

## Category
**Category C: Account Intelligence**

## Priority
**P2** - Advanced Features

## Overview
Provide a unified view of all internal team members associated with a customer account, their roles, responsibilities, recent activities, and coordination status. This view helps ensure proper coverage, avoid duplicated efforts, and enable effective internal collaboration on strategic accounts.

## User Story
As a CSM, I want to see who else from my company is involved with this account so that I can coordinate efforts, share intelligence, and avoid stepping on each other's toes.

As a CS Manager, I want to see account team coverage across my portfolio so that I can ensure proper resource allocation and identify accounts needing additional support.

## Trigger
- Navigation: Customer Detail > Team Tab
- Natural language: "Who's working on [Account]?"
- Variations: "Account team for [Account]", "Who else is involved with [Account]?", "Internal contacts"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to display |
| Include Historical | Boolean | No | Show past team members |

## Account Team Roles
| Role | Description | Typical Activities |
|------|-------------|-------------------|
| CSM | Customer Success Manager | Relationship, adoption, renewal |
| AE | Account Executive | Commercial, expansion |
| SE | Solutions Engineer | Technical, implementation |
| TAM | Technical Account Manager | Technical guidance |
| Support Lead | Support Manager | Escalations, technical issues |
| Exec Sponsor | Executive Sponsor | Strategic alignment |
| Partner Manager | Alliance Manager | Partner-related coordination |
| Implementation | Implementation Lead | Onboarding, deployment |
| Training | Training Specialist | Education, enablement |

## Account Team Data Model
```typescript
interface AccountTeamMember {
  id: string;
  userId: string;
  customerId: string;
  role: AccountTeamRole;
  isPrimary: boolean;

  // User info (joined from users table)
  name: string;
  email: string;
  title: string;
  phone: string;
  slackHandle: string;
  photoUrl: string;

  // Assignment info
  assignedDate: Date;
  assignedBy: string;
  endDate: Date | null;
  status: 'active' | 'inactive' | 'transitioning';

  // Activity tracking
  lastActivity: Date;
  activityCount30d: number;
  nextScheduledAction: string;
}

interface AccountTeamActivity {
  id: string;
  userId: string;
  customerId: string;
  activityType: string;
  description: string;
  timestamp: Date;
  visibility: 'team' | 'private';
}
```

## Output Format
```markdown
## Account Team: Acme Corp
Last Updated: [Timestamp]

### Team Coverage Score: 85/100 (Good)
All key roles covered | No gaps identified

---

### Core Team

#### Customer Success Manager
**Sarah Johnson** (Primary)
- Email: sarah.johnson@company.com
- Slack: @sarah.johnson
- Phone: (555) 123-4567

**Assigned**: March 15, 2024 (10 months)
**Last Activity**: 2 days ago (Email sent)
**Next Action**: Monthly check-in (Feb 5)

[View Profile] [Send Message] [Schedule Sync]

---

#### Account Executive
**Mike Chen**
- Email: mike.chen@company.com
- Slack: @mike.chen

**Assigned**: January 2024
**Focus**: Expansion opportunity ($45K)
**Last Activity**: 1 week ago (Proposal sent)
**Pipeline**: $45K Analytics expansion (Stage: Demo)

[View Profile] [View Opportunity]

---

#### Solutions Engineer
**Amy Rodriguez**
- Email: amy.rodriguez@company.com
- Slack: @amy.rodriguez

**Assigned**: As needed (no dedicated SE)
**Last Engagement**: December 2025 (Integration support)
**Availability**: Available for technical discussions

[Request SE Support]

---

### Extended Team

| Role | Name | Last Active | Focus |
|------|------|-------------|-------|
| Support Lead | David Kim | 5 days ago | Ticket #4521 escalation |
| Exec Sponsor | VP Jane Smith | 45 days ago | Strategic alignment |
| Implementation | Completed | - | Onboarding done May 2024 |
| Training | Mark Wilson | 30 days ago | Q4 training sessions |

---

### Team Activity (Last 30 Days)

| Date | Team Member | Activity | Details |
|------|-------------|----------|---------|
| Jan 28 | Sarah J. | Email Sent | Monthly check-in |
| Jan 25 | David K. | Support | Escalation resolved |
| Jan 22 | Mike C. | Meeting | Expansion discussion |
| Jan 18 | Sarah J. | Meeting | QBR preparation |
| Jan 15 | Amy R. | Call | API integration support |
| Jan 10 | Mark W. | Training | Power user workshop |

[View All Activity] [Export Log]

---

### Communication Channels

**Internal Slack Channel**: #acme-corp-account
- Members: 6 | Active: Daily
- [Open Channel]

**Account Folder**: [Google Drive Link]
- Shared docs, meeting notes, proposals

**CRM Record**: [Salesforce Link]

---

### Coordination Status

#### Recent Coordination
| Date | Topic | Participants | Outcome |
|------|-------|--------------|---------|
| Jan 22 | Expansion strategy | Sarah, Mike | Agreed on approach |
| Jan 10 | Support escalation | Sarah, David | Resolved |
| Dec 15 | QBR prep | Sarah, Mike, Jane | Plan finalized |

#### Upcoming Coordination
| Date | Topic | Participants | Status |
|------|-------|--------------|--------|
| Feb 5 | Monthly sync | Sarah, Mike | Scheduled |
| Feb 15 | Pre-renewal planning | Sarah, Mike, Jane | Proposed |

[Schedule Team Sync] [Create Agenda]

---

### Coverage Analysis

#### Role Coverage
| Role | Required? | Assigned | Status |
|------|-----------|----------|--------|
| CSM | Yes | Sarah J. | ✓ |
| AE | Yes (Expansion) | Mike C. | ✓ |
| SE | As needed | Amy R. | ✓ |
| Support Lead | As needed | David K. | ✓ |
| Exec Sponsor | Recommended | Jane S. | ✓ |

**All critical roles covered**

#### Engagement Balance
| Team Member | Touch Points (30d) | Expected | Status |
|-------------|-------------------|----------|--------|
| Sarah J. | 8 | 4-6 | ✓ Active |
| Mike C. | 3 | 2-4 | ✓ Active |
| David K. | 2 | As needed | ✓ OK |
| Jane S. | 0 | 1/quarter | ⚠ Overdue |

**Recommendation**: Schedule exec sponsor touchpoint

---

### Team Changes History

| Date | Change | Details |
|------|--------|---------|
| Mar 2024 | CSM assigned | Sarah J. took over from John D. |
| Jan 2024 | AE assigned | Mike C. for expansion focus |
| May 2024 | Impl completed | Team transitioned to BAU |

---

### Quick Actions
[Add Team Member] [Schedule Team Sync] [Open Slack Channel] [Update Roles]
```

## Acceptance Criteria
- [ ] All team members displayed with contact info
- [ ] Role assignments clear with dates
- [ ] Activity timeline per team member
- [ ] Coordination history visible
- [ ] Slack channel and Drive folder linked
- [ ] Coverage analysis identifies gaps
- [ ] Add/remove team members functional
- [ ] Activity visibility respected (team vs private)
- [ ] Historical team members shown when toggled
- [ ] Quick communication actions work

## API Endpoint
```
GET /api/intelligence/account-team/:customerId
  Query: ?includeHistorical=false

POST /api/intelligence/account-team/:customerId/members
  Body: {
    "userId": "uuid",
    "role": "se",
    "isPrimary": false
  }

DELETE /api/intelligence/account-team/:customerId/members/:memberId
```

## Data Sources
| Source | Table | Data |
|--------|-------|------|
| Team | `account_team_members` | Assignments |
| Users | `users` | Contact details |
| Activity | `agent_activity_log` | Activity tracking |
| Meetings | `meetings` | Meeting activity |
| CRM | Salesforce | Opportunity info |
| Slack | Slack API | Channel info |

## Integration Points
- Slack: Channel membership, messaging
- Salesforce: Opportunity owner sync
- Google Calendar: Meeting attendees
- Email: Communication tracking

## Error Handling
| Error | Response |
|-------|----------|
| No team assigned | "No team members assigned. [Add Team Member]" |
| User not found | "Team member not found in system" |
| Slack not connected | "Connect Slack for team collaboration features" |

## Success Metrics
| Metric | Target |
|--------|--------|
| Team Coverage | 100% of accounts have CSM |
| Coordination Syncs | > 1/month for strategic |
| Activity Visibility | > 90% of touches logged |
| Coverage Gaps Identified | 100% flagged within 24h |

## Future Enhancements
- Automatic team suggestions based on account needs
- Capacity planning integration
- Cross-account team analytics
- Team effectiveness scoring
- Automated coordination scheduling

## Related PRDs
- PRD-241: @Mention Team Members
- PRD-247: Team Handoff Workflow
- PRD-252: War Room Coordination
- PRD-258: Coverage Backup System
