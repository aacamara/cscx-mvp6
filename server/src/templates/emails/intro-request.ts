/**
 * Introduction Request Email Template
 * PRD-044: Multi-Threading Introduction
 *
 * Generates professional introduction request emails to champions
 * for expanding relationships to additional stakeholders
 */

export interface IntroRequestData {
  customer: {
    name: string;
    arr: number;
    healthScore?: number;
    renewalDate?: string;
  };
  champion: {
    name: string;
    firstName: string;
    email: string;
    title?: string;
  };
  target: {
    name: string;
    firstName: string;
    title: string;
    email?: string;
    department?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
  };
  context: {
    reason: string;
    valueProposition: string[];
    keyMetrics?: Array<{ metric: string; value: string }>;
    daysUntilRenewal?: number;
  };
  draftIntro?: string;
  customMessage?: string;
}

export interface IntroRequestResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  draftIntroEmail: {
    subject: string;
    bodyText: string;
  };
  talkingPoints: string[];
  suggestedSendTime: string;
}

/**
 * Generate introduction request email
 */
export function generateIntroRequestEmail(data: IntroRequestData): IntroRequestResult {
  const { customer, champion, target, csm, context, customMessage } = data;

  // Format value proposition as bullet points
  const valuePoints = context.valueProposition
    .map(v => `<li>${v}</li>`)
    .join('\n        ');

  const valuePointsText = context.valueProposition
    .map(v => `- ${v}`)
    .join('\n');

  // Format key metrics if available
  const metricsSection = context.keyMetrics && context.keyMetrics.length > 0
    ? context.keyMetrics
        .slice(0, 3)
        .map(m => `<strong>${m.metric}:</strong> ${m.value}`)
        .join(' | ')
    : '';

  const metricsText = context.keyMetrics && context.keyMetrics.length > 0
    ? context.keyMetrics.slice(0, 3).map(m => `${m.metric}: ${m.value}`).join(', ')
    : '';

  // Renewal context if applicable
  const renewalContext = context.daysUntilRenewal && context.daysUntilRenewal <= 120
    ? `As we approach your renewal in ${context.daysUntilRenewal} days, `
    : '';

  // Generate draft intro email for champion to forward
  const draftIntroSubject = `Introduction: ${csm.name} from ${customer.name} Partnership`;
  const draftIntroBody = generateDraftIntroBody(data);

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .greeting { font-size: 16px; margin-bottom: 16px; }
    .section { margin: 20px 0; }
    .highlight-box { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e63946; }
    .highlight-box ul { margin: 10px 0; padding-left: 20px; }
    .highlight-box li { margin: 8px 0; }
    .draft-box { background: #fff; border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; padding: 15px; }
    .draft-header { font-weight: 600; color: #666; font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .draft-content { font-family: inherit; white-space: pre-wrap; font-size: 14px; color: #444; }
    .metrics { font-size: 14px; color: #666; margin: 15px 0; }
    .accent { color: #e63946; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .no-pressure { font-style: italic; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <p class="greeting">Hi ${champion.firstName},</p>

    <p>I hope you're having a great week! I have a quick ask - would you be comfortable introducing me to ${target.name}${target.title ? ` (${target.title})` : ''}?</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="highlight-box">
      <strong>Why I'm asking:</strong>
      <p>${context.reason}</p>
      ${renewalContext ? `<p>${renewalContext}I'd love to ensure ${target.firstName} has visibility into the value ${customer.name} has achieved with our partnership.</p>` : ''}
    </div>

    <div class="section">
      <strong>What I'd discuss with ${target.firstName}:</strong>
      <ul>
        ${valuePoints}
      </ul>
    </div>

    ${metricsSection ? `
    <div class="metrics">
      ${metricsSection}
    </div>
    ` : ''}

    <div class="draft-box">
      <div class="draft-header">To make it easy, here's a draft you can forward:</div>
      <div class="draft-content">${escapeHtml(draftIntroBody)}</div>
    </div>

    <p class="no-pressure">No pressure at all if the timing isn't right - just let me know!</p>

    <div class="footer">
      <p>Thanks,</p>
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
Hi ${champion.firstName},

I hope you're having a great week! I have a quick ask - would you be comfortable introducing me to ${target.name}${target.title ? ` (${target.title})` : ''}?

${customMessage || ''}

**Why I'm asking:**
${context.reason}
${renewalContext ? `${renewalContext}I'd love to ensure ${target.firstName} has visibility into the value ${customer.name} has achieved with our partnership.` : ''}

**What I'd discuss with ${target.firstName}:**
${valuePointsText}

${metricsText ? `Key Results: ${metricsText}` : ''}

**To make it easy, here's a draft you can forward:**
---
${draftIntroBody}
---

No pressure at all if the timing isn't right - just let me know!

Thanks,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}${csm.phone ? `\n${csm.phone}` : ''}
`.trim();

  // Subject line
  const subject = `Quick Favor - Introduction to ${target.name}?`;

  // Talking points for the CSM
  const talkingPoints = [
    `Building multi-threaded relationship at ${customer.name}`,
    `Target: ${target.name} (${target.title})`,
    context.daysUntilRenewal && context.daysUntilRenewal <= 120
      ? `Renewal in ${context.daysUntilRenewal} days - budget authority needed`
      : 'Strategic relationship expansion',
    `Leveraging champion relationship with ${champion.name}`,
    ...context.valueProposition.slice(0, 2),
  ];

  return {
    subject,
    bodyHtml,
    bodyText,
    draftIntroEmail: {
      subject: draftIntroSubject,
      bodyText: draftIntroBody,
    },
    talkingPoints,
    suggestedSendTime: 'Tuesday or Wednesday, 9-11 AM',
  };
}

/**
 * Generate the draft intro email for champion to forward
 */
function generateDraftIntroBody(data: IntroRequestData): string {
  const { customer, target, csm, context } = data;

  const metricsHighlight = context.keyMetrics && context.keyMetrics.length > 0
    ? ` - we've achieved ${context.keyMetrics[0].value} ${context.keyMetrics[0].metric.toLowerCase()}`
    : '';

  return `Hi ${target.firstName},

I wanted to connect you with ${csm.name}, our Customer Success Manager. They've been instrumental in our success with ${customer.name}${metricsHighlight}.

${context.daysUntilRenewal && context.daysUntilRenewal <= 120
  ? `With our renewal coming up, I thought it would be valuable for you two to connect on the business impact and planning.`
  : `I thought it would be valuable for you two to connect on strategic alignment and opportunities.`}

Would you have 20 minutes in the next few weeks for a quick introduction call?

Best,
[Your name]`;
}

/**
 * Escape HTML characters for safe rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br/>');
}

export default generateIntroRequestEmail;
