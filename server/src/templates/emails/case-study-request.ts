/**
 * Case Study Request Email Template
 * PRD-048: Case Study Request
 *
 * Generates a compelling case study participation request email
 * that explains the process, highlights benefits, and makes participation easy
 */

export interface CaseStudyRequestData {
  customer: {
    id: string;
    name: string;
    industry: string;
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
    calendarLink?: string;
  };
  successMetrics: {
    title: string;
    value: string;
    context?: string;
  }[];
  storyHighlights: {
    challenge?: string;
    solution?: string;
    results?: string;
    quote?: string;
  };
  processDetails?: {
    interviewDuration?: string;
    format?: 'video' | 'phone' | 'either';
    timeline?: string;
    executiveSponsorQuote?: boolean;
  };
  benefits?: string[];
  sampleCaseStudyUrl?: string;
  customMessage?: string;
}

export interface CaseStudyRequestResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

/**
 * Generate case study request email
 */
export function generateCaseStudyRequestEmail(data: CaseStudyRequestData): CaseStudyRequestResult {
  const {
    customer,
    stakeholder,
    csm,
    successMetrics,
    storyHighlights,
    processDetails,
    benefits,
    sampleCaseStudyUrl,
    customMessage,
  } = data;

  // Get first name for greeting
  const firstName = stakeholder.name.split(' ')[0];

  // Format duration
  const durationText = customer.durationMonths >= 12
    ? `${Math.floor(customer.durationMonths / 12)} year${Math.floor(customer.durationMonths / 12) > 1 ? 's' : ''}`
    : `${customer.durationMonths} month${customer.durationMonths > 1 ? 's' : ''}`;

  // Default process details
  const interviewDuration = processDetails?.interviewDuration || '45 minutes';
  const interviewFormat = processDetails?.format === 'video' ? 'video call' :
    processDetails?.format === 'phone' ? 'phone call' : 'video or phone call';
  const timeline = processDetails?.timeline || 'About 4 weeks from interview to publication';
  const includeExecQuote = processDetails?.executiveSponsorQuote !== false;

  // Default benefits
  const defaultBenefits = [
    'Position ' + customer.name + ' as an innovation leader in ' + customer.industry,
    'Featured on our website and shared with our audience of potential customers',
    'Networking opportunities with similar companies who\'d love to connect',
    'Early access to new features and beta programs as case study participants',
  ];
  const benefitsList = benefits || defaultBenefits;

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .metrics-grid { display: grid; gap: 12px; margin: 20px 0; }
    .metric-card { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 16px; border-radius: 8px; border-left: 4px solid #0284c7; }
    .metric-title { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .metric-value { font-size: 24px; font-weight: 700; color: #0369a1; }
    .metric-context { font-size: 12px; color: #666; margin-top: 4px; }
    .story-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .story-box h4 { margin: 0 0 15px 0; color: #92400e; }
    .story-item { margin: 10px 0; }
    .story-label { font-weight: 600; color: #78350f; }
    .quote-box { background: #f8fafc; border-left: 4px solid #e63946; padding: 15px 20px; margin: 15px 0; font-style: italic; color: #475569; }
    .process-box { background: #f5f5f5; padding: 20px; border-radius: 12px; margin: 20px 0; }
    .process-box h4 { margin: 0 0 15px 0; color: #333; }
    .process-list { list-style: none; padding: 0; margin: 0; }
    .process-list li { margin: 10px 0; padding-left: 28px; position: relative; }
    .process-list li::before { content: ""; position: absolute; left: 0; top: 8px; width: 16px; height: 16px; background: #22c55e; border-radius: 50%; }
    .benefits-section { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; margin: 20px 0; }
    .benefits-section h4 { margin: 0 0 15px 0; color: #065f46; }
    .benefit-item { display: flex; align-items: flex-start; gap: 10px; margin: 12px 0; }
    .benefit-icon { font-size: 18px; }
    .highlight-section { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; border-radius: 12px; margin: 20px 0; }
    .highlight-section h4 { margin: 0 0 15px 0; color: #1e40af; }
    .cta-section { text-align: center; margin: 30px 0; }
    .cta-btn { display: inline-block; padding: 14px 32px; background: #e63946; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 5px; }
    .cta-secondary { background: #475569; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    a { color: #e63946; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #e63946;">Would ${customer.name} Share Your Success Story?</h2>
    </div>

    <p>Hi ${firstName},</p>

    <p>I've loved watching ${customer.name}'s journey over the past ${durationText}${successMetrics.length > 0 ? ` - from where you started to achieving remarkable results like ${successMetrics[0].value} ${successMetrics[0].title.toLowerCase()}` : ''}. Your story is genuinely inspiring, and I think it could help other ${customer.industry.toLowerCase()} companies facing similar challenges.</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    <p><strong>Would ${customer.name} be open to being featured in a case study?</strong></p>

    ${successMetrics.length > 0 ? `
    <div class="metrics-grid">
      ${successMetrics.map(metric => `
        <div class="metric-card">
          <div class="metric-title">${metric.title}</div>
          <div class="metric-value">${metric.value}</div>
          ${metric.context ? `<div class="metric-context">${metric.context}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${(storyHighlights.challenge || storyHighlights.solution || storyHighlights.results) ? `
    <div class="story-box">
      <h4>Success Story Highlights We'd Feature:</h4>
      ${storyHighlights.challenge ? `
        <div class="story-item">
          <span class="story-label">Challenge:</span> ${storyHighlights.challenge}
        </div>
      ` : ''}
      ${storyHighlights.solution ? `
        <div class="story-item">
          <span class="story-label">Solution:</span> ${storyHighlights.solution}
        </div>
      ` : ''}
      ${storyHighlights.results ? `
        <div class="story-item">
          <span class="story-label">Results:</span> ${storyHighlights.results}
        </div>
      ` : ''}
      ${storyHighlights.quote ? `
        <div class="quote-box">"${storyHighlights.quote}"</div>
      ` : ''}
    </div>
    ` : ''}

    <div class="process-box">
      <h4>What's Involved:</h4>
      <ul class="process-list">
        <li>${interviewDuration} interview with you (can be ${interviewFormat})</li>
        ${includeExecQuote ? '<li>Optional: Brief quote from an executive sponsor</li>' : ''}
        <li>Review and approval of final content before publishing</li>
      </ul>
      <p style="margin: 15px 0 0 0; color: #666;"><strong>Timeline:</strong> ${timeline}</p>
    </div>

    <div class="benefits-section">
      <h4>What's In It For ${customer.name}:</h4>
      ${benefitsList.map((benefit, i) => `
        <div class="benefit-item">
          <span class="benefit-icon">${['🎯', '📢', '🤝', '🚀'][i % 4]}</span>
          <span>${benefit}</span>
        </div>
      `).join('')}
    </div>

    ${successMetrics.length > 0 ? `
    <div class="highlight-section">
      <h4>Success Metrics We'd Highlight:</h4>
      <ul style="margin: 0; padding-left: 20px;">
        ${successMetrics.map(m => `<li><strong>${m.value}</strong> ${m.title.toLowerCase()}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${sampleCaseStudyUrl ? `
    <p>I've included a link to a sample of a recent case study so you can see the quality and tone we aim for:</p>
    <p style="text-align: center;">
      <a href="${sampleCaseStudyUrl}" class="cta-btn cta-secondary">View Sample Case Study</a>
    </p>
    ` : ''}

    <p>Would you be interested? If yes, I can set up a quick prep call to discuss next steps!</p>

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
Would ${customer.name} Share Your Success Story?

Hi ${firstName},

I've loved watching ${customer.name}'s journey over the past ${durationText}${successMetrics.length > 0 ? ` - from where you started to achieving remarkable results like ${successMetrics[0].value} ${successMetrics[0].title.toLowerCase()}` : ''}. Your story is genuinely inspiring, and I think it could help other ${customer.industry.toLowerCase()} companies facing similar challenges.

${customMessage || ''}

Would ${customer.name} be open to being featured in a case study?

${successMetrics.length > 0 ? `
YOUR RESULTS:
${successMetrics.map(m => `- ${m.title}: ${m.value}${m.context ? ` (${m.context})` : ''}`).join('\n')}
` : ''}

${(storyHighlights.challenge || storyHighlights.solution || storyHighlights.results) ? `
SUCCESS STORY HIGHLIGHTS WE'D FEATURE:
${storyHighlights.challenge ? `- Challenge: ${storyHighlights.challenge}` : ''}
${storyHighlights.solution ? `- Solution: ${storyHighlights.solution}` : ''}
${storyHighlights.results ? `- Results: ${storyHighlights.results}` : ''}
${storyHighlights.quote ? `- Quote: "${storyHighlights.quote}"` : ''}
` : ''}

WHAT'S INVOLVED:
- ${interviewDuration} interview with you (can be ${interviewFormat})
${includeExecQuote ? '- Optional: Brief quote from an executive sponsor' : ''}
- Review and approval of final content before publishing

Timeline: ${timeline}

WHAT'S IN IT FOR ${customer.name.toUpperCase()}:
${benefitsList.map(b => `- ${b}`).join('\n')}

${sampleCaseStudyUrl ? `
View a sample case study: ${sampleCaseStudyUrl}
` : ''}

Would you be interested? If yes, I can set up a quick prep call to discuss next steps!

No pressure at all if it's not a good fit right now - I completely understand. Either way, thank you for being such a fantastic partner!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}
`.trim();

  // Subject line
  const subject = `Would ${customer.name} Be Open to Sharing Your Success Story?`;

  // Recipients
  const recipients = [stakeholder.email];

  return {
    subject,
    bodyHtml,
    bodyText,
    recipients,
  };
}

export default generateCaseStudyRequestEmail;
