# CSCX Production Readiness Checklist

**Target Launch Date**: TBD
**Status**: 🔴 IN PROGRESS

---

## Master Checklist

### PRD-0: Contract Parsing + Entitlements
- [ ] Contract upload via Chat UI
- [ ] Contract upload via KB UI
- [ ] PDF/DOCX/Google Docs parsing
- [ ] Entitlements extraction and normalization
- [ ] HITL review UI
- [ ] Entitlements versioning
- [ ] Chat queryable entitlements
- [ ] Unit tests (6+ fixtures)
- [ ] E2E tests
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-1: Gated Login + Onboarding + Import
- [ ] Google OAuth implementation
- [ ] Invite code gating system
- [ ] Invite code management (create, revoke, expire)
- [ ] Post-login redirect to Chat UI
- [ ] First-run onboarding checklist
- [ ] Welcome system message
- [ ] Google Sheets import
- [ ] CSV import
- [ ] Column mapping UI
- [ ] Deduplication logic
- [ ] Import error reporting
- [ ] Unit tests
- [ ] E2E tests
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-2: Unified Knowledge Base
- [ ] Google Drive OAuth connection
- [ ] Folder selection UI
- [ ] Initial sync implementation
- [ ] Incremental sync (manual)
- [ ] Chat upload auto-ingestion
- [ ] Generated artifact mirroring
- [ ] KB UI (Workspace/Personal tabs)
- [ ] Filters and search
- [ ] Chat retrieval with citations
- [ ] Permission enforcement
- [ ] Unit tests
- [ ] E2E tests
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-3: Agent Inbox
- [ ] Action record schema
- [ ] Action creation from chat workflows
- [ ] Agent Inbox UI (list + detail)
- [ ] Approve/Reject/Rerun buttons
- [ ] Status lifecycle (proposed→approved→executed)
- [ ] Timeline/audit trail view
- [ ] Policy configuration (which actions require approval)
- [ ] Chat integration (pending review indicator)
- [ ] Unit tests
- [ ] E2E tests
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-4: Support Tickets
- [ ] Support entry point in Chat UI
- [ ] Ticket submission form/flow
- [ ] Screenshot/file attachments
- [ ] Auto-capture (version, browser, user, workspace)
- [ ] Ticket appears in Admin Agent Inbox
- [ ] Auto-generated Claude CLI troubleshoot prompt
- [ ] Ticket lifecycle management
- [ ] Unit tests
- [ ] E2E tests
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-5: Admin Dashboard
- [ ] Admin role gating
- [ ] Overview KPIs (DAU, actions, errors, latency)
- [ ] Per-agent metrics
- [ ] Token consumption tracking
- [ ] Job health monitoring
- [ ] Support ticket stats
- [ ] Drill-down views
- [ ] CSV export
- [ ] Unit tests
- [ ] E2E tests
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-6: Production Deployment
- [ ] Deployment platform decision (Vercel vs GCP)
- [ ] Staging environment configured
- [ ] Production environment configured
- [ ] Domain attached
- [ ] HTTPS/TLS configured
- [ ] Secrets management
- [ ] CI/CD pipeline complete
- [ ] Rollback procedure documented
- [ ] Rollback tested
- [ ] Staging smoke tests pass
- [ ] Production smoke tests pass

### PRD-7: Production Hardening
- [ ] All core flows working E2E
- [ ] Strong error handling
- [ ] Input validation on all APIs
- [ ] Rate limiting (per-user)
- [ ] Job reliability (retries, idempotency)
- [ ] Safe migrations
- [ ] Performance budget checks
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass

### PRD-8: Testing Strategy
- [ ] TEST_STRATEGY.md documented
- [ ] Unit test coverage ≥70%
- [ ] Integration tests for all services
- [ ] E2E tests for all core flows
- [ ] Contract parsing fixture tests
- [ ] Agent Inbox tests
- [ ] Support ticket tests
- [ ] Admin dashboard tests
- [ ] Security checks (dep audit, lint, typecheck)
- [ ] CI blocks on failures
- [ ] `npm run test:all` command works

### PRD-9: Observability
- [ ] Structured logging (request ID, user ID, etc.)
- [ ] Error tracking integration
- [ ] Latency metrics
- [ ] Error rate metrics
- [ ] Job health metrics
- [ ] KB ingestion metrics
- [ ] Agent action metrics
- [ ] Health checks
- [ ] Readiness checks
- [ ] Alerts configured
- [ ] Runbooks documented

### PRD-10: Security
- [ ] Secure session management
- [ ] CSRF protection
- [ ] Strict CORS
- [ ] Secure headers
- [ ] Cloud secret management
- [ ] Database backups configured
- [ ] Backup restore tested
- [ ] Multi-tenant isolation tests
- [ ] Least privilege IAM
- [ ] Data retention policies documented
- [ ] Upload security (file validation, size limits)

---

## Environment Status

### Staging
- **URL**: TBD
- **Status**: 🔴 Not configured
- **Last Deploy**: N/A
- **Smoke Tests**: N/A

### Production
- **URL**: https://cscx-api-938520514616.us-central1.run.app
- **Domain**: TBD (custom domain pending)
- **Status**: 🟡 MVP deployed
- **Last Deploy**: N/A
- **Smoke Tests**: N/A

---

## Launch Blockers

### Critical
1. [ ] Invite code gating (PRD-1) - unauthorized access risk
2. [ ] Contract parsing (PRD-0) - core feature incomplete
3. [ ] Agent Inbox (PRD-3) - HITL approval required
4. [ ] Test coverage ≥70% (PRD-8) - regression risk
5. [ ] Custom domain + HTTPS (PRD-6) - professional launch

### Important
1. [ ] Knowledge Base sync (PRD-2) - key differentiator
2. [ ] Support tickets (PRD-4) - partner support
3. [ ] Admin dashboard (PRD-5) - operational visibility
4. [ ] Observability (PRD-9) - production monitoring
5. [ ] Security hardening (PRD-10) - data protection

---

## Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Engineering | Claude Code | - | 🔴 Pending |
| Product | Aziz Camara | - | 🔴 Pending |
| Security | - | - | 🔴 Pending |
| Ops | - | - | 🔴 Pending |

---

## Release Notes

Will be updated after each PRD completion.

### PRD-0 Release
- Date: TBD
- Commit: TBD
- [Release Notes](./2026-XX-XX_prd0_release.md)

### PRD-1 Release
- Date: TBD
- Commit: TBD
- [Release Notes](./2026-XX-XX_prd1_release.md)

(Continue for PRD-2 through PRD-10)

---

## Final Launch Criteria

- [ ] All PRDs complete and deployed
- [ ] All smoke tests passing
- [ ] Zero P0/P1 bugs open
- [ ] Custom domain configured
- [ ] HTTPS working
- [ ] Monitoring alerts configured
- [ ] Runbooks complete
- [ ] Support SOP documented
- [ ] Design partner invites ready

**LAUNCH READY**: 🔴 NO
