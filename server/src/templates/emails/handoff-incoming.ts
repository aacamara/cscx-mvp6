/**
 * PRD-051: Handoff Introduction Email - Incoming CSM Template
 * Email from incoming CSM introducing themselves to the customer
 */

export interface HandoffIncomingVariables {
  // Customer Info
  customerName: string;
  contactName: string;
  contactTitle?: string;

  // Incoming CSM Info
  incomingCsmName: string;
  incomingCsmEmail: string;
  incomingCsmTitle?: string;
  incomingCsmPhone?: string;
  incomingCsmBio?: string;
  incomingCsmLinkedIn?: string;
  incomingCsmCalendarLink?: string;

  // Outgoing CSM Info (for reference)
  outgoingCsmName: string;

  // Context from briefing
  relationshipTenure: number; // months
  arr?: number;
  healthScore?: number;
  upcomingRenewal?: boolean;
  renewalDays?: number;
  expansionDiscussion?: boolean;
  ongoingInitiatives?: string[];

  // Key insights from handoff
  communicationStyle?: 'formal' | 'casual' | 'direct' | 'collaborative';
  preferredChannels?: string[];
  keyPriorities?: string[];

  // Meeting options
  suggestIntroCall?: boolean;
  proposedMeetingTimes?: string[];
}

export interface HandoffIncomingResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export function generateHandoffIncomingEmail(variables: HandoffIncomingVariables): HandoffIncomingResult {
  const {
    customerName,
    contactName,
    incomingCsmName,
    incomingCsmEmail,
    incomingCsmTitle = 'Customer Success Manager',
    incomingCsmPhone,
    incomingCsmBio,
    incomingCsmLinkedIn,
    incomingCsmCalendarLink,
    outgoingCsmName,
    relationshipTenure,
    arr,
    healthScore,
    upcomingRenewal,
    renewalDays,
    expansionDiscussion,
    ongoingInitiatives = [],
    communicationStyle = 'collaborative',
    preferredChannels = [],
    keyPriorities = [],
    suggestIntroCall = true,
    proposedMeetingTimes = [],
  } = variables;

  const firstName = contactName.split(' ')[0];
  const incomingFirstName = incomingCsmName.split(' ')[0];
  const outgoingFirstName = outgoingCsmName.split(' ')[0];

  // Adjust tone based on communication style
  const greeting = communicationStyle === 'formal' ? `Dear ${firstName}` : `Hi ${firstName}`;
  const signoff = communicationStyle === 'formal' ? 'Best regards' : 'Looking forward to connecting';

  // Build contact section
  const contactMethods: string[] = [];
  if (incomingCsmEmail) contactMethods.push(`Email: ${incomingCsmEmail}`);
  if (incomingCsmPhone) contactMethods.push(`Phone: ${incomingCsmPhone}`);
  if (incomingCsmLinkedIn) contactMethods.push(`LinkedIn: ${incomingCsmLinkedIn}`);

  // Build context about what they know
  const contextPoints: string[] = [];
  if (relationshipTenure > 12) {
    contextPoints.push(`Your ${Math.floor(relationshipTenure / 12)}+ year partnership with us`);
  }
  if (ongoingInitiatives.length > 0) {
    contextPoints.push(`The ongoing ${ongoingInitiatives.slice(0, 2).join(' and ')} initiative${ongoingInitiatives.length > 1 ? 's' : ''}`);
  }
  if (expansionDiscussion) {
    contextPoints.push('The expansion conversations you\'ve been exploring');
  }
  if (upcomingRenewal && renewalDays) {
    contextPoints.push(`Your upcoming renewal in ${renewalDays} days`);
  }
  if (keyPriorities.length > 0) {
    contextPoints.push(`Your key priorities around ${keyPriorities.slice(0, 2).join(' and ')}`);
  }

  const subject = `${incomingFirstName} Here - Your New Customer Success Partner`;

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
    .section { margin: 24px 0; }
    .about-me { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .briefed-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
    .briefed-box ul { margin: 10px 0 0 0; padding-left: 20px; }
    .briefed-box li { margin: 6px 0; }
    .commitment-box { background: #fff8e6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .commitment-box ul { margin: 10px 0 0 0; padding-left: 20px; }
    .commitment-box li { margin: 6px 0; }
    .contact-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .contact-box p { margin: 6px 0; }
    .cta-button { display: inline-block; background: #1d3557; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .cta-button:hover { background: #152a44; }
    .secondary-button { display: inline-block; background: transparent; color: #1d3557; padding: 10px 20px; text-decoration: none; border-radius: 6px; border: 2px solid #1d3557; margin: 10px 10px 10px 0; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hello from Your New Customer Success Manager!</h1>
    </div>
    <div class="content">
      <p>${greeting},</p>

      <p>As ${outgoingFirstName} mentioned, I'm <strong>${incomingCsmName}</strong>, and I'm excited to be your new ${incomingCsmTitle}. I wanted to reach out personally to introduce myself and let you know how committed I am to supporting ${customerName}'s continued success.</p>

      ${incomingCsmBio ? `
      <div class="section">
        <div class="about-me">
          <p><strong>A bit about me:</strong> ${incomingCsmBio}</p>
        </div>
      </div>
      ` : ''}

      ${contextPoints.length > 0 ? `
      <div class="section">
        <div class="briefed-box">
          <p><strong>I've been thoroughly briefed</strong> by ${outgoingFirstName}, and I'm already familiar with:</p>
          <ul>
            ${contextPoints.map(point => `<li>${point}</li>`).join('\n            ')}
          </ul>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <div class="commitment-box">
          <p><strong>My commitment to you:</strong></p>
          <ul>
            <li><strong>Continuity First</strong> - I'll pick up right where ${outgoingFirstName} left off, with no disruption to your ongoing work</li>
            <li><strong>Your Goals, My Priority</strong> - I'll invest time understanding your unique objectives and how I can best support them</li>
            <li><strong>Proactive Partnership</strong> - I believe in anticipating needs, not just reacting to them</li>
            <li><strong>Always Available</strong> - My door (virtual or otherwise) is always open</li>
          </ul>
        </div>
      </div>

      ${suggestIntroCall ? `
      <div class="section">
        <p>I'd love to schedule a brief introductory call to:</p>
        <ul>
          <li>Put a face to the name</li>
          <li>Learn more about your priorities directly from you</li>
          <li>Answer any questions you might have</li>
          <li>Discuss how I can best support you going forward</li>
        </ul>

        ${incomingCsmCalendarLink ? `
        <a href="${incomingCsmCalendarLink}" class="cta-button">Schedule Our Intro Call</a>
        ` : `
        <p>Would any of these times work for a 30-minute introduction?</p>
        ${proposedMeetingTimes.length > 0 ? `<p><em>${proposedMeetingTimes.join(' | ')}</em></p>` : '<p>Just reply with your availability and I\'ll send a calendar invite.</p>'}
        `}
      </div>
      ` : ''}

      <div class="section">
        <div class="contact-box">
          <p><strong>Here's how to reach me:</strong></p>
          ${contactMethods.map(method => `<p>${method}</p>`).join('\n          ')}
          <p><em>I typically respond within a few hours during business hours.</em></p>
        </div>
      </div>

      <p>I'm genuinely looking forward to working with you and the ${customerName} team. ${outgoingFirstName} spoke so highly of your partnership, and I'm honored to continue supporting your success.</p>

      <div class="signature">
        <p>
          ${signoff},<br>
          <strong>${incomingCsmName}</strong><br>
          ${incomingCsmTitle}<br>
          <a href="mailto:${incomingCsmEmail}">${incomingCsmEmail}</a>
          ${incomingCsmPhone ? `<br>${incomingCsmPhone}` : ''}
        </p>
      </div>
    </div>
    <div class="footer">
      <p>We're committed to making this transition as smooth as possible. If you have any concerns, please don't hesitate to reach out.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
${greeting},

As ${outgoingFirstName} mentioned, I'm ${incomingCsmName}, and I'm excited to be your new ${incomingCsmTitle}. I wanted to reach out personally to introduce myself and let you know how committed I am to supporting ${customerName}'s continued success.

${incomingCsmBio ? `A BIT ABOUT ME\n${incomingCsmBio}\n` : ''}

${contextPoints.length > 0 ? `I'VE BEEN THOROUGHLY BRIEFED by ${outgoingFirstName}, and I'm already familiar with:\n${contextPoints.map(point => `- ${point}`).join('\n')}\n` : ''}

MY COMMITMENT TO YOU:
- Continuity First - I'll pick up right where ${outgoingFirstName} left off, with no disruption to your ongoing work
- Your Goals, My Priority - I'll invest time understanding your unique objectives and how I can best support them
- Proactive Partnership - I believe in anticipating needs, not just reacting to them
- Always Available - My door (virtual or otherwise) is always open

${suggestIntroCall ? `
I'd love to schedule a brief introductory call to:
- Put a face to the name
- Learn more about your priorities directly from you
- Answer any questions you might have
- Discuss how I can best support you going forward

${incomingCsmCalendarLink ? `Schedule here: ${incomingCsmCalendarLink}` : `${proposedMeetingTimes.length > 0 ? `Would any of these times work? ${proposedMeetingTimes.join(' | ')}` : 'Just reply with your availability and I\'ll send a calendar invite.'}`}
` : ''}

HERE'S HOW TO REACH ME:
${contactMethods.join('\n')}
I typically respond within a few hours during business hours.

I'm genuinely looking forward to working with you and the ${customerName} team. ${outgoingFirstName} spoke so highly of your partnership, and I'm honored to continue supporting your success.

${signoff},
${incomingCsmName}
${incomingCsmTitle}
${incomingCsmEmail}
${incomingCsmPhone || ''}

---
We're committed to making this transition as smooth as possible. If you have any concerns, please don't hesitate to reach out.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateHandoffIncomingEmail;
