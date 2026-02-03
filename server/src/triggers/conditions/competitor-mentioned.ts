/**
 * Competitor Mentioned Trigger Condition
 * PRD-094: Competitor Mentioned - Battle Card
 *
 * Fires when a competitor is mentioned in customer communications
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { competitorDetector } from '../../services/competitor/index.js';

export const competitorMentionedProcessor: ConditionProcessor = {
  type: 'competitor_mentioned' as any,

  async evaluate(condition: TriggerCondition, event: CustomerEvent): Promise<boolean> {
    // Only process relevant event types
    const validEventTypes = [
      'meeting_transcript',
      'email_received',
      'email_sent',
      'support_ticket_created',
      'support_ticket_updated',
      'chat_message',
      'document_uploaded',
    ];

    if (!validEventTypes.includes(event.type as any)) {
      return false;
    }

    // Get text content from event
    const text = extractText(event);
    if (!text || text.length < 10) {
      return false;
    }

    // Detect competitors in text
    const detections = competitorDetector.detect(text);

    if (detections.length === 0) {
      return false;
    }

    // Apply filters from condition params
    const { competitors, sentiment, intentSignal, minConfidence } = condition.params;

    for (const detection of detections) {
      // Filter by specific competitors if specified
      if (competitors && Array.isArray(competitors) && competitors.length > 0) {
        if (!competitors.includes(detection.competitor.id)) {
          continue;
        }
      }

      // Filter by sentiment if specified
      if (sentiment && detection.sentiment !== sentiment) {
        continue;
      }

      // Filter by intent signal if specified
      if (intentSignal && detection.intentSignal !== intentSignal) {
        continue;
      }

      // Filter by minimum confidence if specified
      if (minConfidence && detection.confidence < minConfidence) {
        continue;
      }

      // Found a matching detection
      // Enrich event data with detection details
      event.data.competitorDetection = {
        competitorId: detection.competitor.id,
        competitorName: detection.competitor.name,
        context: detection.context,
        sentiment: detection.sentiment,
        intentSignal: detection.intentSignal,
        featuresMentioned: detection.featuresMentioned,
        confidence: detection.confidence,
      };

      return true;
    }

    return false;
  },

  getDescription(condition: TriggerCondition): string {
    const parts = ['Competitor mentioned'];

    if (condition.params.competitors?.length > 0) {
      parts.push(`(${condition.params.competitors.join(', ')})`);
    }

    if (condition.params.sentiment) {
      parts.push(`with ${condition.params.sentiment} sentiment`);
    }

    if (condition.params.intentSignal) {
      parts.push(`indicating ${condition.params.intentSignal}`);
    }

    return parts.join(' ');
  },

  validate(condition: TriggerCondition): { valid: boolean; error?: string } {
    const { competitors, sentiment, intentSignal, minConfidence } = condition.params;

    // Validate competitors array
    if (competitors !== undefined) {
      if (!Array.isArray(competitors)) {
        return { valid: false, error: 'competitors must be an array' };
      }
    }

    // Validate sentiment
    const validSentiments = ['positive', 'negative', 'neutral', 'comparison'];
    if (sentiment && !validSentiments.includes(sentiment)) {
      return { valid: false, error: `sentiment must be one of: ${validSentiments.join(', ')}` };
    }

    // Validate intent signal
    const validIntents = ['evaluation', 'comparison', 'frustration', 'praise', 'question', 'unknown'];
    if (intentSignal && !validIntents.includes(intentSignal)) {
      return { valid: false, error: `intentSignal must be one of: ${validIntents.join(', ')}` };
    }

    // Validate confidence
    if (minConfidence !== undefined) {
      if (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 1) {
        return { valid: false, error: 'minConfidence must be a number between 0 and 1' };
      }
    }

    return { valid: true };
  },
};

/**
 * Extract text content from different event types
 */
function extractText(event: CustomerEvent): string {
  const data = event.data;

  // Meeting transcript
  if (data.transcript) return data.transcript;

  // Email content
  if (data.body) return data.body;
  if (data.content) return data.content;

  // Support ticket
  if (data.description) return data.description;

  // Chat/message
  if (data.message) return data.message;
  if (data.text) return data.text;

  // Document
  if (data.extractedText) return data.extractedText;

  // Fallback: concatenate any string values
  const textParts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 20) {
      textParts.push(value);
    }
  }

  return textParts.join(' ');
}
