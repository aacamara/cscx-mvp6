/**
 * Testimonial Request Email Template
 * PRD-037: Feedback/Testimonial Request
 *
 * Generates personalized testimonial request emails with multiple participation levels
 */

export interface TestimonialRequestData {
  customer: {
    id: string;
    name: string;
    arr: number;
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
  wins: string[];
  npsScore?: number;
  recentQbr?: {
    quarter: string;
    year: number;
  };
  preferredOptions?: ('quote' | 'review' | 'testimonial' | 'interview' | 'case_study' | 'reference')[];
  customMessage?: string;
}

export interface TestimonialRequestResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate personalized testimonial request email
 */
export function generateTestimonialRequestEmail(data: TestimonialRequestData): TestimonialRequestResult {
  const {
    customer,
    stakeholder,
    csm,
    wins,
    npsScore,
    recentQbr,
    preferredOptions,
    customMessage,
  } = data;

  // Get first name for greeting
  const firstName = stakeholder.name.split(' ')[0];

  // Format duration
  const durationText = customer.durationMonths >= 12
    ? `${Math.floor(customer.durationMonths / 12)} year${Math.floor(customer.durationMonths / 12) > 1 ? 's' : ''}`
    : `${customer.durationMonths} month${customer.durationMonths > 1 ? 's' : ''}`;

  // Format primary win for highlight
  const primaryWin = wins[0] || 'your impressive results';
  const additionalWins = wins.slice(1);

  // Determine which options to show (default to all if not specified)
  const showOptions = preferredOptions || ['quote', 'review', 'testimonial', 'interview', 'case_study', 'reference'];

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .highlight-box { background: linear-gradient(135deg, #f0fff0 0%, #e8f5e9 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #28a745; }
    .options-section { margin: 25px 0; }
    .options-header { font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px; }
    .option-group { background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; }
    .option-group h4 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
    .option-group ul { margin: 0; padding-left: 20px; }
    .option-group li { margin: 5px 0; color: #555; }
    .effort-badge { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 12px; margin-left: 8px; font-weight: 600; }
    .effort-low { background: #d4edda; color: #155724; }
    .effort-medium { background: #fff3cd; color: #856404; }
    .effort-high { background: #cce5ff; color: #004085; }
    .checkbox { margin-right: 8px; color: #e63946; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .wins-list { margin: 10px 0; }
    .wins-list li { margin: 5px 0; }
    a { color: #e63946; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Quick Favor? We'd Love to Share Your Success</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>I hope you're doing well! I've really enjoyed working with ${customer.name} over the past ${durationText}, and your team's achievements have been truly impressive.</p>

    ${wins.length > 0 ? `
    <div class="highlight-box">
      <strong style="color: #28a745;">Your Key Achievements:</strong>
      <ul class="wins-list">
        ${wins.map(win => `<li>${win}</li>`).join('\n        ')}
      </ul>
    </div>
    ` : ''}

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <p>If you're open to it, I'd love to share your success story to help other companies facing similar challenges. We have a few flexible options:</p>

    <div class="options-section">
      ${showOptions.some(o => ['quote', 'review'].includes(o)) ? `
      <div class="option-group">
        <h4>Low Effort <span class="effort-badge effort-low">~5 min</span></h4>
        <ul>
          ${showOptions.includes('quote') ? '<li><span class="checkbox">&#9744;</span> A 1-2 sentence quote I can use in marketing</li>' : ''}
          ${showOptions.includes('review') ? '<li><span class="checkbox">&#9744;</span> A quick review on G2 or Capterra</li>' : ''}
        </ul>
      </div>
      ` : ''}

      ${showOptions.some(o => ['testimonial', 'interview'].includes(o)) ? `
      <div class="option-group">
        <h4>Medium Effort <span class="effort-badge effort-medium">~30 min</span></h4>
        <ul>
          ${showOptions.includes('testimonial') ? '<li><span class="checkbox">&#9744;</span> A short written testimonial about your experience</li>' : ''}
          ${showOptions.includes('interview') ? '<li><span class="checkbox">&#9744;</span> Brief interview for a mini case study</li>' : ''}
        </ul>
      </div>
      ` : ''}

      ${showOptions.some(o => ['case_study', 'reference'].includes(o)) ? `
      <div class="option-group">
        <h4>If You're Feeling Generous <span class="effort-badge effort-high">~1 hour</span></h4>
        <ul>
          ${showOptions.includes('case_study') ? '<li><span class="checkbox">&#9744;</span> Full case study with your team</li>' : ''}
          ${showOptions.includes('reference') ? '<li><span class="checkbox">&#9744;</span> Reference call availability for prospects</li>' : ''}
        </ul>
      </div>
      ` : ''}
    </div>

    <p><strong>No pressure at all</strong> - any level of participation would be incredibly appreciated. Just hit reply with what sounds doable, or let me know if now isn't a good time.</p>

    <p>Thanks for being such an amazing partner!</p>

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
Quick Favor? We'd Love to Share Your Success Story

Hi ${firstName},

I hope you're doing well! I've really enjoyed working with ${customer.name} over the past ${durationText}, and your team's achievements have been truly impressive.

${wins.length > 0 ? `
Your Key Achievements:
${wins.map(win => `- ${win}`).join('\n')}
` : ''}

${customMessage || ''}

If you're open to it, I'd love to share your success story to help other companies facing similar challenges. We have a few flexible options:

LOW EFFORT (~5 min):
${showOptions.includes('quote') ? '[ ] A 1-2 sentence quote I can use in marketing\n' : ''}${showOptions.includes('review') ? '[ ] A quick review on G2 or Capterra\n' : ''}

MEDIUM EFFORT (~30 min):
${showOptions.includes('testimonial') ? '[ ] A short written testimonial about your experience\n' : ''}${showOptions.includes('interview') ? '[ ] Brief interview for a mini case study\n' : ''}

IF YOU'RE FEELING GENEROUS (~1 hour):
${showOptions.includes('case_study') ? '[ ] Full case study with your team\n' : ''}${showOptions.includes('reference') ? '[ ] Reference call availability for prospects\n' : ''}

No pressure at all - any level of participation would be incredibly appreciated. Just hit reply with what sounds doable, or let me know if now isn't a good time.

Thanks for being such an amazing partner!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line
  const subject = `Quick Favor? We'd Love to Share Your Success Story`;

  // Recipients
  const recipients = [stakeholder.email];

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients,
  };
}

export default generateTestimonialRequestEmail;
