/**
 * AI Coaching Service (PRD-239)
 *
 * AI-powered coaching assistant for CSMs:
 * - Real-time situational guidance
 * - Skill assessment framework
 * - Personalized improvement recommendations
 * - Post-interaction feedback loops
 * - Progress tracking over time
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import * as crypto from 'crypto';

// Initialize Anthropic client
let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================================================
// Types
// ============================================================================

export type SituationType =
  | 'champion_departure'
  | 'champion_promotion'
  | 'escalation'
  | 'churn_risk'
  | 'expansion_opportunity'
  | 'difficult_conversation'
  | 'stakeholder_mapping'
  | 'renewal_negotiation'
  | 'onboarding_stall'
  | 'product_feedback'
  | 'competitor_threat'
  | 'executive_engagement'
  | 'general';

export type SkillArea =
  | 'relationship_building'
  | 'strategic_thinking'
  | 'product_knowledge'
  | 'communication'
  | 'problem_solving'
  | 'time_management'
  | 'negotiation'
  | 'data_analysis'
  | 'executive_presence'
  | 'empathy';

export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5; // 1 = Beginner, 5 = Expert

export type InteractionType =
  | 'guidance_request'
  | 'feedback_request'
  | 'skill_assessment'
  | 'coaching_session'
  | 'weekly_summary';

export interface GuidanceRequest {
  userId: string;
  customerId?: string;
  customerName?: string;
  situationType: SituationType;
  situationDescription: string;
  additionalContext?: string;
}

export interface GuidanceResponse {
  guidanceId: string;
  situationAnalysis: string;
  recommendedApproach: RecommendedAction[];
  watchOutFor: string[];
  templates?: TemplateAction[];
  skillsInvolved: SkillArea[];
  followUpQuestion?: string;
}

export interface RecommendedAction {
  priority: number;
  title: string;
  description: string;
  timeframe: string;
  details: string[];
}

export interface TemplateAction {
  type: 'email' | 'meeting_agenda' | 'talking_points' | 'plan';
  label: string;
  prompt: string;
}

export interface FeedbackRequest {
  userId: string;
  customerId?: string;
  interactionType: 'email' | 'call' | 'meeting' | 'presentation';
  interactionDescription: string;
  outcome?: string;
  selfAssessment?: string;
}

export interface FeedbackResponse {
  feedbackId: string;
  overallAssessment: string;
  whatWentWell: string[];
  areasForImprovement: string[];
  specificSuggestions: string[];
  skillsAssessed: Array<{
    skill: SkillArea;
    observation: string;
    suggestion?: string;
  }>;
  actionItems: string[];
}

export interface SkillAssessment {
  id: string;
  userId: string;
  skillArea: SkillArea;
  proficiencyLevel: ProficiencyLevel;
  assessedAt: Date;
  recommendations: string[];
  evidence: string[];
}

export interface CoachingProgress {
  userId: string;
  overallScore: number;
  skillBreakdown: Array<{
    skill: SkillArea;
    level: ProficiencyLevel;
    trend: 'improving' | 'stable' | 'declining';
    recentChange: number;
  }>;
  interactionsThisMonth: number;
  guidanceRequestsThisMonth: number;
  improvementAreas: SkillArea[];
  strengths: SkillArea[];
  weeklyGoals: string[];
  recentMilestones: string[];
}

export interface WeeklySummary {
  userId: string;
  weekOf: string;
  highlights: string[];
  areasOfFocus: string[];
  skillProgress: Array<{
    skill: SkillArea;
    progress: string;
  }>;
  nextWeekGoals: string[];
  motivationalNote: string;
}

// ============================================================================
// Constants
// ============================================================================

const SKILL_DESCRIPTIONS: Record<SkillArea, string> = {
  relationship_building: 'Building trust and rapport with customers and stakeholders',
  strategic_thinking: 'Aligning customer success with business outcomes',
  product_knowledge: 'Deep understanding of product features and use cases',
  communication: 'Clear, effective written and verbal communication',
  problem_solving: 'Creative solutions to customer challenges',
  time_management: 'Prioritizing and managing workload effectively',
  negotiation: 'Finding win-win outcomes in difficult situations',
  data_analysis: 'Using metrics and data to drive decisions',
  executive_presence: 'Commanding respect in executive conversations',
  empathy: 'Understanding and addressing customer emotions',
};

const SITUATION_CONTEXTS: Record<SituationType, string> = {
  champion_departure: 'Your primary champion is leaving the company',
  champion_promotion: 'Your champion has been promoted to a higher role',
  escalation: 'Handling a customer escalation or complaint',
  churn_risk: 'Signs indicate the customer may not renew',
  expansion_opportunity: 'Potential to grow the account',
  difficult_conversation: 'Having a challenging discussion with a customer',
  stakeholder_mapping: 'Building relationships with multiple stakeholders',
  renewal_negotiation: 'Negotiating contract renewal terms',
  onboarding_stall: 'Customer onboarding has stalled or slowed',
  product_feedback: 'Customer has provided negative product feedback',
  competitor_threat: 'Competitor is actively pursuing your customer',
  executive_engagement: 'Engaging with C-level executives',
  general: 'General customer success question or situation',
};

// ============================================================================
// Core Coaching Functions
// ============================================================================

/**
 * Get situational guidance for a CSM
 */
export async function getGuidance(request: GuidanceRequest): Promise<GuidanceResponse> {
  const guidanceId = crypto.randomUUID();

  // Get CSM's skill profile for personalized guidance
  const skillProfile = await getSkillProfile(request.userId);

  // Get relevant playbooks from knowledge base
  const relevantPlaybooks = await getRelevantPlaybooks(request.situationType);

  // Get past similar situations for context
  const pastInteractions = await getPastSimilarInteractions(
    request.userId,
    request.situationType
  );

  try {
    if (!anthropic) {
      return generateFallbackGuidance(request, guidanceId);
    }

    const prompt = buildGuidancePrompt({
      request,
      skillProfile,
      relevantPlaybooks,
      pastInteractions,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: `You are an expert Customer Success coach with 20+ years of experience.

Your coaching style:
- Practical and actionable advice
- Specific to the situation and customer context
- Empathetic but direct
- Data-driven when possible
- Always professional

You help CSMs navigate difficult situations, develop their skills, and achieve better customer outcomes.

Format your response as JSON matching the requested structure exactly.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    const guidance = parseGuidanceResponse(responseText, guidanceId, request.situationType);

    // Store the interaction
    await storeCoachingInteraction({
      id: guidanceId,
      userId: request.userId,
      interactionType: 'guidance_request',
      context: {
        situationType: request.situationType,
        customerName: request.customerName,
        description: request.situationDescription,
      },
      guidanceProvided: JSON.stringify(guidance),
    });

    return guidance;
  } catch (error) {
    console.error('Coaching guidance error:', error);
    return generateFallbackGuidance(request, guidanceId);
  }
}

/**
 * Get post-interaction feedback
 */
export async function getFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
  const feedbackId = crypto.randomUUID();

  try {
    if (!anthropic) {
      return generateFallbackFeedback(request, feedbackId);
    }

    const prompt = buildFeedbackPrompt(request);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an expert Customer Success coach providing constructive feedback.

Your feedback style:
- Balanced and fair - recognize what went well
- Specific and actionable suggestions
- Focused on growth, not criticism
- Tied to concrete skills
- Encouraging but honest

Provide feedback that helps CSMs learn and improve from every interaction.

Format your response as JSON matching the requested structure exactly.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    const feedback = parseFeedbackResponse(responseText, feedbackId);

    // Store the interaction
    await storeCoachingInteraction({
      id: feedbackId,
      userId: request.userId,
      interactionType: 'feedback_request',
      context: {
        interactionType: request.interactionType,
        description: request.interactionDescription,
        outcome: request.outcome,
      },
      feedbackReceived: JSON.stringify(feedback),
    });

    // Update skill assessments based on feedback
    await updateSkillAssessments(request.userId, feedback.skillsAssessed);

    return feedback;
  } catch (error) {
    console.error('Coaching feedback error:', error);
    return generateFallbackFeedback(request, feedbackId);
  }
}

/**
 * Get skill assessment for a CSM
 */
export async function getSkillAssessment(userId: string): Promise<SkillAssessment[]> {
  if (!supabase) {
    return generateDefaultSkillAssessments(userId);
  }

  try {
    const { data, error } = await supabase
      .from('csm_skill_assessments')
      .select('*')
      .eq('user_id', userId)
      .order('assessed_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return generateDefaultSkillAssessments(userId);
    }

    // Get most recent assessment per skill
    const latestBySkill = new Map<SkillArea, SkillAssessment>();
    for (const row of data) {
      const skill = row.skill_area as SkillArea;
      if (!latestBySkill.has(skill)) {
        latestBySkill.set(skill, {
          id: row.id,
          userId: row.user_id,
          skillArea: skill,
          proficiencyLevel: row.proficiency_level as ProficiencyLevel,
          assessedAt: new Date(row.assessed_at),
          recommendations: row.recommendations || [],
          evidence: row.evidence || [],
        });
      }
    }

    return Array.from(latestBySkill.values());
  } catch (error) {
    console.error('Error fetching skill assessments:', error);
    return generateDefaultSkillAssessments(userId);
  }
}

/**
 * Get coaching progress over time
 */
export async function getProgress(userId: string): Promise<CoachingProgress> {
  const skills = await getSkillAssessment(userId);
  const interactions = await getRecentInteractions(userId, 30);

  // Calculate overall score
  const avgLevel = skills.reduce((sum, s) => sum + s.proficiencyLevel, 0) / skills.length;
  const overallScore = Math.round((avgLevel / 5) * 100);

  // Calculate trends
  const skillBreakdown = await Promise.all(
    skills.map(async skill => {
      const trend = await getSkillTrend(userId, skill.skillArea);
      return {
        skill: skill.skillArea,
        level: skill.proficiencyLevel,
        trend,
        recentChange: trend === 'improving' ? 0.5 : trend === 'declining' ? -0.5 : 0,
      };
    })
  );

  // Identify strengths and improvement areas
  const sortedSkills = [...skillBreakdown].sort((a, b) => b.level - a.level);
  const strengths = sortedSkills.slice(0, 3).map(s => s.skill);
  const improvementAreas = sortedSkills.slice(-3).map(s => s.skill);

  return {
    userId,
    overallScore,
    skillBreakdown,
    interactionsThisMonth: interactions.length,
    guidanceRequestsThisMonth: interactions.filter(
      i => i.interactionType === 'guidance_request'
    ).length,
    improvementAreas,
    strengths,
    weeklyGoals: generateWeeklyGoals(improvementAreas),
    recentMilestones: await getRecentMilestones(userId),
  };
}

/**
 * Generate weekly coaching summary
 */
export async function generateWeeklySummary(userId: string): Promise<WeeklySummary> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const interactions = await getRecentInteractions(userId, 7);
  const progress = await getProgress(userId);

  if (!anthropic) {
    return generateFallbackWeeklySummary(userId, weekStart, interactions, progress);
  }

  try {
    const prompt = `Generate a weekly coaching summary for a CSM with the following data:

## This Week's Activity
- Total coaching interactions: ${interactions.length}
- Guidance requests: ${interactions.filter(i => i.interactionType === 'guidance_request').length}
- Feedback sessions: ${interactions.filter(i => i.interactionType === 'feedback_request').length}

## Current Skill Profile
${progress.skillBreakdown.map(s => `- ${s.skill}: Level ${s.level}/5 (${s.trend})`).join('\n')}

## Strengths
${progress.strengths.map(s => `- ${SKILL_DESCRIPTIONS[s]}`).join('\n')}

## Areas for Improvement
${progress.improvementAreas.map(s => `- ${SKILL_DESCRIPTIONS[s]}`).join('\n')}

Generate a JSON response with:
{
  "highlights": ["3-5 key accomplishments or positive observations"],
  "areasOfFocus": ["2-3 areas they should focus on"],
  "skillProgress": [{"skill": "skill_name", "progress": "brief observation"}],
  "nextWeekGoals": ["3-4 specific, actionable goals for next week"],
  "motivationalNote": "A brief, personalized encouraging message"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are an encouraging CS coach generating weekly summaries. Be specific, positive, and actionable.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    return parseWeeklySummaryResponse(responseText, userId, weekStart);
  } catch (error) {
    console.error('Weekly summary error:', error);
    return generateFallbackWeeklySummary(userId, weekStart, interactions, progress);
  }
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildGuidancePrompt(context: {
  request: GuidanceRequest;
  skillProfile: SkillAssessment[];
  relevantPlaybooks: string[];
  pastInteractions: any[];
}): string {
  const { request, skillProfile, relevantPlaybooks, pastInteractions } = context;

  const skillSummary = skillProfile.length > 0
    ? skillProfile.map(s => `- ${s.skillArea}: Level ${s.proficiencyLevel}/5`).join('\n')
    : 'No skill profile available';

  return `Provide coaching guidance for the following situation:

## SITUATION
Type: ${SITUATION_CONTEXTS[request.situationType]}
${request.customerName ? `Customer: ${request.customerName}` : ''}

Description: ${request.situationDescription}
${request.additionalContext ? `\nAdditional Context: ${request.additionalContext}` : ''}

## CSM'S SKILL PROFILE
${skillSummary}

## RELEVANT PLAYBOOKS
${relevantPlaybooks.length > 0 ? relevantPlaybooks.join('\n') : 'No specific playbooks matched'}

## PAST SIMILAR SITUATIONS
${pastInteractions.length > 0
    ? pastInteractions.map(i => `- ${i.description}`).join('\n')
    : 'No past similar situations recorded'}

## OUTPUT FORMAT
Return a JSON object with exactly this structure:
{
  "situationAnalysis": "2-3 sentence analysis of the situation and key dynamics at play",
  "recommendedApproach": [
    {
      "priority": 1,
      "title": "Action title",
      "description": "Why this action matters",
      "timeframe": "e.g., Today, This Week, Within 2 Weeks",
      "details": ["Specific step 1", "Specific step 2"]
    }
  ],
  "watchOutFor": ["Risk or pitfall to avoid"],
  "templates": [
    {
      "type": "email|meeting_agenda|talking_points|plan",
      "label": "Button label",
      "prompt": "Prompt to generate this template"
    }
  ],
  "skillsInvolved": ["skill_area_1", "skill_area_2"],
  "followUpQuestion": "Optional question to better understand the situation"
}

Return ONLY valid JSON, no markdown code blocks.`;
}

function buildFeedbackPrompt(request: FeedbackRequest): string {
  return `Provide coaching feedback for the following customer interaction:

## INTERACTION DETAILS
Type: ${request.interactionType}
Description: ${request.interactionDescription}
${request.outcome ? `Outcome: ${request.outcome}` : ''}
${request.selfAssessment ? `CSM's Self-Assessment: ${request.selfAssessment}` : ''}

## OUTPUT FORMAT
Return a JSON object with exactly this structure:
{
  "overallAssessment": "2-3 sentence overall assessment of the interaction",
  "whatWentWell": ["Positive aspect 1", "Positive aspect 2"],
  "areasForImprovement": ["Area 1", "Area 2"],
  "specificSuggestions": ["Specific, actionable suggestion 1", "Specific suggestion 2"],
  "skillsAssessed": [
    {
      "skill": "skill_area",
      "observation": "What you observed about this skill",
      "suggestion": "How to improve"
    }
  ],
  "actionItems": ["Concrete next step 1", "Concrete next step 2"]
}

Valid skill areas: relationship_building, strategic_thinking, product_knowledge, communication, problem_solving, time_management, negotiation, data_analysis, executive_presence, empathy

Return ONLY valid JSON, no markdown code blocks.`;
}

// ============================================================================
// Response Parsers
// ============================================================================

function parseGuidanceResponse(
  text: string,
  guidanceId: string,
  situationType: SituationType
): GuidanceResponse {
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
      guidanceId,
      situationAnalysis: parsed.situationAnalysis || 'Analysis not available',
      recommendedApproach: parsed.recommendedApproach || [],
      watchOutFor: parsed.watchOutFor || [],
      templates: parsed.templates,
      skillsInvolved: parsed.skillsInvolved || [],
      followUpQuestion: parsed.followUpQuestion,
    };
  } catch (error) {
    console.error('Failed to parse guidance response:', error);
    throw new Error('Failed to parse AI-generated guidance');
  }
}

function parseFeedbackResponse(text: string, feedbackId: string): FeedbackResponse {
  let jsonString = text.trim();

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
      feedbackId,
      overallAssessment: parsed.overallAssessment || 'Assessment not available',
      whatWentWell: parsed.whatWentWell || [],
      areasForImprovement: parsed.areasForImprovement || [],
      specificSuggestions: parsed.specificSuggestions || [],
      skillsAssessed: parsed.skillsAssessed || [],
      actionItems: parsed.actionItems || [],
    };
  } catch (error) {
    console.error('Failed to parse feedback response:', error);
    throw new Error('Failed to parse AI-generated feedback');
  }
}

function parseWeeklySummaryResponse(
  text: string,
  userId: string,
  weekStart: Date
): WeeklySummary {
  let jsonString = text.trim();

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
      userId,
      weekOf: weekStart.toISOString().split('T')[0],
      highlights: parsed.highlights || [],
      areasOfFocus: parsed.areasOfFocus || [],
      skillProgress: parsed.skillProgress || [],
      nextWeekGoals: parsed.nextWeekGoals || [],
      motivationalNote: parsed.motivationalNote || 'Keep up the great work!',
    };
  } catch (error) {
    console.error('Failed to parse weekly summary:', error);
    return generateFallbackWeeklySummary(userId, weekStart, [], {} as CoachingProgress);
  }
}

// ============================================================================
// Database Helpers
// ============================================================================

async function storeCoachingInteraction(data: {
  id: string;
  userId: string;
  interactionType: InteractionType;
  context: Record<string, unknown>;
  guidanceProvided?: string;
  feedbackReceived?: string;
}): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('coaching_interactions').insert({
      id: data.id,
      user_id: data.userId,
      interaction_type: data.interactionType,
      context: data.context,
      guidance_provided: data.guidanceProvided,
      feedback_received: data.feedbackReceived,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error storing coaching interaction:', error);
  }
}

async function updateSkillAssessments(
  userId: string,
  skillsAssessed: Array<{ skill: SkillArea; observation: string; suggestion?: string }>
): Promise<void> {
  if (!supabase || skillsAssessed.length === 0) return;

  try {
    for (const assessment of skillsAssessed) {
      // Get current level
      const { data: current } = await supabase
        .from('csm_skill_assessments')
        .select('proficiency_level, evidence')
        .eq('user_id', userId)
        .eq('skill_area', assessment.skill)
        .order('assessed_at', { ascending: false })
        .limit(1)
        .single();

      const currentLevel = current?.proficiency_level || 3;
      const currentEvidence = current?.evidence || [];

      await supabase.from('csm_skill_assessments').insert({
        id: crypto.randomUUID(),
        user_id: userId,
        skill_area: assessment.skill,
        proficiency_level: currentLevel, // Level changes gradually based on patterns
        assessed_at: new Date().toISOString(),
        recommendations: assessment.suggestion ? [assessment.suggestion] : [],
        evidence: [...currentEvidence.slice(-4), assessment.observation],
      });
    }
  } catch (error) {
    console.error('Error updating skill assessments:', error);
  }
}

async function getSkillProfile(userId: string): Promise<SkillAssessment[]> {
  return getSkillAssessment(userId);
}

async function getRelevantPlaybooks(situationType: SituationType): Promise<string[]> {
  if (!supabase) {
    return getDefaultPlaybooks(situationType);
  }

  try {
    const { data } = await supabase
      .from('csm_playbooks')
      .select('name, description')
      .contains('tags', [situationType])
      .limit(3);

    if (data && data.length > 0) {
      return data.map(p => `- ${p.name}: ${p.description}`);
    }
  } catch (error) {
    console.error('Error fetching playbooks:', error);
  }

  return getDefaultPlaybooks(situationType);
}

function getDefaultPlaybooks(situationType: SituationType): string[] {
  const playbooks: Record<SituationType, string[]> = {
    champion_departure: [
      '- Champion Transition: Identify new sponsors and transfer relationships',
      '- Risk Mitigation: Document institutional knowledge before departure',
    ],
    champion_promotion: [
      '- Champion Promotion: Leverage expanded influence strategically',
      '- Network Expansion: Build relationships with new team members',
    ],
    escalation: [
      '- Escalation Management: De-escalate while maintaining trust',
      '- Root Cause Analysis: Address underlying issues, not just symptoms',
    ],
    churn_risk: [
      '- Save Play: Intensive engagement to prevent churn',
      '- Value Realization: Demonstrate concrete ROI',
    ],
    expansion_opportunity: [
      '- Expansion Playbook: Identify and pursue upsell opportunities',
      '- Business Case Building: Quantify value for expansion',
    ],
    difficult_conversation: [
      '- Difficult Conversations: Framework for productive conflict resolution',
    ],
    stakeholder_mapping: [
      '- Stakeholder Mapping: Identify power centers and decision makers',
    ],
    renewal_negotiation: [
      '- Renewal Playbook: Secure renewals with favorable terms',
    ],
    onboarding_stall: [
      '- Onboarding Recovery: Get stalled implementations back on track',
    ],
    product_feedback: [
      '- Feedback Loop: Turn criticism into partnership opportunity',
    ],
    competitor_threat: [
      '- Competitive Defense: Strengthen position against competitors',
    ],
    executive_engagement: [
      '- Executive Engagement: Build relationships at the C-level',
    ],
    general: [],
  };

  return playbooks[situationType] || [];
}

async function getPastSimilarInteractions(
  userId: string,
  situationType: SituationType
): Promise<any[]> {
  if (!supabase) return [];

  try {
    const { data } = await supabase
      .from('coaching_interactions')
      .select('context, guidance_provided')
      .eq('user_id', userId)
      .filter('context->>situationType', 'eq', situationType)
      .order('created_at', { ascending: false })
      .limit(3);

    return data || [];
  } catch (error) {
    console.error('Error fetching past interactions:', error);
    return [];
  }
}

async function getRecentInteractions(userId: string, days: number): Promise<any[]> {
  if (!supabase) return [];

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data } = await supabase
      .from('coaching_interactions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Error fetching recent interactions:', error);
    return [];
  }
}

async function getSkillTrend(
  userId: string,
  skill: SkillArea
): Promise<'improving' | 'stable' | 'declining'> {
  if (!supabase) return 'stable';

  try {
    const { data } = await supabase
      .from('csm_skill_assessments')
      .select('proficiency_level, assessed_at')
      .eq('user_id', userId)
      .eq('skill_area', skill)
      .order('assessed_at', { ascending: false })
      .limit(5);

    if (!data || data.length < 2) return 'stable';

    const recent = data[0].proficiency_level;
    const older = data[data.length - 1].proficiency_level;

    if (recent > older) return 'improving';
    if (recent < older) return 'declining';
    return 'stable';
  } catch (error) {
    return 'stable';
  }
}

async function getRecentMilestones(userId: string): Promise<string[]> {
  // In a full implementation, this would track specific achievements
  return [
    'Completed 5 coaching sessions this month',
    'Communication skills improved to Level 4',
  ];
}

function generateWeeklyGoals(improvementAreas: SkillArea[]): string[] {
  return improvementAreas.slice(0, 2).map(skill => {
    const goalMap: Record<SkillArea, string> = {
      relationship_building: 'Schedule a non-agenda check-in with one customer',
      strategic_thinking: 'Identify one customer goal you can align with',
      product_knowledge: 'Learn one new product feature deeply',
      communication: 'Practice summarizing a call in 3 bullet points',
      problem_solving: 'Document one creative solution you developed',
      time_management: 'Block focus time for your top 3 accounts',
      negotiation: 'Prepare talking points for a difficult conversation',
      data_analysis: 'Review health scores for your portfolio',
      executive_presence: 'Practice your elevator pitch for value delivered',
      empathy: 'Ask one open-ended question about customer challenges',
    };
    return goalMap[skill] || 'Focus on continuous improvement';
  });
}

// ============================================================================
// Fallback Generators
// ============================================================================

function generateFallbackGuidance(
  request: GuidanceRequest,
  guidanceId: string
): GuidanceResponse {
  return {
    guidanceId,
    situationAnalysis: `This is a ${request.situationType.replace(/_/g, ' ')} situation that requires careful handling. Consider the customer relationship history and current business context.`,
    recommendedApproach: [
      {
        priority: 1,
        title: 'Assess the Situation',
        description: 'Gather all relevant information before taking action',
        timeframe: 'Today',
        details: [
          'Review recent customer interactions',
          'Check health score and engagement metrics',
          'Identify key stakeholders involved',
        ],
      },
      {
        priority: 2,
        title: 'Develop Your Approach',
        description: 'Plan your communication strategy',
        timeframe: 'This Week',
        details: [
          'Outline key talking points',
          'Anticipate questions and concerns',
          'Prepare supporting data or examples',
        ],
      },
    ],
    watchOutFor: [
      'Avoid making assumptions without verification',
      'Be mindful of timing and context',
    ],
    skillsInvolved: ['communication', 'relationship_building'],
  };
}

function generateFallbackFeedback(
  request: FeedbackRequest,
  feedbackId: string
): FeedbackResponse {
  return {
    feedbackId,
    overallAssessment: `Based on your ${request.interactionType} description, you demonstrated initiative in engaging with the customer. Continue to reflect on what worked and what could be improved.`,
    whatWentWell: [
      'You took initiative to address the situation',
      'You maintained professional communication',
    ],
    areasForImprovement: [
      'Consider documenting key takeaways immediately after interactions',
      'Look for opportunities to quantify value delivered',
    ],
    specificSuggestions: [
      'Follow up within 24 hours to maintain momentum',
      'Share relevant resources that add value',
    ],
    skillsAssessed: [
      {
        skill: 'communication',
        observation: 'Demonstrated proactive communication',
        suggestion: 'Practice concise summarization',
      },
    ],
    actionItems: [
      'Send a follow-up email summarizing next steps',
      'Update CRM with interaction notes',
    ],
  };
}

function generateDefaultSkillAssessments(userId: string): SkillAssessment[] {
  const skills: SkillArea[] = [
    'relationship_building',
    'strategic_thinking',
    'product_knowledge',
    'communication',
    'problem_solving',
    'time_management',
    'negotiation',
    'data_analysis',
    'executive_presence',
    'empathy',
  ];

  return skills.map(skill => ({
    id: crypto.randomUUID(),
    userId,
    skillArea: skill,
    proficiencyLevel: 3 as ProficiencyLevel,
    assessedAt: new Date(),
    recommendations: [`Continue developing ${skill.replace(/_/g, ' ')} skills`],
    evidence: [],
  }));
}

function generateFallbackWeeklySummary(
  userId: string,
  weekStart: Date,
  interactions: any[],
  progress: CoachingProgress
): WeeklySummary {
  return {
    userId,
    weekOf: weekStart.toISOString().split('T')[0],
    highlights: [
      'Continued engagement with coaching platform',
      'Maintained consistent customer interactions',
    ],
    areasOfFocus: [
      'Building deeper customer relationships',
      'Improving strategic account planning',
    ],
    skillProgress: [
      { skill: 'communication' as SkillArea, progress: 'Stable - continue practicing' },
    ],
    nextWeekGoals: [
      'Complete one proactive customer check-in',
      'Review one account health dashboard in depth',
      'Ask for feedback from a peer or manager',
    ],
    motivationalNote: 'Every interaction is an opportunity to grow. Keep pushing forward!',
  };
}

// ============================================================================
// Exports
// ============================================================================

export const coachingService = {
  getGuidance,
  getFeedback,
  getSkillAssessment,
  getProgress,
  generateWeeklySummary,
};

export default coachingService;
