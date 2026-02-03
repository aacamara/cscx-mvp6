/**
 * Day 7 Resources Email Template
 * Third email in the onboarding welcome sequence
 * Purpose: Training links, documentation, support contacts
 */

export interface WelcomeDay7Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  productName?: string;
  entitlements?: Array<{ name: string; description?: string }>;
  trainingLinks?: Array<{ title: string; url: string; duration?: string }>;
  documentationUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  communityUrl?: string;
}

export function generateWelcomeDay7Email(variables: WelcomeDay7Variables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    productName = 'our platform',
    entitlements = [],
    trainingLinks = [
      { title: 'Getting Started Guide', url: '#getting-started', duration: '15 min' },
      { title: 'Core Features Overview', url: '#features', duration: '20 min' },
      { title: 'Best Practices & Tips', url: '#best-practices', duration: '10 min' },
    ],
    documentationUrl = '#docs',
    supportEmail = 'support@cscx.ai',
    supportPhone,
    communityUrl,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `Your ${customerName} Resource Kit is Ready`;

  const entitlementsHtml = entitlements.length > 0
    ? `
      <div class="section">
        <h3>Your Entitlements</h3>
        <p>As a reminder, here's what's included in your plan:</p>
        <ul>
          ${entitlements.map(e => `<li><strong>${e.name}</strong>${e.description ? ` - ${e.description}` : ''}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const entitlementsText = entitlements.length > 0
    ? `
YOUR ENTITLEMENTS
-----------------
As a reminder, here's what's included in your plan:
${entitlements.map(e => `- ${e.name}${e.description ? ` - ${e.description}` : ''}`).join('\n')}
`
    : '';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2a9d8f 0%, #264653 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .resource-card { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #2a9d8f; display: flex; justify-content: space-between; align-items: center; }
    .resource-card a { color: #1d3557; text-decoration: none; font-weight: 600; }
    .resource-card a:hover { color: #e63946; }
    .resource-card .duration { color: #666; font-size: 14px; }
    .section { margin: 25px 0; }
    .section h3 { color: #1d3557; border-bottom: 2px solid #2a9d8f; padding-bottom: 8px; }
    .support-box { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107; }
    .support-box h3 { margin-top: 0; color: #856404; }
    .cta-button { display: inline-block; background: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; }
    .cta-button:hover { background: #238b80; }
    .cta-button.secondary { background: #457b9d; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Resource Kit is Ready!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>One week in! I've put together a resource kit to help you and your team get up to speed with ${productName}. Here's everything you need:</p>

      <div class="section">
        <h3>Training Resources</h3>
        <p>Start with these recommended learning paths:</p>
        ${trainingLinks.map(link => `
          <div class="resource-card">
            <a href="${link.url}">${link.title}</a>
            ${link.duration ? `<span class="duration">${link.duration}</span>` : ''}
          </div>
        `).join('')}
      </div>

      ${entitlementsHtml}

      <div class="section">
        <h3>Documentation & Help</h3>
        <p>
          <a href="${documentationUrl}" class="cta-button">Browse Documentation</a>
          ${communityUrl ? `<a href="${communityUrl}" class="cta-button secondary">Join Community</a>` : ''}
        </p>
      </div>

      <div class="support-box">
        <h3>Need Help?</h3>
        <p>Our support team is here for you:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:${supportEmail}">${supportEmail}</a></li>
          ${supportPhone ? `<li><strong>Phone:</strong> ${supportPhone}</li>` : ''}
          <li><strong>Your CSM:</strong> <a href="mailto:${csmEmail}">${csmEmail}</a> (that's me!)</li>
        </ul>
        <p><em>Pro tip: For technical issues, reach out to support. For strategic questions, I'm your person!</em></p>
      </div>

      <p>I'd love to hear how your first week is going. Any early wins to celebrate? Challenges to work through? Just hit reply!</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is email 3 of 5 in your onboarding welcome sequence. Your next check-in will be around day 14.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

One week in! I've put together a resource kit to help you and your team get up to speed with ${productName}. Here's everything you need:

TRAINING RESOURCES
------------------
Start with these recommended learning paths:
${trainingLinks.map(link => `- ${link.title}${link.duration ? ` (${link.duration})` : ''}: ${link.url}`).join('\n')}
${entitlementsText}
DOCUMENTATION & HELP
--------------------
Browse Documentation: ${documentationUrl}
${communityUrl ? `Join Community: ${communityUrl}` : ''}

NEED HELP?
----------
Our support team is here for you:
- Email: ${supportEmail}
${supportPhone ? `- Phone: ${supportPhone}` : ''}
- Your CSM: ${csmEmail} (that's me!)

Pro tip: For technical issues, reach out to support. For strategic questions, I'm your person!

I'd love to hear how your first week is going. Any early wins to celebrate? Challenges to work through? Just hit reply!

Best regards,
${csmName}
${csmEmail}

---
This is email 3 of 5 in your onboarding welcome sequence. Your next check-in will be around day 14.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWelcomeDay7Email;
