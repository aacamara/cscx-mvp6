/**
 * Champion Check-in Email Template
 * PRD-032: Champion Nurture Sequence
 * Purpose: Personal connection, no agenda, relationship building
 */

export interface ChampionCheckinVariables {
  championName: string;
  championTitle?: string;
  customerName: string;
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  lastInteractionDate?: string;
  lastInteractionContext?: string;
  sharedInterests?: string[];
  recentWins?: string[];
  calendarLink?: string;
  personalNote?: string;
  suggestedTopics?: string[];
}

export function generateChampionCheckinEmail(variables: ChampionCheckinVariables): {
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
    lastInteractionDate,
    lastInteractionContext,
    sharedInterests = [],
    recentWins = [],
    calendarLink,
    personalNote,
    suggestedTopics = [],
  } = variables;

  const firstName = championName.split(' ')[0];

  const subject = `Coffee Catch-up? I'd Love Your Perspective`;

  // Build recent wins section
  const winsSection = recentWins.length > 0 ? `
    <div class="wins-box">
      <strong>Some Things I've Noticed Going Well:</strong>
      <ul>
        ${recentWins.map(w => `<li>${w}</li>`).join('\n')}
      </ul>
    </div>
  ` : '';

  // Build shared interests section
  const interestsSection = sharedInterests.length > 0 ? `
    <p>I also thought we could chat about ${sharedInterests.slice(0, 2).join(' or ')} - I know that's been on your radar lately.</p>
  ` : '';

  // Build suggested topics section
  const topicsSection = suggestedTopics.length > 0 ? `
    <div class="topics-box">
      <strong>Some things we could discuss (or not - totally up to you!):</strong>
      <ul>
        ${suggestedTopics.map(t => `<li>${t}</li>`).join('\n')}
      </ul>
    </div>
  ` : '';

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%); padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header .subtitle { color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .casual-note { background: #fef9e7; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic; border-left: 4px solid #fdcb6e; }
    .wins-box { background: #e8f8f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00b894; }
    .topics-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #fd79a8; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .cta-button:hover { background: #e84393; }
    .no-pressure { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center; color: #666; font-size: 14px; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Let's Catch Up!</h1>
      <div class="subtitle">No agenda, just a friendly conversation</div>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I hope you're doing well! ${lastInteractionDate ? `It's been a little while since we last connected${lastInteractionContext ? ` (${lastInteractionContext})` : ''}, and I` : 'I'} wanted to reach out to see how things are going - both at ${customerName} and for you personally.</p>

      <div class="casual-note">
        This isn't a check-in with an agenda or anything I need from you. I genuinely just wanted to catch up and hear what's on your mind.
      </div>

      ${winsSection}

      ${interestsSection}

      ${topicsSection}

      ${personalNote ? `
      <p style="background: #fff3e0; padding: 15px; border-radius: 6px; border-left: 4px solid #ff9800;">${personalNote}</p>
      ` : ''}

      <p>Would you have 20-30 minutes for a virtual coffee sometime in the next couple of weeks? No preparation needed - just a chance to connect.</p>

      ${calendarLink ? `
      <p style="text-align: center;">
        <a href="${calendarLink}" class="cta-button">Find a Time to Chat</a>
      </p>
      ` : ''}

      <div class="no-pressure">
        No pressure at all if you're too busy right now - just reply and let me know, and we can connect another time.
      </div>

      <p>Looking forward to hearing from you!</p>

      <p>
        Cheers,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>Building genuine relationships is what makes partnerships successful. This is just me wanting to stay connected.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text wins
  const winsText = recentWins.length > 0
    ? '\nSome Things I\'ve Noticed Going Well:\n' + recentWins.map(w => `- ${w}`).join('\n') + '\n'
    : '';

  // Build plain text interests
  const interestsText = sharedInterests.length > 0
    ? `\nI also thought we could chat about ${sharedInterests.slice(0, 2).join(' or ')} - I know that's been on your radar lately.\n`
    : '';

  // Build plain text topics
  const topicsText = suggestedTopics.length > 0
    ? '\nSome things we could discuss (or not - totally up to you!):\n' + suggestedTopics.map(t => `- ${t}`).join('\n') + '\n'
    : '';

  const bodyText = `
Hi ${firstName},

I hope you're doing well! ${lastInteractionDate ? `It's been a little while since we last connected${lastInteractionContext ? ` (${lastInteractionContext})` : ''}, and I` : 'I'} wanted to reach out to see how things are going - both at ${customerName} and for you personally.

This isn't a check-in with an agenda or anything I need from you. I genuinely just wanted to catch up and hear what's on your mind.
${winsText}${interestsText}${topicsText}
${personalNote ? `${personalNote}\n` : ''}
Would you have 20-30 minutes for a virtual coffee sometime in the next couple of weeks? No preparation needed - just a chance to connect.

${calendarLink ? `Find a time that works: ${calendarLink}\n` : ''}
No pressure at all if you're too busy right now - just reply and let me know, and we can connect another time.

Looking forward to hearing from you!

Cheers,
${csmName}
${csmTitle}
${csmEmail}

---
Building genuine relationships is what makes partnerships successful. This is just me wanting to stay connected.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateChampionCheckinEmail;
