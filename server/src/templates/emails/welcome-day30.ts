/**
 * Day 30 Milestone Email Template
 * Fifth email in the onboarding welcome sequence
 * Purpose: Progress summary, next phase preview, feedback request
 */

export interface WelcomeDay30Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  productName?: string;
  achievements?: Array<{ metric: string; value: string; trend?: 'up' | 'down' | 'stable' }>;
  adoptionStats?: {
    activeUsers?: number;
    totalUsers?: number;
    featuresUsed?: number;
    totalFeatures?: number;
  };
  nextPhaseGoals?: string[];
  feedbackSurveyUrl?: string;
  scheduleMeetingUrl?: string;
  successStory?: string;
}

export function generateWelcomeDay30Email(variables: WelcomeDay30Variables): {
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
    achievements = [],
    adoptionStats,
    nextPhaseGoals = [
      'Expand usage to additional teams or departments',
      'Implement advanced features and integrations',
      'Establish regular QBR cadence',
      'Identify expansion opportunities',
    ],
    feedbackSurveyUrl,
    scheduleMeetingUrl,
    successStory,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = `Celebrating 30 Days Together, ${customerName}!`;

  const trendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '&#x2197;';
      case 'down': return '&#x2198;';
      default: return '&#x2192;';
    }
  };

  const achievementsHtml = achievements.length > 0
    ? `
      <div class="achievements-grid">
        ${achievements.map(a => `
          <div class="achievement-card">
            <div class="achievement-value">${a.value} ${a.trend ? trendIcon(a.trend) : ''}</div>
            <div class="achievement-label">${a.metric}</div>
          </div>
        `).join('')}
      </div>
    `
    : '';

  const achievementsText = achievements.length > 0
    ? achievements.map(a => `- ${a.metric}: ${a.value}`).join('\n')
    : '';

  const adoptionHtml = adoptionStats
    ? `
      <div class="adoption-box">
        <h3>Adoption Snapshot</h3>
        <div class="adoption-stats">
          ${adoptionStats.activeUsers !== undefined && adoptionStats.totalUsers !== undefined
            ? `<div class="stat"><strong>${adoptionStats.activeUsers}/${adoptionStats.totalUsers}</strong> Active Users</div>`
            : ''
          }
          ${adoptionStats.featuresUsed !== undefined && adoptionStats.totalFeatures !== undefined
            ? `<div class="stat"><strong>${adoptionStats.featuresUsed}/${adoptionStats.totalFeatures}</strong> Features Adopted</div>`
            : ''
          }
        </div>
      </div>
    `
    : '';

  const adoptionText = adoptionStats
    ? `
ADOPTION SNAPSHOT
-----------------
${adoptionStats.activeUsers !== undefined && adoptionStats.totalUsers !== undefined ? `Active Users: ${adoptionStats.activeUsers}/${adoptionStats.totalUsers}` : ''}
${adoptionStats.featuresUsed !== undefined && adoptionStats.totalFeatures !== undefined ? `Features Adopted: ${adoptionStats.featuresUsed}/${adoptionStats.totalFeatures}` : ''}
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
    .header { background: linear-gradient(135deg, #e63946 0%, #f4a261 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header .celebration { font-size: 48px; margin-bottom: 10px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .achievements-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .achievement-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #dee2e6; }
    .achievement-value { font-size: 24px; font-weight: bold; color: #e63946; }
    .achievement-label { font-size: 14px; color: #666; margin-top: 5px; }
    .adoption-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #4caf50; }
    .adoption-box h3 { margin-top: 0; color: #2e7d32; }
    .adoption-stats { display: flex; gap: 30px; }
    .adoption-stats .stat { text-align: center; }
    .section { margin: 25px 0; }
    .section h3 { color: #1d3557; border-bottom: 2px solid #e63946; padding-bottom: 8px; }
    .next-phase-box { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #457b9d; }
    .next-phase-box h3 { margin-top: 0; color: #1d3557; }
    .feedback-box { background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ff9800; text-align: center; }
    .feedback-box h3 { margin-top: 0; color: #e65100; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    .cta-button:hover { background: #c5303c; }
    .cta-button.secondary { background: #457b9d; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .success-story { font-style: italic; background: #f8f9fa; padding: 20px; border-left: 4px solid #e63946; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="celebration">&#127881;</div>
      <h1>30 Days Together!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>What a milestone! You've officially completed your first month with ${productName}, and I wanted to take a moment to celebrate ${customerName}'s progress.</p>

      ${achievements.length > 0 ? `
      <div class="section">
        <h3>Your 30-Day Achievements</h3>
        ${achievementsHtml}
      </div>
      ` : ''}

      ${adoptionHtml}

      ${successStory ? `
      <div class="success-story">
        "${successStory}"
      </div>
      ` : ''}

      <div class="next-phase-box">
        <h3>What's Next?</h3>
        <p>Now that you've completed onboarding, here's what the next phase looks like:</p>
        <ul>
          ${nextPhaseGoals.map(goal => `<li>${goal}</li>`).join('')}
        </ul>
        <p>I'll be your partner through all of this - let's make the next 30 days even better!</p>
      </div>

      <div class="feedback-box">
        <h3>How Did We Do?</h3>
        <p>Your feedback helps us improve. Would you take 2 minutes to share your onboarding experience?</p>
        ${feedbackSurveyUrl ? `<a href="${feedbackSurveyUrl}" class="cta-button">Share Feedback</a>` : '<p><em>Reply to this email with your thoughts!</em></p>'}
      </div>

      <p style="text-align: center; margin: 30px 0;">
        ${scheduleMeetingUrl ? `<a href="${scheduleMeetingUrl}" class="cta-button">Schedule Check-In</a>` : ''}
        <a href="mailto:${csmEmail}" class="cta-button secondary">Email Me</a>
      </p>

      <p>Thank you for trusting us with your success. Here's to many more milestones together!</p>

      <p>
        Cheers,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is the final email in your onboarding welcome sequence. You've graduated! Your CSM will continue to be your partner for ongoing success.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

What a milestone! You've officially completed your first month with ${productName}, and I wanted to take a moment to celebrate ${customerName}'s progress.

${achievements.length > 0 ? `
YOUR 30-DAY ACHIEVEMENTS
------------------------
${achievementsText}
` : ''}
${adoptionText}
${successStory ? `
"${successStory}"
` : ''}

WHAT'S NEXT?
------------
Now that you've completed onboarding, here's what the next phase looks like:
${nextPhaseGoals.map(goal => `- ${goal}`).join('\n')}

I'll be your partner through all of this - let's make the next 30 days even better!

HOW DID WE DO?
--------------
Your feedback helps us improve. Would you take 2 minutes to share your onboarding experience?
${feedbackSurveyUrl ? `Share feedback: ${feedbackSurveyUrl}` : 'Reply to this email with your thoughts!'}

${scheduleMeetingUrl ? `Schedule a check-in: ${scheduleMeetingUrl}` : ''}

Thank you for trusting us with your success. Here's to many more milestones together!

Cheers,
${csmName}
${csmEmail}

---
This is the final email in your onboarding welcome sequence. You've graduated! Your CSM will continue to be your partner for ongoing success.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWelcomeDay30Email;
