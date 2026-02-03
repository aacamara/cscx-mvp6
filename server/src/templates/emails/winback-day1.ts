/**
 * Win-Back Day 1 Email Template - Reconnect
 * First email in the win-back campaign sequence
 * Purpose: Personal reconnection, acknowledge time passed, mention relevant updates
 * PRD-030: Win-Back Campaign Generator
 */

export interface WinbackDay1Variables {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  productName?: string;
  monthsSinceChurn: number;
  previousArr?: number;
  tenureYears?: number;
  churnReason?: string;
  productUpdates?: Array<{ title: string; description: string }>;
}

export function generateWinbackDay1Email(variables: WinbackDay1Variables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    customerName,
    contactName,
    csmName,
    csmTitle = 'Customer Success Manager',
    csmEmail,
    productName = 'our platform',
    monthsSinceChurn,
    tenureYears,
    churnReason,
    productUpdates = [],
  } = variables;

  const firstName = contactName.split(' ')[0];
  const timeAgo = monthsSinceChurn === 1 ? 'a month' : `${monthsSinceChurn} months`;

  const subject = `${customerName} + ${productName} - A lot has changed`;

  const updatesSection = productUpdates.length > 0
    ? `
      <div class="updates-preview">
        <h3>What's New Since You Left</h3>
        <ul>
          ${productUpdates.slice(0, 3).map(u => `<li><strong>${u.title}</strong> - ${u.description}</li>`).join('')}
        </ul>
        <p><em>I'd love to share more details if you're interested.</em></p>
      </div>
    `
    : '';

  const updatesText = productUpdates.length > 0
    ? `
WHAT'S NEW SINCE YOU LEFT
-------------------------
${productUpdates.slice(0, 3).map(u => `- ${u.title} - ${u.description}`).join('\n')}

I'd love to share more details if you're interested.
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
    .header { background: linear-gradient(135deg, #1d3557 0%, #457b9d 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .highlight { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #457b9d; }
    .updates-preview { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .updates-preview h3 { margin-top: 0; color: #1d3557; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .personal-note { font-style: italic; color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>It's Been a While</h1>
      <p>Reconnecting with an old friend</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>It's ${csmName} here. I was thinking about ${customerName} today and realized it's been ${timeAgo} since we last connected.</p>

      ${tenureYears ? `
      <p class="personal-note">I still remember working with your team${tenureYears >= 1 ? ` over those ${tenureYears} year${tenureYears > 1 ? 's' : ''}` : ''} - the progress you made was genuinely impressive.</p>
      ` : ''}

      <div class="highlight">
        <p><strong>This isn't a sales pitch.</strong> I genuinely wanted to check in and share that a lot has changed since you left. Some of the improvements might actually address ${churnReason ? `the concerns around ${churnReason.toLowerCase()}` : 'some of the challenges you faced'}.</p>
      </div>

      ${updatesSection}

      <p>No pressure at all - I just thought you'd want to know what's new. If you're ever curious about how things have evolved, I'd be happy to give you a quick tour.</p>

      <p>Either way, I hope ${customerName} is doing well!</p>

      <p>
        Best,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is a personal note from your former CSM. Reply to connect or unsubscribe to opt out.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

It's ${csmName} here. I was thinking about ${customerName} today and realized it's been ${timeAgo} since we last connected.
${tenureYears && tenureYears >= 1 ? `
I still remember working with your team over those ${tenureYears} year${tenureYears > 1 ? 's' : ''} - the progress you made was genuinely impressive.
` : ''}
This isn't a sales pitch. I genuinely wanted to check in and share that a lot has changed since you left. Some of the improvements might actually address ${churnReason ? `the concerns around ${churnReason.toLowerCase()}` : 'some of the challenges you faced'}.
${updatesText}
No pressure at all - I just thought you'd want to know what's new. If you're ever curious about how things have evolved, I'd be happy to give you a quick tour.

Either way, I hope ${customerName} is doing well!

Best,
${csmName}
${csmTitle}
${csmEmail}

---
This is a personal note from your former CSM. Reply to connect or unsubscribe to opt out.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWinbackDay1Email;
