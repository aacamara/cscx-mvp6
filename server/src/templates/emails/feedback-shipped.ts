/**
 * Feedback Shipped Follow-Up Email Template
 * PRD-053: Product Feedback Follow-Up
 *
 * Used when customer feedback has been addressed and the feature/fix has shipped.
 * Celebrates the customer's contribution and encourages adoption.
 */

export interface FeedbackShippedVariables {
  // Customer info
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;

  // CSM info
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  csmCalendarUrl?: string;

  // Original feedback context
  originalFeedback: {
    summary: string;
    submittedDate: string;
    source?: string; // 'QBR discussion', 'Support ticket', etc.
  };

  // Feature/fix details
  featureName: string;
  featureDescription: string;
  releaseVersion?: string;
  releaseDate: string;

  // Feature capabilities
  capabilities: string[];

  // Getting started resources
  resources?: {
    tutorialUrl?: string;
    tutorialLabel?: string;
    documentationUrl?: string;
    videoUrl?: string;
    demoBookingUrl?: string;
  };

  // Optional personalization
  personalNote?: string;
  impactStatement?: string;
}

export interface FeedbackShippedResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export function generateFeedbackShippedEmail(variables: FeedbackShippedVariables): FeedbackShippedResult {
  const {
    customerName,
    contactName,
    csmName,
    csmTitle = 'Customer Success Manager',
    csmEmail,
    csmCalendarUrl,
    originalFeedback,
    featureName,
    featureDescription,
    releaseVersion,
    releaseDate,
    capabilities,
    resources,
    personalNote,
    impactStatement,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const releaseInfo = releaseVersion ? `v${releaseVersion} (${releaseDate})` : releaseDate;

  const subject = `Great News - Your Feedback Led to ${featureName}!`;

  // Build resources section
  const resourceLinks: string[] = [];
  if (resources?.tutorialUrl) {
    resourceLinks.push(`<a href="${resources.tutorialUrl}" style="color: #e63946; text-decoration: none;">${resources.tutorialLabel || 'Quick Tutorial'}</a>`);
  }
  if (resources?.documentationUrl) {
    resourceLinks.push(`<a href="${resources.documentationUrl}" style="color: #e63946; text-decoration: none;">Documentation</a>`);
  }
  if (resources?.videoUrl) {
    resourceLinks.push(`<a href="${resources.videoUrl}" style="color: #e63946; text-decoration: none;">Video Walkthrough</a>`);
  }

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0 0 10px 0; font-size: 24px; }
    .header .celebration { font-size: 48px; margin-bottom: 15px; }
    .header .tagline { color: rgba(255,255,255,0.9); font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .feedback-context { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9e9e9e; }
    .feedback-context .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .feedback-context .quote { font-style: italic; color: #555; margin: 0; }
    .feedback-context .meta { font-size: 12px; color: #888; margin-top: 10px; }
    .shipped-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
    .shipped-box h3 { color: #2e7d32; margin: 0 0 10px 0; }
    .shipped-box .version { display: inline-block; background: #4caf50; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
    .capabilities-list { background: #fff; padding: 0; margin: 20px 0; }
    .capabilities-list li { margin: 12px 0; padding: 10px 15px; background: #fafafa; border-radius: 6px; list-style: none; display: flex; align-items: flex-start; }
    .capabilities-list li:before { content: "\\2713"; color: #4caf50; font-weight: bold; margin-right: 12px; font-size: 16px; }
    .impact-box { background: #fff3e0; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
    .resources-box { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; }
    .resources-box h4 { margin: 0 0 15px 0; color: #1565c0; }
    .resources-box .links { display: flex; gap: 20px; flex-wrap: wrap; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 600; }
    .cta-button:hover { background: #c5303c; }
    .cta-secondary { background: #1d3557; }
    .personal-note { background: #fffde7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="celebration">🎉</div>
      <h1>Your Feedback Shipped!</h1>
      <p class="tagline">Thank you for helping make our product better</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I have some exciting news to share - remember the feedback you gave us? <strong>It's now live!</strong></p>

      <div class="feedback-context">
        <div class="label">Your Original Feedback</div>
        <p class="quote">"${originalFeedback.summary}"</p>
        <div class="meta">Submitted ${originalFeedback.submittedDate}${originalFeedback.source ? ` during ${originalFeedback.source}` : ''}</div>
      </div>

      <div class="shipped-box">
        <span class="version">SHIPPED ${releaseInfo}</span>
        <h3>${featureName}</h3>
        <p>${featureDescription}</p>
      </div>

      <p>Based on your feedback, you can now:</p>
      <ul class="capabilities-list">
        ${capabilities.map(cap => `<li>${cap}</li>`).join('\n        ')}
      </ul>

      ${impactStatement ? `
      <div class="impact-box">
        <strong>Impact:</strong> ${impactStatement}
      </div>
      ` : ''}

      ${resourceLinks.length > 0 || resources?.demoBookingUrl ? `
      <div class="resources-box">
        <h4>Get Started:</h4>
        ${resourceLinks.length > 0 ? `<div class="links">${resourceLinks.join(' | ')}</div>` : ''}
        ${resources?.demoBookingUrl ? `
        <div style="margin-top: 15px;">
          <a href="${resources.demoBookingUrl}" class="cta-button">Schedule a Walkthrough</a>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${personalNote ? `
      <div class="personal-note">
        ${personalNote}
      </div>
      ` : ''}

      <p>Your feedback directly shaped this feature, and we're grateful you took the time to share your ideas with us. This is exactly the kind of input that helps us build a better product for everyone.</p>

      <p>Any other ideas brewing? I'm always here to listen!</p>

      ${csmCalendarUrl ? `
      <div style="margin: 25px 0;">
        <a href="${csmCalendarUrl}" class="cta-button">Book Time to Discuss</a>
      </div>
      ` : ''}

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this because you provided valuable feedback that helped shape our product.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text resources
  const textResources: string[] = [];
  if (resources?.tutorialUrl) textResources.push(`${resources.tutorialLabel || 'Tutorial'}: ${resources.tutorialUrl}`);
  if (resources?.documentationUrl) textResources.push(`Documentation: ${resources.documentationUrl}`);
  if (resources?.videoUrl) textResources.push(`Video: ${resources.videoUrl}`);

  const bodyText = `
YOUR FEEDBACK SHIPPED!
Thank you for helping make our product better

Hi ${firstName},

I have some exciting news to share - remember the feedback you gave us? It's now live!

YOUR ORIGINAL FEEDBACK:
"${originalFeedback.summary}"
Submitted ${originalFeedback.submittedDate}${originalFeedback.source ? ` during ${originalFeedback.source}` : ''}

SHIPPED ${releaseInfo}
${featureName}
${featureDescription}

Based on your feedback, you can now:
${capabilities.map(cap => `* ${cap}`).join('\n')}

${impactStatement ? `IMPACT: ${impactStatement}\n` : ''}

${textResources.length > 0 ? `GET STARTED:\n${textResources.join('\n')}\n` : ''}

${resources?.demoBookingUrl ? `Schedule a walkthrough: ${resources.demoBookingUrl}\n` : ''}

${personalNote ? `Note: ${personalNote}\n` : ''}

Your feedback directly shaped this feature, and we're grateful you took the time to share your ideas with us. This is exactly the kind of input that helps us build a better product for everyone.

Any other ideas brewing? I'm always here to listen!

${csmCalendarUrl ? `Book time to discuss: ${csmCalendarUrl}\n` : ''}

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
You're receiving this because you provided valuable feedback that helped shape our product.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateFeedbackShippedEmail;
