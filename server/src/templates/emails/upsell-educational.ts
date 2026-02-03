/**
 * Upsell Educational Email Template
 * PRD-047: Upsell Introduction Email
 *
 * Educational approach: Share what's possible with upgraded capabilities
 * Best for customers who are engaged but may not know about advanced features
 */

export interface UpsellEducationalVariables {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  currentTier: string;
  suggestedTier: string;
  keyFeatures: Array<{
    name: string;
    description: string;
    benefit: string;
  }>;
  healthScore: number;
  usageHighlights: string[];
  calendarLink?: string;
  resourceLinks?: Array<{
    title: string;
    url: string;
    description: string;
  }>;
}

export interface UpsellEducationalResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  approach: 'educational';
}

export function generateUpsellEducationalEmail(
  variables: UpsellEducationalVariables
): UpsellEducationalResult {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    currentTier,
    suggestedTier,
    keyFeatures,
    usageHighlights,
    calendarLink,
    resourceLinks,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const featuresCount = keyFeatures.length;

  const subject = `${firstName}, Thought You Might Find This Interesting - Advanced Capabilities You Could Unlock`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .feature-card { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #4f46e5; }
    .feature-name { font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
    .feature-desc { font-size: 14px; color: #666; margin-bottom: 6px; }
    .feature-benefit { font-size: 13px; color: #4f46e5; font-style: italic; }
    .highlight-box { background: #eef2ff; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .highlight-title { font-weight: 600; color: #3730a3; margin-bottom: 8px; }
    .cta-button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
    .cta-button:hover { background: #4338ca; }
    .resource-link { display: block; color: #4f46e5; text-decoration: none; margin: 6px 0; font-size: 14px; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .signature { margin-top: 24px; }
    ul { padding-left: 20px; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Capabilities Worth Exploring</h1>
      <p>Features that could take ${customerName} to the next level</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I was thinking about ${customerName}'s journey with us and wanted to share some capabilities that I think could be really valuable for your team.</p>

      ${usageHighlights.length > 0 ? `
      <div class="highlight-box">
        <div class="highlight-title">What I've Noticed</div>
        <ul>
          ${usageHighlights.map(h => `<li>${h}</li>`).join('\n          ')}
        </ul>
      </div>
      ` : ''}

      <p>Based on how your team is using the platform, I thought you might be interested in learning about ${featuresCount} advanced capabilities available in our ${suggestedTier} tier:</p>

      ${keyFeatures.map(feature => `
      <div class="feature-card">
        <div class="feature-name">${feature.name}</div>
        <div class="feature-desc">${feature.description}</div>
        <div class="feature-benefit">"${feature.benefit}"</div>
      </div>
      `).join('')}

      <p>This is purely educational - I just wanted you to know what's available in case any of these align with your goals. There's absolutely no pressure.</p>

      ${resourceLinks && resourceLinks.length > 0 ? `
      <p>If you'd like to learn more, here are some helpful resources:</p>
      ${resourceLinks.map(r => `
      <a href="${r.url}" class="resource-link">📚 ${r.title} - ${r.description}</a>
      `).join('')}
      ` : ''}

      ${calendarLink ? `
      <p>If any of these sparked your interest and you'd like to explore further, I'm happy to give you a quick demo:</p>
      <a href="${calendarLink}" class="cta-button">Schedule a 15-min Demo</a>
      ` : `
      <p>If any of these sparked your interest, just reply and we can schedule a quick demo at your convenience.</p>
      `}

      <div class="signature">
        <p>Best,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}</p>
      </div>
    </div>
    <div class="footer">
      <p>This is an educational email from your dedicated CSM. Current tier: ${currentTier}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I was thinking about ${customerName}'s journey with us and wanted to share some capabilities that I think could be really valuable for your team.

${usageHighlights.length > 0 ? `WHAT I'VE NOTICED:
${usageHighlights.map(h => `- ${h}`).join('\n')}

` : ''}Based on how your team is using the platform, I thought you might be interested in learning about ${featuresCount} advanced capabilities available in our ${suggestedTier} tier:

${keyFeatures.map(f => `${f.name}
${f.description}
"${f.benefit}"
`).join('\n')}

This is purely educational - I just wanted you to know what's available in case any of these align with your goals. There's absolutely no pressure.

${resourceLinks && resourceLinks.length > 0 ? `HELPFUL RESOURCES:
${resourceLinks.map(r => `- ${r.title}: ${r.url}`).join('\n')}

` : ''}${calendarLink ? `If any of these sparked your interest, schedule a quick demo: ${calendarLink}` : `If any of these sparked your interest, just reply and we can schedule a quick demo at your convenience.`}

Best,
${csmName}
${csmTitle}
${csmEmail}

---
This is an educational email from your dedicated CSM. Current tier: ${currentTier}
  `.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    approach: 'educational',
  };
}

export default generateUpsellEducationalEmail;
