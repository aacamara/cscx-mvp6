/**
 * Thank You - Renewal Template
 * PRD-035: Thank You Note Generator
 *
 * Template for thanking customers who have renewed their contract
 */

export interface ThankYouRenewalVariables {
  recipientName: string;
  customerName: string;
  renewalDate?: string;
  newContractValue?: number;
  contractTerm?: string; // '1 year', '2 years', 'multi-year'
  yearsAsCustomer?: number;
  keyAchievements?: string[];
  upcomingFeatures?: string[];
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for a renewal thank you email
 */
export function generateSubject(variables: ThankYouRenewalVariables): string {
  const years = variables.yearsAsCustomer || 1;
  if (years > 1) {
    return `Thank You for ${years} Years of Partnership, ${variables.recipientName}!`;
  }
  return `Thank You for Renewing, ${variables.recipientName}!`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ThankYouRenewalVariables): string {
  const {
    recipientName,
    customerName,
    renewalDate,
    contractTerm,
    yearsAsCustomer,
    keyAchievements,
    upcomingFeatures,
    csmName = 'Your Customer Success Team',
  } = variables;

  const partnershipText = yearsAsCustomer && yearsAsCustomer > 1
    ? `We're honored that you've chosen to continue our partnership for another ${contractTerm || 'year'}. Over the past ${yearsAsCustomer} years, we've accomplished so much together.`
    : `Thank you for choosing to continue our partnership${contractTerm ? ` with a ${contractTerm} renewal` : ''}. Your trust means everything to us.`;

  const achievementsText = keyAchievements && keyAchievements.length > 0
    ? `

Some highlights from our partnership:
${keyAchievements.map(a => `- ${a}`).join('\n')}`
    : '';

  const upcomingText = upcomingFeatures && upcomingFeatures.length > 0
    ? `

We're excited about what's coming next:
${upcomingFeatures.map(f => `- ${f}`).join('\n')}`
    : '';

  return `Hi ${recipientName},

${partnershipText}
${achievementsText}

Your continued trust in our partnership motivates our entire team to keep delivering value for ${customerName}.
${upcomingText}

Here's to another successful year together!

With gratitude,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ThankYouRenewalVariables): string {
  const {
    recipientName,
    customerName,
    renewalDate,
    newContractValue,
    contractTerm,
    yearsAsCustomer,
    keyAchievements,
    upcomingFeatures,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const partnershipText = yearsAsCustomer && yearsAsCustomer > 1
    ? `We're honored that you've chosen to continue our partnership for another ${contractTerm || 'year'}. Over the past <strong>${yearsAsCustomer} years</strong>, we've accomplished so much together.`
    : `Thank you for choosing to continue our partnership${contractTerm ? ` with a ${contractTerm} renewal` : ''}. Your trust means everything to us.`;

  const achievementsHtml = keyAchievements && keyAchievements.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background: #dcfce7; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
          Partnership Highlights
        </h3>
        <ul style="margin: 0; padding-left: 20px; color: #15803d;">
          ${keyAchievements.map(a => `<li style="margin-bottom: 8px;">${a}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const upcomingHtml = upcomingFeatures && upcomingFeatures.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background: #dbeafe; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">
          What's Coming Next
        </h3>
        <ul style="margin: 0; padding-left: 20px; color: #1d4ed8;">
          ${upcomingFeatures.map(f => `<li style="margin-bottom: 8px;">${f}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const milestoneHtml = yearsAsCustomer && yearsAsCustomer > 0
    ? `
      <div style="text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px;">
        <div style="font-size: 48px; margin-bottom: 8px;">🎉</div>
        <div style="font-size: 32px; font-weight: 700; color: #92400e;">${yearsAsCustomer}</div>
        <div style="font-size: 14px; color: #78350f; font-weight: 500;">Years Together</div>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Renewing</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0;">
        Thank You for Renewing!
      </h1>
      <p style="margin: 8px 0 0 0; color: #6b7280;">
        Here's to another successful year together
      </p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
      <!-- Greeting -->
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${partnershipText}
        </p>

        ${milestoneHtml}

        ${achievementsHtml}

        <p style="margin: 16px 0; color: #374151;">
          Your continued trust in our partnership motivates our entire team to keep delivering value for <strong>${customerName}</strong>.
        </p>

        ${upcomingHtml}

        <p style="margin: 24px 0 0 0; color: #374151; font-size: 18px; font-weight: 500;">
          Here's to another successful year together! 🥂
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">With gratitude,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        Celebrating partnerships that matter
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
export function generateThankYouRenewalEmail(variables: ThankYouRenewalVariables): {
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
