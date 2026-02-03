/**
 * Renewal Proposal Email Template
 * PRD-027: Renewal Proposal Generator
 *
 * Template for the cover email that accompanies a renewal proposal document.
 */

export interface RenewalProposalEmailVariables {
  contactName: string;
  customerName: string;
  proposalUrl: string;
  fiscalYear: string;
  roi: number;
  totalValueDelivered: number;
  efficiencyImprovement: number;
  healthScore: number;
  pricingOptions: Array<{
    name: string;
    arr: number;
    recommended?: boolean;
  }>;
  recommendedOption?: {
    name: string;
    arr: number;
  };
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for a renewal proposal email
 */
export function generateSubject(variables: RenewalProposalEmailVariables): string {
  return `${variables.customerName} Partnership Renewal Proposal - FY${variables.fiscalYear}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: RenewalProposalEmailVariables): string {
  const {
    contactName,
    customerName,
    proposalUrl,
    roi,
    totalValueDelivered,
    efficiencyImprovement,
    healthScore,
    pricingOptions,
    recommendedOption,
    csmName = 'Your Customer Success Team',
  } = variables;

  const optionsSummary = pricingOptions
    .map(o => `- ${o.name}: $${o.arr.toLocaleString()}/year${o.recommended ? ' (Recommended)' : ''}`)
    .join('\n');

  return `Hi ${contactName},

As we approach the renewal of our partnership, I'm excited to share our proposal for continuing and expanding our collaboration.

PARTNERSHIP HIGHLIGHTS
--------------------
Over the past year, ${customerName} has achieved impressive results:

- ${roi}% ROI on your investment
- $${totalValueDelivered.toLocaleString()} in estimated business impact
- ${efficiencyImprovement}% efficiency improvement

Your health score of ${healthScore} reflects strong engagement and adoption across your organization.

RENEWAL OPTIONS
--------------
I've prepared a comprehensive renewal proposal with the following options:

${optionsSummary}

${recommendedOption ? `Based on your growth trajectory and usage patterns, I recommend ${recommendedOption.name} to maximize your team's success in the coming year.` : ''}

VIEW YOUR PROPOSAL
-----------------
Access the full proposal document here: ${proposalUrl}

NEXT STEPS
----------
1. Review the proposal with your team
2. Schedule a call to discuss any questions
3. Confirm your preferred option
4. Complete the renewal process

I'd love to schedule a 30-minute call to discuss this proposal and answer any questions. Would you be available this week?

Best regards,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: RenewalProposalEmailVariables): string {
  const {
    contactName,
    customerName,
    proposalUrl,
    roi,
    totalValueDelivered,
    efficiencyImprovement,
    healthScore,
    pricingOptions,
    recommendedOption,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const optionsHtml = pricingOptions
    .map(o => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 16px; font-weight: 500;">
          ${o.name}
          ${o.recommended ? '<span style="background: #dcfce7; color: #166534; font-size: 11px; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">Recommended</span>' : ''}
        </td>
        <td style="padding: 12px 16px; text-align: right; font-weight: 600;">
          $${o.arr.toLocaleString()}/year
        </td>
      </tr>
    `)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Renewal Proposal - ${customerName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">
        Partnership Renewal Proposal
      </h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">
        ${customerName} | FY${variables.fiscalYear}
      </p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

      <!-- Greeting -->
      <div style="padding: 24px 24px 0;">
        <p style="margin: 0 0 16px 0;">Hi ${contactName},</p>
        <p style="margin: 0; color: #374151;">
          As we approach the renewal of our partnership, I'm excited to share our proposal for continuing and expanding our collaboration.
        </p>
      </div>

      <!-- Key Metrics -->
      <div style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          Your Partnership Highlights
        </h2>

        <div style="display: table; width: 100%; border-spacing: 12px;">
          <div style="display: table-row;">
            <div style="display: table-cell; background: #fef3c7; border-radius: 8px; padding: 16px; text-align: center; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #92400e;">${roi}%</div>
              <div style="font-size: 12px; color: #92400e; font-weight: 500;">ROI</div>
            </div>
            <div style="display: table-cell; background: #dcfce7; border-radius: 8px; padding: 16px; text-align: center; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #166534;">$${(totalValueDelivered / 1000).toFixed(0)}K</div>
              <div style="font-size: 12px; color: #166534; font-weight: 500;">Value Delivered</div>
            </div>
            <div style="display: table-cell; background: #dbeafe; border-radius: 8px; padding: 16px; text-align: center; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #1e40af;">${efficiencyImprovement}%</div>
              <div style="font-size: 12px; color: #1e40af; font-weight: 500;">Efficiency Gain</div>
            </div>
          </div>
        </div>

        <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">
          Your health score of <strong style="color: #059669;">${healthScore}</strong> reflects strong engagement and adoption across your organization.
        </p>
      </div>

      <!-- Pricing Options -->
      <div style="padding: 0 24px 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          Renewal Options
        </h2>

        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
          <tbody>
            ${optionsHtml}
          </tbody>
        </table>

        ${recommendedOption ? `
        <p style="margin: 16px 0 0; font-size: 14px; color: #374151; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
          <strong>Our Recommendation:</strong> Based on your growth trajectory, I recommend <strong>${recommendedOption.name}</strong> to maximize your team's success in the coming year.
        </p>
        ` : ''}
      </div>

      <!-- CTA -->
      <div style="padding: 0 24px 32px; text-align: center;">
        <a href="${proposalUrl}" style="display: inline-block; background: #e63946; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Full Proposal
        </a>
        <p style="margin: 12px 0 0; font-size: 12px; color: #6b7280;">
          Includes detailed breakdown, ROI analysis, and next steps
        </p>
      </div>

      <!-- Next Steps -->
      <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">
          Next Steps
        </h3>
        <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
          <li style="margin-bottom: 6px;">Review the proposal with your team</li>
          <li style="margin-bottom: 6px;">Schedule a call to discuss any questions</li>
          <li style="margin-bottom: 6px;">Confirm your preferred option</li>
          <li>Complete the renewal process</li>
        </ol>
      </div>
    </div>

    <!-- Closing -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">
        I'd love to schedule a 30-minute call to discuss this proposal and answer any questions. Would you be available this week?
      </p>
      <p style="color: #374151; margin: 24px 0 8px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        This proposal was generated by ${companyName}'s AI-powered Customer Success platform.
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
export function generateRenewalProposalEmail(variables: RenewalProposalEmailVariables): {
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
 * Email template variants for different scenarios
 */
export const RENEWAL_EMAIL_VARIANTS = {
  // Standard renewal - healthy customer
  standard: {
    toneLine: 'excited to share our proposal for continuing and expanding our collaboration',
    urgencyLevel: 'normal',
  },

  // Urgent renewal - within 30 days
  urgent: {
    toneLine: 'as your renewal date approaches, I wanted to ensure you have all the information needed to continue our partnership',
    urgencyLevel: 'high',
  },

  // At-risk renewal - lower health score
  atRisk: {
    toneLine: 'I\'d like to discuss how we can better support your team and ensure continued success',
    urgencyLevel: 'high',
  },

  // Expansion opportunity - upsell focus
  expansion: {
    toneLine: 'based on your impressive growth, I\'ve prepared options that will scale with your team\'s expanding needs',
    urgencyLevel: 'normal',
  },

  // Multi-year renewal
  multiYear: {
    toneLine: 'given our successful partnership, I\'ve included multi-year options that provide additional value and pricing stability',
    urgencyLevel: 'normal',
  },
};

export type RenewalEmailVariant = keyof typeof RENEWAL_EMAIL_VARIANTS;

/**
 * Get variant-specific email content
 */
export function getEmailVariant(variant: RenewalEmailVariant): typeof RENEWAL_EMAIL_VARIANTS.standard {
  return RENEWAL_EMAIL_VARIANTS[variant] || RENEWAL_EMAIL_VARIANTS.standard;
}
