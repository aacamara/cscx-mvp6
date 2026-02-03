/**
 * QBR Follow-up Email Template
 * PRD-026: One-Click QBR Email Generation
 *
 * Generates professional QBR follow-up/summary emails after a QBR meeting
 */

export interface QBRFollowupData {
  customer: {
    name: string;
    arr: number;
    healthScore: number;
  };
  stakeholders: Array<{
    name: string;
    email: string;
    title?: string;
  }>;
  qbr: {
    quarter: string;
    year: number;
    meetingDate: string;
    documentUrl?: string;
    presentationUrl?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
  };
  highlights: string[];
  actionItems: Array<{
    task: string;
    owner: string;
    dueDate?: string;
  }>;
  nextSteps?: string[];
  customMessage?: string;
}

export interface QBRFollowupResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate QBR follow-up email
 */
export function generateQBRFollowupEmail(data: QBRFollowupData): QBRFollowupResult {
  const {
    customer,
    stakeholders,
    qbr,
    csm,
    highlights,
    actionItems,
    nextSteps,
    customMessage,
  } = data;

  // Format stakeholder names for greeting
  const stakeholderNames = stakeholders
    .map(s => s.name.split(' ')[0])
    .slice(0, 3);
  const greeting = stakeholderNames.length > 1
    ? `Hi ${stakeholderNames.slice(0, -1).join(', ')} and ${stakeholderNames.slice(-1)}`
    : `Hi ${stakeholderNames[0] || 'team'}`;

  // Format meeting date
  const meetingDateFormatted = formatDate(qbr.meetingDate);

  // Default next steps if not provided
  const defaultNextSteps = [
    'Review action items and confirm ownership',
    'Schedule follow-up sync in 30 days',
    'Share any additional feedback or questions',
  ];
  const steps = nextSteps && nextSteps.length > 0 ? nextSteps : defaultNextSteps;

  // Document links section
  let documentsSection = '';
  if (qbr.documentUrl || qbr.presentationUrl) {
    const links: string[] = [];
    if (qbr.presentationUrl) {
      links.push(`<li><a href="${qbr.presentationUrl}" style="color: #e63946;">QBR Presentation</a></li>`);
    }
    if (qbr.documentUrl) {
      links.push(`<li><a href="${qbr.documentUrl}" style="color: #e63946;">QBR Summary Document</a></li>`);
    }
    documentsSection = `
<div class="documents" style="background: #f0f7ff; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
  <strong>Resources:</strong>
  <ul style="margin: 10px 0; padding-left: 20px;">
    ${links.join('\n    ')}
  </ul>
</div>
`;
  }

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .section { margin: 20px 0; }
    .highlights { background: #f0fff0; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #28a745; }
    .action-items { background: #fff8e1; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #ffc107; }
    .next-steps { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; }
    ul { margin: 10px 0; padding-left: 20px; }
    li { margin: 8px 0; }
    .highlight { color: #e63946; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">${customer.name} - ${qbr.quarter} ${qbr.year} QBR Summary</h2>
    </div>

    <p>${greeting},</p>

    <p>Thank you for taking the time to meet on ${meetingDateFormatted} for our ${qbr.quarter} ${qbr.year} Quarterly Business Review. I wanted to follow up with a summary of our discussion and next steps.</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    ${documentsSection}

    <div class="section highlights">
      <strong>Key Highlights:</strong>
      <ul>
        ${highlights.map(h => `<li>${h}</li>`).join('\n        ')}
      </ul>
    </div>

    <div class="section action-items">
      <strong>Action Items:</strong>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Owner</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${actionItems.map(item => `
          <tr>
            <td>${item.task}</td>
            <td>${item.owner}</td>
            <td>${item.dueDate || 'TBD'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section next-steps">
      <strong>Next Steps:</strong>
      <ul>
        ${steps.map(s => `<li>${s}</li>`).join('\n        ')}
      </ul>
    </div>

    <p>Please don't hesitate to reach out if you have any questions or if there's anything else I can help with. I'm looking forward to continuing our partnership and achieving great results together!</p>

    <div class="footer">
      <p>Best regards,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}</p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const bodyText = `
${customer.name} - ${qbr.quarter} ${qbr.year} QBR Summary

${greeting},

Thank you for taking the time to meet on ${meetingDateFormatted} for our ${qbr.quarter} ${qbr.year} Quarterly Business Review. I wanted to follow up with a summary of our discussion and next steps.

${customMessage || ''}

${qbr.presentationUrl || qbr.documentUrl ? 'Resources:' : ''}
${qbr.presentationUrl ? `- QBR Presentation: ${qbr.presentationUrl}` : ''}
${qbr.documentUrl ? `- QBR Summary Document: ${qbr.documentUrl}` : ''}

Key Highlights:
${highlights.map(h => `- ${h}`).join('\n')}

Action Items:
${actionItems.map(item => `- ${item.task} (Owner: ${item.owner}, Due: ${item.dueDate || 'TBD'})`).join('\n')}

Next Steps:
${steps.map(s => `- ${s}`).join('\n')}

Please don't hesitate to reach out if you have any questions or if there's anything else I can help with. I'm looking forward to continuing our partnership and achieving great results together!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line
  const subject = `${customer.name} ${qbr.quarter} ${qbr.year} QBR Summary & Action Items`;

  // Recipients
  const recipients = stakeholders.map(s => s.email);

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients,
  };
}

/**
 * Format date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default generateQBRFollowupEmail;
