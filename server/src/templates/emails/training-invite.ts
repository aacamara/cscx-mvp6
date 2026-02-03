/**
 * Training Invitation Email Template
 * PRD-038: Training Invitation Personalization
 *
 * Generates personalized training invitation emails based on:
 * - Recipient's role
 * - Feature adoption gaps
 * - Skill gaps
 * - Training relevance
 */

export interface TrainingInviteData {
  recipient: {
    name: string;
    email: string;
    role?: string;
    company?: string;
  };
  training: {
    title: string;
    description: string;
    topic: string;
    format: 'webinar' | 'workshop' | 'self-paced' | 'one-on-one';
    scheduledAt: string; // ISO date string
    timezone: string;
    durationMinutes: number;
    presenterName?: string;
    meetingUrl?: string;
    registrationUrl?: string;
  };
  personalization: {
    angle: string; // Main personalization hook
    adoptionGaps?: string[]; // Features they haven't fully adopted
    skillGaps?: string[]; // Skills they could improve
    benefits: string[]; // Specific benefits for this person
    relevanceReason?: string; // Why this training is relevant
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
    calendlyUrl?: string;
  };
  customer?: {
    name: string;
    healthScore?: number;
  };
}

export interface TrainingInviteResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  preheader: string;
}

/**
 * Generate personalized training invitation email
 */
export function generateTrainingInviteEmail(data: TrainingInviteData): TrainingInviteResult {
  const { recipient, training, personalization, csm, customer } = data;

  // Format the date nicely
  const formattedDate = formatTrainingDate(training.scheduledAt, training.timezone);
  const formattedDuration = formatDuration(training.durationMinutes);
  const formatLabel = getFormatLabel(training.format);

  // Personalized subject line based on angle
  const subject = generateSubjectLine(data);

  // Preheader text for email preview
  const preheader = `${training.title} - ${formattedDate}. ${personalization.angle}`;

  // Build benefits list
  const benefitsList = personalization.benefits
    .map(b => `<li style="margin: 8px 0; color: #333;">${b}</li>`)
    .join('\n');

  const benefitsText = personalization.benefits
    .map(b => `- ${b}`)
    .join('\n');

  // Build adoption gap mention if applicable
  let gapMention = '';
  let gapMentionText = '';
  if (personalization.adoptionGaps && personalization.adoptionGaps.length > 0) {
    const gapList = personalization.adoptionGaps.slice(0, 3).join(', ');
    gapMention = `<p style="margin: 16px 0; color: #555;">I noticed your team hasn't fully explored <strong>${gapList}</strong> yet - this training will help you get the most value from these capabilities.</p>`;
    gapMentionText = `\nI noticed your team hasn't fully explored ${gapList} yet - this training will help you get the most value from these capabilities.\n`;
  }

  // CTA section
  const ctaUrl = training.registrationUrl || training.meetingUrl || '#';
  const ctaSection = `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ctaUrl}" style="display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Register Now</a>
    </div>
  `;

  // Alternative date offer
  const alternativeOffer = csm.calendlyUrl
    ? `<p style="margin: 16px 0; color: #666; font-size: 14px;">Can't make this date? <a href="${csm.calendlyUrl}" style="color: #e63946;">Schedule a one-on-one session</a> or reply to this email and I'll find an alternative for you.</p>`
    : `<p style="margin: 16px 0; color: #666; font-size: 14px;">Can't make this date? Reply to this email and I'll find an alternative session for you.</p>`;

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #e63946; padding-bottom: 16px; margin-bottom: 24px; }
    .training-card { background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #e63946; }
    .detail-row { display: flex; margin: 8px 0; }
    .detail-label { font-weight: 600; color: #666; min-width: 100px; }
    .detail-value { color: #333; }
    .benefits-section { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .highlight { color: #e63946; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #333; font-size: 24px;">${training.title}</h1>
      <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">${formatLabel} Training${customer ? ` for ${customer.name}` : ''}</p>
    </div>

    <p>Hi ${recipient.name.split(' ')[0]},</p>

    <p>${personalization.angle}</p>

    ${gapMention}

    <p>I'd like to invite you to our <strong>${training.title}</strong> training${training.presenterName ? ` led by ${training.presenterName}` : ''}.</p>

    <div class="training-card">
      <h3 style="margin: 0 0 16px 0; color: #333;">Training Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 100px; vertical-align: top;"><strong>Date:</strong></td>
          <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Duration:</strong></td>
          <td style="padding: 8px 0; color: #333;">${formattedDuration}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Format:</strong></td>
          <td style="padding: 8px 0; color: #333;">${formatLabel}${training.format === 'webinar' ? ' with live Q&A' : ''}</td>
        </tr>
        ${training.meetingUrl ? `
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Location:</strong></td>
          <td style="padding: 8px 0; color: #333;"><a href="${training.meetingUrl}" style="color: #e63946;">Join online</a></td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div class="benefits-section">
      <h3 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">What You'll Learn</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${benefitsList}
      </ul>
    </div>

    ${ctaSection}

    ${alternativeOffer}

    <p>Looking forward to seeing you there!</p>

    <div class="footer">
      <p style="margin: 0;">Best regards,</p>
      <p style="margin: 8px 0 0 0;"><strong>${csm.name}</strong></p>
      <p style="margin: 4px 0;">${csm.title || 'Customer Success Manager'}</p>
      <p style="margin: 4px 0;">${csm.email}${csm.phone ? ` | ${csm.phone}` : ''}</p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const bodyText = `
${training.title}
${formatLabel} Training${customer ? ` for ${customer.name}` : ''}
${'='.repeat(50)}

Hi ${recipient.name.split(' ')[0]},

${personalization.angle}
${gapMentionText}
I'd like to invite you to our ${training.title} training${training.presenterName ? ` led by ${training.presenterName}` : ''}.

TRAINING DETAILS
----------------
Date: ${formattedDate}
Duration: ${formattedDuration}
Format: ${formatLabel}${training.format === 'webinar' ? ' with live Q&A' : ''}
${training.meetingUrl ? `Location: ${training.meetingUrl}` : ''}

WHAT YOU'LL LEARN
-----------------
${benefitsText}

${training.registrationUrl ? `Register here: ${training.registrationUrl}` : ''}
${training.meetingUrl ? `Join here: ${training.meetingUrl}` : ''}

Can't make this date? Reply to this email and I'll find an alternative session for you.

Looking forward to seeing you there!

Best regards,
${csm.name}
${csm.title || 'Customer Success Manager'}
${csm.email}${csm.phone ? ` | ${csm.phone}` : ''}
`.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    preheader,
  };
}

/**
 * Generate a personalized subject line
 */
function generateSubjectLine(data: TrainingInviteData): string {
  const { recipient, training, personalization } = data;
  const firstName = recipient.name.split(' ')[0];

  // Different subject line strategies based on personalization context
  if (personalization.adoptionGaps && personalization.adoptionGaps.length > 0) {
    const mainGap = personalization.adoptionGaps[0];
    return `Unlock ${mainGap} - Training on ${formatShortDate(training.scheduledAt)}`;
  }

  if (recipient.role?.toLowerCase().includes('executive') || recipient.role?.toLowerCase().includes('director')) {
    return `${firstName}, Strategic Training: ${training.title}`;
  }

  if (training.topic === 'onboarding') {
    return `Welcome Training: Get Started with ${training.title}`;
  }

  // Default subject
  return `You're Invited: ${training.title} - ${formatShortDate(training.scheduledAt)}`;
}

/**
 * Format training date for display
 */
function formatTrainingDate(isoDate: string, timezone: string): string {
  try {
    const date = new Date(isoDate);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    };
    return date.toLocaleDateString('en-US', options);
  } catch {
    return isoDate;
  }
}

/**
 * Format short date for subject lines
 */
function formatShortDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`;
}

/**
 * Get human-readable format label
 */
function getFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    webinar: 'Live Webinar',
    workshop: 'Interactive Workshop',
    'self-paced': 'Self-Paced Course',
    'one-on-one': 'Personal Training Session',
  };
  return labels[format] || 'Training';
}

/**
 * Generate bulk training invitations with personalization
 */
export function generateBulkTrainingInvites(
  training: TrainingInviteData['training'],
  recipients: Array<{
    recipient: TrainingInviteData['recipient'];
    personalization: TrainingInviteData['personalization'];
  }>,
  csm: TrainingInviteData['csm'],
  customer?: TrainingInviteData['customer']
): Array<TrainingInviteResult & { recipientEmail: string }> {
  return recipients.map(({ recipient, personalization }) => {
    const result = generateTrainingInviteEmail({
      recipient,
      training,
      personalization,
      csm,
      customer,
    });
    return {
      ...result,
      recipientEmail: recipient.email,
    };
  });
}

export default generateTrainingInviteEmail;
