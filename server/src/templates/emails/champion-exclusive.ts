/**
 * Champion Exclusive Preview Email Template
 * PRD-032: Champion Nurture Sequence
 * Purpose: Exclusive preview of upcoming features, request feedback
 */

export interface ChampionExclusiveVariables {
  championName: string;
  championTitle?: string;
  customerName: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  previewType: 'roadmap' | 'feature' | 'beta' | 'report';
  previewTitle: string;
  previewDescription?: string;
  previewHighlights?: string[];
  previewLink?: string;
  feedbackDeadline?: string;
  quarter?: string;
  year?: number;
  exclusivePerks?: string[];
}

export function generateChampionExclusiveEmail(variables: ChampionExclusiveVariables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    championName,
    customerName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    previewType,
    previewTitle,
    previewDescription,
    previewHighlights = [],
    previewLink,
    feedbackDeadline,
    quarter,
    year,
    exclusivePerks = [],
  } = variables;

  const firstName = championName.split(' ')[0];

  // Customize subject based on preview type
  const subjectMap = {
    roadmap: `Early Look: ${quarter || 'Q2'} Product Roadmap (Champions Only)`,
    feature: `Exclusive Preview: ${previewTitle} - Your First Look`,
    beta: `Beta Invitation: Be the First to Try ${previewTitle}`,
    report: `Exclusive: ${previewTitle} - Early Access for Champions`,
  };

  const subject = subjectMap[previewType] || `Early Access: ${previewTitle} (Champions Only)`;

  // Build highlights section
  const highlightsList = previewHighlights.length > 0
    ? previewHighlights.map(h => `<li>${h}</li>`).join('\n')
    : '';

  // Build perks section
  const perksList = exclusivePerks.length > 0
    ? exclusivePerks.map(p => `<li>${p}</li>`).join('\n')
    : '';

  const ctaText = previewType === 'beta' ? 'Join the Beta'
    : previewType === 'roadmap' ? 'View Roadmap Preview'
    : previewType === 'report' ? 'Access Report'
    : 'View Preview';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1d3557 0%, #457b9d 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header .badge { display: inline-block; background: #e63946; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .exclusive-banner { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #e63946; }
    .exclusive-banner h3 { color: #e63946; margin: 0 0 8px 0; }
    .highlight { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #457b9d; }
    .perks { background: #e8f4ea; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .cta-button:hover { background: #c5303c; }
    .deadline { background: #fff3cd; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${previewTitle}</h1>
      <span class="badge">Champions Only</span>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>As one of our most valued champions at ${customerName}, I wanted to give you exclusive early access to something special before we share it more broadly.</p>

      <div class="exclusive-banner">
        <h3>You're Getting the First Look</h3>
        <p style="margin: 0; color: #666;">This preview is available only to our champion community.</p>
      </div>

      ${previewDescription ? `
      <p>${previewDescription}</p>
      ` : ''}

      ${previewHighlights.length > 0 ? `
      <div class="highlight">
        <strong>What's Inside:</strong>
        <ul>
          ${highlightsList}
        </ul>
      </div>
      ` : ''}

      ${exclusivePerks.length > 0 ? `
      <div class="perks">
        <strong>As a Champion, You Also Get:</strong>
        <ul>
          ${perksList}
        </ul>
      </div>
      ` : ''}

      ${previewLink ? `
      <p style="text-align: center;">
        <a href="${previewLink}" class="cta-button">${ctaText}</a>
      </p>
      ` : ''}

      ${feedbackDeadline ? `
      <div class="deadline">
        <strong>Feedback Deadline:</strong> ${feedbackDeadline}<br>
        Your input directly influences our roadmap priorities!
      </div>
      ` : ''}

      <p>I'd love to hear your thoughts. Your perspective as someone who deeply understands both ${customerName}'s needs and our platform is invaluable.</p>

      <p>Feel free to reply directly to this email with any feedback, questions, or ideas. I read and respond to every message personally.</p>

      <p>
        Best,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This is an exclusive preview for champions in our Customer Success program. Please don't share externally.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text highlights
  const highlightsText = previewHighlights.length > 0
    ? '\nWhat\'s Inside:\n' + previewHighlights.map(h => `- ${h}`).join('\n') + '\n'
    : '';

  // Build plain text perks
  const perksText = exclusivePerks.length > 0
    ? '\nAs a Champion, You Also Get:\n' + exclusivePerks.map(p => `- ${p}`).join('\n') + '\n'
    : '';

  const bodyText = `
Hi ${firstName},

As one of our most valued champions at ${customerName}, I wanted to give you exclusive early access to something special before we share it more broadly.

=== CHAMPIONS ONLY ===
${previewTitle}
You're getting the first look. This preview is available only to our champion community.

${previewDescription || ''}
${highlightsText}${perksText}
${previewLink ? `${ctaText}: ${previewLink}\n` : ''}
${feedbackDeadline ? `FEEDBACK DEADLINE: ${feedbackDeadline}\nYour input directly influences our roadmap priorities!\n` : ''}
I'd love to hear your thoughts. Your perspective as someone who deeply understands both ${customerName}'s needs and our platform is invaluable.

Feel free to reply directly to this email with any feedback, questions, or ideas. I read and respond to every message personally.

Best,
${csmName}
${csmTitle}
${csmEmail}

---
This is an exclusive preview for champions in our Customer Success program. Please don't share externally.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateChampionExclusiveEmail;
