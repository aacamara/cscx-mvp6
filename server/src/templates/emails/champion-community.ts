/**
 * Champion Community Invitation Email Template
 * PRD-032: Champion Nurture Sequence
 * Purpose: Invite to exclusive champion community, networking perks
 */

export interface ChampionCommunityVariables {
  championName: string;
  championTitle?: string;
  customerName: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  communityName?: string;
  communityDescription?: string;
  communityBenefits?: string[];
  upcomingEvents?: Array<{
    title: string;
    date: string;
    description?: string;
  }>;
  memberCount?: number;
  featuredMembers?: Array<{
    name: string;
    title: string;
    company: string;
  }>;
  joinLink?: string;
  exclusivePerks?: string[];
}

export function generateChampionCommunityEmail(variables: ChampionCommunityVariables): {
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
    communityName = 'Champion Advisory Board',
    communityDescription,
    communityBenefits = [],
    upcomingEvents = [],
    memberCount,
    featuredMembers = [],
    joinLink,
    exclusivePerks = [],
  } = variables;

  const firstName = championName.split(' ')[0];

  const subject = `Join Our ${communityName}?`;

  // Build benefits section
  const benefitsList = communityBenefits.length > 0
    ? communityBenefits.map(b => `<li>${b}</li>`).join('\n')
    : `
      <li>Direct influence on product roadmap priorities</li>
      <li>Exclusive early access to new features</li>
      <li>Networking with industry peers and leaders</li>
      <li>Quarterly executive briefings and insights</li>
      <li>Recognition at our annual customer conference</li>
    `;

  // Build upcoming events section
  const eventsSection = upcomingEvents.length > 0 ? `
    <div class="events-box">
      <strong>Upcoming Community Events:</strong>
      ${upcomingEvents.map(e => `
        <div class="event-item">
          <strong>${e.title}</strong>
          <div class="event-date">${e.date}</div>
          ${e.description ? `<div class="event-desc">${e.description}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Build featured members section
  const membersSection = featuredMembers.length > 0 ? `
    <div class="members-box">
      <strong>Connect with Fellow Champions:</strong>
      <div class="members-grid">
        ${featuredMembers.map(m => `
          <div class="member-card">
            <div class="member-name">${m.name}</div>
            <div class="member-info">${m.title}, ${m.company}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // Build perks section
  const perksList = exclusivePerks.length > 0
    ? exclusivePerks.map(p => `<li>${p}</li>`).join('\n')
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
    .header { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header .subtitle { color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .invitation-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #00b894; }
    .invitation-card h3 { color: #00b894; margin: 0 0 12px 0; font-size: 22px; }
    ${memberCount ? `.member-count { font-size: 32px; font-weight: bold; color: #00b894; margin: 12px 0; }` : ''}
    .benefits-box { background: #e8f8f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00b894; }
    .events-box { background: #fff5e6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .event-item { background: white; padding: 12px; border-radius: 6px; margin-top: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .event-date { color: #e67e22; font-size: 14px; margin-top: 4px; }
    .event-desc { color: #666; font-size: 14px; margin-top: 4px; }
    .members-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .members-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
    .member-card { background: white; padding: 12px 16px; border-radius: 6px; flex: 1 1 180px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .member-name { font-weight: 600; color: #333; }
    .member-info { font-size: 13px; color: #666; }
    .perks-box { background: #fef9e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12; }
    .cta-button { display: inline-block; background: #00b894; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .cta-button:hover { background: #00a085; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${communityName}</h1>
      <div class="subtitle">You're Invited to Join Our Inner Circle</div>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I hope this message finds you well! I'm reaching out with an invitation that I've been excited to share with you.</p>

      <div class="invitation-card">
        <h3>You're Invited!</h3>
        ${memberCount ? `<div class="member-count">${memberCount}+</div><div style="color: #666;">Champions Already Joined</div>` : ''}
        <p style="margin: 12px 0 0 0; color: #555;">${communityDescription || 'An exclusive community of customer champions who shape our product direction and connect with industry peers.'}</p>
      </div>

      <p>Given your incredible contributions to our partnership and your thoughtful insights over the years, I believe you'd be a perfect fit for our ${communityName}.</p>

      <div class="benefits-box">
        <strong>What You Get as a Member:</strong>
        <ul>
          ${benefitsList}
        </ul>
      </div>

      ${eventsSection}

      ${membersSection}

      ${exclusivePerks.length > 0 ? `
      <div class="perks-box">
        <strong>Exclusive Member Perks:</strong>
        <ul>
          ${perksList}
        </ul>
      </div>
      ` : ''}

      ${joinLink ? `
      <p style="text-align: center;">
        <a href="${joinLink}" class="cta-button">Join the ${communityName}</a>
      </p>
      ` : ''}

      <p>There's no obligation - I simply wanted to extend this invitation because I think you'd both benefit from and contribute to this community.</p>

      <p>Would you be interested in learning more? I'm happy to hop on a quick call to share more details or answer any questions.</p>

      <p>
        Warmly,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>This invitation is extended to select champions who have demonstrated exceptional partnership and engagement.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text benefits
  const benefitsText = communityBenefits.length > 0
    ? communityBenefits.map(b => `- ${b}`).join('\n')
    : `- Direct influence on product roadmap priorities
- Exclusive early access to new features
- Networking with industry peers and leaders
- Quarterly executive briefings and insights
- Recognition at our annual customer conference`;

  // Build plain text events
  const eventsText = upcomingEvents.length > 0
    ? '\nUpcoming Community Events:\n' + upcomingEvents.map(e =>
      `- ${e.title} (${e.date})${e.description ? '\n  ' + e.description : ''}`
    ).join('\n') + '\n'
    : '';

  // Build plain text members
  const membersText = featuredMembers.length > 0
    ? '\nConnect with Fellow Champions:\n' + featuredMembers.map(m =>
      `- ${m.name}, ${m.title} at ${m.company}`
    ).join('\n') + '\n'
    : '';

  // Build plain text perks
  const perksText = exclusivePerks.length > 0
    ? '\nExclusive Member Perks:\n' + exclusivePerks.map(p => `- ${p}`).join('\n') + '\n'
    : '';

  const bodyText = `
Hi ${firstName},

I hope this message finds you well! I'm reaching out with an invitation that I've been excited to share with you.

=== YOU'RE INVITED: ${communityName.toUpperCase()} ===
${memberCount ? `${memberCount}+ Champions Already Joined\n` : ''}
${communityDescription || 'An exclusive community of customer champions who shape our product direction and connect with industry peers.'}

Given your incredible contributions to our partnership and your thoughtful insights over the years, I believe you'd be a perfect fit for our ${communityName}.

What You Get as a Member:
${benefitsText}
${eventsText}${membersText}${perksText}
${joinLink ? `Join here: ${joinLink}\n` : ''}
There's no obligation - I simply wanted to extend this invitation because I think you'd both benefit from and contribute to this community.

Would you be interested in learning more? I'm happy to hop on a quick call to share more details or answer any questions.

Warmly,
${csmName}
${csmTitle}
${csmEmail}

---
This invitation is extended to select champions who have demonstrated exceptional partnership and engagement.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateChampionCommunityEmail;
