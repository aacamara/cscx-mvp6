/**
 * Readiness Checklist Templates (PRD-085)
 *
 * Pre-built checklist templates for different milestone types.
 * These can be customized per customer or used as starting points.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

export type MilestoneType = 'renewal' | 'expansion' | 'qbr' | 'onboarding_complete' | 'executive_briefing';
export type ChecklistPriority = 'critical' | 'high' | 'medium' | 'low';
export type ChecklistCategory =
  | 'preparation'
  | 'stakeholder'
  | 'documentation'
  | 'technical'
  | 'financial'
  | 'communication';

export interface ChecklistTemplate {
  id: string;
  task: string;
  description: string;
  category: ChecklistCategory;
  priority: ChecklistPriority;
  daysBeforeMilestone: number;
  dimension: string;
  dependsOn?: string[];
  resources?: string[];
}

export interface GeneratedChecklist {
  milestoneType: MilestoneType;
  items: ChecklistItem[];
  totalTasks: number;
  criticalTasks: number;
  estimatedHours: number;
}

export interface ChecklistItem extends ChecklistTemplate {
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  assignee: string | null;
  notes: string | null;
}

// ============================================
// Renewal Checklist Template
// ============================================

const RENEWAL_CHECKLIST: ChecklistTemplate[] = [
  // Critical - Week 4+ before
  {
    id: 'renewal-1',
    task: 'Review and resolve all open support tickets',
    description: 'Ensure no outstanding issues that could impact renewal discussion',
    category: 'technical',
    priority: 'critical',
    daysBeforeMilestone: 30,
    dimension: 'Support Health',
    resources: ['Support ticket dashboard', 'Escalation playbook'],
  },
  {
    id: 'renewal-2',
    task: 'Document ROI and value delivered',
    description: 'Compile metrics showing business impact and value realization',
    category: 'documentation',
    priority: 'critical',
    daysBeforeMilestone: 28,
    dimension: 'Value Realization',
    resources: ['ROI calculator', 'Value summary template'],
  },
  {
    id: 'renewal-3',
    task: 'Schedule executive sponsor meeting',
    description: 'Align with executive sponsor on renewal strategy and priorities',
    category: 'stakeholder',
    priority: 'critical',
    daysBeforeMilestone: 25,
    dimension: 'Executive Alignment',
  },

  // High priority - Week 3 before
  {
    id: 'renewal-4',
    task: 'Prepare renewal proposal',
    description: 'Draft renewal terms including any proposed changes or expansion',
    category: 'documentation',
    priority: 'high',
    daysBeforeMilestone: 21,
    dimension: 'Financial Health',
    dependsOn: ['renewal-2'],
    resources: ['Renewal proposal template'],
  },
  {
    id: 'renewal-5',
    task: 'Identify expansion opportunities',
    description: 'Analyze usage patterns and identify upsell/cross-sell opportunities',
    category: 'preparation',
    priority: 'high',
    daysBeforeMilestone: 21,
    dimension: 'Value Realization',
  },
  {
    id: 'renewal-6',
    task: 'Multi-thread with additional stakeholders',
    description: 'Engage additional decision makers and influencers',
    category: 'stakeholder',
    priority: 'high',
    daysBeforeMilestone: 20,
    dimension: 'Stakeholder Engagement',
  },

  // Medium priority - Week 2 before
  {
    id: 'renewal-7',
    task: 'Gather customer testimonial or reference',
    description: 'Request testimonial or reference commitment if relationship is strong',
    category: 'communication',
    priority: 'medium',
    daysBeforeMilestone: 14,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'renewal-8',
    task: 'Review product roadmap alignment',
    description: 'Ensure customer needs are represented in upcoming features',
    category: 'preparation',
    priority: 'medium',
    daysBeforeMilestone: 14,
    dimension: 'Product Adoption',
  },
  {
    id: 'renewal-9',
    task: 'Prepare competitive defense',
    description: 'Document competitive advantages and responses to potential objections',
    category: 'preparation',
    priority: 'medium',
    daysBeforeMilestone: 12,
    dimension: 'Value Realization',
  },

  // Week 1 before
  {
    id: 'renewal-10',
    task: 'Send renewal proposal to customer',
    description: 'Formally present renewal terms and pricing',
    category: 'communication',
    priority: 'high',
    daysBeforeMilestone: 10,
    dimension: 'Financial Health',
    dependsOn: ['renewal-4'],
  },
  {
    id: 'renewal-11',
    task: 'Schedule renewal discussion meeting',
    description: 'Book meeting with decision makers to discuss renewal',
    category: 'communication',
    priority: 'critical',
    daysBeforeMilestone: 7,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'renewal-12',
    task: 'Prepare meeting presentation',
    description: 'Create slides covering value delivered, future vision, and proposal',
    category: 'documentation',
    priority: 'high',
    daysBeforeMilestone: 5,
    dimension: 'Value Realization',
    resources: ['Renewal deck template'],
  },
];

// ============================================
// Expansion Checklist Template
// ============================================

const EXPANSION_CHECKLIST: ChecklistTemplate[] = [
  {
    id: 'expansion-1',
    task: 'Validate expansion signals',
    description: 'Confirm usage patterns and needs that indicate expansion opportunity',
    category: 'preparation',
    priority: 'critical',
    daysBeforeMilestone: 21,
    dimension: 'Product Adoption',
  },
  {
    id: 'expansion-2',
    task: 'Build business case for expansion',
    description: 'Document expected ROI and value from additional investment',
    category: 'documentation',
    priority: 'critical',
    daysBeforeMilestone: 18,
    dimension: 'Value Realization',
    resources: ['ROI calculator', 'Business case template'],
  },
  {
    id: 'expansion-3',
    task: 'Identify expansion champions',
    description: 'Find internal advocates who will support the expansion',
    category: 'stakeholder',
    priority: 'high',
    daysBeforeMilestone: 15,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'expansion-4',
    task: 'Align with economic buyer',
    description: 'Ensure budget holder understands and supports expansion',
    category: 'stakeholder',
    priority: 'critical',
    daysBeforeMilestone: 14,
    dimension: 'Executive Alignment',
  },
  {
    id: 'expansion-5',
    task: 'Prepare expansion proposal',
    description: 'Create detailed proposal with pricing and implementation plan',
    category: 'documentation',
    priority: 'high',
    daysBeforeMilestone: 10,
    dimension: 'Financial Health',
    dependsOn: ['expansion-2'],
  },
  {
    id: 'expansion-6',
    task: 'Address technical prerequisites',
    description: 'Ensure any technical requirements are met for expansion',
    category: 'technical',
    priority: 'medium',
    daysBeforeMilestone: 10,
    dimension: 'Product Adoption',
  },
  {
    id: 'expansion-7',
    task: 'Schedule expansion discussion',
    description: 'Book meeting with stakeholders to present expansion opportunity',
    category: 'communication',
    priority: 'high',
    daysBeforeMilestone: 7,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'expansion-8',
    task: 'Prepare implementation timeline',
    description: 'Create realistic timeline for expansion rollout',
    category: 'preparation',
    priority: 'medium',
    daysBeforeMilestone: 5,
    dimension: 'Product Adoption',
  },
];

// ============================================
// QBR Checklist Template
// ============================================

const QBR_CHECKLIST: ChecklistTemplate[] = [
  {
    id: 'qbr-1',
    task: 'Compile usage and adoption metrics',
    description: 'Gather all relevant usage data for the quarter',
    category: 'preparation',
    priority: 'critical',
    daysBeforeMilestone: 14,
    dimension: 'Product Adoption',
  },
  {
    id: 'qbr-2',
    task: 'Document achievements and wins',
    description: 'List all successes and milestones achieved during the quarter',
    category: 'documentation',
    priority: 'high',
    daysBeforeMilestone: 12,
    dimension: 'Value Realization',
  },
  {
    id: 'qbr-3',
    task: 'Gather customer feedback',
    description: 'Collect CSAT, NPS, and qualitative feedback',
    category: 'preparation',
    priority: 'high',
    daysBeforeMilestone: 10,
    dimension: 'Support Health',
  },
  {
    id: 'qbr-4',
    task: 'Confirm executive attendance',
    description: 'Ensure key stakeholders from both sides will attend',
    category: 'stakeholder',
    priority: 'critical',
    daysBeforeMilestone: 10,
    dimension: 'Executive Alignment',
  },
  {
    id: 'qbr-5',
    task: 'Create QBR presentation',
    description: 'Build comprehensive deck covering all QBR topics',
    category: 'documentation',
    priority: 'critical',
    daysBeforeMilestone: 7,
    dimension: 'Value Realization',
    dependsOn: ['qbr-1', 'qbr-2'],
    resources: ['QBR deck template'],
  },
  {
    id: 'qbr-6',
    task: 'Prepare next quarter goals',
    description: 'Draft proposed objectives and success metrics for next quarter',
    category: 'preparation',
    priority: 'high',
    daysBeforeMilestone: 7,
    dimension: 'Product Adoption',
  },
  {
    id: 'qbr-7',
    task: 'Identify discussion topics',
    description: 'Prepare agenda items and questions for customer',
    category: 'preparation',
    priority: 'medium',
    daysBeforeMilestone: 5,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'qbr-8',
    task: 'Share pre-read materials',
    description: 'Send agenda and key metrics to attendees before meeting',
    category: 'communication',
    priority: 'medium',
    daysBeforeMilestone: 3,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'qbr-9',
    task: 'Prepare product roadmap overview',
    description: 'Curate relevant upcoming features to share',
    category: 'preparation',
    priority: 'medium',
    daysBeforeMilestone: 5,
    dimension: 'Product Adoption',
  },
];

// ============================================
// Onboarding Complete Checklist Template
// ============================================

const ONBOARDING_CHECKLIST: ChecklistTemplate[] = [
  {
    id: 'onboard-1',
    task: 'Verify all users are trained',
    description: 'Confirm all designated users have completed training',
    category: 'technical',
    priority: 'critical',
    daysBeforeMilestone: 10,
    dimension: 'Product Adoption',
  },
  {
    id: 'onboard-2',
    task: 'Validate technical setup complete',
    description: 'Ensure all integrations and configurations are working',
    category: 'technical',
    priority: 'critical',
    daysBeforeMilestone: 10,
    dimension: 'Product Adoption',
  },
  {
    id: 'onboard-3',
    task: 'Confirm initial value realized',
    description: 'Document first wins and early value indicators',
    category: 'documentation',
    priority: 'high',
    daysBeforeMilestone: 7,
    dimension: 'Value Realization',
  },
  {
    id: 'onboard-4',
    task: 'Transition to ongoing success plan',
    description: 'Move from implementation to optimization phase',
    category: 'preparation',
    priority: 'high',
    daysBeforeMilestone: 7,
    dimension: 'Value Realization',
  },
  {
    id: 'onboard-5',
    task: 'Schedule kickoff-to-adoption meeting',
    description: 'Meet with stakeholders to review onboarding and plan ahead',
    category: 'stakeholder',
    priority: 'high',
    daysBeforeMilestone: 5,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'onboard-6',
    task: 'Collect initial feedback',
    description: 'Gather feedback on onboarding experience',
    category: 'communication',
    priority: 'medium',
    daysBeforeMilestone: 3,
    dimension: 'Support Health',
  },
  {
    id: 'onboard-7',
    task: 'Document lessons learned',
    description: 'Capture any issues or improvements for future onboardings',
    category: 'documentation',
    priority: 'low',
    daysBeforeMilestone: 1,
    dimension: 'Support Health',
  },
];

// ============================================
// Executive Briefing Checklist Template
// ============================================

const EXEC_BRIEFING_CHECKLIST: ChecklistTemplate[] = [
  {
    id: 'exec-1',
    task: 'Research executive background',
    description: 'Understand the executive\'s priorities and communication style',
    category: 'preparation',
    priority: 'high',
    daysBeforeMilestone: 14,
    dimension: 'Executive Alignment',
  },
  {
    id: 'exec-2',
    task: 'Prepare executive summary',
    description: 'Create concise summary of relationship and value delivered',
    category: 'documentation',
    priority: 'critical',
    daysBeforeMilestone: 10,
    dimension: 'Value Realization',
    resources: ['Executive summary template'],
  },
  {
    id: 'exec-3',
    task: 'Align with customer champion',
    description: 'Brief internal champion on meeting objectives',
    category: 'stakeholder',
    priority: 'high',
    daysBeforeMilestone: 10,
    dimension: 'Stakeholder Engagement',
  },
  {
    id: 'exec-4',
    task: 'Confirm your executive\'s attendance',
    description: 'Ensure appropriate executive from your side will attend',
    category: 'stakeholder',
    priority: 'critical',
    daysBeforeMilestone: 7,
    dimension: 'Executive Alignment',
  },
  {
    id: 'exec-5',
    task: 'Prepare strategic value proposition',
    description: 'Articulate long-term strategic value and partnership vision',
    category: 'documentation',
    priority: 'high',
    daysBeforeMilestone: 7,
    dimension: 'Value Realization',
  },
  {
    id: 'exec-6',
    task: 'Create briefing deck',
    description: 'Build executive-level presentation (5-7 slides max)',
    category: 'documentation',
    priority: 'critical',
    daysBeforeMilestone: 5,
    dimension: 'Executive Alignment',
    dependsOn: ['exec-2', 'exec-5'],
    resources: ['Executive deck template'],
  },
  {
    id: 'exec-7',
    task: 'Prepare key talking points',
    description: 'Document main messages and anticipated questions',
    category: 'preparation',
    priority: 'high',
    daysBeforeMilestone: 3,
    dimension: 'Executive Alignment',
  },
  {
    id: 'exec-8',
    task: 'Send meeting agenda',
    description: 'Share concise agenda with executive attendees',
    category: 'communication',
    priority: 'medium',
    daysBeforeMilestone: 2,
    dimension: 'Stakeholder Engagement',
  },
];

// ============================================
// Template Registry
// ============================================

const TEMPLATES: Record<MilestoneType, ChecklistTemplate[]> = {
  renewal: RENEWAL_CHECKLIST,
  expansion: EXPANSION_CHECKLIST,
  qbr: QBR_CHECKLIST,
  onboarding_complete: ONBOARDING_CHECKLIST,
  executive_briefing: EXEC_BRIEFING_CHECKLIST,
};

// ============================================
// Checklist Generation
// ============================================

export function generateChecklistFromTemplate(
  milestoneType: MilestoneType,
  milestoneDate: string,
  customizations?: {
    excludeIds?: string[];
    additionalItems?: ChecklistTemplate[];
    priorityOverrides?: Record<string, ChecklistPriority>;
  }
): GeneratedChecklist {
  const template = TEMPLATES[milestoneType] || RENEWAL_CHECKLIST;
  const milestone = new Date(milestoneDate);
  const now = new Date();

  let items: ChecklistItem[] = [];

  // Generate items from template
  for (const templateItem of template) {
    // Skip excluded items
    if (customizations?.excludeIds?.includes(templateItem.id)) {
      continue;
    }

    // Calculate due date
    const dueDate = new Date(milestone);
    dueDate.setDate(dueDate.getDate() - templateItem.daysBeforeMilestone);

    // Apply priority override if specified
    const priority = customizations?.priorityOverrides?.[templateItem.id] || templateItem.priority;

    items.push({
      ...templateItem,
      id: uuidv4(), // Generate new unique ID
      priority,
      dueDate: dueDate.toISOString().split('T')[0],
      completed: false,
      completedAt: null,
      assignee: null,
      notes: null,
    });
  }

  // Add custom items
  if (customizations?.additionalItems) {
    for (const customItem of customizations.additionalItems) {
      const dueDate = new Date(milestone);
      dueDate.setDate(dueDate.getDate() - customItem.daysBeforeMilestone);

      items.push({
        ...customItem,
        id: uuidv4(),
        dueDate: dueDate.toISOString().split('T')[0],
        completed: false,
        completedAt: null,
        assignee: null,
        notes: null,
      });
    }
  }

  // Sort by due date and priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => {
    const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Calculate totals
  const totalTasks = items.length;
  const criticalTasks = items.filter(i => i.priority === 'critical').length;
  const estimatedHours = items.reduce((sum, item) => {
    const hours = { critical: 3, high: 2, medium: 1.5, low: 1 };
    return sum + hours[item.priority];
  }, 0);

  return {
    milestoneType,
    items,
    totalTasks,
    criticalTasks,
    estimatedHours: Math.round(estimatedHours * 10) / 10,
  };
}

export function getTemplatesByMilestone(milestoneType: MilestoneType): ChecklistTemplate[] {
  return TEMPLATES[milestoneType] || [];
}

export function getAllTemplates(): Record<MilestoneType, ChecklistTemplate[]> {
  return TEMPLATES;
}

// ============================================
// Checklist Progress Calculation
// ============================================

export function calculateChecklistProgress(items: ChecklistItem[]): {
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  overdueTasks: number;
  criticalRemaining: number;
  onTrack: boolean;
} {
  const now = new Date();
  const totalTasks = items.length;
  const completedTasks = items.filter(i => i.completed).length;
  const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const overdueTasks = items.filter(i =>
    !i.completed && new Date(i.dueDate) < now
  ).length;

  const criticalRemaining = items.filter(i =>
    !i.completed && i.priority === 'critical'
  ).length;

  // On track if no critical items overdue and less than 20% items overdue
  const criticalOverdue = items.filter(i =>
    !i.completed && i.priority === 'critical' && new Date(i.dueDate) < now
  ).length;
  const onTrack = criticalOverdue === 0 && (overdueTasks / totalTasks) < 0.2;

  return {
    totalTasks,
    completedTasks,
    percentComplete,
    overdueTasks,
    criticalRemaining,
    onTrack,
  };
}

export const readinessChecklistTemplates = {
  generateChecklistFromTemplate,
  getTemplatesByMilestone,
  getAllTemplates,
  calculateChecklistProgress,
};
