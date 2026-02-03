/**
 * Champion Recognition Email Template
 * PRD-032: Champion Nurture Sequence
 * Purpose: Genuine appreciation, highlight specific contributions
 */

export interface ChampionRecognitionVariables {
  championName: string;
  championTitle?: string;
  customerName: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  championSince?: string;
  keyContributions?: string[];
  impactMetrics?: {
    expansions?: number;
    caseStudies?: number;
    referrals?: number;
    productFeedback?: number;
  };
  personalNote?: string;
}

export function generateChampionRecognitionEmail(variables: ChampionRecognitionVariables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    championName,
    championTitle,
    customerName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    championSince,
    keyContributions = [],
    impactMetrics,
    personalNote,
  } = variables;

  const firstName = championName.split(' ')[0];

  const subject = `${firstName}, Thank You for Being an Amazing Partner`;

  // Build contributions section
  const contributionsList = keyContributions.length > 0
    ? keyContributions.map(c => `<li>${c}</li>`).join('\n')
    : '';

  // Build impact metrics section
  let impactSection = '';
  if (impactMetrics) {
    const metrics: string[] = [];
    if (impactMetrics.expansions) metrics.push(`<strong>${impactMetrics.expansions}</strong> successful expansions`);
    if (impactMetrics.caseStudies) metrics.push(`<strong>${impactMetrics.caseStudies}</strong> case study contribution${impactMetrics.caseStudies > 1 ? 's' : ''}`);
    if (impactMetrics.referrals) metrics.push(`<strong>${impactMetrics.referrals}</strong> referral${impactMetrics.referrals > 1 ? 's' : ''}`);
    if (impactMetrics.productFeedback) metrics.push(`<strong>${impactMetrics.productFeedback}</strong> product insights shared`);

    if (metrics.length > 0) {
      impactSection = `
        <div class="impact-stats">
          <strong>Your Impact by the Numbers:</strong>
          <div class="stats-grid">
            ${metrics.map(m => `<div class="stat-item">${m}</div>`).join('')}
          </div>
        </div>
      `;
    }
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
    .header { background: linear-gradient(135deg, #e63946 0%, #1d3557 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header .subtitle { color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .highlight { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e63946; }
    .impact-stats { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stats-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
    .stat-item { background: white; padding: 12px 16px; border-radius: 6px; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .appreciation { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You, ${firstName}!</h1>
      <div class="subtitle">A Note of Appreciation from the Team</div>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I wanted to take a moment to reach out and express my sincere gratitude for the incredible partnership we've built together${championSince ? ` over the past ${championSince}` : ''}.</p>

      <div class="appreciation">
        <strong>You're not just a customer - you're a true champion.</strong>
        <p style="margin-bottom: 0;">Your advocacy, engagement, and commitment to our shared success have made a real difference, and I want you to know how much that means to our entire team.</p>
      </div>

      ${keyContributions.length > 0 ? `
      <div class="highlight">
        <strong>Some of the Ways You've Made an Impact:</strong>
        <ul>
          ${contributionsList}
        </ul>
      </div>
      ` : ''}

      ${impactSection}

      ${personalNote ? `
      <p style="font-style: italic; color: #555; background: #f8f9fa; padding: 15px; border-radius: 6px;">"${personalNote}"</p>
      ` : ''}

      <p>Thank you for believing in what we're building together. Your support and feedback help us improve every day, and I'm genuinely excited about what we'll accomplish in the coming months.</p>

      <p>If there's ever anything I can do to support you - whether it's with ${customerName}'s goals or your own professional journey - please don't hesitate to reach out. I'm here for you.</p>

      <p>With gratitude,</p>

      <p>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is part of our Champion Recognition program. Your partnership makes what we do possible.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text contributions
  const contributionsText = keyContributions.length > 0
    ? '\nSome of the Ways You\'ve Made an Impact:\n' + keyContributions.map(c => `- ${c}`).join('\n') + '\n'
    : '';

  // Build plain text impact
  let impactText = '';
  if (impactMetrics) {
    const metrics: string[] = [];
    if (impactMetrics.expansions) metrics.push(`- ${impactMetrics.expansions} successful expansions`);
    if (impactMetrics.caseStudies) metrics.push(`- ${impactMetrics.caseStudies} case study contribution${impactMetrics.caseStudies > 1 ? 's' : ''}`);
    if (impactMetrics.referrals) metrics.push(`- ${impactMetrics.referrals} referral${impactMetrics.referrals > 1 ? 's' : ''}`);
    if (impactMetrics.productFeedback) metrics.push(`- ${impactMetrics.productFeedback} product insights shared`);

    if (metrics.length > 0) {
      impactText = '\nYour Impact by the Numbers:\n' + metrics.join('\n') + '\n';
    }
  }

  const bodyText = `
Hi ${firstName},

I wanted to take a moment to reach out and express my sincere gratitude for the incredible partnership we've built together${championSince ? ` over the past ${championSince}` : ''}.

You're not just a customer - you're a true champion. Your advocacy, engagement, and commitment to our shared success have made a real difference, and I want you to know how much that means to our entire team.
${contributionsText}${impactText}
${personalNote ? `"${personalNote}"\n` : ''}
Thank you for believing in what we're building together. Your support and feedback help us improve every day, and I'm genuinely excited about what we'll accomplish in the coming months.

If there's ever anything I can do to support you - whether it's with ${customerName}'s goals or your own professional journey - please don't hesitate to reach out. I'm here for you.

With gratitude,

${csmName}
${csmTitle}
${csmEmail}

---
This is part of our Champion Recognition program. Your partnership makes what we do possible.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateChampionRecognitionEmail;
