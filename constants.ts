
export const SAMPLE_CONTRACT_TEXT = `
CUSTOMER SUCCESS AGREEMENT

Company: Acme Corporation
Contract Period: January 1, 2025 to December 31, 2025
Annual Value: $120,000

Pricing & Commercials:
1. Enterprise Platform License: 500 seats @ $15/seat/month = $90,000/yr
2. Premium Support Package: Flat fee $20,000/yr.
3. Onboarding & Training Services: $10,000 one-time fee.
Total Contract Value: $120,000. Payment Terms: Net 30.

Products and Services Entitlements:
- Enterprise Platform: 500 user licenses. Access to all modules. Start: 2025-01-01, End: 2025-12-31. Dependency: SSO Configuration.
- Premium Support: 24/7 phone/email, 1hr response time. Start: 2025-01-01, End: 2025-12-31.
- Training Sessions: 10 instructor-led sessions (virtual). Start: 2025-01-01, End: 2025-03-31. Dependency: User roster.

Stakeholders:
- John Smith, CTO, john.smith@acme.com. Role: Executive Sponsor. Dept: Engineering. Responsibilities: Final sign-off, budget approval. Approval Required: Yes.
- Sarah Johnson, VP of Customer Success, sarah.j@acme.com. Role: Primary Contact. Dept: Operations. Responsibilities: Implementation lead, weekly syncs. Approval Required: No.
- Mike Chen, IT Director, mike.c@acme.com. Role: Technical Lead. Dept: IT. Responsibilities: SSO setup, API integration. Approval Required: No.

Technical Requirements:
1. SSO Integration (SAML 2.0) with Okta. Priority: High. Owner: Mike Chen. Status: Pending. Due: 2025-01-15.
2. Data Migration from Salesforce. Priority: High. Owner: Sarah Johnson. Status: Not Started. Due: 2025-01-20.
3. Firewall allowlisting for API access. Priority: Medium. Owner: IT Security. Status: Pending. Due: 2025-01-10.

Terms:
- 99.9% uptime SLA guarantee
- Quarterly Business Reviews included
- 30-day termination notice required
- Auto-renewal with 60-day cancellation notice
`;

export const SAMPLE_DOCUSIGN_CONTRACT = `
DOCUSIGN ENVELOPE ID: 8923-2342-2342-2342
STATUS: COMPLETED
DATE: February 10, 2025

MASTER SERVICES AGREEMENT (Globex)

This Master Services Agreement ("Agreement") is entered into as of February 10, 2025 ("Effective Date") by and between:
Provider: CSCX.AI Solutions Inc.
Customer: Globex Corporation

1. SERVICES & SUBSCRIPTION
- Cloud Enterprise License: 1,500 Seats.
- Term: 36 Months.
- Start Date: March 1, 2025.
- End Date: February 28, 2028.

2. FINANCIAL TERMS
- Annual Recurring Revenue (ARR): $450,000.
- Implementation Fee: $25,000 (One-time).
- Payment Terms: Net 45.
- Total Contract Value (3 Years): $1,375,000.

3. SERVICE LEVEL AGREEMENT (SLA)
- 99.99% Availability.
- Priority 1 Support Response: 30 minutes.
- Critical Bug Fix: 4 hours.

4. STAKEHOLDERS & SIGNERS
- Hank Scorpio, CEO (h.scorpio@globex.com). Role: Executive Sponsor. Dept: Executive. Responsibilities: Budget Sign-off. Approval Required: Yes.
- Waylon Smithers, CIO (w.smithers@globex.com). Role: Technical Lead. Dept: IT. Responsibilities: Security Review, SSO. Approval Required: No.
- Montgomery Burns, CFO (m.burns@globex.com). Role: Billing Contact. Dept: Finance. Responsibilities: Procurement. Approval Required: Yes.

5. TECHNICAL REQUIREMENTS
- SSO Integration via Okta. Priority: High. Owner: Waylon Smithers. Due: 2025-02-25.
- Data Residency: EU Region (Frankfurt). Priority: High. Owner: Cloud Ops. Due: 2025-03-01.
- Audit Logs API Access required. Priority: Medium. Owner: Security Team. Due: 2025-03-15.

6. MILESTONES
- Kickoff Meeting: 2025-02-15. Agent: Onboarding Agent.
- Provisioning Complete: 2025-02-28. Agent: Provisioning Agent.
- Go-Live: 2025-03-01. Agent: Success Agent.

Signed via DocuSign
x_Hank Scorpio_______ 2025-02-10
x_CSCX CEO___________ 2025-02-10
`;
