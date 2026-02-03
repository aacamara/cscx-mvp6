# CSCX.AI Production Deployment Plan

## Executive Summary

Goal: Deploy CSCX.AI to production where customer success professionals can use the platform without issues. All features must work end-to-end.

**Owner:** Claude (autonomous execution via Ralph Loop)
**Target:** Production-ready deployment with domain attachment

---

## Deployment Recommendation: Google Cloud Run + Vercel

### Frontend: Vercel (Recommended)
- **Why Vercel:**
  - Zero-config deployment for Vite/React
  - Automatic HTTPS and CDN
  - Preview deployments for testing
  - Easy custom domain setup
  - Free tier sufficient for launch
  - Instant rollbacks

### Backend: Google Cloud Run (Recommended)
- **Why Cloud Run:**
  - You already have a Google Cloud account
  - Serverless scaling (pay per use)
  - Easy container deployment
  - Integrates with Supabase
  - Supports environment variables securely
  - Custom domain support

### Database: Supabase (Already configured)
- PostgreSQL with RLS
- Auth already set up
- Real-time subscriptions available

---

## PRD Execution Order

| Priority | PRD | Description | Status |
|----------|-----|-------------|--------|
| 1 | PRD-CONTRACTS | Robust contract parsing for varied formats | PENDING |
| 2 | PRD-DATABASE | Database schema completeness & data integrity | PENDING |
| 3 | PRD-BACKEND | Backend API testing & fixes | PENDING |
| 4 | PRD-FRONTEND | Frontend integration testing & fixes | PENDING |
| 5 | PRD-E2E | End-to-end workflow testing | PENDING |
| 6 | PRD-DEPLOY | Production deployment configuration | PENDING |

---

## PRD-CONTRACTS: Robust Contract Parsing

### Problem
Contract parsing needs to handle diverse contract formats:
- Different industries (SaaS, Enterprise, Healthcare, Finance)
- Varied entitlement structures (seats, usage, features, modules)
- Multiple stakeholder formats
- Different date formats and contract terms

### User Stories
1. Parse contracts with varied entitlement types (seats, API calls, storage, users)
2. Handle multiple date formats (US, EU, ISO)
3. Extract stakeholders from various formats (tables, lists, signatures)
4. Map entitlements to customer record correctly
5. Handle missing/partial information gracefully

---

## PRD-DATABASE: Schema & Data Integrity

### Checklist
- [ ] All required tables exist
- [ ] Foreign key relationships are correct
- [ ] RLS policies are in place
- [ ] Indexes for performance
- [ ] Demo data is seeded
- [ ] No orphaned records

### Tables to Verify
- customers (with is_demo, owner_id)
- contracts
- user_profiles
- workspace_members
- invite_codes
- agent_activity_log
- chat_messages
- plan_tasks

---

## PRD-BACKEND: API Testing

### Endpoints to Test
- [ ] GET /api/customers
- [ ] GET /api/customers/:id
- [ ] POST /api/customers
- [ ] POST /api/customers/from-contract
- [ ] POST /api/customers/import-csv
- [ ] GET /api/customers/template
- [ ] POST /api/auth/validate-invite
- [ ] POST /api/auth/provision-admin
- [ ] POST /api/contracts/parse
- [ ] POST /api/langchain/chat
- [ ] Google OAuth flow

---

## PRD-FRONTEND: Integration Testing

### Flows to Test
- [ ] Login with invite code
- [ ] Admin direct login
- [ ] Navigation (admin vs design partner)
- [ ] Customer list with filtering
- [ ] Customer detail view
- [ ] Contract upload & parsing
- [ ] CSV import flow
- [ ] Agent chat functionality
- [ ] Mock onboarding demo

---

## PRD-E2E: End-to-End Workflows

### Critical User Journeys
1. **New Design Partner Signup**
   - Enter invite code → OAuth → Welcome modal → Explore demos

2. **Contract-Based Onboarding**
   - Upload contract → AI extraction → Review → Create customer → Chat

3. **CSV Bulk Import**
   - Download template → Fill data → Upload → Preview → Import

4. **Agent Interaction**
   - Select customer → Ask question → Get AI response → Approve action

---

## PRD-DEPLOY: Production Configuration

### Vercel (Frontend)
- [ ] Create vercel.json configuration
- [ ] Set environment variables
- [ ] Configure custom domain
- [ ] Enable analytics

### Google Cloud Run (Backend)
- [ ] Create Dockerfile
- [ ] Create cloudbuild.yaml
- [ ] Set up service account
- [ ] Configure secrets
- [ ] Set up custom domain

### Environment Variables Needed
```
# Frontend (Vercel)
VITE_API_URL=https://api.cscx.ai
VITE_SUPABASE_URL=xxx
VITE_SUPABASE_ANON_KEY=xxx

# Backend (Cloud Run)
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GEMINI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

---

## Success Criteria

1. **Functional:** All features work without errors
2. **Performance:** Pages load in <3 seconds
3. **Security:** Auth works, RLS enforced, no exposed secrets
4. **Reliability:** No console errors, graceful error handling
5. **Usability:** Design partners can complete full workflow

---

## Post-Deployment Checklist

- [ ] Custom domain attached (cscx.ai or similar)
- [ ] SSL certificate active
- [ ] Monitoring/alerts configured
- [ ] Error tracking (Sentry optional)
- [ ] Analytics tracking
- [ ] Backup strategy documented

---

## LinkedIn Launch Announcement Template

```
🚀 Excited to announce CSCX.AI is now live!

After months of building, our AI-powered Customer Success platform is ready for you to try.

What CSCX.AI does:
✅ AI-powered customer onboarding from contracts
✅ Intelligent health scoring & risk detection
✅ Automated email drafting & meeting prep
✅ 360° customer views with actionable insights

Looking for design partners to shape the future of CS.

Try it free: [URL]

#CustomerSuccess #AI #SaaS #Launch
```
