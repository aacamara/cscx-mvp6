/**
 * Contract Summary Email Template - Churn Variant
 * PRD-050: End-of-Contract Summary
 *
 * Template for sending a graceful partnership summary to customers
 * who are churning, leaving the door open for future engagement.
 */

export interface ContractSummaryChurnVariables {
  contactName: string;
  customerName: string;
  csmName: string;
  csmTitle?: string;
  companyName?: string;
  // Contract Period Info
  contractPeriodStart: string;
  contractPeriodEnd: string;
  contractLengthYears: number;
  // Partnership Highlights
  roi: number;
  totalValueDelivered: number;
  efficiencyImprovement: number;
  departmentsOnboarded: number;
  qbrsCompleted: number;
  trainingSessions: number;
  supportTicketsResolved: number;
  teamAdoptionRate: number;
  // Key Milestones
  milestones: Array<{
    date: string;
    achievement: string;
  }>;
  // Offboarding info
  offboardingDeadline: string;
  dataExportUrl?: string;
  offboardingChecklistUrl?: string;
  // Future reconnection
  feedbackSurveyUrl?: string;
  reconnectionContactEmail: string;
  // Report attachment URL
  reportUrl?: string;
}

/**
 * Generate the subject line for a churn contract summary email
 */
export function generateSubject(variables: ContractSummaryChurnVariables): string {
  return `Thank You for ${variables.contractLengthYears} Year${variables.contractLengthYears > 1 ? 's' : ''} of Partnership - ${variables.customerName}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ContractSummaryChurnVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    contractPeriodStart,
    contractPeriodEnd,
    contractLengthYears,
    roi,
    totalValueDelivered,
    efficiencyImprovement,
    departmentsOnboarded,
    teamAdoptionRate,
    qbrsCompleted,
    trainingSessions,
    supportTicketsResolved,
    milestones,
    offboardingDeadline,
    dataExportUrl,
    offboardingChecklistUrl,
    feedbackSurveyUrl,
    reconnectionContactEmail,
    reportUrl,
  } = variables;

  const milestonesText = milestones
    .map(m => `- ${m.date}: ${m.achievement}`)
    .join('\n');

  return `Hi ${contactName},

As our partnership comes to a close, I wanted to take a moment to thank you for the past ${contractLengthYears === 1 ? 'year' : `${contractLengthYears} years`}. It's been a privilege to work with the ${customerName} team.

PARTNERSHIP HIGHLIGHTS (${contractPeriodStart} - ${contractPeriodEnd})
-------------------------------------------------
- ROI Achieved: ${roi}x ($${totalValueDelivered.toLocaleString()} value)
- Efficiency Improvement: ${efficiencyImprovement}%
- Team Adoption: ${teamAdoptionRate}%
- Departments Onboarded: ${departmentsOnboarded}
- QBRs Completed: ${qbrsCompleted}
- Training Sessions: ${trainingSessions}
- Support Tickets Resolved: ${supportTicketsResolved}

KEY ACHIEVEMENTS
----------------
${milestonesText}

OFFBOARDING INFORMATION
-----------------------
Your access will remain active until: ${offboardingDeadline}

Before then, please ensure you:
${dataExportUrl ? `- Export your data: ${dataExportUrl}` : '- Export any data you need'}
${offboardingChecklistUrl ? `- Review the offboarding checklist: ${offboardingChecklistUrl}` : '- Complete any necessary offboarding steps'}

WE VALUE YOUR FEEDBACK
----------------------
${feedbackSurveyUrl ? `We'd love to hear your thoughts on your experience: ${feedbackSurveyUrl}` : 'We would appreciate any feedback you can share about your experience.'}

THE DOOR IS ALWAYS OPEN
-----------------------
If circumstances change and you'd like to explore working together again, please don't hesitate to reach out. We're constantly improving and would welcome the opportunity to reconnect.

Contact us anytime: ${reconnectionContactEmail}
${reportUrl ? `\nView your full partnership report: ${reportUrl}` : ''}

Thank you again for everything. We wish you and the ${customerName} team continued success.

Warm regards,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ContractSummaryChurnVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    csmTitle,
    companyName = 'CSCX.AI',
    contractPeriodStart,
    contractPeriodEnd,
    contractLengthYears,
    roi,
    totalValueDelivered,
    efficiencyImprovement,
    departmentsOnboarded,
    teamAdoptionRate,
    qbrsCompleted,
    trainingSessions,
    supportTicketsResolved,
    milestones,
    offboardingDeadline,
    dataExportUrl,
    offboardingChecklistUrl,
    feedbackSurveyUrl,
    reconnectionContactEmail,
    reportUrl,
  } = variables;

  const milestonesHtml = milestones
    .map(m => `<li style="margin-bottom: 8px;"><strong>${m.date}:</strong> ${m.achievement}</li>`)
    .join('');

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
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px; padding: 32px; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); border-radius: 16px;">
      <h1 style="font-size: 24px; font-weight: 700; color: white; margin: 0 0 8px 0;">
        Thank You for ${contractLengthYears} Year${contractLengthYears > 1 ? 's' : ''} of Partnership
      </h1>
      <p style="font-size: 16px; color: rgba(255,255,255,0.9); margin: 0;">
        ${customerName} | ${contractPeriodStart} - ${contractPeriodEnd}
      </p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

      <!-- Greeting -->
      <div style="padding: 24px 24px 0;">
        <p style="margin: 0 0 16px 0;">Hi ${contactName},</p>
        <p style="margin: 0; color: #374151;">
          As our partnership comes to a close, I wanted to take a moment to thank you for the past ${contractLengthYears === 1 ? 'year' : `${contractLengthYears} years`}. It's been a privilege to work with the ${customerName} team.
        </p>
      </div>

      <!-- Key Metrics Grid -->
      <div style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #6b7280;">
          Partnership Highlights
        </h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px; text-align: center; background: #f3f4f6; border-radius: 8px; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #374151;">${roi}x</div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500;">ROI Achieved</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; text-align: center; background: #f3f4f6; border-radius: 8px; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #374151;">$${(totalValueDelivered / 1000).toFixed(0)}K</div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500;">Value Delivered</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; text-align: center; background: #f3f4f6; border-radius: 8px; width: 33%;">
              <div style="font-size: 28px; font-weight: 700; color: #374151;">${efficiencyImprovement}%</div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500;">Efficiency Gain</div>
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
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">QBRs Completed</span>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
              ${qbrsCompleted}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Training Sessions</span>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
              ${trainingSessions}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px;">
              <span style="color: #6b7280;">Support Tickets Resolved</span>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 600;">
              ${supportTicketsResolved}
            </td>
          </tr>
        </table>
      </div>

      <!-- Milestones -->
      <div style="padding: 0 24px 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #6b7280;">
          Key Achievements
        </h2>
        <ul style="margin: 0; padding-left: 24px; color: #374151;">
          ${milestonesHtml}
        </ul>
      </div>

      <!-- Offboarding Info -->
      <div style="padding: 24px; background: #fef3c7; border-top: 1px solid #fde68a;">
        <h3 style="font-size: 14px; font-weight: 600; color: #92400e; margin: 0 0 12px 0;">
          Offboarding Information
        </h3>
        <p style="margin: 0 0 12px 0; color: #78350f; font-size: 14px;">
          Your access will remain active until <strong>${offboardingDeadline}</strong>.
        </p>
        <p style="margin: 0 0 8px 0; color: #78350f; font-size: 14px;">Before then, please ensure you:</p>
        <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px;">
          ${dataExportUrl ? `<li style="margin-bottom: 4px;"><a href="${dataExportUrl}" style="color: #d97706; text-decoration: underline;">Export your data</a></li>` : '<li style="margin-bottom: 4px;">Export any data you need</li>'}
          ${offboardingChecklistUrl ? `<li><a href="${offboardingChecklistUrl}" style="color: #d97706; text-decoration: underline;">Review the offboarding checklist</a></li>` : '<li>Complete any necessary offboarding steps</li>'}
        </ul>
      </div>

      <!-- Feedback Request -->
      ${feedbackSurveyUrl ? `
      <div style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 14px;">
          We'd love to hear your thoughts on your experience with us.
        </p>
        <a href="${feedbackSurveyUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Share Your Feedback
        </a>
      </div>
      ` : ''}

      <!-- Door Open Message -->
      <div style="padding: 24px; background: #f0fdf4; border-top: 1px solid #dcfce7;">
        <h3 style="font-size: 14px; font-weight: 600; color: #166534; margin: 0 0 12px 0;">
          The Door is Always Open
        </h3>
        <p style="margin: 0; color: #166534; font-size: 14px;">
          If circumstances change and you'd like to explore working together again, please don't hesitate to reach out. We're constantly improving and would welcome the opportunity to reconnect.
        </p>
        <p style="margin: 12px 0 0; font-size: 14px;">
          <a href="mailto:${reconnectionContactEmail}" style="color: #059669; font-weight: 600; text-decoration: underline;">
            ${reconnectionContactEmail}
          </a>
        </p>
      </div>

      <!-- Report CTA -->
      ${reportUrl ? `
      <div style="padding: 24px; text-align: center;">
        <a href="${reportUrl}" style="display: inline-block; background: #374151; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Full Partnership Report
        </a>
      </div>
      ` : ''}
    </div>

    <!-- Closing -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">
        Thank you again for everything. We wish you and the ${customerName} team continued success.
      </p>
      <p style="color: #374151; margin: 24px 0 8px 0;">Warm regards,</p>
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
export function generateContractSummaryChurnEmail(variables: ContractSummaryChurnVariables): {
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
