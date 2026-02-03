/**
 * Thank You - Feedback Template
 * PRD-035: Thank You Note Generator
 *
 * Template for thanking customers who have provided positive feedback or NPS scores
 */

export interface ThankYouFeedbackVariables {
  recipientName: string;
  customerName: string;
  feedbackType: 'nps' | 'review' | 'testimonial' | 'survey' | 'general';
  npsScore?: number;
  feedbackHighlight?: string; // Quote or summary of their feedback
  feedbackDate?: string;
  impactStatement?: string; // How their feedback will be used
  csmName?: string;
  csmTitle?: string;
  companyName?: string;
}

/**
 * Generate the subject line for a feedback thank you email
 */
export function generateSubject(variables: ThankYouFeedbackVariables): string {
  if (variables.feedbackType === 'nps' && variables.npsScore) {
    return `Thank You for Your Feedback, ${variables.recipientName}!`;
  }
  if (variables.feedbackType === 'testimonial') {
    return `${variables.recipientName}, Your Words Mean So Much to Us`;
  }
  return `Thank You for Sharing Your Thoughts, ${variables.recipientName}`;
}

/**
 * Generate plain text email body
 */
export function generatePlainTextBody(variables: ThankYouFeedbackVariables): string {
  const {
    recipientName,
    customerName,
    feedbackType,
    npsScore,
    feedbackHighlight,
    feedbackDate,
    impactStatement,
    csmName = 'Your Customer Success Team',
  } = variables;

  let openingText = '';
  if (feedbackType === 'nps' && npsScore !== undefined) {
    openingText = npsScore >= 9
      ? `Thank you so much for your amazing ${npsScore}/10 NPS score! Hearing that you'd recommend us to others is the greatest compliment we can receive.`
      : npsScore >= 7
      ? `Thank you for taking the time to share your feedback with a ${npsScore}/10 score. We truly appreciate your honest input.`
      : `Thank you for your candid feedback. We take every response seriously and are committed to improving your experience.`;
  } else if (feedbackType === 'testimonial') {
    openingText = 'Thank you for taking the time to share your experience with us. Your words truly inspire our team and help others understand the value we can provide.';
  } else if (feedbackType === 'review') {
    openingText = 'Thank you for writing a review! Your feedback helps other customers make informed decisions and motivates our team to keep improving.';
  } else {
    openingText = 'Thank you for taking the time to share your thoughts with us. Your feedback is incredibly valuable.';
  }

  const highlightText = feedbackHighlight
    ? `

What you shared resonates deeply with our mission:
"${feedbackHighlight}"`
    : '';

  const impactText = impactStatement
    ? `

${impactStatement}`
    : `

Your feedback helps shape our roadmap and ensures we're building features that matter most to customers like ${customerName}.`;

  return `Hi ${recipientName},

${openingText}
${highlightText}
${impactText}

We're grateful to have you as part of our community. If there's ever anything we can do to make your experience even better, please don't hesitate to reach out.

With appreciation,
${csmName}
`.trim();
}

/**
 * Generate HTML email body
 */
export function generateHtmlBody(variables: ThankYouFeedbackVariables): string {
  const {
    recipientName,
    customerName,
    feedbackType,
    npsScore,
    feedbackHighlight,
    feedbackDate,
    impactStatement,
    csmName = 'Your Customer Success Team',
    csmTitle,
    companyName = 'CSCX.AI',
  } = variables;

  let headerEmoji = '💬';
  let headerText = 'Thank You for Your Feedback!';

  if (feedbackType === 'nps' && npsScore !== undefined && npsScore >= 9) {
    headerEmoji = '⭐';
    headerText = 'Thank You, Promoter!';
  } else if (feedbackType === 'testimonial') {
    headerEmoji = '💝';
    headerText = 'Your Words Mean Everything';
  } else if (feedbackType === 'review') {
    headerEmoji = '📝';
    headerText = 'Thank You for Your Review!';
  }

  let openingText = '';
  if (feedbackType === 'nps' && npsScore !== undefined) {
    openingText = npsScore >= 9
      ? `Thank you so much for your amazing <strong>${npsScore}/10</strong> NPS score! Hearing that you'd recommend us to others is the greatest compliment we can receive.`
      : npsScore >= 7
      ? `Thank you for taking the time to share your feedback with a <strong>${npsScore}/10</strong> score. We truly appreciate your honest input.`
      : `Thank you for your candid feedback. We take every response seriously and are committed to improving your experience.`;
  } else if (feedbackType === 'testimonial') {
    openingText = 'Thank you for taking the time to share your experience with us. Your words truly inspire our team and help others understand the value we can provide.';
  } else if (feedbackType === 'review') {
    openingText = 'Thank you for writing a review! Your feedback helps other customers make informed decisions and motivates our team to keep improving.';
  } else {
    openingText = 'Thank you for taking the time to share your thoughts with us. Your feedback is incredibly valuable.';
  }

  const npsVisualHtml = feedbackType === 'nps' && npsScore !== undefined
    ? `
      <div style="text-align: center; margin: 24px 0; padding: 20px; background: ${npsScore >= 9 ? '#dcfce7' : npsScore >= 7 ? '#fef3c7' : '#fee2e2'}; border-radius: 12px;">
        <div style="font-size: 48px; font-weight: 700; color: ${npsScore >= 9 ? '#166534' : npsScore >= 7 ? '#92400e' : '#991b1b'};">${npsScore}</div>
        <div style="font-size: 14px; color: ${npsScore >= 9 ? '#15803d' : npsScore >= 7 ? '#78350f' : '#b91c1c'}; font-weight: 500;">out of 10</div>
      </div>
    `
    : '';

  const highlightHtml = feedbackHighlight
    ? `
      <div style="margin: 24px 0; padding: 20px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #e63946;">
        <p style="margin: 0; font-style: italic; color: #374151; font-size: 16px;">
          "${feedbackHighlight}"
        </p>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280;">
          - You, on ${feedbackDate || 'recently'}
        </p>
      </div>
    `
    : '';

  const impactText = impactStatement
    ? impactStatement
    : `Your feedback helps shape our roadmap and ensures we're building features that matter most to customers like <strong>${customerName}</strong>.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Your Feedback</title>
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

        ${npsVisualHtml}

        ${highlightHtml}

        <p style="margin: 16px 0; color: #374151;">
          ${impactText}
        </p>

        <p style="margin: 24px 0 0 0; color: #374151;">
          We're grateful to have you as part of our community. If there's ever anything we can do to make your experience even better, please don't hesitate to reach out.
        </p>
      </div>
    </div>

    <!-- Signature -->
    <div style="margin-top: 24px; padding: 0 8px;">
      <p style="color: #374151; margin: 0 0 8px 0;">With appreciation,</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${csmName}</p>
      ${csmTitle ? `<p style="margin: 0; font-size: 14px; color: #6b7280;">${csmTitle}</p>` : ''}
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${companyName}</p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; text-align: center; font-size: 12px; color: #9ca3af;">
      <p style="margin: 0;">
        Every voice matters. Thank you for sharing yours.
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
export function generateThankYouFeedbackEmail(variables: ThankYouFeedbackVariables): {
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
