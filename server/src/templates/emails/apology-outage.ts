/**
 * Apology Email Template - System Outage
 * PRD-046: Apology Email Generator
 *
 * Template for apologizing after service outages with severity-aware tone
 */

export interface OutageApologyContext {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmPhone?: string;
  csmEmail?: string;

  // Outage details
  incidentDate: string;
  incidentDuration: string; // "3 hours"
  startTime?: string; // "2:00 PM EST"
  endTime?: string; // "5:00 PM EST"
  affectedServices: string[];
  rootCause?: string;

  // Customer impact
  customerImpact: string; // Description of how it affected them
  supportTickets?: number;

  // Health context
  healthScore?: number;
  healthScoreDrop?: number;
  arrValue: number;
  relationshipYears?: number;

  // Remediation
  immediateActions?: string[];
  preventionMeasures?: string[];

  // Compensation (optional)
  compensationOffer?: {
    type: 'credit' | 'discount' | 'extension' | 'none';
    amount?: number;
    description?: string;
  };

  // Follow-up
  followUpDate?: string;
  followUpType?: 'call' | 'meeting' | 'email';
}

export interface OutageApologyResult {
  subject: string;
  body: string;
  bodyHtml: string;
  suggestedFollowUp: {
    date: string;
    type: string;
    notes: string;
  };
  internalNotes: string[];
}

/**
 * Generate subject line based on outage severity
 */
function generateSubject(context: OutageApologyContext): string {
  const isHighValue = context.arrValue >= 100000;
  const isSevere = context.healthScoreDrop && context.healthScoreDrop >= 5;

  if (isSevere || isHighValue) {
    return `Sincere Apology for ${formatDate(context.incidentDate)}'s Outage - ${context.customerName}`;
  }

  return `Apology Regarding Recent Service Interruption - ${context.customerName}`;
}

/**
 * Get opening paragraph based on relationship and severity
 */
function getOpening(context: OutageApologyContext): string {
  const firstName = context.contactName.split(' ')[0];
  const isLongTerm = context.relationshipYears && context.relationshipYears >= 2;
  const isHighValue = context.arrValue >= 100000;

  if (isLongTerm || isHighValue) {
    return `I'm reaching out personally to apologize for the platform outage on ${formatDate(context.incidentDate)} that impacted your team's operations.`;
  }

  return `I wanted to reach out directly to apologize for the service interruption on ${formatDate(context.incidentDate)} that affected ${context.customerName}.`;
}

/**
 * Format what happened section
 */
function getWhatHappened(context: OutageApologyContext): string {
  const timeRange = context.startTime && context.endTime
    ? ` between ${context.startTime} and ${context.endTime}`
    : '';

  const duration = context.incidentDuration
    ? `, lasting approximately ${context.incidentDuration},`
    : '';

  const services = context.affectedServices.length > 0
    ? context.affectedServices.join(', ')
    : 'our platform services';

  let text = `On ${formatDate(context.incidentDate)}${timeRange}${duration} ${services} experienced an outage.`;

  if (context.rootCause) {
    text += ` This was caused by ${context.rootCause}. This was unacceptable, and I take full responsibility for the impact on your team.`;
  } else {
    text += ' This was unacceptable, and I want to assure you we take full responsibility.';
  }

  return text;
}

/**
 * Format customer impact section
 */
function getCustomerImpact(context: OutageApologyContext): string {
  let text = `We understand this affected ${context.customerImpact}`;

  if (context.supportTickets && context.supportTickets > 0) {
    text += ` We're aware of the ${context.supportTickets} support ticket${context.supportTickets > 1 ? 's' : ''} your team submitted and are prioritizing their resolution.`;
  }

  return text;
}

/**
 * Format what we've done section
 */
function getImmediateActions(context: OutageApologyContext): string[] {
  if (context.immediateActions && context.immediateActions.length > 0) {
    return context.immediateActions;
  }

  return [
    'Root cause identified and fixed',
    'Redundancy improvements deployed',
    context.supportTickets && context.supportTickets > 0
      ? `Your ${context.supportTickets} open support ticket${context.supportTickets > 1 ? 's are' : ' is'} being prioritized`
      : 'Support team notified and standing by',
  ].filter(Boolean) as string[];
}

/**
 * Format prevention measures section
 */
function getPreventionMeasures(context: OutageApologyContext): string[] {
  if (context.preventionMeasures && context.preventionMeasures.length > 0) {
    return context.preventionMeasures;
  }

  return [
    'Additional failover testing implemented',
    'Enhanced monitoring alerts deployed',
    'Detailed post-mortem being prepared for affected customers',
  ];
}

/**
 * Format compensation section if applicable
 */
function getCompensationSection(context: OutageApologyContext): string | null {
  if (!context.compensationOffer || context.compensationOffer.type === 'none') {
    return null;
  }

  switch (context.compensationOffer.type) {
    case 'credit':
      return context.compensationOffer.amount
        ? `I'd like to offer ${context.customerName} a service credit of $${context.compensationOffer.amount.toLocaleString()} as a gesture of goodwill.`
        : `I'd like to offer ${context.customerName} a service credit as a gesture of goodwill.`;

    case 'discount':
      return context.compensationOffer.amount
        ? `As a gesture of goodwill, I'd like to offer ${context.customerName} a ${context.compensationOffer.amount}% discount on your next invoice.`
        : 'As a gesture of goodwill, I\'d like to discuss a discount on your next renewal.';

    case 'extension':
      return context.compensationOffer.description
        ? `I'd like to offer ${context.compensationOffer.description} as a gesture of goodwill.`
        : `I'd like to offer a contract extension as a gesture of goodwill.`;

    default:
      return null;
  }
}

/**
 * Format follow-up section
 */
function getFollowUp(context: OutageApologyContext): string {
  if (context.followUpDate && context.followUpType) {
    const type = context.followUpType === 'call' ? 'a call' :
      context.followUpType === 'meeting' ? 'a meeting' : 'a follow-up';

    return `Additionally, I'm scheduling ${type} for ${context.followUpDate} to ensure your team is fully back on track.`;
  }

  return 'I\'d also like to schedule a brief call this week to ensure your team has fully recovered from this disruption.';
}

/**
 * Get closing statement
 */
function getClosing(context: OutageApologyContext): string {
  const isLongTerm = context.relationshipYears && context.relationshipYears >= 2;

  if (isLongTerm) {
    return 'I value our partnership deeply, and I\'m committed to earning back your trust.';
  }

  return 'I\'m committed to ensuring this doesn\'t happen again and to earning your continued trust.';
}

/**
 * Get signature
 */
function getSignature(context: OutageApologyContext): string {
  const lines = [
    'Sincerely,',
    context.csmName,
  ];

  if (context.csmPhone) {
    lines.push(`Direct: ${context.csmPhone}`);
  }

  if (context.csmEmail) {
    lines.push(context.csmEmail);
  }

  lines.push('');
  lines.push('Please reach out anytime - I\'m here for you.');

  return lines.join('\n');
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Generate internal notes for CSM reference
 */
function generateInternalNotes(context: OutageApologyContext): string[] {
  const notes: string[] = [];

  if (context.healthScoreDrop && context.healthScoreDrop >= 5) {
    notes.push(`ALERT: Health score dropped ${context.healthScoreDrop} points - monitor closely`);
  }

  if (context.arrValue >= 100000) {
    notes.push(`High-value account ($${(context.arrValue / 1000).toFixed(0)}K ARR) - escalate if no response in 24h`);
  }

  if (context.supportTickets && context.supportTickets >= 3) {
    notes.push(`Multiple support tickets (${context.supportTickets}) - coordinate with support team`);
  }

  if (context.compensationOffer && context.compensationOffer.type !== 'none') {
    notes.push('Compensation offered - document in CRM and track acceptance');
  }

  notes.push('Schedule follow-up call within 48 hours');
  notes.push('Update activity log after email is sent');

  return notes;
}

/**
 * Main template generator
 */
export function generateOutageApologyEmail(context: OutageApologyContext): OutageApologyResult {
  const firstName = context.contactName.split(' ')[0];
  const subject = generateSubject(context);
  const opening = getOpening(context);
  const whatHappened = getWhatHappened(context);
  const customerImpact = getCustomerImpact(context);
  const immediateActions = getImmediateActions(context);
  const preventionMeasures = getPreventionMeasures(context);
  const compensation = getCompensationSection(context);
  const followUp = getFollowUp(context);
  const closing = getClosing(context);
  const signature = getSignature(context);

  // Build plain text body
  const bodyParts = [
    `Hi ${firstName},`,
    '',
    opening,
    '',
    '**What Happened:**',
    whatHappened,
    '',
    `**The Impact on ${context.customerName}:**`,
    customerImpact,
    '',
    '**What We\'ve Done:**',
    ...immediateActions.map(action => `- ${action}`),
    '',
    '**What We\'re Doing to Prevent This:**',
    ...preventionMeasures.map(measure => `- ${measure}`),
    '',
  ];

  if (compensation) {
    bodyParts.push('**Making This Right:**');
    bodyParts.push(compensation);
    bodyParts.push('');
  }

  bodyParts.push(followUp);
  bodyParts.push('');
  bodyParts.push(closing);
  bodyParts.push('');
  bodyParts.push(signature);

  const body = bodyParts.join('\n');

  // Build HTML version
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    p { margin: 16px 0; }
    h3 { color: #111; margin: 24px 0 8px; font-size: 14px; font-weight: 600; }
    ul { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    .signature { margin-top: 32px; color: #666; }
  </style>
</head>
<body>
  <p>Hi ${firstName},</p>

  <p>${opening}</p>

  <h3>What Happened:</h3>
  <p>${whatHappened}</p>

  <h3>The Impact on ${context.customerName}:</h3>
  <p>${customerImpact}</p>

  <h3>What We've Done:</h3>
  <ul>
    ${immediateActions.map(action => `<li>${action}</li>`).join('\n    ')}
  </ul>

  <h3>What We're Doing to Prevent This:</h3>
  <ul>
    ${preventionMeasures.map(measure => `<li>${measure}</li>`).join('\n    ')}
  </ul>

  ${compensation ? `<h3>Making This Right:</h3>\n  <p>${compensation}</p>` : ''}

  <p>${followUp}</p>

  <p>${closing}</p>

  <div class="signature">
    ${signature.split('\n').join('<br>')}
  </div>
</body>
</html>`;

  // Generate follow-up suggestion
  const suggestedFollowUp = {
    date: context.followUpDate || getDefaultFollowUpDate(),
    type: context.followUpType || 'call',
    notes: `Follow-up after ${formatDate(context.incidentDate)} outage apology. Verify team is back on track and address any remaining concerns.`,
  };

  return {
    subject,
    body,
    bodyHtml: bodyHtml.trim(),
    suggestedFollowUp,
    internalNotes: generateInternalNotes(context),
  };
}

/**
 * Get default follow-up date (3 business days from now)
 */
function getDefaultFollowUpDate(): string {
  const date = new Date();
  let daysToAdd = 3;

  while (daysToAdd > 0) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysToAdd--;
    }
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default {
  generateOutageApologyEmail,
};
