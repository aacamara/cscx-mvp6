/**
 * PRD-051: Handoff Introduction Email - Outgoing CSM Template
 * Email from outgoing CSM introducing the new CSM to the customer
 */

export interface HandoffOutgoingVariables {
  // Customer Info
  customerName: string;
  contactName: string;
  contactTitle?: string;

  // Outgoing CSM Info
  outgoingCsmName: string;
  outgoingCsmEmail: string;
  outgoingCsmTitle?: string;

  // Incoming CSM Info
  incomingCsmName: string;
  incomingCsmEmail: string;
  incomingCsmTitle?: string;
  incomingCsmBio?: string;
  incomingCsmSpecializations?: string[];
  incomingCsmTenure?: number; // years at company

  // Context
  relationshipTenure: number; // months
  arr?: number;
  healthScore?: number;
  upcomingRenewal?: boolean;
  renewalDays?: number;
  expansionDiscussion?: boolean;

  // Relationship Highlights
  highlights?: string[];

  // Transition Details
  transitionReason?: string;
  effectiveDate?: string;
  availableUntil?: string;
  personalEmail?: string;

  // Meeting Options
  offerTransitionMeeting?: boolean;
  meetingLink?: string;
}

export interface HandoffOutgoingResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export function generateHandoffOutgoingEmail(variables: HandoffOutgoingVariables): HandoffOutgoingResult {
  const {
    customerName,
    contactName,
    outgoingCsmName,
    outgoingCsmEmail,
    outgoingCsmTitle = 'Customer Success Manager',
    incomingCsmName,
    incomingCsmEmail,
    incomingCsmTitle = 'Customer Success Manager',
    incomingCsmBio,
    incomingCsmSpecializations = [],
    incomingCsmTenure,
    relationshipTenure,
    arr,
    healthScore,
    upcomingRenewal,
    renewalDays,
    expansionDiscussion,
    highlights = [],
    transitionReason,
    effectiveDate,
    availableUntil,
    personalEmail,
    offerTransitionMeeting = true,
    meetingLink,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const incomingFirstName = incomingCsmName.split(' ')[0];

  // Build specializations list
  const specializationsList = incomingCsmSpecializations.length > 0
    ? incomingCsmSpecializations.map(s => `- ${s}`).join('\n')
    : '';

  // Build highlights list
  const highlightsList = highlights.length > 0
    ? highlights.map(h => `<li>${h}</li>`).join('\n')
    : '';

  // Tenure text
  const tenureText = incomingCsmTenure
    ? `has been with our team for ${incomingCsmTenure} ${incomingCsmTenure === 1 ? 'year' : 'years'}`
    : 'is a valued member of our team';

  // Context about expansion/renewal if applicable
  const contextualNote = expansionDiscussion
    ? `(relevant for your expansion plans!)`
    : upcomingRenewal && renewalDays
      ? `(timely given your upcoming renewal in ${renewalDays} days)`
      : '';

  const subject = `Introducing Your New Customer Success Manager - ${incomingCsmName}`;

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
    .section { margin: 24px 0; }
    .section-title { font-size: 16px; font-weight: 600; color: #1d3557; margin-bottom: 12px; }
    .highlight-box { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #e63946; }
    .csm-intro { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .csm-intro h3 { margin: 0 0 12px 0; color: #1d3557; }
    .specializations { margin: 12px 0; padding-left: 20px; }
    .specializations li { margin: 6px 0; }
    .next-steps { background: #fff8e6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .next-steps ol { margin: 0; padding-left: 20px; }
    .next-steps li { margin: 8px 0; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>An Important Update About Your Customer Success Partnership</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I hope you're doing well! I'm reaching out with some news${transitionReason ? ` - ${transitionReason}` : ''}, which means I'll be handing off our partnership to one of our best ${incomingCsmTitle}s, <strong>${incomingCsmName}</strong>.</p>

      ${highlights.length > 0 ? `
      <div class="section">
        <div class="section-title">First, Thank You</div>
        <div class="highlight-box">
          <p>Working with ${customerName} over the past ${Math.floor(relationshipTenure)} months has been genuinely rewarding. Some highlights from our journey:</p>
          <ul>
            ${highlightsList}
          </ul>
        </div>
      </div>
      ` : `
      <div class="section">
        <div class="section-title">First, Thank You</div>
        <div class="highlight-box">
          <p>Working with ${customerName} over the past ${Math.floor(relationshipTenure)} months has been genuinely rewarding. Watching your team's progress and the value you've achieved has been one of my career highlights.</p>
        </div>
      </div>
      `}

      <div class="section">
        <div class="section-title">About ${incomingFirstName}</div>
        <div class="csm-intro">
          <p>${incomingCsmName} ${tenureText}${incomingCsmBio ? ` and ${incomingCsmBio}` : ''}.</p>
          ${incomingCsmSpecializations.length > 0 ? `
          <p>${incomingFirstName} is exceptional at:</p>
          <ul class="specializations">
            ${incomingCsmSpecializations.map(s => `<li>${s} ${contextualNote && s.toLowerCase().includes('expansion') ? contextualNote : ''}</li>`).join('\n            ')}
          </ul>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">What Happens Next</div>
        <div class="next-steps">
          <ol>
            <li><strong>Comprehensive Briefing</strong> - I've already briefed ${incomingFirstName} on everything - your history, preferences, ongoing initiatives${expansionDiscussion ? ', and the expansion conversation' : ''}</li>
            <li><strong>Personal Introduction</strong> - ${incomingFirstName} will reach out this week to introduce themselves</li>
            ${offerTransitionMeeting ? `<li><strong>Transition Call</strong> - We can schedule a three-way transition call if you'd like</li>` : ''}
            <li><strong>Seamless Continuity</strong> - All your documents, history, and context remain fully intact</li>
          </ol>
        </div>
      </div>

      ${availableUntil ? `
      <div class="section">
        <div class="section-title">My Commitment</div>
        <p>I'll remain available through <strong>${availableUntil}</strong> if you need anything during the transition.${personalEmail ? ` And I genuinely mean it - my personal email is <a href="mailto:${personalEmail}">${personalEmail}</a> - don't hesitate to reach out.` : ''}</p>
      </div>
      ` : ''}

      ${meetingLink ? `
      <p>If you'd like to schedule a transition call, please use the link below:</p>
      <a href="${meetingLink}" class="cta-button">Schedule Transition Call</a>
      ` : ''}

      <p>It's been an honor working with you, ${firstName}. ${customerName} is in excellent hands with ${incomingFirstName}.</p>

      <div class="signature">
        <p>
          Warmly,<br>
          <strong>${outgoingCsmName}</strong><br>
          ${outgoingCsmTitle}<br>
          <a href="mailto:${outgoingCsmEmail}">${outgoingCsmEmail}</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <p>This message is part of a planned customer success transition to ensure continuous, high-quality support for ${customerName}.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I hope you're doing well! I'm reaching out with some news${transitionReason ? ` - ${transitionReason}` : ''}, which means I'll be handing off our partnership to one of our best ${incomingCsmTitle}s, ${incomingCsmName}.

FIRST, THANK YOU
${highlights.length > 0
  ? `Working with ${customerName} over the past ${Math.floor(relationshipTenure)} months has been genuinely rewarding. Some highlights from our journey:\n${highlights.map(h => `- ${h}`).join('\n')}`
  : `Working with ${customerName} over the past ${Math.floor(relationshipTenure)} months has been genuinely rewarding. Watching your team's progress and the value you've achieved has been one of my career highlights.`}

ABOUT ${incomingFirstName.toUpperCase()}
${incomingCsmName} ${tenureText}${incomingCsmBio ? ` and ${incomingCsmBio}` : ''}.
${incomingCsmSpecializations.length > 0 ? `\n${incomingFirstName} is exceptional at:\n${incomingCsmSpecializations.map(s => `- ${s}`).join('\n')}` : ''}

WHAT HAPPENS NEXT
1. Comprehensive Briefing - I've already briefed ${incomingFirstName} on everything - your history, preferences, ongoing initiatives${expansionDiscussion ? ', and the expansion conversation' : ''}
2. Personal Introduction - ${incomingFirstName} will reach out this week to introduce themselves
${offerTransitionMeeting ? `3. Transition Call - We can schedule a three-way transition call if you'd like\n4.` : '3.'} Seamless Continuity - All your documents, history, and context remain fully intact

${availableUntil ? `MY COMMITMENT\nI'll remain available through ${availableUntil} if you need anything during the transition.${personalEmail ? ` And I genuinely mean it - my personal email is ${personalEmail} - don't hesitate to reach out.` : ''}` : ''}

${meetingLink ? `Schedule a transition call: ${meetingLink}` : ''}

It's been an honor working with you, ${firstName}. ${customerName} is in excellent hands with ${incomingFirstName}.

Warmly,
${outgoingCsmName}
${outgoingCsmTitle}
${outgoingCsmEmail}

---
This message is part of a planned customer success transition to ensure continuous, high-quality support for ${customerName}.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateHandoffOutgoingEmail;
