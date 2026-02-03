/**
 * Feature Announcement Email Template
 * PRD-033: Product Update Announcement
 * Used for announcing specific features with high personalization
 */

export interface FeatureAnnouncementVariables {
  // Customer info
  customerName: string;
  contactName: string;
  contactTitle?: string;

  // CSM info
  csmName: string;
  csmEmail: string;
  csmTitle?: string;

  // Feature info
  featureName: string;
  tagline: string;
  releaseDate: string;
  category: 'feature' | 'enhancement' | 'performance' | 'security';

  // Personalization
  relevanceReason: string;
  usageMetric?: {
    label: string;
    value: string;
    context: string;
  };
  customerBenefits: Array<{
    title: string;
    description: string;
  }>;
  migrationSteps?: string[];

  // CTAs
  primaryCta: {
    label: string;
    url: string;
  };
  secondaryCta?: {
    label: string;
    url: string;
  };

  // Optional
  previousRequestReference?: string;
  urgency?: 'low' | 'medium' | 'high';
  actionRequired?: boolean;
}

export interface FeatureAnnouncementResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const categoryLabels: Record<string, { label: string; color: string; emoji: string }> = {
  feature: { label: 'New Feature', color: '#4caf50', emoji: '' },
  enhancement: { label: 'Enhancement', color: '#2196f3', emoji: '' },
  performance: { label: 'Performance', color: '#ff9800', emoji: '' },
  security: { label: 'Security Update', color: '#9c27b0', emoji: '' },
};

export function generateFeatureAnnouncementEmail(variables: FeatureAnnouncementVariables): FeatureAnnouncementResult {
  const {
    customerName,
    contactName,
    csmName,
    csmTitle = 'Customer Success Manager',
    csmEmail,
    featureName,
    tagline,
    releaseDate,
    category,
    relevanceReason,
    usageMetric,
    customerBenefits,
    migrationSteps,
    primaryCta,
    secondaryCta,
    previousRequestReference,
    urgency = 'medium',
    actionRequired = false,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const categoryInfo = categoryLabels[category] || categoryLabels.feature;

  const subject = actionRequired
    ? `Action Required: ${featureName} - ${tagline}`
    : `${featureName} is Here - ${tagline}`;

  const urgencyBanner = urgency === 'high' && actionRequired
    ? `<div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px 20px; margin-bottom: 20px; border-radius: 4px;">
        <strong style="color: #c62828;">Action Required:</strong> Please review the migration steps below to ensure uninterrupted service.
      </div>`
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
    .header { background: linear-gradient(135deg, #e63946 0%, #1d3557 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0 0 10px 0; font-size: 26px; }
    .header .tagline { color: rgba(255,255,255,0.9); font-size: 16px; margin: 0; }
    .header .badge { display: inline-block; background: ${categoryInfo.color}; color: white; padding: 4px 14px; border-radius: 20px; font-size: 12px; margin-top: 15px; font-weight: 600; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .relevance-box { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
    .metric-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .metric-value { font-size: 32px; font-weight: 700; color: #e63946; }
    .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
    .metric-context { font-size: 13px; color: #888; margin-top: 8px; }
    .benefit-card { background: #fafafa; padding: 18px; border-radius: 8px; margin: 12px 0; border: 1px solid #eee; }
    .benefit-title { font-weight: 600; color: #1d3557; margin: 0 0 8px 0; font-size: 15px; }
    .benefit-desc { margin: 0; color: #555; font-size: 14px; }
    .migration-box { background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
    .migration-box h4 { margin: 0 0 15px 0; color: #e65100; }
    .migration-box ol { margin: 0; padding-left: 20px; }
    .migration-box li { margin: 8px 0; }
    .request-reference { background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4caf50; }
    .cta-container { text-align: center; margin: 30px 0; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 8px; font-weight: 600; }
    .cta-button:hover { background: #c5303c; }
    .cta-secondary { background: #1d3557; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${featureName}</h1>
      <p class="tagline">${tagline}</p>
      <span class="badge">${categoryInfo.label}</span>
    </div>
    <div class="content">
      ${urgencyBanner}

      <p>Hi ${firstName},</p>

      <p>I wanted to personally reach out because we just released something I think ${customerName} will love.</p>

      <div class="relevance-box">
        <strong>Why This Matters to You:</strong><br>
        ${relevanceReason}
      </div>

      ${usageMetric ? `
      <div class="metric-box">
        <div class="metric-value">${usageMetric.value}</div>
        <div class="metric-label">${usageMetric.label}</div>
        <div class="metric-context">${usageMetric.context}</div>
      </div>
      ` : ''}

      ${previousRequestReference ? `
      <div class="request-reference">
        <strong>You Asked, We Delivered!</strong><br>
        ${previousRequestReference}
      </div>
      ` : ''}

      <div style="margin: 25px 0;">
        <strong>What This Means for ${customerName}:</strong>
        ${customerBenefits.map(benefit => `
        <div class="benefit-card">
          <p class="benefit-title">${benefit.title}</p>
          <p class="benefit-desc">${benefit.description}</p>
        </div>
        `).join('')}
      </div>

      ${migrationSteps && migrationSteps.length > 0 ? `
      <div class="migration-box">
        <h4>Quick Start Guide:</h4>
        <ol>
          ${migrationSteps.map(step => `<li>${step}</li>`).join('\n          ')}
        </ol>
      </div>
      ` : ''}

      <div class="cta-container">
        <a href="${primaryCta.url}" class="cta-button">${primaryCta.label}</a>
        ${secondaryCta ? `<a href="${secondaryCta.url}" class="cta-button cta-secondary">${secondaryCta.label}</a>` : ''}
      </div>

      <p>I'd love to hear your thoughts once you try it out. If you have any questions or want a personalized walkthrough for ${customerName}'s specific use case, just reply to this email.</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>Released ${releaseDate} | This update was sent to you based on your ${customerName} usage patterns and entitlements.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
${featureName}
${tagline}
${categoryInfo.label} - Released ${releaseDate}

Hi ${firstName},

${actionRequired && urgency === 'high' ? 'ACTION REQUIRED: Please review the migration steps below to ensure uninterrupted service.\n' : ''}

I wanted to personally reach out because we just released something I think ${customerName} will love.

WHY THIS MATTERS TO YOU:
${relevanceReason}

${usageMetric ? `
YOUR CURRENT USAGE:
${usageMetric.value} - ${usageMetric.label}
${usageMetric.context}
` : ''}

${previousRequestReference ? `
YOU ASKED, WE DELIVERED!
${previousRequestReference}
` : ''}

WHAT THIS MEANS FOR ${customerName.toUpperCase()}:
${customerBenefits.map(b => `- ${b.title}: ${b.description}`).join('\n')}

${migrationSteps && migrationSteps.length > 0 ? `
QUICK START GUIDE:
${migrationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
` : ''}

${primaryCta.label}: ${primaryCta.url}
${secondaryCta ? `${secondaryCta.label}: ${secondaryCta.url}` : ''}

I'd love to hear your thoughts once you try it out. If you have any questions or want a personalized walkthrough for ${customerName}'s specific use case, just reply to this email.

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
Released ${releaseDate} | This update was sent to you based on your ${customerName} usage patterns and entitlements.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateFeatureAnnouncementEmail;
