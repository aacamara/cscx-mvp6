/**
 * Executive Briefing Request Email Template
 * PRD-031: Executive Sponsor Outreach
 *
 * Generates professional briefing request emails for pre-QBR executive alignment
 */

export interface ExecutiveBriefingData {
  customer: {
    name: string;
    arr: number;
    healthScore: number;
    healthTrend: 'improving' | 'stable' | 'declining';
    renewalDate?: string;
    daysToRenewal?: number;
  };
  executive: {
    name: string;
    firstName: string;
    email: string;
    title: string;
    lastContactDate?: string;
    lastContactContext?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
  };
  briefing: {
    type: 'pre_qbr' | 'strategic_alignment' | 'renewal_alignment' | 'executive_sync';
    quarter?: string;
    year?: number;
    proposedDates?: Array<{ date: string; time: string }>;
  };
  highlights: {
    achievements: Array<{ title: string; value: string }>;
    upcomingInitiatives?: string[];
    areasOfFocus?: string[];
  };
  customMessage?: string;
}

export interface ExecutiveBriefingResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  talkingPoints: string[];
  suggestedSendTime: string;
  followUpActions: string[];
}

/**
 * Generate executive briefing request email
 */
export function generateExecutiveBriefingEmail(data: ExecutiveBriefingData): ExecutiveBriefingResult {
  const { customer, executive, csm, briefing, highlights, customMessage } = data;

  // Determine briefing context
  const briefingContext = getBriefingContext(briefing, customer);

  // Format last contact reference
  const lastContactRef = executive.lastContactDate
    ? `Since we last connected${executive.lastContactContext ? ` ${executive.lastContactContext}` : ''}, `
    : '';

  // Build achievements section
  const achievementsHtml = highlights.achievements
    .slice(0, 4)
    .map(a => `<li><strong>${a.title}:</strong> ${a.value}</li>`)
    .join('\n        ');

  // Build upcoming initiatives section
  const initiativesSection = highlights.upcomingInitiatives && highlights.upcomingInitiatives.length > 0
    ? `
    <p><strong>Looking Ahead:</strong></p>
    <ul>
      ${highlights.upcomingInitiatives.map(i => `<li>${i}</li>`).join('\n      ')}
    </ul>
    `
    : '';

  // Build proposed times section
  let timesSection = '';
  if (briefing.proposedDates && briefing.proposedDates.length > 0) {
    const timesList = briefing.proposedDates
      .map(d => `<li>${d.date} at ${d.time}</li>`)
      .join('\n    ');
    timesSection = `
    <p><strong>I have a few times available:</strong></p>
    <ul>
      ${timesList}
    </ul>
    <p>Please let me know which works best, or feel free to suggest an alternative.</p>
    `;
  } else {
    timesSection = `<p>I'm happy to work around your schedule. Please let me know a time that works best for you.</p>`;
  }

  // Renewal urgency note
  const renewalNote = customer.daysToRenewal && customer.daysToRenewal <= 90
    ? `<p><em>Note: With your renewal in ${customer.daysToRenewal} days, this briefing will also help ensure we're aligned on the path forward.</em></p>`
    : '';

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .header h2 { margin: 0; color: #e63946; font-size: 20px; }
    .highlight-box { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
    .highlight-box ul { margin: 10px 0; padding-left: 20px; }
    .highlight-box li { margin: 8px 0; }
    .accent { color: #e63946; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .note { font-size: 14px; color: #666; font-style: italic; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${briefingContext.title}</h2>
    </div>

    <p>${executive.firstName},</p>

    <p>${briefingContext.opening}</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="highlight-box">
      <strong>${lastContactRef}Key Highlights:</strong>
      <ul>
        ${achievementsHtml}
      </ul>
    </div>

    ${initiativesSection}

    <p>${briefingContext.ask}</p>

    ${timesSection}

    ${renewalNote}

    <p>Looking forward to connecting!</p>

    <div class="footer">
      <p>Best regards,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}${csm.phone ? `<br/>${csm.phone}` : ''}</p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const achievementsText = highlights.achievements
    .slice(0, 4)
    .map(a => `- ${a.title}: ${a.value}`)
    .join('\n');

  const initiativesText = highlights.upcomingInitiatives && highlights.upcomingInitiatives.length > 0
    ? `\nLooking Ahead:\n${highlights.upcomingInitiatives.map(i => `- ${i}`).join('\n')}\n`
    : '';

  const timesText = briefing.proposedDates && briefing.proposedDates.length > 0
    ? `I have a few times available:\n${briefing.proposedDates.map(d => `- ${d.date} at ${d.time}`).join('\n')}\n\nPlease let me know which works best, or feel free to suggest an alternative.`
    : `I'm happy to work around your schedule. Please let me know a time that works best for you.`;

  const renewalTextNote = customer.daysToRenewal && customer.daysToRenewal <= 90
    ? `\nNote: With your renewal in ${customer.daysToRenewal} days, this briefing will also help ensure we're aligned on the path forward.\n`
    : '';

  const bodyText = `
${briefingContext.title}

${executive.firstName},

${briefingContext.opening}

${customMessage || ''}

${lastContactRef}Key Highlights:
${achievementsText}

${initiativesText}

${briefingContext.ask}

${timesText}

${renewalTextNote}

Looking forward to connecting!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}${csm.phone ? `\n${csm.phone}` : ''}
`.trim();

  // Subject line
  const subject = briefingContext.subject;

  // Talking points for the CSM
  const talkingPoints = [
    'Review partnership achievements and ROI delivered',
    'Understand executive priorities for the upcoming period',
    'Align on strategic initiatives and how our platform supports them',
    customer.daysToRenewal && customer.daysToRenewal <= 90 ? 'Discuss renewal and expansion opportunities' : 'Identify growth opportunities',
    'Confirm executive engagement cadence preferences',
  ];

  // Follow-up actions
  const followUpActions = [
    'Prepare executive summary deck with key metrics',
    'Review account plan and strategic objectives',
    'Coordinate with internal stakeholders on any pending items',
    'Send calendar invite upon confirmation',
  ];

  return {
    subject,
    bodyHtml,
    bodyText,
    talkingPoints,
    suggestedSendTime: briefingContext.sendTime,
    followUpActions,
  };
}

/**
 * Get briefing context based on type
 */
function getBriefingContext(
  briefing: ExecutiveBriefingData['briefing'],
  customer: ExecutiveBriefingData['customer']
): {
  title: string;
  subject: string;
  opening: string;
  ask: string;
  sendTime: string;
} {
  const quarterYear = briefing.quarter && briefing.year
    ? `${briefing.quarter} ${briefing.year}`
    : 'upcoming quarter';

  switch (briefing.type) {
    case 'pre_qbr':
      return {
        title: `${customer.name} - Executive Briefing Request`,
        subject: `${customer.name} ${quarterYear} - Executive Alignment`,
        opening: `As we prepare for our ${quarterYear} Quarterly Business Review, I wanted to reach out to ensure we're aligned on ${customer.name}'s strategic priorities and can make the most of our upcoming review session.`,
        ask: `I'd appreciate 20 minutes of your time ahead of the QBR to share some highlights and ensure we're focused on what matters most to you.`,
        sendTime: 'Two weeks before QBR, Tuesday morning',
      };

    case 'renewal_alignment':
      return {
        title: `${customer.name} - Partnership Alignment`,
        subject: `${customer.name} Partnership - Strategic Discussion`,
        opening: `With ${customer.name}'s renewal approaching${customer.renewalDate ? ` on ${formatDate(customer.renewalDate)}` : ''}, I wanted to connect to discuss the value we've delivered and ensure our partnership continues to support your strategic goals.`,
        ask: `Would you have 20-30 minutes to discuss how we can continue building on our partnership's success?`,
        sendTime: '60-90 days before renewal, Tuesday or Wednesday morning',
      };

    case 'strategic_alignment':
      return {
        title: `${customer.name} - Strategic Partnership Discussion`,
        subject: `${customer.name} - Strategic Alignment Opportunity`,
        opening: `I'm reaching out to propose a strategic alignment conversation to ensure our partnership continues to deliver maximum value for ${customer.name}.`,
        ask: `Would you have time for a brief strategic discussion? I'd love to understand your priorities and share how we can better support your initiatives.`,
        sendTime: 'Tuesday or Wednesday, early morning',
      };

    case 'executive_sync':
    default:
      return {
        title: `${customer.name} - Executive Update`,
        subject: `${customer.name} Partnership Update`,
        opening: `I wanted to reach out with an update on our partnership and ensure we're continuing to align with ${customer.name}'s evolving priorities.`,
        ask: `Would you have 20 minutes for a quick sync? I'd like to share some recent highlights and hear your perspective on priorities for the period ahead.`,
        sendTime: 'Tuesday or Wednesday morning',
      };
  }
}

/**
 * Format date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default generateExecutiveBriefingEmail;
