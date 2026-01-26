# End-to-End Test Scenario: CSCX.AI Agent Platform

## Test Overview
This document provides a complete end-to-end test scenario for all 5 CS Agents with their 20 quick actions.

---

## Pre-requisites

1. **Server Running**: `http://localhost:3001`
2. **Frontend Running**: `http://localhost:3002`
3. **Google Connected**: User `df2dc7be-ece0-40b2-a9d7-0f6c45b75131` has Google OAuth tokens
4. **Test Customer**: Acme Corporation (`8b1add53-0233-46f3-aa86-458a37cbeaad`)

---

## Test Scenario: "Acme Corporation Health Crisis"

### Background Story
Acme Corporation is a $150K ARR customer with health score of 92. The CSM team needs to:
1. Analyze their usage patterns
2. Prepare for upcoming QBR
3. Assess any renewal risks
4. Create strategic account plans

---

## Phase 1: Adoption Specialist Agent

### Test 1.1: Run Usage Analysis
**Action**: `usage_analysis`
**Expected Output**:
- ✅ Google Sheet with 30 days of usage metrics
- ✅ `[AI Generated]` insights section
- ✅ `[Knowledge Base]` content from playbooks
- ✅ Apps Script doc for Usage Dashboard

**Verify**:
- [ ] Sheet contains DAU, WAU, MAU columns
- [ ] AI insights are tagged with `[AI Generated]`
- [ ] Knowledge base sources listed
- [ ] Apps Script code is deployable

### Test 1.2: Launch Adoption Campaign
**Action**: `adoption_campaign`
**Expected Output**:
- ✅ Email drafts created (awaiting approval)
- ✅ Campaign targeting low-adoption features

### Test 1.3: Schedule Feature Training
**Action**: `feature_training`
**Expected Output**:
- ✅ Training plan document
- ✅ Calendar event scheduled

### Test 1.4: Build Champion Program
**Action**: `champion_program`
**Expected Output**:
- ✅ Champion identification sheet
- ✅ Program overview with potential champions

---

## Phase 2: Risk Management Agent

### Test 2.1: Run Risk Assessment
**Action**: `risk_assessment`
**Expected Output**:
- ✅ Risk assessment sheet
- ✅ `[AI Generated]` risk analysis
- ✅ `[Knowledge Base]` save play templates
- ✅ Health Calculator Apps Script

**Verify**:
- [ ] Risk level calculated (Low/Medium/High)
- [ ] Usage trend analyzed
- [ ] Recommended actions provided
- [ ] `[REVIEW NEEDED]` tags present

### Test 2.2: Run Health Check
**Action**: `health_check`
**Expected Output**:
- ✅ Same as risk_assessment (alias)

### Test 2.3: Create Save Play
**Action**: `save_play`
**Expected Output**:
- ✅ Save play document
- ✅ Action plan with timeline

### Test 2.4: Escalate Issue
**Action**: `escalation`
**Expected Output**:
- ✅ Escalation report (awaiting approval)
- ✅ Notification email draft

---

## Phase 3: Renewal Specialist Agent

### Test 3.1: Generate Renewal Forecast
**Action**: `renewal_forecast`
**Expected Output**:
- ✅ Forecast sheet with probability
- ✅ `[AI Generated]` renewal strategy
- ✅ `[Knowledge Base]` renewal playbook
- ✅ Renewal Alerts Apps Script

**Verify**:
- [ ] Probability percentage calculated
- [ ] ARR at risk shown if high risk
- [ ] Expansion potential identified
- [ ] Alert script includes 90/60/30/14/7 day triggers

### Test 3.2: Create Value Summary
**Action**: `value_summary`
**Expected Output**:
- ✅ Value summary document
- ✅ ROI calculations
- ✅ Success metrics

### Test 3.3: Analyze Expansion
**Action**: `expansion_analysis`
**Expected Output**:
- ✅ Expansion opportunities sheet
- ✅ Upsell/cross-sell recommendations

### Test 3.4: Start Renewal Playbook
**Action**: `renewal_playbook`
**Expected Output**:
- ✅ 120-day playbook document
- ✅ Milestone tracker sheet

---

## Phase 4: Strategic CSM Agent

### Test 4.1: Prepare QBR
**Action**: `qbr_prep`
**Expected Output**:
- ✅ QBR presentation (Slides)
- ✅ Metrics sheet with `[AI Generated]` insights
- ✅ `[Knowledge Base]` QBR best practices
- ✅ NPS Analysis + Survey Processor Apps Scripts

**Verify**:
- [ ] AI-generated talking points
- [ ] Suggested agenda included
- [ ] Both NPS and Survey scripts generated

### Test 4.2: Create Executive Briefing
**Action**: `exec_briefing`
**Expected Output**:
- ✅ Briefing document
- ✅ Executive summary slides

### Test 4.3: Build Account Plan
**Action**: `account_plan`
**Expected Output**:
- ✅ Annual account plan document
- ✅ Strategic objectives

### Test 4.4: Create Success Plan
**Action**: `success_plan`
**Expected Output**:
- ✅ Success plan document
- ✅ Measurable goals

---

## Phase 5: Onboarding Specialist Agent

### Test 5.1: Schedule Kickoff
**Action**: `kickoff`
**Expected Output**:
- ✅ Calendar event (3 days out)
- ✅ Google Meet link
- ✅ Kickoff deck (Slides)

### Test 5.2: Generate 30-60-90 Plan
**Action**: `plan_30_60_90`
**Expected Output**:
- ✅ Onboarding plan document
- ✅ Phase-by-phase milestones

### Test 5.3: Map Stakeholders
**Action**: `stakeholder_map`
**Expected Output**:
- ✅ Stakeholder sheet
- ✅ Roles and influence mapping

### Test 5.4: Send Welcome Sequence
**Action**: `welcome_sequence`
**Expected Output**:
- ✅ Email drafts (awaiting approval)
- ✅ Day 1, 3, 7, 14, 30 sequence

---

## Verification Checklist

### Google Drive Files Created
After running all tests, verify in Google Drive:
- [ ] Multiple sheets created
- [ ] Multiple docs created
- [ ] Presentation slides created
- [ ] Calendar events scheduled

### Database Records
Verify in Supabase `customer_documents` table:
- [ ] Documents linked to customer ID
- [ ] Correct document types recorded
- [ ] URLs are valid

### AI Content Tagging
In each output, verify:
- [ ] `[AI Generated]` sections present
- [ ] `[Knowledge Base: title]` sections present
- [ ] `[REVIEW NEEDED]` markers for CSM attention
- [ ] Source attribution in metadata

### Apps Script Code
Verify generated scripts include:
- [ ] Clear comments and documentation
- [ ] `[AI Generated]` header
- [ ] `[REVIEW NEEDED]` for configuration
- [ ] Setup instructions

---

## Quick Test Commands

```bash
# Test all 20 actions at once
for action in kickoff plan_30_60_90 stakeholder_map welcome_sequence \
              usage_analysis adoption_campaign feature_training champion_program \
              renewal_forecast value_summary expansion_analysis renewal_playbook \
              risk_assessment health_check save_play escalation \
              qbr_prep exec_briefing account_plan success_plan; do
  echo "Testing: $action"
  curl -s -X POST http://localhost:3001/api/workflows/execute-action \
    -H "Content-Type: application/json" \
    -d "{\"actionId\":\"$action\",\"userId\":\"df2dc7be-ece0-40b2-a9d7-0f6c45b75131\",\"agentType\":\"test\",\"customerId\":\"8b1add53-0233-46f3-aa86-458a37cbeaad\",\"customerName\":\"Acme Corporation\",\"customerARR\":150000,\"healthScore\":92}" \
    | jq '.execution.status'
done
```

---

## Expected Results Summary

| Agent | Actions | Expected Status |
|-------|---------|-----------------|
| Onboarding | 4 | 3 completed, 1 awaiting_approval |
| Adoption | 4 | 4 completed |
| Renewal | 4 | 4 completed |
| Risk | 4 | 3 completed, 1 awaiting_approval |
| Strategic | 4 | 4 completed |
| **Total** | **20** | **18 completed, 2 awaiting approval** |

---

## Troubleshooting

### "No Google tokens found"
- Ensure user has connected Google account
- Check `google_oauth_tokens` table in Supabase

### "File not found" errors
- Workspace folders may not exist
- Actions now create files in Drive root (no folder dependency)

### AI insights empty
- Check `ANTHROPIC_API_KEY` is configured
- Verify API quota not exceeded

### Knowledge base empty
- Run knowledge base seeder
- Check `csm_playbooks` table has content
