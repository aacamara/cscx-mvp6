/**
 * Win-Back Day 14 Email Template - New Capabilities
 * Third email in the win-back campaign sequence
 * Purpose: Highlight specific product improvements addressing their needs
 * PRD-030: Win-Back Campaign Generator
 */

export interface WinbackDay14Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  productName?: string;
  requestedFeature?: {
    name: string;
    description: string;
    benefits: string[];
  };
  newFeatures?: Array<{
    name: string;
    description: string;
    releaseDate?: string;
  }>;
  performanceImprovements?: Array<{
    metric: string;
    improvement: string;
  }>;
  demoLink?: string;
}

export function generateWinbackDay14Email(variables: WinbackDay14Variables): {
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
    requestedFeature,
    newFeatures = [],
    performanceImprovements = [],
    demoLink,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = requestedFeature
    ? `That ${requestedFeature.name} you asked for? It's here.`
    : `${productName} has evolved - here's what's new`;

  const requestedFeatureSection = requestedFeature
    ? `
      <div class="featured-update">
        <div class="feature-badge">You Asked, We Built</div>
        <h3>${requestedFeature.name}</h3>
        <p>${requestedFeature.description}</p>
        <h4>Key Benefits:</h4>
        <ul>
          ${requestedFeature.benefits.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const requestedFeatureText = requestedFeature
    ? `
YOU ASKED, WE BUILT
${'-'.repeat(20)}
${requestedFeature.name}
${requestedFeature.description}

Key Benefits:
${requestedFeature.benefits.map(b => `- ${b}`).join('\n')}
`
    : '';

  const newFeaturesSection = newFeatures.length > 0
    ? `
      <div class="features-list">
        <h3>Other Notable Updates</h3>
        ${newFeatures.map(f => `
          <div class="feature-item">
            <h4>${f.name}</h4>
            <p>${f.description}</p>
            ${f.releaseDate ? `<span class="release-date">Released ${f.releaseDate}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `
    : '';

  const newFeaturesText = newFeatures.length > 0
    ? `
OTHER NOTABLE UPDATES
${'-'.repeat(21)}
${newFeatures.map(f => `${f.name}\n${f.description}${f.releaseDate ? ` (Released ${f.releaseDate})` : ''}`).join('\n\n')}
`
    : '';

  const performanceSection = performanceImprovements.length > 0
    ? `
      <div class="performance-box">
        <h3>Performance Improvements</h3>
        <div class="performance-grid">
          ${performanceImprovements.map(p => `
            <div class="performance-item">
              <span class="improvement">${p.improvement}</span>
              <span class="metric">${p.metric}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  const performanceText = performanceImprovements.length > 0
    ? `
PERFORMANCE IMPROVEMENTS
${'-'.repeat(24)}
${performanceImprovements.map(p => `${p.improvement} - ${p.metric}`).join('\n')}
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
    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a55eea 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .featured-update { background: linear-gradient(135deg, #f0e6ff 0%, #e6f0ff 100%); padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #6c5ce7; }
    .feature-badge { display: inline-block; background: #6c5ce7; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
    .featured-update h3 { margin: 10px 0; color: #2d3436; }
    .featured-update h4 { margin: 15px 0 10px 0; color: #636e72; font-size: 14px; }
    .features-list { margin: 25px 0; }
    .features-list h3 { color: #1d3557; border-bottom: 2px solid #6c5ce7; padding-bottom: 8px; }
    .feature-item { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .feature-item h4 { margin: 0 0 8px 0; color: #2d3436; }
    .feature-item p { margin: 0; color: #636e72; }
    .release-date { font-size: 12px; color: #999; margin-top: 8px; display: block; }
    .performance-box { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .performance-box h3 { margin-top: 0; color: #155724; }
    .performance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; }
    .performance-item { text-align: center; background: white; padding: 15px; border-radius: 6px; }
    .improvement { display: block; font-size: 24px; font-weight: bold; color: #28a745; }
    .metric { display: block; font-size: 12px; color: #666; margin-top: 5px; }
    .cta-section { text-align: center; margin: 25px 0; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>We've Been Busy Building</h1>
      <p>Product updates that matter to you</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I wanted to share some exciting updates to ${productName} - especially because I think they're directly relevant to ${customerName}'s needs.</p>

      ${requestedFeatureSection}

      ${newFeaturesSection}

      ${performanceSection}

      <p>These aren't just incremental updates - they represent a significant evolution of the platform based on feedback from customers like you.</p>

      ${demoLink ? `
      <div class="cta-section">
        <p><strong>Want to see it in action?</strong></p>
        <a href="${demoLink}" class="cta-button">Watch 2-Minute Demo</a>
      </div>
      ` : `
      <div class="cta-section">
        <p><strong>Want a personalized walkthrough?</strong></p>
        <p>I'd be happy to show you exactly how these updates could help ${customerName}. Just reply and we'll set up a quick call.</p>
      </div>
      `}

      <p>
        Talk soon,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>Email 3 of 5 in this series. Reply 'stop' to unsubscribe.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I wanted to share some exciting updates to ${productName} - especially because I think they're directly relevant to ${customerName}'s needs.
${requestedFeatureText}
${newFeaturesText}
${performanceText}
These aren't just incremental updates - they represent a significant evolution of the platform based on feedback from customers like you.

${demoLink ? `Want to see it in action? Watch the 2-minute demo: ${demoLink}` : `Want a personalized walkthrough? I'd be happy to show you exactly how these updates could help ${customerName}. Just reply and we'll set up a quick call.`}

Talk soon,
${csmName}
${csmEmail}

---
Email 3 of 5 in this series. Reply 'stop' to unsubscribe.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWinbackDay14Email;
