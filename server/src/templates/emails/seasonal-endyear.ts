/**
 * Seasonal End of Year Greeting Template
 * PRD-054: Seasonal/Holiday Outreach
 *
 * End of year reflection/gratitude template with year-in-review elements
 */

export interface EndYearGreetingVariables {
  recipientName: string;
  customerName: string;
  currentYear: number;
  yearsAsPartner?: number;
  keyAchievements?: Array<{
    metric: string;
    value: string;
    description?: string;
  }>;
  memorableMoments?: string[];
  thankYouNote?: string;
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for an End of Year greeting
 */
export function generateSubject(variables: EndYearGreetingVariables): string {
  return `Reflecting on ${variables.currentYear} - Thank You, ${variables.customerName}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: EndYearGreetingVariables): string {
  const {
    recipientName,
    customerName,
    currentYear,
    yearsAsPartner,
    keyAchievements,
    memorableMoments,
    thankYouNote,
    csmName = 'Your Customer Success Team',
  } = variables;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `After ${yearsAsPartner === 1 ? 'a year' : `${yearsAsPartner} years`} of partnership, I'm continually impressed by what we've accomplished together.`
    : `This year has been remarkable, and I wanted to take a moment to reflect on our journey together.`;

  const achievementsText = keyAchievements && keyAchievements.length > 0
    ? `\n\nYour ${currentYear} Achievements:\n${keyAchievements.map(a => `  - ${a.metric}: ${a.value}${a.description ? ` - ${a.description}` : ''}`).join('\n')}`
    : '';

  const momentsText = memorableMoments && memorableMoments.length > 0
    ? `\n\nMemorable moments from this year:\n${memorableMoments.map(m => `  - ${m}`).join('\n')}`
    : '';

  const thankYouText = thankYouNote
    ? `\n\n${thankYouNote}`
    : '';

  return `Hi ${recipientName},

As ${currentYear} draws to a close, I wanted to pause and say thank you.

${partnershipText}${achievementsText}${momentsText}

Working with you and the ${customerName} team has been one of my highlights this year. Your partnership, trust, and collaboration make what we do meaningful.${thankYouText}

Here's to closing out the year strong and starting the next one even stronger!

With gratitude,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: EndYearGreetingVariables): string {
  const {
    recipientName,
    customerName,
    currentYear,
    yearsAsPartner,
    keyAchievements,
    memorableMoments,
    thankYouNote,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `After ${yearsAsPartner === 1 ? 'a year' : `${yearsAsPartner} years`} of partnership, I'm continually impressed by what we've accomplished together.`
    : `This year has been remarkable, and I wanted to take a moment to reflect on our journey together.`;

  const achievementsHtml = keyAchievements && keyAchievements.length > 0
    ? `
      <div style="margin: 24px 0;">
        <p style="margin: 0 0 16px 0; font-weight: 600; color: #111827; font-size: 16px;">
          Your ${currentYear} Achievements
        </p>
        <div style="display: grid; gap: 12px;">
          ${keyAchievements.map(a => `
            <div style="padding: 16px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border-left: 4px solid #10b981;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <span style="font-weight: 600; color: #065f46;">${a.metric}</span>
                <span style="font-size: 20px; font-weight: 700; color: #047857;">${a.value}</span>
              </div>
              ${a.description ? `<p style="margin: 0; font-size: 13px; color: #047857;">${a.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  const momentsHtml = memorableMoments && memorableMoments.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background: #faf5ff; border-radius: 12px;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #6b21a8;">Memorable Moments</p>
        <ul style="margin: 0; padding-left: 20px; color: #7e22ce;">
          ${memorableMoments.map(m => `<li style="margin-bottom: 8px;">${m}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const thankYouHtml = thankYouNote
    ? `<p style="margin: 16px 0; color: #374151; font-style: italic; padding: 16px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">${thankYouNote}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>End of Year Reflection</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background: linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%);">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px; padding: 24px;">
      <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
      <h1 style="font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0;">
        Reflecting on ${currentYear}
      </h1>
      <p style="margin: 0; color: #60a5fa; font-size: 14px;">A Year of Partnership & Growth</p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.2); overflow: hidden;">
      <div style="padding: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          As ${currentYear} draws to a close, I wanted to pause and say <strong>thank you</strong>.
        </p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${partnershipText}
        </p>

        ${achievementsHtml}

        ${momentsHtml}

        <p style="margin: 16px 0; color: #374151;">
          Working with you and the <strong>${customerName}</strong> team has been one of my highlights this year. Your partnership, trust, and collaboration make what we do meaningful.
        </p>

        ${thankYouHtml}

        <p style="margin: 24px 0 0 0; color: #374151; font-weight: 500;">
          Here's to closing out the year strong and starting the next one even stronger!
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px; color: #ffffff;">
      <p style="margin: 0 0 8px 0;">With gratitude,</p>
      <p style="margin: 0; font-weight: 600;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #60a5fa;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #9ca3af;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #6b7280;">
      <p style="margin: 0;">
        Thank you for an incredible ${currentYear}
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
export function generateEndYearGreetingEmail(variables: EndYearGreetingVariables): {
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
