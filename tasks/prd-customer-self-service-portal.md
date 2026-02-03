# PRD: Customer Self-Service Portal

## Introduction

The Customer Self-Service Portal provides customers with a branded interface to access training materials, submit feedback, view their success plan, and interact with support—all without requiring CSM intervention. This scales CS operations by deflecting routine requests while improving customer experience through 24/7 availability.

This addresses the scalability challenge: CSMs can't personally handle every training question, document request, and feedback submission for a growing customer base.

## Goals

- Provide 24/7 self-service access to training and documentation
- Enable customers to submit feedback (NPS, CSAT, feature requests)
- Show customers their success plan and onboarding progress
- Reduce CSM time spent on routine requests by 50%
- Improve customer satisfaction through instant access
- Maintain brand consistency with white-label customization

## User Stories

### US-001: Customer portal login
**Description:** As a customer stakeholder, I want to log into my company's portal so that I can access self-service features.

**Acceptance Criteria:**
- [ ] Magic link authentication (email-based, no password)
- [ ] Login restricted to stakeholders in customer record
- [ ] Session duration: 30 days with remember me
- [ ] Company branding on login page (logo, colors)
- [ ] Redirect to dashboard after login
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Training library
**Description:** As a customer user, I want to access training materials so that I can learn the product independently.

**Acceptance Criteria:**
- [ ] Training library with categorized content
- [ ] Content types: video, PDF, interactive tutorial
- [ ] Search functionality
- [ ] Progress tracking (completed, in progress, not started)
- [ ] Recommended next training based on role
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Knowledge base access
**Description:** As a customer user, I want to search the knowledge base so that I can find answers quickly.

**Acceptance Criteria:**
- [ ] Searchable knowledge base articles
- [ ] Category browsing
- [ ] Related articles suggestions
- [ ] Article feedback (helpful/not helpful)
- [ ] Contact support escalation from article
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Success plan view
**Description:** As a customer champion, I want to see our success plan so that I understand our goals and progress.

**Acceptance Criteria:**
- [ ] View onboarding milestones and completion status
- [ ] View 30-60-90 day goals
- [ ] View quarterly objectives (if set)
- [ ] Progress percentage visualization
- [ ] Upcoming milestones with due dates
- [ ] Historical achievements
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Submit NPS/CSAT feedback
**Description:** As a customer stakeholder, I want to submit feedback so that my voice is heard.

**Acceptance Criteria:**
- [ ] NPS survey (0-10 scale with follow-up question)
- [ ] CSAT survey after support interactions
- [ ] Feature request submission
- [ ] General feedback form
- [ ] Feedback history (what I've submitted)
- [ ] Response from CS team visible
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Request CSM meeting
**Description:** As a customer champion, I want to request a meeting with my CSM so that I can discuss my account.

**Acceptance Criteria:**
- [ ] Meeting request form (purpose, preferred times)
- [ ] See CSM name and photo
- [ ] View upcoming scheduled meetings
- [ ] Reschedule/cancel existing meetings
- [ ] Calendar integration (add to calendar)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Usage dashboard
**Description:** As a customer admin, I want to see our usage metrics so that I can track adoption.

**Acceptance Criteria:**
- [ ] DAU, WAU, MAU charts
- [ ] Feature adoption breakdown
- [ ] User activity leaderboard
- [ ] Comparison to similar customers (anonymized benchmarks)
- [ ] Export usage data (CSV)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Document library
**Description:** As a customer stakeholder, I want to access shared documents so that I have important files.

**Acceptance Criteria:**
- [ ] View documents shared by CSM (from Google Drive integration)
- [ ] Download documents
- [ ] Document categories (contracts, QBR slides, training materials)
- [ ] Recently added documents
- [ ] Search documents
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Support ticket submission
**Description:** As a customer user, I want to submit support tickets so that issues get resolved.

**Acceptance Criteria:**
- [ ] Ticket submission form (category, priority, description)
- [ ] Attachment upload
- [ ] View existing tickets and status
- [ ] Add comments to open tickets
- [ ] Notification when ticket updated
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: AI assistant chatbot
**Description:** As a customer user, I want to chat with an AI assistant so that I get instant answers.

**Acceptance Criteria:**
- [ ] Chat widget accessible from all portal pages
- [ ] AI answers questions using knowledge base
- [ ] AI can look up success plan details
- [ ] Escalate to human CSM option
- [ ] Chat history preserved
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: White-label customization
**Description:** As a CS admin, I want to customize the portal appearance so that it matches our brand.

**Acceptance Criteria:**
- [ ] Custom logo upload
- [ ] Primary and secondary color configuration
- [ ] Custom domain support (success.customerdomain.com)
- [ ] Welcome message customization
- [ ] Footer links customization
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Portal analytics
**Description:** As a CSM, I want to see portal usage analytics so that I know how customers engage.

**Acceptance Criteria:**
- [ ] Portal visits per customer
- [ ] Most viewed training content
- [ ] Search queries (what customers look for)
- [ ] Feature engagement (which portal features used)
- [ ] Feedback submission volume
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Portal served from `/portal` route with customer subdomain detection
- FR-2: Magic link tokens stored in `portal_auth_tokens` with 24-hour expiry
- FR-3: Training content stored in `training_content` with customer visibility rules
- FR-4: Knowledge base uses existing `knowledge_base` table with public flag
- FR-5: Feedback stored in `customer_feedback` with type, score, text, customer_id
- FR-6: Meeting requests create entries in `meetings` table with status=requested
- FR-7: AI chatbot uses Training Agent with portal-specific tool set
- FR-8: Custom domains require DNS CNAME and SSL certificate provisioning
- FR-9: Portal activity logged for analytics
- FR-10: Role-based access: admin (full), champion (success plan), user (training only)

## Non-Goals

- No billing/invoice access (finance handled separately)
- No in-app product usage (portal is CS-focused, not product)
- No community/forum features (v1 is self-service, not peer-to-peer)
- No mobile app (responsive web only for v1)
- No SSO/SAML for customer login (magic link for simplicity)

## Technical Considerations

- Portal is separate React app or route with minimal auth
- Magic link email delivery must be reliable (use SendGrid/SES)
- Custom domain requires wildcard SSL or dynamic cert provisioning (Let's Encrypt)
- AI chatbot should have limited context (no access to other customers)
- Consider CDN for training video content
- Rate limit portal login attempts to prevent abuse

## Design Considerations

- Portal should feel professional and branded (not like an internal tool)
- Navigation should be simple (5 or fewer top-level items)
- Mobile-first design for users accessing on phones
- Dark mode support for user preference
- Accessibility compliance (WCAG 2.1 AA)

## Success Metrics

- 40% of training completions happen through self-service
- Support ticket volume reduced by 30%
- Customer satisfaction score for portal >4.5/5
- Average time to find information <60 seconds
- 60% of customers have at least one portal login per month

## Open Questions

- Should portal be separate app or integrated into main CSCX?
- How to handle customers with hundreds of stakeholders (user management)?
- Should AI chatbot have access to customer-specific data (usage, health)?
- How to handle content versioning for training materials?
