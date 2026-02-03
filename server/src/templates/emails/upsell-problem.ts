/**
 * Upsell Problem-Solving Email Template
 * PRD-047: Upsell Introduction Email
 *
 * Problem-solving approach: Address limitations they've hit
 * Best for customers approaching or exceeding usage limits
 */

export interface UpsellProblemVariables {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  currentTier: string;
  suggestedTier: string;
  limitations: Array<{
    type: 'users' | 'api' | 'storage' | 'features' | 'other';
    current: string | number;
    limit: string | number;
    percentUsed: number;
    impact?: string;
  }>;
  optimizationOptions: Array<{
    title: string;
    description: string;
    effort: 'low' | 'medium' | 'high';
  }>;
  upgradeFeatures: Array<{
    name: string;
    value: string;
    relevance: string;
  }>;
  estimatedValue?: number;
  featureRequests?: string[];
  calendarLink?: string;
}

export interface UpsellProblemResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  approach: 'problem_solving';
}

export function generateUpsellProblemEmail(
  variables: UpsellProblemVariables
): UpsellProblemResult {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    currentTier,
    suggestedTier,
    limitations,
    optimizationOptions,
    upgradeFeatures,
    estimatedValue,
    featureRequests,
    calendarLink,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const highUsageLimits = limitations.filter(l => l.percentUsed >= 80);

  const subject = `Noticed You're Approaching Some Limits - Let's Chat`;

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
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .limit-item { display: flex; align-items: center; margin: 12px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; }
    .limit-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 18px; }
    .limit-icon.warning { background: #fef3c7; }
    .limit-icon.critical { background: #fee2e2; }
    .limit-label { font-weight: 500; color: #1a1a1a; }
    .limit-value { font-size: 14px; color: #666; }
    .limit-bar { height: 6px; background: #e5e5e5; border-radius: 3px; margin-top: 4px; overflow: hidden; }
    .limit-bar-fill { height: 100%; border-radius: 3px; }
    .limit-bar-fill.warning { background: #f59e0b; }
    .limit-bar-fill.critical { background: #ef4444; }
    .positive-note { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .positive-note strong { color: #065f46; }
    .option-section { margin: 24px 0; }
    .option-title { font-weight: 600; color: #1a1a1a; margin-bottom: 12px; font-size: 15px; }
    .option-card { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 12px 0; }
    .option-header { font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
    .option-desc { font-size: 14px; color: #666; }
    .upgrade-features { background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9; }
    .upgrade-title { font-weight: 600; color: #0369a1; margin-bottom: 12px; }
    .upgrade-item { margin: 8px 0; }
    .upgrade-name { font-weight: 500; color: #1a1a1a; }
    .upgrade-value { color: #0369a1; font-weight: 600; }
    .upgrade-relevance { font-size: 13px; color: #666; font-style: italic; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .signature { margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Let's Keep Your Growth on Track</h1>
      <p>Proactive check-in about your account usage</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I was reviewing your account this week and noticed ${customerName} is growing quickly - which is fantastic! I also noticed you're getting close to a few limits:</p>

      ${highUsageLimits.map(limit => {
        const isCritical = limit.percentUsed >= 90;
        const icon = limit.type === 'users' ? '👥' :
                     limit.type === 'api' ? '⚡' :
                     limit.type === 'storage' ? '💾' :
                     limit.type === 'features' ? '🔧' : '📊';
        return `
      <div class="limit-item">
        <div class="limit-icon ${isCritical ? 'critical' : 'warning'}">${icon}</div>
        <div style="flex: 1;">
          <div class="limit-label">${limit.type === 'users' ? 'Users' : limit.type === 'api' ? 'API Calls' : limit.type === 'storage' ? 'Storage' : limit.type === 'features' ? 'Feature Usage' : 'Usage'}: ${limit.current}/${limit.limit}</div>
          <div class="limit-bar">
            <div class="limit-bar-fill ${isCritical ? 'critical' : 'warning'}" style="width: ${limit.percentUsed}%;"></div>
          </div>
          ${limit.impact ? `<div class="limit-value">${limit.impact}</div>` : ''}
        </div>
      </div>
        `;
      }).join('')}

      <div class="positive-note">
        <strong>First, this is a great "problem" to have</strong> - it means adoption is strong and your team is getting real value from the platform.
      </div>

      <p>I wanted to reach out proactively because there are a few options to ensure your growth isn't constrained:</p>

      <div class="option-section">
        <div class="option-title">Option 1: Optimize Current Usage</div>
        ${optimizationOptions.map(opt => `
        <div class="option-card">
          <div class="option-header">${opt.title}</div>
          <div class="option-desc">${opt.description}</div>
        </div>
        `).join('')}
      </div>

      <div class="option-section">
        <div class="option-title">Option 2: Explore ${suggestedTier}</div>
        <div class="upgrade-features">
          <div class="upgrade-title">What's included:</div>
          ${upgradeFeatures.map(f => `
          <div class="upgrade-item">
            <span class="upgrade-name">${f.name}:</span>
            <span class="upgrade-value">${f.value}</span>
            ${f.relevance ? `<div class="upgrade-relevance">${f.relevance}</div>` : ''}
          </div>
          `).join('')}
        </div>
        ${featureRequests && featureRequests.length > 0 ? `
        <p style="font-size: 14px; color: #666; margin-top: 8px;">This also includes features you've asked about: ${featureRequests.join(', ')}.</p>
        ` : ''}
      </div>

      <p><strong>No pressure at all</strong> - I just wanted to flag this before you hit any walls. Would you have 20 minutes next week to chat about what makes sense for ${customerName}'s growth trajectory?</p>

      ${calendarLink ? `
      <a href="${calendarLink}" class="cta-button">Schedule a Quick Call</a>
      ` : `
      <p>Just reply to this email and we can find a time that works.</p>
      `}

      <p>Either way, I'm here to help you succeed!</p>

      <div class="signature">
        <p>Best,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}</p>
      </div>
    </div>
    <div class="footer">
      <p>This is a proactive outreach from your dedicated CSM. Current tier: ${currentTier}${estimatedValue ? ` | Suggested upgrade value: $${estimatedValue.toLocaleString()}/year` : ''}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I was reviewing your account this week and noticed ${customerName} is growing quickly - which is fantastic! I also noticed you're getting close to a few limits:

${highUsageLimits.map(l => `- ${l.type === 'users' ? 'Users' : l.type === 'api' ? 'API Calls' : l.type === 'storage' ? 'Storage' : l.type === 'features' ? 'Feature Usage' : 'Usage'}: ${l.current}/${l.limit} (${l.percentUsed}% used)${l.impact ? ` - ${l.impact}` : ''}`).join('\n')}

First, this is a great "problem" to have - it means adoption is strong and your team is getting real value.

I wanted to reach out proactively because there are a few options to ensure your growth isn't constrained:

OPTION 1: OPTIMIZE CURRENT USAGE
${optimizationOptions.map(o => `- ${o.title}: ${o.description}`).join('\n')}

OPTION 2: EXPLORE ${suggestedTier.toUpperCase()}
${upgradeFeatures.map(f => `- ${f.name}: ${f.value}${f.relevance ? ` (${f.relevance})` : ''}`).join('\n')}
${featureRequests && featureRequests.length > 0 ? `\nThis also includes features you've asked about: ${featureRequests.join(', ')}.` : ''}

No pressure at all - I just wanted to flag this before you hit any walls. Would you have 20 minutes next week to chat about what makes sense for ${customerName}'s growth trajectory?

${calendarLink ? `Schedule a quick call: ${calendarLink}` : `Just reply to this email and we can find a time that works.`}

Either way, I'm here to help you succeed!

Best,
${csmName}
${csmTitle}
${csmEmail}

---
This is a proactive outreach from your dedicated CSM. Current tier: ${currentTier}${estimatedValue ? ` | Suggested upgrade value: $${estimatedValue.toLocaleString()}/year` : ''}
  `.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    approach: 'problem_solving',
  };
}

export default generateUpsellProblemEmail;
