/**
 * Event Follow-Up Email Template - Attended
 * PRD-055: Webinar/Event Follow-Up Sequence
 *
 * Email templates for customers who attended a webinar or event.
 * Includes: Thank You (Day 1), Resources (Day 3), Discussion (Day 7)
 */

import type { EventContext, CustomerEventContext, CSMContext } from '../../../../types/eventFollowup.js';

// ============================================
// Type Definitions
// ============================================

export interface EventFollowUpAttendedData {
  event: EventContext;
  customer: CustomerEventContext;
  csm: CSMContext;
  customMessage?: string;
}

export interface EventFollowUpEmailResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

// ============================================
// Day 1: Thank You Email
// ============================================

export function generateEventThankYouEmail(data: EventFollowUpAttendedData): EventFollowUpEmailResult {
  const { event, customer, csm, customMessage } = data;
  const firstName = customer.contactName.split(' ')[0];
  const eventDateFormatted = formatDate(event.date);

  // Build key takeaways section
  const takeaways = event.keyTakeaways || [
    'Key insights from the session',
    'Best practices discussed',
    'Next steps for implementation',
  ];

  // Resources links
  const hasRecording = !!event.recordingUrl;
  const hasSlides = !!event.slidesUrl;
  const hasSummary = !!event.summaryDocUrl;

  const subject = `Thanks for Joining, ${firstName} - Your ${event.name} Key Takeaways`;

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
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .highlight-box { background: #f0fff0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
    .resources-box { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; font-weight: 500; }
    .cta-button:hover { background: #c5303c; }
    .cta-button.secondary { background: #1d3557; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .takeaway-item { display: flex; align-items: flex-start; margin: 12px 0; }
    .takeaway-bullet { background: #e63946; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0; }
    a { color: #e63946; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thanks for Joining Us!</h1>
      <p>${event.name} | ${eventDateFormatted}</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>Great to see you at ${event.type === 'webinar' ? "yesterday's" : 'the'} <strong>${event.name}</strong>${customer.askedQuestions ? ' - I noticed you participated in the Q&A session, hope you found it valuable!' : '!'}</p>

      ${customMessage ? `<p>${customMessage}</p>` : ''}

      <div class="highlight-box">
        <strong>Key Takeaways:</strong>
        ${takeaways.map((t, i) => `
        <div class="takeaway-item">
          <span class="takeaway-bullet">${i + 1}</span>
          <span>${t}</span>
        </div>
        `).join('')}
      </div>

      ${(hasRecording || hasSlides || hasSummary) ? `
      <div class="resources-box">
        <strong>Your Resources:</strong>
        <ul>
          ${hasRecording ? `<li><a href="${event.recordingUrl}">Session Recording</a></li>` : ''}
          ${hasSlides ? `<li><a href="${event.slidesUrl}">Presentation Slides</a></li>` : ''}
          ${hasSummary ? `<li><a href="${event.summaryDocUrl}">Session Summary</a></li>` : ''}
        </ul>
      </div>
      ` : ''}

      <p><strong>For ${customer.customerName} Specifically:</strong></p>
      <p>Given your ${customer.industry ? customer.industry + ' ' : ''}team's focus, I think the insights from this session are particularly relevant to your current initiatives. I'd love to hear your thoughts on how these concepts might apply to your workflows.</p>

      <p>I'll be sending over some additional resources in a few days, but in the meantime, feel free to reach out with any questions!</p>

      <p>
        Best regards,<br>
        <strong>${csm.name}</strong><br>
        ${csm.title || 'Customer Success Manager'}<br>
        ${csm.email}
      </p>
    </div>
    <div class="footer">
      <p>This is the first email in your post-event follow-up sequence. You'll receive resources and a personalized discussion offer over the next week.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

Great to see you at ${event.type === 'webinar' ? "yesterday's" : 'the'} ${event.name}${customer.askedQuestions ? ' - I noticed you participated in the Q&A session, hope you found it valuable!' : '!'}

${customMessage || ''}

KEY TAKEAWAYS:
${takeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${(hasRecording || hasSlides || hasSummary) ? `YOUR RESOURCES:
${hasRecording ? `- Session Recording: ${event.recordingUrl}` : ''}
${hasSlides ? `- Presentation Slides: ${event.slidesUrl}` : ''}
${hasSummary ? `- Session Summary: ${event.summaryDocUrl}` : ''}
` : ''}

FOR ${customer.customerName.toUpperCase()} SPECIFICALLY:
Given your ${customer.industry ? customer.industry + ' ' : ''}team's focus, I think the insights from this session are particularly relevant to your current initiatives. I'd love to hear your thoughts on how these concepts might apply to your workflows.

I'll be sending over some additional resources in a few days, but in the meantime, feel free to reach out with any questions!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}

---
This is the first email in your post-event follow-up sequence.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

// ============================================
// Day 3: Resources Email
// ============================================

export function generateEventResourcesEmail(data: EventFollowUpAttendedData): EventFollowUpEmailResult {
  const { event, customer, csm } = data;
  const firstName = customer.contactName.split(' ')[0];

  // Build resources list
  const resources = event.relatedResources || [
    { title: 'Implementation Checklist', url: '#', type: 'checklist' as const },
    { title: 'Best Practices Guide', url: '#', type: 'document' as const },
    { title: 'Case Studies', url: '#', type: 'case_study' as const },
  ];

  const subject = `Your ${event.name} Toolkit`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1d3557; padding: 25px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .resource-card { background: #f8f9fa; border-radius: 8px; padding: 15px 20px; margin: 12px 0; border-left: 4px solid #e63946; }
    .resource-card h3 { margin: 0 0 5px 0; font-size: 16px; }
    .resource-card p { margin: 0; color: #666; font-size: 14px; }
    .resource-card a { color: #e63946; font-weight: 500; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .icon { display: inline-block; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your ${event.name} Toolkit</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>As promised, here are some additional resources to help you put the insights from <strong>${event.name}</strong> into action.</p>

      <p><strong>Curated for ${customer.customerName}:</strong></p>

      ${resources.map(r => `
      <div class="resource-card">
        <h3><span class="icon">${getResourceIcon(r.type)}</span> ${r.title}</h3>
        <p><a href="${r.url}">Access Resource</a></p>
      </div>
      `).join('')}

      ${event.recordingUrl ? `
      <div class="resource-card">
        <h3><span class="icon">&#127909;</span> Session Recording</h3>
        <p>Missed any part? <a href="${event.recordingUrl}">Watch the full recording</a></p>
      </div>
      ` : ''}

      <p>These resources are designed to help you take the next step in applying what we covered. If you have questions about any of them or want to discuss how they apply to your specific situation, I'm here to help!</p>

      ${csm.calendarLink ? `
      <a href="${csm.calendarLink}" class="cta-button">Schedule a Quick Chat</a>
      ` : ''}

      <p>
        Best,<br>
        <strong>${csm.name}</strong><br>
        ${csm.email}
      </p>
    </div>
    <div class="footer">
      <p>One more email coming your way in a few days with personalized next steps for ${customer.customerName}.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

As promised, here are some additional resources to help you put the insights from ${event.name} into action.

CURATED FOR ${customer.customerName.toUpperCase()}:

${resources.map(r => `- ${r.title}: ${r.url}`).join('\n')}

${event.recordingUrl ? `- Session Recording: ${event.recordingUrl}` : ''}

These resources are designed to help you take the next step in applying what we covered. If you have questions about any of them or want to discuss how they apply to your specific situation, I'm here to help!

${csm.calendarLink ? `Schedule a quick chat: ${csm.calendarLink}` : ''}

Best,
${csm.name}
${csm.email}

---
One more email coming your way in a few days with personalized next steps for ${customer.customerName}.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

// ============================================
// Day 7: Discussion Offer Email
// ============================================

export function generateEventDiscussionEmail(data: EventFollowUpAttendedData): EventFollowUpEmailResult {
  const { event, customer, csm } = data;
  const firstName = customer.contactName.split(' ')[0];

  const subject = `How Could ${event.topic || 'This'} Help ${customer.customerName}?`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1d3557 0%, #457b9d 100%); padding: 25px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .personalization-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6; }
    .personalization-box h3 { margin: 0 0 15px 0; color: #1d3557; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 5px 10px 0; font-weight: 500; }
    .cta-button:hover { background: #c5303c; }
    .cta-button.secondary { background: transparent; color: #1d3557; border: 2px solid #1d3557; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Let's Talk Next Steps</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>It's been a week since <strong>${event.name}</strong>, and I wanted to reach out with a personalized perspective for ${customer.customerName}.</p>

      <div class="personalization-box">
        <h3>Ideas for ${customer.customerName}:</h3>
        <p>Based on what we covered and my understanding of your ${customer.industry ? customer.industry + ' ' : ''}business, here are some thoughts on how you might apply these concepts:</p>
        <ul>
          <li>Start with a focused pilot in one area before scaling</li>
          <li>Leverage quick wins to build internal momentum</li>
          <li>Align implementation with your existing workflows</li>
        </ul>
      </div>

      <p>I'd love to spend 20 minutes discussing:</p>
      <ul>
        <li>Which aspects resonated most with your team</li>
        <li>Potential quick wins for ${customer.customerName}</li>
        <li>How to prioritize next steps</li>
      </ul>

      <p>No pressure - just an open conversation about what might be most valuable for you.</p>

      ${csm.calendarLink ? `
      <a href="${csm.calendarLink}" class="cta-button">Book 20 Minutes</a>
      <a href="mailto:${csm.email}?subject=Re: ${event.name} Discussion" class="cta-button secondary">Reply to This Email</a>
      ` : `
      <p><strong>Just reply to this email</strong> and we'll find a time that works!</p>
      `}

      <p>Looking forward to hearing your thoughts!</p>

      <p>
        Best,<br>
        <strong>${csm.name}</strong><br>
        ${csm.title || 'Customer Success Manager'}<br>
        ${csm.email}${csm.phoneNumber ? `<br>${csm.phoneNumber}` : ''}
      </p>
    </div>
    <div class="footer">
      <p>Thank you for engaging with us at ${event.name}! This is the final email in your post-event sequence.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

It's been a week since ${event.name}, and I wanted to reach out with a personalized perspective for ${customer.customerName}.

IDEAS FOR ${customer.customerName.toUpperCase()}:
Based on what we covered and my understanding of your ${customer.industry ? customer.industry + ' ' : ''}business, here are some thoughts on how you might apply these concepts:
- Start with a focused pilot in one area before scaling
- Leverage quick wins to build internal momentum
- Align implementation with your existing workflows

I'd love to spend 20 minutes discussing:
- Which aspects resonated most with your team
- Potential quick wins for ${customer.customerName}
- How to prioritize next steps

No pressure - just an open conversation about what might be most valuable for you.

${csm.calendarLink ? `Book a time: ${csm.calendarLink}` : 'Just reply to this email and we\'ll find a time that works!'}

Looking forward to hearing your thoughts!

Best,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
${csm.phoneNumber || ''}

---
Thank you for engaging with us at ${event.name}! This is the final email in your post-event sequence.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getResourceIcon(type: string): string {
  switch (type) {
    case 'checklist':
      return '&#9745;';
    case 'document':
      return '&#128196;';
    case 'video':
      return '&#127909;';
    case 'case_study':
      return '&#128218;';
    default:
      return '&#128279;';
  }
}

export default {
  generateEventThankYouEmail,
  generateEventResourcesEmail,
  generateEventDiscussionEmail,
};
