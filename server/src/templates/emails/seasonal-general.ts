/**
 * Seasonal General Greeting Template
 * PRD-054: Seasonal/Holiday Outreach
 *
 * Generic seasonal template for various occasions (seasons, company anniversaries, etc.)
 * Culturally neutral and flexible for any time of year
 */

export type SeasonalOccasion =
  | 'spring'
  | 'summer'
  | 'fall'
  | 'winter'
  | 'company_anniversary'
  | 'partnership_milestone'
  | 'seasons_greetings'
  | 'custom';

export interface GeneralSeasonalVariables {
  recipientName: string;
  customerName: string;
  occasion: SeasonalOccasion;
  customOccasionTitle?: string; // For 'custom' occasion
  yearsAsPartner?: number;
  milestoneDetails?: string; // For anniversaries/milestones
  partnershipHighlights?: string[];
  lookingForward?: string; // What you're excited about for the future
  personalNote?: string;
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Get occasion-specific details
 */
function getOccasionDetails(occasion: SeasonalOccasion, customTitle?: string): {
  title: string;
  emoji: string;
  greeting: string;
  colors: { primary: string; secondary: string; accent: string };
} {
  const occasions: Record<SeasonalOccasion, ReturnType<typeof getOccasionDetails>> = {
    spring: {
      title: 'Spring Greetings',
      emoji: '🌸',
      greeting: 'As spring brings new beginnings and fresh energy',
      colors: { primary: '#059669', secondary: '#d1fae5', accent: '#10b981' },
    },
    summer: {
      title: 'Summer Wishes',
      emoji: '☀️',
      greeting: 'As summer brings warmth and longer days',
      colors: { primary: '#d97706', secondary: '#fef3c7', accent: '#f59e0b' },
    },
    fall: {
      title: 'Autumn Greetings',
      emoji: '🍂',
      greeting: 'As fall brings reflection and preparation for the year ahead',
      colors: { primary: '#b45309', secondary: '#fed7aa', accent: '#ea580c' },
    },
    winter: {
      title: 'Winter Wishes',
      emoji: '❄️',
      greeting: 'As winter brings a time for reflection and warmth',
      colors: { primary: '#1e40af', secondary: '#dbeafe', accent: '#3b82f6' },
    },
    company_anniversary: {
      title: 'Happy Anniversary',
      emoji: '🎂',
      greeting: 'Celebrating another year of success',
      colors: { primary: '#7c3aed', secondary: '#ede9fe', accent: '#8b5cf6' },
    },
    partnership_milestone: {
      title: 'Celebrating Our Partnership',
      emoji: '🤝',
      greeting: 'Marking this special milestone in our journey together',
      colors: { primary: '#0891b2', secondary: '#cffafe', accent: '#06b6d4' },
    },
    seasons_greetings: {
      title: "Season's Greetings",
      emoji: '✨',
      greeting: 'Wishing you well during this special time of year',
      colors: { primary: '#166534', secondary: '#dcfce7', accent: '#22c55e' },
    },
    custom: {
      title: customTitle || 'Warm Wishes',
      emoji: '💫',
      greeting: 'Reaching out to share warm wishes',
      colors: { primary: '#4f46e5', secondary: '#e0e7ff', accent: '#6366f1' },
    },
  };

  return occasions[occasion];
}

/**
 * Generate the subject line for a general seasonal greeting
 */
export function generateSubject(variables: GeneralSeasonalVariables): string {
  const details = getOccasionDetails(variables.occasion, variables.customOccasionTitle);
  return `${details.title} from ${variables.csmName || 'Your Customer Success Team'}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: GeneralSeasonalVariables): string {
  const {
    recipientName,
    customerName,
    occasion,
    yearsAsPartner,
    milestoneDetails,
    partnershipHighlights,
    lookingForward,
    personalNote,
    csmName = 'Your Customer Success Team',
  } = variables;

  const details = getOccasionDetails(occasion, variables.customOccasionTitle);

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `Our ${yearsAsPartner}-year partnership has been filled with growth and shared success.`
    : `Our partnership continues to be a source of professional fulfillment.`;

  const milestoneText = milestoneDetails
    ? `\n\n${milestoneDetails}`
    : '';

  const highlightsText = partnershipHighlights && partnershipHighlights.length > 0
    ? `\n\nSome highlights from our partnership:\n${partnershipHighlights.map(h => `  - ${h}`).join('\n')}`
    : '';

  const lookingForwardText = lookingForward
    ? `\n\nLooking ahead: ${lookingForward}`
    : '';

  const personalText = personalNote
    ? `\n\n${personalNote}`
    : '';

  return `Hi ${recipientName},

${details.greeting}, I wanted to reach out and share some warm wishes with you and the ${customerName} team.

${partnershipText}${milestoneText}${highlightsText}

Working with you continues to be a highlight. Thank you for your trust, collaboration, and the opportunity to support ${customerName}'s success.${lookingForwardText}${personalText}

Wishing you all the best,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: GeneralSeasonalVariables): string {
  const {
    recipientName,
    customerName,
    occasion,
    yearsAsPartner,
    milestoneDetails,
    partnershipHighlights,
    lookingForward,
    personalNote,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  const details = getOccasionDetails(occasion, variables.customOccasionTitle);

  const partnershipText = yearsAsPartner && yearsAsPartner > 0
    ? `Our <strong>${yearsAsPartner}-year partnership</strong> has been filled with growth and shared success.`
    : `Our partnership continues to be a source of professional fulfillment.`;

  const milestoneHtml = milestoneDetails
    ? `
      <div style="margin: 20px 0; padding: 16px; background: ${details.colors.secondary}; border-radius: 12px; border-left: 4px solid ${details.colors.accent};">
        <p style="margin: 0; color: ${details.colors.primary};">
          ${milestoneDetails}
        </p>
      </div>
    `
    : '';

  const highlightsHtml = partnershipHighlights && partnershipHighlights.length > 0
    ? `
      <div style="margin: 24px 0;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: ${details.colors.primary};">Partnership Highlights:</p>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          ${partnershipHighlights.map(h => `<li style="margin-bottom: 8px;">${h}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const lookingForwardHtml = lookingForward
    ? `
      <div style="margin: 20px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0; color: #374151;">
          <strong>Looking ahead:</strong> ${lookingForward}
        </p>
      </div>
    `
    : '';

  const personalHtml = personalNote
    ? `<p style="margin: 16px 0; color: #374151; font-style: italic;">${personalNote}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${details.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px; padding: 24px; background: linear-gradient(135deg, ${details.colors.secondary} 0%, white 100%); border-radius: 16px; border: 1px solid ${details.colors.accent}20;">
      <div style="font-size: 56px; margin-bottom: 12px;">${details.emoji}</div>
      <h1 style="font-size: 28px; font-weight: 700; color: ${details.colors.primary}; margin: 0 0 8px 0;">
        ${details.title}
      </h1>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${details.greeting}</p>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
      <div style="height: 4px; background: linear-gradient(90deg, ${details.colors.primary}, ${details.colors.accent});"></div>

      <div style="padding: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${details.greeting}, I wanted to reach out and share some warm wishes with you and the <strong>${customerName}</strong> team.
        </p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${partnershipText}
        </p>

        ${milestoneHtml}

        ${highlightsHtml}

        <p style="margin: 16px 0; color: #374151;">
          Working with you continues to be a highlight. Thank you for your trust, collaboration, and the opportunity to support <strong>${customerName}</strong>'s success.
        </p>

        ${lookingForwardHtml}

        ${personalHtml}
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">Wishing you all the best,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        Sent with appreciation from ${companyName}
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
export function generateGeneralSeasonalEmail(variables: GeneralSeasonalVariables): {
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
 * Available seasonal occasions
 */
export const SEASONAL_OCCASIONS: Array<{
  occasion: SeasonalOccasion;
  label: string;
  description: string;
  bestMonths?: number[];
}> = [
  {
    occasion: 'spring',
    label: 'Spring Greetings',
    description: 'Fresh start, new beginnings',
    bestMonths: [3, 4, 5],
  },
  {
    occasion: 'summer',
    label: 'Summer Wishes',
    description: 'Warm seasonal touchpoint',
    bestMonths: [6, 7, 8],
  },
  {
    occasion: 'fall',
    label: 'Autumn Greetings',
    description: 'Reflection and preparation',
    bestMonths: [9, 10, 11],
  },
  {
    occasion: 'winter',
    label: 'Winter Wishes',
    description: 'Cozy seasonal message',
    bestMonths: [12, 1, 2],
  },
  {
    occasion: 'company_anniversary',
    label: 'Company Anniversary',
    description: "Celebrate their company's milestone",
  },
  {
    occasion: 'partnership_milestone',
    label: 'Partnership Milestone',
    description: 'Celebrate years of partnership',
  },
  {
    occasion: 'seasons_greetings',
    label: "Season's Greetings",
    description: 'Culturally neutral holiday message',
    bestMonths: [12],
  },
  {
    occasion: 'custom',
    label: 'Custom Occasion',
    description: 'Any other special occasion',
  },
];
