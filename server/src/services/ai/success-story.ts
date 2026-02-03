/**
 * AI Success Story Generator Service (PRD-240)
 *
 * Uses Claude to automatically draft success stories from customer data,
 * metrics, meeting transcripts, and achievement records.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export type StoryStatus = 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'published' | 'archived';
export type StoryTone = 'professional' | 'conversational' | 'executive' | 'technical';

export interface CustomerMetrics {
  healthScoreImprovement?: number;
  currentHealthScore?: number;
  retentionRate?: number;
  expansionRevenue?: number;
  efficiencyGains?: string;
  timeToValue?: string;
  costSavings?: number;
  npsScore?: number;
  adoptionRate?: number;
  customMetrics?: Record<string, string | number>;
}

export interface CustomerQuote {
  text: string;
  author: string;
  role: string;
  source?: string;
  date?: string;
}

export interface SuccessStoryContext {
  customerId: string;
  customerName: string;
  industry?: string;
  companySize?: string;
  region?: string;
  productUsed?: string;
  implementationDate?: string;
  metrics: CustomerMetrics;
  challenges?: string[];
  solutions?: string[];
  outcomes?: string[];
  quotes?: CustomerQuote[];
  milestones?: string[];
  relatedMeetings?: string[];
}

export interface GenerateStoryParams {
  context: SuccessStoryContext;
  tone?: StoryTone;
  focusArea?: 'metrics' | 'transformation' | 'roi' | 'innovation';
  customInstructions?: string;
  includeCallToAction?: boolean;
}

export interface GeneratedStory {
  title: string;
  summary: string;
  challenge: string;
  solution: string;
  results: string;
  narrative: string;
  keyMetrics: Array<{ label: string; value: string; icon?: string }>;
  quotes: CustomerQuote[];
  tags: string[];
  suggestedImages?: string[];
  callToAction?: string;
}

export interface SuccessStory {
  id: string;
  customerId: string;
  title: string;
  summary: string;
  challenge: string;
  solution: string;
  results: string;
  narrative: string;
  metrics: CustomerMetrics;
  quotes: CustomerQuote[];
  tags: string[];
  status: StoryStatus;
  tone: StoryTone;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a success story using Claude
 */
export async function generateSuccessStory(params: GenerateStoryParams): Promise<GeneratedStory> {
  const {
    context,
    tone = 'professional',
    focusArea = 'transformation',
    customInstructions,
    includeCallToAction = true,
  } = params;

  const prompt = buildStoryPrompt(context, tone, focusArea, customInstructions, includeCallToAction);

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: `You are an expert B2B marketing writer specializing in customer success stories and case studies.

Your success stories should:
- Lead with compelling outcomes and quantifiable results
- Tell a narrative journey from challenge to transformation
- Include specific metrics with context (before/after, percentages, dollar amounts)
- Use customer quotes strategically to add authenticity
- Be scannable with clear sections while maintaining narrative flow
- Avoid generic marketing language - be specific and concrete
- Match the requested tone while remaining credible

Always return valid JSON matching the requested format.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    return parseStoryResponse(responseText, context);
  } catch (error) {
    console.error('Success story generation error:', error);
    return generateFallbackStory(context);
  }
}

/**
 * Build the prompt for story generation
 */
function buildStoryPrompt(
  context: SuccessStoryContext,
  tone: StoryTone,
  focusArea: string,
  customInstructions?: string,
  includeCallToAction?: boolean
): string {
  const toneDescriptions: Record<StoryTone, string> = {
    professional: 'formal, authoritative, data-driven language suitable for executive audiences',
    conversational: 'warm, relatable, story-driven language that connects emotionally',
    executive: 'concise, ROI-focused, bottom-line oriented for C-suite readers',
    technical: 'detailed, feature-focused language for technical decision-makers',
  };

  const focusDescriptions: Record<string, string> = {
    metrics: 'quantifiable improvements and hard numbers',
    transformation: 'the journey and cultural/operational change',
    roi: 'financial returns and cost savings',
    innovation: 'unique use cases and cutting-edge applications',
  };

  const metricsStr = context.metrics
    ? Object.entries(context.metrics)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `  - ${formatMetricKey(k)}: ${v}`)
        .join('\n')
    : 'No metrics available';

  const challengesStr = context.challenges?.length
    ? context.challenges.map(c => `  - ${c}`).join('\n')
    : 'Not specified';

  const solutionsStr = context.solutions?.length
    ? context.solutions.map(s => `  - ${s}`).join('\n')
    : 'Not specified';

  const outcomesStr = context.outcomes?.length
    ? context.outcomes.map(o => `  - ${o}`).join('\n')
    : 'Not specified';

  const quotesStr = context.quotes?.length
    ? context.quotes
        .map(q => `  - "${q.text}" — ${q.author}, ${q.role}${q.source ? ` (from ${q.source})` : ''}`)
        .join('\n')
    : 'No quotes available';

  const milestonesStr = context.milestones?.length
    ? context.milestones.map(m => `  - ${m}`).join('\n')
    : 'Not specified';

  return `Generate a compelling success story for ${context.customerName}.

## CUSTOMER CONTEXT

Company: ${context.customerName}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.companySize ? `Company Size: ${context.companySize}` : ''}
${context.region ? `Region: ${context.region}` : ''}
${context.productUsed ? `Product Used: ${context.productUsed}` : ''}
${context.implementationDate ? `Implementation Date: ${context.implementationDate}` : ''}

## METRICS & RESULTS

${metricsStr}

## CHALLENGES (Before)

${challengesStr}

## SOLUTIONS (What We Did)

${solutionsStr}

## OUTCOMES (Results)

${outcomesStr}

## CUSTOMER QUOTES

${quotesStr}

## MILESTONES

${milestonesStr}

## REQUIREMENTS

Tone: ${tone} - ${toneDescriptions[tone]}
Focus: ${focusArea} - Emphasize ${focusDescriptions[focusArea]}
${customInstructions ? `\nSpecial Instructions: ${customInstructions}` : ''}
${includeCallToAction ? '\nInclude a call-to-action at the end.' : ''}

## OUTPUT FORMAT

Return a JSON object with exactly this structure:
{
  "title": "Compelling headline that leads with the key outcome (e.g., 'How ${context.customerName} Achieved X% Improvement')",
  "summary": "2-3 sentence executive summary of the transformation (50-75 words)",
  "challenge": "Detailed description of the challenges faced before (100-150 words)",
  "solution": "How CSCX.AI addressed these challenges (100-150 words)",
  "results": "Key results and outcomes achieved (100-150 words)",
  "narrative": "Full story combining all sections with smooth transitions (400-600 words)",
  "keyMetrics": [
    {"label": "Metric name", "value": "Metric value with units", "icon": "relevant emoji"}
  ],
  "quotes": [
    {"text": "Quote text", "author": "Name", "role": "Title", "source": "Source if known"}
  ],
  "tags": ["relevant", "tags", "for", "categorization"],
  "suggestedImages": ["Description of suggested visual 1", "Description of suggested visual 2"],
  ${includeCallToAction ? '"callToAction": "Clear call-to-action message"' : ''}
}

Return ONLY valid JSON, no markdown code blocks.`;
}

/**
 * Format metric key for display
 */
function formatMetricKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/_/g, ' ');
}

/**
 * Parse the LLM response into a GeneratedStory
 */
function parseStoryResponse(text: string, context: SuccessStoryContext): GeneratedStory {
  let jsonString = text.trim();

  // Remove markdown code blocks if present
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.slice(7);
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.slice(3);
  }
  if (jsonString.endsWith('```')) {
    jsonString = jsonString.slice(0, -3);
  }

  jsonString = jsonString.trim();

  try {
    const parsed = JSON.parse(jsonString);
    return {
      title: parsed.title || `Success Story: ${context.customerName}`,
      summary: parsed.summary || 'Customer achieved significant results with CSCX.AI.',
      challenge: parsed.challenge || 'Challenges not specified.',
      solution: parsed.solution || 'Solution details pending.',
      results: parsed.results || 'Results to be documented.',
      narrative: parsed.narrative || '',
      keyMetrics: parsed.keyMetrics || [],
      quotes: parsed.quotes || context.quotes || [],
      tags: parsed.tags || [],
      suggestedImages: parsed.suggestedImages || [],
      callToAction: parsed.callToAction,
    };
  } catch (error) {
    console.error('Failed to parse success story response:', error);
    throw new Error('Failed to parse AI-generated success story');
  }
}

/**
 * Generate a fallback story when AI fails
 */
function generateFallbackStory(context: SuccessStoryContext): GeneratedStory {
  const metricsDisplay: Array<{ label: string; value: string; icon: string }> = [];

  if (context.metrics.healthScoreImprovement) {
    metricsDisplay.push({
      label: 'Health Score Improvement',
      value: `+${context.metrics.healthScoreImprovement}%`,
      icon: '📈',
    });
  }
  if (context.metrics.efficiencyGains) {
    metricsDisplay.push({
      label: 'Efficiency Gains',
      value: context.metrics.efficiencyGains,
      icon: '⚡',
    });
  }
  if (context.metrics.costSavings) {
    metricsDisplay.push({
      label: 'Cost Savings',
      value: `$${context.metrics.costSavings.toLocaleString()}`,
      icon: '💰',
    });
  }

  return {
    title: `How ${context.customerName} Transformed Their Customer Success Operations`,
    summary: `${context.customerName} partnered with CSCX.AI to transform their customer success operations, achieving measurable improvements in efficiency and customer outcomes.`,
    challenge: context.challenges?.join(' ') || 'The team faced challenges with manual processes and lack of visibility into customer health.',
    solution: context.solutions?.join(' ') || 'CSCX.AI provided automated workflows, AI-powered insights, and proactive engagement tools.',
    results: context.outcomes?.join(' ') || 'The team achieved significant improvements in customer retention and operational efficiency.',
    narrative: `${context.customerName} embarked on a journey to transform their customer success operations with CSCX.AI. ${context.challenges?.[0] || 'Prior to implementation, the team struggled with manual processes.'} ${context.solutions?.[0] || 'By leveraging CSCX.AI\'s intelligent automation, they were able to streamline their workflows.'} ${context.outcomes?.[0] || 'The results speak for themselves.'} This partnership continues to drive value and growth for both organizations.`,
    keyMetrics: metricsDisplay,
    quotes: context.quotes || [],
    tags: [context.industry || 'technology', 'customer-success', 'automation'].filter(Boolean),
    suggestedImages: [
      'Before/after comparison chart',
      'Customer team photo or logo',
      'Key metrics infographic',
    ],
    callToAction: 'Ready to transform your customer success operations? Contact us to learn how CSCX.AI can help.',
  };
}

/**
 * Save a success story to the database
 */
export async function saveSuccessStory(
  story: Partial<SuccessStory>,
  userId: string
): Promise<SuccessStory | null> {
  if (!supabase) {
    console.warn('Supabase not configured - story not persisted');
    return {
      id: `story_${Date.now()}`,
      customerId: story.customerId || '',
      title: story.title || '',
      summary: story.summary || '',
      challenge: story.challenge || '',
      solution: story.solution || '',
      results: story.results || '',
      narrative: story.narrative || '',
      metrics: story.metrics || {},
      quotes: story.quotes || [],
      tags: story.tags || [],
      status: story.status || 'draft',
      tone: story.tone || 'professional',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase
      .from('success_stories')
      .insert({
        customer_id: story.customerId,
        title: story.title,
        summary: story.summary,
        challenge: story.challenge,
        solution: story.solution,
        results: story.results,
        narrative: story.narrative,
        metrics: story.metrics,
        quotes: story.quotes,
        tags: story.tags,
        status: story.status || 'draft',
        tone: story.tone || 'professional',
        created_by: userId,
        metadata: story.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save success story:', error);
      return null;
    }

    return mapDbToStory(data);
  } catch (error) {
    console.error('Error saving success story:', error);
    return null;
  }
}

/**
 * Get a success story by ID
 */
export async function getSuccessStory(storyId: string): Promise<SuccessStory | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('success_stories')
      .select('*')
      .eq('id', storyId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapDbToStory(data);
  } catch (error) {
    console.error('Error fetching success story:', error);
    return null;
  }
}

/**
 * Update a success story
 */
export async function updateSuccessStory(
  storyId: string,
  updates: Partial<SuccessStory>,
  userId: string
): Promise<SuccessStory | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('success_stories')
      .update({
        title: updates.title,
        summary: updates.summary,
        challenge: updates.challenge,
        solution: updates.solution,
        results: updates.results,
        narrative: updates.narrative,
        metrics: updates.metrics,
        quotes: updates.quotes,
        tags: updates.tags,
        status: updates.status,
        tone: updates.tone,
        approved_by: updates.approvedBy,
        published_at: updates.publishedAt,
        updated_at: new Date().toISOString(),
        metadata: updates.metadata,
      })
      .eq('id', storyId)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to update success story:', error);
      return null;
    }

    return mapDbToStory(data);
  } catch (error) {
    console.error('Error updating success story:', error);
    return null;
  }
}

/**
 * List success stories for a customer
 */
export async function listSuccessStories(
  customerId?: string,
  status?: StoryStatus,
  limit: number = 50
): Promise<SuccessStory[]> {
  if (!supabase) {
    return [];
  }

  try {
    let query = supabase
      .from('success_stories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to list success stories:', error);
      return [];
    }

    return (data || []).map(mapDbToStory);
  } catch (error) {
    console.error('Error listing success stories:', error);
    return [];
  }
}

/**
 * Delete a success story
 */
export async function deleteSuccessStory(storyId: string): Promise<boolean> {
  if (!supabase) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('success_stories')
      .delete()
      .eq('id', storyId);

    if (error) {
      console.error('Failed to delete success story:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting success story:', error);
    return false;
  }
}

/**
 * Get customer context for story generation
 */
export async function getCustomerStoryContext(customerId: string): Promise<SuccessStoryContext | null> {
  if (!supabase) {
    // Return mock context for development
    return {
      customerId,
      customerName: 'Demo Customer',
      industry: 'Technology',
      metrics: {
        healthScoreImprovement: 25,
        currentHealthScore: 85,
        efficiencyGains: '40%',
        costSavings: 50000,
      },
      challenges: ['Manual processes', 'Lack of visibility', 'Reactive engagement'],
      solutions: ['Automated workflows', 'AI-powered insights', 'Proactive alerts'],
      outcomes: ['Improved retention', 'Reduced churn', 'Increased efficiency'],
    };
  }

  try {
    // Get customer data
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return null;
    }

    // Get health score history for improvement calculation
    const { data: healthHistory } = await supabase
      .from('health_score_history')
      .select('score, recorded_at')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: true })
      .limit(10);

    let healthScoreImprovement: number | undefined;
    if (healthHistory && healthHistory.length >= 2) {
      const first = healthHistory[0].score;
      const last = healthHistory[healthHistory.length - 1].score;
      healthScoreImprovement = last - first;
    }

    // Get quotes from transcripts (if available)
    const quotes: CustomerQuote[] = [];
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('content, speaker, meeting_date, source')
      .eq('customer_id', customerId)
      .order('meeting_date', { ascending: false })
      .limit(5);

    // Extract positive quotes (simplified - in production would use AI)
    if (transcripts) {
      for (const t of transcripts) {
        if (t.content && t.content.toLowerCase().includes('great') || t.content?.toLowerCase().includes('excellent')) {
          quotes.push({
            text: t.content.slice(0, 200),
            author: t.speaker || 'Customer',
            role: 'Customer Representative',
            source: t.source || 'Meeting transcript',
            date: t.meeting_date,
          });
          if (quotes.length >= 3) break;
        }
      }
    }

    return {
      customerId,
      customerName: customer.name,
      industry: customer.industry,
      companySize: customer.company_size,
      region: customer.region,
      metrics: {
        healthScoreImprovement,
        currentHealthScore: customer.health_score,
        retentionRate: customer.retention_rate,
        npsScore: customer.nps_score,
        adoptionRate: customer.adoption_rate,
      },
      quotes,
    };
  } catch (error) {
    console.error('Error fetching customer context:', error);
    return null;
  }
}

/**
 * Extract quotes from meeting transcripts using AI
 */
export async function extractQuotesFromTranscripts(
  customerId: string,
  limit: number = 5
): Promise<CustomerQuote[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('content, speaker, meeting_date, source')
      .eq('customer_id', customerId)
      .order('meeting_date', { ascending: false })
      .limit(20);

    if (!transcripts || transcripts.length === 0) {
      return [];
    }

    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const transcriptText = transcripts
      .map(t => `[${t.speaker || 'Unknown'}]: ${t.content}`)
      .join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Extract up to ${limit} compelling, positive customer quotes from these meeting transcripts that would work well in a success story. Focus on quotes about value received, results achieved, or positive experiences.

Transcripts:
${transcriptText}

Return JSON array:
[{"text": "quote", "author": "name if known", "role": "title if known", "source": "transcript date/source"}]

Return ONLY valid JSON array, no markdown.`,
        },
      ],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '[]';

    let jsonString = responseText.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```$/g, '');
    }

    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error extracting quotes:', error);
    return [];
  }
}

/**
 * Map database row to SuccessStory type
 */
function mapDbToStory(row: Record<string, unknown>): SuccessStory {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    title: row.title as string,
    summary: row.summary as string,
    challenge: row.challenge as string,
    solution: row.solution as string,
    results: row.results as string,
    narrative: row.narrative as string,
    metrics: (row.metrics as CustomerMetrics) || {},
    quotes: (row.quotes as CustomerQuote[]) || [],
    tags: (row.tags as string[]) || [],
    status: row.status as StoryStatus,
    tone: (row.tone as StoryTone) || 'professional',
    createdBy: row.created_by as string,
    approvedBy: row.approved_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    publishedAt: row.published_at as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}

export default {
  generateSuccessStory,
  saveSuccessStory,
  getSuccessStory,
  updateSuccessStory,
  listSuccessStories,
  deleteSuccessStory,
  getCustomerStoryContext,
  extractQuotesFromTranscripts,
};
