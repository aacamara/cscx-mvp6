/**
 * Upsell Value-Add Email Template
 * PRD-047: Upsell Introduction Email
 *
 * Value-add approach: Build on their success and ROI
 * Best for customers with high health scores and proven success
 */

export interface UpsellValueVariables {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  currentTier: string;
  suggestedTier: string;
  healthScore: number;
  successMetrics: Array<{
    metric: string;
    value: string;
    improvement?: string;
    context?: string;
  }>;
  valueDelivered: {
    summary: string;
    examples: string[];
    estimatedRoi?: number;
  };
  growthOpportunities: Array<{
    area: string;
    potential: string;
    feature: string;
    expectedOutcome: string;
  }>;
  similarCustomers?: Array<{
    industry: string;
    outcome: string;
  }>;
  calendarLink?: string;
}

export interface UpsellValueResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  approach: 'value_add';
}

export function generateUpsellValueEmail(
  variables: UpsellValueVariables
): UpsellValueResult {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    currentTier,
    suggestedTier,
    healthScore,
    successMetrics,
    valueDelivered,
    growthOpportunities,
    similarCustomers,
    calendarLink,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `${customerName}'s Success Story - And What's Next`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .health-badge { display: inline-block; background: #ecfdf5; color: #065f46; padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .success-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
    .success-card { background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center; }
    .success-value { font-size: 24px; font-weight: 700; color: #059669; }
    .success-metric { font-size: 12px; color: #666; margin-top: 4px; }
    .success-improvement { font-size: 11px; color: #059669; font-weight: 500; }
    .value-box { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 8px; margin: 20px 0; }
    .value-summary { font-size: 16px; font-weight: 600; color: #065f46; margin-bottom: 12px; }
    .value-example { font-size: 14px; color: #047857; margin: 6px 0; display: flex; align-items: flex-start; }
    .value-example:before { content: "✓"; margin-right: 8px; font-weight: bold; }
    .opportunity-section { margin: 24px 0; }
    .opportunity-title { font-weight: 600; color: #1a1a1a; margin-bottom: 12px; font-size: 16px; }
    .opportunity-card { background: #f8fafc; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #0d9488; }
    .opportunity-area { font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
    .opportunity-detail { font-size: 14px; color: #666; }
    .opportunity-outcome { font-size: 13px; color: #0d9488; font-weight: 500; margin-top: 8px; }
    .similar-section { background: #faf5ff; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .similar-title { font-weight: 600; color: #7c3aed; margin-bottom: 12px; font-size: 14px; }
    .similar-item { font-size: 13px; color: #666; margin: 4px 0; }
    .cta-button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
    .cta-button:hover { background: #047857; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .signature { margin-top: 24px; }
    @media (max-width: 480px) {
      .success-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Building on Your Success</h1>
      <p>Celebrating what we've achieved together - and what's possible next</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <span class="health-badge">Health Score: ${healthScore}/100</span>

      <p>I wanted to take a moment to celebrate the success ${customerName} has achieved. Looking at your metrics, there's a lot to be proud of:</p>

      <div class="success-grid">
        ${successMetrics.slice(0, 4).map(m => `
        <div class="success-card">
          <div class="success-value">${m.value}</div>
          <div class="success-metric">${m.metric}</div>
          ${m.improvement ? `<div class="success-improvement">${m.improvement}</div>` : ''}
        </div>
        `).join('')}
      </div>

      <div class="value-box">
        <div class="value-summary">${valueDelivered.summary}</div>
        ${valueDelivered.examples.map(ex => `
        <div class="value-example">${ex}</div>
        `).join('')}
        ${valueDelivered.estimatedRoi ? `<div style="margin-top: 12px; font-weight: 600; color: #065f46;">Estimated ROI: ${valueDelivered.estimatedRoi}%</div>` : ''}
      </div>

      <p>Given this strong foundation, I've been thinking about how ${customerName} could unlock even more value. Here are a few opportunities I've identified:</p>

      <div class="opportunity-section">
        ${growthOpportunities.map(opp => `
        <div class="opportunity-card">
          <div class="opportunity-area">${opp.area}</div>
          <div class="opportunity-detail">${opp.potential}</div>
          <div class="opportunity-detail"><strong>Feature:</strong> ${opp.feature} (available in ${suggestedTier})</div>
          <div class="opportunity-outcome">Expected: ${opp.expectedOutcome}</div>
        </div>
        `).join('')}
      </div>

      ${similarCustomers && similarCustomers.length > 0 ? `
      <div class="similar-section">
        <div class="similar-title">What Similar Companies Have Achieved:</div>
        ${similarCustomers.map(c => `
        <div class="similar-item"><strong>${c.industry}:</strong> ${c.outcome}</div>
        `).join('')}
      </div>
      ` : ''}

      <p>I'd love to discuss how we can build on your current success and help ${customerName} reach the next level. No pressure - just a conversation about possibilities.</p>

      ${calendarLink ? `
      <a href="${calendarLink}" class="cta-button">Let's Explore What's Next</a>
      ` : `
      <p>Would you be open to a quick call to explore these opportunities together?</p>
      `}

      <div class="signature">
        <p>Here to support your continued success,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}</p>
      </div>
    </div>
    <div class="footer">
      <p>This is a strategic outreach from your dedicated CSM. Current tier: ${currentTier} | Suggested next step: ${suggestedTier}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

Health Score: ${healthScore}/100

I wanted to take a moment to celebrate the success ${customerName} has achieved. Looking at your metrics, there's a lot to be proud of:

${successMetrics.map(m => `- ${m.metric}: ${m.value}${m.improvement ? ` (${m.improvement})` : ''}`).join('\n')}

VALUE DELIVERED:
${valueDelivered.summary}
${valueDelivered.examples.map(ex => `✓ ${ex}`).join('\n')}
${valueDelivered.estimatedRoi ? `Estimated ROI: ${valueDelivered.estimatedRoi}%` : ''}

Given this strong foundation, I've been thinking about how ${customerName} could unlock even more value. Here are a few opportunities I've identified:

${growthOpportunities.map(opp => `${opp.area}
${opp.potential}
Feature: ${opp.feature} (available in ${suggestedTier})
Expected: ${opp.expectedOutcome}
`).join('\n')}

${similarCustomers && similarCustomers.length > 0 ? `WHAT SIMILAR COMPANIES HAVE ACHIEVED:
${similarCustomers.map(c => `- ${c.industry}: ${c.outcome}`).join('\n')}

` : ''}I'd love to discuss how we can build on your current success and help ${customerName} reach the next level. No pressure - just a conversation about possibilities.

${calendarLink ? `Let's explore what's next: ${calendarLink}` : `Would you be open to a quick call to explore these opportunities together?`}

Here to support your continued success,
${csmName}
${csmTitle}
${csmEmail}

---
This is a strategic outreach from your dedicated CSM. Current tier: ${currentTier} | Suggested next step: ${suggestedTier}
  `.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    approach: 'value_add',
  };
}

export default generateUpsellValueEmail;
