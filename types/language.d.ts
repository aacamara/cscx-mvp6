/**
 * Multi-Language Support Types
 * PRD-224: Language detection, translation, and multilingual content generation
 */
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
export declare const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo>;
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
    contextHint?: string;
}
/**
 * Translation request parameters
 */
export interface TranslationRequest {
    text: string;
    sourceLanguage?: SupportedLanguage;
    targetLanguage: SupportedLanguage;
    preserveFormatting?: boolean;
    context?: TranslationContext;
}
/**
 * Context for better translation quality
 */
export type TranslationContext = 'customer_email' | 'meeting_transcript' | 'document' | 'chat' | 'report' | 'business_communication';
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
/**
 * Task types for multilingual content generation
 */
export type ContentGenerationTask = 'email' | 'summary' | 'response' | 'report' | 'meeting_notes' | 'qbr';
/**
 * Request for multilingual content generation
 */
export interface MultilingualContentRequest {
    task: ContentGenerationTask;
    targetLanguage: SupportedLanguage;
    prompt: string;
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
/**
 * Check if a language code is supported
 */
export declare function isSupportedLanguage(code: string): code is SupportedLanguage;
/**
 * Get language info by code
 */
export declare function getLanguageInfo(code: SupportedLanguage): LanguageInfo;
/**
 * Get all Tier 1 languages
 */
export declare function getTier1Languages(): LanguageInfo[];
/**
 * Get all Tier 2 languages
 */
export declare function getTier2Languages(): LanguageInfo[];
/**
 * Get all supported languages as array
 */
export declare function getAllLanguages(): LanguageInfo[];
declare const _default: {
    SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo>;
    isSupportedLanguage: typeof isSupportedLanguage;
    getLanguageInfo: typeof getLanguageInfo;
    getTier1Languages: typeof getTier1Languages;
    getTier2Languages: typeof getTier2Languages;
    getAllLanguages: typeof getAllLanguages;
};
export default _default;
//# sourceMappingURL=language.d.ts.map