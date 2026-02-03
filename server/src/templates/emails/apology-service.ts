/**
 * Apology Email Template - Service Failure
 * PRD-046: Apology Email Generator
 *
 * Template for apologizing after service quality failures (response times, SLA breaches, etc.)
 */

export interface ServiceApologyContext {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  csmName: string;
  csmPhone?: string;
  csmEmail?: string;

  // Service failure details
  failureType: 'response_time' | 'sla_breach' | 'quality' | 'availability' | 'support' | 'other';
  failureDescription: string;
  failureDate?: string;
  failureDuration?: string; // How long the issue persisted

  // SLA details (if applicable)
  slaMetric?: string; // "24-hour response time"
  slaActual?: string; // "72 hours"
  slaCommitment?: string; // "24 hours"

  // Customer impact
  customerImpact: string;
  ticketNumbers?: string[];
  escalationOccurred?: boolean;

  // Health context
  healthScore?: number;
  arrValue: number;
  contractTier?: 'basic' | 'professional' | 'enterprise' | 'premium';
  relationshipYears?: number;

  // Resolution
  resolutionSteps?: string[];
  processImprovements?: string[];
  staffingChanges?: string;

  // Compensation (optional)
  compensationOffer?: {
    type: 'credit' | 'discount' | 'extension' | 'upgrade' | 'dedicated_support' | 'none';
    amount?: number;
    description?: string;
  };

  // Follow-up
  followUpDate?: string;
}

export interface ServiceApologyResult {
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
 * Generate subject line based on failure type
 */
function generateSubject(context: ServiceApologyContext): string {
  if (context.escalationOccurred) {
    return `Personal Apology: Service Experience - ${context.customerName}`;
  }

  const failureLabels: Record<string, string> = {
    response_time: 'Response Time',
    sla_breach: 'SLA Commitment',
    quality: 'Service Quality',
    availability: 'Service Availability',
    support: 'Support Experience',
    other: 'Service',
  };

  const label = failureLabels[context.failureType] || 'Service';
  return `Apology Regarding ${label} - ${context.customerName}`;
}

/**
 * Get opening based on failure severity
 */
function getOpening(context: ServiceApologyContext): string {
  const isHighTier = context.contractTier === 'enterprise' || context.contractTier === 'premium';
  const isLongTerm = context.relationshipYears && context.relationshipYears >= 2;

  if (context.escalationOccurred) {
    return `I'm reaching out personally following your recent escalation. I want to sincerely apologize for the service experience that fell short of what you rightfully expect from us. ${isLongTerm ? `Given our ${context.relationshipYears}-year partnership, this is particularly disappointing, and I take full responsibility.` : 'This isn\'t the level of service we promise to deliver, and I take full responsibility.'}`;
  }

  if (context.failureType === 'sla_breach') {
    return `I want to personally apologize for failing to meet our SLA commitments to ${context.customerName}. ${isHighTier ? `As a ${context.contractTier} customer, you deserve better, ` : ''}I understand how critical reliable service is to your operations.`;
  }

  if (context.failureType === 'response_time') {
    return `I'm writing to apologize for the delayed response to your recent request. I understand that timely communication is essential, and we didn't deliver on that promise.`;
  }

  return `I wanted to reach out directly to apologize for the service experience that didn't meet your expectations. At ${context.customerName}, you deserve better, and I'm committed to making this right.`;
}

/**
 * Format the issue details
 */
function getIssueDetails(context: ServiceApologyContext): string {
  let text = context.failureDescription;

  if (context.slaMetric && context.slaCommitment && context.slaActual) {
    text += ` Our commitment was ${context.slaCommitment} for ${context.slaMetric}, but the actual was ${context.slaActual}.`;
  }

  if (context.failureDuration) {
    text += ` This issue persisted for ${context.failureDuration}.`;
  }

  if (context.ticketNumbers && context.ticketNumbers.length > 0) {
    text += ` This relates to ${context.ticketNumbers.length === 1 ? 'ticket' : 'tickets'} ${context.ticketNumbers.join(', ')}.`;
  }

  return text;
}

/**
 * Format impact acknowledgment
 */
function getImpactAcknowledgment(context: ServiceApologyContext): string {
  let text = `I understand this ${context.customerImpact}`;

  if (context.escalationOccurred) {
    text += ' The fact that you needed to escalate tells me we failed you at multiple points, and that\'s unacceptable.';
  }

  return text;
}

/**
 * Format what we've done / resolution
 */
function getResolutionSteps(context: ServiceApologyContext): string[] {
  if (context.resolutionSteps && context.resolutionSteps.length > 0) {
    return context.resolutionSteps;
  }

  const steps = ['Immediate attention given to your outstanding issues'];

  if (context.failureType === 'response_time' || context.failureType === 'support') {
    steps.push('Internal review of support queue handling');
  }

  if (context.escalationOccurred) {
    steps.push('Escalation path documented for faster future resolution');
  }

  steps.push('Direct line to me for any future concerns');

  return steps;
}

/**
 * Format process improvements
 */
function getProcessImprovements(context: ServiceApologyContext): string[] {
  if (context.processImprovements && context.processImprovements.length > 0) {
    return context.processImprovements;
  }

  const improvements: string[] = [];

  switch (context.failureType) {
    case 'response_time':
      improvements.push('Enhanced monitoring of response time SLAs');
      improvements.push('Automated escalation for approaching deadlines');
      break;
    case 'sla_breach':
      improvements.push('SLA tracking dashboard improvements');
      improvements.push('Proactive alerts before SLA thresholds');
      break;
    case 'quality':
      improvements.push('Quality review process enhancement');
      improvements.push('Additional training for support team');
      break;
    case 'support':
      improvements.push('Support workflow optimization');
      improvements.push('Escalation procedures strengthened');
      break;
    default:
      improvements.push('Process review completed');
      improvements.push('Team briefed on lessons learned');
  }

  if (context.staffingChanges) {
    improvements.push(context.staffingChanges);
  }

  return improvements;
}

/**
 * Format compensation section
 */
function getCompensationSection(context: ServiceApologyContext): string | null {
  if (!context.compensationOffer || context.compensationOffer.type === 'none') {
    return null;
  }

  switch (context.compensationOffer.type) {
    case 'dedicated_support':
      return `Going forward, I'm assigning you a dedicated support contact who will be your first point of contact for any issues. This ensures you'll never have to wait in a general queue again.`;

    case 'upgrade':
      return context.compensationOffer.description
        ? `I'd like to offer ${context.compensationOffer.description} at no additional cost as a gesture of goodwill.`
        : 'I\'d like to discuss upgrading your support tier at no additional cost for the remainder of your contract term.';

    case 'credit':
      return context.compensationOffer.amount
        ? `As a gesture of goodwill, I'd like to offer a service credit of $${context.compensationOffer.amount.toLocaleString()}.`
        : 'I\'d like to discuss a service credit to make up for the inconvenience.';

    case 'discount':
      return context.compensationOffer.amount
        ? `I'd like to offer ${context.customerName} a ${context.compensationOffer.amount}% discount on your next invoice.`
        : 'I\'d like to discuss a discount on your next renewal.';

    case 'extension':
      return context.compensationOffer.description
        ? `I'd like to offer ${context.compensationOffer.description}.`
        : 'I\'d like to offer a contract extension as a gesture of goodwill.';

    default:
      return null;
  }
}

/**
 * Get commitment statement
 */
function getCommitmentStatement(context: ServiceApologyContext): string {
  const isHighTier = context.contractTier === 'enterprise' || context.contractTier === 'premium';
  const isHighValue = context.arrValue >= 100000;

  if (isHighTier || isHighValue) {
    return `You have my personal commitment that this won't happen again. I'm making it my priority to ensure ${context.customerName} receives the level of service you deserve. Please feel free to contact me directly at any time.`;
  }

  return 'I\'m committed to ensuring this doesn\'t happen again. Please don\'t hesitate to reach out to me directly if you have any concerns in the future.';
}

/**
 * Get signature
 */
function getSignature(context: ServiceApologyContext): string {
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
function generateInternalNotes(context: ServiceApologyContext): string[] {
  const notes: string[] = [];

  if (context.escalationOccurred) {
    notes.push('ESCALATION OCCURRED - Document in CRM and review root cause');
  }

  if (context.failureType === 'sla_breach') {
    notes.push('SLA BREACH - Ensure SLA dashboard is updated');
  }

  if (context.arrValue >= 100000) {
    notes.push(`High-value account ($${(context.arrValue / 1000).toFixed(0)}K ARR) - monitor closely`);
  }

  if (context.contractTier === 'enterprise' || context.contractTier === 'premium') {
    notes.push(`${context.contractTier.toUpperCase()} tier - ensure premium service standards going forward`);
  }

  if (context.compensationOffer && context.compensationOffer.type !== 'none') {
    notes.push('Compensation offered - document in CRM and track delivery');
  }

  notes.push('Schedule check-in within 2 weeks to verify improved experience');
  notes.push('Review support metrics for this account monthly');

  return notes;
}

/**
 * Main template generator
 */
export function generateServiceApologyEmail(context: ServiceApologyContext): ServiceApologyResult {
  const firstName = context.contactName.split(' ')[0];
  const subject = generateSubject(context);
  const opening = getOpening(context);
  const issueDetails = getIssueDetails(context);
  const impactAcknowledgment = getImpactAcknowledgment(context);
  const resolutionSteps = getResolutionSteps(context);
  const processImprovements = getProcessImprovements(context);
  const compensation = getCompensationSection(context);
  const commitment = getCommitmentStatement(context);
  const signature = getSignature(context);

  // Build plain text body
  const bodyParts = [
    `Dear ${firstName},`,
    '',
    opening,
    '',
    '**What Happened:**',
    issueDetails,
    '',
    '**The Impact:**',
    impactAcknowledgment,
    '',
    '**Immediate Actions:**',
    ...resolutionSteps.map(step => `- ${step}`),
    '',
    '**Process Improvements:**',
    ...processImprovements.map(improvement => `- ${improvement}`),
    '',
  ];

  if (compensation) {
    bodyParts.push('**Making This Right:**');
    bodyParts.push(compensation);
    bodyParts.push('');
  }

  bodyParts.push(commitment);
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
  <p>Dear ${firstName},</p>

  <p>${opening}</p>

  <h3>What Happened:</h3>
  <p>${issueDetails}</p>

  <h3>The Impact:</h3>
  <p>${impactAcknowledgment}</p>

  <h3>Immediate Actions:</h3>
  <ul>
    ${resolutionSteps.map(step => `<li>${step}</li>`).join('\n    ')}
  </ul>

  <h3>Process Improvements:</h3>
  <ul>
    ${processImprovements.map(improvement => `<li>${improvement}</li>`).join('\n    ')}
  </ul>

  ${compensation ? `<h3>Making This Right:</h3>\n  <p>${compensation}</p>` : ''}

  <p>${commitment}</p>

  <div class="signature">
    ${signature.split('\n').join('<br>')}
  </div>
</body>
</html>`;

  // Generate follow-up suggestion
  const suggestedFollowUp = {
    date: context.followUpDate || getDefaultFollowUpDate(),
    type: 'call',
    notes: `Follow-up on service experience. Verify improvements are noticeable and address any remaining concerns.`,
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
 * Get default follow-up date (2 weeks from now)
 */
function getDefaultFollowUpDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default {
  generateServiceApologyEmail,
};
