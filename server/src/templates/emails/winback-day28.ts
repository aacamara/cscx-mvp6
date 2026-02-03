/**
 * Win-Back Day 28 Email Template - Final Invitation
 * Fifth and final email in the win-back campaign sequence
 * Purpose: Low-pressure reconnection, genuine interest, coffee invitation
 * PRD-030: Win-Back Campaign Generator
 */

export interface WinbackDay28Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  csmPhone?: string;
  productName?: string;
  calendarLink?: string;
  localMeetingOption?: boolean;
  customMessage?: string;
}

export function generateWinbackDay28Email(variables: WinbackDay28Variables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    csmPhone,
    productName = 'our platform',
    calendarLink,
    localMeetingOption = false,
    customMessage,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `Let's catch up over coffee (virtual or real)`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .coffee-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .no-pressure { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0984e3; }
    .options-box { background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; }
    .options-box h3 { margin-top: 0; color: #1d3557; }
    .option { display: flex; align-items: center; margin: 15px 0; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e5e5e5; }
    .option-icon { font-size: 24px; margin-right: 15px; }
    .option-text { flex: 1; }
    .option-text strong { display: block; color: #1d3557; }
    .option-text span { font-size: 14px; color: #666; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 5px; }
    .cta-button:hover { background: #c5303c; }
    .cta-button.secondary { background: #1d3557; }
    .cta-button.secondary:hover { background: #0d1b2a; }
    .cta-section { text-align: center; margin: 25px 0; }
    .contact-info { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .personal-note { font-style: italic; color: #555; margin: 20px 0; padding: 15px; background: #fafafa; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>One Last Note</h1>
      <p>No pitch, just a genuine invitation</p>
    </div>
    <div class="content">
      <div class="coffee-icon">&#9749;</div>

      <p>Hi ${firstName},</p>

      <p>This is the last email in this series, and I wanted to end it differently than most outreach campaigns.</p>

      <div class="no-pressure">
        <p><strong>No pitch. No pressure. No hidden agenda.</strong></p>
        <p>I genuinely enjoyed working with ${customerName}, and I'd love to catch up over a quick call or coffee - virtual or otherwise. Whether you ever become a customer again or not.</p>
      </div>

      ${customMessage ? `
      <div class="personal-note">
        ${customMessage}
      </div>
      ` : ''}

      <div class="options-box">
        <h3>Here's what I'm thinking:</h3>
        <div class="option">
          <span class="option-icon">&#128187;</span>
          <div class="option-text">
            <strong>15-minute virtual coffee</strong>
            <span>Quick catch-up, hear what you're working on</span>
          </div>
        </div>
        ${localMeetingOption ? `
        <div class="option">
          <span class="option-icon">&#9749;</span>
          <div class="option-text">
            <strong>Coffee in person</strong>
            <span>If you're in the area, let's grab a real cup</span>
          </div>
        </div>
        ` : ''}
        <div class="option">
          <span class="option-icon">&#128236;</span>
          <div class="option-text">
            <strong>Just a quick email exchange</strong>
            <span>If you prefer, just reply with an update</span>
          </div>
        </div>
      </div>

      <div class="cta-section">
        ${calendarLink ? `
        <a href="${calendarLink}" class="cta-button">Schedule a Chat</a>
        ` : ''}
        <a href="mailto:${csmEmail}?subject=Re: Catching up - ${customerName}" class="cta-button secondary">Just Reply</a>
      </div>

      <div class="contact-info">
        <p><strong>Or reach me directly:</strong></p>
        <p>
          Email: ${csmEmail}<br>
          ${csmPhone ? `Phone: ${csmPhone}` : ''}
        </p>
      </div>

      <p>Either way, I hope things are going well for you and the team at ${customerName}. Maybe our paths will cross again someday - professionally or otherwise.</p>

      <p>
        Take care,<br>
        <strong>${csmName}</strong>
      </p>

      <p style="font-size: 13px; color: #888; margin-top: 30px;"><em>P.S. - This is the last email you'll receive from this sequence. If you ever want to reconnect about ${productName} in the future, you know where to find me.</em></p>
    </div>
    <div class="footer">
      <p>Final email in this series. No more follow-ups scheduled.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

This is the last email in this series, and I wanted to end it differently than most outreach campaigns.

No pitch. No pressure. No hidden agenda.

I genuinely enjoyed working with ${customerName}, and I'd love to catch up over a quick call or coffee - virtual or otherwise. Whether you ever become a customer again or not.
${customMessage ? `
${customMessage}
` : ''}
HERE'S WHAT I'M THINKING:
${'-'.repeat(25)}

- 15-minute virtual coffee: Quick catch-up, hear what you're working on
${localMeetingOption ? '- Coffee in person: If you\'re in the area, let\'s grab a real cup' : ''}
- Just a quick email exchange: If you prefer, just reply with an update

${calendarLink ? `Schedule a chat: ${calendarLink}` : ''}
Or just reply to this email.

REACH ME DIRECTLY:
${'-'.repeat(18)}
Email: ${csmEmail}
${csmPhone ? `Phone: ${csmPhone}` : ''}

Either way, I hope things are going well for you and the team at ${customerName}. Maybe our paths will cross again someday - professionally or otherwise.

Take care,
${csmName}

P.S. - This is the last email you'll receive from this sequence. If you ever want to reconnect about ${productName} in the future, you know where to find me.

---
Final email in this series. No more follow-ups scheduled.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWinbackDay28Email;
