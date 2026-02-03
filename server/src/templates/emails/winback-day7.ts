/**
 * Win-Back Day 7 Email Template - Value Reminder
 * Second email in the win-back campaign sequence
 * Purpose: Highlight past successes, remind of value delivered
 * PRD-030: Win-Back Campaign Generator
 */

export interface WinbackDay7Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  productName?: string;
  pastSuccesses?: Array<{ metric: string; value: string; context?: string }>;
  industryWins?: Array<{ company: string; result: string }>;
  roi?: {
    percentage: number;
    timeframe: string;
  };
}

export function generateWinbackDay7Email(variables: WinbackDay7Variables): {
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
    pastSuccesses = [],
    industryWins = [],
    roi,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = roi
    ? `Remember when you achieved ${roi.percentage}x ROI with us?`
    : `Remember the wins at ${customerName}?`;

  const successesSection = pastSuccesses.length > 0
    ? `
      <div class="successes-box">
        <h3>Your Results with ${productName}</h3>
        <div class="metrics-grid">
          ${pastSuccesses.map(s => `
            <div class="metric-card">
              <div class="metric-value">${s.value}</div>
              <div class="metric-label">${s.metric}</div>
              ${s.context ? `<div class="metric-context">${s.context}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  const successesText = pastSuccesses.length > 0
    ? `
YOUR RESULTS WITH ${productName.toUpperCase()}
${'-'.repeat(30)}
${pastSuccesses.map(s => `${s.value} - ${s.metric}${s.context ? ` (${s.context})` : ''}`).join('\n')}
`
    : '';

  const industrySection = industryWins.length > 0
    ? `
      <div class="industry-wins">
        <h3>What Others in Your Space Are Achieving</h3>
        <ul>
          ${industryWins.map(w => `<li><strong>${w.company}</strong>: ${w.result}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const industryText = industryWins.length > 0
    ? `
WHAT OTHERS IN YOUR SPACE ARE ACHIEVING
${'-'.repeat(40)}
${industryWins.map(w => `- ${w.company}: ${w.result}`).join('\n')}
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
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .successes-box { background: #d4edda; padding: 25px; border-radius: 8px; margin: 20px 0; }
    .successes-box h3 { margin-top: 0; color: #155724; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .metric-card { background: white; padding: 15px; border-radius: 6px; text-align: center; }
    .metric-value { font-size: 28px; font-weight: bold; color: #2a9d8f; }
    .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
    .metric-context { font-size: 12px; color: #888; margin-top: 3px; }
    .industry-wins { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .industry-wins h3 { margin-top: 0; color: #1d3557; }
    .cta-section { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107; text-align: center; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Looking Back at the Wins</h1>
      <p>A reminder of what we achieved together</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I was pulling together some data this week and came across ${customerName}'s old metrics. I thought you might appreciate seeing what you accomplished with ${productName}.</p>

      ${successesSection}

      <p>Those results didn't happen by accident - they came from the hard work of your team and a platform that supported your goals.</p>

      ${industrySection}

      <div class="cta-section">
        <p><strong>Curious what results might look like today?</strong></p>
        <p>With all the improvements we've made, I'd estimate you could see even better outcomes. Let me know if you'd like to explore that.</p>
      </div>

      <p>No pressure - just wanted to share these numbers and let you know we'd love to help you achieve results like this again.</p>

      <p>
        Cheers,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>Email 2 of 5 in this series. Reply 'stop' to unsubscribe.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I was pulling together some data this week and came across ${customerName}'s old metrics. I thought you might appreciate seeing what you accomplished with ${productName}.
${successesText}
Those results didn't happen by accident - they came from the hard work of your team and a platform that supported your goals.
${industryText}
CURIOUS WHAT RESULTS MIGHT LOOK LIKE TODAY?
${'-'.repeat(45)}
With all the improvements we've made, I'd estimate you could see even better outcomes. Let me know if you'd like to explore that.

No pressure - just wanted to share these numbers and let you know we'd love to help you achieve results like this again.

Cheers,
${csmName}
${csmEmail}

---
Email 2 of 5 in this series. Reply 'stop' to unsubscribe.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWinbackDay7Email;
