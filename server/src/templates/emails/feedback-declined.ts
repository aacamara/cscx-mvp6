/**
 * Feedback Declined Follow-Up Email Template
 * PRD-053: Product Feedback Follow-Up
 *
 * Used when customer feedback cannot be implemented.
 * Explains reasoning transparently and offers alternatives.
 */

export interface FeedbackDeclinedVariables {
  // Customer info
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;

  // CSM info
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  csmCalendarUrl?: string;

  // Original feedback context
  originalFeedback: {
    summary: string;
    submittedDate: string;
    source?: string;
  };

  // Decision context
  featureDescription: string;
  declineReason: 'strategic_fit' | 'technical_constraints' | 'resource_priority' | 'alternative_exists' | 'duplicate' | 'other';
  explanation: string;

  // Alternatives or workarounds
  alternatives?: Array<{
    title: string;
    description: string;
    documentationUrl?: string;
  }>;

  // Future consideration
  futureConsideration?: {
    possible: boolean;
    conditions?: string; // 'If we see more demand...'
  };

  // Appreciation
  appreciationNote?: string;

  // Follow-up options
  feedbackChannel?: {
    label: string;
    url?: string;
  };
}

export interface FeedbackDeclinedResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const reasonLabels: Record<string, string> = {
  strategic_fit: 'Strategic Direction',
  technical_constraints: 'Technical Considerations',
  resource_priority: 'Current Priorities',
  alternative_exists: 'Existing Solution',
  duplicate: 'Similar Feature Exists',
  other: 'Product Decision',
};

export function generateFeedbackDeclinedEmail(variables: FeedbackDeclinedVariables): FeedbackDeclinedResult {
  const {
    customerName,
    contactName,
    csmName,
    csmTitle = 'Customer Success Manager',
    csmEmail,
    csmCalendarUrl,
    originalFeedback,
    featureDescription,
    declineReason,
    explanation,
    alternatives,
    futureConsideration,
    appreciationNote,
    feedbackChannel,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const reasonLabel = reasonLabels[declineReason] || reasonLabels.other;

  const subject = `Update on Your Product Feedback - ${customerName}`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #607d8b 0%, #455a64 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0 0 10px 0; font-size: 24px; }
    .header .icon { font-size: 48px; margin-bottom: 15px; }
    .header .tagline { color: rgba(255,255,255,0.9); font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .feedback-context { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9e9e9e; }
    .feedback-context .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .feedback-context .quote { font-style: italic; color: #555; margin: 0; }
    .feedback-context .meta { font-size: 12px; color: #888; margin-top: 10px; }
    .decision-box { background: #fafafa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0; }
    .decision-box .reason-badge { display: inline-block; background: #607d8b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    .decision-box h4 { margin: 0 0 10px 0; color: #333; }
    .decision-box p { margin: 0; color: #555; }
    .explanation-box { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
    .alternatives-section { margin: 25px 0; }
    .alternatives-section h4 { color: #1565c0; margin-bottom: 15px; }
    .alternative-card { background: #e3f2fd; padding: 18px; border-radius: 8px; margin: 12px 0; }
    .alternative-card h5 { margin: 0 0 8px 0; color: #1565c0; }
    .alternative-card p { margin: 0; font-size: 14px; color: #555; }
    .alternative-card a { display: inline-block; margin-top: 10px; color: #e63946; text-decoration: none; font-weight: 600; font-size: 13px; }
    .future-box { background: #e8f5e9; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
    .appreciation-box { background: #fffde7; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .feedback-cta { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .feedback-cta p { margin: 0 0 15px 0; color: #666; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 600; }
    .cta-button:hover { background: #c5303c; }
    .cta-secondary { background: #607d8b; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">💬</div>
      <h1>Update on Your Feedback</h1>
      <p class="tagline">Thank you for sharing your ideas with us</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I wanted to personally follow up on some feedback you shared with us. First and foremost, thank you for taking the time to share your thoughts - this kind of input is invaluable in helping us understand how ${customerName} uses our product.</p>

      <div class="feedback-context">
        <div class="label">Your Feedback</div>
        <p class="quote">"${originalFeedback.summary}"</p>
        <div class="meta">Submitted ${originalFeedback.submittedDate}${originalFeedback.source ? ` during ${originalFeedback.source}` : ''}</div>
      </div>

      <div class="decision-box">
        <span class="reason-badge">${reasonLabel}</span>
        <h4>${featureDescription}</h4>
        <p>After careful consideration, our product team has decided not to pursue this at this time.</p>
      </div>

      <div class="explanation-box">
        <strong>Here's our thinking:</strong>
        <p style="margin: 10px 0 0 0;">${explanation}</p>
      </div>

      ${alternatives && alternatives.length > 0 ? `
      <div class="alternatives-section">
        <h4>Alternative Approaches You Might Find Helpful:</h4>
        ${alternatives.map(alt => `
        <div class="alternative-card">
          <h5>${alt.title}</h5>
          <p>${alt.description}</p>
          ${alt.documentationUrl ? `<a href="${alt.documentationUrl}">Learn more &rarr;</a>` : ''}
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${futureConsideration?.possible ? `
      <div class="future-box">
        <strong>Looking Ahead:</strong>
        <p style="margin: 8px 0 0 0;">${futureConsideration.conditions || "While we can't commit to this now, we're always reevaluating our roadmap. If circumstances change, we'll revisit this request."}</p>
      </div>
      ` : ''}

      ${appreciationNote ? `
      <div class="appreciation-box">
        ${appreciationNote}
      </div>
      ` : `
      <div class="appreciation-box">
        I want to emphasize how much we value ${customerName}'s partnership and your willingness to share ideas with us. Even when we can't implement every suggestion, this kind of feedback helps us understand what matters most to our customers and informs our long-term direction.
      </div>
      `}

      <p>Please don't let this discourage you from sharing future ideas. Some of our best features have come from customer conversations, and we always want to hear what would make the product more valuable for ${customerName}.</p>

      ${feedbackChannel ? `
      <div class="feedback-cta">
        <p>Have more ideas or want to discuss alternatives?</p>
        ${feedbackChannel.url ? `<a href="${feedbackChannel.url}" class="cta-button cta-secondary">${feedbackChannel.label}</a>` : `<p><strong>${feedbackChannel.label}</strong></p>`}
      </div>
      ` : ''}

      ${csmCalendarUrl ? `
      <div style="margin: 25px 0;">
        <a href="${csmCalendarUrl}" class="cta-button">Let's Discuss Alternatives</a>
      </div>
      ` : ''}

      <p>Thank you again for your partnership and continued feedback.</p>

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>We believe in transparent communication about product decisions. Your feedback always matters.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
UPDATE ON YOUR FEEDBACK
Thank you for sharing your ideas with us

Hi ${firstName},

I wanted to personally follow up on some feedback you shared with us. First and foremost, thank you for taking the time to share your thoughts - this kind of input is invaluable in helping us understand how ${customerName} uses our product.

YOUR FEEDBACK:
"${originalFeedback.summary}"
Submitted ${originalFeedback.submittedDate}${originalFeedback.source ? ` during ${originalFeedback.source}` : ''}

DECISION: ${reasonLabel}
${featureDescription}
After careful consideration, our product team has decided not to pursue this at this time.

HERE'S OUR THINKING:
${explanation}

${alternatives && alternatives.length > 0 ? `
ALTERNATIVE APPROACHES YOU MIGHT FIND HELPFUL:
${alternatives.map(alt => `
* ${alt.title}
  ${alt.description}
  ${alt.documentationUrl ? `Learn more: ${alt.documentationUrl}` : ''}
`).join('\n')}
` : ''}

${futureConsideration?.possible ? `
LOOKING AHEAD:
${futureConsideration.conditions || "While we can't commit to this now, we're always reevaluating our roadmap. If circumstances change, we'll revisit this request."}
` : ''}

${appreciationNote || `I want to emphasize how much we value ${customerName}'s partnership and your willingness to share ideas with us. Even when we can't implement every suggestion, this kind of feedback helps us understand what matters most to our customers and informs our long-term direction.`}

Please don't let this discourage you from sharing future ideas. Some of our best features have come from customer conversations, and we always want to hear what would make the product more valuable for ${customerName}.

${feedbackChannel ? `\n${feedbackChannel.label}${feedbackChannel.url ? `: ${feedbackChannel.url}` : ''}\n` : ''}

${csmCalendarUrl ? `Let's discuss alternatives: ${csmCalendarUrl}\n` : ''}

Thank you again for your partnership and continued feedback.

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
We believe in transparent communication about product decisions. Your feedback always matters.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateFeedbackDeclinedEmail;
