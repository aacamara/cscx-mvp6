/**
 * Apology Email Template - Bug/Issue
 * PRD-046: Apology Email Generator
 *
 * Template for apologizing after product bugs or issues
 */

export interface BugApologyContext {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmPhone?: string;
  csmEmail?: string;

  // Bug details
  bugDescription: string;
  affectedFeature: string;
  reportedDate?: string;
  discoveredDate?: string;
  fixedDate?: string;
  bugSeverity: 'critical' | 'high' | 'medium' | 'low';

  // Customer impact
  customerImpact: string;
  dataAffected?: boolean;
  workflowBlocked?: boolean;

  // Health context
  healthScore?: number;
  arrValue: number;
  relationshipYears?: number;

  // Resolution
  resolutionSummary?: string;
  workaroundProvided?: string;
  preventionMeasures?: string[];

  // Compensation (optional)
  compensationOffer?: {
    type: 'credit' | 'discount' | 'extension' | 'premium_support' | 'none';
    amount?: number;
    description?: string;
  };

  // Follow-up
  followUpDate?: string;
}

export interface BugApologyResult {
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
 * Generate subject line based on bug severity
 */
function generateSubject(context: BugApologyContext): string {
  if (context.bugSeverity === 'critical' || context.dataAffected) {
    return `Sincere Apology for ${context.affectedFeature} Issue - ${context.customerName}`;
  }

  if (context.fixedDate) {
    return `Resolution Update: ${context.affectedFeature} Issue - ${context.customerName}`;
  }

  return `Apology Regarding ${context.affectedFeature} Issue - ${context.customerName}`;
}

/**
 * Get opening based on bug severity and impact
 */
function getOpening(context: BugApologyContext): string {
  const firstName = context.contactName.split(' ')[0];
  const isHighImpact = context.bugSeverity === 'critical' || context.bugSeverity === 'high';
  const isDataIssue = context.dataAffected;

  if (isDataIssue) {
    return `I'm reaching out personally regarding the ${context.affectedFeature} issue that affected your data. I understand how critical data integrity is to your operations, and I sincerely apologize for any concern or inconvenience this may have caused.`;
  }

  if (isHighImpact) {
    return `I wanted to reach out directly to apologize for the ${context.affectedFeature} issue that your team experienced. I understand how disruptive this was to your workflow, and I take full responsibility for the impact on ${context.customerName}.`;
  }

  return `I'm writing to apologize for the ${context.affectedFeature} issue that affected your team's experience. I know this wasn't the quality you expect from us, and I want to address it directly.`;
}

/**
 * Format issue details section
 */
function getIssueDetails(context: BugApologyContext): string {
  let text = context.bugDescription;

  if (context.discoveredDate) {
    text += ` We identified this issue on ${formatDate(context.discoveredDate)}`;
    if (context.reportedDate) {
      text += `, and we appreciate your team bringing it to our attention`;
    }
    text += '.';
  }

  return text;
}

/**
 * Format customer impact acknowledgment
 */
function getImpactAcknowledgment(context: BugApologyContext): string {
  let text = `I understand this ${context.customerImpact}`;

  if (context.workflowBlocked) {
    text += ' I know this blocked critical workflows, and that\'s not acceptable.';
  }

  if (context.dataAffected) {
    text += ' We take any data-related issues extremely seriously, and I want to assure you that we\'ve conducted a thorough investigation.';
  }

  return text;
}

/**
 * Format resolution section
 */
function getResolutionSection(context: BugApologyContext): string {
  if (context.fixedDate && context.resolutionSummary) {
    return `The issue has been resolved as of ${formatDate(context.fixedDate)}. ${context.resolutionSummary}`;
  }

  if (context.fixedDate) {
    return `The issue has been resolved as of ${formatDate(context.fixedDate)}. Your team should now have full functionality restored.`;
  }

  if (context.workaroundProvided) {
    return `While our engineering team works on a permanent fix, we've provided the following workaround: ${context.workaroundProvided}`;
  }

  return 'Our engineering team is treating this as a top priority and working on a fix that we expect to deploy shortly.';
}

/**
 * Format prevention measures
 */
function getPreventionMeasures(context: BugApologyContext): string[] {
  if (context.preventionMeasures && context.preventionMeasures.length > 0) {
    return context.preventionMeasures;
  }

  const measures = ['Enhanced testing protocols for the affected area'];

  if (context.bugSeverity === 'critical' || context.bugSeverity === 'high') {
    measures.push('Additional code review requirements implemented');
  }

  if (context.dataAffected) {
    measures.push('Data validation checks strengthened');
    measures.push('Automated data integrity monitoring added');
  }

  measures.push('Improved monitoring and alerting to catch issues faster');

  return measures;
}

/**
 * Format compensation section if applicable
 */
function getCompensationSection(context: BugApologyContext): string | null {
  if (!context.compensationOffer || context.compensationOffer.type === 'none') {
    return null;
  }

  switch (context.compensationOffer.type) {
    case 'premium_support':
      return `To help rebuild confidence, I'd like to offer ${context.customerName} priority support access for the next quarter, ensuring any future issues are addressed immediately.`;

    case 'credit':
      return context.compensationOffer.amount
        ? `As a gesture of goodwill, I'd like to offer a service credit of $${context.compensationOffer.amount.toLocaleString()}.`
        : 'I\'d like to discuss a service credit to make up for the inconvenience.';

    case 'discount':
      return context.compensationOffer.amount
        ? `I'd like to offer ${context.customerName} a ${context.compensationOffer.amount}% discount on your next invoice as a gesture of goodwill.`
        : 'I\'d like to discuss a discount on your next renewal as a gesture of goodwill.';

    case 'extension':
      return context.compensationOffer.description
        ? `I'd like to offer ${context.compensationOffer.description} to compensate for the disruption.`
        : 'I\'d like to offer a contract extension to compensate for this disruption.';

    default:
      return null;
  }
}

/**
 * Get closing statement
 */
function getClosing(context: BugApologyContext): string {
  if (context.dataAffected) {
    return 'I understand how important data reliability is to your operations. We\'ve taken this incident very seriously and made significant improvements to prevent a recurrence. I\'m committed to ensuring you can trust our platform completely.';
  }

  if (context.bugSeverity === 'critical' || context.bugSeverity === 'high') {
    return 'I\'m committed to regaining your trust and ensuring your team has a smooth experience going forward. Please don\'t hesitate to reach out if you have any questions or concerns.';
  }

  return 'Thank you for your patience while we resolved this. Please reach out anytime if you have questions or concerns.';
}

/**
 * Get signature
 */
function getSignature(context: BugApologyContext): string {
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
 * Generate internal notes
 */
function generateInternalNotes(context: BugApologyContext): string[] {
  const notes: string[] = [];

  if (context.bugSeverity === 'critical') {
    notes.push('CRITICAL BUG - Monitor customer sentiment closely');
  }

  if (context.dataAffected) {
    notes.push('DATA AFFECTED - Ensure customer confirms data integrity');
  }

  if (context.arrValue >= 100000) {
    notes.push(`High-value account ($${(context.arrValue / 1000).toFixed(0)}K ARR) - escalate if concerns persist`);
  }

  if (!context.fixedDate) {
    notes.push('Bug not yet fixed - send update when resolved');
  }

  if (context.compensationOffer && context.compensationOffer.type !== 'none') {
    notes.push('Compensation offered - document in CRM');
  }

  notes.push('Follow up within 3 business days to confirm satisfaction');

  return notes;
}

/**
 * Main template generator
 */
export function generateBugApologyEmail(context: BugApologyContext): BugApologyResult {
  const firstName = context.contactName.split(' ')[0];
  const subject = generateSubject(context);
  const opening = getOpening(context);
  const issueDetails = getIssueDetails(context);
  const impactAcknowledgment = getImpactAcknowledgment(context);
  const resolution = getResolutionSection(context);
  const preventionMeasures = getPreventionMeasures(context);
  const compensation = getCompensationSection(context);
  const closing = getClosing(context);
  const signature = getSignature(context);

  // Build plain text body
  const bodyParts = [
    `Hi ${firstName},`,
    '',
    opening,
    '',
    '**The Issue:**',
    issueDetails,
    '',
    '**Impact:**',
    impactAcknowledgment,
    '',
    '**Resolution:**',
    resolution,
    '',
    '**Preventing Future Issues:**',
    ...preventionMeasures.map(measure => `- ${measure}`),
    '',
  ];

  if (compensation) {
    bodyParts.push('**Making This Right:**');
    bodyParts.push(compensation);
    bodyParts.push('');
  }

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

  <h3>The Issue:</h3>
  <p>${issueDetails}</p>

  <h3>Impact:</h3>
  <p>${impactAcknowledgment}</p>

  <h3>Resolution:</h3>
  <p>${resolution}</p>

  <h3>Preventing Future Issues:</h3>
  <ul>
    ${preventionMeasures.map(measure => `<li>${measure}</li>`).join('\n    ')}
  </ul>

  ${compensation ? `<h3>Making This Right:</h3>\n  <p>${compensation}</p>` : ''}

  <p>${closing}</p>

  <div class="signature">
    ${signature.split('\n').join('<br>')}
  </div>
</body>
</html>`;

  // Generate follow-up suggestion
  const suggestedFollowUp = {
    date: context.followUpDate || getDefaultFollowUpDate(),
    type: 'call',
    notes: `Follow-up on ${context.affectedFeature} bug resolution. Confirm full functionality and address any remaining concerns.`,
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
  generateBugApologyEmail,
};
