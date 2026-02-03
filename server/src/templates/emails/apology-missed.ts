/**
 * Apology Email Template - Missed Commitment
 * PRD-046: Apology Email Generator
 *
 * Template for apologizing after missed commitments (deadlines, deliverables, meetings, etc.)
 */

export interface MissedCommitmentApologyContext {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmPhone?: string;
  csmEmail?: string;

  // Missed commitment details
  commitmentType: 'deadline' | 'deliverable' | 'meeting' | 'feature' | 'follow_up' | 'other';
  commitmentDescription: string;
  originalDate?: string;
  missedBy?: string; // "2 days", "1 week"
  reason?: string; // Internal reason (use carefully)

  // Customer impact
  customerImpact?: string;
  dependentActions?: string[]; // What the customer was waiting to do

  // Health context
  healthScore?: number;
  arrValue: number;
  relationshipYears?: number;
  previousMisses?: number; // Number of previous missed commitments

  // Resolution
  newCommitment?: {
    description: string;
    date: string;
    confidence: 'confirmed' | 'high' | 'medium';
  };
  immediateMitigation?: string[];

  // Compensation (optional)
  compensationOffer?: {
    type: 'credit' | 'discount' | 'feature' | 'priority' | 'none';
    amount?: number;
    description?: string;
  };

  // Follow-up
  followUpDate?: string;
}

export interface MissedCommitmentApologyResult {
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
 * Generate subject line
 */
function generateSubject(context: MissedCommitmentApologyContext): string {
  const commitmentLabels: Record<string, string> = {
    deadline: 'Project Timeline',
    deliverable: 'Deliverable',
    meeting: 'Meeting',
    feature: 'Feature Commitment',
    follow_up: 'Follow-up',
    other: 'Commitment',
  };

  const label = commitmentLabels[context.commitmentType] || 'Commitment';

  if (context.previousMisses && context.previousMisses > 0) {
    return `Sincere Apology: ${label} Update - ${context.customerName}`;
  }

  return `Apology Regarding ${label} - ${context.customerName}`;
}

/**
 * Get opening based on context
 */
function getOpening(context: MissedCommitmentApologyContext): string {
  const isRepeatIssue = context.previousMisses && context.previousMisses > 0;
  const isHighValue = context.arrValue >= 100000;
  const isLongTerm = context.relationshipYears && context.relationshipYears >= 2;

  if (isRepeatIssue) {
    return `I'm writing to sincerely apologize for once again missing a commitment to ${context.customerName}. I understand this is becoming a pattern, and that's completely unacceptable. You deserve better, and I take full responsibility for this failure.`;
  }

  if (context.commitmentType === 'meeting') {
    return `I want to personally apologize for missing our scheduled meeting. I know your time is valuable, and there's no excuse for not being there. I'm truly sorry for any inconvenience this caused.`;
  }

  if (context.commitmentType === 'deadline' || context.commitmentType === 'deliverable') {
    return `I'm reaching out to apologize for not delivering ${context.commitmentDescription} by the committed date. I understand how this affects your planning, and I take full responsibility.`;
  }

  if (isHighValue || isLongTerm) {
    return `I wanted to personally apologize for not following through on my commitment regarding ${context.commitmentDescription}. ${isLongTerm ? `Given our ${context.relationshipYears}-year partnership, ` : ''}This isn't the standard you should expect from me.`;
  }

  return `I'm writing to apologize for missing my commitment regarding ${context.commitmentDescription}. I understand how important reliability is in our partnership.`;
}

/**
 * Format commitment details
 */
function getCommitmentDetails(context: MissedCommitmentApologyContext): string {
  let text = `I had committed to ${context.commitmentDescription}`;

  if (context.originalDate) {
    text += ` by ${formatDate(context.originalDate)}`;
  }

  if (context.missedBy) {
    text += `. This was ${context.missedBy} ago, and I should have communicated with you much sooner`;
  }

  text += '.';

  return text;
}

/**
 * Format impact section (if applicable)
 */
function getImpactSection(context: MissedCommitmentApologyContext): string | null {
  if (!context.customerImpact && (!context.dependentActions || context.dependentActions.length === 0)) {
    return null;
  }

  let text = '';

  if (context.customerImpact) {
    text = `I understand this ${context.customerImpact}`;
  }

  if (context.dependentActions && context.dependentActions.length > 0) {
    if (text) {
      text += ` I know this delayed your ability to:`;
    } else {
      text = 'I know this delayed your ability to:';
    }
  }

  return text;
}

/**
 * Format new commitment section
 */
function getNewCommitment(context: MissedCommitmentApologyContext): string | null {
  if (!context.newCommitment) {
    return null;
  }

  const confidence = context.newCommitment.confidence === 'confirmed'
    ? 'I\'m confident we will'
    : context.newCommitment.confidence === 'high'
      ? 'We are committed to'
      : 'We are targeting to';

  return `${confidence} ${context.newCommitment.description} by ${formatDate(context.newCommitment.date)}. I will keep you updated on progress and immediately communicate if anything changes.`;
}

/**
 * Format immediate mitigation steps
 */
function getImmediateMitigation(context: MissedCommitmentApologyContext): string[] {
  if (context.immediateMitigation && context.immediateMitigation.length > 0) {
    return context.immediateMitigation;
  }

  const steps: string[] = [];

  switch (context.commitmentType) {
    case 'deadline':
    case 'deliverable':
      steps.push('Prioritized this work above other tasks');
      steps.push('Daily progress updates until delivery');
      break;
    case 'meeting':
      steps.push('Immediate rescheduling at your earliest convenience');
      steps.push('Calendar reminders and backup notifications set');
      break;
    case 'feature':
      steps.push('Engineering team briefed on priority');
      steps.push('Regular status updates scheduled');
      break;
    case 'follow_up':
      steps.push('Addressing your questions/requests now');
      steps.push('Setting recurring reminders to prevent future delays');
      break;
    default:
      steps.push('Immediate action being taken');
      steps.push('Process improvement to prevent recurrence');
  }

  return steps;
}

/**
 * Format compensation section
 */
function getCompensationSection(context: MissedCommitmentApologyContext): string | null {
  if (!context.compensationOffer || context.compensationOffer.type === 'none') {
    return null;
  }

  switch (context.compensationOffer.type) {
    case 'priority':
      return `Going forward, I'm flagging ${context.customerName} for priority handling on all requests. Your items will be at the top of my queue.`;

    case 'feature':
      return context.compensationOffer.description
        ? `As a gesture of goodwill, I'd like to offer ${context.compensationOffer.description}.`
        : 'I\'d like to discuss adding some additional value to your account to make up for this.';

    case 'credit':
      return context.compensationOffer.amount
        ? `I'd like to offer a service credit of $${context.compensationOffer.amount.toLocaleString()} as a gesture of goodwill.`
        : 'I\'d like to discuss a service credit to compensate for the inconvenience.';

    case 'discount':
      return context.compensationOffer.amount
        ? `I'd like to offer ${context.customerName} a ${context.compensationOffer.amount}% discount on your next invoice.`
        : 'I\'d like to discuss a discount as a gesture of goodwill.';

    default:
      return null;
  }
}

/**
 * Get accountability statement
 */
function getAccountabilityStatement(context: MissedCommitmentApologyContext): string {
  const isRepeatIssue = context.previousMisses && context.previousMisses > 0;

  if (isRepeatIssue) {
    return 'I know actions speak louder than words, especially given the previous misses. I\'m implementing specific changes to ensure this doesn\'t happen again, and I\'m committed to rebuilding your trust through consistent follow-through.';
  }

  if (context.commitmentType === 'meeting') {
    return 'I value our time together, and I\'ve made changes to ensure this doesn\'t happen again. You have my commitment that I will be fully present for our rescheduled meeting.';
  }

  return 'I take accountability for this miss. Reliability is fundamental to our partnership, and I\'m committed to doing better. You can count on me going forward.';
}

/**
 * Get signature
 */
function getSignature(context: MissedCommitmentApologyContext): string {
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
function generateInternalNotes(context: MissedCommitmentApologyContext): string[] {
  const notes: string[] = [];

  if (context.previousMisses && context.previousMisses > 0) {
    notes.push(`REPEAT MISS (${context.previousMisses + 1} total) - Requires internal review`);
    notes.push('Consider involving manager in follow-up');
  }

  if (context.arrValue >= 100000) {
    notes.push(`High-value account ($${(context.arrValue / 1000).toFixed(0)}K ARR) - Monitor sentiment closely`);
  }

  if (context.commitmentType === 'meeting') {
    notes.push('Reschedule immediately - offer multiple time slots');
  }

  if (context.newCommitment) {
    notes.push(`NEW COMMITMENT: ${context.newCommitment.description} by ${formatDate(context.newCommitment.date)}`);
    notes.push('Set reminders for 3 days before and day before deadline');
  }

  if (context.compensationOffer && context.compensationOffer.type !== 'none') {
    notes.push('Compensation offered - document in CRM');
  }

  notes.push('Update task tracking to ensure commitment is met');
  notes.push('Follow up within 48 hours of new commitment delivery');

  return notes;
}

/**
 * Main template generator
 */
export function generateMissedCommitmentApologyEmail(
  context: MissedCommitmentApologyContext
): MissedCommitmentApologyResult {
  const firstName = context.contactName.split(' ')[0];
  const subject = generateSubject(context);
  const opening = getOpening(context);
  const commitmentDetails = getCommitmentDetails(context);
  const impactSection = getImpactSection(context);
  const newCommitment = getNewCommitment(context);
  const immediateMitigation = getImmediateMitigation(context);
  const compensation = getCompensationSection(context);
  const accountability = getAccountabilityStatement(context);
  const signature = getSignature(context);

  // Build plain text body
  const bodyParts = [
    `Hi ${firstName},`,
    '',
    opening,
    '',
    '**What I Missed:**',
    commitmentDetails,
  ];

  if (impactSection) {
    bodyParts.push('');
    bodyParts.push('**The Impact:**');
    bodyParts.push(impactSection);

    if (context.dependentActions && context.dependentActions.length > 0) {
      context.dependentActions.forEach(action => {
        bodyParts.push(`- ${action}`);
      });
    }
  }

  bodyParts.push('');
  bodyParts.push('**What I\'m Doing About It:**');
  immediateMitigation.forEach(step => {
    bodyParts.push(`- ${step}`);
  });

  if (newCommitment) {
    bodyParts.push('');
    bodyParts.push('**New Commitment:**');
    bodyParts.push(newCommitment);
  }

  if (compensation) {
    bodyParts.push('');
    bodyParts.push('**Making This Right:**');
    bodyParts.push(compensation);
  }

  bodyParts.push('');
  bodyParts.push(accountability);
  bodyParts.push('');
  bodyParts.push(signature);

  const body = bodyParts.join('\n');

  // Build HTML version
  const dependentActionsHtml = context.dependentActions && context.dependentActions.length > 0
    ? `<ul>\n    ${context.dependentActions.map(action => `<li>${action}</li>`).join('\n    ')}\n  </ul>`
    : '';

  const impactHtml = impactSection
    ? `<h3>The Impact:</h3>\n  <p>${impactSection}</p>\n  ${dependentActionsHtml}`
    : '';

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

  <h3>What I Missed:</h3>
  <p>${commitmentDetails}</p>

  ${impactHtml}

  <h3>What I'm Doing About It:</h3>
  <ul>
    ${immediateMitigation.map(step => `<li>${step}</li>`).join('\n    ')}
  </ul>

  ${newCommitment ? `<h3>New Commitment:</h3>\n  <p>${newCommitment}</p>` : ''}

  ${compensation ? `<h3>Making This Right:</h3>\n  <p>${compensation}</p>` : ''}

  <p>${accountability}</p>

  <div class="signature">
    ${signature.split('\n').join('<br>')}
  </div>
</body>
</html>`;

  // Generate follow-up suggestion
  const followUpType = context.commitmentType === 'meeting' ? 'meeting' : 'call';
  const suggestedFollowUp = {
    date: context.followUpDate || (context.newCommitment
      ? context.newCommitment.date
      : getDefaultFollowUpDate()),
    type: followUpType,
    notes: context.newCommitment
      ? `Verify delivery of: ${context.newCommitment.description}`
      : 'Follow up on commitment resolution and customer satisfaction',
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
 * Get default follow-up date (1 week from now)
 */
function getDefaultFollowUpDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default {
  generateMissedCommitmentApologyEmail,
};
