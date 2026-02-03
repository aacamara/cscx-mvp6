/**
 * PRD-236: Issue Classification AI
 *
 * AI-powered classification service that analyzes escalation content
 * to determine category, severity, and required expertise.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import type { EscalationCategory, EscalationSeverity } from '../../../types/escalation.js';

// ============================================
// Types
// ============================================

export interface ClassificationInput {
  title: string;
  description: string;
  customerId: string;
  customerName?: string;
  customerTier?: string;
  customerARR?: number;
  healthScore?: number;
  recentTickets?: Array<{
    subject: string;
    priority: string;
    category?: string;
  }>;
}

export interface ClassificationResult {
  category: EscalationCategory;
  severity: EscalationSeverity;
  confidence: number;
  requiredExpertise: string[];
  urgencyIndicators: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  keyIssues: string[];
  suggestedTitle?: string;
  reasoning: string;
}

export interface ExpertiseMatch {
  userId: string;
  userName: string;
  expertiseArea: string;
  proficiencyLevel: number;
  matchScore: number;
}

// ============================================
// Classification Service
// ============================================

export class IssueClassifier {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  /**
   * Classify an escalation issue using AI
   */
  async classifyIssue(input: ClassificationInput): Promise<ClassificationResult> {
    // If no AI available, use rule-based classification
    if (!this.anthropic) {
      return this.ruleBasedClassification(input);
    }

    try {
      const systemPrompt = `You are an expert Customer Success escalation classifier. Analyze the escalation and classify it appropriately.

Your task is to:
1. Determine the category (technical, support, product, commercial, relationship)
2. Assess severity (P1 = critical/outage, P2 = major issue, P3 = moderate issue)
3. Identify required expertise areas
4. Detect urgency indicators
5. Estimate complexity

Consider these factors:
- Customer tier and ARR for severity assessment
- Keywords indicating technical issues, billing problems, relationship concerns
- Historical ticket patterns
- Health score impact

Respond in JSON format only.`;

      const userPrompt = `Classify this escalation:

Title: ${input.title}
Description: ${input.description}
Customer: ${input.customerName || 'Unknown'} (${input.customerTier || 'Unknown tier'})
ARR: $${(input.customerARR || 0).toLocaleString()}
Health Score: ${input.healthScore || 'Unknown'}

${input.recentTickets && input.recentTickets.length > 0 ? `
Recent Tickets:
${input.recentTickets.map(t => `- ${t.subject} (${t.priority})`).join('\n')}
` : ''}

Respond with JSON:
{
  "category": "technical|support|product|commercial|relationship",
  "severity": "P1|P2|P3",
  "confidence": 0.0-1.0,
  "requiredExpertise": ["area1", "area2"],
  "urgencyIndicators": ["indicator1"],
  "estimatedComplexity": "low|medium|high",
  "keyIssues": ["issue1", "issue2"],
  "suggestedTitle": "Optional better title",
  "reasoning": "Brief explanation of classification"
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        system: systemPrompt,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]) as ClassificationResult;

      // Validate and sanitize result
      return this.validateClassification(result);
    } catch (error) {
      console.error('[Classifier] AI classification failed, falling back to rules:', error);
      return this.ruleBasedClassification(input);
    }
  }

  /**
   * Rule-based classification fallback
   */
  private ruleBasedClassification(input: ClassificationInput): ClassificationResult {
    const text = `${input.title} ${input.description}`.toLowerCase();

    // Determine category
    let category: EscalationCategory = 'support';
    const categoryScores = {
      technical: 0,
      support: 0,
      product: 0,
      commercial: 0,
      relationship: 0,
    };

    // Technical indicators
    if (/api|integration|bug|error|crash|outage|down|performance|latency/.test(text)) {
      categoryScores.technical += 3;
    }
    if (/code|developer|engineering|deploy|release/.test(text)) {
      categoryScores.technical += 2;
    }

    // Support indicators
    if (/help|issue|problem|not working|broken|stuck/.test(text)) {
      categoryScores.support += 2;
    }
    if (/ticket|support|assistance/.test(text)) {
      categoryScores.support += 1;
    }

    // Product indicators
    if (/feature|roadmap|capability|enhancement|improvement/.test(text)) {
      categoryScores.product += 3;
    }
    if (/missing|need|want|wish|would like/.test(text)) {
      categoryScores.product += 1;
    }

    // Commercial indicators
    if (/price|pricing|contract|renewal|discount|billing|invoice|payment/.test(text)) {
      categoryScores.commercial += 3;
    }
    if (/cost|budget|expense|negotiate/.test(text)) {
      categoryScores.commercial += 2;
    }

    // Relationship indicators
    if (/executive|leadership|trust|relationship|partner|strategic/.test(text)) {
      categoryScores.relationship += 3;
    }
    if (/disappointed|frustrated|concerned|unhappy/.test(text)) {
      categoryScores.relationship += 2;
    }

    // Select highest scoring category
    let maxScore = 0;
    for (const [cat, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxScore = score;
        category = cat as EscalationCategory;
      }
    }

    // Determine severity
    let severity: EscalationSeverity = 'P3';
    const urgencyIndicators: string[] = [];

    // P1 indicators
    if (/critical|emergency|urgent|outage|down|production|immediately|asap/.test(text)) {
      severity = 'P1';
      urgencyIndicators.push('Critical keywords detected');
    }

    // Consider customer tier
    if (input.customerTier === 'enterprise' || (input.customerARR && input.customerARR >= 100000)) {
      if (severity === 'P3') severity = 'P2';
      urgencyIndicators.push('Enterprise customer');
    }

    // Consider health score
    if (input.healthScore && input.healthScore < 50) {
      if (severity === 'P3') severity = 'P2';
      urgencyIndicators.push('Low health score');
    }

    // P2 indicators
    if (severity === 'P3' && /blocked|major|significant|affecting|multiple users/.test(text)) {
      severity = 'P2';
      urgencyIndicators.push('Major impact indicated');
    }

    // Determine required expertise
    const requiredExpertise: string[] = [];
    if (categoryScores.technical > 0) requiredExpertise.push('technical', 'engineering');
    if (categoryScores.product > 0) requiredExpertise.push('product');
    if (categoryScores.commercial > 0) requiredExpertise.push('account-management', 'finance');
    if (categoryScores.relationship > 0) requiredExpertise.push('executive', 'customer-success');
    if (requiredExpertise.length === 0) requiredExpertise.push('support');

    // Estimate complexity
    let estimatedComplexity: 'low' | 'medium' | 'high' = 'medium';
    if (severity === 'P1' || requiredExpertise.length > 2) {
      estimatedComplexity = 'high';
    } else if (severity === 'P3' && requiredExpertise.length === 1) {
      estimatedComplexity = 'low';
    }

    return {
      category,
      severity,
      confidence: 0.7, // Rule-based is less confident
      requiredExpertise: [...new Set(requiredExpertise)],
      urgencyIndicators,
      estimatedComplexity,
      keyIssues: this.extractKeyIssues(text),
      reasoning: 'Rule-based classification based on keyword analysis',
    };
  }

  /**
   * Extract key issues from text
   */
  private extractKeyIssues(text: string): string[] {
    const issues: string[] = [];

    if (/api|integration/.test(text)) issues.push('API/Integration issue');
    if (/performance|slow|latency/.test(text)) issues.push('Performance concerns');
    if (/outage|down|unavailable/.test(text)) issues.push('Service availability');
    if (/billing|invoice|payment/.test(text)) issues.push('Billing issue');
    if (/feature|capability/.test(text)) issues.push('Feature request');
    if (/bug|error|crash/.test(text)) issues.push('Bug/Error');
    if (/training|help|how to/.test(text)) issues.push('Training/Support needed');

    return issues.slice(0, 5); // Max 5 key issues
  }

  /**
   * Validate and sanitize classification result
   */
  private validateClassification(result: ClassificationResult): ClassificationResult {
    const validCategories: EscalationCategory[] = ['technical', 'support', 'product', 'commercial', 'relationship'];
    const validSeverities: EscalationSeverity[] = ['P1', 'P2', 'P3'];

    return {
      category: validCategories.includes(result.category) ? result.category : 'support',
      severity: validSeverities.includes(result.severity) ? result.severity : 'P2',
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      requiredExpertise: Array.isArray(result.requiredExpertise) ? result.requiredExpertise : ['support'],
      urgencyIndicators: Array.isArray(result.urgencyIndicators) ? result.urgencyIndicators : [],
      estimatedComplexity: ['low', 'medium', 'high'].includes(result.estimatedComplexity)
        ? result.estimatedComplexity
        : 'medium',
      keyIssues: Array.isArray(result.keyIssues) ? result.keyIssues : [],
      suggestedTitle: result.suggestedTitle,
      reasoning: result.reasoning || 'AI classification',
    };
  }
}

// Singleton instance
export const issueClassifier = new IssueClassifier();
