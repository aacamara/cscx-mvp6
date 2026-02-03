/**
 * Win-Back Day 21 Email Template - Social Proof
 * Fourth email in the win-back campaign sequence
 * Purpose: Share case study of successful return, ROI metrics
 * PRD-030: Win-Back Campaign Generator
 */

export interface WinbackDay21Variables {
  customerName: string;
  contactName: string;
  csmName: string;
  csmEmail: string;
  productName?: string;
  caseStudy?: {
    companyName: string;
    industry: string;
    situation: string;
    result: string;
    quote?: {
      text: string;
      author: string;
      title: string;
    };
    metrics?: Array<{ label: string; value: string }>;
  };
  specialOffer?: {
    title: string;
    description: string;
    validUntil?: string;
    discountPercentage?: number;
  };
}

export function generateWinbackDay21Email(variables: WinbackDay21Variables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    productName = 'our platform',
    caseStudy,
    specialOffer,
  } = variables;

  const firstName = contactName.split(' ')[0];

  const subject = caseStudy
    ? `How ${caseStudy.companyName} came back and grew 2x`
    : `A story about second chances with ${productName}`;

  const caseStudySection = caseStudy
    ? `
      <div class="case-study">
        <div class="case-study-header">
          <span class="industry-tag">${caseStudy.industry}</span>
          <h3>${caseStudy.companyName}'s Story</h3>
        </div>

        <div class="situation">
          <h4>The Situation</h4>
          <p>${caseStudy.situation}</p>
        </div>

        <div class="result">
          <h4>The Result</h4>
          <p>${caseStudy.result}</p>
        </div>

        ${caseStudy.metrics && caseStudy.metrics.length > 0 ? `
        <div class="metrics">
          ${caseStudy.metrics.map(m => `
            <div class="metric">
              <div class="metric-value">${m.value}</div>
              <div class="metric-label">${m.label}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${caseStudy.quote ? `
        <div class="quote">
          <blockquote>"${caseStudy.quote.text}"</blockquote>
          <cite>- ${caseStudy.quote.author}, ${caseStudy.quote.title}</cite>
        </div>
        ` : ''}
      </div>
    `
    : `
      <div class="case-study-placeholder">
        <p>Many of our most successful customers today are ones who took a break and came back. They often tell us that stepping away gave them perspective on how much value we actually provided.</p>
      </div>
    `;

  const caseStudyText = caseStudy
    ? `
${caseStudy.companyName}'S STORY (${caseStudy.industry})
${'='.repeat(40)}

THE SITUATION:
${caseStudy.situation}

THE RESULT:
${caseStudy.result}

${caseStudy.metrics && caseStudy.metrics.length > 0 ? `METRICS:\n${caseStudy.metrics.map(m => `${m.value} - ${m.label}`).join('\n')}` : ''}

${caseStudy.quote ? `"${caseStudy.quote.text}"\n- ${caseStudy.quote.author}, ${caseStudy.quote.title}` : ''}
`
    : `
Many of our most successful customers today are ones who took a break and came back. They often tell us that stepping away gave them perspective on how much value we actually provided.
`;

  const offerSection = specialOffer
    ? `
      <div class="special-offer">
        <div class="offer-badge">Special Offer</div>
        <h3>${specialOffer.title}</h3>
        <p>${specialOffer.description}</p>
        ${specialOffer.discountPercentage ? `<div class="discount">${specialOffer.discountPercentage}% OFF</div>` : ''}
        ${specialOffer.validUntil ? `<p class="valid-until">Valid until ${specialOffer.validUntil}</p>` : ''}
      </div>
    `
    : '';

  const offerText = specialOffer
    ? `
SPECIAL OFFER: ${specialOffer.title}
${'='.repeat(30)}
${specialOffer.description}
${specialOffer.discountPercentage ? `${specialOffer.discountPercentage}% OFF` : ''}
${specialOffer.validUntil ? `Valid until ${specialOffer.validUntil}` : ''}
`
    : '';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .case-study { background: #f8f9fa; border-radius: 8px; margin: 20px 0; overflow: hidden; }
    .case-study-header { background: #1d3557; padding: 20px; }
    .case-study-header h3 { color: white; margin: 0; }
    .industry-tag { display: inline-block; background: #f4a261; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; margin-bottom: 10px; }
    .situation, .result { padding: 20px; border-bottom: 1px solid #e5e5e5; }
    .situation h4, .result h4 { margin-top: 0; color: #1d3557; font-size: 14px; text-transform: uppercase; }
    .metrics { display: flex; justify-content: space-around; padding: 20px; background: #d4edda; }
    .metric { text-align: center; }
    .metric-value { font-size: 28px; font-weight: bold; color: #155724; }
    .metric-label { font-size: 12px; color: #666; }
    .quote { padding: 20px; background: #e7f1ff; border-left: 4px solid #1d3557; margin: 0; }
    .quote blockquote { margin: 0; font-style: italic; color: #1d3557; font-size: 16px; }
    .quote cite { display: block; margin-top: 10px; color: #666; font-size: 14px; }
    .special-offer { background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%); padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; border: 2px dashed #f4a261; }
    .offer-badge { display: inline-block; background: #e63946; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
    .special-offer h3 { margin: 10px 0; color: #1d3557; }
    .discount { font-size: 36px; font-weight: bold; color: #e63946; margin: 15px 0; }
    .valid-until { font-size: 12px; color: #856404; margin-top: 10px; }
    .cta-section { text-align: center; margin: 25px 0; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .cta-button:hover { background: #c5303c; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    .case-study-placeholder { background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Success Stories</h1>
      <p>How others found their way back</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I wanted to share a story that might resonate with ${customerName}'s situation.</p>

      ${caseStudySection}

      <p>The common thread in these comeback stories? They realized that the grass wasn't actually greener - and when they returned, they were able to hit the ground running because they already knew the platform.</p>

      ${offerSection}

      <div class="cta-section">
        <p><strong>Want to explore what coming back might look like for ${customerName}?</strong></p>
        <p>I'm happy to put together a custom proposal that accounts for your history with us and your current needs.</p>
      </div>

      <p>
        Best,<br>
        <strong>${csmName}</strong><br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>Email 4 of 5 in this series. Reply 'stop' to unsubscribe.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
Hi ${firstName},

I wanted to share a story that might resonate with ${customerName}'s situation.
${caseStudyText}
The common thread in these comeback stories? They realized that the grass wasn't actually greener - and when they returned, they were able to hit the ground running because they already knew the platform.
${offerText}
Want to explore what coming back might look like for ${customerName}?
I'm happy to put together a custom proposal that accounts for your history with us and your current needs.

Best,
${csmName}
${csmEmail}

---
Email 4 of 5 in this series. Reply 'stop' to unsubscribe.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateWinbackDay21Email;
