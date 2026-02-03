/**
 * Reference Availability Request Email Template
 * PRD-037: Feedback/Testimonial Request
 *
 * Generates email requests for customer reference call availability
 */

export interface ReferenceRequestData {
  customer: {
    id: string;
    name: string;
    industry: string;
    arr: number;
    healthScore: number;
    durationMonths: number;
    useCase?: string;
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
  referenceProgram?: {
    name: string;
    benefits: string[];
    frequency: 'occasional' | 'monthly' | 'quarterly';
  };
  callDetails?: {
    typicalDuration: string;
    format: 'phone' | 'video' | 'either';
    topics: string[];
  };
  customMessage?: string;
}

export interface ReferenceRequestResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate reference availability request email
 */
export function generateReferenceRequestEmail(data: ReferenceRequestData): ReferenceRequestResult {
  const {
    customer,
    stakeholder,
    csm,
    wins,
    referenceProgram,
    callDetails,
    customMessage,
  } = data;

  // Get first name for greeting
  const firstName = stakeholder.name.split(' ')[0];

  // Format duration
  const durationText = customer.durationMonths >= 12
    ? `${Math.floor(customer.durationMonths / 12)} year${Math.floor(customer.durationMonths / 12) > 1 ? 's' : ''}`
    : `${customer.durationMonths} month${customer.durationMonths > 1 ? 's' : ''}`;

  // Default call details
  const callDuration = callDetails?.typicalDuration || '15-30 minutes';
  const callFormat = callDetails?.format === 'video' ? 'video call' : callDetails?.format === 'phone' ? 'phone call' : 'phone or video call';
  const callTopics = callDetails?.topics || [
    'Your experience with our platform',
    'Results and ROI you\'ve achieved',
    'How we\'ve supported your team',
  ];

  // Default frequency text
  const frequencyText = referenceProgram?.frequency === 'monthly'
    ? 'typically 1-2 calls per month'
    : referenceProgram?.frequency === 'quarterly'
    ? 'only a few calls per quarter'
    : 'just occasionally as opportunities arise';

  // Build benefits section
  const benefits = referenceProgram?.benefits || [
    'Early access to new features and beta programs',
    'Direct input into our product roadmap',
    'Exclusive networking events with other customer leaders',
    'Recognition in our customer spotlight program',
  ];

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .highlight-box { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #1976d2; }
    .wins-section { background: #f0fff0; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
    .wins-section ul { margin: 10px 0; padding-left: 20px; }
    .wins-section li { margin: 5px 0; }
    .benefits-box { background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%); padding: 20px; border-radius: 12px; margin: 20px 0; }
    .benefits-box h4 { margin: 0 0 15px 0; color: #c2185b; }
    .benefits-box ul { margin: 0; padding-left: 20px; }
    .benefits-box li { margin: 8px 0; color: #555; }
    .what-to-expect { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .what-to-expect h4 { margin: 0 0 15px 0; color: #333; }
    .what-to-expect ul { margin: 0; padding-left: 20px; }
    .what-to-expect li { margin: 8px 0; }
    .cta-section { text-align: center; margin: 30px 0; }
    .cta-btn { display: inline-block; padding: 14px 32px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .cta-btn:hover { background: #c62828; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    a { color: #e63946; text-decoration: none; }
    .tag { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Join Our Customer Reference Program?</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>I hope you're doing well! Over the past ${durationText}, ${customer.name} has achieved some truly remarkable results with our platform, and your story is one that could really help other ${customer.industry} companies considering a similar journey.</p>

    ${wins.length > 0 ? `
    <div class="wins-section">
      <strong style="color: #28a745;">Your team's achievements speak for themselves:</strong>
      <ul>
        ${wins.map(win => `<li>${win}</li>`).join('\n        ')}
      </ul>
    </div>
    ` : ''}

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="highlight-box">
      <strong style="color: #1976d2;">The Ask:</strong>
      <p style="margin: 10px 0 0 0;">Would you be open to occasionally speaking with prospective customers who are evaluating our platform? These are ${callDuration} ${callFormat}s - ${frequencyText}.</p>
    </div>

    <div class="what-to-expect">
      <h4>What to Expect on Reference Calls:</h4>
      <ul>
        ${callTopics.map(topic => `<li>${topic}</li>`).join('\n        ')}
      </ul>
      <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
        <span class="tag">Flexible</span> You can always decline specific requests if timing doesn't work.
      </p>
    </div>

    <div class="benefits-box">
      <h4>Reference Program Benefits:</h4>
      <ul>
        ${benefits.map(benefit => `<li>${benefit}</li>`).join('\n        ')}
      </ul>
    </div>

    <p>If this sounds like something you'd be interested in, just reply to this email and I'll get you set up. If you have any questions about what's involved, I'm happy to chat!</p>

    <p>No pressure at all if it's not a good fit right now - I completely understand. Either way, thank you for being such a fantastic partner!</p>

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
Join Our Customer Reference Program?

Hi ${firstName},

I hope you're doing well! Over the past ${durationText}, ${customer.name} has achieved some truly remarkable results with our platform, and your story is one that could really help other ${customer.industry} companies considering a similar journey.

${wins.length > 0 ? `
Your team's achievements speak for themselves:
${wins.map(win => `- ${win}`).join('\n')}
` : ''}

${customMessage || ''}

THE ASK:
Would you be open to occasionally speaking with prospective customers who are evaluating our platform? These are ${callDuration} ${callFormat}s - ${frequencyText}.

WHAT TO EXPECT ON REFERENCE CALLS:
${callTopics.map(topic => `- ${topic}`).join('\n')}

You can always decline specific requests if timing doesn't work.

REFERENCE PROGRAM BENEFITS:
${benefits.map(benefit => `- ${benefit}`).join('\n')}

If this sounds like something you'd be interested in, just reply to this email and I'll get you set up. If you have any questions about what's involved, I'm happy to chat!

No pressure at all if it's not a good fit right now - I completely understand. Either way, thank you for being such a fantastic partner!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line
  const subject = `${firstName}, would you be open to joining our customer reference program?`;

  // Recipients
  const recipients = [stakeholder.email];

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients,
  };
}

export default generateReferenceRequestEmail;
