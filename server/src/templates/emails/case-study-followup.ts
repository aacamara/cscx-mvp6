/**
 * Case Study Follow-up Email Template
 * PRD-048: Case Study Request
 *
 * Generates follow-up emails for case study requests:
 * - Gentle reminder if no response
 * - Scheduling confirmation after acceptance
 * - Draft review request
 * - Publication notification
 */

export type CaseStudyFollowupType =
  | 'reminder'
  | 'scheduling'
  | 'draft_review'
  | 'publication'
  | 'declined_acknowledgment';

export interface CaseStudyFollowupData {
  followupType: CaseStudyFollowupType;
  customer: {
    id: string;
    name: string;
    industry: string;
  };
  stakeholder: {
    name: string;
    email: string;
    title?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    calendarLink?: string;
  };
  caseStudy?: {
    id: string;
    title?: string;
    interviewDate?: string;
    interviewTime?: string;
    draftUrl?: string;
    publicUrl?: string;
    reviewDeadline?: string;
  };
  originalRequestDate?: string;
  customMessage?: string;
}

export interface CaseStudyFollowupResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate case study follow-up email based on type
 */
export function generateCaseStudyFollowupEmail(data: CaseStudyFollowupData): CaseStudyFollowupResult {
  const { followupType, customer, stakeholder, csm, caseStudy, originalRequestDate, customMessage } = data;

  const firstName = stakeholder.name.split(' ')[0];

  switch (followupType) {
    case 'reminder':
      return generateReminderEmail(firstName, customer, stakeholder, csm, originalRequestDate, customMessage);
    case 'scheduling':
      return generateSchedulingEmail(firstName, customer, stakeholder, csm, caseStudy, customMessage);
    case 'draft_review':
      return generateDraftReviewEmail(firstName, customer, stakeholder, csm, caseStudy, customMessage);
    case 'publication':
      return generatePublicationEmail(firstName, customer, stakeholder, csm, caseStudy, customMessage);
    case 'declined_acknowledgment':
      return generateDeclinedEmail(firstName, customer, stakeholder, csm, customMessage);
    default:
      throw new Error(`Unknown follow-up type: ${followupType}`);
  }
}

function generateReminderEmail(
  firstName: string,
  customer: CaseStudyFollowupData['customer'],
  stakeholder: CaseStudyFollowupData['stakeholder'],
  csm: CaseStudyFollowupData['csm'],
  originalRequestDate?: string,
  customMessage?: string
): CaseStudyFollowupResult {
  const subject = `Quick follow-up: Case study opportunity for ${customer.name}`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .highlight-box { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7; }
    .cta-btn { display: inline-block; padding: 12px 24px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Quick Follow-Up</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>I wanted to follow up on my earlier note about featuring ${customer.name} in a case study. I know you're busy, so I wanted to make sure it didn't get lost in your inbox!</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="highlight-box">
      <p style="margin: 0;"><strong>Quick Reminder:</strong> We'd love to tell ${customer.name}'s success story. It's a ${45}-minute interview at your convenience, and you'd have full approval over the final content.</p>
    </div>

    <p>If you're interested, just hit reply and we can find a time that works. If now isn't the right time, no worries at all - just let me know and I won't follow up again on this.</p>

    ${csm.calendarLink ? `
    <p style="text-align: center; margin: 24px 0;">
      <a href="${csm.calendarLink}" class="cta-btn">Schedule a Quick Chat</a>
    </p>
    ` : ''}

    <div class="footer">
      <p>Best,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}</p>
    </div>
  </div>
</body>
</html>
`;

  const bodyText = `
Quick Follow-Up

Hi ${firstName},

I wanted to follow up on my earlier note about featuring ${customer.name} in a case study. I know you're busy, so I wanted to make sure it didn't get lost in your inbox!

${customMessage || ''}

Quick Reminder: We'd love to tell ${customer.name}'s success story. It's a 45-minute interview at your convenience, and you'd have full approval over the final content.

If you're interested, just hit reply and we can find a time that works. If now isn't the right time, no worries at all - just let me know and I won't follow up again on this.

${csm.calendarLink ? `Schedule a chat: ${csm.calendarLink}` : ''}

Best,
${csm.name}
${csm.title || 'Customer Success Manager'}
`.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients: [stakeholder.email],
  };
}

function generateSchedulingEmail(
  firstName: string,
  customer: CaseStudyFollowupData['customer'],
  stakeholder: CaseStudyFollowupData['stakeholder'],
  csm: CaseStudyFollowupData['csm'],
  caseStudy?: CaseStudyFollowupData['caseStudy'],
  customMessage?: string
): CaseStudyFollowupResult {
  const subject = `Case Study Interview Confirmed - ${customer.name}`;

  const interviewDate = caseStudy?.interviewDate || '[Date TBD]';
  const interviewTime = caseStudy?.interviewTime || '[Time TBD]';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #22c55e; padding-bottom: 10px; margin-bottom: 20px; }
    .confirmation-box { background: #ecfdf5; padding: 24px; border-radius: 12px; margin: 20px 0; border: 2px solid #22c55e; text-align: center; }
    .date-time { font-size: 24px; font-weight: 700; color: #166534; margin: 10px 0; }
    .prep-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .prep-list { margin: 0; padding-left: 20px; }
    .prep-list li { margin: 10px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #22c55e;">Interview Confirmed!</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>Thank you so much for agreeing to participate in our case study! I'm excited to capture ${customer.name}'s success story.</p>

    <div class="confirmation-box">
      <p style="margin: 0; color: #166534; font-weight: 600;">Your Case Study Interview</p>
      <div class="date-time">${interviewDate}</div>
      <div class="date-time" style="font-size: 18px;">${interviewTime}</div>
    </div>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="prep-section">
      <h4 style="margin: 0 0 15px 0;">What to Expect:</h4>
      <ul class="prep-list">
        <li>The interview will take about 45 minutes</li>
        <li>We'll discuss your journey, challenges, and the results you've achieved</li>
        <li>No prep needed - just come ready to share your experience!</li>
        <li>A calendar invite with the meeting link will follow shortly</li>
      </ul>
    </div>

    <p><strong>Next Steps:</strong></p>
    <ol>
      <li>Interview (scheduled above)</li>
      <li>We'll draft the case study within 1-2 weeks</li>
      <li>You'll review and approve before publication</li>
      <li>We'll share the final piece with you first!</li>
    </ol>

    <p>If you need to reschedule, just let me know - I'm happy to find another time that works.</p>

    <div class="footer">
      <p>Looking forward to it!</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}</p>
    </div>
  </div>
</body>
</html>
`;

  const bodyText = `
Interview Confirmed!

Hi ${firstName},

Thank you so much for agreeing to participate in our case study! I'm excited to capture ${customer.name}'s success story.

YOUR CASE STUDY INTERVIEW
Date: ${interviewDate}
Time: ${interviewTime}

${customMessage || ''}

WHAT TO EXPECT:
- The interview will take about 45 minutes
- We'll discuss your journey, challenges, and the results you've achieved
- No prep needed - just come ready to share your experience!
- A calendar invite with the meeting link will follow shortly

NEXT STEPS:
1. Interview (scheduled above)
2. We'll draft the case study within 1-2 weeks
3. You'll review and approve before publication
4. We'll share the final piece with you first!

If you need to reschedule, just let me know - I'm happy to find another time that works.

Looking forward to it!
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients: [stakeholder.email],
  };
}

function generateDraftReviewEmail(
  firstName: string,
  customer: CaseStudyFollowupData['customer'],
  stakeholder: CaseStudyFollowupData['stakeholder'],
  csm: CaseStudyFollowupData['csm'],
  caseStudy?: CaseStudyFollowupData['caseStudy'],
  customMessage?: string
): CaseStudyFollowupResult {
  const subject = `Your Case Study Draft is Ready for Review - ${customer.name}`;
  const reviewDeadline = caseStudy?.reviewDeadline || '5 business days';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; margin-bottom: 20px; }
    .cta-box { background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); padding: 24px; border-radius: 12px; margin: 20px 0; text-align: center; }
    .cta-btn { display: inline-block; padding: 14px 32px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .checklist { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .checklist-item { display: flex; align-items: flex-start; gap: 10px; margin: 10px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #8b5cf6;">Your Case Study Draft is Ready!</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>Great news! The ${customer.name} case study draft is ready for your review. Thank you again for taking the time to share your story - it came together beautifully!</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    ${caseStudy?.draftUrl ? `
    <div class="cta-box">
      <p style="margin: 0 0 15px 0; color: #5b21b6; font-weight: 600;">Review Your Case Study</p>
      <a href="${caseStudy.draftUrl}" class="cta-btn">View Draft</a>
    </div>
    ` : ''}

    <div class="checklist">
      <h4 style="margin: 0 0 15px 0;">When reviewing, please check:</h4>
      <div class="checklist-item">
        <span>[ ]</span>
        <span>All facts, figures, and metrics are accurate</span>
      </div>
      <div class="checklist-item">
        <span>[ ]</span>
        <span>Quotes are attributed correctly and reflect your intent</span>
      </div>
      <div class="checklist-item">
        <span>[ ]</span>
        <span>Company name and job titles are correct</span>
      </div>
      <div class="checklist-item">
        <span>[ ]</span>
        <span>No confidential information is included that shouldn't be</span>
      </div>
    </div>

    <p><strong>Timeline:</strong> Please share any feedback within ${reviewDeadline}. If I don't hear back, I'll assume it's approved!</p>

    <p>Feel free to share this with anyone else at ${customer.name} who should review it. If you have any changes or questions, just reply to this email.</p>

    <div class="footer">
      <p>Thank you!</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}</p>
    </div>
  </div>
</body>
</html>
`;

  const bodyText = `
Your Case Study Draft is Ready!

Hi ${firstName},

Great news! The ${customer.name} case study draft is ready for your review. Thank you again for taking the time to share your story - it came together beautifully!

${customMessage || ''}

${caseStudy?.draftUrl ? `VIEW YOUR DRAFT: ${caseStudy.draftUrl}` : ''}

WHEN REVIEWING, PLEASE CHECK:
[ ] All facts, figures, and metrics are accurate
[ ] Quotes are attributed correctly and reflect your intent
[ ] Company name and job titles are correct
[ ] No confidential information is included that shouldn't be

Timeline: Please share any feedback within ${reviewDeadline}. If I don't hear back, I'll assume it's approved!

Feel free to share this with anyone else at ${customer.name} who should review it. If you have any changes or questions, just reply to this email.

Thank you!
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients: [stakeholder.email],
  };
}

function generatePublicationEmail(
  firstName: string,
  customer: CaseStudyFollowupData['customer'],
  stakeholder: CaseStudyFollowupData['stakeholder'],
  csm: CaseStudyFollowupData['csm'],
  caseStudy?: CaseStudyFollowupData['caseStudy'],
  customMessage?: string
): CaseStudyFollowupResult {
  const subject = `Your Case Study is Live! - ${customer.name}`;
  const caseStudyTitle = caseStudy?.title || `${customer.name} Success Story`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .celebration-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px; margin: 20px 0; text-align: center; }
    .celebration-emoji { font-size: 48px; margin-bottom: 10px; }
    .cta-btn { display: inline-block; padding: 14px 32px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 5px; }
    .share-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .thanks-box { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Your Case Study is Live!</h2>
    </div>

    <div class="celebration-box">
      <div class="celebration-emoji">🎉</div>
      <h3 style="margin: 0; color: #92400e;">${caseStudyTitle}</h3>
      <p style="margin: 10px 0 0 0; color: #78350f;">is now published!</p>
    </div>

    <p>Hi ${firstName},</p>

    <p>I'm thrilled to share that your case study is now live! It looks fantastic, and I'm so proud to showcase ${customer.name}'s success story.</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    ${caseStudy?.publicUrl ? `
    <p style="text-align: center; margin: 24px 0;">
      <a href="${caseStudy.publicUrl}" class="cta-btn">View Your Case Study</a>
    </p>
    ` : ''}

    <div class="share-section">
      <h4 style="margin: 0 0 15px 0;">Feel free to share!</h4>
      <p style="margin: 0;">We'd love for you to share this with your network. Here are some ideas:</p>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>Post on LinkedIn (tag us and we'll share!)</li>
        <li>Share internally with your team</li>
        <li>Include in your company newsletter</li>
      </ul>
    </div>

    <div class="thanks-box">
      <p style="margin: 0;"><strong>Thank you, ${firstName}!</strong></p>
      <p style="margin: 10px 0 0 0;">Your willingness to share your experience helps other companies see what's possible. We're grateful to have ${customer.name} as a partner and advocate.</p>
    </div>

    <div class="footer">
      <p>With gratitude,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}</p>
    </div>
  </div>
</body>
</html>
`;

  const bodyText = `
Your Case Study is Live!

Hi ${firstName},

I'm thrilled to share that your case study is now live! It looks fantastic, and I'm so proud to showcase ${customer.name}'s success story.

${customMessage || ''}

${caseStudy?.publicUrl ? `VIEW YOUR CASE STUDY: ${caseStudy.publicUrl}` : ''}

FEEL FREE TO SHARE!
We'd love for you to share this with your network. Here are some ideas:
- Post on LinkedIn (tag us and we'll share!)
- Share internally with your team
- Include in your company newsletter

Thank you, ${firstName}! Your willingness to share your experience helps other companies see what's possible. We're grateful to have ${customer.name} as a partner and advocate.

With gratitude,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients: [stakeholder.email],
  };
}

function generateDeclinedEmail(
  firstName: string,
  customer: CaseStudyFollowupData['customer'],
  stakeholder: CaseStudyFollowupData['stakeholder'],
  csm: CaseStudyFollowupData['csm'],
  customMessage?: string
): CaseStudyFollowupResult {
  const subject = `No worries at all - Thank you, ${firstName}`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px; }
    .message-box { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #0284c7;">Completely Understand!</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>Thank you for getting back to me about the case study request. I completely understand that now isn't the right time - no worries at all!</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="message-box">
      <p style="margin: 0;">Our partnership with ${customer.name} is what matters most. If circumstances change in the future and you'd be interested in exploring this again, just let me know. The door is always open!</p>
    </div>

    <p>In the meantime, please don't hesitate to reach out if there's anything I can help with.</p>

    <div class="footer">
      <p>Best regards,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}</p>
    </div>
  </div>
</body>
</html>
`;

  const bodyText = `
Completely Understand!

Hi ${firstName},

Thank you for getting back to me about the case study request. I completely understand that now isn't the right time - no worries at all!

${customMessage || ''}

Our partnership with ${customer.name} is what matters most. If circumstances change in the future and you'd be interested in exploring this again, just let me know. The door is always open!

In the meantime, please don't hesitate to reach out if there's anything I can help with.

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients: [stakeholder.email],
  };
}

export default generateCaseStudyFollowupEmail;
