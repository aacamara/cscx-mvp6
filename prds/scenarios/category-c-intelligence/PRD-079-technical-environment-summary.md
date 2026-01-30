# PRD-079: Technical Environment Summary

## Category
**Category C: Account Intelligence**

## Priority
**P2** - Advanced Features

## Overview
Provide a comprehensive view of the customer's technical environment including their tech stack, integrations, API usage, security configurations, and technical health indicators. This intelligence helps CSMs and technical teams understand the customer's technical context, identify integration opportunities, and proactively address technical risks.

## User Story
As a CSM, I want to understand my customer's technical environment so that I can have informed conversations about integrations, identify potential technical issues, and involve the right technical resources when needed.

As a Solutions Engineer, I want to see the customer's technical setup so that I can provide relevant recommendations and support technical discussions effectively.

## Trigger
- Navigation: Customer Detail > Technical Tab
- Natural language: "What's the technical setup for [Account]?"
- Variations: "Tech stack for [Account]", "Integrations for [Account]", "Technical environment"
- Technical review: Auto-surface for technical meetings

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Include Health | Boolean | No | Show technical health indicators |

## Technical Environment Components
### Connected Integrations
| Category | Examples | Data Captured |
|----------|----------|---------------|
| CRM | Salesforce, HubSpot | Sync status, data flow |
| Communication | Slack, Teams | Channel config |
| Analytics | Pendo, Amplitude | Data sources |
| Support | Zendesk, Intercom | Ticket routing |
| SSO/Identity | Okta, Azure AD | Auth config |
| Storage | AWS, GCP, Azure | Data location |
| Custom | Webhooks, API | Endpoint config |

### API Usage
| Metric | Description | Health Indicator |
|--------|-------------|------------------|
| API Calls/Day | Daily call volume | vs limit |
| Endpoints Used | Active endpoints | Breadth |
| Error Rate | Failed calls % | < 1% healthy |
| Rate Limit Hits | Limit encounters | < 0.1% |
| Response Time | Avg latency | < 200ms |

### Security Configuration
| Setting | Description | Status Tracked |
|---------|-------------|----------------|
| SSO | Single sign-on enabled | On/Off |
| MFA | Multi-factor auth | Enforced/Optional |
| IP Whitelist | IP restrictions | Configured/Not |
| Data Encryption | Encryption at rest | Enabled/Disabled |
| Audit Logging | Activity logging | Enabled/Disabled |

## Technical Environment Model
```typescript
interface TechnicalEnvironment {
  customerId: string;
  lastUpdated: Date;

  // Integrations
  integrations: Integration[];
  pendingIntegrations: string[];
  integrationHealth: IntegrationHealth;

  // API Usage
  apiUsage: APIUsage;
  apiHealth: APIHealth;

  // Security
  securityConfig: SecurityConfig;
  complianceStatus: ComplianceStatus;

  // Infrastructure
  deployment: DeploymentInfo;
  dataResidency: string;

  // Tech Stack (external)
  techStack: TechStackInfo;

  // Health
  technicalHealthScore: number;
  issues: TechnicalIssue[];
  recommendations: TechnicalRecommendation[];
}

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastSyncAt: Date;
  configuration: Record<string, any>;
  healthStatus: 'healthy' | 'degraded' | 'down';
  dataFlowDirection: 'inbound' | 'outbound' | 'bidirectional';
  setupDate: Date;
}
```

## Output Format
```markdown
## Technical Environment: Acme Corp
Last Updated: [Timestamp]

### Technical Health Score: 85/100 (Good)
[Gauge visualization]

| Component | Score | Status |
|-----------|-------|--------|
| Integrations | 90/100 | ✓ Healthy |
| API Usage | 85/100 | ● OK |
| Security | 80/100 | ⚠ Review |

---

### Connected Integrations (5 Active)

| Integration | Type | Status | Last Sync | Data Flow |
|-------------|------|--------|-----------|-----------|
| Salesforce | CRM | ✓ Active | 5 min ago | Bidirectional |
| Slack | Communication | ✓ Active | 2 min ago | Outbound |
| Okta | SSO/Identity | ✓ Active | Real-time | Inbound |
| Zapier | Automation | ✓ Active | 1 hr ago | Bidirectional |
| Custom Webhook | Custom | ⚠ Errors | 2 hrs ago | Outbound |

#### Integration Details

##### Salesforce
**Connected Since**: March 2024
**Sync Frequency**: Every 5 minutes
**Objects Synced**: Accounts, Contacts, Opportunities

| Metric | Value | Status |
|--------|-------|--------|
| Sync Success Rate | 99.8% | ✓ |
| Records Synced | 1,247 | |
| Last Error | None | ✓ |

**Configuration**:
- Health score push: ✓ Enabled
- Contact sync: ✓ Enabled
- Opportunity sync: ✓ Enabled
- Custom fields: 3 mapped

##### Custom Webhook (Needs Attention)
**Issue**: 15 failed deliveries in last 24 hours
**Error**: Connection timeout (endpoint not responding)
**Endpoint**: https://acme.internal.com/api/webhook

**Recommended Action**: Contact customer to verify endpoint availability

[View Webhook Logs] [Send Alert to Customer]

---

### API Usage

#### Current Usage vs Limits
| Resource | Used | Limit | % Used | Status |
|----------|------|-------|--------|--------|
| API Calls/Month | 850,000 | 1,000,000 | 85% | ⚠ |
| Rate Limit | 100/sec | 150/sec | 67% | ✓ |
| Storage | 42 GB | 100 GB | 42% | ✓ |
| Webhooks | 5 | 10 | 50% | ✓ |

**Alert**: API usage at 85% - may need limit increase before month end

[View Usage Trends] [Request Limit Increase]

#### API Health Metrics (Last 30 Days)
| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| Total Calls | 25.5M | - | |
| Avg Calls/Day | 850K | - | |
| Error Rate | 0.3% | < 1% | ✓ |
| Avg Response Time | 145ms | < 200ms | ✓ |
| Rate Limit Hits | 23 | < 100 | ✓ |

[API Usage Chart - 30 days]

#### Most Used Endpoints
| Endpoint | Calls/Day | % of Total |
|----------|-----------|------------|
| /api/v2/data | 450K | 53% |
| /api/v2/reports | 200K | 24% |
| /api/v2/users | 100K | 12% |
| /api/v2/events | 80K | 9% |
| Other | 20K | 2% |

---

### Security Configuration

| Setting | Status | Recommendation |
|---------|--------|----------------|
| Single Sign-On (SSO) | ✓ Enabled (Okta) | - |
| Multi-Factor Auth | ⚠ Optional | Recommend enforcing |
| IP Whitelist | ✗ Not configured | Consider for security |
| API Key Rotation | ✓ 90-day rotation | - |
| Audit Logging | ✓ Enabled | - |
| Data Encryption | ✓ Enabled | - |

**Security Score**: 80/100

**Recommendations**:
1. Enforce MFA for all users (currently optional)
2. Consider IP whitelisting for API access
3. Review admin access permissions

[Generate Security Report] [Schedule Security Review]

---

### Compliance & Data

| Aspect | Status | Details |
|--------|--------|---------|
| Data Residency | US-West | Primary region |
| Backup Region | US-East | Disaster recovery |
| Data Processing Agreement | ✓ Signed | March 2024 |
| SOC2 Compliance | ✓ Covered | Your certification |
| GDPR Requirements | ✓ Met | EU data handling |
| HIPAA | N/A | Not applicable |

---

### Customer Tech Stack (External Intelligence)

**Detected Technologies** (via technographics):

| Category | Technology | Relevance |
|----------|------------|-----------|
| CRM | Salesforce | ✓ Integrated |
| Marketing | HubSpot | Potential integration |
| Analytics | Tableau | Potential integration |
| Cloud | AWS | Same as ours |
| Communication | Slack | ✓ Integrated |
| Support | Zendesk | Not yet integrated |

**Integration Opportunities**:
- HubSpot: Marketing automation data sync
- Zendesk: Support ticket visibility
- Tableau: BI dashboard embedding

[View Full Tech Stack] [Propose Integration]

---

### Technical Issues & Recommendations

#### Active Issues
| Issue | Severity | First Detected | Status |
|-------|----------|----------------|--------|
| Webhook delivery failures | Medium | Jan 26 | Investigating |
| API usage approaching limit | Low | Jan 20 | Monitoring |

#### Recommendations
| Recommendation | Priority | Impact |
|----------------|----------|--------|
| Enforce MFA | High | Security improvement |
| Increase API limit | Medium | Prevent disruption |
| Add Zendesk integration | Low | Support visibility |

---

### Technical Contacts

| Contact | Role | Technical Level |
|---------|------|-----------------|
| Mike Lee | Director of Engineering | High |
| Amy Wang | Lead Developer | High |
| Bob Smith | IT Admin | Medium |

**Primary Technical Contact**: Mike Lee (mike.lee@acme.com)

---

### Quick Actions
[Schedule Technical Review] [Export Tech Summary] [Request SE Support] [Create Integration Proposal]
```

## Acceptance Criteria
- [ ] All integrations displayed with status
- [ ] API usage metrics accurate
- [ ] Security configuration shown
- [ ] Integration health monitored
- [ ] Tech stack intelligence included
- [ ] Issues and recommendations generated
- [ ] Technical contacts listed
- [ ] Export to PDF available
- [ ] Alert on integration failures
- [ ] API limit warnings triggered

## API Endpoint
```
GET /api/intelligence/technical/:customerId
  Query: ?includeHealth=true

Response: {
  environment: TechnicalEnvironment;
  integrations: Integration[];
  apiUsage: APIUsage;
  security: SecurityConfig;
  recommendations: Recommendation[];
}
```

## Data Sources
| Source | Table/API | Data |
|--------|-----------|------|
| Integrations | `integrations` table | Connection status |
| API Usage | Rate limiting service | Usage metrics |
| Security | Auth service | Config settings |
| Tech Stack | Technographics API | External tools |
| Webhook Logs | Webhook service | Delivery status |

## Monitoring & Alerts
| Condition | Alert | Priority |
|-----------|-------|----------|
| Integration down > 1 hour | CSM + Tech notification | High |
| API usage > 90% | CSM notification | Medium |
| Webhook errors > 10% | Tech notification | Medium |
| Security config change | Audit log | Low |

## Success Metrics
| Metric | Target |
|--------|--------|
| Technical Issues Detected Early | > 90% |
| Integration Uptime | > 99.5% |
| API Health Maintained | > 99% |
| Technical Churn Prevention | +20% |

## Future Enhancements
- Real-time integration monitoring dashboard
- Automated integration health checks
- Custom API usage forecasting
- Security posture scoring
- Technical onboarding automation

## Related PRDs
- PRD-020: Integration Usage Data
- PRD-101: Integration Disconnected Alert
- PRD-139: Integration Added Health Check
- PRD-181-210: Integration PRDs
