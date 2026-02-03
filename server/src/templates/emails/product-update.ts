/**
 * Product Update Email Template
 * PRD-033: Product Update Announcement
 * Used for announcing major product updates to customers
 */

export interface ProductUpdateVariables {
  // Customer info
  customerName: string;
  contactName: string;
  contactTitle?: string;

  // CSM info
  csmName: string;
  csmEmail: string;
  csmTitle?: string;

  // Product update info
  updateTitle: string;
  updateDescription: string;
  releaseDate: string;
  keyBenefits: string[];

  // Personalization
  personalizedIntro?: string;
  relevantBenefits?: string[];
  useCases?: string[];
  usageContext?: string;

  // CTAs
  documentationUrl?: string;
  migrationGuideUrl?: string;
  trainingUrl?: string;
  videoUrl?: string;
  demoBookingUrl?: string;

  // Optional
  previousRequestNote?: string;
}

export interface ProductUpdateResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export function generateProductUpdateEmail(variables: ProductUpdateVariables): ProductUpdateResult {
  const {
    customerName,
    contactName,
    csmName,
    csmTitle = 'Customer Success Manager',
    csmEmail,
    updateTitle,
    updateDescription,
    releaseDate,
    keyBenefits,
    personalizedIntro,
    relevantBenefits,
    useCases,
    usageContext,
    documentationUrl,
    migrationGuideUrl,
    trainingUrl,
    videoUrl,
    demoBookingUrl,
    previousRequestNote,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const benefitsToShow = relevantBenefits && relevantBenefits.length > 0 ? relevantBenefits : keyBenefits;

  const subject = `New: ${updateTitle} - Exciting Update for ${customerName}`;

  // Build resources section
  const resources: string[] = [];
  if (documentationUrl) resources.push(`<a href="${documentationUrl}" style="color: #e63946; text-decoration: none;">Documentation</a>`);
  if (migrationGuideUrl) resources.push(`<a href="${migrationGuideUrl}" style="color: #e63946; text-decoration: none;">Migration Guide</a>`);
  if (trainingUrl) resources.push(`<a href="${trainingUrl}" style="color: #e63946; text-decoration: none;">Training Resources</a>`);
  if (videoUrl) resources.push(`<a href="${videoUrl}" style="color: #e63946; text-decoration: none;">Video Walkthrough</a>`);

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
    .header .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .highlight { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e63946; }
    .benefits-list { background: #fff; padding: 0; margin: 0; }
    .benefits-list li { margin: 12px 0; padding-left: 8px; }
    .benefits-list li strong { color: #1d3557; }
    .use-case-box { background: #f0f4f8; padding: 15px 20px; border-radius: 6px; margin: 10px 0; }
    .use-case-box strong { color: #e63946; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 600; }
    .cta-button:hover { background: #c5303c; }
    .cta-secondary { background: #1d3557; }
    .resources { background: #f8f9fa; padding: 15px 20px; border-radius: 6px; margin: 20px 0; }
    .resources a { margin-right: 15px; }
    .previous-request { background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4caf50; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${updateTitle}</h1>
      <span class="badge">Released ${releaseDate}</span>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      ${personalizedIntro ? `<p>${personalizedIntro}</p>` : `<p>I'm excited to share some great news! We've just released <strong>${updateTitle}</strong>, and I wanted to make sure ${customerName} is among the first to know about it.</p>`}

      ${usageContext ? `<p>${usageContext}</p>` : ''}

      <p>${updateDescription}</p>

      ${previousRequestNote ? `
      <div class="previous-request">
        <strong>Good news!</strong> ${previousRequestNote}
      </div>
      ` : ''}

      <div class="highlight">
        <strong>Key Benefits for ${customerName}:</strong>
        <ul class="benefits-list">
          ${benefitsToShow.map(benefit => `<li>${benefit}</li>`).join('\n          ')}
        </ul>
      </div>

      ${useCases && useCases.length > 0 ? `
      <div style="margin: 20px 0;">
        <strong>How This Helps Your Team:</strong>
        ${useCases.map(useCase => `
        <div class="use-case-box">
          ${useCase}
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${resources.length > 0 ? `
      <div class="resources">
        <strong>Quick Links:</strong><br>
        ${resources.join(' | ')}
      </div>
      ` : ''}

      <div style="margin: 25px 0;">
        ${demoBookingUrl ? `<a href="${demoBookingUrl}" class="cta-button">Schedule a Walkthrough</a>` : ''}
        ${documentationUrl && !demoBookingUrl ? `<a href="${documentationUrl}" class="cta-button">View Documentation</a>` : ''}
        ${trainingUrl ? `<a href="${trainingUrl}" class="cta-button cta-secondary">Start Training</a>` : ''}
      </div>

      <p>Have questions or want to discuss how ${customerName} can best leverage this update? Just reply to this email or grab some time on my calendar - I'm happy to walk you through it.</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this because you're a valued ${customerName} stakeholder. We only send product updates that are relevant to your usage.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text resources
  const textResources: string[] = [];
  if (documentationUrl) textResources.push(`Documentation: ${documentationUrl}`);
  if (migrationGuideUrl) textResources.push(`Migration Guide: ${migrationGuideUrl}`);
  if (trainingUrl) textResources.push(`Training: ${trainingUrl}`);
  if (videoUrl) textResources.push(`Video: ${videoUrl}`);

  const bodyText = `
Hi ${firstName},

${personalizedIntro || `I'm excited to share some great news! We've just released ${updateTitle}, and I wanted to make sure ${customerName} is among the first to know about it.`}

${usageContext || ''}

${updateDescription}

${previousRequestNote ? `GOOD NEWS: ${previousRequestNote}\n` : ''}

KEY BENEFITS FOR ${customerName.toUpperCase()}:
${benefitsToShow.map(benefit => `- ${benefit}`).join('\n')}

${useCases && useCases.length > 0 ? `
HOW THIS HELPS YOUR TEAM:
${useCases.map(useCase => `- ${useCase}`).join('\n')}
` : ''}

${textResources.length > 0 ? `
QUICK LINKS:
${textResources.join('\n')}
` : ''}

${demoBookingUrl ? `Ready to see it in action? Schedule a walkthrough: ${demoBookingUrl}` : ''}

Have questions or want to discuss how ${customerName} can best leverage this update? Just reply to this email or grab some time on my calendar - I'm happy to walk you through it.

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
You're receiving this because you're a valued ${customerName} stakeholder. We only send product updates that are relevant to your usage.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateProductUpdateEmail;
