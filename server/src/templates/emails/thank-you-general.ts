/**
 * Thank You - General Template
 * PRD-035: Thank You Note Generator
 *
 * Flexible template for general thank you notes for any occasion
 */

export interface ThankYouGeneralVariables {
  recipientName: string;
  customerName: string;
  occasion: string; // What they're being thanked for
  specificDetails?: string; // More context about what they did
  personalTouch?: string; // Optional personal note from CSM
  futureCommitment?: string; // What you'll do as a result
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for a general thank you email
 */
export function generateSubject(variables: ThankYouGeneralVariables): string {
  return `Thank You, ${variables.recipientName}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ThankYouGeneralVariables): string {
  const {
    recipientName,
    customerName,
    occasion,
    specificDetails,
    personalTouch,
    futureCommitment,
    csmName = 'Your Customer Success Team',
  } = variables;

  const detailsText = specificDetails
    ? `

${specificDetails}`
    : '';

  const personalText = personalTouch
    ? `

${personalTouch}`
    : '';

  const futureText = futureCommitment
    ? `

${futureCommitment}`
    : '';

  return `Hi ${recipientName},

I wanted to take a moment to personally thank you for ${occasion}.
${detailsText}

Gestures like this from partners like you at ${customerName} remind us why we love what we do. Your support and engagement mean more than you know.
${personalText}
${futureText}

Thank you again for being such a valued partner.

Warmly,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ThankYouGeneralVariables): string {
  const {
    recipientName,
    customerName,
    occasion,
    specificDetails,
    personalTouch,
    futureCommitment,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const detailsHtml = specificDetails
    ? `
      <div style="margin: 20px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #e63946;">
        <p style="margin: 0; color: #374151;">
          ${specificDetails}
        </p>
      </div>
    `
    : '';

  const personalHtml = personalTouch
    ? `
      <p style="margin: 16px 0; color: #374151; font-style: italic;">
        ${personalTouch}
      </p>
    `
    : '';

  const futureHtml = futureCommitment
    ? `
      <p style="margin: 16px 0; color: #374151;">
        ${futureCommitment}
      </p>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🙏</div>
      <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0;">
        Thank You
      </h1>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
      <!-- Greeting -->
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          I wanted to take a moment to personally thank you for <strong>${occasion}</strong>.
        </p>

        ${detailsHtml}

        <p style="margin: 16px 0; color: #374151;">
          Gestures like this from partners like you at <strong>${customerName}</strong> remind us why we love what we do. Your support and engagement mean more than you know.
        </p>

        ${personalHtml}

        ${futureHtml}

        <p style="margin: 24px 0 0 0; color: #374151;">
          Thank you again for being such a valued partner.
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">Warmly,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        A simple thank you from ${companyName}
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
export function generateThankYouGeneralEmail(variables: ThankYouGeneralVariables): {
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

/**
 * Suggested occasions for general thank you notes
 */
export const SUGGESTED_OCCASIONS = [
  'your continued partnership',
  'your patience during the recent update',
  'sharing your insights with our product team',
  'being so responsive to our outreach',
  'your flexibility with scheduling',
  'mentoring your team on adoption',
  'championing our solution internally',
  'your honest feedback',
  'attending our user conference',
  'participating in our beta program',
];
