/**
 * Thank You - Case Study Template
 * PRD-035: Thank You Note Generator
 *
 * Template for thanking customers who participated in a case study or agreed to be a reference
 */

export interface ThankYouCaseStudyVariables {
  recipientName: string;
  customerName: string;
  caseStudyTitle?: string;
  participationType: 'case_study' | 'reference' | 'speaking_event' | 'webinar' | 'podcast';
  eventName?: string;
  eventDate?: string;
  publishDate?: string;
  caseStudyUrl?: string;
  keyMetricsHighlighted?: string[];
  audienceReach?: string; // e.g., "5,000+ marketing professionals"
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
  gestureOptions?: Array<{
    id: string;
    label: string;
  }>;
}

/**
 * Generate the subject line for a case study thank you email
 */
export function generateSubject(variables: ThankYouCaseStudyVariables): string {
  const { participationType, recipientName, eventName, caseStudyTitle } = variables;

  switch (participationType) {
    case 'speaking_event':
      return `Thank You for Speaking at ${eventName || 'Our Event'}, ${recipientName}!`;
    case 'webinar':
      return `Thank You for Joining Our Webinar, ${recipientName}!`;
    case 'podcast':
      return `Thank You for Being on Our Podcast, ${recipientName}!`;
    case 'reference':
      return `Thank You for Being a Reference, ${recipientName}`;
    default:
      return `Thank You for Sharing Your Story, ${recipientName}`;
  }
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ThankYouCaseStudyVariables): string {
  const {
    recipientName,
    customerName,
    caseStudyTitle,
    participationType,
    eventName,
    eventDate,
    publishDate,
    caseStudyUrl,
    keyMetricsHighlighted,
    audienceReach,
    csmName = 'Your Customer Success Team',
    gestureOptions,
  } = variables;

  let openingText = '';
  switch (participationType) {
    case 'speaking_event':
      openingText = `Thank you so much for speaking at ${eventName || 'our event'}${eventDate ? ` on ${eventDate}` : ''}. Your insights were invaluable, and the audience was truly engaged.`;
      break;
    case 'webinar':
      openingText = `Thank you for being part of our webinar${eventName ? ` "${eventName}"` : ''}${eventDate ? ` on ${eventDate}` : ''}. Your perspective added so much value to the discussion.`;
      break;
    case 'podcast':
      openingText = `Thank you for joining us on our podcast${eventName ? ` for "${eventName}"` : ''}. Your story and insights will resonate with our listeners.`;
      break;
    case 'reference':
      openingText = `Thank you for agreeing to be a reference for us. Your willingness to share your experience with potential customers means the world to our team.`;
      break;
    default:
      openingText = `Thank you for participating in our case study${caseStudyTitle ? ` "${caseStudyTitle}"` : ''}. Sharing your success story helps others see what's possible.`;
  }

  const metricsText = keyMetricsHighlighted && keyMetricsHighlighted.length > 0
    ? `

The results you've achieved are impressive:
${keyMetricsHighlighted.map(m => `- ${m}`).join('\n')}`
    : '';

  const reachText = audienceReach
    ? `

Your story will reach ${audienceReach}, inspiring others in their journey.`
    : '';

  const linkText = caseStudyUrl
    ? `

You can view the final piece here: ${caseStudyUrl}`
    : '';

  const gestureText = gestureOptions && gestureOptions.length > 0
    ? `

As a thank you for your time and advocacy, I'd like to offer you:
${gestureOptions.map(g => `- ${g.label}`).join('\n')}

Let me know which you'd prefer!`
    : '';

  return `Hi ${recipientName},

${openingText}
${metricsText}
${reachText}
${linkText}

Your partnership and willingness to share your experience is truly appreciated. Stories like yours from ${customerName} help build trust and inspire confidence in our community.
${gestureText}

Thank you for being such an incredible advocate.

With gratitude,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ThankYouCaseStudyVariables): string {
  const {
    recipientName,
    customerName,
    caseStudyTitle,
    participationType,
    eventName,
    eventDate,
    publishDate,
    caseStudyUrl,
    keyMetricsHighlighted,
    audienceReach,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
    gestureOptions,
  } = variables;

  let headerEmoji = '📖';
  let headerText = 'Thank You for Sharing Your Story!';

  switch (participationType) {
    case 'speaking_event':
      headerEmoji = '🎤';
      headerText = 'Thank You for Speaking!';
      break;
    case 'webinar':
      headerEmoji = '🖥️';
      headerText = 'Thank You for the Webinar!';
      break;
    case 'podcast':
      headerEmoji = '🎙️';
      headerText = 'Thank You for the Podcast!';
      break;
    case 'reference':
      headerEmoji = '🤝';
      headerText = 'Thank You for Being a Reference!';
      break;
  }

  let openingText = '';
  switch (participationType) {
    case 'speaking_event':
      openingText = `Thank you so much for speaking at <strong>${eventName || 'our event'}</strong>${eventDate ? ` on ${eventDate}` : ''}. Your insights were invaluable, and the audience was truly engaged.`;
      break;
    case 'webinar':
      openingText = `Thank you for being part of our webinar${eventName ? ` "<strong>${eventName}</strong>"` : ''}${eventDate ? ` on ${eventDate}` : ''}. Your perspective added so much value to the discussion.`;
      break;
    case 'podcast':
      openingText = `Thank you for joining us on our podcast${eventName ? ` for "<strong>${eventName}</strong>"` : ''}. Your story and insights will resonate with our listeners.`;
      break;
    case 'reference':
      openingText = `Thank you for agreeing to be a reference for us. Your willingness to share your experience with potential customers means the world to our team.`;
      break;
    default:
      openingText = `Thank you for participating in our case study${caseStudyTitle ? ` "<strong>${caseStudyTitle}</strong>"` : ''}. Sharing your success story helps others see what's possible.`;
  }

  const metricsHtml = keyMetricsHighlighted && keyMetricsHighlighted.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background: #dcfce7; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
          Your Impressive Results
        </h3>
        <ul style="margin: 0; padding-left: 20px; color: #15803d;">
          ${keyMetricsHighlighted.map(m => `<li style="margin-bottom: 8px; font-weight: 500;">${m}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const reachHtml = audienceReach
    ? `
      <div style="text-align: center; margin: 24px 0; padding: 16px; background: #dbeafe; border-radius: 8px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          Your story will reach <strong>${audienceReach}</strong>, inspiring others in their journey.
        </p>
      </div>
    `
    : '';

  const ctaHtml = caseStudyUrl
    ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${caseStudyUrl}" style="display: inline-block; background: #e63946; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Your Story
        </a>
      </div>
    `
    : '';

  const gestureHtml = gestureOptions && gestureOptions.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #92400e;">
          As a thank you for your time and advocacy:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #78350f;">
          ${gestureOptions.map(g => `<li style="margin-bottom: 8px;">${g.label}</li>`).join('')}
        </ul>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #92400e;">
          Let me know which you'd prefer!
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
  <title>Thank You for Your Participation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 48px; margin-bottom: 16px;">${headerEmoji}</div>
      <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0;">
        ${headerText}
      </h1>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
      <!-- Greeting -->
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px 0; font-size: 18px;">Hi ${recipientName},</p>

        <p style="margin: 0 0 16px 0; color: #374151;">
          ${openingText}
        </p>

        ${metricsHtml}

        ${reachHtml}

        ${ctaHtml}

        <p style="margin: 16px 0; color: #374151;">
          Your partnership and willingness to share your experience is truly appreciated. Stories like yours from <strong>${customerName}</strong> help build trust and inspire confidence in our community.
        </p>

        ${gestureHtml}

        <p style="margin: 24px 0 0 0; color: #374151;">
          Thank you for being such an incredible advocate.
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">With gratitude,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        Thank you for being a champion of success stories
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
export function generateThankYouCaseStudyEmail(variables: ThankYouCaseStudyVariables): {
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
 * Default gesture options for case study/advocacy thank you
 */
export const DEFAULT_ADVOCACY_GESTURES = [
  { id: 'premium_support', label: 'Priority access to our support team for 3 months' },
  { id: 'swag_box', label: 'An exclusive branded swag box shipped to your office' },
  { id: 'gift_card', label: 'A $100 gift card to a restaurant of your choice' },
  { id: 'charity_donation', label: 'A $100 donation to a charity of your choice in your name' },
];
