# CSCX.AI CSM Scenario PRDs

## Overview
- **Total PRDs**: 275
- **Generated**: 2026-01-29
- **Based on codebase analysis**: WorkspaceAgent V2 + Full Platform

## Status Legend
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Complete
- ⚪ Blocked

## Category Summary

| Category | PRD Range | Count | Complete | In Progress | Blocked |
|----------|-----------|-------|----------|-------------|---------|
| A: Documents & Data | PRD-001 to PRD-025 | 25 | 0 | 0 | 0 |
| B: Communication | PRD-026 to PRD-055 | 30 | 0 | 0 | 0 |
| C: Intelligence | PRD-056 to PRD-085 | 30 | 0 | 0 | 0 |
| D: Alerts & Triggers | PRD-086 to PRD-115 | 30 | 0 | 0 | 0 |
| E: Automation | PRD-116 to PRD-150 | 35 | 0 | 0 | 0 |
| F: Reporting | PRD-151 to PRD-180 | 30 | 0 | 0 | 0 |
| G: Integrations | PRD-181 to PRD-210 | 30 | 0 | 0 | 0 |
| H: AI Features | PRD-211 to PRD-240 | 30 | 0 | 0 | 0 |
| I: Collaboration | PRD-241 to PRD-260 | 20 | 0 | 0 | 0 |
| J: Mobile & Accessibility | PRD-261 to PRD-275 | 15 | 0 | 0 | 0 |
| **TOTAL** | | **275** | **0** | **0** | **0** |

## Implementation Order

### Tier 1: Foundation (Implement First)
These PRDs establish core capabilities that other scenarios depend on:

- PRD-001: CSV Upload → Churn Analysis → Rescue Emails
- PRD-056: "Tell Me About [Account]" Command
- PRD-086: Usage Drop Alert → Check-In Workflow
- PRD-116: Post-Call Processing → Summary + Tasks + Email
- PRD-181: Salesforce Bi-Directional Sync
- PRD-211: Natural Language Account Query

### Tier 2: Core Workflows
Most common CSM daily activities:

- PRD-026 to PRD-035: Email generation workflows
- PRD-057 to PRD-065: Account intelligence queries
- PRD-087 to PRD-095: Critical alert workflows
- PRD-117 to PRD-125: Key automation sequences

### Tier 3: Advanced Features
Power user and automation features:

- PRD-151 to PRD-180: Reporting & Analytics
- PRD-211 to PRD-240: AI-Powered Features
- PRD-241 to PRD-260: Collaboration Features

### Tier 4: Polish & Scale
Mobile, accessibility, optimization:

- PRD-261 to PRD-275: Mobile & Accessibility

## Quick Reference

### Category A: Documents & Data Processing (25 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-001 | CSV Upload → Churn Analysis → Rescue Emails | P0 | 🔴 |
| PRD-002 | Excel Upload → Health Score Calculation | P1 | 🔴 |
| PRD-003 | PDF Contract Upload → Key Terms Extraction | P0 | 🔴 |
| PRD-004 | Support Ticket Export → Pattern Analysis | P1 | 🔴 |
| PRD-005 | NPS Survey Results → Sentiment Analysis | P1 | 🔴 |
| PRD-006 | Usage Data Upload → Adoption Scoring | P1 | 🔴 |
| PRD-007 | Financial Data Upload → Revenue Analysis | P2 | 🔴 |
| PRD-008 | Meeting Notes Upload → Action Item Extraction | P0 | 🔴 |
| PRD-009 | Email Thread Upload → Conversation Summary | P1 | 🔴 |
| PRD-010 | Product Feedback Upload → Theme Clustering | P2 | 🔴 |
| PRD-011 | Competitor Mention Analysis → Battle Card | P2 | 🔴 |
| PRD-012 | Onboarding Checklist Upload → Progress Tracking | P1 | 🔴 |
| PRD-013 | QBR Deck Upload → Data Refresh | P1 | 🔴 |
| PRD-014 | Customer Org Chart Upload → Stakeholder Mapping | P2 | 🔴 |
| PRD-015 | Invoice History Upload → Payment Pattern Analysis | P2 | 🔴 |
| PRD-016 | Feature Request List → Prioritization Scoring | P2 | 🔴 |
| PRD-017 | Training Completion Data → Certification Tracking | P2 | 🔴 |
| PRD-018 | Event Attendance Upload → Engagement Scoring | P3 | 🔴 |
| PRD-019 | Social Mention Export → Sentiment Tracking | P3 | 🔴 |
| PRD-020 | Integration Usage Data → Technical Health Score | P2 | 🔴 |
| PRD-021 | Multi-File Upload → Cross-Reference Analysis | P2 | 🔴 |
| PRD-022 | Historical Data Upload → Trend Analysis | P2 | 🔴 |
| PRD-023 | Benchmark Data Upload → Peer Comparison | P2 | 🔴 |
| PRD-024 | Survey Response Upload → Statistical Analysis | P2 | 🔴 |
| PRD-025 | Bulk Contact Upload → Data Enrichment | P2 | 🔴 |

### Category B: Customer Communication (30 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-026 | One-Click QBR Email Generation | P0 | 🔴 |
| PRD-027 | Renewal Proposal Generator | P0 | 🔴 |
| PRD-028 | Onboarding Welcome Sequence | P0 | 🔴 |
| PRD-029 | Escalation Response Drafting | P0 | 🔴 |
| PRD-030 | Win-Back Campaign Generator | P1 | 🔴 |
| PRD-031 | Executive Sponsor Outreach | P1 | 🔴 |
| PRD-032 | Champion Nurture Sequence | P1 | 🔴 |
| PRD-033 | Product Update Announcement | P1 | 🔴 |
| PRD-034 | Check-In Email After Silence | P0 | 🔴 |
| PRD-035 | Thank You Note Generator | P2 | 🔴 |
| PRD-036 | Meeting Request Optimizer | P1 | 🔴 |
| PRD-037 | Feedback/Testimonial Request | P2 | 🔴 |
| PRD-038 | Training Invitation Personalization | P2 | 🔴 |
| PRD-039 | Event Invitation Generator | P2 | 🔴 |
| PRD-040 | Milestone Celebration Email | P2 | 🔴 |
| PRD-041 | Price Increase Communication | P1 | 🔴 |
| PRD-042 | Contract Amendment Request | P1 | 🔴 |
| PRD-043 | Reference Request to Customer | P2 | 🔴 |
| PRD-044 | Multi-Threading Introduction | P1 | 🔴 |
| PRD-045 | Quarterly Newsletter Personalization | P2 | 🔴 |
| PRD-046 | Apology Email Generator | P1 | 🔴 |
| PRD-047 | Upsell Introduction Email | P1 | 🔴 |
| PRD-048 | Case Study Request | P2 | 🔴 |
| PRD-049 | Referral Request Email | P2 | 🔴 |
| PRD-050 | End-of-Contract Summary | P1 | 🔴 |
| PRD-051 | Handoff Introduction Email | P1 | 🔴 |
| PRD-052 | Re-Engagement After Support Ticket | P1 | 🔴 |
| PRD-053 | Product Feedback Follow-Up | P2 | 🔴 |
| PRD-054 | Seasonal/Holiday Outreach | P3 | 🔴 |
| PRD-055 | Webinar/Event Follow-Up Sequence | P2 | 🔴 |

### Category C: Account Intelligence (30 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-056 | "Tell Me About [Account]" Command | P0 | 🔴 |
| PRD-057 | "What Accounts Need Attention?" Briefing | P0 | 🔴 |
| PRD-058 | Account Comparison Tool | P1 | 🔴 |
| PRD-059 | Renewal Pipeline Forecast | P0 | 🔴 |
| PRD-060 | Expansion Opportunity Finder | P0 | 🔴 |
| PRD-061 | At-Risk Portfolio View | P0 | 🔴 |
| PRD-062 | Customer Journey Timeline | P1 | 🔴 |
| PRD-063 | Stakeholder Relationship Map | P1 | 🔴 |
| PRD-064 | Product Adoption Dashboard | P1 | 🔴 |
| PRD-065 | Support History Summary | P1 | 🔴 |
| PRD-066 | Billing & Payment Status | P1 | 🔴 |
| PRD-067 | Contract Terms Quick Reference | P1 | 🔴 |
| PRD-068 | Competitive Intelligence per Account | P2 | 🔴 |
| PRD-069 | Account Success Metrics | P1 | 🔴 |
| PRD-070 | Engagement Score Breakdown | P1 | 🔴 |
| PRD-071 | White Space Analysis | P1 | 🔴 |
| PRD-072 | Account Team View | P2 | 🔴 |
| PRD-073 | Recent Changes Alert | P1 | 🔴 |
| PRD-074 | Account Benchmarking | P2 | 🔴 |
| PRD-075 | Predicted Next Best Action | P0 | 🔴 |
| PRD-076 | Account Sentiment Over Time | P2 | 🔴 |
| PRD-077 | Meeting History & Outcomes | P1 | 🔴 |
| PRD-078 | Account Profitability View | P2 | 🔴 |
| PRD-079 | Technical Environment Summary | P2 | 🔴 |
| PRD-080 | Custom Alert Configuration | P2 | 🔴 |
| PRD-081 | Account Notes Search | P2 | 🔴 |
| PRD-082 | Decision Maker Analysis | P1 | 🔴 |
| PRD-083 | Account Risk Factors Deep Dive | P1 | 🔴 |
| PRD-084 | Usage Anomaly Detection | P1 | 🔴 |
| PRD-085 | Account Readiness Assessment | P2 | 🔴 |

### Category D: Alerts & Triggers (30 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-086 | Usage Drop Alert → Check-In Workflow | P0 | 🔴 |
| PRD-087 | Support Ticket Spike → Escalation | P0 | 🔴 |
| PRD-088 | Champion Departure Alert | P0 | 🔴 |
| PRD-089 | Renewal Approaching → Prep Checklist | P0 | 🔴 |
| PRD-090 | Feature Adoption Stalled → Enablement | P1 | 🔴 |
| PRD-091 | NPS Score Drop → Recovery Workflow | P0 | 🔴 |
| PRD-092 | Invoice Overdue → Collections Alert | P1 | 🔴 |
| PRD-093 | Contract Auto-Renewal → Review Trigger | P1 | 🔴 |
| PRD-094 | Competitor Mentioned → Battle Card | P1 | 🔴 |
| PRD-095 | Executive Change Detected | P1 | 🔴 |
| PRD-096 | Company News Alert | P2 | 🔴 |
| PRD-097 | Product Issue Alert | P0 | 🔴 |
| PRD-098 | Onboarding Stalled → Intervention | P0 | 🔴 |
| PRD-099 | High-Value Feature Released | P1 | 🔴 |
| PRD-100 | Login Pattern Change | P1 | 🔴 |
| PRD-101 | Integration Disconnected | P0 | 🔴 |
| PRD-102 | Support Satisfaction Drop | P1 | 🔴 |
| PRD-103 | Expansion Signal Detected | P0 | 🔴 |
| PRD-104 | Training Completion Alert | P2 | 🔴 |
| PRD-105 | Multi-Account Pattern Alert | P2 | 🔴 |
| PRD-106 | Quiet Account Alert | P1 | 🔴 |
| PRD-107 | Health Score Threshold Alert | P0 | 🔴 |
| PRD-108 | Contract Amendment Needed | P1 | 🔴 |
| PRD-109 | Key Date Reminder | P1 | 🔴 |
| PRD-110 | Billing Change Alert | P2 | 🔴 |
| PRD-111 | User Growth Alert | P1 | 🔴 |
| PRD-112 | Feature Request Update | P2 | 🔴 |
| PRD-113 | Risk Score Calculation | P1 | 🔴 |
| PRD-114 | Customer Milestone Alert | P2 | 🔴 |
| PRD-115 | Seasonal Review Alert | P2 | 🔴 |

### Category E: Automation (35 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-116 | Post-Call Processing | P0 | 🔴 |
| PRD-117 | New Customer Assignment → Onboarding | P0 | 🔴 |
| PRD-118 | Health Score Change → Playbook Selection | P0 | 🔴 |
| PRD-119 | Expansion Signal → Sales Routing | P0 | 🔴 |
| PRD-120 | QBR Scheduling → Auto-Prep | P0 | 🔴 |
| PRD-121 | Escalation Logged → War Room | P0 | 🔴 |
| PRD-122 | Support Ticket → CSM Visibility | P1 | 🔴 |
| PRD-123 | Contract Signed → Implementation | P0 | 🔴 |
| PRD-124 | Churn Detected → Post-Mortem | P1 | 🔴 |
| PRD-125 | Invoice Generated → CSM Notification | P2 | 🔴 |
| PRD-126 | Product Update → Impact Assessment | P1 | 🔴 |
| PRD-127 | Meeting Booked → Pre-Meeting Research | P1 | 🔴 |
| PRD-128 | Feedback Received → Routing | P1 | 🔴 |
| PRD-129 | Reference Needed → Match + Request | P2 | 🔴 |
| PRD-130 | Upsell Closed → Success Measurement | P1 | 🔴 |
| PRD-131 | CSM Out of Office → Coverage | P1 | 🔴 |
| PRD-132 | Account Team Change → Update Propagation | P2 | 🔴 |
| PRD-133 | Data Quality Issue → Cleanup | P2 | 🔴 |
| PRD-134 | Competitive Deal Outcome → Analysis | P2 | 🔴 |
| PRD-135 | Customer Event Attended → Follow-Up | P2 | 🔴 |
| PRD-136 | Risk Mitigation Complete → Status Update | P2 | 🔴 |
| PRD-137 | Goal Achieved → Success Documentation | P2 | 🔴 |
| PRD-138 | Contract Renewal Complete → Planning | P1 | 🔴 |
| PRD-139 | Integration Added → Health Check | P2 | 🔴 |
| PRD-140 | User Offboarded → License Reclaim | P2 | 🔴 |
| PRD-141 | Bulk Email Sent → Engagement Tracking | P2 | 🔴 |
| PRD-142 | Survey Completed → Analysis + Action | P1 | 🔴 |
| PRD-143 | Training Scheduled → Reminder Sequence | P2 | 🔴 |
| PRD-144 | Renewal Won → Celebration + Planning | P2 | 🔴 |
| PRD-145 | Support SLA Breach → Escalation | P0 | 🔴 |
| PRD-146 | Custom Object Created → Workflow | P3 | 🔴 |
| PRD-147 | Bulk Task Creation → Portfolio Actions | P2 | 🔴 |
| PRD-148 | Report Generated → Distribution | P2 | 🔴 |
| PRD-149 | Playbook Completed → Next Selection | P2 | 🔴 |
| PRD-150 | End of Day → Daily Summary | P1 | 🔴 |

### Category F: Reporting (30 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-151 | Personal Weekly Summary Report | P0 | 🔴 |
| PRD-152 | Churn Analysis Report | P0 | 🔴 |
| PRD-153 | Health Score Portfolio View | P0 | 🔴 |
| PRD-154 | Onboarding Funnel Report | P1 | 🔴 |
| PRD-155 | Expansion Pipeline Report | P0 | 🔴 |
| PRD-156 | Support Metrics Dashboard | P1 | 🔴 |
| PRD-157 | Engagement Metrics Report | P1 | 🔴 |
| PRD-158 | Revenue Analytics Report | P1 | 🔴 |
| PRD-159 | Product Adoption Report | P1 | 🔴 |
| PRD-160 | Customer Effort Score Report | P2 | 🔴 |
| PRD-161 | Time Allocation Analysis | P2 | 🔴 |
| PRD-162 | Account Coverage Report | P1 | 🔴 |
| PRD-163 | Renewal Forecast Report | P0 | 🔴 |
| PRD-164 | At-Risk Accounts Report | P0 | 🔴 |
| PRD-165 | Success Metrics Report | P1 | 🔴 |
| PRD-166 | Meeting Analytics Report | P2 | 🔴 |
| PRD-167 | Email Performance Report | P2 | 🔴 |
| PRD-168 | Playbook Effectiveness Report | P2 | 🔴 |
| PRD-169 | Customer Cohort Analysis | P2 | 🔴 |
| PRD-170 | Trend Analysis Report | P1 | 🔴 |
| PRD-171 | Benchmark Report | P2 | 🔴 |
| PRD-172 | Activity Feed Analysis | P2 | 🔴 |
| PRD-173 | Customer Lifetime Value Report | P1 | 🔴 |
| PRD-174 | Net Revenue Retention Report | P0 | 🔴 |
| PRD-175 | Customer Segmentation Analysis | P1 | 🔴 |
| PRD-176 | Predictive Analytics Report | P2 | 🔴 |
| PRD-177 | Year-over-Year Comparison | P2 | 🔴 |
| PRD-178 | Team Performance Dashboard | P1 | 🔴 |
| PRD-179 | Executive Summary Report | P0 | 🔴 |
| PRD-180 | Custom Report Builder | P2 | 🔴 |

### Category G: Integrations (30 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-181 | Salesforce Bi-Directional Sync | P0 | 🔴 |
| PRD-182 | HubSpot Integration | P1 | 🔴 |
| PRD-183 | Gainsight Data Pull | P1 | 🔴 |
| PRD-184 | Zendesk Ticket Integration | P1 | 🔴 |
| PRD-185 | Intercom Conversation Sync | P2 | 🔴 |
| PRD-186 | Slack Notification Integration | P0 | 🔴 |
| PRD-187 | Microsoft Teams Integration | P1 | 🔴 |
| PRD-188 | Google Calendar Sync | P0 | 🔴 |
| PRD-189 | Outlook Calendar Integration | P1 | 🔴 |
| PRD-190 | Gmail Integration | P0 | 🔴 |
| PRD-191 | Outreach.io Sequence Trigger | P2 | 🔴 |
| PRD-192 | Salesloft Cadence Integration | P2 | 🔴 |
| PRD-193 | Gong Call Intelligence | P1 | 🔴 |
| PRD-194 | Chorus.ai Integration | P2 | 🔴 |
| PRD-195 | Pendo Usage Data | P1 | 🔴 |
| PRD-196 | Amplitude Analytics Sync | P2 | 🔴 |
| PRD-197 | Mixpanel Integration | P2 | 🔴 |
| PRD-198 | Segment Data Sync | P2 | 🔴 |
| PRD-199 | Stripe Billing Integration | P1 | 🔴 |
| PRD-200 | Chargebee Subscription Management | P2 | 🔴 |
| PRD-201 | Jira Issue Tracking | P1 | 🔴 |
| PRD-202 | Linear Issue Integration | P2 | 🔴 |
| PRD-203 | Notion Documentation Sync | P2 | 🔴 |
| PRD-204 | Confluence Knowledge Base | P2 | 🔴 |
| PRD-205 | DocuSign Contract Management | P1 | 🔴 |
| PRD-206 | PandaDoc Integration | P2 | 🔴 |
| PRD-207 | Loom Video Integration | P3 | 🔴 |
| PRD-208 | Calendly Scheduling | P2 | 🔴 |
| PRD-209 | Zoom Meeting Management | P0 | 🔴 |
| PRD-210 | Zapier Webhook Integration | P2 | 🔴 |

### Category H: AI Features (30 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-211 | Natural Language Account Query | P0 | 🔴 |
| PRD-212 | Conversational Report Building | P1 | 🔴 |
| PRD-213 | AI Meeting Summarization | P0 | 🔴 |
| PRD-214 | Intelligent Task Prioritization | P1 | 🔴 |
| PRD-215 | Smart Email Response Suggestions | P0 | 🔴 |
| PRD-216 | Predictive Churn Scoring | P0 | 🔴 |
| PRD-217 | Automated Insight Generation | P1 | 🔴 |
| PRD-218 | Real-Time Sentiment Analysis | P1 | 🔴 |
| PRD-219 | AI-Powered Universal Search | P1 | 🔴 |
| PRD-220 | Automated Data Enrichment | P2 | 🔴 |
| PRD-221 | Intelligent Alert Filtering | P1 | 🔴 |
| PRD-222 | Document Understanding & Extraction | P1 | 🔴 |
| PRD-223 | Conversation Context Retention | P0 | 🔴 |
| PRD-224 | Multi-Language Support | P2 | 🔴 |
| PRD-225 | Voice Note Transcription | P2 | 🔴 |
| PRD-226 | Smart Follow-Up Timing | P1 | 🔴 |
| PRD-227 | Relationship Strength Scoring | P1 | 🔴 |
| PRD-228 | Content Recommendation Engine | P2 | 🔴 |
| PRD-229 | Deal Risk Assessment | P1 | 🔴 |
| PRD-230 | Competitive Intelligence Gathering | P2 | 🔴 |
| PRD-231 | Customer Health Prediction | P0 | 🔴 |
| PRD-232 | Automated Playbook Selection | P1 | 🔴 |
| PRD-233 | Smart Meeting Prep | P1 | 🔴 |
| PRD-234 | Natural Language Task Creation | P1 | 🔴 |
| PRD-235 | AI-Powered Account Planning | P2 | 🔴 |
| PRD-236 | Intelligent Escalation Routing | P1 | 🔴 |
| PRD-237 | Customer Journey Optimization | P2 | 🔴 |
| PRD-238 | Expansion Propensity Modeling | P1 | 🔴 |
| PRD-239 | AI Coach for CSMs | P2 | 🔴 |
| PRD-240 | Automated Success Story Drafting | P2 | 🔴 |

### Category I: Collaboration (20 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-241 | @Mention Team Members | P0 | 🔴 |
| PRD-242 | Shared Account Views | P1 | 🔴 |
| PRD-243 | Internal Escalation Workflow | P0 | 🔴 |
| PRD-244 | Deal Desk Integration | P1 | 🔴 |
| PRD-245 | Technical Resource Request | P1 | 🔴 |
| PRD-246 | Executive Sponsor Assignment | P2 | 🔴 |
| PRD-247 | Team Handoff Workflow | P0 | 🔴 |
| PRD-248 | Collaborative Notes | P1 | 🔴 |
| PRD-249 | Internal Discussion Thread | P2 | 🔴 |
| PRD-250 | Expertise Tagging | P2 | 🔴 |
| PRD-251 | Resource Scheduling | P2 | 🔴 |
| PRD-252 | War Room Coordination | P1 | 🔴 |
| PRD-253 | Peer Review Workflow | P2 | 🔴 |
| PRD-254 | Best Practice Sharing | P2 | 🔴 |
| PRD-255 | Mentor Assignment | P3 | 🔴 |
| PRD-256 | Team Meeting Prep | P2 | 🔴 |
| PRD-257 | Cross-Functional Alignment | P2 | 🔴 |
| PRD-258 | Coverage Backup System | P1 | 🔴 |
| PRD-259 | Knowledge Capture | P2 | 🔴 |
| PRD-260 | Team Goal Tracking | P2 | 🔴 |

### Category J: Mobile & Accessibility (15 PRDs)
| PRD | Title | Priority | Status |
|-----|-------|----------|--------|
| PRD-261 | Mobile-Optimized Chat UI | P1 | 🔴 |
| PRD-262 | Push Notifications | P1 | 🔴 |
| PRD-263 | Offline Access | P2 | 🔴 |
| PRD-264 | Voice Command Support | P3 | 🔴 |
| PRD-265 | Quick Actions Widget | P2 | 🔴 |
| PRD-266 | Apple Watch Integration | P3 | 🔴 |
| PRD-267 | Mobile Document Scanning | P2 | 🔴 |
| PRD-268 | Location-Based Reminders | P3 | 🔴 |
| PRD-269 | Mobile Meeting Notes | P2 | 🔴 |
| PRD-270 | Accessibility Compliance (WCAG) | P0 | 🔴 |
| PRD-271 | Screen Reader Optimization | P1 | 🔴 |
| PRD-272 | Keyboard Navigation | P1 | 🔴 |
| PRD-273 | High Contrast Mode | P2 | 🔴 |
| PRD-274 | Font Size Customization | P2 | 🔴 |
| PRD-275 | Reduced Motion Option | P2 | 🔴 |

---

## Ralph Loop Commands

### Single PRD Implementation
```bash
/ralph-loop "Implement PRD-001 from /prds/scenarios/category-a-documents/PRD-001-csv-churn-email.md" --completion-promise "PRD-001-COMPLETE" --max-iterations 30
```

### Category Batch
```bash
/ralph-loop "Implement all Category A PRDs (PRD-001 to PRD-025)" --completion-promise "CATEGORY-A-COMPLETE" --max-iterations 150
```

### P0 Priority
```bash
/ralph-loop "Implement all P0 PRDs across categories" --completion-promise "P0-COMPLETE" --max-iterations 200
```
