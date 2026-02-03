/**
 * Executive Strategic Alignment Email Template
 * PRD-031: Executive Sponsor Outreach
 *
 * Generates strategic alignment emails for expansion conversations and business value discussions
 */

export interface ExecutiveStrategicData {
  customer: {
    name: string;
    arr: number;
    healthScore: number;
    industry?: string;
    partnershipStartDate?: string;
    tier?: string;
  };
  executive: {
    name: string;
    firstName: string;
    email: string;
    title: string;
    priorities?: string[];
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
  };
  strategic: {
    purpose: 'expansion' | 'escalation_awareness' | 'value_summary' | 'executive_engagement';
    expansionOpportunity?: {
      description: string;
      potentialValue: number;
      businessCase: string[];
    };
    escalation?: {
      issue: string;
      impact: string;
      resolution: string;
      status: string;
    };
    valueDelivered?: {
      totalROI?: string;
      costSavings?: string;
      efficiencyGains?: string;
      strategicImpact?: string;
    };
  };
  metrics: {
    headline: string;
    value: string;
    context?: string;
  }[];
  customMessage?: string;
}

export interface ExecutiveStrategicResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  talkingPoints: string[];
  suggestedSendTime: string;
  followUpActions: string[];
  sentiment: 'positive' | 'neutral' | 'concerned';
}

/**
 * Generate executive strategic alignment email
 */
export function generateExecutiveStrategicEmail(data: ExecutiveStrategicData): ExecutiveStrategicResult {
  const { customer, executive, csm, strategic, metrics, customMessage } = data;

  // Get purpose-specific content
  const purposeContent = getPurposeContent(data);

  // Build metrics section
  const metricsHtml = metrics.slice(0, 4).map(m => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${m.headline}</strong></td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; color: #e63946; font-weight: 600;">${m.value}</td>
      ${m.context ? `<td style="padding: 10px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">${m.context}</td>` : ''}
    </tr>
  `).join('\n');

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-bottom: 20px; }
    .header h2 { margin: 0; color: #e63946; font-size: 20px; }
    .metrics-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8f9fa; border-radius: 8px; overflow: hidden; }
    .metrics-table th { background: #e63946; color: white; padding: 12px; text-align: left; }
    .highlight-box { background: #f0f8ff; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0077b6; }
    .alert-box { background: #fff3cd; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .success-box { background: #d4edda; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
    .accent { color: #e63946; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .cta { margin: 25px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; }
    .cta-link { color: #e63946; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${purposeContent.title}</h2>
    </div>

    <p>${executive.firstName},</p>

    <p>${purposeContent.opening}</p>

    ${customMessage ? `<p>${customMessage}</p>` : ''}

    ${metricsHtml ? `
    <table class="metrics-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Result</th>
          ${metrics.some(m => m.context) ? '<th>Context</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${metricsHtml}
      </tbody>
    </table>
    ` : ''}

    ${purposeContent.bodySection}

    <div class="cta">
      <p>${purposeContent.callToAction}</p>
    </div>

    <p>${purposeContent.closing}</p>

    <div class="footer">
      <p>Best regards,</p>
      <p><strong>${csm.name}</strong><br/>
      ${csm.title || 'Customer Success Manager'}<br/>
      ${csm.email}${csm.phone ? `<br/>${csm.phone}` : ''}</p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const metricsText = metrics.slice(0, 4)
    .map(m => `- ${m.headline}: ${m.value}${m.context ? ` (${m.context})` : ''}`)
    .join('\n');

  const bodyText = `
${purposeContent.title}

${executive.firstName},

${purposeContent.opening}

${customMessage || ''}

${metricsText ? `Key Metrics:\n${metricsText}\n` : ''}

${purposeContent.bodySectionText}

${purposeContent.callToAction}

${purposeContent.closing}

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}${csm.phone ? `\n${csm.phone}` : ''}
`.trim();

  return {
    subject: purposeContent.subject,
    bodyHtml,
    bodyText,
    talkingPoints: purposeContent.talkingPoints,
    suggestedSendTime: purposeContent.sendTime,
    followUpActions: purposeContent.followUpActions,
    sentiment: purposeContent.sentiment,
  };
}

/**
 * Get purpose-specific content
 */
function getPurposeContent(data: ExecutiveStrategicData): {
  title: string;
  subject: string;
  opening: string;
  bodySection: string;
  bodySectionText: string;
  callToAction: string;
  closing: string;
  talkingPoints: string[];
  followUpActions: string[];
  sendTime: string;
  sentiment: 'positive' | 'neutral' | 'concerned';
} {
  const { customer, executive, strategic } = data;

  switch (strategic.purpose) {
    case 'expansion':
      const expansion = strategic.expansionOpportunity;
      return {
        title: `${customer.name} - Growth Opportunity`,
        subject: `${customer.name}: Strategic Growth Discussion`,
        opening: `Given the success we've achieved together, I wanted to share an opportunity that could further accelerate ${customer.name}'s results.`,
        bodySection: expansion ? `
          <div class="highlight-box">
            <strong>Opportunity: ${expansion.description}</strong>
            <ul>
              ${expansion.businessCase.map(bc => `<li>${bc}</li>`).join('\n              ')}
            </ul>
            <p>Estimated additional value: <strong>${formatCurrency(expansion.potentialValue)}</strong></p>
          </div>
        ` : '',
        bodySectionText: expansion ? `
Opportunity: ${expansion.description}
${expansion.businessCase.map(bc => `- ${bc}`).join('\n')}
Estimated additional value: ${formatCurrency(expansion.potentialValue)}
        `.trim() : '',
        callToAction: 'Would you be open to a brief discussion to explore this opportunity?',
        closing: 'I believe this could be a meaningful next step in our partnership.',
        talkingPoints: [
          'Review current partnership success',
          'Present expansion opportunity with business case',
          'Discuss alignment with strategic priorities',
          'Outline implementation approach and timeline',
          'Define success metrics and expected ROI',
        ],
        followUpActions: [
          'Prepare expansion proposal deck',
          'Coordinate with sales on pricing and terms',
          'Identify internal sponsors for expansion initiative',
          'Schedule follow-up demo if needed',
        ],
        sendTime: 'Tuesday or Wednesday, 9-10 AM',
        sentiment: 'positive',
      };

    case 'escalation_awareness':
      const escalation = strategic.escalation;
      return {
        title: `${customer.name} - Partnership Update`,
        subject: `${customer.name}: Important Partnership Update`,
        opening: `I wanted to reach out directly to share an update on a matter that may have come to your attention and provide visibility into our resolution efforts.`,
        bodySection: escalation ? `
          <div class="alert-box">
            <strong>Issue Summary:</strong>
            <p>${escalation.issue}</p>
            <p><strong>Business Impact:</strong> ${escalation.impact}</p>
            <p><strong>Resolution Status:</strong> ${escalation.status}</p>
            <p><strong>Our Approach:</strong> ${escalation.resolution}</p>
          </div>
        ` : '',
        bodySectionText: escalation ? `
Issue Summary: ${escalation.issue}
Business Impact: ${escalation.impact}
Resolution Status: ${escalation.status}
Our Approach: ${escalation.resolution}
        `.trim() : '',
        callToAction: 'I want to ensure you have full visibility and confidence in our resolution approach. Would you have a few minutes to discuss?',
        closing: 'Your partnership is a priority, and we are fully committed to resolving this matter swiftly.',
        talkingPoints: [
          'Acknowledge the issue directly and take ownership',
          'Provide clear timeline for resolution',
          'Share preventive measures being implemented',
          'Reinforce commitment to partnership success',
          'Offer direct line for ongoing communication',
        ],
        followUpActions: [
          'Ensure issue resolution team is briefed',
          'Prepare detailed timeline and status updates',
          'Schedule regular check-ins until resolved',
          'Document lessons learned for future prevention',
        ],
        sendTime: 'ASAP - early morning for executive visibility',
        sentiment: 'concerned',
      };

    case 'value_summary':
      const value = strategic.valueDelivered;
      return {
        title: `${customer.name} - Partnership Value Summary`,
        subject: `${customer.name}: Your Partnership ROI`,
        opening: `I wanted to share a summary of the value ${customer.name} has achieved through our partnership and thank you for your continued trust.`,
        bodySection: value ? `
          <div class="success-box">
            <strong>Value Delivered:</strong>
            <ul>
              ${value.totalROI ? `<li><strong>Total ROI:</strong> ${value.totalROI}</li>` : ''}
              ${value.costSavings ? `<li><strong>Cost Savings:</strong> ${value.costSavings}</li>` : ''}
              ${value.efficiencyGains ? `<li><strong>Efficiency Gains:</strong> ${value.efficiencyGains}</li>` : ''}
              ${value.strategicImpact ? `<li><strong>Strategic Impact:</strong> ${value.strategicImpact}</li>` : ''}
            </ul>
          </div>
        ` : '',
        bodySectionText: value ? `
Value Delivered:
${value.totalROI ? `- Total ROI: ${value.totalROI}` : ''}
${value.costSavings ? `- Cost Savings: ${value.costSavings}` : ''}
${value.efficiencyGains ? `- Efficiency Gains: ${value.efficiencyGains}` : ''}
${value.strategicImpact ? `- Strategic Impact: ${value.strategicImpact}` : ''}
        `.trim() : '',
        callToAction: 'I\'d love to discuss how we can continue building on this success. Would you have time for a brief call?',
        closing: 'Thank you for being a valued partner. We look forward to continuing to drive results together.',
        talkingPoints: [
          'Celebrate key achievements and milestones',
          'Review ROI and value metrics in detail',
          'Gather feedback on partnership experience',
          'Discuss opportunities for continued value creation',
          'Reinforce long-term partnership commitment',
        ],
        followUpActions: [
          'Prepare comprehensive value report',
          'Identify case study or testimonial opportunity',
          'Update success story in account plan',
          'Share internally for executive visibility',
        ],
        sendTime: 'End of quarter or milestone anniversary',
        sentiment: 'positive',
      };

    case 'executive_engagement':
    default:
      return {
        title: `${customer.name} - Executive Partnership Update`,
        subject: `${customer.name}: Partnership Update & Strategic Alignment`,
        opening: `I'm reaching out to share an update on our partnership and ensure we remain aligned with ${customer.name}'s strategic priorities.`,
        bodySection: `
          <div class="highlight-box">
            <p>As your dedicated success partner, I want to ensure our engagement continues to deliver meaningful value to your organization.</p>
          </div>
        `,
        bodySectionText: 'As your dedicated success partner, I want to ensure our engagement continues to deliver meaningful value to your organization.',
        callToAction: 'Would you have 20 minutes for a brief executive sync?',
        closing: 'I look forward to continuing our partnership journey together.',
        talkingPoints: [
          'Review recent partnership highlights',
          'Understand evolving strategic priorities',
          'Discuss upcoming initiatives and alignment opportunities',
          'Confirm preferred engagement cadence',
          'Identify any concerns or areas for improvement',
        ],
        followUpActions: [
          'Update account plan with executive feedback',
          'Schedule follow-up engagement per agreed cadence',
          'Share meeting notes with internal stakeholders',
          'Update CRM with executive contact details',
        ],
        sendTime: 'Quarterly - Tuesday or Wednesday morning',
        sentiment: 'neutral',
      };
  }
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export default generateExecutiveStrategicEmail;
