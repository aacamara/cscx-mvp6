/**
 * Day 1 Welcome Email Template
 * First email in the onboarding welcome sequence
 * Purpose: Warm welcome, CSM introduction, what to expect
 */

export interface WelcomeDay1Variables {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  arr?: number;
  productName?: string;
  kickoffDate?: string;
  calendarLink?: string;
}

export function generateWelcomeDay1Email(variables: WelcomeDay1Variables): {
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
    kickoffDate,
    calendarLink,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `Welcome to ${productName}, ${firstName}! Your Success Journey Starts Here`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #e63946 0%, #1d3557 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .highlight { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e63946; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${customerName}'s Success Journey!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I'm <strong>${csmName}</strong>, your dedicated ${csmTitle}, and I'm thrilled to welcome you to ${productName}!</p>

      <p>From this point forward, I'll be your primary point of contact, working closely with you and the ${customerName} team to ensure you get maximum value from our partnership.</p>

      <div class="highlight">
        <strong>What to Expect Next:</strong>
        <ul>
          <li><strong>Kickoff Meeting</strong> - We'll schedule a call to align on your goals and create your personalized success plan${kickoffDate ? ` (tentatively ${kickoffDate})` : ''}</li>
          <li><strong>Onboarding Resources</strong> - You'll receive access to training materials and documentation</li>
          <li><strong>Regular Check-ins</strong> - I'll be in touch throughout your journey to ensure everything is on track</li>
        </ul>
      </div>

      <p>I've reviewed your account details and I'm excited about the possibilities ahead. My goal is to help ${customerName} achieve your business objectives quickly and efficiently.</p>

      ${calendarLink ? `
      <p>Ready to get started? Let's schedule your kickoff meeting:</p>
      <a href="${calendarLink}" class="cta-button">Schedule Kickoff Call</a>
      ` : `
      <p>I'll be reaching out shortly to schedule our kickoff call. In the meantime, feel free to reply to this email with any questions or specific goals you'd like to discuss.</p>
      `}

      <p>Looking forward to a successful partnership!</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is the first email in your onboarding welcome sequence. You'll receive helpful resources and check-ins over the next 30 days.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I'm ${csmName}, your dedicated ${csmTitle}, and I'm thrilled to welcome you to ${productName}!

From this point forward, I'll be your primary point of contact, working closely with you and the ${customerName} team to ensure you get maximum value from our partnership.

WHAT TO EXPECT NEXT:

- Kickoff Meeting - We'll schedule a call to align on your goals and create your personalized success plan${kickoffDate ? ` (tentatively ${kickoffDate})` : ''}
- Onboarding Resources - You'll receive access to training materials and documentation
- Regular Check-ins - I'll be in touch throughout your journey to ensure everything is on track

I've reviewed your account details and I'm excited about the possibilities ahead. My goal is to help ${customerName} achieve your business objectives quickly and efficiently.

${calendarLink ? `Ready to get started? Schedule your kickoff call here: ${calendarLink}` : `I'll be reaching out shortly to schedule our kickoff call. In the meantime, feel free to reply to this email with any questions or specific goals you'd like to discuss.`}

Looking forward to a successful partnership!

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
This is the first email in your onboarding welcome sequence. You'll receive helpful resources and check-ins over the next 30 days.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWelcomeDay1Email;
