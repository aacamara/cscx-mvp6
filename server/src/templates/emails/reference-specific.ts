/**
 * Specific Prospect Reference Request Email Template
 * PRD-043: Reference Request to Customer
 *
 * Generates email requests for customer reference calls with specific prospect context
 */

export interface ReferenceSpecificData {
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
  prospect: {
    companyName: string;
    industry?: string;
    size?: string;
    challenges?: string[];
    evaluationStage?: 'early' | 'mid' | 'final';
    contactName?: string;
    contactTitle?: string;
  };
  callDetails: {
    proposedDate?: string;
    duration: string;
    format: 'phone' | 'video' | 'either';
    topics: string[];
  };
  wins?: string[];
  urgency?: 'standard' | 'high' | 'critical';
  customMessage?: string;
}

export interface ReferenceSpecificResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate reference request email for a specific prospect
 */
export function generateReferenceSpecificEmail(data: ReferenceSpecificData): ReferenceSpecificResult {
  const {
    customer,
    stakeholder,
    csm,
    prospect,
    callDetails,
    wins,
    urgency = 'standard',
    customMessage,
  } = data;

  // Get first name for greeting
  const firstName = stakeholder.name.split(' ')[0];

  // Format duration
  const durationText = customer.durationMonths >= 12
    ? `${Math.floor(customer.durationMonths / 12)} year${Math.floor(customer.durationMonths / 12) > 1 ? 's' : ''}`
    : `${customer.durationMonths} month${customer.durationMonths > 1 ? 's' : ''}`;

  // Urgency text
  const urgencyText = urgency === 'critical'
    ? 'We have a high-priority deal in final stages'
    : urgency === 'high'
    ? 'We have an exciting opportunity'
    : 'We have a prospect';

  // Prospect similarity text
  const similarityPoints: string[] = [];
  if (prospect.industry && prospect.industry.toLowerCase() === customer.industry.toLowerCase()) {
    similarityPoints.push(`in the same ${prospect.industry} industry`);
  }
  if (prospect.size) {
    similarityPoints.push(`similar company size (${prospect.size})`);
  }
  if (prospect.challenges && prospect.challenges.length > 0) {
    similarityPoints.push(`facing similar challenges`);
  }

  const similarityText = similarityPoints.length > 0
    ? ` They're ${similarityPoints.join(', ')}.`
    : '';

  // Evaluation stage context
  const stageText = prospect.evaluationStage === 'final'
    ? "They're in the final stages of their evaluation"
    : prospect.evaluationStage === 'mid'
    ? "They're actively evaluating solutions"
    : "They're early in their evaluation";

  // Call format text
  const formatText = callDetails.format === 'video'
    ? 'video call'
    : callDetails.format === 'phone'
    ? 'phone call'
    : 'phone or video call';

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .prospect-box { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #1976d2; }
    .prospect-box h4 { margin: 0 0 15px 0; color: #1976d2; }
    .prospect-detail { margin: 8px 0; }
    .prospect-label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .prospect-value { font-weight: 500; color: #333; }
    .ask-box { background: #fff3e0; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #ff9800; }
    .ask-box h4 { margin: 0 0 15px 0; color: #e65100; }
    .topics-section { background: #f5f5f5; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
    .topics-section h5 { margin: 0 0 10px 0; color: #333; }
    .topics-section ul { margin: 0; padding-left: 20px; }
    .topics-section li { margin: 5px 0; }
    ${urgency === 'critical' ? '.urgency-badge { display: inline-block; background: #e63946; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }' : ''}
    ${urgency === 'high' ? '.urgency-badge { display: inline-block; background: #ff9800; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }' : ''}
    .wins-section { background: #e8f5e9; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
    .wins-section strong { color: #2e7d32; }
    .wins-section ul { margin: 10px 0; padding-left: 20px; }
    .decline-note { font-size: 14px; color: #666; background: #fafafa; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .cta-buttons { text-align: center; margin: 25px 0; }
    .cta-btn { display: inline-block; padding: 12px 24px; margin: 5px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .cta-btn-primary { background: #e63946; color: white; }
    .cta-btn-secondary { background: #f5f5f5; color: #333; border: 1px solid #ddd; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Quick Reference Request</h2>
    </div>

    ${urgency !== 'standard' ? `<span class="urgency-badge">${urgency === 'critical' ? 'Time-Sensitive' : 'Priority Request'}</span>` : ''}

    <p>Hi ${firstName},</p>

    <p>I hope you're doing well! ${urgencyText} who's very interested in hearing from someone with your experience.</p>

    <div class="prospect-box">
      <h4>About the Prospect</h4>
      <div class="prospect-detail">
        <span class="prospect-label">Company</span><br/>
        <span class="prospect-value">${prospect.companyName}</span>
      </div>
      ${prospect.industry ? `
      <div class="prospect-detail">
        <span class="prospect-label">Industry</span><br/>
        <span class="prospect-value">${prospect.industry}</span>
      </div>
      ` : ''}
      ${prospect.size ? `
      <div class="prospect-detail">
        <span class="prospect-label">Company Size</span><br/>
        <span class="prospect-value">${prospect.size}</span>
      </div>
      ` : ''}
      ${prospect.challenges && prospect.challenges.length > 0 ? `
      <div class="prospect-detail">
        <span class="prospect-label">Challenges They're Facing</span><br/>
        <span class="prospect-value">${prospect.challenges.join(', ')}</span>
      </div>
      ` : ''}
      <p style="margin: 15px 0 0 0; font-size: 14px;">${stageText} and would greatly value hearing about your journey with us over the past ${durationText}.${similarityText}</p>
    </div>

    ${wins && wins.length > 0 ? `
    <div class="wins-section">
      <strong>Your story is compelling because:</strong>
      <ul>
        ${wins.map(win => `<li>${win}</li>`).join('\n        ')}
      </ul>
    </div>
    ` : ''}

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <div class="ask-box">
      <h4>The Ask</h4>
      <p style="margin: 0;">Would you be available for a brief <strong>${callDetails.duration}</strong> ${formatText}${callDetails.proposedDate ? ` around <strong>${callDetails.proposedDate}</strong>` : ' at your convenience'}?</p>
    </div>

    <div class="topics-section">
      <h5>Topics they'd love to discuss:</h5>
      <ul>
        ${callDetails.topics.map(topic => `<li>${topic}</li>`).join('\n        ')}
      </ul>
    </div>

    <div class="decline-note">
      <strong>No pressure at all</strong> - I completely understand if timing doesn't work or if you'd prefer not to. Just reply with a quick "yes" or "no" and I'll take it from there!
    </div>

    <p>Thank you so much for considering this, ${firstName}. Your insights would be incredibly valuable to them!</p>

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
Quick Reference Request

Hi ${firstName},

I hope you're doing well! ${urgencyText} who's very interested in hearing from someone with your experience.

ABOUT THE PROSPECT
------------------
Company: ${prospect.companyName}
${prospect.industry ? `Industry: ${prospect.industry}` : ''}
${prospect.size ? `Company Size: ${prospect.size}` : ''}
${prospect.challenges && prospect.challenges.length > 0 ? `Challenges: ${prospect.challenges.join(', ')}` : ''}

${stageText} and would greatly value hearing about your journey with us over the past ${durationText}.${similarityText}

${wins && wins.length > 0 ? `
YOUR STORY IS COMPELLING BECAUSE:
${wins.map(win => `- ${win}`).join('\n')}
` : ''}

${customMessage || ''}

THE ASK
-------
Would you be available for a brief ${callDetails.duration} ${formatText}${callDetails.proposedDate ? ` around ${callDetails.proposedDate}` : ' at your convenience'}?

TOPICS THEY'D LOVE TO DISCUSS:
${callDetails.topics.map(topic => `- ${topic}`).join('\n')}

No pressure at all - I completely understand if timing doesn't work or if you'd prefer not to. Just reply with a quick "yes" or "no" and I'll take it from there!

Thank you so much for considering this, ${firstName}. Your insights would be incredibly valuable to them!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line with urgency indicator
  const urgencyPrefix = urgency === 'critical' ? '[Time-Sensitive] ' : urgency === 'high' ? '[Quick Ask] ' : '';
  const subject = `${urgencyPrefix}${firstName}, would you chat with ${prospect.companyName} about your experience?`;

  // Recipients
  const recipients = [stakeholder.email];

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients,
  };
}

export default generateReferenceSpecificEmail;
