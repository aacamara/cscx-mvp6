import { AgentMessage, AgentId } from '../../types/agents';

interface DemoStep extends AgentMessage {
  thinking?: boolean;
  deploy?: AgentId;
}

export const DEMO_FLOWS: Record<string, DemoStep[]> = {
  onboard: [
    { agent: 'onboarding', message: "I'll help you onboard this customer. Let me first gather their information.", thinking: true },
    { agent: 'onboarding', message: "Deploying Intelligence Agent to pull customer data...", deploy: 'intelligence' },
    { agent: 'intelligence', message: "Pulling data from Salesforce and enriching profile...", thinking: true },
    { agent: 'intelligence', message: "Customer profile loaded:\n\n• Company: Meridian Capital Partners\n• ARR: $900,000 (36-month term)\n• Products: Enterprise Platform, Analytics, API Gateway\n• Stakeholders: Marcus Thompson (CTO), Jennifer Walsh (Head of Ops)\n• Technical reqs: Okta SSO, AWS PrivateLink, Bloomberg Integration\n\nProfile enriched with LinkedIn and company data." },
    { agent: 'onboarding', message: "I have the customer context. Would you like me to schedule a discovery call with their team?", isApproval: true },
  ],
  schedule: [
    { agent: 'onboarding', message: "Deploying Meeting Agent to schedule the call...", deploy: 'meeting' },
    { agent: 'meeting', message: "Checking calendar availability for Marcus Thompson and Jennifer Walsh...", thinking: true },
    { agent: 'meeting', message: "Available slot found: January 20, 2025 at 10:00 AM EST\n\n**Suggested agenda:**\n1. Introductions & goals alignment\n2. Current workflow discussion\n3. Technical requirements review\n4. Success metrics definition\n5. Next steps & timeline\n\n**Attendees:**\n• Marcus Thompson (CTO)\n• Jennifer Walsh (Head of Ops)\n• Your CSM team\n\nShall I send the calendar invite?", isApproval: true },
  ],
  call: [
    { agent: 'onboarding', message: "Starting discovery call. Meeting Agent will capture insights...", deploy: 'meeting' },
    { agent: 'meeting', message: "🔴 Recording started. Joining Zoom call...", thinking: true },
    { agent: 'meeting', message: "Live transcript capturing...\n\n*\"Marcus: Our biggest pain point is reporting. It takes almost two days to pull together a portfolio report, and that's just not sustainable for our clients...\"*", thinking: true },
    { agent: 'meeting', message: "Call completed (47 minutes). Processing transcript and extracting insights...", thinking: true },
    { agent: 'meeting', message: "**Insights extracted:**\n\n**Business Goals:**\n• Consolidate 5 legacy systems into one platform\n• Reduce portfolio reporting from 2 days → 2 hours\n• Enable real-time risk monitoring across all funds\n\n**Concerns Raised:**\n• Bloomberg data migration complexity (Amit)\n• Trading desk change management (Jennifer)\n\n**New Stakeholders Identified:**\n• Amit Sharma, Dir. of Engineering — positive, technical decision maker\n• Rachel Kim, Head of Trading — neutral, key for adoption\n\n**Timeline:**\n• Target go-live: Q2 2025\n• Critical date: April 1 (Q2 reporting deadline)\n\n**Key Quote:**\n*\"If we can get reporting under 2 hours, that alone justifies the investment.\"* — Marcus Thompson" },
    { agent: 'onboarding', message: "Deploying Intelligence Agent to store insights and update customer profile...", deploy: 'intelligence' },
    { agent: 'intelligence', message: "Customer profile updated with discovery insights.\n\n**Health Score:** 87/100\n• Engagement: High\n• Goal clarity: High\n• Stakeholder alignment: Medium (trading desk TBD)\n• Technical readiness: Medium (Bloomberg blocker)\n\nReady to generate success plan?", isApproval: true },
  ],
  plan: [
    { agent: 'onboarding', message: "Generating personalized 90-day success plan based on captured insights...", thinking: true },
    { agent: 'onboarding', message: "**Success Plan: Meridian Capital Partners**\n\n**Days 1-30 (Foundation)**\n• Complete Okta SSO integration (owner: Amit)\n• Resolve Bloomberg API access (owner: Technical Team)\n• Initial platform training session (owner: CSM)\n• Weekly sync calls established\n\n**Days 31-60 (Adoption)**\n• Trading desk rollout — address Rachel's UX concerns\n• First portfolio report generated (<2 hours target)\n• 50% user activation milestone\n• Bi-weekly adoption check-ins\n\n**Days 61-90 (Value Realization)**\n• Q2 reporting system ready (April 1 deadline ⚠️)\n• Legacy system #1 decommissioned\n• 80% user adoption target\n• Executive QBR with Marcus Thompson\n\n**Risk Mitigation:**\n• Bloomberg integration: Escalate to technical team by Day 14\n• Trading desk adoption: Rachel Kim early involvement\n\nWould you like me to deploy the Training Agent for customer self-service?", isApproval: true },
  ],
  training: [
    { agent: 'onboarding', message: "Deploying Training Agent for customer team...", deploy: 'training' },
    { agent: 'training', message: "Initializing training environment for Meridian Capital...", thinking: true },
    { agent: 'training', message: "**Training Environment Ready**\n\n**Available Modules:**\n• Platform Overview (30 min) — recommended first\n• Analytics Deep Dive (45 min)\n• API Integration Guide (60 min)\n• Admin Configuration (30 min)\n• Bloomberg Data Import (45 min) — custom for Meridian\n\n**Self-Service Resources:**\n• Knowledge base: 247 articles indexed\n• Video tutorials: 34 available\n• Voice assistant: Ready for questions\n\n**Access Sent To:**\n• Marcus Thompson (Admin)\n• Jennifer Walsh (Admin)\n• Amit Sharma (User)\n• Rachel Kim (User)\n\nCustomers can now access training at any time." },
    { agent: 'onboarding', message: "✅ **Onboarding setup complete!**\n\nAll agents deployed and active:\n\n• 📊 **Intelligence Agent** — Monitoring customer health, tracking engagement\n• 🎙 **Meeting Agent** — Ready for follow-up calls, QBRs\n• 📚 **Training Agent** — Customer self-service active\n\n**Next scheduled touchpoint:** Weekly sync, January 27\n\nI'll alert you if any issues arise or approvals are needed. The customer journey is now in motion! 🚀" },
  ],
};
