/**
 * QBR Invitation Email Template
 * PRD-026: One-Click QBR Email Generation
 *
 * Generates professional QBR invitation emails with customer-specific data
 */

export interface QBRInviteData {
  customer: {
    name: string;
    arr: number;
    healthScore: number;
    healthTrend: 'improving' | 'stable' | 'declining';
  };
  stakeholders: Array<{
    name: string;
    email: string;
    title?: string;
  }>;
  qbr: {
    quarter: string;
    year: number;
    proposedDates?: Array<{
      date: string;
      time: string;
    }>;
    scheduledDate?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
  };
  agendaItems?: string[];
  customMessage?: string;
}

export interface QBRInviteResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate QBR invitation email
 */
export function generateQBRInviteEmail(data: QBRInviteData): QBRInviteResult {
  const {
    customer,
    stakeholders,
    qbr,
    csm,
    agendaItems,
    customMessage,
  } = data;

  // Format stakeholder names for greeting
  const stakeholderNames = stakeholders
    .map(s => s.name.split(' ')[0])
    .slice(0, 3);
  const greeting = stakeholderNames.length > 1
    ? `Hi ${stakeholderNames.slice(0, -1).join(', ')} and ${stakeholderNames.slice(-1)}`
    : `Hi ${stakeholderNames[0] || 'there'}`;

  // Format ARR
  const arrFormatted = customer.arr >= 1000000
    ? `$${(customer.arr / 1000000).toFixed(1)}M`
    : `$${(customer.arr / 1000).toFixed(0)}K`;

  // Health status description
  const healthDescription = getHealthDescription(customer.healthScore, customer.healthTrend);

  // Default agenda items if not provided
  const defaultAgenda = [
    `Platform performance review (${customer.healthScore} health score, ${customer.healthTrend} trend)`,
    'Usage highlights and adoption metrics',
    'Roadmap preview for upcoming features',
    `Strategic alignment for H1 ${qbr.year}`,
  ];
  const agenda = agendaItems && agendaItems.length > 0 ? agendaItems : defaultAgenda;

  // Proposed times section
  let timesSection = '';
  if (qbr.scheduledDate) {
    timesSection = `
<p><strong>Scheduled Date:</strong> ${formatDate(qbr.scheduledDate)}</p>
`;
  } else if (qbr.proposedDates && qbr.proposedDates.length > 0) {
    const timesList = qbr.proposedDates
      .map(d => `<li>${d.date} at ${d.time}</li>`)
      .join('\n');
    timesSection = `
<p><strong>Suggested Times:</strong></p>
<ul>
${timesList}
</ul>
<p>Please let me know which time works best, or suggest alternatives.</p>
`;
  } else {
    timesSection = `
<p>Please let me know your availability in the coming weeks so we can find a time that works for everyone.</p>
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
    .agenda { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
    .agenda ul { margin: 10px 0; padding-left: 20px; }
    .agenda li { margin: 8px 0; }
    .highlight { color: #e63946; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">${customer.name} - ${qbr.quarter} ${qbr.year} Quarterly Business Review</h2>
    </div>

    <p>${greeting},</p>

    <p>I hope this message finds you well! As we approach the end of the current quarter, I wanted to reach out about scheduling our <strong>${qbr.quarter} ${qbr.year} Quarterly Business Review</strong>.</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="agenda">
      <strong>Proposed Agenda:</strong>
      <ul>
        ${agenda.map(item => `<li>${item}</li>`).join('\n        ')}
      </ul>
    </div>

    ${timesSection}

    <p>This QBR will be an opportunity to review ${customer.name}'s progress (${healthDescription}), discuss any challenges, and align on strategic priorities for the upcoming quarter.</p>

    <p>Looking forward to connecting!</p>

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
${customer.name} - ${qbr.quarter} ${qbr.year} Quarterly Business Review

${greeting},

I hope this message finds you well! As we approach the end of the current quarter, I wanted to reach out about scheduling our ${qbr.quarter} ${qbr.year} Quarterly Business Review.

${customMessage || ''}

Proposed Agenda:
${agenda.map(item => `- ${item}`).join('\n')}

${qbr.scheduledDate
  ? `Scheduled Date: ${formatDate(qbr.scheduledDate)}`
  : qbr.proposedDates && qbr.proposedDates.length > 0
    ? `Suggested Times:\n${qbr.proposedDates.map(d => `- ${d.date} at ${d.time}`).join('\n')}\n\nPlease let me know which time works best, or suggest alternatives.`
    : 'Please let me know your availability in the coming weeks so we can find a time that works for everyone.'
}

This QBR will be an opportunity to review ${customer.name}'s progress (${healthDescription}), discuss any challenges, and align on strategic priorities for the upcoming quarter.

Looking forward to connecting!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line
  const subject = `${customer.name} ${qbr.quarter} ${qbr.year} Quarterly Business Review - Let's Schedule`;

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
 * Get health description based on score and trend
 */
function getHealthDescription(score: number, trend: string): string {
  let status = '';
  if (score >= 80) {
    status = 'strong health';
  } else if (score >= 60) {
    status = 'healthy';
  } else if (score >= 40) {
    status = 'needs attention';
  } else {
    status = 'requires focus';
  }

  return `${score} health score, ${trend}`;
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
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default generateQBRInviteEmail;
