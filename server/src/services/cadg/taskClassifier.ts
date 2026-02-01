/**
 * Task Classifier
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Classifies user queries into task types using:
 * 1. Keyword matching (fast)
 * 2. Pattern matching (medium)
 * 3. LLM classification (fallback for ambiguous queries)
 */

import {
  TaskType,
  TaskClassificationResult,
  AggregatedContext,
} from './types.js';

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// Keyword patterns for each task type
const KEYWORD_PATTERNS: Record<TaskType, string[]> = {
  qbr_generation: [
    'qbr', 'quarterly business review', 'business review',
    'create a qbr', 'build me a qbr', 'generate qbr',
    'q1 review', 'q2 review', 'q3 review', 'q4 review',
  ],
  data_analysis: [
    'analyze', 'analysis', 'what are the trends',
    'show me data', 'breakdown', 'metrics report',
    'compare', 'benchmark', 'portfolio analysis',
  ],
  presentation_creation: [
    'deck', 'presentation', 'slides', 'slide deck',
    'executive briefing', 'create deck', 'build presentation',
    'powerpoint', 'pitch deck',
  ],
  document_creation: [
    'document', 'doc', 'write a', 'create a plan',
    'onboarding plan', 'success plan', 'account plan',
    'proposal', 'summary document',
  ],
  email_drafting: [
    'email', 'draft email', 'write email', 'compose',
    'send message', 'follow up email', 'outreach',
    'send to', 'email to', 'message to',
  ],
  meeting_prep: [
    'meeting prep', 'prepare for meeting', 'prep me',
    'before the call', 'talking points', 'agenda',
    'call prep', 'brief me', 'get me ready',
  ],
  transcription_summary: [
    'summarize meeting', 'meeting summary', 'call summary',
    'meeting notes', 'transcript', 'summarize recording',
    'action items from', 'recap of',
  ],
  health_analysis: [
    'health score', 'why is health', 'health dropping',
    'health declining', 'health improving', 'analyze health',
    'what happened to health', 'health trend',
  ],
  expansion_planning: [
    'expansion', 'upsell', 'cross-sell', 'grow',
    'increase arr', 'expansion opportunity', 'expansion plan',
    'upgrade', 'additional seats', 'new module',
  ],
  risk_assessment: [
    'risk', 'risks', 'at risk', 'churn risk',
    'warning signs', 'red flags', 'concerns',
    'should i worry', 'problems with', 'issues',
  ],
  custom: [],
};

// Phrase patterns (more specific than keywords)
const PHRASE_PATTERNS: Record<TaskType, RegExp[]> = {
  qbr_generation: [
    /build\s+(me\s+)?a?\s*qbr/i,
    /create\s+(a\s+)?qbr/i,
    /generate\s+(a\s+)?q(br|uarterly)/i,
    /prepare\s+(the\s+)?qbr/i,
    /q[1-4]\s+(business\s+)?review/i,
  ],
  data_analysis: [
    /analyz[e|ing]\s+(the\s+)?(data|metrics|trends)/i,
    /show\s+me\s+(the\s+)?data/i,
    /what\s+(are\s+)?(the\s+)?trends/i,
    /break\s*down\s+(the\s+)?/i,
  ],
  presentation_creation: [
    /create\s+(a\s+)?(deck|presentation|slides)/i,
    /build\s+(me\s+)?(a\s+)?(deck|presentation)/i,
    /executive\s+briefing/i,
  ],
  document_creation: [
    /create\s+(a\s+)?(plan|document|proposal)/i,
    /write\s+(a\s+)?(plan|document)/i,
    /(onboarding|success|account)\s+plan/i,
  ],
  email_drafting: [
    /draft\s+(an?\s+)?email/i,
    /write\s+(an?\s+)?email/i,
    /send\s+(an?\s+)?(email|message)\s+to/i,
    /compose\s+(an?\s+)?/i,
  ],
  meeting_prep: [
    /prep\s+(me\s+)?for\s+(the\s+)?/i,
    /prepare\s+(me\s+)?for\s+(the\s+)?/i,
    /get\s+me\s+ready\s+for/i,
    /brief\s+me\s+(on|for)/i,
    /meeting\s+prep/i,
  ],
  transcription_summary: [
    /summariz[e|ing]\s+(the\s+)?(meeting|call|recording)/i,
    /meeting\s+(notes|summary)/i,
    /action\s+items\s+from/i,
  ],
  health_analysis: [
    /why\s+is\s+(the\s+)?health/i,
    /(health|score)\s+(is\s+)?(dropping|declining|falling)/i,
    /analyz[e|ing]\s+(the\s+)?health/i,
    /what\s+happened\s+to\s+(the\s+)?health/i,
  ],
  expansion_planning: [
    /expansion\s+(opportunity|plan|strategy)/i,
    /(upsell|cross.?sell)\s+(opportunity|strategy)/i,
    /grow\s+(the\s+)?account/i,
  ],
  risk_assessment: [
    /what\s+(are\s+)?(the\s+)?risks/i,
    /assess\s+(the\s+)?risk/i,
    /(churn|at.?risk)\s+/i,
    /warning\s+signs/i,
    /should\s+i\s+(be\s+)?worr/i,
  ],
  custom: [],
};

/**
 * Classifies a user query into a task type
 */
export async function classify(
  userQuery: string,
  context?: Partial<AggregatedContext>
): Promise<TaskClassificationResult> {
  const normalizedQuery = userQuery.toLowerCase().trim();

  // Step 1: Try phrase pattern matching (highest confidence)
  const phraseMatch = matchPhrasePatterns(normalizedQuery);
  if (phraseMatch.taskType !== 'custom') {
    return {
      taskType: phraseMatch.taskType,
      confidence: phraseMatch.confidence,
      suggestedMethodology: getMethodologyForTask(phraseMatch.taskType),
      requiredSources: getRequiredSources(phraseMatch.taskType),
    };
  }

  // Step 2: Try keyword matching (medium confidence)
  const keywordMatch = matchKeywords(normalizedQuery);
  if (keywordMatch.taskType !== 'custom' && keywordMatch.confidence >= 0.7) {
    return {
      taskType: keywordMatch.taskType,
      confidence: keywordMatch.confidence,
      suggestedMethodology: getMethodologyForTask(keywordMatch.taskType),
      requiredSources: getRequiredSources(keywordMatch.taskType),
    };
  }

  // Step 3: Fall back to LLM classification (for ambiguous queries)
  if (keywordMatch.confidence < 0.5) {
    const llmResult = await classifyWithLLM(userQuery);
    return llmResult;
  }

  // Return keyword match with lower confidence
  return {
    taskType: keywordMatch.taskType,
    confidence: keywordMatch.confidence,
    suggestedMethodology: getMethodologyForTask(keywordMatch.taskType),
    requiredSources: getRequiredSources(keywordMatch.taskType),
  };
}

/**
 * Check if a query is a generative request (vs a simple question)
 */
export function isGenerativeRequest(userQuery: string): boolean {
  const generativeIndicators = [
    /^(create|build|generate|make|write|draft|prepare|compose)/i,
    /^(analyze|assess|evaluate|review)/i,
    /^(show me|give me|get me)/i,
    /^(help me|can you)/i,
    /(build|create|generate|write|draft)\s+(a|an|the|me)/i,
    /for\s+(my|the)\s+(meeting|call|qbr|review)/i,
  ];

  return generativeIndicators.some(pattern => pattern.test(userQuery));
}

/**
 * Match against phrase patterns
 */
function matchPhrasePatterns(query: string): { taskType: TaskType; confidence: number } {
  for (const [taskType, patterns] of Object.entries(PHRASE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        return {
          taskType: taskType as TaskType,
          confidence: 0.95, // High confidence for phrase matches
        };
      }
    }
  }
  return { taskType: 'custom', confidence: 0 };
}

/**
 * Match against keywords
 */
function matchKeywords(query: string): { taskType: TaskType; confidence: number } {
  const words = query.split(/\s+/);
  let bestMatch: { taskType: TaskType; score: number } = { taskType: 'custom', score: 0 };

  for (const [taskType, keywords] of Object.entries(KEYWORD_PATTERNS)) {
    if (taskType === 'custom') continue;

    let matchCount = 0;
    for (const keyword of keywords) {
      if (query.includes(keyword.toLowerCase())) {
        matchCount += keyword.split(' ').length; // Multi-word keywords count more
      }
    }

    const score = matchCount / Math.max(words.length, 3); // Normalize by query length

    if (score > bestMatch.score) {
      bestMatch = { taskType: taskType as TaskType, score };
    }
  }

  return {
    taskType: bestMatch.taskType,
    confidence: Math.min(0.9, bestMatch.score + 0.3), // Cap at 0.9 for keyword matches
  };
}

/**
 * Use LLM to classify ambiguous queries
 */
async function classifyWithLLM(userQuery: string): Promise<TaskClassificationResult> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Classify this user query into exactly ONE task type. Reply with ONLY the task type and confidence (0-1).

Task types:
- qbr_generation: Creating quarterly business reviews
- data_analysis: Analyzing data, metrics, or trends
- presentation_creation: Creating decks or presentations
- document_creation: Creating documents, plans, or proposals
- email_drafting: Writing emails or messages
- meeting_prep: Preparing for meetings or calls
- transcription_summary: Summarizing meeting recordings
- health_analysis: Analyzing customer health scores
- expansion_planning: Planning expansion or upsell opportunities
- risk_assessment: Assessing risks or churn indicators
- custom: Doesn't fit any category

Query: "${userQuery}"

Reply format: task_type|confidence
Example: qbr_generation|0.85`
      }],
    });

    const response = (message.content[0] as { type: 'text'; text: string }).text.trim();
    const [taskType, confidenceStr] = response.split('|');

    const validTaskTypes: TaskType[] = [
      'qbr_generation', 'data_analysis', 'presentation_creation',
      'document_creation', 'email_drafting', 'meeting_prep',
      'transcription_summary', 'health_analysis', 'expansion_planning',
      'risk_assessment', 'custom'
    ];

    const normalizedType = taskType.trim().toLowerCase() as TaskType;
    const confidence = parseFloat(confidenceStr) || 0.5;

    if (validTaskTypes.includes(normalizedType)) {
      return {
        taskType: normalizedType,
        confidence,
        suggestedMethodology: getMethodologyForTask(normalizedType),
        requiredSources: getRequiredSources(normalizedType),
      };
    }
  } catch (error) {
    console.error('[taskClassifier] LLM classification error:', error);
  }

  // Default fallback
  return {
    taskType: 'custom',
    confidence: 0.3,
    suggestedMethodology: null,
    requiredSources: ['knowledge_base'],
  };
}

/**
 * Get the suggested methodology for a task type
 */
function getMethodologyForTask(taskType: TaskType): string | null {
  const methodologies: Record<TaskType, string | null> = {
    qbr_generation: 'qbr_methodology',
    data_analysis: 'data_analysis_methodology',
    presentation_creation: 'presentation_methodology',
    document_creation: 'document_creation_methodology',
    email_drafting: 'email_drafting_methodology',
    meeting_prep: 'meeting_prep_methodology',
    transcription_summary: 'summary_methodology',
    health_analysis: 'health_analysis_methodology',
    expansion_planning: 'expansion_methodology',
    risk_assessment: 'risk_assessment_methodology',
    custom: null,
  };
  return methodologies[taskType];
}

/**
 * Get required data sources for a task type
 */
function getRequiredSources(taskType: TaskType): string[] {
  const sources: Record<TaskType, string[]> = {
    qbr_generation: ['knowledge_base', 'customer_360', 'health_trends', 'engagement_metrics', 'drive_previous_qbrs'],
    data_analysis: ['customer_360', 'health_trends', 'engagement_metrics', 'knowledge_base'],
    presentation_creation: ['knowledge_base', 'customer_360', 'drive_templates'],
    document_creation: ['knowledge_base', 'customer_360', 'drive_templates'],
    email_drafting: ['knowledge_base', 'customer_360', 'customer_history', 'gmail_threads'],
    meeting_prep: ['customer_360', 'customer_history', 'risk_signals', 'knowledge_base', 'calendar_events'],
    transcription_summary: ['knowledge_base'],
    health_analysis: ['customer_360', 'health_trends', 'engagement_metrics', 'risk_signals'],
    expansion_planning: ['customer_360', 'engagement_metrics', 'knowledge_base', 'customer_history'],
    risk_assessment: ['customer_360', 'health_trends', 'risk_signals', 'customer_history', 'knowledge_base'],
    custom: ['knowledge_base', 'customer_360'],
  };
  return sources[taskType];
}

export const taskClassifier = {
  classify,
  isGenerativeRequest,
};
