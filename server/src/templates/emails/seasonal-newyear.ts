/**
 * Seasonal New Year Greeting Template
 * PRD-054: Seasonal/Holiday Outreach
 *
 * New Year greeting template with personalization from customer relationship
 */

export interface NewYearGreetingVariables {
  recipientName: string;
  customerName: string;
  yearsAsPartner?: number;
  partnershipHighlights?: string[];
  upcomingYear: number;
  personalNote?: string;
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for a New Year greeting
 */
export function generateSubject(variables: NewYearGreetingVariables): string {
  return `Happy New Year, ${variables.recipientName}!`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: NewYearGreetingVariables): string {
  const {
    recipientName,
    customerName,
    yearsAsPartner,
    partnershipHighlights,
    upcomingYear,
    personalNote,
    csmName = 'Your Customer Success Team',
  } = variables;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `Over the past ${yearsAsPartner === 1 ? 'year' : `${yearsAsPartner} years`} together, it's been a privilege to be part of ${customerName}'s journey.`
    : `It's been wonderful working with you and the ${customerName} team this year.`;

  const highlightsText = partnershipHighlights && partnershipHighlights.length > 0
    ? `\n\nSome highlights from our partnership this year:\n${partnershipHighlights.map(h => `  - ${h}`).join('\n')}`
    : '';

  const personalText = personalNote
    ? `\n\n${personalNote}`
    : '';

  return `Hi ${recipientName},

As ${upcomingYear - 1} comes to a close, I wanted to take a moment to say thank you.

${partnershipText}${highlightsText}

Wishing you and your family a wonderful holiday season and a New Year filled with continued success, health, and happiness.

Looking forward to what we'll accomplish together in ${upcomingYear}!${personalText}

Warmly,
${csmName}

P.S. - No agenda here, just genuine well wishes. But if you'd like to grab a coffee (virtual or otherwise) in January to chat about ${upcomingYear} plans, I'm always happy to connect!
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: NewYearGreetingVariables): string {
  const {
    recipientName,
    customerName,
    yearsAsPartner,
    partnershipHighlights,
    upcomingYear,
    personalNote,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `Over the past ${yearsAsPartner === 1 ? 'year' : `${yearsAsPartner} years`} together, it's been a privilege to be part of <strong>${customerName}</strong>'s journey.`
    : `It's been wonderful working with you and the <strong>${customerName}</strong> team this year.`;

  const highlightsHtml = partnershipHighlights && partnershipHighlights.length > 0
    ? `
      <div style="margin: 20px 0; padding: 16px; background: linear-gradient(135deg, #fef9e7 0%, #fff8e1 100%); border-radius: 12px; border-left: 4px solid #f4d03f;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #b7950b;">This Year's Highlights:</p>
        <ul style="margin: 0; padding-left: 20px; color: #7d6608;">
          ${partnershipHighlights.map(h => `<li style="margin-bottom: 8px;">${h}</li>`).join('')}
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
  <title>Happy New Year</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Festive Header -->
    <div style="text-align: center; margin-bottom: 32px; padding: 24px; background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,255,255,0.05) 100%); border-radius: 16px;">
      <div style="font-size: 56px; margin-bottom: 12px;">🎉</div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        Happy New Year ${upcomingYear}!
      </h1>
      <p style="margin: 0; color: #d4af37; font-size: 14px; letter-spacing: 2px;">✨ WISHING YOU SUCCESS & PROSPERITY ✨</p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.2); overflow: hidden;">
      <div style="padding: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          As ${upcomingYear - 1} comes to a close, I wanted to take a moment to say <strong>thank you</strong>.
        </p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${partnershipText}
        </p>

        ${highlightsHtml}

        <p style="margin: 16px 0; color: #374151;">
          Wishing you and your family a wonderful holiday season and a New Year filled with continued success, health, and happiness.
        </p>

        <p style="margin: 16px 0; color: #374151; font-weight: 500;">
          Looking forward to what we'll accomplish together in ${upcomingYear}!
        </p>

        ${personalHtml}
      </div>

      <!-- PS Note -->
      <div style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          <strong>P.S.</strong> - No agenda here, just genuine well wishes. But if you'd like to grab a coffee (virtual or otherwise) in January to chat about ${upcomingYear} plans, I'm always happy to connect!
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px; color: #ffffff;">
      <p style="margin: 0 0 8px 0;">Warmly,</p>
      <p style="margin: 0; font-weight: 600;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #d4af37;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #9ca3af;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #6b7280;">
      <p style="margin: 0;">
        Wishing you a prosperous ${upcomingYear}
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
export function generateNewYearGreetingEmail(variables: NewYearGreetingVariables): {
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
