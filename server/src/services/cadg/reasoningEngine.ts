/**
 * Reasoning Engine
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Generates execution plans from context and task type using Claude
 * to reason about optimal structure based on available data.
 */

import {
  TaskType,
  AggregatedContext,
  ExecutionPlan,
  PlanSection,
  PlanInput,
  PlanDataSource,
  PlanExternalSource,
  PlanAction,
  Methodology,
  ArtifactType,
} from './types.js';

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// Default sections for each task type
const DEFAULT_SECTIONS: Record<TaskType, PlanSection[]> = {
  qbr_generation: [
    { name: 'Executive Summary', description: '30-second overview of relationship health and key highlights', dataSources: ['customer_360', 'health_trends'] },
    { name: 'Key Metrics & Health', description: 'Health score trend, engagement metrics, adoption data', dataSources: ['health_trends', 'engagement_metrics'] },
    { name: 'Wins & Value Delivered', description: 'Achievements, milestones, and ROI highlights', dataSources: ['customer_history', 'knowledge_base'] },
    { name: 'Challenges & Risks', description: 'Current issues and mitigation plans', dataSources: ['risk_signals', 'customer_history'] },
    { name: 'Product Roadmap', description: 'Upcoming features aligned to customer needs', dataSources: ['knowledge_base'] },
    { name: 'Renewal & Expansion', description: 'Renewal status and growth opportunities', dataSources: ['renewal_forecast', 'customer_360'] },
    { name: 'Next Steps', description: 'Action items with owners and timelines', dataSources: ['customer_history'] },
  ],
  data_analysis: [
    { name: 'Analysis Overview', description: 'Scope and methodology of analysis', dataSources: ['knowledge_base'] },
    { name: 'Key Findings', description: 'Primary insights from the data', dataSources: ['customer_360', 'health_trends', 'engagement_metrics'] },
    { name: 'Trends & Patterns', description: 'Longitudinal analysis and patterns', dataSources: ['health_trends'] },
    { name: 'Recommendations', description: 'Data-driven recommendations', dataSources: ['knowledge_base'] },
  ],
  presentation_creation: [
    { name: 'Title Slide', description: 'Presentation title and date', dataSources: ['customer_360'] },
    { name: 'Agenda', description: 'Topics to cover', dataSources: [] },
    { name: 'Main Content', description: 'Core presentation content', dataSources: ['customer_360', 'knowledge_base'] },
    { name: 'Key Takeaways', description: 'Summary and next steps', dataSources: [] },
  ],
  document_creation: [
    { name: 'Introduction', description: 'Purpose and context', dataSources: ['customer_360'] },
    { name: 'Main Content', description: 'Core document content', dataSources: ['knowledge_base', 'customer_360'] },
    { name: 'Conclusion', description: 'Summary and next steps', dataSources: [] },
  ],
  email_drafting: [
    { name: 'Subject Line', description: 'Compelling subject line', dataSources: ['customer_history'] },
    { name: 'Opening', description: 'Personalized greeting and context', dataSources: ['customer_360', 'customer_history'] },
    { name: 'Body', description: 'Main message content', dataSources: ['knowledge_base'] },
    { name: 'Call to Action', description: 'Clear next step', dataSources: [] },
    { name: 'Sign-off', description: 'Professional closing', dataSources: [] },
  ],
  meeting_prep: [
    { name: 'Customer Overview', description: 'Quick profile refresh', dataSources: ['customer_360'] },
    { name: 'Health & Engagement', description: 'Current health status and recent activity', dataSources: ['health_trends', 'engagement_metrics'] },
    { name: 'Recent Interactions', description: 'Last touchpoints and context', dataSources: ['customer_history'] },
    { name: 'Risk Signals', description: 'Active risks to address', dataSources: ['risk_signals'] },
    { name: 'Talking Points', description: 'Suggested discussion topics', dataSources: ['knowledge_base'] },
    { name: 'Goals', description: 'Meeting objectives', dataSources: [] },
  ],
  transcription_summary: [
    { name: 'Meeting Overview', description: 'Date, attendees, purpose', dataSources: [] },
    { name: 'Key Discussion Points', description: 'Main topics covered', dataSources: [] },
    { name: 'Decisions Made', description: 'Agreements and outcomes', dataSources: [] },
    { name: 'Action Items', description: 'Tasks with owners and due dates', dataSources: [] },
    { name: 'Follow-ups', description: 'Next steps and scheduling', dataSources: [] },
  ],
  health_analysis: [
    { name: 'Current Health Status', description: 'Health score and components', dataSources: ['customer_360', 'health_trends'] },
    { name: 'Trend Analysis', description: 'Historical changes and patterns', dataSources: ['health_trends'] },
    { name: 'Contributing Factors', description: 'What is driving the score', dataSources: ['engagement_metrics', 'risk_signals'] },
    { name: 'Comparison', description: 'Cohort and historical benchmarks', dataSources: ['knowledge_base'] },
    { name: 'Recommendations', description: 'Actions to improve health', dataSources: ['knowledge_base'] },
  ],
  expansion_planning: [
    { name: 'Account Overview', description: 'Current usage and potential', dataSources: ['customer_360'] },
    { name: 'Expansion Signals', description: 'Indicators of growth readiness', dataSources: ['engagement_metrics', 'customer_history'] },
    { name: 'Opportunity Analysis', description: 'Products/services to propose', dataSources: ['knowledge_base', 'customer_360'] },
    { name: 'Stakeholder Map', description: 'Key decision makers', dataSources: ['customer_360'] },
    { name: 'Approach Strategy', description: 'Timing and messaging', dataSources: ['knowledge_base'] },
  ],
  risk_assessment: [
    { name: 'Risk Overview', description: 'Current risk level', dataSources: ['customer_360', 'risk_signals'] },
    { name: 'Active Risk Signals', description: 'Detailed risk breakdown', dataSources: ['risk_signals'] },
    { name: 'Root Cause Analysis', description: 'What is driving the risks', dataSources: ['health_trends', 'customer_history'] },
    { name: 'Mitigation Plan', description: 'Recommended save plays', dataSources: ['knowledge_base'] },
    { name: 'Timeline', description: 'Urgency and action dates', dataSources: ['renewal_forecast'] },
  ],
  custom: [
    { name: 'Overview', description: 'Task context', dataSources: ['customer_360'] },
    { name: 'Analysis', description: 'Main content', dataSources: ['knowledge_base'] },
    { name: 'Recommendations', description: 'Next steps', dataSources: [] },
  ],
};

// Output format for each task type
const OUTPUT_FORMATS: Record<TaskType, ArtifactType> = {
  qbr_generation: 'slides',
  data_analysis: 'chat',
  presentation_creation: 'slides',
  document_creation: 'docs',
  email_drafting: 'email',
  meeting_prep: 'chat',
  transcription_summary: 'chat',
  health_analysis: 'chat',
  expansion_planning: 'docs',
  risk_assessment: 'chat',
  custom: 'chat',
};

/**
 * Creates an execution plan from task type and context
 */
export async function createPlan(params: {
  taskType: TaskType;
  context: AggregatedContext;
  userQuery: string;
  methodology?: Methodology | null;
}): Promise<ExecutionPlan> {
  const { taskType, context, userQuery, methodology } = params;

  // Build inputs from context
  const inputs = buildPlanInputs(context);

  // Get sections (from methodology if available, else defaults)
  const sections = methodology?.steps
    ? methodology.steps.map(step => ({
        name: step.name,
        description: step.description,
        dataSources: step.dataNeeded,
      }))
    : DEFAULT_SECTIONS[taskType];

  // Optionally enhance sections with LLM reasoning
  const enhancedSections = await enhanceSectionsWithLLM(
    taskType,
    userQuery,
    context,
    sections
  );

  // Build actions
  const actions = buildActions(taskType, enhancedSections);

  // Determine destination
  const outputFormat = OUTPUT_FORMATS[taskType];
  const destination = buildDestination(taskType, outputFormat, context);

  // Estimate length
  const estimatedLength = estimateLength(taskType, enhancedSections);

  return {
    planId: uuidv4(),
    taskType,
    inputs,
    structure: {
      sections: enhancedSections,
      outputFormat,
      estimatedLength,
    },
    actions,
    destination,
  };
}

/**
 * Build plan inputs from aggregated context
 */
function buildPlanInputs(context: AggregatedContext): ExecutionPlan['inputs'] {
  const knowledgeBase: PlanInput[] = [
    ...context.knowledge.playbooks.slice(0, 3).map(p => ({
      title: p.title,
      relevance: Math.round(p.relevanceScore * 100),
      usage: 'Will guide structure and best practices',
    })),
    ...context.knowledge.templates.slice(0, 2).map(t => ({
      title: t.name,
      relevance: Math.round(t.relevanceScore * 100),
      usage: 'Template for content structure',
    })),
  ];

  const platformData: PlanDataSource[] = [];

  if (context.platformData.customer360) {
    platformData.push({
      source: 'Customer 360 Profile',
      dataPoints: [
        `Health Score: ${context.platformData.customer360.healthScore}%`,
        `ARR: $${(context.platformData.customer360.arr / 1000).toFixed(0)}K`,
        `Status: ${context.platformData.customer360.status}`,
      ],
      usage: 'Customer context and metrics',
    });
  }

  if (context.platformData.healthTrends.length > 0) {
    const trend = context.platformData.healthTrends;
    const direction = trend.length > 1 && trend[trend.length - 1].score > trend[0].score
      ? 'improving'
      : trend.length > 1 && trend[trend.length - 1].score < trend[0].score
      ? 'declining'
      : 'stable';

    platformData.push({
      source: 'Health Trends',
      dataPoints: [
        `${trend.length} data points over period`,
        `Trend direction: ${direction}`,
        `Current: ${trend[trend.length - 1]?.score || 0}%`,
      ],
      usage: 'Historical health data and trends',
    });
  }

  if (context.platformData.riskSignals.length > 0) {
    platformData.push({
      source: 'Risk Signals',
      dataPoints: context.platformData.riskSignals.slice(0, 3).map(
        r => `${r.severity.toUpperCase()}: ${r.description}`
      ),
      usage: 'Active risks to address',
    });
  }

  if (context.platformData.renewalForecast) {
    platformData.push({
      source: 'Renewal Forecast',
      dataPoints: [
        `Probability: ${context.platformData.renewalForecast.probability}%`,
        `Days until renewal: ${context.platformData.renewalForecast.daysUntilRenewal}`,
      ],
      usage: 'Renewal context and recommendations',
    });
  }

  const externalSources: PlanExternalSource[] = [];

  if (context.externalSources.previousArtifacts.length > 0) {
    const qbrArtifacts = context.externalSources.previousArtifacts.filter(
      a => a.type === 'slides' || a.title.toLowerCase().includes('qbr')
    );
    if (qbrArtifacts.length > 0) {
      externalSources.push({
        type: 'drive',
        name: `Previous ${qbrArtifacts[0].title}`,
        usage: 'Reference for consistency and comparison',
      });
    }
  }

  if (context.externalSources.emailThreads.length > 0) {
    externalSources.push({
      type: 'email',
      name: `${context.externalSources.emailThreads.length} recent email threads`,
      usage: 'Recent communication context',
    });
  }

  return { knowledgeBase, platformData, externalSources };
}

/**
 * Enhance sections with LLM reasoning (optional)
 */
async function enhanceSectionsWithLLM(
  taskType: TaskType,
  userQuery: string,
  context: AggregatedContext,
  baseSections: PlanSection[]
): Promise<PlanSection[]> {
  // For simple tasks, use default sections
  if (['chat', 'email'].includes(OUTPUT_FORMATS[taskType])) {
    return baseSections;
  }

  try {
    // Use Claude to potentially adjust sections based on context
    const contextSummary = buildContextSummary(context);

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Given this task and context, should the section structure be modified?

Task: ${taskType}
User request: "${userQuery}"
Context summary: ${contextSummary}

Current sections:
${baseSections.map(s => `- ${s.name}: ${s.description}`).join('\n')}

Reply with either:
1. "KEEP" - if the sections are appropriate
2. "MODIFY: [brief explanation]" followed by adjusted section names (one per line, just the names)

Be conservative - only suggest changes if clearly needed based on context.`
      }],
    });

    const response = (message.content[0] as { type: 'text'; text: string }).text.trim();

    if (response.startsWith('KEEP')) {
      return baseSections;
    }

    // Parse modifications if suggested
    // For now, we'll keep the base sections since parsing is complex
    return baseSections;
  } catch (error) {
    console.error('[reasoningEngine] LLM enhancement error:', error);
    return baseSections;
  }
}

/**
 * Build a summary of context for LLM
 */
function buildContextSummary(context: AggregatedContext): string {
  const parts: string[] = [];

  if (context.platformData.customer360) {
    const c = context.platformData.customer360;
    parts.push(`Customer: ${c.name}, Health: ${c.healthScore}%, Status: ${c.status}`);
  }

  if (context.platformData.riskSignals.length > 0) {
    const critical = context.platformData.riskSignals.filter(r => r.severity === 'critical');
    parts.push(`Risks: ${context.platformData.riskSignals.length} total, ${critical.length} critical`);
  }

  if (context.platformData.renewalForecast) {
    parts.push(`Renewal in ${context.platformData.renewalForecast.daysUntilRenewal} days`);
  }

  return parts.join('. ') || 'No specific context available';
}

/**
 * Build action steps for the plan
 */
function buildActions(taskType: TaskType, sections: PlanSection[]): PlanAction[] {
  const actions: PlanAction[] = [
    {
      step: 1,
      action: 'Gather and validate all data sources',
      requiresApproval: false,
    },
  ];

  // Add section generation steps
  sections.forEach((section, index) => {
    actions.push({
      step: index + 2,
      action: `Generate "${section.name}" section`,
      requiresApproval: false,
    });
  });

  // Add final steps based on output type
  const outputType = OUTPUT_FORMATS[taskType];

  if (outputType === 'slides' || outputType === 'docs') {
    actions.push({
      step: actions.length + 1,
      action: 'Create document in Google Drive',
      requiresApproval: true,
    });
  }

  if (outputType === 'email') {
    actions.push({
      step: actions.length + 1,
      action: 'Create email draft',
      requiresApproval: true,
    });
  }

  return actions;
}

/**
 * Build destination configuration
 */
function buildDestination(
  taskType: TaskType,
  outputFormat: ArtifactType,
  context: AggregatedContext
): ExecutionPlan['destination'] {
  const customerName = context.platformData.customer360?.name || 'Customer';

  switch (outputFormat) {
    case 'slides':
      return {
        primary: `Google Slides in ${customerName} folder`,
        secondary: 'PDF export available',
        chatPreview: true,
      };
    case 'docs':
      return {
        primary: `Google Docs in ${customerName} folder`,
        secondary: 'PDF export available',
        chatPreview: true,
      };
    case 'email':
      return {
        primary: 'Email draft in Gmail',
        chatPreview: true,
      };
    case 'sheets':
      return {
        primary: `Google Sheets in ${customerName} folder`,
        chatPreview: true,
      };
    case 'chat':
    default:
      return {
        primary: 'In-chat response',
        chatPreview: false,
      };
  }
}

/**
 * Estimate content length based on task and sections
 */
function estimateLength(taskType: TaskType, sections: PlanSection[]): string {
  const estimates: Record<TaskType, string> = {
    qbr_generation: `${sections.length}-${sections.length + 3} slides`,
    data_analysis: '500-1000 words',
    presentation_creation: `${sections.length}-${sections.length + 2} slides`,
    document_creation: '1-3 pages',
    email_drafting: '150-300 words',
    meeting_prep: '300-500 words',
    transcription_summary: '200-400 words',
    health_analysis: '400-600 words',
    expansion_planning: '1-2 pages',
    risk_assessment: '300-500 words',
    custom: '200-500 words',
  };

  return estimates[taskType];
}

export const reasoningEngine = {
  createPlan,
};
