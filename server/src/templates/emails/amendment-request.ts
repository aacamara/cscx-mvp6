/**
 * Amendment Request Email Template
 * PRD-042: Contract Amendment Request
 *
 * Template for the amendment request email sent to customers.
 */

export interface AmendmentRequestEmailVariables {
  contactName: string;
  customerName: string;
  csmName: string;
  csmEmail?: string;
  csmTitle?: string;
  companyName?: string;

  // Contract details
  contractId?: string;
  currentSeats?: number;
  currentArr: number;
  currentTermEnd: string;
  currentPlan?: string;

  // Amendment details
  amendmentType: string;
  amendmentTypeLabel: string;

  // Proposed changes
  proposedSeats?: number;
  additionalSeats?: number;
  proposedArr?: number;
  proposedTermEnd?: string;
  proposedFeatures?: string[];
  additionalFeatures?: string[];

  // Financial impact
  proratedCost: number;
  monthsRemaining: number;
  newAnnualRate: number;

  // Calculated dates
  nextTermStart?: string;

  // Custom content
  customMessage?: string;
  reason?: string;

  // Internal stakeholders to CC
  aeEmail?: string;
  aeName?: string;
  legalEmail?: string;
}

/**
 * Generate subject line for amendment request email
 */
export function generateSubject(variables: AmendmentRequestEmailVariables): string {
  const { customerName, amendmentTypeLabel, additionalSeats, proposedSeats } = variables;

  if (additionalSeats) {
    return `${customerName} Contract Amendment - ${additionalSeats} Additional Users`;
  }

  if (proposedSeats) {
    return `${customerName} Contract Amendment - ${proposedSeats} Users`;
  }

  return `${customerName} Contract Amendment - ${amendmentTypeLabel}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: AmendmentRequestEmailVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    currentSeats,
    currentArr,
    currentTermEnd,
    proposedSeats,
    additionalSeats,
    proratedCost,
    monthsRemaining,
    newAnnualRate,
    nextTermStart,
    customMessage,
    reason,
    amendmentTypeLabel,
    proposedFeatures,
    additionalFeatures,
  } = variables;

  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  let body = `Hi ${contactName},

`;

  // Opening based on amendment type
  if (additionalSeats) {
    body += `Great news - I'm excited to formalize the expansion we discussed! Here's a summary of the proposed contract amendment:`;
  } else if (reason) {
    body += `I'm reaching out regarding a proposed contract amendment. ${reason}`;
  } else {
    body += `I'm reaching out regarding a proposed contract amendment for ${customerName}.`;
  }

  body += `

CURRENT AGREEMENT
-----------------`;

  if (currentSeats) {
    body += `
- Users: ${currentSeats}`;
  }

  body += `
- Annual Rate: ${formatCurrency(currentArr)}
- Term: Through ${currentTermEnd}`;

  body += `

PROPOSED AMENDMENT (${amendmentTypeLabel})
-----------------`;

  if (additionalSeats) {
    body += `
- Additional Users: +${additionalSeats}
- New Total: ${proposedSeats} users`;
  } else if (proposedSeats && proposedSeats !== currentSeats) {
    body += `
- New Users: ${proposedSeats}`;
  }

  if (additionalFeatures && additionalFeatures.length > 0) {
    body += `
- Additional Features: ${additionalFeatures.join(', ')}`;
  }

  if (proposedFeatures && proposedFeatures.length > 0) {
    body += `
- New Features: ${proposedFeatures.join(', ')}`;
  }

  body += `
- Prorated Cost (${monthsRemaining} months): ${formatCurrency(proratedCost)}
- New Annual Rate${nextTermStart ? ` (starting ${nextTermStart})` : ''}: ${formatCurrency(newAnnualRate)}`;

  body += `

NEXT STEPS
----------
1. Review and confirm the above details
2. I'll generate the formal amendment document
3. Electronic signature via DocuSign
4. Changes effective within 24 hours of signature`;

  if (customMessage) {
    body += `

${customMessage}`;
  }

  body += `

Please let me know if you have any questions or if anything needs adjustment.

Best regards,
${csmName}`;

  return body.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: AmendmentRequestEmailVariables): string {
  const {
    contactName,
    customerName,
    csmName,
    csmTitle,
    companyName = 'CSCX.AI',
    currentSeats,
    currentArr,
    currentTermEnd,
    proposedSeats,
    additionalSeats,
    proratedCost,
    monthsRemaining,
    newAnnualRate,
    nextTermStart,
    customMessage,
    reason,
    amendmentTypeLabel,
    proposedFeatures,
    additionalFeatures,
  } = variables;

  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  // Opening message based on context
  let openingMessage = '';
  if (additionalSeats) {
    openingMessage = "Great news - I'm excited to formalize the expansion we discussed! Here's a summary of the proposed contract amendment:";
  } else if (reason) {
    openingMessage = `I'm reaching out regarding a proposed contract amendment. ${reason}`;
  } else {
    openingMessage = `I'm reaching out regarding a proposed contract amendment for ${customerName}.`;
  }

  // Build current agreement rows
  let currentRows = '';
  if (currentSeats) {
    currentRows += `
      <tr>
        <td style="padding: 8px 16px; color: #6b7280;">Users</td>
        <td style="padding: 8px 16px; font-weight: 500;">${currentSeats}</td>
      </tr>`;
  }
  currentRows += `
    <tr>
      <td style="padding: 8px 16px; color: #6b7280;">Annual Rate</td>
      <td style="padding: 8px 16px; font-weight: 500;">${formatCurrency(currentArr)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px; color: #6b7280;">Term</td>
      <td style="padding: 8px 16px; font-weight: 500;">Through ${currentTermEnd}</td>
    </tr>`;

  // Build proposed changes rows
  let proposedRows = '';
  if (additionalSeats) {
    proposedRows += `
      <tr>
        <td style="padding: 8px 16px; color: #6b7280;">Additional Users</td>
        <td style="padding: 8px 16px; font-weight: 600; color: #059669;">+${additionalSeats}</td>
      </tr>
      <tr>
        <td style="padding: 8px 16px; color: #6b7280;">New Total</td>
        <td style="padding: 8px 16px; font-weight: 500;">${proposedSeats} users</td>
      </tr>`;
  } else if (proposedSeats && proposedSeats !== currentSeats) {
    proposedRows += `
      <tr>
        <td style="padding: 8px 16px; color: #6b7280;">New Users</td>
        <td style="padding: 8px 16px; font-weight: 500;">${proposedSeats}</td>
      </tr>`;
  }

  if (additionalFeatures && additionalFeatures.length > 0) {
    proposedRows += `
      <tr>
        <td style="padding: 8px 16px; color: #6b7280;">Additional Features</td>
        <td style="padding: 8px 16px; font-weight: 500;">${additionalFeatures.join(', ')}</td>
      </tr>`;
  }

  proposedRows += `
    <tr>
      <td style="padding: 8px 16px; color: #6b7280;">Prorated Cost (${monthsRemaining} months)</td>
      <td style="padding: 8px 16px; font-weight: 600; color: #1e40af;">${formatCurrency(proratedCost)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px; color: #6b7280;">New Annual Rate${nextTermStart ? ` (starting ${nextTermStart})` : ''}</td>
      <td style="padding: 8px 16px; font-weight: 600;">${formatCurrency(newAnnualRate)}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Amendment - ${customerName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">
        Contract Amendment Request
      </h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">
        ${customerName} | ${amendmentTypeLabel}
      </p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

      <!-- Greeting -->
      <div style="padding: 24px 24px 0;">
        <p style="margin: 0 0 16px 0;">Hi ${contactName},</p>
        <p style="margin: 0; color: #374151;">
          ${openingMessage}
        </p>
      </div>

      <!-- Current Agreement -->
      <div style="padding: 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          Current Agreement
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${currentRows}
        </table>
      </div>

      <!-- Proposed Amendment -->
      <div style="padding: 0 24px 24px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e63946;">
          Proposed Amendment
        </h2>
        <table style="width: 100%; border-collapse: collapse; background: #fef3f2; border-radius: 8px; overflow: hidden;">
          ${proposedRows}
        </table>
      </div>

      <!-- Next Steps -->
      <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">
          Next Steps
        </h3>
        <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
          <li style="margin-bottom: 6px;">Review and confirm the above details</li>
          <li style="margin-bottom: 6px;">I'll generate the formal amendment document</li>
          <li style="margin-bottom: 6px;">Electronic signature via DocuSign</li>
          <li>Changes effective within 24 hours of signature</li>
        </ol>
      </div>

      ${customMessage ? `
      <!-- Custom Message -->
      <div style="padding: 0 24px 24px;">
        <p style="margin: 0; color: #374151; font-size: 14px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
          ${customMessage}
        </p>
      </div>
      ` : ''}
    </div>

    <!-- Closing -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">
        Please let me know if you have any questions or if anything needs adjustment.
      </p>
      <p style="color: #374151; margin: 24px 0 8px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        This amendment request was generated by ${companyName}'s Customer Success platform.
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
export function generateAmendmentRequestEmail(variables: AmendmentRequestEmailVariables): {
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

export default generateAmendmentRequestEmail;
