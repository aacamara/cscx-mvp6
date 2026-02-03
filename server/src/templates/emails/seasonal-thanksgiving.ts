/**
 * Seasonal Thanksgiving Greeting Template
 * PRD-054: Seasonal/Holiday Outreach
 *
 * Thanksgiving gratitude template (US-focused, opt-in based)
 */

export interface ThanksgivingGreetingVariables {
  recipientName: string;
  customerName: string;
  yearsAsPartner?: number;
  specificGratitude?: string[];
  personalNote?: string;
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for a Thanksgiving greeting
 */
export function generateSubject(variables: ThanksgivingGreetingVariables): string {
  return `Giving Thanks - Happy Thanksgiving, ${variables.recipientName}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ThanksgivingGreetingVariables): string {
  const {
    recipientName,
    customerName,
    yearsAsPartner,
    specificGratitude,
    personalNote,
    csmName = 'Your Customer Success Team',
  } = variables;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `This Thanksgiving, as I reflect on the past ${yearsAsPartner === 1 ? 'year' : `${yearsAsPartner} years`} of our partnership, I'm filled with genuine gratitude.`
    : `This Thanksgiving, I wanted to take a moment to express my sincere gratitude for our partnership.`;

  const gratitudeText = specificGratitude && specificGratitude.length > 0
    ? `\n\nI'm especially thankful for:\n${specificGratitude.map(g => `  - ${g}`).join('\n')}`
    : '';

  const personalText = personalNote
    ? `\n\n${personalNote}`
    : '';

  return `Hi ${recipientName},

${partnershipText}

Working with you and the ${customerName} team isn't just business - it's a relationship built on trust, collaboration, and shared success. Partners like you are what make this work so rewarding.${gratitudeText}

Wishing you and your loved ones a wonderful Thanksgiving filled with warmth, good food, and quality time with family and friends.${personalText}

With sincere thanks,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ThanksgivingGreetingVariables): string {
  const {
    recipientName,
    customerName,
    yearsAsPartner,
    specificGratitude,
    personalNote,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `This Thanksgiving, as I reflect on the past ${yearsAsPartner === 1 ? 'year' : `${yearsAsPartner} years`} of our partnership, I'm filled with genuine gratitude.`
    : `This Thanksgiving, I wanted to take a moment to express my sincere gratitude for our partnership.`;

  const gratitudeHtml = specificGratitude && specificGratitude.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #d97706;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #92400e;">I'm especially thankful for:</p>
        <ul style="margin: 0; padding-left: 20px; color: #78350f;">
          ${specificGratitude.map(g => `<li style="margin-bottom: 8px;">${g}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const personalHtml = personalNote
    ? `<p style="margin: 16px 0; color: #374151; font-style: italic;">${personalNote}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Happy Thanksgiving</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background: linear-gradient(180deg, #78350f 0%, #451a03 100%);">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px; padding: 24px;">
      <div style="font-size: 56px; margin-bottom: 12px;">🍂</div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        Happy Thanksgiving
      </h1>
      <p style="margin: 0; color: #fde68a; font-size: 14px; letter-spacing: 1px;">A Season of Gratitude</p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.2); overflow: hidden;">
      <!-- Decorative Top -->
      <div style="height: 8px; background: linear-gradient(90deg, #ea580c, #d97706, #ca8a04, #d97706, #ea580c);"></div>

      <div style="padding: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${partnershipText}
        </p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          Working with you and the <strong>${customerName}</strong> team isn't just business - it's a relationship built on trust, collaboration, and shared success. Partners like you are what make this work so rewarding.
        </p>

        ${gratitudeHtml}

        <p style="margin: 16px 0; color: #374151;">
          Wishing you and your loved ones a wonderful Thanksgiving filled with warmth, good food, and quality time with family and friends.
        </p>

        ${personalHtml}
      </div>

      <!-- Decorative Bottom -->
      <div style="padding: 16px 32px; background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%); border-top: 1px solid #fde68a; text-align: center;">
        <span style="font-size: 24px;">🦃</span>
        <span style="font-size: 20px; margin: 0 8px;">🍁</span>
        <span style="font-size: 24px;">🥧</span>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px; color: #ffffff;">
      <p style="margin: 0 0 8px 0;">With sincere thanks,</p>
      <p style="margin: 0; font-weight: 600;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #fde68a;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #d4d4d8;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #a8a29e;">
      <p style="margin: 0;">
        Grateful for partnerships that matter
      </p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Generate complete email content from variables
 */
export function generateThanksgivingGreetingEmail(variables: ThanksgivingGreetingVariables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  return {
    subject: generateSubject(variables),
    bodyHtml: generateHtmlBody(variables),
    bodyText: generatePlainTextBody(variables),
  };
}
