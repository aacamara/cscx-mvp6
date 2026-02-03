/**
 * Amendment Confirmation Email Template
 * PRD-042: Contract Amendment Request
 *
 * Template for the confirmation email sent after an amendment is executed.
 */

export interface AmendmentConfirmationEmailVariables {
  contactName: string;
  customerName: string;
  csmName: string;
  csmEmail?: string;
  csmTitle?: string;
  companyName?: string;

  // Amendment details
  amendmentId: string;
  amendmentType: string;
  amendmentTypeLabel: string;
  executedDate: string;

  // Before state
  previousSeats?: number;
  previousArr: number;

  // After state
  newSeats?: number;
  newArr: number;
  newTermEnd?: string;
  newFeatures?: string[];

  // Financial summary
  proratedAmount?: number;
  effectiveDate: string;

  // What's next
  provisioningEta?: string;
  supportContactEmail?: string;
}

/**
 * Generate subject line for confirmation email
 */
export function generateSubject(variables: AmendmentConfirmationEmailVariables): string {
  const { customerName, amendmentTypeLabel } = variables;
  return `Confirmed: ${customerName} Contract Amendment - ${amendmentTypeLabel}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: AmendmentConfirmationEmailVariables): string {
  const {
    contactName,
    csmName,
    executedDate,
    previousSeats,
    previousArr,
    newSeats,
    newArr,
    newTermEnd,
    newFeatures,
    proratedAmount,
    effectiveDate,
    provisioningEta = '24 hours',
  } = variables;

  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  let body = `Hi ${contactName},

Great news! Your contract amendment has been successfully executed as of ${executedDate}.

AMENDMENT SUMMARY
-----------------`;

  if (previousSeats && newSeats) {
    body += `
- Users: ${previousSeats} -> ${newSeats}`;
  }

  body += `
- Annual Rate: ${formatCurrency(previousArr)} -> ${formatCurrency(newArr)}`;

  if (newTermEnd) {
    body += `
- New Term End: ${newTermEnd}`;
  }

  if (newFeatures && newFeatures.length > 0) {
    body += `
- New Features: ${newFeatures.join(', ')}`;
  }

  if (proratedAmount) {
    body += `
- Prorated Amount: ${formatCurrency(proratedAmount)}`;
  }

  body += `
- Effective Date: ${effectiveDate}`;

  body += `

WHAT'S NEXT
-----------`;

  if (newSeats && previousSeats && newSeats > previousSeats) {
    body += `
- Additional seats will be provisioned within ${provisioningEta}
- You'll receive login credentials for new users separately`;
  }

  if (newFeatures && newFeatures.length > 0) {
    body += `
- New features are now active in your account
- Documentation and training resources will be shared shortly`;
  }

  body += `
- An updated invoice will be sent to your billing contact
- Updated contract documents are available in your portal

If you have any questions or need assistance getting started with your updated account, please don't hesitate to reach out.

Best regards,
${csmName}`;

  return body.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: AmendmentConfirmationEmailVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    csmTitle,
    companyName = 'CSCX.AI',
    amendmentTypeLabel,
    executedDate,
    previousSeats,
    previousArr,
    newSeats,
    newArr,
    newTermEnd,
    newFeatures,
    proratedAmount,
    effectiveDate,
    provisioningEta = '24 hours',
  } = variables;

  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  // Build summary rows
  let summaryRows = '';

  if (previousSeats && newSeats) {
    const change = newSeats - previousSeats;
    const changeColor = change > 0 ? '#059669' : '#dc2626';
    const changePrefix = change > 0 ? '+' : '';
    summaryRows += `
      <tr>
        <td style="padding: 12px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Users</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${previousSeats}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">-></td>
        <td style="padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${newSeats}</td>
        <td style="padding: 12px 16px; font-weight: 500; color: ${changeColor}; border-bottom: 1px solid #e5e7eb;">${changePrefix}${change}</td>
      </tr>`;
  }

  const arrChange = newArr - previousArr;
  const arrChangeColor = arrChange > 0 ? '#059669' : '#dc2626';
  const arrChangePrefix = arrChange > 0 ? '+' : '';
  summaryRows += `
    <tr>
      <td style="padding: 12px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Annual Rate</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${formatCurrency(previousArr)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">-></td>
      <td style="padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${formatCurrency(newArr)}</td>
      <td style="padding: 12px 16px; font-weight: 500; color: ${arrChangeColor}; border-bottom: 1px solid #e5e7eb;">${arrChangePrefix}${formatCurrency(arrChange)}</td>
    </tr>`;

  if (newTermEnd) {
    summaryRows += `
      <tr>
        <td style="padding: 12px 16px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Term End</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;" colspan="4">${newTermEnd}</td>
      </tr>`;
  }

  // Build what's next items
  let nextSteps: string[] = [];
  if (newSeats && previousSeats && newSeats > previousSeats) {
    nextSteps.push(`Additional seats will be provisioned within ${provisioningEta}`);
    nextSteps.push("You'll receive login credentials for new users separately");
  }
  if (newFeatures && newFeatures.length > 0) {
    nextSteps.push('New features are now active in your account');
    nextSteps.push('Documentation and training resources will be shared shortly');
  }
  nextSteps.push('An updated invoice will be sent to your billing contact');
  nextSteps.push('Updated contract documents are available in your portal');

  const nextStepsHtml = nextSteps.map(step => `<li style="margin-bottom: 6px;">${step}</li>`).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amendment Confirmation - ${customerName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Success Banner -->
    <div style="background: #dcfce7; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 8px;">&#10004;</div>
      <h1 style="font-size: 24px; font-weight: 700; color: #166534; margin: 0 0 8px 0;">
        Amendment Confirmed
      </h1>
      <p style="font-size: 14px; color: #166534; margin: 0;">
        Executed on ${executedDate}
      </p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

      <!-- Greeting -->
      <div style="padding: 24px 24px 0;">
        <p style="margin: 0 0 16px 0;">Hi ${contactName},</p>
        <p style="margin: 0; color: #374151;">
          Great news! Your contract amendment (${amendmentTypeLabel}) has been successfully executed.
        </p>
      </div>

      <!-- Amendment Summary -->
      <div style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          Amendment Summary
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 16px; text-align: left; font-weight: 500;"></th>
              <th style="padding: 8px 16px; text-align: left; font-weight: 500;">Before</th>
              <th style="padding: 8px 16px; text-align: left; font-weight: 500;"></th>
              <th style="padding: 8px 16px; text-align: left; font-weight: 500;">After</th>
              <th style="padding: 8px 16px; text-align: left; font-weight: 500;">Change</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
          </tbody>
        </table>

        ${newFeatures && newFeatures.length > 0 ? `
        <div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
          <strong style="color: #166534;">New Features Added:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #166534;">
            ${newFeatures.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${proratedAmount ? `
        <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">
          <strong>Prorated Amount:</strong> ${formatCurrency(proratedAmount)}
          <span style="margin-left: 16px;"><strong>Effective:</strong> ${effectiveDate}</span>
        </p>
        ` : ''}
      </div>

      <!-- What's Next -->
      <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">
          What's Next
        </h3>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
          ${nextStepsHtml}
        </ul>
      </div>
    </div>

    <!-- Closing -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">
        If you have any questions or need assistance getting started with your updated account, please don't hesitate to reach out.
      </p>
      <p style="color: #374151; margin: 24px 0 8px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        This confirmation was generated by ${companyName}'s Customer Success platform.
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
export function generateAmendmentConfirmationEmail(variables: AmendmentConfirmationEmailVariables): {
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

export default generateAmendmentConfirmationEmail;
