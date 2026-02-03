/**
 * Thank You - Referral Template
 * PRD-035: Thank You Note Generator
 *
 * Template for thanking customers who have referred new business
 */

export interface ThankYouReferralVariables {
  recipientName: string;
  customerName: string;
  referredCompanyName: string;
  referralDate?: string;
  referralStatus?: 'pipeline' | 'demo_scheduled' | 'closed_won' | 'active';
  yearsAsPartner?: number;
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
  gestureOptions?: Array<{
    id: string;
    label: string;
  }>;
}

/**
 * Generate the subject line for a referral thank you email
 */
export function generateSubject(variables: ThankYouReferralVariables): string {
  return `Thank You, ${variables.recipientName} - Your Referral Means the World`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ThankYouReferralVariables): string {
  const {
    recipientName,
    customerName,
    referredCompanyName,
    referralDate,
    referralStatus,
    yearsAsPartner,
    csmName = 'Your Customer Success Team',
    gestureOptions,
  } = variables;

  const statusText = referralStatus === 'closed_won'
    ? `${referredCompanyName} is now a customer, and that's thanks to you!`
    : referralStatus === 'demo_scheduled'
    ? `${referredCompanyName} has scheduled a demo, and we're excited to show them what we can do.`
    : referralStatus === 'active'
    ? `${referredCompanyName} is thriving as a customer now.`
    : `${referredCompanyName} is currently in our sales pipeline.`;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `Your ${yearsAsPartner === 1 ? 'year' : `${yearsAsPartner} years`} of partnership and advocacy have been incredible, and this referral is just another example of the trust you've placed in us.`
    : 'Your trust in recommending us to your network means everything.';

  const gestureText = gestureOptions && gestureOptions.length > 0
    ? `

As a small token of appreciation, I'd love to offer you one of the following:
${gestureOptions.map(g => `- ${g.label}`).join('\n')}

Just let me know which you'd prefer, and I'll take care of the rest.`
    : '';

  return `Hi ${recipientName},

I just wanted to take a moment to personally thank you for referring ${referredCompanyName} to us${referralDate ? ` on ${referralDate}` : ''}. Recommendations from trusted partners like you are the highest compliment we can receive.

${statusText}

${partnershipText} It truly means a lot.
${gestureText}

Thank you again, ${recipientName}. We're lucky to have you as a partner.

Warmly,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ThankYouReferralVariables): string {
  const {
    recipientName,
    customerName,
    referredCompanyName,
    referralDate,
    referralStatus,
    yearsAsPartner,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
    gestureOptions,
  } = variables;

  const statusText = referralStatus === 'closed_won'
    ? `<strong>${referredCompanyName}</strong> is now a customer, and that's thanks to you!`
    : referralStatus === 'demo_scheduled'
    ? `<strong>${referredCompanyName}</strong> has scheduled a demo, and we're excited to show them what we can do.`
    : referralStatus === 'active'
    ? `<strong>${referredCompanyName}</strong> is thriving as a customer now.`
    : `<strong>${referredCompanyName}</strong> is currently in our sales pipeline.`;

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `Your ${yearsAsPartner === 1 ? 'year' : `${yearsAsPartner} years`} of partnership and advocacy have been incredible, and this referral is just another example of the trust you've placed in us.`
    : 'Your trust in recommending us to your network means everything.';

  const gestureHtml = gestureOptions && gestureOptions.length > 0
    ? `
      <div style="margin-top: 24px; padding: 20px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #92400e;">
          As a small token of appreciation, I'd love to offer you:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #78350f;">
          ${gestureOptions.map(g => `<li style="margin-bottom: 8px;">${g.label}</li>`).join('')}
        </ul>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #92400e;">
          Just reply and let me know which you'd prefer!
        </p>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Your Referral</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header with Thank You -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🙏</div>
      <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0;">
        Thank You!
      </h1>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
      <!-- Greeting -->
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          I just wanted to take a moment to personally thank you for referring <strong>${referredCompanyName}</strong> to us${referralDate ? ` on ${referralDate}` : ''}. Recommendations from trusted partners like you are the highest compliment we can receive.
        </p>

        <!-- Status Highlight -->
        <div style="padding: 16px; background: #dcfce7; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #166534;">
            ${statusText}
          </p>
        </div>

        <p style="margin: 16px 0 0 0; color: #374151;">
          ${partnershipText} It truly means a lot.
        </p>

        ${gestureHtml}
      </div>

      <!-- Closing -->
      <div style="padding: 0 24px 24px;">
        <p style="margin: 24px 0 0 0; color: #374151;">
          Thank you again, ${recipientName}. We're lucky to have you as a partner.
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
        Sent with gratitude from ${companyName}
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
export function generateThankYouReferralEmail(variables: ThankYouReferralVariables): {
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
 * Default gesture options for referral thank you
 */
export const DEFAULT_REFERRAL_GESTURES = [
  { id: 'early_access', label: 'Early access to our Q2 product beta' },
  { id: 'gift_card', label: 'A $50 gift card to your favorite coffee shop' },
  { id: 'charity_donation', label: 'Donation to a charity of your choice' },
];
