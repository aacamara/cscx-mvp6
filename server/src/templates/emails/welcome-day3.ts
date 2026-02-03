/**
 * Day 3 Kickoff Prep Email Template
 * Second email in the onboarding welcome sequence
 * Purpose: Meeting agenda, pre-work suggestions, attendee list
 */

export interface WelcomeDay3Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  kickoffDate: string;
  kickoffTime: string;
  meetingLink?: string;
  attendees?: Array<{ name: string; role: string }>;
  agenda?: string[];
  prework?: string[];
}

export function generateWelcomeDay3Email(variables: WelcomeDay3Variables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    kickoffDate,
    kickoffTime,
    meetingLink,
    attendees = [],
    agenda = [
      'Introductions and goal setting (15 min)',
      'Platform overview and key features (20 min)',
      'Your success metrics and KPIs (15 min)',
      'Implementation timeline and next steps (10 min)',
    ],
    prework = [
      'Identify 2-3 key goals you want to achieve with our platform',
      'List any specific challenges you\'re looking to solve',
      'Gather questions from your team',
    ],
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `Preparing for Tomorrow's Kickoff Meeting - ${customerName}`;

  const attendeeListHtml = attendees.length > 0
    ? `<ul>${attendees.map(a => `<li><strong>${a.name}</strong> - ${a.role}</li>`).join('')}</ul>`
    : '<p><em>Attendee list will be confirmed shortly</em></p>';

  const attendeeListText = attendees.length > 0
    ? attendees.map(a => `  - ${a.name} (${a.role})`).join('\n')
    : '  Attendee list will be confirmed shortly';

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
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .meeting-box { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #457b9d; }
    .meeting-box h3 { margin-top: 0; color: #1d3557; }
    .section { margin: 25px 0; }
    .section h3 { color: #1d3557; border-bottom: 2px solid #e63946; padding-bottom: 8px; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .checklist li { list-style: none; padding-left: 5px; }
    .checklist li:before { content: "\\2610 "; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Kickoff Meeting is Coming Up!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I'm looking forward to our kickoff meeting! Here's everything you need to know to make the most of our time together.</p>

      <div class="meeting-box">
        <h3>Meeting Details</h3>
        <p>
          <strong>Date:</strong> ${kickoffDate}<br>
          <strong>Time:</strong> ${kickoffTime}<br>
          ${meetingLink ? `<strong>Join Link:</strong> <a href="${meetingLink}">${meetingLink}</a>` : ''}
        </p>
        ${meetingLink ? `<a href="${meetingLink}" class="cta-button">Join Meeting</a>` : ''}
      </div>

      <div class="section">
        <h3>Proposed Agenda</h3>
        <ol>
          ${agenda.map(item => `<li>${item}</li>`).join('')}
        </ol>
      </div>

      <div class="section">
        <h3>Attendees</h3>
        ${attendeeListHtml}
      </div>

      <div class="section">
        <h3>Quick Pre-Work (Optional)</h3>
        <p>To make our kickoff as productive as possible, consider:</p>
        <ul class="checklist">
          ${prework.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <p>Don't worry if you don't have time for the pre-work - we can absolutely dive in during the call. The most important thing is having the right people in the room.</p>

      <p>See you soon!</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is email 2 of 5 in your onboarding welcome sequence. Reply to reschedule or add attendees.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I'm looking forward to our kickoff meeting! Here's everything you need to know to make the most of our time together.

MEETING DETAILS
---------------
Date: ${kickoffDate}
Time: ${kickoffTime}
${meetingLink ? `Join Link: ${meetingLink}` : ''}

PROPOSED AGENDA
---------------
${agenda.map((item, i) => `${i + 1}. ${item}`).join('\n')}

ATTENDEES
---------
${attendeeListText}

QUICK PRE-WORK (Optional)
-------------------------
To make our kickoff as productive as possible, consider:
${prework.map(item => `- ${item}`).join('\n')}

Don't worry if you don't have time for the pre-work - we can absolutely dive in during the call. The most important thing is having the right people in the room.

See you soon!

Best regards,
${csmName}
${csmEmail}

---
This is email 2 of 5 in your onboarding welcome sequence. Reply to reschedule or add attendees.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWelcomeDay3Email;
