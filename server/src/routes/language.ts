/**
 * Multi-Language Support Routes
 * PRD-224: API endpoints for language detection, translation, and multilingual content
 */

import { Router, Request, Response } from 'express';
import { languageService } from '../services/ai/language.js';
import type {
  TranslationRequest,
  BatchTranslationRequest,
  MultilingualContentRequest,
  StakeholderLanguagePreferences,
  SupportedLanguage,
} from '../../../types/language.js';

const router = Router();

// ============================================
// Language Detection
// ============================================

/**
 * POST /api/language/detect
 * Detect the language of a text sample
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const { text, contextHint } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
      });
    }

    if (text.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Text must be at least 3 characters long',
      });
    }

    const startTime = Date.now();
    const detection = await languageService.detectLanguage(text);

    res.json({
      success: true,
      data: detection,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Language detection error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect language',
    });
  }
});

// ============================================
// Translation
// ============================================

/**
 * POST /api/language/translate
 * Translate text from one language to another
 */
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const {
      text,
      sourceLanguage,
      targetLanguage,
      preserveFormatting,
      context,
    }: TranslationRequest = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Target language is required',
      });
    }

    const result = await languageService.translateText({
      text,
      sourceLanguage,
      targetLanguage,
      preserveFormatting,
      context,
    });

    res.json({
      success: true,
      data: result,
      cached: result.cached,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to translate text',
    });
  }
});

/**
 * POST /api/language/translate/batch
 * Translate multiple texts in batch
 */
router.post('/translate/batch', async (req: Request, res: Response) => {
  try {
    const {
      texts,
      sourceLanguage,
      targetLanguage,
      context,
    }: BatchTranslationRequest = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Texts array is required and must not be empty',
      });
    }

    if (texts.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 texts per batch request',
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Target language is required',
      });
    }

    const result = await languageService.translateBatch({
      texts,
      sourceLanguage,
      targetLanguage,
      context,
    });

    res.json({
      success: true,
      data: result,
      totalCount: texts.length,
      cacheHits: result.cacheHits,
      processingTimeMs: result.totalProcessingTimeMs,
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to translate texts',
    });
  }
});

// ============================================
// Multilingual Content Generation
// ============================================

/**
 * POST /api/language/generate
 * Generate content in a specified language
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      task,
      targetLanguage,
      prompt,
      customerId,
      customerName,
      stakeholderName,
      additionalContext,
      includeEnglishSummary,
    }: MultilingualContentRequest = req.body;

    if (!task) {
      return res.status(400).json({
        success: false,
        error: 'Task type is required',
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Target language is required',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a string',
      });
    }

    const result = await languageService.generateMultilingualContent({
      task,
      targetLanguage,
      prompt,
      customerId,
      customerName,
      stakeholderName,
      additionalContext,
      includeEnglishSummary,
    });

    res.json({
      success: true,
      data: result,
      processingTimeMs: result.metadata.processingTimeMs,
    });
  } catch (error) {
    console.error('Multilingual generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate content',
    });
  }
});

/**
 * POST /api/language/generate/email
 * Generate an email in a specified language (convenience endpoint)
 */
router.post('/generate/email', async (req: Request, res: Response) => {
  try {
    const {
      targetLanguage,
      prompt,
      customerId,
      customerName,
      recipientName,
      emailType,
    } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Target language is required',
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    // Build enhanced prompt for email generation
    const enhancedPrompt = `
Email Type: ${emailType || 'general'}
${recipientName ? `Recipient: ${recipientName}` : ''}
${customerName ? `Customer: ${customerName}` : ''}

Request: ${prompt}

Generate a professional email with:
- Appropriate subject line
- Professional greeting
- Clear body content
- Professional sign-off
`;

    const result = await languageService.generateMultilingualContent({
      task: 'email',
      targetLanguage,
      prompt: enhancedPrompt,
      customerId,
      customerName,
      stakeholderName: recipientName,
      includeEnglishSummary: targetLanguage !== 'en',
    });

    res.json({
      success: true,
      data: result,
      processingTimeMs: result.metadata.processingTimeMs,
    });
  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate email',
    });
  }
});

// ============================================
// Stakeholder Language Preferences
// ============================================

/**
 * GET /api/language/stakeholders/:stakeholderId/preferences
 * Get language preferences for a stakeholder
 */
router.get('/stakeholders/:stakeholderId/preferences', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;

    if (!stakeholderId) {
      return res.status(400).json({
        success: false,
        error: 'Stakeholder ID is required',
      });
    }

    const preferences = await languageService.getStakeholderLanguagePreferences(stakeholderId);

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: 'Stakeholder not found or no preferences set',
      });
    }

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get preferences',
    });
  }
});

/**
 * PUT /api/language/stakeholders/:stakeholderId/preferences
 * Update language preferences for a stakeholder
 */
router.put('/stakeholders/:stakeholderId/preferences', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const { preferredLanguage, communicationPreferences }: StakeholderLanguagePreferences = req.body;

    if (!stakeholderId) {
      return res.status(400).json({
        success: false,
        error: 'Stakeholder ID is required',
      });
    }

    if (!preferredLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Preferred language is required',
      });
    }

    const success = await languageService.updateStakeholderLanguagePreferences(stakeholderId, {
      preferredLanguage,
      communicationPreferences,
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update preferences',
      });
    }

    res.json({
      success: true,
      message: 'Language preferences updated successfully',
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update preferences',
    });
  }
});

// ============================================
// Cache Management
// ============================================

/**
 * GET /api/language/cache/stats
 * Get translation cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = await languageService.getTranslationCacheStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats',
    });
  }
});

/**
 * POST /api/language/cache/cleanup
 * Clean up old translation cache entries (admin endpoint)
 */
router.post('/cache/cleanup', async (req: Request, res: Response) => {
  try {
    const { daysOld = 30 } = req.body;

    if (typeof daysOld !== 'number' || daysOld < 1) {
      return res.status(400).json({
        success: false,
        error: 'daysOld must be a positive number',
      });
    }

    const deletedCount = await languageService.cleanupTranslationCache(daysOld);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} cache entries older than ${daysOld} days`,
      deletedCount,
    });
  } catch (error) {
    console.error('Cache cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup cache',
    });
  }
});

// ============================================
// Supported Languages
// ============================================

/**
 * GET /api/language/supported
 * Get list of all supported languages
 */
router.get('/supported', (req: Request, res: Response) => {
  // Import language info at runtime to avoid circular dependencies
  const SUPPORTED_LANGUAGES: Record<SupportedLanguage, any> = {
    en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', tier: 1, direction: 'ltr' },
    es: { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: '🇪🇸', tier: 1, direction: 'ltr' },
    fr: { code: 'fr', name: 'French', nativeName: 'Francais', flag: '🇫🇷', tier: 1, direction: 'ltr' },
    de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', tier: 1, direction: 'ltr' },
    pt: { code: 'pt', name: 'Portuguese', nativeName: 'Portugues', flag: '🇵🇹', tier: 1, direction: 'ltr' },
    ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', tier: 1, direction: 'ltr' },
    zh: { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文', flag: '🇨🇳', tier: 1, direction: 'ltr' },
    it: { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', tier: 2, direction: 'ltr' },
    nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', tier: 2, direction: 'ltr' },
    ko: { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', tier: 2, direction: 'ltr' },
    ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', tier: 2, direction: 'rtl' },
    hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', tier: 2, direction: 'ltr' },
  };

  const tier1 = Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 1);
  const tier2 = Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 2);

  res.json({
    success: true,
    data: {
      all: Object.values(SUPPORTED_LANGUAGES),
      tier1,
      tier2,
      defaultLanguage: 'en',
    },
  });
});

export { router as languageRoutes };
export default router;
