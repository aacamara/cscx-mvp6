/**
 * Multi-Language Support Types
 * PRD-224: Language detection, translation, and multilingual content generation
 */

// ============================================
// Language Codes (ISO 639-1)
// ============================================

/**
 * Tier 1 Languages - Full support
 */
export type Tier1Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh';

/**
 * Tier 2 Languages - Extended support
 */
export type Tier2Language = 'it' | 'nl' | 'ko' | 'ar' | 'hi';

/**
 * All supported language codes
 */
export type SupportedLanguage = Tier1Language | Tier2Language;

/**
 * Language metadata
 */
export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  tier: 1 | 2;
  direction: 'ltr' | 'rtl';
}

/**
 * Complete language registry
 */
export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  // Tier 1
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', tier: 1, direction: 'ltr' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: '🇪🇸', tier: 1, direction: 'ltr' },
  fr: { code: 'fr', name: 'French', nativeName: 'Francais', flag: '🇫🇷', tier: 1, direction: 'ltr' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', tier: 1, direction: 'ltr' },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Portugues', flag: '🇵🇹', tier: 1, direction: 'ltr' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', tier: 1, direction: 'ltr' },
  zh: { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文', flag: '🇨🇳', tier: 1, direction: 'ltr' },
  // Tier 2
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', tier: 2, direction: 'ltr' },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', tier: 2, direction: 'ltr' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', tier: 2, direction: 'ltr' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', tier: 2, direction: 'rtl' },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', tier: 2, direction: 'ltr' },
};

// ============================================
// Language Detection
// ============================================

/**
 * Result of language detection
 */
export interface LanguageDetection {
  detectedLanguage: SupportedLanguage;
  confidence: number;
  alternativeLanguages?: Array<{
    language: SupportedLanguage;
    confidence: number;
  }>;
  textSample: string;
}

/**
 * Request to detect language
 */
export interface DetectLanguageRequest {
  text: string;
  contextHint?: string; // Optional hint about expected language
}

// ============================================
// Translation
// ============================================

/**
 * Translation request parameters
 */
export interface TranslationRequest {
  text: string;
  sourceLanguage?: SupportedLanguage; // Auto-detect if not provided
  targetLanguage: SupportedLanguage;
  preserveFormatting?: boolean;
  context?: TranslationContext;
}

/**
 * Context for better translation quality
 */
export type TranslationContext =
  | 'customer_email'
  | 'meeting_transcript'
  | 'document'
  | 'chat'
  | 'report'
  | 'business_communication';

/**
 * Translation result
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  confidence: number;
  cached: boolean;
  processingTimeMs: number;
}

/**
 * Batch translation request
 */
export interface BatchTranslationRequest {
  texts: string[];
  sourceLanguage?: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  context?: TranslationContext;
}

/**
 * Batch translation result
 */
export interface BatchTranslationResult {
  translations: TranslationResult[];
  totalProcessingTimeMs: number;
  cacheHits: number;
}

// ============================================
// Content Generation
// ============================================

/**
 * Task types for multilingual content generation
 */
export type ContentGenerationTask =
  | 'email'
  | 'summary'
  | 'response'
  | 'report'
  | 'meeting_notes'
  | 'qbr';

/**
 * Request for multilingual content generation
 */
export interface MultilingualContentRequest {
  task: ContentGenerationTask;
  targetLanguage: SupportedLanguage;
  prompt: string; // Can be in any language
  customerId?: string;
  customerName?: string;
  stakeholderName?: string;
  additionalContext?: Record<string, any>;
  includeEnglishSummary?: boolean;
}

/**
 * Result of multilingual content generation
 */
export interface MultilingualContentResult {
  content: string;
  language: SupportedLanguage;
  englishSummary?: string;
  metadata: {
    task: ContentGenerationTask;
    generatedAt: Date;
    processingTimeMs: number;
  };
}

// ============================================
// Stakeholder Language Preferences
// ============================================

/**
 * Language preferences for a stakeholder
 */
export interface StakeholderLanguagePreferences {
  preferredLanguage: SupportedLanguage;
  communicationPreferences?: {
    emailLanguage?: SupportedLanguage;
    meetingLanguage?: SupportedLanguage;
    documentLanguage?: SupportedLanguage;
  };
}

/**
 * Request to update stakeholder language preferences
 */
export interface UpdateLanguagePreferencesRequest {
  stakeholderId: string;
  preferences: StakeholderLanguagePreferences;
}

// ============================================
// Bilingual Display
// ============================================

/**
 * Bilingual content for display
 */
export interface BilingualContent {
  original: {
    text: string;
    language: SupportedLanguage;
  };
  translated: {
    text: string;
    language: SupportedLanguage;
  };
  showOriginal: boolean;
  translationConfidence: number;
}

/**
 * Email with bilingual support
 */
export interface BilingualEmail {
  id: string;
  subject: {
    original: string;
    translated?: string;
  };
  body: BilingualContent;
  from: {
    name: string;
    email: string;
  };
  detectedLanguage: SupportedLanguage;
  recipientPreferredLanguage?: SupportedLanguage;
}

// ============================================
// Translation Cache
// ============================================

/**
 * Translation cache entry
 */
export interface TranslationCacheEntry {
  id: string;
  contentHash: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  originalText: string;
  translatedText: string;
  confidence: number;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
}

// ============================================
// Language Detection Results (DB)
// ============================================

/**
 * Stored language detection result
 */
export interface StoredLanguageDetection {
  id: string;
  contentType: 'email' | 'meeting' | 'document' | 'chat';
  contentId: string;
  detectedLanguage: SupportedLanguage;
  confidence: number;
  detectedAt: Date;
}

// ============================================
// Hook State
// ============================================

/**
 * State for useMultiLanguage hook
 */
export interface MultiLanguageState {
  isDetecting: boolean;
  isTranslating: boolean;
  isGenerating: boolean;
  detectedLanguage: SupportedLanguage | null;
  currentTranslation: TranslationResult | null;
  generatedContent: MultilingualContentResult | null;
  error: string | null;
  bilingualView: boolean;
}

/**
 * Return type for useMultiLanguage hook
 */
export interface UseMultiLanguageReturn {
  state: MultiLanguageState;
  detectLanguage: (text: string) => Promise<LanguageDetection | null>;
  translate: (request: TranslationRequest) => Promise<TranslationResult | null>;
  generateContent: (request: MultilingualContentRequest) => Promise<MultilingualContentResult | null>;
  toggleBilingualView: () => void;
  setTargetLanguage: (language: SupportedLanguage) => void;
  reset: () => void;
}

// ============================================
// API Response Types
// ============================================

/**
 * Standard API response wrapper
 */
export interface LanguageApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  processingTimeMs?: number;
}

/**
 * Detect language API response
 */
export type DetectLanguageResponse = LanguageApiResponse<LanguageDetection>;

/**
 * Translate API response
 */
export type TranslateResponse = LanguageApiResponse<TranslationResult>;

/**
 * Generate multilingual content API response
 */
export type GenerateMultilingualResponse = LanguageApiResponse<MultilingualContentResult>;

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a language code is supported
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return code in SUPPORTED_LANGUAGES;
}

/**
 * Get language info by code
 */
export function getLanguageInfo(code: SupportedLanguage): LanguageInfo {
  return SUPPORTED_LANGUAGES[code];
}

/**
 * Get all Tier 1 languages
 */
export function getTier1Languages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 1);
}

/**
 * Get all Tier 2 languages
 */
export function getTier2Languages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 2);
}

/**
 * Get all supported languages as array
 */
export function getAllLanguages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES);
}

export default {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  getLanguageInfo,
  getTier1Languages,
  getTier2Languages,
  getAllLanguages,
};
