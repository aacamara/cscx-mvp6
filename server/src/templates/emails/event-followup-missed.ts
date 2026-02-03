/**
 * Event Follow-Up Email Template - Missed
 * PRD-055: Webinar/Event Follow-Up Sequence
 *
 * Email templates for customers who registered but missed a webinar or event.
 * Includes: Recording (Day 1), Highlights (Day 4)
 */

import type { EventContext, CustomerEventContext, CSMContext } from '../../../../types/eventFollowup.js';

// ============================================
// Type Definitions
// ============================================

export interface EventFollowUpMissedData {
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
// Day 1: Recording Email (for No-Shows)
// ============================================

export function generateEventRecordingEmail(data: EventFollowUpMissedData): EventFollowUpEmailResult {
  const { event, customer, csm, customMessage } = data;
  const firstName = customer.contactName.split(' ')[0];
  const eventDateFormatted = formatDate(event.date);

  const hasRecording = !!event.recordingUrl;
  const hasSlides = !!event.slidesUrl;
  const hasSummary = !!event.summaryDocUrl;

  const subject = `Missed ${event.name}? Here's the Recording`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #457b9d 0%, #1d3557 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .video-card { background: #1d3557; border-radius: 12px; padding: 30px; margin: 25px 0; text-align: center; }
    .video-card h3 { color: white; margin: 0 0 15px 0; font-size: 18px; }
    .video-card p { color: rgba(255,255,255,0.8); margin: 0 0 20px 0; font-size: 14px; }
    .play-button { display: inline-block; background: #e63946; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; }
    .play-button:hover { background: #c5303c; }
    .summary-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #457b9d; }
    .resources-list { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; font-weight: 500; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    a { color: #e63946; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>We Missed You!</h1>
      <p>${event.name} | ${eventDateFormatted}</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I noticed you registered for <strong>${event.name}</strong> but weren't able to join us${event.type === 'webinar' ? ' live' : ''}. No worries - I've got you covered!</p>

      ${customMessage ? `<p>${customMessage}</p>` : ''}

      ${hasRecording ? `
      <div class="video-card">
        <h3>&#127909; Watch the Full Recording</h3>
        <p>${event.duration_minutes ? `${event.duration_minutes} minutes` : 'Full session'} | Watch at your own pace</p>
        <a href="${event.recordingUrl}" class="play-button">Watch Now</a>
      </div>
      ` : ''}

      <div class="summary-box">
        <strong>Quick Summary:</strong>
        <p>Here's what was covered in ${event.name}:</p>
        <ul>
          ${(event.keyTakeaways || [
            'Key industry insights and trends',
            'Best practices and implementation strategies',
            'Q&A with live audience questions',
          ]).map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>

      ${(hasSlides || hasSummary) ? `
      <div class="resources-list">
        <strong>Additional Resources:</strong>
        <ul>
          ${hasSlides ? `<li><a href="${event.slidesUrl}">Presentation Slides</a></li>` : ''}
          ${hasSummary ? `<li><a href="${event.summaryDocUrl}">Session Summary Document</a></li>` : ''}
        </ul>
      </div>
      ` : ''}

      <p>I know schedules get busy, but the content from this session is particularly relevant to ${customer.customerName}. Even watching the first 10-15 minutes would give you a solid foundation.</p>

      <p>Have questions after watching? Just reply to this email - I'm happy to discuss!</p>

      <p>
        Best,<br>
        <strong>${csm.name}</strong><br>
        ${csm.title || 'Customer Success Manager'}<br>
        ${csm.email}
      </p>
    </div>
    <div class="footer">
      <p>I'll follow up in a few days with a highlights summary in case you're short on time.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I noticed you registered for ${event.name} but weren't able to join us${event.type === 'webinar' ? ' live' : ''}. No worries - I've got you covered!

${customMessage || ''}

${hasRecording ? `WATCH THE FULL RECORDING:
${event.recordingUrl}
${event.duration_minutes ? `(${event.duration_minutes} minutes)` : ''}

` : ''}QUICK SUMMARY:
Here's what was covered in ${event.name}:
${(event.keyTakeaways || [
  'Key industry insights and trends',
  'Best practices and implementation strategies',
  'Q&A with live audience questions',
]).map(t => `- ${t}`).join('\n')}

${(hasSlides || hasSummary) ? `ADDITIONAL RESOURCES:
${hasSlides ? `- Presentation Slides: ${event.slidesUrl}` : ''}
${hasSummary ? `- Session Summary: ${event.summaryDocUrl}` : ''}
` : ''}

I know schedules get busy, but the content from this session is particularly relevant to ${customer.customerName}. Even watching the first 10-15 minutes would give you a solid foundation.

Have questions after watching? Just reply to this email - I'm happy to discuss!

Best,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}

---
I'll follow up in a few days with a highlights summary in case you're short on time.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

// ============================================
// Day 4: Highlights Email (for No-Shows)
// ============================================

export function generateEventHighlightsEmail(data: EventFollowUpMissedData): EventFollowUpEmailResult {
  const { event, customer, csm } = data;
  const firstName = customer.contactName.split(' ')[0];

  // Build highlights based on key takeaways
  const highlights = event.keyTakeaways?.slice(0, 3) || [
    'How to identify quick wins and prioritize implementation',
    'Best practices from leading organizations',
    'Actionable strategies you can start using today',
  ];

  const subject = `3 Things You'll Want from ${event.name}`;

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
    .highlight-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 20px; margin: 15px 0; border-left: 4px solid #e63946; }
    .highlight-card h3 { margin: 0 0 8px 0; color: #1d3557; font-size: 16px; display: flex; align-items: center; }
    .highlight-card h3 .number { background: #e63946; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px; flex-shrink: 0; }
    .highlight-card p { margin: 0; color: #555; padding-left: 40px; }
    .quick-start-box { background: #fff8e1; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ffecb3; }
    .quick-start-box h3 { margin: 0 0 12px 0; color: #f57c00; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 5px 10px 0; font-weight: 500; }
    .cta-button:hover { background: #c5303c; }
    .cta-button.secondary { background: transparent; color: #1d3557; border: 2px solid #1d3557; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    a { color: #e63946; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>The 3-Minute Catch-Up</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I know you're busy, so here's a quick summary of the most valuable takeaways from <strong>${event.name}</strong> - everything you need in under 3 minutes.</p>

      <p><strong>Top 3 Things for ${customer.customerName}:</strong></p>

      ${highlights.map((h, i) => `
      <div class="highlight-card">
        <h3><span class="number">${i + 1}</span> Key Insight</h3>
        <p>${h}</p>
      </div>
      `).join('')}

      <div class="quick-start-box">
        <h3>&#9889; Quick Start Tip</h3>
        <p>Based on ${customer.customerName}'s ${customer.industry ? customer.industry + ' ' : ''}focus, I'd recommend starting with the first takeaway. It's often the quickest win and builds momentum for bigger initiatives.</p>
      </div>

      ${event.recordingUrl ? `
      <p><strong>Want the full picture?</strong></p>
      <p>The <a href="${event.recordingUrl}">full recording</a> goes deeper into each of these points with examples and case studies.</p>
      ` : ''}

      <p>Would it be helpful to chat about how any of these might apply to your team? I'm happy to do a quick 15-minute call to explore.</p>

      ${csm.calendarLink ? `
      <a href="${csm.calendarLink}" class="cta-button">Book 15 Minutes</a>
      <a href="mailto:${csm.email}?subject=Re: ${event.name} Highlights" class="cta-button secondary">Just Reply</a>
      ` : `
      <p><strong>Just reply to this email</strong> and we can find a time!</p>
      `}

      <p>
        Best,<br>
        <strong>${csm.name}</strong><br>
        ${csm.email}
      </p>
    </div>
    <div class="footer">
      <p>This is the final follow-up from ${event.name}. Looking forward to seeing you at future events!</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I know you're busy, so here's a quick summary of the most valuable takeaways from ${event.name} - everything you need in under 3 minutes.

TOP 3 THINGS FOR ${customer.customerName.toUpperCase()}:

${highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

QUICK START TIP:
Based on ${customer.customerName}'s ${customer.industry ? customer.industry + ' ' : ''}focus, I'd recommend starting with the first takeaway. It's often the quickest win and builds momentum for bigger initiatives.

${event.recordingUrl ? `Want the full picture? Watch the full recording: ${event.recordingUrl}` : ''}

Would it be helpful to chat about how any of these might apply to your team? I'm happy to do a quick 15-minute call to explore.

${csm.calendarLink ? `Book 15 minutes: ${csm.calendarLink}` : 'Just reply to this email and we can find a time!'}

Best,
${csm.name}
${csm.email}

---
This is the final follow-up from ${event.name}. Looking forward to seeing you at future events!
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

export default {
  generateEventRecordingEmail,
  generateEventHighlightsEmail,
};
