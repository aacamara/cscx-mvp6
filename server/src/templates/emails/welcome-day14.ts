/**
 * Day 14 Check-in Email Template
 * Fourth email in the onboarding welcome sequence
 * Purpose: Progress check, common questions, office hours invite
 */

export interface WelcomeDay14Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  productName?: string;
  progressHighlights?: string[];
  commonQuestions?: Array<{ question: string; answer: string }>;
  officeHoursLink?: string;
  officeHoursSchedule?: string;
  nextMilestone?: string;
  healthScore?: number;
}

export function generateWelcomeDay14Email(variables: WelcomeDay14Variables): {
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
    progressHighlights = [],
    commonQuestions = [
      {
        question: 'How do I add more team members?',
        answer: 'Navigate to Settings > Team Members and click "Invite User". You can set their role and permissions during the invite process.'
      },
      {
        question: 'Where can I see my usage metrics?',
        answer: 'Check out the Analytics dashboard for a complete view of your team\'s activity and adoption.'
      },
      {
        question: 'How do I integrate with my existing tools?',
        answer: 'Visit the Integrations page in Settings. We support 50+ popular tools with step-by-step setup guides.'
      },
    ],
    officeHoursLink,
    officeHoursSchedule,
    nextMilestone,
    healthScore,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `How's Your First Two Weeks Going, ${firstName}?`;

  const progressSection = progressHighlights.length > 0
    ? `
      <div class="progress-box">
        <h3>Your Progress So Far</h3>
        <ul>
          ${progressHighlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
        ${healthScore ? `<p><strong>Health Score:</strong> ${healthScore}/100 - Keep it up!</p>` : ''}
      </div>
    `
    : '';

  const progressText = progressHighlights.length > 0
    ? `
YOUR PROGRESS SO FAR
--------------------
${progressHighlights.map(h => `- ${h}`).join('\n')}
${healthScore ? `Health Score: ${healthScore}/100 - Keep it up!` : ''}
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
    .header { background: linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .progress-box { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #28a745; }
    .progress-box h3 { margin-top: 0; color: #155724; }
    .faq-item { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 15px 0; }
    .faq-item h4 { color: #1d3557; margin: 0 0 8px 0; }
    .faq-item p { margin: 0; color: #555; }
    .section { margin: 25px 0; }
    .section h3 { color: #1d3557; border-bottom: 2px solid #f4a261; padding-bottom: 8px; }
    .office-hours-box { background: #e7f1ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #4a90d9; text-align: center; }
    .office-hours-box h3 { margin-top: 0; color: #1d3557; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .quick-poll { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107; }
    .quick-poll h3 { margin-top: 0; color: #856404; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Two Week Check-In</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>Hard to believe it's already been two weeks since we kicked off your ${productName} journey with ${customerName}! I wanted to check in and see how things are going.</p>

      ${progressSection}

      <div class="section">
        <h3>Common Questions at This Stage</h3>
        <p>Here are answers to questions I typically hear around week 2:</p>
        ${commonQuestions.map(faq => `
          <div class="faq-item">
            <h4>Q: ${faq.question}</h4>
            <p>A: ${faq.answer}</p>
          </div>
        `).join('')}
      </div>

      ${officeHoursLink ? `
      <div class="office-hours-box">
        <h3>Join Our Office Hours</h3>
        <p>Have questions? Join our live office hours session where you can get answers in real-time from our team.</p>
        ${officeHoursSchedule ? `<p><strong>Schedule:</strong> ${officeHoursSchedule}</p>` : ''}
        <a href="${officeHoursLink}" class="cta-button">Register for Office Hours</a>
      </div>
      ` : ''}

      <div class="quick-poll">
        <h3>Quick Check-In</h3>
        <p>I'd love to hear from you:</p>
        <ul>
          <li>What's working well so far?</li>
          <li>Any blockers or challenges?</li>
          <li>Questions from your team?</li>
        </ul>
        <p>Just hit reply - I read every response!</p>
      </div>

      ${nextMilestone ? `<p><strong>Coming Up:</strong> ${nextMilestone}</p>` : ''}

      <p>Looking forward to hearing how it's going!</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is email 4 of 5 in your onboarding welcome sequence. Your 30-day milestone check-in is coming up!</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

Hard to believe it's already been two weeks since we kicked off your ${productName} journey with ${customerName}! I wanted to check in and see how things are going.
${progressText}
COMMON QUESTIONS AT THIS STAGE
------------------------------
Here are answers to questions I typically hear around week 2:

${commonQuestions.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}

${officeHoursLink ? `
JOIN OUR OFFICE HOURS
---------------------
Have questions? Join our live office hours session where you can get answers in real-time from our team.
${officeHoursSchedule ? `Schedule: ${officeHoursSchedule}` : ''}
Register here: ${officeHoursLink}
` : ''}

QUICK CHECK-IN
--------------
I'd love to hear from you:
- What's working well so far?
- Any blockers or challenges?
- Questions from your team?

Just hit reply - I read every response!

${nextMilestone ? `Coming Up: ${nextMilestone}` : ''}

Looking forward to hearing how it's going!

Best regards,
${csmName}
${csmEmail}

---
This is email 4 of 5 in your onboarding welcome sequence. Your 30-day milestone check-in is coming up!
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWelcomeDay14Email;
