/**
 * Next Best Action Types (PRD-075)
 *
 * Type definitions for the AI-powered next best action recommendation engine.
 * Recommends the most impactful actions a CSM should take with each customer.
 */

// ============================================
// ACTION CATEGORIES
// ============================================

export type ActionCategory = 'engagement' | 'risk' | 'expansion' | 'lifecycle';

export type ActionUrgency = 'immediate' | 'today' | 'this_week' | 'this_month';

export type ActionStatus = 'recommended' | 'accepted' | 'completed' | 'dismissed' | 'deferred';

// ============================================
// SIGNAL TYPES
// ============================================

export interface Signal {
  type: string;
  value: string | number | boolean;
  weight: number;
  description: string;
}

export interface Resource {
  type: 'template' | 'doc' | 'guide' | 'link';
  name: string;
  url?: string;
  templateId?: string;
}

// ============================================
// NEXT BEST ACTION MODEL
// ============================================

export interface NextBestAction {
  id: string;
  customerId: string;
  customerName: string;

  // Action details
  action: string;
  category: ActionCategory;
  description: string;
  urgency: ActionUrgency;

  // Scoring
  impactScore: number;        // 0-100: Expected positive impact
  confidenceScore: number;    // 0-100: Model confidence
  priorityScore: number;      // Combined score for ranking

  // Context
  reasoning: string[];        // Why this action
  signals: Signal[];          // Data points driving recommendation
  expectedOutcome: string;    // What success looks like

  // Execution
  suggestedApproach: string;  // How to execute
  talkingPoints: string[];    // What to say
  resources: Resource[];      // Templates, docs, etc.

  // Customer context
  arr: number;
  healthScore: number;
  daysUntilRenewal: number | null;
  segment: string;

  // Tracking
  status: ActionStatus;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  dismissedAt: string | null;
  deferredUntil: string | null;
  outcome: string | null;
  dismissReason: string | null;
}

// ============================================
// ALTERNATIVE ACTIONS
// ============================================

export interface AlternativeAction {
  action: string;
  priorityScore: number;
  reason: string;
}

// ============================================
// ACTION EFFECTIVENESS
// ============================================

export interface ActionEffectiveness {
  actionType: string;
  completedCount: number;
  successRate: number;
  avgHealthImpact: number;
}

export interface UserEffectivenessStats {
  actionsCompleted: number;
  successRate: number;
  avgImpact: number;
  topPerformingActions: ActionEffectiveness[];
}

// ============================================
// PORTFOLIO VIEW RESPONSE
// ============================================

export interface NextBestActionPortfolioResponse {
  immediate: NextBestAction[];
  today: NextBestAction[];
  thisWeek: NextBestAction[];
  thisMonth: NextBestAction[];
  summary: {
    totalActions: number;
    immediateCount: number;
    todayCount: number;
    thisWeekCount: number;
    thisMonthCount: number;
    byCategory: {
      engagement: number;
      risk: number;
      expansion: number;
      lifecycle: number;
    };
    totalArrAtRisk: number;
    totalExpansionPotential: number;
  };
  effectiveness: UserEffectivenessStats;
  generatedAt: string;
}

// ============================================
// SINGLE ACCOUNT VIEW RESPONSE
// ============================================

export interface NextBestActionAccountResponse {
  customerId: string;
  customerName: string;
  primary: NextBestAction;
  alternatives: AlternativeAction[];
  customerContext: {
    arr: number;
    healthScore: number;
    healthTrend: 'improving' | 'stable' | 'declining';
    daysUntilRenewal: number | null;
    segment: string;
    lastContact: string | null;
    openRisks: number;
    activeOpportunities: number;
  };
  generatedAt: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface NextBestActionFilters {
  customerId?: string;
  category?: ActionCategory | 'all';
  urgency?: ActionUrgency | 'all';
  limit?: number;
}

export interface AcceptActionRequest {
  actionId: string;
}

export interface CompleteActionRequest {
  actionId: string;
  outcome: string;
  successRating?: 'positive' | 'neutral' | 'negative';
}

export interface DismissActionRequest {
  actionId: string;
  reason: string;
}

export interface DeferActionRequest {
  actionId: string;
  deferUntil: string;
}

export interface ActionUpdateResponse {
  success: boolean;
  action: NextBestAction;
}

// ============================================
// ACTION TEMPLATES
// ============================================

export interface ActionTemplate {
  id: string;
  name: string;
  category: ActionCategory;
  triggerConditions: string[];
  expectedOutcome: string;
  defaultTalkingPoints: string[];
  defaultApproach: string;
  resourceTemplates: Resource[];
}

// ============================================
// ENGAGEMENT ACTIONS
// ============================================

export const ENGAGEMENT_ACTIONS: ActionTemplate[] = [
  {
    id: 'check_in_call',
    name: 'Check-in Call',
    category: 'engagement',
    triggerConditions: ['No contact > 21 days', 'Low engagement score'],
    expectedOutcome: 'Re-establish connection, identify any concerns',
    defaultTalkingPoints: [
      "I noticed we haven't connected in a while - wanted to check in",
      "How are things going with [product feature they use most]?",
      "Is there anything we can help with?"
    ],
    defaultApproach: 'Casual check-in call, focus on relationship not sales',
    resourceTemplates: []
  },
  {
    id: 'send_value_update',
    name: 'Send Value Update',
    category: 'engagement',
    triggerConditions: ['Quarterly milestone', 'Post-implementation'],
    expectedOutcome: 'Reinforce value, highlight achievements',
    defaultTalkingPoints: [
      "I wanted to share some metrics from your team's usage",
      "Your adoption rate is above average for similar companies",
      "Have you seen the new [feature] that could help with [their use case]?"
    ],
    defaultApproach: 'Send personalized value summary with key metrics',
    resourceTemplates: [{ type: 'template', name: 'Value Summary Email', templateId: 'value-summary' }]
  },
  {
    id: 'share_content',
    name: 'Share Relevant Content',
    category: 'engagement',
    triggerConditions: ['Usage pattern indicates need', 'New feature launch'],
    expectedOutcome: 'Drive adoption, demonstrate expertise',
    defaultTalkingPoints: [
      "I thought of your team when I saw this resource",
      "Based on how you're using [feature], this guide might help",
      "Other customers in [industry] found this useful"
    ],
    defaultApproach: 'Personalized content share based on their use case',
    resourceTemplates: []
  },
  {
    id: 'schedule_training',
    name: 'Schedule Training Session',
    category: 'engagement',
    triggerConditions: ['Low feature adoption', 'New users added'],
    expectedOutcome: 'Increase usage, improve stickiness',
    defaultTalkingPoints: [
      "I noticed your team might benefit from a training session",
      "We have some best practices that could help",
      "Would a 30-minute workshop work for your team?"
    ],
    defaultApproach: 'Offer tailored training for underutilized features',
    resourceTemplates: [{ type: 'template', name: 'Training Invitation', templateId: 'training-invite' }]
  },
  {
    id: 'request_feedback',
    name: 'Request Feedback',
    category: 'engagement',
    triggerConditions: ['Post-milestone', 'Renewal prep', 'Low NPS'],
    expectedOutcome: 'Gather insights, show care',
    defaultTalkingPoints: [
      "I'd love to get your honest feedback",
      "What's working well? What could be better?",
      "Your input helps us improve"
    ],
    defaultApproach: 'Genuine feedback request, not survey pushiness',
    resourceTemplates: []
  }
];

// ============================================
// RISK MITIGATION ACTIONS
// ============================================

export const RISK_ACTIONS: ActionTemplate[] = [
  {
    id: 'outreach_champion',
    name: 'Outreach to Champion',
    category: 'risk',
    triggerConditions: ['Champion inactive > 14 days', 'Champion login drop'],
    expectedOutcome: 'Prevent disengagement, identify issues',
    defaultTalkingPoints: [
      "I noticed you've been quieter lately - wanted to check in",
      "Is everything okay on your end?",
      "How can we better support you?"
    ],
    defaultApproach: 'Direct, personal outreach to primary contact',
    resourceTemplates: []
  },
  {
    id: 'escalation_call',
    name: 'Escalation Call',
    category: 'risk',
    triggerConditions: ['Health drop > 15 points', 'Multiple support tickets'],
    expectedOutcome: 'Address issues, restore confidence',
    defaultTalkingPoints: [
      "I wanted to personally address the challenges you've been facing",
      "Let me understand the impact on your team",
      "Here's our plan to resolve this"
    ],
    defaultApproach: 'Empathetic, solution-focused call with clear action plan',
    resourceTemplates: [{ type: 'template', name: 'Escalation Response', templateId: 'escalation-response' }]
  },
  {
    id: 'start_save_play',
    name: 'Start Save Play',
    category: 'risk',
    triggerConditions: ['Critical risk signals', 'Churn indicators'],
    expectedOutcome: 'Prevent churn, restore relationship',
    defaultTalkingPoints: [
      "Your success is our priority - let's discuss how we can help",
      "I want to understand what's changed",
      "What would it take to make this work for you?"
    ],
    defaultApproach: 'Executive involvement if needed, clear save plan',
    resourceTemplates: [{ type: 'guide', name: 'Save Play Guide', url: '/guides/save-play' }]
  },
  {
    id: 'executive_alignment',
    name: 'Executive Alignment',
    category: 'risk',
    triggerConditions: ['Exec sponsor inactive', 'Strategic account at risk'],
    expectedOutcome: 'Strengthen executive relationship',
    defaultTalkingPoints: [
      "I'd like to connect you with our leadership",
      "We want to ensure strategic alignment",
      "Let's discuss your long-term vision"
    ],
    defaultApproach: 'Bring in own executive for peer-to-peer conversation',
    resourceTemplates: []
  },
  {
    id: 'address_support_issues',
    name: 'Address Support Issues',
    category: 'risk',
    triggerConditions: ['Ticket pattern detected', 'High support volume'],
    expectedOutcome: 'Resolve friction, improve experience',
    defaultTalkingPoints: [
      "I noticed your team has had several support interactions",
      "I want to make sure we're addressing the root cause",
      "Let me coordinate with our team to get this resolved"
    ],
    defaultApproach: 'Proactive outreach about support pattern, offer dedicated help',
    resourceTemplates: []
  }
];

// ============================================
// EXPANSION ACTIONS
// ============================================

export const EXPANSION_ACTIONS: ActionTemplate[] = [
  {
    id: 'expansion_discussion',
    name: 'Expansion Discussion',
    category: 'expansion',
    triggerConditions: ['Positive signals detected', 'Usage at capacity'],
    expectedOutcome: 'Grow account, identify new use cases',
    defaultTalkingPoints: [
      "Your team has been getting great value - any other teams that could benefit?",
      "I noticed you're close to your limits - shall we discuss scaling?",
      "What other challenges could we help solve?"
    ],
    defaultApproach: 'Value-first expansion conversation',
    resourceTemplates: []
  },
  {
    id: 'department_introduction',
    name: 'Department Introduction',
    category: 'expansion',
    triggerConditions: ['White space identified', 'New champion mentioned'],
    expectedOutcome: 'Expand footprint across organization',
    defaultTalkingPoints: [
      "Would you be open to introducing us to [department]?",
      "I think [other team] might benefit from what we're doing together",
      "Could you help facilitate an intro?"
    ],
    defaultApproach: 'Warm introduction request through existing champion',
    resourceTemplates: []
  },
  {
    id: 'upsell_proposal',
    name: 'Upsell Proposal',
    category: 'expansion',
    triggerConditions: ['At capacity', 'High health', 'Strong adoption'],
    expectedOutcome: 'Increase ARR through tier upgrade',
    defaultTalkingPoints: [
      "Based on your usage, the next tier would unlock...",
      "Here's the ROI other customers in your situation have seen",
      "Would you like to see a proposal?"
    ],
    defaultApproach: 'Data-driven upsell presentation',
    resourceTemplates: [{ type: 'template', name: 'Upsell Proposal', templateId: 'upsell-proposal' }]
  },
  {
    id: 'renewal_optimization',
    name: 'Renewal Optimization',
    category: 'expansion',
    triggerConditions: ['Renewal approaching', 'Growth opportunity'],
    expectedOutcome: 'Maximize retention and growth at renewal',
    defaultTalkingPoints: [
      "As we approach renewal, I wanted to discuss your future needs",
      "What's changing in your organization that we should plan for?",
      "Are there expansion opportunities we should include?"
    ],
    defaultApproach: 'Strategic renewal conversation',
    resourceTemplates: [{ type: 'template', name: 'Renewal Proposal', templateId: 'renewal-proposal' }]
  },
  {
    id: 'multi_year_offer',
    name: 'Multi-Year Offer',
    category: 'expansion',
    triggerConditions: ['Strong health', 'Expansion completed', 'Strategic account'],
    expectedOutcome: 'Secure long-term commitment',
    defaultTalkingPoints: [
      "Given the success we've had together, would you consider a multi-year agreement?",
      "Here are the benefits of committing for a longer term",
      "What would it take to make this work?"
    ],
    defaultApproach: 'Value-based multi-year pitch with incentives',
    resourceTemplates: []
  }
];

// ============================================
// LIFECYCLE ACTIONS
// ============================================

export const LIFECYCLE_ACTIONS: ActionTemplate[] = [
  {
    id: 'kickoff_scheduling',
    name: 'Kickoff Scheduling',
    category: 'lifecycle',
    triggerConditions: ['New customer', 'Contract signed'],
    expectedOutcome: 'Start engagement on right foot',
    defaultTalkingPoints: [
      "Welcome! I'm excited to work with your team",
      "Let's schedule our kickoff call",
      "Here's what to expect in the first 30 days"
    ],
    defaultApproach: 'Warm welcome, clear expectations',
    resourceTemplates: [{ type: 'template', name: 'Kickoff Email', templateId: 'kickoff-welcome' }]
  },
  {
    id: 'onboarding_checkpoint',
    name: 'Onboarding Checkpoint',
    category: 'lifecycle',
    triggerConditions: ['Week 2', 'Week 4', 'Week 8'],
    expectedOutcome: 'Ensure progress, address blockers',
    defaultTalkingPoints: [
      "How is onboarding going?",
      "Are there any blockers we should address?",
      "Here's what's next in your implementation"
    ],
    defaultApproach: 'Structured check-in with progress review',
    resourceTemplates: []
  },
  {
    id: 'qbr_preparation',
    name: 'QBR Preparation',
    category: 'lifecycle',
    triggerConditions: ['QBR approaching in 2-3 weeks'],
    expectedOutcome: 'Deliver impactful QBR',
    defaultTalkingPoints: [
      "Our QBR is coming up - I want to make sure it's valuable for you",
      "What topics should we cover?",
      "Who should attend from your side?"
    ],
    defaultApproach: 'Prep call to gather input and set agenda',
    resourceTemplates: [{ type: 'template', name: 'QBR Prep Email', templateId: 'qbr-prep' }]
  },
  {
    id: 'renewal_preparation',
    name: 'Renewal Preparation',
    category: 'lifecycle',
    triggerConditions: ['90 days before renewal'],
    expectedOutcome: 'Secure renewal',
    defaultTalkingPoints: [
      "As we approach your renewal, I wanted to discuss our partnership",
      "What's working well that we should continue?",
      "Any changes we should plan for next year?"
    ],
    defaultApproach: 'Strategic renewal conversation starting early',
    resourceTemplates: [{ type: 'template', name: 'Renewal Proposal', templateId: 'renewal-proposal' }]
  },
  {
    id: 'success_review',
    name: 'Success Review',
    category: 'lifecycle',
    triggerConditions: ['Anniversary', 'Major milestone'],
    expectedOutcome: 'Document value, strengthen relationship',
    defaultTalkingPoints: [
      "I wanted to celebrate what we've accomplished together",
      "Here's the value you've achieved",
      "What are your goals for the next phase?"
    ],
    defaultApproach: 'Positive, value-focused review meeting',
    resourceTemplates: [{ type: 'template', name: 'Success Summary', templateId: 'success-summary' }]
  }
];

// ============================================
// ALL ACTION TEMPLATES
// ============================================

export const ALL_ACTION_TEMPLATES: ActionTemplate[] = [
  ...ENGAGEMENT_ACTIONS,
  ...RISK_ACTIONS,
  ...EXPANSION_ACTIONS,
  ...LIFECYCLE_ACTIONS
];

// ============================================
// PRIORITY SCORE CALCULATION WEIGHTS
// ============================================

export const PRIORITY_WEIGHTS = {
  impact: 0.35,
  urgency: 0.30,
  confidence: 0.20,
  accountValue: 0.15
};

// ============================================
// URGENCY THRESHOLDS
// ============================================

export const URGENCY_THRESHOLDS = {
  immediate: 95, // Priority score >= 95
  today: 80,     // Priority score >= 80
  thisWeek: 60,  // Priority score >= 60
  thisMonth: 0   // Everything else
};

// ============================================
// CATEGORY COLORS
// ============================================

export const CATEGORY_COLORS: Record<ActionCategory, { bg: string; text: string; border: string }> = {
  engagement: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  risk: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  expansion: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  lifecycle: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' }
};

export const URGENCY_COLORS: Record<ActionUrgency, { bg: string; text: string }> = {
  immediate: { bg: 'bg-red-500/20', text: 'text-red-400' },
  today: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  this_week: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  this_month: { bg: 'bg-gray-500/20', text: 'text-gray-400' }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get urgency from priority score
 */
export function getUrgencyFromScore(score: number): ActionUrgency {
  if (score >= URGENCY_THRESHOLDS.immediate) return 'immediate';
  if (score >= URGENCY_THRESHOLDS.today) return 'today';
  if (score >= URGENCY_THRESHOLDS.thisWeek) return 'this_week';
  return 'this_month';
}

/**
 * Get category label
 */
export function getCategoryLabel(category: ActionCategory): string {
  const labels: Record<ActionCategory, string> = {
    engagement: 'Engagement',
    risk: 'Risk Mitigation',
    expansion: 'Expansion',
    lifecycle: 'Lifecycle'
  };
  return labels[category];
}

/**
 * Get urgency label
 */
export function getUrgencyLabel(urgency: ActionUrgency): string {
  const labels: Record<ActionUrgency, string> = {
    immediate: 'Immediate',
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month'
  };
  return labels[urgency];
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}
