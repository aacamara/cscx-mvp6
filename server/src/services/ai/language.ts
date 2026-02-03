/**
 * Multi-Language Support Service
 * PRD-224: Language detection, translation, and multilingual content generation
 *
 * Uses Claude's built-in multilingual capabilities for:
 * - Language detection with confidence scoring
 * - Context-aware translation for Customer Success communications
 * - Content generation in target languages
 * - Translation caching for performance optimization
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import type {
  SupportedLanguage,
  LanguageDetection,
  TranslationRequest,
  TranslationResult,
  TranslationContext,
  BatchTranslationRequest,
  BatchTranslationResult,
  MultilingualContentRequest,
  MultilingualContentResult,
  StakeholderLanguagePreferences,
  TranslationCacheEntry,
  SUPPORTED_LANGUAGES,
} from '../../../../types/language.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory cache for translations when DB not available
const memoryCache = new Map<string, TranslationCacheEntry>();
const MEMORY_CACHE_MAX_SIZE = 1000;

// ============================================
// Language Names for Prompts
// ============================================

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  it: 'Italian',
  nl: 'Dutch',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a hash for caching translations
 */
function generateContentHash(text: string, sourceLanguage: string, targetLanguage: string): string {
  const content = `${text}:${sourceLanguage}:${targetLanguage}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if a string is a valid language code
 */
function isValidLanguage(code: string): code is SupportedLanguage {
  return code in LANGUAGE_NAMES;
}

/**
 * Get language name from code
 */
function getLanguageName(code: SupportedLanguage): string {
  return LANGUAGE_NAMES[code] || code;
}

// ============================================
// Translation Cache Operations
// ============================================

/**
 * Get cached translation from database or memory
 */
async function getCachedTranslation(
  contentHash: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslationCacheEntry | null> {
  // Try database first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('translation_cache')
        .select('*')
        .eq('content_hash', contentHash)
        .eq('source_language', sourceLanguage)
        .eq('target_language', targetLanguage)
        .single();

      if (data && !error) {
        // Update access tracking
        await supabase
          .from('translation_cache')
          .update({
            accessed_at: new Date().toISOString(),
            access_count: (data.access_count || 0) + 1,
          })
          .eq('id', data.id);

        return {
          id: data.id,
          contentHash: data.content_hash,
          sourceLanguage: data.source_language,
          targetLanguage: data.target_language,
          originalText: data.original_text,
          translatedText: data.translated_text,
          confidence: data.confidence,
          createdAt: new Date(data.created_at),
          accessedAt: new Date(data.accessed_at),
          accessCount: data.access_count,
        };
      }
    } catch (error) {
      console.error('Error fetching cached translation:', error);
    }
  }

  // Fall back to memory cache
  const cacheKey = `${contentHash}:${sourceLanguage}:${targetLanguage}`;
  return memoryCache.get(cacheKey) || null;
}

/**
 * Save translation to cache
 */
async function cacheTranslation(
  contentHash: string,
  originalText: string,
  translatedText: string,
  sourceLanguage: string,
  targetLanguage: string,
  confidence: number
): Promise<void> {
  const now = new Date();
  const entry: TranslationCacheEntry = {
    id: crypto.randomUUID(),
    contentHash,
    sourceLanguage: sourceLanguage as SupportedLanguage,
    targetLanguage: targetLanguage as SupportedLanguage,
    originalText,
    translatedText,
    confidence,
    createdAt: now,
    accessedAt: now,
    accessCount: 1,
  };

  // Save to database
  if (supabase) {
    try {
      await supabase.from('translation_cache').upsert({
        id: entry.id,
        content_hash: contentHash,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        original_text: originalText,
        translated_text: translatedText,
        confidence,
        created_at: now.toISOString(),
        accessed_at: now.toISOString(),
        access_count: 1,
      }, {
        onConflict: 'content_hash,source_language,target_language',
      });
    } catch (error) {
      console.error('Error caching translation:', error);
    }
  }

  // Also save to memory cache
  const cacheKey = `${contentHash}:${sourceLanguage}:${targetLanguage}`;

  // Evict old entries if cache is full
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }

  memoryCache.set(cacheKey, entry);
}

// ============================================
// Core Language Service Functions
// ============================================

/**
 * Detect the language of a text sample
 */
export async function detectLanguage(text: string): Promise<LanguageDetection> {
  const startTime = Date.now();
  const textSample = text.slice(0, 500);

  try {
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: `You are a language detection expert. Analyze the provided text and determine its language.

Return a JSON object with:
- "detectedLanguage": ISO 639-1 code (e.g., "en", "es", "fr", "de", "pt", "ja", "zh", "it", "nl", "ko", "ar", "hi")
- "confidence": number between 0 and 1
- "alternativeLanguages": array of objects with "language" and "confidence" for other possible languages

Return ONLY valid JSON, no markdown or explanations.`,
      messages: [{
        role: 'user',
        content: `Detect the language of this text:\n\n${textSample}`,
      }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse response
    let jsonString = responseText.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```$/g, '');
    }

    const parsed = JSON.parse(jsonString);

    // Validate and normalize response
    const detectedLanguage = isValidLanguage(parsed.detectedLanguage)
      ? parsed.detectedLanguage
      : 'en';

    const result: LanguageDetection = {
      detectedLanguage,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      alternativeLanguages: (parsed.alternativeLanguages || [])
        .filter((alt: any) => isValidLanguage(alt.language))
        .slice(0, 3),
      textSample,
    };

    // Store detection result if we have a database
    if (supabase) {
      try {
        await supabase.from('language_detections').insert({
          id: crypto.randomUUID(),
          content_type: 'text',
          content_id: generateContentHash(text, '', ''),
          detected_language: result.detectedLanguage,
          confidence: result.confidence,
          detected_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error storing language detection:', error);
      }
    }

    return result;
  } catch (error) {
    console.error('Language detection error:', error);

    // Return default English with low confidence on error
    return {
      detectedLanguage: 'en',
      confidence: 0.1,
      alternativeLanguages: [],
      textSample,
    };
  }
}

/**
 * Translate text from one language to another
 */
export async function translateText(request: TranslationRequest): Promise<TranslationResult> {
  const startTime = Date.now();
  const {
    text,
    sourceLanguage,
    targetLanguage,
    preserveFormatting = true,
    context = 'business_communication',
  } = request;

  // Detect source language if not provided
  let actualSourceLanguage = sourceLanguage;
  if (!actualSourceLanguage) {
    const detection = await detectLanguage(text);
    actualSourceLanguage = detection.detectedLanguage;
  }

  // Skip translation if same language
  if (actualSourceLanguage === targetLanguage) {
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: actualSourceLanguage,
      targetLanguage,
      confidence: 1.0,
      cached: false,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Check cache
  const contentHash = generateContentHash(text, actualSourceLanguage, targetLanguage);
  const cached = await getCachedTranslation(contentHash, actualSourceLanguage, targetLanguage);

  if (cached) {
    return {
      originalText: text,
      translatedText: cached.translatedText,
      sourceLanguage: actualSourceLanguage,
      targetLanguage,
      confidence: cached.confidence,
      cached: true,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Perform translation with Claude
  try {
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

    const contextDescriptions: Record<TranslationContext, string> = {
      customer_email: 'a customer email in a B2B SaaS context',
      meeting_transcript: 'a business meeting transcript',
      document: 'a business document',
      chat: 'a chat conversation',
      report: 'a business report',
      business_communication: 'a business communication in a Customer Success context',
    };

    const prompt = `Translate the following text from ${getLanguageName(actualSourceLanguage)} to ${getLanguageName(targetLanguage)}.

Context: This is ${contextDescriptions[context]}.

Requirements:
- Maintain professional tone appropriate for business communications
- Preserve any technical terms, product names, and company references
${preserveFormatting ? '- Keep formatting (bullet points, paragraphs, line breaks)' : ''}
- Preserve names and proper nouns without translation
- Ensure the translation sounds natural to a native speaker

Text to translate:
${text}

Provide the translation only, no explanations or additional text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: Math.max(2000, text.length * 2),
      system: 'You are an expert translator specializing in business and Customer Success communications. Provide accurate, natural-sounding translations.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const translatedText = textBlock?.type === 'text' ? textBlock.text.trim() : '';

    // Calculate confidence based on response length ratio
    const lengthRatio = translatedText.length / text.length;
    const confidence = lengthRatio > 0.3 && lengthRatio < 3 ? 0.95 : 0.75;

    // Cache the translation
    await cacheTranslation(
      contentHash,
      text,
      translatedText,
      actualSourceLanguage,
      targetLanguage,
      confidence
    );

    return {
      originalText: text,
      translatedText,
      sourceLanguage: actualSourceLanguage,
      targetLanguage,
      confidence,
      cached: false,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Failed to translate text');
  }
}

/**
 * Translate multiple texts in batch
 */
export async function translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
  const startTime = Date.now();
  const { texts, sourceLanguage, targetLanguage, context } = request;

  let cacheHits = 0;
  const translations: TranslationResult[] = [];

  // Process translations in parallel with concurrency limit
  const CONCURRENCY_LIMIT = 5;

  for (let i = 0; i < texts.length; i += CONCURRENCY_LIMIT) {
    const batch = texts.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(text =>
        translateText({
          text,
          sourceLanguage,
          targetLanguage,
          context,
        })
      )
    );

    for (const result of batchResults) {
      if (result.cached) cacheHits++;
      translations.push(result);
    }
  }

  return {
    translations,
    totalProcessingTimeMs: Date.now() - startTime,
    cacheHits,
  };
}

/**
 * Generate content in a specified language
 */
export async function generateMultilingualContent(
  request: MultilingualContentRequest
): Promise<MultilingualContentResult> {
  const startTime = Date.now();
  const {
    task,
    targetLanguage,
    prompt,
    customerId,
    customerName,
    stakeholderName,
    additionalContext,
    includeEnglishSummary = false,
  } = request;

  try {
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

    const taskDescriptions: Record<typeof task, string> = {
      email: 'a professional email',
      summary: 'a concise summary',
      response: 'a response message',
      report: 'a business report',
      meeting_notes: 'meeting notes',
      qbr: 'a Quarterly Business Review presentation',
    };

    const systemPrompt = `You are a Customer Success AI assistant.
Generate all output in ${getLanguageName(targetLanguage)}.
The user may communicate in any language - understand their request and respond appropriately.

${customerName ? `Customer context:\n- Customer Name: ${customerName}` : ''}
${stakeholderName ? `- Stakeholder: ${stakeholderName}` : ''}

Your output should be:
- Professional and appropriate for B2B Customer Success
- Written in natural, fluent ${getLanguageName(targetLanguage)}
- Properly formatted for the requested content type`;

    const userPrompt = `Generate ${taskDescriptions[task]} based on the following request:

${prompt}

${additionalContext ? `Additional context: ${JSON.stringify(additionalContext)}` : ''}

${includeEnglishSummary ? '\nAfter the content, add a section called "---ENGLISH SUMMARY---" with a brief English summary of what you wrote.' : ''}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    let responseText = textBlock?.type === 'text' ? textBlock.text.trim() : '';

    // Extract English summary if requested
    let content = responseText;
    let englishSummary: string | undefined;

    if (includeEnglishSummary && responseText.includes('---ENGLISH SUMMARY---')) {
      const parts = responseText.split('---ENGLISH SUMMARY---');
      content = parts[0].trim();
      englishSummary = parts[1]?.trim();
    }

    return {
      content,
      language: targetLanguage,
      englishSummary,
      metadata: {
        task,
        generatedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('Multilingual content generation error:', error);
    throw new Error('Failed to generate multilingual content');
  }
}

/**
 * Get stakeholder language preferences
 */
export async function getStakeholderLanguagePreferences(
  stakeholderId: string
): Promise<StakeholderLanguagePreferences | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('stakeholders')
      .select('preferred_language, language_preferences')
      .eq('id', stakeholderId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      preferredLanguage: (data.preferred_language || 'en') as SupportedLanguage,
      communicationPreferences: data.language_preferences || undefined,
    };
  } catch (error) {
    console.error('Error fetching stakeholder language preferences:', error);
    return null;
  }
}

/**
 * Update stakeholder language preferences
 */
export async function updateStakeholderLanguagePreferences(
  stakeholderId: string,
  preferences: StakeholderLanguagePreferences
): Promise<boolean> {
  if (!supabase) {
    console.warn('Database not available, cannot update preferences');
    return false;
  }

  try {
    const { error } = await supabase
      .from('stakeholders')
      .update({
        preferred_language: preferences.preferredLanguage,
        language_preferences: preferences.communicationPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stakeholderId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error updating stakeholder language preferences:', error);
    return false;
  }
}

/**
 * Get translation cache statistics
 */
export async function getTranslationCacheStats(): Promise<{
  totalEntries: number;
  totalAccessCount: number;
  topLanguagePairs: Array<{ pair: string; count: number }>;
}> {
  if (!supabase) {
    return {
      totalEntries: memoryCache.size,
      totalAccessCount: Array.from(memoryCache.values()).reduce((sum, e) => sum + e.accessCount, 0),
      topLanguagePairs: [],
    };
  }

  try {
    // Get total entries and access count
    const { data: stats } = await supabase
      .from('translation_cache')
      .select('id, access_count, source_language, target_language');

    if (!stats) {
      return { totalEntries: 0, totalAccessCount: 0, topLanguagePairs: [] };
    }

    // Calculate top language pairs
    const pairCounts = new Map<string, number>();
    let totalAccessCount = 0;

    for (const entry of stats) {
      totalAccessCount += entry.access_count || 0;
      const pair = `${entry.source_language}->${entry.target_language}`;
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    }

    const topLanguagePairs = Array.from(pairCounts.entries())
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries: stats.length,
      totalAccessCount,
      topLanguagePairs,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { totalEntries: 0, totalAccessCount: 0, topLanguagePairs: [] };
  }
}

/**
 * Clear old translation cache entries
 */
export async function cleanupTranslationCache(daysOld: number = 30): Promise<number> {
  if (!supabase) {
    // For memory cache, just clear entries older than threshold
    const threshold = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.accessedAt.getTime() < threshold) {
        memoryCache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('translation_cache')
      .delete()
      .lt('accessed_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error cleaning up translation cache:', error);
    return 0;
  }
}

// Export service object
export const languageService = {
  detectLanguage,
  translateText,
  translateBatch,
  generateMultilingualContent,
  getStakeholderLanguagePreferences,
  updateStakeholderLanguagePreferences,
  getTranslationCacheStats,
  cleanupTranslationCache,
};

export default languageService;
