# PRD-067: Contract Terms Quick Reference

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide CSMs with instant access to key contract terms, entitlements, and commercial details without needing to search through contract documents. This quick reference consolidates critical contract information into an easily scannable format, enabling faster and more confident customer conversations.

## User Story
As a CSM, I want to quickly see the key terms of a customer's contract so that I can accurately answer questions about what they're entitled to, when their contract renews, and what pricing they have without searching through documents.

As a CS Leader, I want CSMs to have accurate contract information at their fingertips so that we avoid over-promising or under-delivering on entitlements.

## Trigger
- Navigation: Customer Detail > Contract Tab
- Natural language: "What are the contract terms for [Account]?"
- Variations: "Contract details", "What's in their contract?", "Entitlements for [Account]"
- Quick access: Contract card in customer overview

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to display |
| Contract ID | UUID | No | Specific contract (default: active) |
| Include History | Boolean | No | Show historical contracts |

## Contract Data Elements
### Core Terms
| Element | Description | Display Format |
|---------|-------------|----------------|
| Contract Start | Effective date | Date |
| Contract End | Expiration date | Date + countdown |
| Term Length | Contract duration | X months/years |
| ARR | Annual recurring revenue | Currency |
| Payment Terms | Net 30, etc. | Text |
| Billing Frequency | Monthly, Annual, etc. | Text |
| Auto-Renewal | Does it auto-renew? | Yes/No + terms |

### Entitlements
| Element | Description | Display Format |
|---------|-------------|----------------|
| Product/Plan | Licensed product | Name |
| User Licenses | Number of users | Count |
| API Limits | API call limits | Count/period |
| Storage | Storage allocation | GB |
| Features | Feature access | List |
| Support Level | Support tier | Name |

### Pricing Details
| Element | Description | Display Format |
|---------|-------------|----------------|
| Base Price | Core subscription | Currency |
| Per-User Price | Additional user cost | Currency |
| Discount | Applied discount | Percentage |
| Pricing Lock | Price guaranteed until | Date |

### Legal Terms
| Element | Description | Display Format |
|---------|-------------|----------------|
| Notice Period | Cancellation notice | X days |
| Termination Rights | Early termination | Summary |
| Data Handling | Data retention/deletion | Summary |
| SLA | Service level agreement | Key metrics |

## Output Format
```markdown
## Contract Quick Reference: Acme Corp
Contract Status: **Active** | Document: [View Full Contract]

### Key Dates
| Milestone | Date | Days Away |
|-----------|------|-----------|
| Contract Start | Jan 15, 2025 | - |
| Contract End | Jan 14, 2026 | 350 days |
| Renewal Decision Due | Dec 15, 2025 | 320 days |
| Auto-Renewal | Yes (30-day notice) | |
| Price Lock Expires | Jan 14, 2026 | 350 days |

**Reminder**: Renewal conversation should start 90 days before end date

---

### Financial Summary
| Term | Value |
|------|-------|
| **ARR** | $150,000 |
| Monthly Cost | $12,500 |
| Payment Terms | Net 30 |
| Billing Cycle | Monthly, 15th |
| Discount Applied | 15% (Volume) |
| Original List Price | $176,500 |

---

### Entitlements

#### User Licenses
| Type | Entitled | In Use | Available |
|------|----------|--------|-----------|
| Full Users | 200 | 145 | 55 |
| Read-Only Users | 100 | 42 | 58 |
| Admin Users | 10 | 5 | 5 |

**Utilization**: 73% of full user licenses

#### Product & Features
| Product/Feature | Included | Status |
|-----------------|----------|--------|
| Enterprise Platform | ✓ | Active |
| Analytics Module | ✓ | Active |
| API Access | ✓ | Active |
| Custom Integrations | ✓ | Active |
| White Labeling | ✗ | Not included |
| Advanced Security | ✗ | Not included |

#### Usage Limits
| Resource | Limit | Current Usage | % Used |
|----------|-------|---------------|--------|
| API Calls/Month | 1,000,000 | 850,000 | 85% ⚠ |
| Storage (GB) | 500 | 312 | 62% |
| Report Exports/Day | 100 | 45 | 45% |
| Concurrent Users | 100 | 67 | 67% |

**Alert**: API usage at 85% - consider discussing increase

#### Support Level
| Aspect | Entitlement |
|--------|-------------|
| Support Tier | Premium |
| Response Time (Critical) | 2 hours |
| Response Time (High) | 4 hours |
| Dedicated CSM | Yes |
| Quarterly QBRs | Yes |
| Training Hours | 10 hours/year |

---

### Commercial Terms

#### Pricing Structure
```
Base Platform:     $100,000/year
+ Users (200):      $40,000/year ($200/user)
+ Analytics:        $10,000/year
─────────────────────────────
Subtotal:          $150,000/year
Volume Discount:   -$26,500 (15%)
─────────────────────────────
Final ARR:         $123,500/year
```

#### Expansion Pricing
| Add-On | List Price | Contract Price | Notes |
|--------|------------|----------------|-------|
| Additional Users | $300/user/yr | $255/user/yr | 15% discount applies |
| White Labeling | $15,000/yr | $12,750/yr | 15% discount applies |
| Advanced Security | $20,000/yr | $17,000/yr | 15% discount applies |
| API Increase (2M) | $5,000/yr | $4,250/yr | 15% discount applies |

---

### Legal Quick Reference

#### Renewal Terms
- **Auto-Renewal**: Yes, for successive 1-year terms
- **Non-Renewal Notice**: 30 days before expiration
- **Price Increase Cap**: Up to 5% annually

#### Termination
- **For Convenience**: 90-day notice + early term fee
- **For Cause**: 30-day cure period
- **Refund Policy**: Pro-rata for annual prepay

#### Service Levels
| Metric | SLA | Current | Status |
|--------|-----|---------|--------|
| Uptime | 99.9% | 99.95% | ✓ Compliant |
| Support Response | 2 hrs | 1.5 hrs avg | ✓ Compliant |
| Data Backup | Daily | Daily | ✓ Compliant |

**SLA Credits**: None accrued (all SLAs met)

#### Data Terms
- **Data Retention**: 90 days post-termination
- **Data Export**: Available upon request
- **Data Deletion**: Within 30 days of request

---

### Contract History

| Version | Period | ARR | Change |
|---------|--------|-----|--------|
| Current | Jan 2025 - Jan 2026 | $150,000 | +$30,000 (expansion) |
| Previous | Jan 2024 - Jan 2025 | $120,000 | Initial contract |

---

### Quick Actions
[View Full Contract] [Request Amendment] [Start Renewal Discussion] [Export Summary]

### Related Documents
- [Original Contract PDF]
- [Amendment 1 - User Expansion (Jul 2024)]
- [Order Form - Analytics Add-On]
```

## Acceptance Criteria
- [ ] All key dates displayed with countdown
- [ ] Financial terms accurately shown
- [ ] Entitlements with utilization displayed
- [ ] Expansion pricing available
- [ ] Legal terms summarized
- [ ] Contract history visible
- [ ] Link to full contract document
- [ ] Warning when approaching limits
- [ ] Auto-renewal terms clear
- [ ] Export to PDF available

## API Endpoint
```
GET /api/intelligence/contract/:customerId
  Query: ?includeHistory=true

Response: {
  contract: ContractDetails;
  entitlements: Entitlement[];
  utilization: UtilizationMetrics;
  pricing: PricingDetails;
  legalTerms: LegalSummary;
  history: ContractHistory[];
  documents: Document[];
}
```

## Data Sources
| Source | Table/API | Data |
|--------|-----------|------|
| Contracts | `contracts` | Core contract data |
| Entitlements | `entitlements` | Licensed items |
| Usage | `usage_metrics` | Utilization data |
| Documents | Google Drive | Contract documents |
| Parsed Data | `contracts.parsed_data` | AI-extracted terms |

## AI Enhancement
- Automatic extraction from contract PDFs
- Plain-language summary of legal terms
- Entitlement vs usage alerts
- Renewal term interpretation

## Error Handling
| Error | Response |
|-------|----------|
| No contract found | "No active contract on file. [Upload Contract]" |
| Missing entitlement data | "Entitlement details unavailable. Check contract document." |
| Expired contract | Show with "EXPIRED" badge, prompt for renewal |

## Success Metrics
| Metric | Target |
|--------|--------|
| Contract Lookup Time | < 30 seconds (vs 5+ min for doc search) |
| Entitlement Accuracy | 100% |
| CSM Confidence in Contract Conversations | +50% |
| Over-commitment Incidents | -80% |

## Future Enhancements
- Contract comparison (old vs new)
- Amendment request workflow
- Contract template suggestions
- Multi-contract view (parent/child)
- Integration with e-signature platforms

## Related PRDs
- PRD-003: PDF Contract Upload
- PRD-093: Contract Auto-Renewal Alert
- PRD-205: DocuSign Contract Management
- PRD-042: Contract Amendment Request
