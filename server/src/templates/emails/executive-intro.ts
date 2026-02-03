/**
 * Executive Introduction Email Template
 * PRD-031: Executive Sponsor Outreach
 *
 * Generates professional introduction emails for executive-level stakeholders
 */

export interface ExecutiveIntroData {
  customer: {
    name: string;
    arr: number;
    healthScore: number;
    industry?: string;
    partnershipDuration?: string;
  };
  executive: {
    name: string;
    firstName: string;
    email: string;
    title: string;
    linkedinUrl?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
  };
  context: {
    existingChampion?: string;
    championTitle?: string;
    keyMetrics?: Array<{ metric: string; value: string }>;
    strategicInitiatives?: string[];
  };
  customMessage?: string;
}

export interface ExecutiveIntroResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  talkingPoints: string[];
  suggestedSendTime: string;
}

/**
 * Generate executive introduction email
 */
export function generateExecutiveIntroEmail(data: ExecutiveIntroData): ExecutiveIntroResult {
  const { customer, executive, csm, context, customMessage } = data;

  // Format ARR
  const arrFormatted = formatCurrency(customer.arr);

  // Build key metrics section
  const metricsSection = context.keyMetrics && context.keyMetrics.length > 0
    ? context.keyMetrics
        .slice(0, 3)
        .map(m => `<li><strong>${m.metric}:</strong> ${m.value}</li>`)
        .join('\n        ')
    : '';

  // Reference to existing relationship
  const relationshipContext = context.existingChampion
    ? `I've had the pleasure of working with ${context.existingChampion}${context.championTitle ? ` (${context.championTitle})` : ''} and have seen firsthand the value ${customer.name} has achieved.`
    : `I'm reaching out to introduce myself and share some highlights from our partnership.`;

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .greeting { font-size: 16px; }
    .highlight-box { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e63946; }
    .highlight-box ul { margin: 10px 0; padding-left: 20px; }
    .highlight-box li { margin: 8px 0; }
    .accent { color: #e63946; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .cta { margin: 25px 0; }
  </style>
</head>
<body>
  <div class="container">
    <p class="greeting">${executive.firstName},</p>

    <p>I hope this message finds you well. I'm ${csm.name}, ${csm.title || 'Customer Success Manager'} supporting ${customer.name}${customer.partnershipDuration ? ` over the past ${customer.partnershipDuration}` : ''}.</p>

    <p>${relationshipContext}</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    ${metricsSection ? `
    <div class="highlight-box">
      <strong>Key Results from Our Partnership:</strong>
      <ul>
        ${metricsSection}
      </ul>
    </div>
    ` : ''}

    <p class="cta">I'd welcome the opportunity to connect briefly to ensure our partnership continues to align with ${customer.name}'s strategic priorities. Would you have 20 minutes in the coming weeks for a quick introduction call?</p>

    <p>I'm flexible with timing and happy to work around your schedule.</p>

    <div class="footer">
      <p>Best regards,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}${csm.phone ? `<br/>${csm.phone}` : ''}</p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const bodyText = `
${executive.firstName},

I hope this message finds you well. I'm ${csm.name}, ${csm.title || 'Customer Success Manager'} supporting ${customer.name}${customer.partnershipDuration ? ` over the past ${customer.partnershipDuration}` : ''}.

${relationshipContext}

${customMessage || ''}

${context.keyMetrics && context.keyMetrics.length > 0
  ? `Key Results from Our Partnership:
${context.keyMetrics.slice(0, 3).map(m => `- ${m.metric}: ${m.value}`).join('\n')}
`
  : ''}

I'd welcome the opportunity to connect briefly to ensure our partnership continues to align with ${customer.name}'s strategic priorities. Would you have 20 minutes in the coming weeks for a quick introduction call?

I'm flexible with timing and happy to work around your schedule.

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}${csm.phone ? `\n${csm.phone}` : ''}
`.trim();

  // Subject line
  const subject = `Introduction: ${customer.name} Partnership`;

  // Talking points for the CSM
  const talkingPoints = [
    `Partnership overview: ${customer.name} at ${arrFormatted} ARR`,
    context.existingChampion ? `Reference relationship with ${context.existingChampion}` : 'Establish new executive relationship',
    'Understand executive priorities and strategic initiatives',
    'Align partnership value with business objectives',
    'Offer ongoing executive engagement touchpoints',
  ];

  return {
    subject,
    bodyHtml,
    bodyText,
    talkingPoints,
    suggestedSendTime: 'Tuesday or Wednesday, 8-10 AM (executive time)',
  };
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export default generateExecutiveIntroEmail;
