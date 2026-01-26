// Test fixture data for contract-related tests

export const sampleContractText = `
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
- Enterprise Platform: 500 user licenses. Access to all modules. Start: 2025-01-01, End: 2025-12-31.
- Premium Support: 24/7 phone/email, 1hr response time. Start: 2025-01-01, End: 2025-12-31.
- Training Sessions: 10 instructor-led sessions (virtual). Start: 2025-01-01, End: 2025-03-31.

Stakeholders:
- John Smith, CTO, john.smith@acme.com. Role: Executive Sponsor. Dept: Engineering.
- Sarah Johnson, VP of Customer Success, sarah.j@acme.com. Role: Primary Contact. Dept: Operations.
- Mike Chen, IT Director, mike.c@acme.com. Role: Technical Lead. Dept: IT.

Technical Requirements:
1. SSO Integration (SAML 2.0) with Okta. Priority: High. Owner: Mike Chen. Status: Pending.
2. Data Migration from Salesforce. Priority: High. Owner: Sarah Johnson. Status: Not Started.

Terms:
- 99.9% uptime SLA guarantee
- Quarterly Business Reviews included
- 30-day termination notice required
`;

export const minimalContractText = `
Company: Minimal Corp
ARR: $50,000
Contact: Jane Doe, jane@minimal.com
`;

export const invalidContractText = 'Too short';

export const contractInputText = {
  type: 'text' as const,
  content: sampleContractText,
  fileName: 'sample-contract.txt'
};

export const contractInputMinimal = {
  type: 'text' as const,
  content: minimalContractText,
  fileName: 'minimal.txt'
};

// Base64 encoded mock PDF (just header for testing)
export const mockPDFBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoK';

export const contractInputPDF = {
  type: 'file' as const,
  content: mockPDFBase64,
  mimeType: 'application/pdf',
  fileName: 'contract.pdf'
};
