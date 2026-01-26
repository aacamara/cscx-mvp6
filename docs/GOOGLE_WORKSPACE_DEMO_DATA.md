# Google Workspace Demo Data Setup Guide

This guide helps you set up a demo Google Workspace account with the data structure that CSCX.AI agents expect. This enables full end-to-end workflows in production.

## Overview

Each agent workflow fetches data from and creates files in specific Google Workspace locations. For the MVP demo, you'll need to create this structure in your Google Workspace account.

---

## 1. Google Drive Folder Structure

Create the following folder structure in Google Drive:

```
My Drive/
└── CSCX Customers/
    └── CSCX - {Customer Name}/       # One folder per customer
        ├── 01 - Onboarding/
        ├── 02 - Meetings/
        ├── 03 - QBRs/
        ├── 04 - Contracts/
        └── 05 - Reports/
```

### Example for Demo Customer "Acme Corp":
```
CSCX - Acme Corp/
├── 01 - Onboarding/
│   ├── Kickoff Presentation - Acme Corp.slides
│   ├── Onboarding Plan - Acme Corp.docs
│   └── Training Materials - Acme Corp.docs
├── 02 - Meetings/
│   ├── Meeting Notes - 2024-01-15.docs
│   └── Meeting Notes - 2024-02-01.docs
├── 03 - QBRs/
│   ├── QBR Q4 2023 - Acme Corp.slides
│   └── QBR Metrics Q4 2023.sheets
├── 04 - Contracts/
│   ├── Master Service Agreement - Acme Corp.pdf
│   └── Order Form - 2024.pdf
└── 05 - Reports/
    ├── Health Assessment - 2024-01.docs
    └── Value Summary - Acme Corp.docs
```

---

## 2. Google Sheets - Required Spreadsheets

Create these spreadsheets with the specified tabs and columns:

### A. Customer Health Score Tracker

**File Name:** `Customer Health - Acme Corp`
**Location:** `CSCX - Acme Corp/05 - Reports/`

| Tab: Health Scores |
|---|
| Columns: Date | Overall Score | Usage Score | Engagement Score | Support Score | Sentiment Score | Risk Level |

**Sample Data:**
```
Date        | Overall | Usage | Engagement | Support | Sentiment | Risk
2024-01-01  | 85      | 90    | 82         | 88      | 80        | Low
2024-01-15  | 82      | 85    | 80         | 85      | 78        | Low
2024-02-01  | 78      | 75    | 76         | 82      | 79        | Medium
```

### B. Usage Metrics Tracker

**File Name:** `Usage Metrics - Acme Corp`
**Location:** `CSCX - Acme Corp/05 - Reports/`

| Tab: Daily Usage |
|---|
| Columns: Date | Active Users | Sessions | Features Used | API Calls | Errors |

| Tab: Feature Adoption |
|---|
| Columns: Feature Name | Total Users | Active Users | Adoption % | Last Used |

**Sample Data (Daily Usage):**
```
Date        | Active Users | Sessions | Features Used | API Calls | Errors
2024-01-01  | 45           | 120      | 8             | 5,200     | 12
2024-01-02  | 42           | 115      | 7             | 4,800     | 8
...
```

**Sample Data (Feature Adoption):**
```
Feature Name    | Total Users | Active Users | Adoption % | Last Used
Dashboard       | 50          | 48           | 96%        | Today
Reporting       | 50          | 35           | 70%        | Yesterday
Integrations    | 50          | 20           | 40%        | 3 days ago
API Access      | 50          | 15           | 30%        | 1 week ago
```

### C. Renewal Tracker

**File Name:** `Renewal Tracker - Acme Corp`
**Location:** `CSCX - Acme Corp/05 - Reports/`

| Tab: Renewal Info |
|---|
| Columns: Customer | ARR | Start Date | End Date | Days to Renewal | Renewal Probability | Expansion Potential |

**Sample Data:**
```
Customer   | ARR      | Start Date | End Date   | Days | Probability | Expansion
Acme Corp  | $150,000 | 2023-03-15 | 2024-03-14 | 45   | 85%         | $50,000
```

---

## 3. Gmail - Sample Email Threads

For the demo, send/receive emails that contain:

### Required Email Content:

1. **Stakeholder Communications**
   - Emails from/to customer stakeholders
   - Subject lines containing customer name
   - Discussion of product usage, features, meetings

2. **Support Threads**
   - Subject containing "support" or "help" or "issue"
   - Problem descriptions and resolutions

3. **Success Indicators**
   - Subject containing "thank" or "great" or "success"
   - Positive feedback from customers

4. **Meeting Follow-ups**
   - Subject containing "meeting" or "follow-up"
   - Notes from customer interactions

### Sample Email Subjects:
- "Re: Acme Corp - Q1 Planning Discussion"
- "Support Request: Dashboard Loading Issues"
- "Thanks for the great training session!"
- "Follow-up: QBR Meeting Action Items"

---

## 4. Google Calendar - Sample Events

Create calendar events for demo customers:

### Required Event Types:

1. **QBR Meetings**
   - Title: "QBR - {Customer Name}"
   - Duration: 60 minutes
   - Include customer attendees

2. **Training Sessions**
   - Title: "Training: {Feature} - {Customer Name}"
   - Duration: 30-60 minutes

3. **Check-in Calls**
   - Title: "Check-in - {Customer Name}"
   - Duration: 30 minutes

4. **Kickoff Meetings**
   - Title: "Kickoff - {Customer Name}"
   - Duration: 60-90 minutes

### Sample Calendar Events:
```
Event                           | Date/Time           | Duration | Attendees
QBR - Acme Corp                 | 2024-02-15 10:00am | 60 min   | sarah@acme.com
Training: Dashboard - Acme Corp | 2024-02-20 2:00pm  | 45 min   | mike@acme.com
Check-in - Acme Corp            | 2024-02-22 11:00am | 30 min   | sarah@acme.com
```

---

## 5. Apps Script Automations (Optional)

For advanced demos, you can deploy these Apps Scripts:

### Health Score Calculator
- Attached to: Usage Metrics spreadsheet
- Function: Calculate health scores based on usage data
- Trigger: Daily

### Renewal Alert
- Function: Send email alerts at 90/60/30/7 days before renewal
- Trigger: Daily

---

## 6. Demo Customer Data

Create at least 3 demo customers with varying characteristics:

### Customer 1: Acme Corp (Healthy)
- ARR: $150,000
- Health Score: 85
- Renewal: 45 days
- Status: Healthy, potential expansion

### Customer 2: TechStart (At Risk)
- ARR: $75,000
- Health Score: 62
- Renewal: 30 days
- Status: At risk, declining usage

### Customer 3: Global Inc (Strategic)
- ARR: $500,000
- Health Score: 78
- Renewal: 90 days
- Status: Strategic account, QBR needed

---

## 7. Google OAuth Configuration

### Required Scopes:
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/presentations
https://www.googleapis.com/auth/script.projects
```

### Environment Variables:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/oauth/callback
```

---

## 8. Workflow → Data Mapping

| Workflow | Data Sources |
|----------|-------------|
| Generate Renewal Forecast | Health Score Sheet, Usage Metrics, Contracts folder, Customer emails |
| Create QBR Package | Usage Metrics, Past QBRs folder, Calendar events |
| Run Health Assessment | Health Score Sheet, Usage Metrics, Support emails, Meeting history |
| Create Save Play | Health Score Sheet, All customer emails, Contracts |
| Build Value Summary | Usage Metrics, Success emails, QBR history |
| Create Account Plan | All sheets, All folders, Emails, Calendar |

---

## Quick Setup Checklist

- [ ] Create Google Cloud Project with OAuth credentials
- [ ] Enable required Google APIs (Gmail, Calendar, Drive, Docs, Sheets, Slides)
- [ ] Create CSCX Customers folder in Drive
- [ ] Create demo customer folders (Acme Corp, TechStart, Global Inc)
- [ ] Create Health Score spreadsheet per customer
- [ ] Create Usage Metrics spreadsheet per customer
- [ ] Create Renewal Tracker spreadsheet
- [ ] Send sample emails to/from demo addresses
- [ ] Create sample calendar events
- [ ] Upload sample contract PDFs
- [ ] Set environment variables in server

---

## Testing Workflows

After setup, test each agent workflow:

1. **Renewal Agent - Generate Forecast**
   ```bash
   curl -X POST http://localhost:3001/api/workflows/execute \
     -H "Content-Type: application/json" \
     -d '{
       "workflowId": "generate_renewal_forecast",
       "userId": "demo-user",
       "agentType": "renewal",
       "customerId": "acme-corp",
       "customerName": "Acme Corp",
       "customerARR": 150000
     }'
   ```

2. Check execution status
3. Review created files in Drive
4. Approve/reject in chat
