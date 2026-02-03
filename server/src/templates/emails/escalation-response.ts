/**
 * Escalation Response Email Templates
 * PRD-029: Escalation Response Drafting
 *
 * Templates for different escalation types with severity-aware tone
 */

export type EscalationType =
  | 'technical'           // API issues, integration failures, bugs
  | 'billing'             // Payment issues, invoice disputes
  | 'service'             // Service quality, SLA concerns
  | 'executive_complaint' // Direct complaint from executive
  | 'support_escalation'; // Support ticket escalated

export type EscalationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface EscalationContext {
  customerName: string;
  contactName: string;
  contactTitle?: string;
  issueDescription: string;
  issueDuration?: string; // "3 days", "1 week", etc.
  arrValue: number;
  healthScore?: number;
  escalationType: EscalationType;
  severity: EscalationSeverity;
  csmName: string;
  csmPhone?: string;
  csmEmail?: string;

  // Technical details (for technical escalations)
  technicalDetails?: {
    affectedSystem?: string;
    errorDetails?: string;
    workaroundAvailable?: boolean;
  };

  // Billing details (for billing escalations)
  billingDetails?: {
    invoiceNumber?: string;
    amount?: number;
    disputeReason?: string;
  };

  // Immediate actions being taken
  immediateActions?: string[];

  // Timeline estimates
  timeline?: {
    rootCauseAnalysis?: string; // "Today by 5 PM PT"
    interimSolution?: string;   // "Tomorrow morning"
    permanentFix?: string;      // "Within 72 hours"
  };

  // Support engineer assigned (if any)
  supportEngineer?: {
    name: string;
    directLine?: string;
    email?: string;
  };

  // Update frequency
  updateFrequency?: string; // "every 4 hours"
}

export interface EscalationTemplate {
  subject: string;
  body: string;
  suggestedCCs: string[];
}

/**
 * Generate subject line based on escalation context
 */
function generateSubject(context: EscalationContext): string {
  const prefix = context.severity === 'critical' ? '[URGENT] ' : '';

  switch (context.escalationType) {
    case 'technical':
      return `${prefix}RE: ${context.customerName} ${context.technicalDetails?.affectedSystem || 'Technical'} Issue - Executive Response`;

    case 'billing':
      return `${prefix}RE: ${context.customerName} Billing Concern - Resolution Update`;

    case 'service':
      return `${prefix}RE: ${context.customerName} Service Experience - Immediate Attention`;

    case 'executive_complaint':
      return `${prefix}RE: ${context.customerName} - Executive Response`;

    case 'support_escalation':
    default:
      return `${prefix}RE: ${context.customerName} Support Escalation - Executive Response`;
  }
}

/**
 * Get appropriate greeting based on relationship and severity
 */
function getGreeting(context: EscalationContext): string {
  const name = context.contactName.split(' ')[0]; // First name

  if (context.severity === 'critical' || context.escalationType === 'executive_complaint') {
    return `Dear ${context.contactName},`;
  }

  return `Dear ${name},`;
}

/**
 * Get opening paragraph based on severity and type
 */
function getOpening(context: EscalationContext): string {
  const acknowledgment = context.severity === 'critical'
    ? 'Thank you for bringing this directly to my attention. I completely understand the urgency and critical nature of this situation.'
    : 'Thank you for reaching out. I understand how important this issue is to your team.';

  switch (context.escalationType) {
    case 'technical':
      return `${acknowledgment} I sincerely apologize for the ${context.technicalDetails?.affectedSystem || 'technical'} issues ${context.issueDuration ? `your team has experienced over the past ${context.issueDuration}` : 'you are experiencing'}.`;

    case 'billing':
      return `${acknowledgment} I apologize for any confusion or inconvenience regarding ${context.billingDetails?.invoiceNumber ? `invoice ${context.billingDetails.invoiceNumber}` : 'your billing concerns'}.`;

    case 'service':
      return `${acknowledgment} I deeply regret that our service has not met the standards you expect and deserve${context.issueDuration ? ` over the past ${context.issueDuration}` : ''}.`;

    case 'executive_complaint':
      return `${acknowledgment} I want to personally assure you that your concerns are now our top priority, and I am taking direct ownership of this situation.`;

    case 'support_escalation':
    default:
      return `${acknowledgment} I apologize for the frustration this situation has caused${context.issueDuration ? ` over the past ${context.issueDuration}` : ''}.`;
  }
}

/**
 * Get priority assurance statement
 */
function getPriorityStatement(context: EscalationContext): string {
  if (context.severity === 'critical') {
    return 'I want to assure you this is now our top priority. Our entire team is mobilized to resolve this as quickly as possible.';
  }

  if (context.severity === 'high') {
    return 'I want to assure you this has been escalated to our highest priority. We are dedicating focused resources to resolve this promptly.';
  }

  return 'We are treating this with the urgency it deserves and have prioritized its resolution.';
}

/**
 * Generate immediate actions section
 */
function getImmediateActionsSection(context: EscalationContext): string {
  const actions = context.immediateActions || getDefaultActions(context);

  if (actions.length === 0) {
    return '';
  }

  return `
**Immediate Actions:**
${actions.map(action => `- ${action}`).join('\n')}`;
}

/**
 * Get default actions based on escalation type
 */
function getDefaultActions(context: EscalationContext): string[] {
  switch (context.escalationType) {
    case 'technical':
      return [
        'Engineering team escalated and investigating root cause',
        context.technicalDetails?.workaroundAvailable
          ? 'Interim workaround identified and being implemented'
          : 'Identifying potential workarounds for critical workflows',
        context.supportEngineer
          ? `Dedicated support engineer assigned: ${context.supportEngineer.name}${context.supportEngineer.directLine ? ` (direct line: ${context.supportEngineer.directLine})` : ''}`
          : 'Assigning dedicated support engineer to your account',
      ];

    case 'billing':
      return [
        'Finance team reviewing your account immediately',
        'All pending invoices placed on hold pending resolution',
        'Preparing detailed reconciliation statement',
      ];

    case 'service':
      return [
        'Executive team briefed on your concerns',
        'Conducting comprehensive service review',
        'Developing enhanced service plan for your account',
      ];

    case 'executive_complaint':
      return [
        'Personal ownership of your account concerns',
        'Cross-functional team assembled for immediate resolution',
        'Direct escalation path established to our leadership',
      ];

    case 'support_escalation':
    default:
      return [
        'Support team mobilized with highest priority',
        'Investigating root cause with engineering',
        'Preparing interim solutions',
      ];
  }
}

/**
 * Generate timeline section
 */
function getTimelineSection(context: EscalationContext): string {
  if (!context.timeline) {
    return getDefaultTimeline(context);
  }

  const lines: string[] = [];

  if (context.timeline.rootCauseAnalysis) {
    lines.push(`- Root cause analysis: ${context.timeline.rootCauseAnalysis}`);
  }
  if (context.timeline.interimSolution) {
    lines.push(`- Interim solution deployment: ${context.timeline.interimSolution}`);
  }
  if (context.timeline.permanentFix) {
    lines.push(`- Permanent fix: ${context.timeline.permanentFix}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return `
**Timeline:**
${lines.join('\n')}`;
}

/**
 * Get default timeline based on severity
 */
function getDefaultTimeline(context: EscalationContext): string {
  if (context.severity === 'critical') {
    return `
**Timeline:**
- Root cause analysis: Today by 5 PM PT
- Interim solution deployment: Tomorrow morning
- Permanent fix: Within 72 hours`;
  }

  if (context.severity === 'high') {
    return `
**Timeline:**
- Initial assessment: Within 24 hours
- Resolution plan: Within 48 hours
- Full resolution: Within one week`;
  }

  return `
**Timeline:**
- We will provide a detailed update within 48 hours
- Full resolution within one week`;
}

/**
 * Get closing with update commitment
 */
function getClosing(context: EscalationContext): string {
  const updateFrequency = context.updateFrequency || (context.severity === 'critical' ? 'every 4 hours' : 'daily');

  return `I'll personally ensure you receive updates ${updateFrequency} until this is resolved. If you need anything sooner, please call me directly.`;
}

/**
 * Get signature block
 */
function getSignature(context: EscalationContext): string {
  const lines = [
    'Best regards,',
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
 * Suggest internal CCs based on escalation context
 */
function getSuggestedCCs(context: EscalationContext): string[] {
  const ccs: string[] = [];

  // Always include CSM manager for escalations
  ccs.push('Your Manager');

  // Add support lead for technical issues
  if (context.escalationType === 'technical' || context.escalationType === 'support_escalation') {
    ccs.push('Support Lead');
  }

  // Add finance for billing
  if (context.escalationType === 'billing') {
    ccs.push('Finance Manager');
  }

  // Add Account Executive for high-value accounts
  if (context.arrValue >= 100000) {
    ccs.push('Account Executive');
  }

  // Add VP/Director for critical or executive complaints
  if (context.severity === 'critical' || context.escalationType === 'executive_complaint') {
    ccs.push('VP of Customer Success');
  }

  // Add engineering for critical technical issues
  if (context.escalationType === 'technical' && context.severity === 'critical') {
    ccs.push('Engineering Manager');
  }

  return ccs;
}

/**
 * Main template generator
 */
export function generateEscalationResponse(context: EscalationContext): EscalationTemplate {
  const subject = generateSubject(context);
  const greeting = getGreeting(context);
  const opening = getOpening(context);
  const priorityStatement = getPriorityStatement(context);
  const immediateActions = getImmediateActionsSection(context);
  const timeline = getTimelineSection(context);
  const closing = getClosing(context);
  const signature = getSignature(context);

  const body = `${greeting}

${opening}

${priorityStatement}
${immediateActions}
${timeline}

${closing}

${signature}`;

  return {
    subject,
    body: body.trim(),
    suggestedCCs: getSuggestedCCs(context),
  };
}

/**
 * Template presets for quick generation
 */
export const ESCALATION_TEMPLATES = {
  technical: {
    name: 'Technical Issue Response',
    description: 'For API failures, integration issues, system outages',
    defaultActions: [
      'Engineering team escalated and investigating root cause',
      'Interim workaround identified for critical data syncs',
      'Dedicated support engineer assigned',
    ],
  },
  billing: {
    name: 'Billing Issue Response',
    description: 'For invoice disputes, payment issues, pricing concerns',
    defaultActions: [
      'Finance team reviewing your account immediately',
      'All pending invoices placed on hold',
      'Preparing detailed reconciliation statement',
    ],
  },
  service: {
    name: 'Service Quality Response',
    description: 'For SLA concerns, service experience issues',
    defaultActions: [
      'Executive team briefed on your concerns',
      'Conducting comprehensive service review',
      'Developing enhanced service plan',
    ],
  },
  executive_complaint: {
    name: 'Executive Complaint Response',
    description: 'For direct complaints from executives',
    defaultActions: [
      'Personal ownership of your account concerns',
      'Cross-functional team assembled',
      'Direct escalation path to leadership',
    ],
  },
  support_escalation: {
    name: 'Support Escalation Response',
    description: 'For escalated support tickets',
    defaultActions: [
      'Support team mobilized with highest priority',
      'Investigating root cause with engineering',
      'Preparing interim solutions',
    ],
  },
};

/**
 * HTML version of the escalation response for email
 */
export function generateEscalationResponseHtml(context: EscalationContext): string {
  const template = generateEscalationResponse(context);

  // Convert markdown-style formatting to HTML
  const htmlBody = template.body
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    p { margin: 16px 0; }
    ul { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    strong { color: #111; }
  </style>
</head>
<body>
  <p>${htmlBody}</p>
</body>
</html>`;
}

export default {
  generateEscalationResponse,
  generateEscalationResponseHtml,
  ESCALATION_TEMPLATES,
};
