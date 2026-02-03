/**
 * Review Site Request Email Template
 * PRD-037: Feedback/Testimonial Request
 *
 * Generates email requests for G2, Capterra, and other review sites
 */

export interface ReviewRequestData {
  customer: {
    id: string;
    name: string;
    healthScore: number;
    durationMonths: number;
  };
  stakeholder: {
    name: string;
    email: string;
    title?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
  };
  reviewSites: Array<{
    name: 'G2' | 'Capterra' | 'TrustRadius' | 'Gartner' | 'Google' | 'Trustpilot';
    url: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
  primaryWin?: string;
  incentive?: {
    type: 'gift_card' | 'donation' | 'swag' | 'none';
    value?: string;
    details?: string;
  };
  customMessage?: string;
}

export interface ReviewRequestResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate review site request email
 */
export function generateReviewRequestEmail(data: ReviewRequestData): ReviewRequestResult {
  const {
    customer,
    stakeholder,
    csm,
    reviewSites,
    primaryWin,
    incentive,
    customMessage,
  } = data;

  // Get first name for greeting
  const firstName = stakeholder.name.split(' ')[0];

  // Format duration
  const durationText = customer.durationMonths >= 12
    ? `${Math.floor(customer.durationMonths / 12)} year${Math.floor(customer.durationMonths / 12) > 1 ? 's' : ''}`
    : `${customer.durationMonths} month${customer.durationMonths > 1 ? 's' : ''}`;

  // Build review site links
  const siteLinks = reviewSites.map(site => ({
    name: site.name,
    url: site.url,
    icon: getReviewSiteIcon(site.name),
    color: getReviewSiteColor(site.name),
  }));

  // Build incentive section if applicable
  let incentiveHtml = '';
  let incentiveText = '';
  if (incentive && incentive.type !== 'none') {
    const incentiveDetails = getIncentiveDetails(incentive);
    incentiveHtml = `
    <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <strong style="color: #ff8f00;">As a Thank You:</strong> ${incentiveDetails}
    </div>
    `;
    incentiveText = `\nAs a thank you: ${incentiveDetails}\n`;
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
    .review-sites { margin: 25px 0; }
    .review-site { display: inline-block; text-align: center; margin: 10px 15px 10px 0; }
    .review-site-btn { display: inline-block; padding: 12px 24px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; transition: background 0.2s; }
    .review-site-btn:hover { background: #c62828; }
    .time-estimate { background: #e8f5e9; display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 13px; color: #2e7d32; margin-left: 10px; }
    .tip-box { background: #f3e5f5; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
    .tip-box h4 { margin: 0 0 10px 0; color: #7b1fa2; }
    .tip-box ul { margin: 0; padding-left: 20px; color: #555; }
    .tip-box li { margin: 5px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    a { color: #e63946; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Share Your Experience?</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>I hope this finds you well! Since we've been working together for ${durationText}${primaryWin ? ` and achieved ${primaryWin}` : ''}, I was wondering if you'd be willing to share your experience on one of our review sites.</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <p>Your honest feedback helps other teams like yours make informed decisions. It only takes about <strong>5 minutes</strong>.</p>

    <div class="review-sites">
      ${siteLinks.map(site => `
      <a href="${site.url}" class="review-site-btn" style="background: ${site.color};" target="_blank">
        ${site.icon} Review on ${site.name}
      </a>
      `).join('\n      ')}
    </div>
    <span class="time-estimate">Takes ~5 minutes</span>

    ${incentiveHtml}

    <div class="tip-box">
      <h4>Quick Tips for a Helpful Review:</h4>
      <ul>
        <li>Mention specific results or improvements you've seen</li>
        <li>Share what problem we helped you solve</li>
        <li>Describe your experience working with our team</li>
      </ul>
    </div>

    <p>No worries if now isn't a good time - I completely understand. Just let me know if you have any questions!</p>

    <div class="footer">
      <p>Thanks so much,</p>
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
Share Your Experience?

Hi ${firstName},

I hope this finds you well! Since we've been working together for ${durationText}${primaryWin ? ` and achieved ${primaryWin}` : ''}, I was wondering if you'd be willing to share your experience on one of our review sites.

${customMessage || ''}

Your honest feedback helps other teams like yours make informed decisions. It only takes about 5 minutes.

${siteLinks.map(site => `Review on ${site.name}: ${site.url}`).join('\n')}

${incentiveText}

Quick Tips for a Helpful Review:
- Mention specific results or improvements you've seen
- Share what problem we helped you solve
- Describe your experience working with our team

No worries if now isn't a good time - I completely understand. Just let me know if you have any questions!

Thanks so much,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line
  const subject = `Quick 5-min favor? Share your ${siteLinks[0]?.name || 'review'} experience`;

  // Recipients
  const recipients = [stakeholder.email];

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients,
  };
}

/**
 * Get icon emoji for review site
 */
function getReviewSiteIcon(site: string): string {
  const icons: Record<string, string> = {
    'G2': '&#9733;',
    'Capterra': '&#9733;',
    'TrustRadius': '&#9733;',
    'Gartner': '&#9733;',
    'Google': '&#9733;',
    'Trustpilot': '&#9733;',
  };
  return icons[site] || '&#9733;';
}

/**
 * Get brand color for review site
 */
function getReviewSiteColor(site: string): string {
  const colors: Record<string, string> = {
    'G2': '#ff492c',
    'Capterra': '#0066cc',
    'TrustRadius': '#00bfa5',
    'Gartner': '#002856',
    'Google': '#4285f4',
    'Trustpilot': '#00b67a',
  };
  return colors[site] || '#e63946';
}

/**
 * Get incentive details text
 */
function getIncentiveDetails(incentive: { type: string; value?: string; details?: string }): string {
  switch (incentive.type) {
    case 'gift_card':
      return incentive.value
        ? `We'd like to send you a ${incentive.value} gift card as a small token of appreciation!`
        : 'We\'d like to send you a gift card as a small token of appreciation!';
    case 'donation':
      return incentive.details
        ? `We'll make a ${incentive.value || ''} donation to ${incentive.details} in your name!`
        : `We'll make a donation to the charity of your choice!`;
    case 'swag':
      return incentive.details
        ? `We'd love to send you some ${incentive.details}!`
        : 'We\'d love to send you some company swag!';
    default:
      return incentive.details || '';
  }
}

export default generateReviewRequestEmail;
