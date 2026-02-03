/**
 * Introduction Draft Email Template
 * PRD-044: Multi-Threading Introduction
 *
 * Generates the draft email that champions can forward to introduce
 * the CSM to new stakeholders. This is a standalone template for
 * cases where the draft needs to be sent separately.
 */

export interface IntroDraftData {
  customer: {
    name: string;
    arr?: number;
  };
  champion: {
    name: string;
    firstName: string;
    title?: string;
  };
  target: {
    name: string;
    firstName: string;
    title: string;
    email?: string;
    department?: string;
  };
  csm: {
    name: string;
    email: string;
    title?: string;
    phone?: string;
    calendlyUrl?: string;
  };
  context: {
    partnershipHighlight?: string;
    keyAchievement?: {
      metric: string;
      value: string;
    };
    meetingPurpose: string;
    renewalContext?: boolean;
    suggestedDuration?: number;
  };
  customNote?: string;
}

export interface IntroDraftResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  forwardInstructions: string;
}

/**
 * Generate draft introduction email for champion to forward
 */
export function generateIntroDraftEmail(data: IntroDraftData): IntroDraftResult {
  const { customer, champion, target, csm, context, customNote } = data;

  // Build achievement highlight
  const achievementText = context.keyAchievement
    ? ` We've achieved ${context.keyAchievement.value} ${context.keyAchievement.metric.toLowerCase()} since implementation.`
    : '';

  // Meeting duration
  const duration = context.suggestedDuration || 20;

  // Scheduling link if available
  const schedulingText = csm.calendlyUrl
    ? `\n\nYou can book directly here: ${csm.calendlyUrl}`
    : '';

  // Build HTML body
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .greeting { font-size: 16px; margin-bottom: 16px; }
    .highlight { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .footer { margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <p class="greeting">Hi ${target.firstName},</p>

    <p>I wanted to connect you with ${csm.name}, our ${csm.title || 'Customer Success Manager'} supporting ${customer.name}. They've been instrumental in our success with ${context.partnershipHighlight || 'the partnership'}.${achievementText}</p>

    ${customNote ? `<p>${customNote}</p>` : ''}

    <p>${context.meetingPurpose}</p>

    <p>Would you have ${duration} minutes in the next few weeks for a quick introduction call?${schedulingText ? ` You can book directly here: <a href="${csm.calendlyUrl}">${csm.calendlyUrl}</a>` : ''}</p>

    <div class="footer">
      <p>Best,<br/>
      ${champion.firstName}${champion.title ? `<br/><span style="color:#888">${champion.title}</span>` : ''}</p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const bodyText = `Hi ${target.firstName},

I wanted to connect you with ${csm.name}, our ${csm.title || 'Customer Success Manager'} supporting ${customer.name}. They've been instrumental in our success with ${context.partnershipHighlight || 'the partnership'}.${achievementText}

${customNote || ''}

${context.meetingPurpose}

Would you have ${duration} minutes in the next few weeks for a quick introduction call?${schedulingText}

Best,
${champion.firstName}${champion.title ? `\n${champion.title}` : ''}
`.trim();

  // Subject line
  const subject = `Introduction: ${csm.name} - ${customer.name} Partnership`;

  // Instructions for the champion
  const forwardInstructions = `
To introduce ${csm.name} to ${target.name}:

1. Copy this email content
2. Create a new email to ${target.email || target.name}
3. CC ${csm.email} so they can follow up
4. Personalize the greeting and sign-off
5. Send!

Alternatively, you can forward this email and add a brief personal note.
  `.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    forwardInstructions,
  };
}

/**
 * Generate variations of intro drafts based on target role
 */
export function generateRoleBasedIntroDraft(
  data: IntroDraftData,
  targetRole: 'executive' | 'technical' | 'financial' | 'operational'
): IntroDraftResult {
  const roleContexts: Record<string, Partial<IntroDraftData['context']>> = {
    executive: {
      meetingPurpose: `With our strategic partnership growing, I thought it would be valuable for you two to connect on executive alignment and roadmap priorities.`,
      suggestedDuration: 30,
    },
    technical: {
      meetingPurpose: `As we continue to expand our technical integration, I thought it would be helpful for you two to connect on implementation best practices and upcoming features.`,
      suggestedDuration: 30,
    },
    financial: {
      meetingPurpose: `With our renewal discussions coming up, I thought it would be valuable for you two to connect on the business impact and ROI we've achieved.`,
      suggestedDuration: 20,
    },
    operational: {
      meetingPurpose: `To ensure we're maximizing operational efficiency, I thought it would be helpful for you two to connect on adoption metrics and optimization opportunities.`,
      suggestedDuration: 25,
    },
  };

  const enhancedData: IntroDraftData = {
    ...data,
    context: {
      ...data.context,
      ...roleContexts[targetRole],
    },
  };

  return generateIntroDraftEmail(enhancedData);
}

/**
 * Template presets for common introduction scenarios
 */
export const INTRO_DRAFT_PRESETS = {
  renewal_budget: {
    partnershipHighlight: 'driving significant value',
    meetingPurpose: 'With our renewal approaching, I thought it would be valuable for you two to connect on the business impact and budget planning.',
    renewalContext: true,
    suggestedDuration: 20,
  },
  expansion_opportunity: {
    partnershipHighlight: 'our growing partnership',
    meetingPurpose: 'As we explore expansion opportunities, I thought it would be valuable for you two to discuss strategic alignment and potential new use cases.',
    suggestedDuration: 30,
  },
  technical_alignment: {
    partnershipHighlight: 'technical implementation',
    meetingPurpose: 'To ensure technical alignment across teams, I thought it would be helpful for you two to connect on architecture decisions and integration roadmap.',
    suggestedDuration: 30,
  },
  executive_briefing: {
    partnershipHighlight: 'strategic partnership',
    meetingPurpose: 'I thought it would be valuable for you two to connect on executive alignment and how we can continue driving mutual success.',
    suggestedDuration: 30,
  },
  risk_mitigation: {
    partnershipHighlight: 'partnership',
    meetingPurpose: 'To ensure alignment and address any concerns proactively, I thought it would be helpful for you two to connect.',
    suggestedDuration: 25,
  },
} as const;

export type IntroDraftPreset = keyof typeof INTRO_DRAFT_PRESETS;

export default generateIntroDraftEmail;
