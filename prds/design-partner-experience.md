# PRD: Design Partner Experience

## Overview
Define the limited view for design partner users (non-admin) who sign up with an invite code. Design partners get a guided, interactive experience to explore CSCX.AI capabilities through a mock onboarding flow.

## User Types

### Admin (azizcamara2@gmail.com)
- Full access to all features
- Can see all customers and data
- Access to Admin Dashboard
- Can manage invite codes
- Access to all navigation items

### Design Partner (invite code users)
- Limited, guided experience
- Mock customer data only (not real production data)
- Interactive onboarding tour via chat UI
- Can explore agent capabilities hands-on
- No access to Admin Dashboard

## Design Partner Scope

### What They CAN Do
1. **Mock Onboarding Flow**
   - Start a simulated customer onboarding
   - Experience the AI chat assistant
   - See how agents generate emails, documents, meetings
   - Approve/reject mock agent actions

2. **Agent Chat UI**
   - Interact with the AI assistant
   - Ask questions about CSCX.AI capabilities
   - Request demo tasks (draft email, create QBR, etc.)
   - See HITL approval flow in action

3. **Limited Dashboard**
   - View 3 demo customers (Acme Corp, TechStart Inc, GlobalTech)
   - See mock health scores and metrics
   - Explore customer 360 view with sample data

4. **Capabilities Tour**
   - Guided walkthrough of key features
   - Interactive prompts to try each agent
   - Progress tracking for completed explorations

### What They CANNOT Do
1. Access Admin Dashboard
2. See real customer data
3. Create actual integrations
4. Send real emails
5. Manage users or workspaces
6. View production metrics

## User Stories

### US-001: Role-Based Navigation
**Description:** As a design partner, I should see a simplified navigation without admin features.

**Acceptance Criteria:**
- Hide "Admin" nav item for non-admin users
- Hide "Support Tickets" for non-admin users
- Show limited nav: Dashboard, Onboarding, Agent Chat
- Check user role from workspace_members table
- Typecheck passes

### US-002: Design Partner Welcome Screen
**Description:** As a design partner, I should see a welcome screen explaining what I can explore.

**Acceptance Criteria:**
- Show welcome modal on first login for design partners
- Explain: "You're a Design Partner with access to explore CSCX.AI"
- List 3-4 things they can try
- "Start Exploring" button dismisses modal
- Store dismissal in localStorage
- Typecheck passes

### US-003: Mock Customer Data
**Description:** As a design partner, I should only see demo customers, not real data.

**Acceptance Criteria:**
- Filter customer queries by demo flag OR user role
- Show 3 pre-seeded demo customers
- Demo customers have realistic but fake data
- No access to production customer data
- Typecheck passes

### US-004: Interactive Onboarding Chat
**Description:** As a design partner, I should be able to start a mock onboarding via chat.

**Acceptance Criteria:**
- Chat shows "Try Mock Onboarding" prompt
- Clicking starts guided onboarding flow
- AI explains each step as it happens
- Shows mock email drafts, documents, meeting requests
- All actions are simulated (not real sends)
- Typecheck passes

### US-005: Capabilities Discovery Flow
**Description:** As a design partner, I should have guided prompts to discover features.

**Acceptance Criteria:**
- Show floating "Try This" cards for unexplored features
- Track which capabilities user has tried
- Suggest next feature to explore
- Show completion progress (e.g., "Explored 3/8 capabilities")
- Typecheck passes

### US-006: Admin Full Access
**Description:** As an admin, I should have unrestricted access to all features.

**Acceptance Criteria:**
- Admin sees all navigation items
- Admin can access real customer data
- Admin sees Admin Dashboard
- Admin can manage Support Tickets
- Admin role determined by email match or workspace_members.role
- Typecheck passes

## Technical Implementation

### Role Detection
```typescript
// In AuthContext or similar
const isAdmin = user?.email === 'azizcamara2@gmail.com' ||
                workspaceMember?.role === 'admin';
const isDesignPartner = !isAdmin && workspaceMember?.role === 'member';
```

### Navigation Filtering
```typescript
const navItems = isAdmin
  ? ['dashboard', 'customers', 'onboarding', 'agent-center', 'admin', 'support']
  : ['dashboard', 'onboarding', 'agent-center']; // Design partner view
```

### Demo Data Filter
```typescript
// For design partners, only show demo customers
const customers = isDesignPartner
  ? allCustomers.filter(c => c.is_demo === true)
  : allCustomers;
```

## Success Metrics
- Design partners complete at least 3 capability explorations
- Average session time > 10 minutes
- 80%+ of design partners try mock onboarding
- Zero accidental access to production data

## Non-Goals
- Full RBAC system (keep it simple: admin vs member)
- Custom permission matrix
- Granular feature flags per user
