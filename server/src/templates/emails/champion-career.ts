/**
 * Champion Career Development Email Template
 * PRD-032: Champion Nurture Sequence
 * Purpose: Share industry report, invite to webinar panel, career visibility
 */

export interface ChampionCareerVariables {
  championName: string;
  championTitle?: string;
  customerName: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  opportunityType: 'speaking' | 'report' | 'webinar' | 'podcast' | 'article' | 'conference';
  opportunityTitle: string;
  opportunityDescription?: string;
  opportunityDate?: string;
  opportunityLink?: string;
  resourceTitle?: string;
  resourceDescription?: string;
  resourceLink?: string;
  careerTips?: string[];
  industryInsights?: string[];
  deadlineDate?: string;
}

export function generateChampionCareerEmail(variables: ChampionCareerVariables): {
  subject: string;
  bodyHtml: string;
  bodyText: string;
} {
  const {
    championName,
    championTitle,
    customerName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    opportunityType,
    opportunityTitle,
    opportunityDescription,
    opportunityDate,
    opportunityLink,
    resourceTitle,
    resourceDescription,
    resourceLink,
    careerTips = [],
    industryInsights = [],
    deadlineDate,
  } = variables;

  const firstName = championName.split(' ')[0];

  // Customize subject based on opportunity type
  const subjectMap = {
    speaking: `Speaking Opportunity: ${opportunityTitle}`,
    report: `Industry Trends Report + Career Spotlight`,
    webinar: `Invitation: Join Our Expert Panel - ${opportunityTitle}`,
    podcast: `Podcast Feature: Share Your Story with ${opportunityTitle}`,
    article: `Co-Author Opportunity: ${opportunityTitle}`,
    conference: `Conference Speaking: ${opportunityTitle}`,
  };

  const subject = subjectMap[opportunityType] || `Career Opportunity: ${opportunityTitle}`;

  // Build career tips section
  const tipsList = careerTips.length > 0
    ? careerTips.map(t => `<li>${t}</li>`).join('\n')
    : '';

  // Build industry insights section
  const insightsList = industryInsights.length > 0
    ? industryInsights.map(i => `<li>${i}</li>`).join('\n')
    : '';

  // Customize CTA based on opportunity type
  const ctaTextMap = {
    speaking: 'Express Interest',
    report: 'Download Report',
    webinar: 'Join the Panel',
    podcast: 'Schedule Recording',
    article: 'Learn More',
    conference: 'Apply to Speak',
  };
  const ctaText = ctaTextMap[opportunityType] || 'Learn More';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header .subtitle { color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .opportunity-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 24px; border-radius: 8px; margin: 20px 0; border: 1px solid #ddd; }
    .opportunity-card h3 { color: #6c5ce7; margin: 0 0 12px 0; }
    .opportunity-card .date { color: #666; font-size: 14px; margin-bottom: 12px; }
    .resource-box { background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0366d6; }
    .insights-box { background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .tips-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
    .cta-button { display: inline-block; background: #6c5ce7; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: 600; }
    .cta-button:hover { background: #5b4cdb; }
    .secondary-cta { display: inline-block; background: transparent; color: #6c5ce7; padding: 12px 24px; text-decoration: none; border-radius: 6px; border: 2px solid #6c5ce7; margin: 8px 0; }
    .deadline { background: #fff3cd; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Grow Your Career & Visibility</h1>
      <div class="subtitle">An Opportunity Curated for You, ${firstName}</div>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I've been thinking about your career trajectory${championTitle ? ` as ${championTitle}` : ''} and wanted to share an opportunity that I think would be perfect for you.</p>

      <div class="opportunity-card">
        <h3>${opportunityTitle}</h3>
        ${opportunityDate ? `<div class="date">Date: ${opportunityDate}</div>` : ''}
        ${opportunityDescription ? `<p style="margin-bottom: 12px;">${opportunityDescription}</p>` : ''}
        ${opportunityLink ? `<a href="${opportunityLink}" class="cta-button">${ctaText}</a>` : ''}
      </div>

      <p>Given your expertise in ${customerName}'s operations and your track record of driving results, I think you'd bring valuable insights to this audience. It's also a great way to build your professional brand and network with other industry leaders.</p>

      ${resourceTitle && resourceLink ? `
      <div class="resource-box">
        <strong>Bonus Resource: ${resourceTitle}</strong>
        ${resourceDescription ? `<p style="margin: 8px 0 12px 0;">${resourceDescription}</p>` : ''}
        <a href="${resourceLink}" class="secondary-cta">Access Resource</a>
      </div>
      ` : ''}

      ${industryInsights.length > 0 ? `
      <div class="insights-box">
        <strong>Industry Insights You Might Find Interesting:</strong>
        <ul>
          ${insightsList}
        </ul>
      </div>
      ` : ''}

      ${careerTips.length > 0 ? `
      <div class="tips-box">
        <strong>Quick Career Tips:</strong>
        <ul>
          ${tipsList}
        </ul>
      </div>
      ` : ''}

      ${deadlineDate ? `
      <div class="deadline">
        <strong>Application/Response Deadline:</strong> ${deadlineDate}
      </div>
      ` : ''}

      <p>No pressure at all - I just wanted to make sure you had this on your radar. If you're interested, I'm happy to make an introduction or help you prepare.</p>

      <p>Let me know what you think!</p>

      <p>
        Best,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>We share career development opportunities with our champions because your growth matters to us.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text insights
  const insightsText = industryInsights.length > 0
    ? '\nIndustry Insights You Might Find Interesting:\n' + industryInsights.map(i => `- ${i}`).join('\n') + '\n'
    : '';

  // Build plain text tips
  const tipsText = careerTips.length > 0
    ? '\nQuick Career Tips:\n' + careerTips.map(t => `- ${t}`).join('\n') + '\n'
    : '';

  const bodyText = `
Hi ${firstName},

I've been thinking about your career trajectory${championTitle ? ` as ${championTitle}` : ''} and wanted to share an opportunity that I think would be perfect for you.

=== ${opportunityTitle.toUpperCase()} ===
${opportunityDate ? `Date: ${opportunityDate}\n` : ''}${opportunityDescription || ''}
${opportunityLink ? `\n${ctaText}: ${opportunityLink}\n` : ''}

Given your expertise in ${customerName}'s operations and your track record of driving results, I think you'd bring valuable insights to this audience. It's also a great way to build your professional brand and network with other industry leaders.

${resourceTitle && resourceLink ? `BONUS RESOURCE: ${resourceTitle}\n${resourceDescription || ''}\nAccess: ${resourceLink}\n` : ''}
${insightsText}${tipsText}
${deadlineDate ? `APPLICATION DEADLINE: ${deadlineDate}\n` : ''}
No pressure at all - I just wanted to make sure you had this on your radar. If you're interested, I'm happy to make an introduction or help you prepare.

Let me know what you think!

Best,
${csmName}
${csmTitle}
${csmEmail}

---
We share career development opportunities with our champions because your growth matters to us.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateChampionCareerEmail;
