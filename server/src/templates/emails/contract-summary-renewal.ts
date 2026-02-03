/**
 * Contract Summary Email Template - Renewal Variant
 * PRD-050: End-of-Contract Summary
 *
 * Template for sending a comprehensive partnership summary to customers
 * who have renewed their contract, celebrating achievements and looking ahead.
 */

export interface ContractSummaryRenewalVariables {
  contactName: string;
  customerName: string;
  csmName: string;
  csmTitle?: string;
  companyName?: string;
  // Contract Period Info
  contractPeriodStart: string;
  contractPeriodEnd: string;
  contractLengthYears: number;
  originalArr: number;
  renewedArr: number;
  arrChange: number; // percentage change
  // Partnership Highlights
  roi: number;
  totalValueDelivered: number;
  efficiencyImprovement: number;
  expansionCount: number;
  departmentsOnboarded: number;
  qbrsCompleted: number;
  majorMilestones: number;
  trainingSessions: number;
  supportTicketsResolved: number;
  avgSupportResponseHours: number;
  teamAdoptionRate: number;
  trainingCompletions: number;
  // Key Milestones
  milestones: Array<{
    date: string;
    achievement: string;
  }>;
  // Quote from customer (optional)
  customerQuote?: string;
  customerQuoteAuthor?: string;
  customerQuoteTitle?: string;
  // Looking Ahead
  nextYearGoals: string[];
  // Report attachment URL
  reportUrl?: string;
}

/**
 * Generate the subject line for a renewal contract summary email
 */
export function generateSubject(variables: ContractSummaryRenewalVariables): string {
  return `Celebrating ${variables.contractLengthYears} Amazing Year${variables.contractLengthYears > 1 ? 's' : ''} + Here's to More!`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ContractSummaryRenewalVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    contractPeriodStart,
    contractPeriodEnd,
    contractLengthYears,
    originalArr,
    renewedArr,
    arrChange,
    roi,
    totalValueDelivered,
    efficiencyImprovement,
    departmentsOnboarded,
    qbrsCompleted,
    trainingSessions,
    supportTicketsResolved,
    avgSupportResponseHours,
    teamAdoptionRate,
    trainingCompletions,
    milestones,
    customerQuote,
    customerQuoteAuthor,
    customerQuoteTitle,
    nextYearGoals,
    reportUrl,
  } = variables;

  const milestonesText = milestones
    .map(m => `- ${m.date}: ${m.achievement}`)
    .join('\n');

  const goalsText = nextYearGoals
    .map(g => `- ${g}`)
    .join('\n');

  const quoteSection = customerQuote
    ? `\nWHAT YOU SAID\n-------------\n"${customerQuote}"\n- ${customerQuoteAuthor}${customerQuoteTitle ? `, ${customerQuoteTitle}` : ''}\n`
    : '';

  return `Hi ${contactName},

What an incredible ${contractLengthYears === 1 ? 'year' : `${contractLengthYears} years`} it's been! As we close out your ${contractPeriodStart} - ${contractPeriodEnd} contract and kick off our renewed partnership, I wanted to take a moment to celebrate everything ${customerName} has achieved.

BY THE NUMBERS (${contractPeriodStart} - ${contractPeriodEnd})
---------------------------------------------
- ROI: ${roi}x ($${totalValueDelivered.toLocaleString()} value)
- Efficiency Improvement: ${efficiencyImprovement}%
- Team Adoption: ${teamAdoptionRate}%
- Departments Onboarded: ${departmentsOnboarded}
- Training Completions: ${trainingCompletions}
- ARR Growth: $${originalArr.toLocaleString()} -> $${renewedArr.toLocaleString()} (${arrChange > 0 ? '+' : ''}${arrChange}%)

PARTNERSHIP HIGHLIGHTS
---------------------
- QBRs Completed: ${qbrsCompleted}
- Training Sessions: ${trainingSessions}
- Support Tickets Resolved: ${supportTicketsResolved} (avg ${avgSupportResponseHours}hr response)

KEY MILESTONES
--------------
${milestonesText}
${quoteSection}
LOOKING AHEAD
-------------
With your renewed contract, I'm excited to help ${customerName}:
${goalsText}

Thank you for being an amazing partner. Here's to the next chapter!
${reportUrl ? `\nView your full partnership report: ${reportUrl}` : ''}

Best regards,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ContractSummaryRenewalVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    csmTitle,
    companyName = 'CSCX.AI',
    contractPeriodStart,
    contractPeriodEnd,
    contractLengthYears,
    originalArr,
    renewedArr,
    arrChange,
    roi,
    totalValueDelivered,
    efficiencyImprovement,
    teamAdoptionRate,
    trainingCompletions,
    departmentsOnboarded,
    qbrsCompleted,
    trainingSessions,
    supportTicketsResolved,
    avgSupportResponseHours,
    milestones,
    customerQuote,
    customerQuoteAuthor,
    customerQuoteTitle,
    nextYearGoals,
    reportUrl,
  } = variables;

  const milestonesHtml = milestones
    .map(m => `<li style="margin-bottom: 8px;"><strong>${m.date}:</strong> ${m.achievement}</li>`)
    .join('');

  const goalsHtml = nextYearGoals
    .map(g => `<li style="margin-bottom: 6px;">${g}</li>`)
    .join('');

  const quoteSection = customerQuote
    ? `
      <div style="padding: 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; margin-top: 24px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #92400e; margin: 0 0 12px 0;">
          What You Said
        </h3>
        <blockquote style="margin: 0; padding-left: 16px; border-left: 4px solid #f59e0b; font-style: italic; color: #78350f;">
          "${customerQuote}"
        </blockquote>
        <p style="margin: 12px 0 0; font-size: 14px; color: #92400e; font-weight: 500;">
          - ${customerQuoteAuthor}${customerQuoteTitle ? `, ${customerQuoteTitle}` : ''}
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
  <title>Partnership Summary - ${customerName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header with celebration banner -->
    <div style="text-align: center; margin-bottom: 32px; padding: 32px; background: linear-gradient(135deg, #e63946 0%, #c1121f 100%); border-radius: 16px;">
      <h1 style="font-size: 28px; font-weight: 700; color: white; margin: 0 0 8px 0;">
        Celebrating ${contractLengthYears} Amazing Year${contractLengthYears > 1 ? 's' : ''}!
      </h1>
      <p style="font-size: 16px; color: rgba(255,255,255,0.9); margin: 0;">
        ${customerName} | ${contractPeriodStart} - ${contractPeriodEnd}
      </p>
      <p style="font-size: 14px; color: rgba(255,255,255,0.7); margin: 8px 0 0 0;">
        Renewed: $${originalArr.toLocaleString()} -> $${renewedArr.toLocaleString()} (${arrChange > 0 ? '+' : ''}${arrChange}%)
      </p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

      <!-- Greeting -->
      <div style="padding: 24px 24px 0;">
        <p style="margin: 0 0 16px 0;">Hi ${contactName},</p>
        <p style="margin: 0; color: #374151;">
          What an incredible ${contractLengthYears === 1 ? 'year' : `${contractLengthYears} years`} it's been! As we close out your contract and kick off our renewed partnership, I wanted to take a moment to celebrate everything ${customerName} has achieved.
        </p>
      </div>

      <!-- Key Metrics Grid -->
      <div style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          By the Numbers
        </h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px; text-align: center; background: #fef3c7; border-radius: 8px; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #92400e;">${roi}x</div>
              <div style="font-size: 12px; color: #92400e; font-weight: 500;">ROI</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; text-align: center; background: #dcfce7; border-radius: 8px; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #166534;">$${(totalValueDelivered / 1000).toFixed(0)}K</div>
              <div style="font-size: 12px; color: #166534; font-weight: 500;">Value Delivered</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; text-align: center; background: #dbeafe; border-radius: 8px; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #1e40af;">${efficiencyImprovement}%</div>
              <div style="font-size: 12px; color: #1e40af; font-weight: 500;">Efficiency Gain</div>
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; background: #f9fafb; border-radius: 8px;">
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Team Adoption</span>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
              ${teamAdoptionRate}%
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Departments Onboarded</span>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
              ${departmentsOnboarded}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px;">
              <span style="color: #6b7280;">Training Completions</span>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 600;">
              ${trainingCompletions}
            </td>
          </tr>
        </table>
      </div>

      <!-- Partnership Stats -->
      <div style="padding: 0 24px 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          Partnership Highlights
        </h2>

        <div style="display: flex; gap: 12px;">
          <div style="flex: 1; padding: 16px; background: #f0fdf4; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #166534;">${qbrsCompleted}</div>
            <div style="font-size: 11px; color: #166534;">QBRs</div>
          </div>
          <div style="flex: 1; padding: 16px; background: #eff6ff; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #1e40af;">${trainingSessions}</div>
            <div style="font-size: 11px; color: #1e40af;">Training Sessions</div>
          </div>
          <div style="flex: 1; padding: 16px; background: #fef3c7; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #92400e;">${supportTicketsResolved}</div>
            <div style="font-size: 11px; color: #92400e;">Tickets (${avgSupportResponseHours}hr avg)</div>
          </div>
        </div>
      </div>

      <!-- Milestones -->
      <div style="padding: 0 24px 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          Key Milestones
        </h2>
        <ul style="margin: 0; padding-left: 24px; color: #374151;">
          ${milestonesHtml}
        </ul>
      </div>

      <!-- Customer Quote (if provided) -->
      ${quoteSection}

      <!-- Looking Ahead -->
      <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">
          Looking Ahead
        </h3>
        <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px;">
          With your renewed contract, I'm excited to help ${customerName}:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
          ${goalsHtml}
        </ul>
      </div>

      <!-- CTA -->
      ${reportUrl ? `
      <div style="padding: 24px; text-align: center;">
        <a href="${reportUrl}" style="display: inline-block; background: #e63946; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Full Partnership Report
        </a>
      </div>
      ` : ''}
    </div>

    <!-- Closing -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">
        Thank you for being an amazing partner. Here's to the next chapter!
      </p>
      <p style="color: #374151; margin: 24px 0 8px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        This summary was generated by ${companyName}'s AI-powered Customer Success platform.
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
export function generateContractSummaryRenewalEmail(variables: ContractSummaryRenewalVariables): {
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
