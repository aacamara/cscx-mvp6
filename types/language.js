/**
 * Multi-Language Support Types
 * PRD-224: Language detection, translation, and multilingual content generation
 */
/**
 * Complete language registry
 */
export const SUPPORTED_LANGUAGES = {
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
// Utility Functions
// ============================================
/**
 * Check if a language code is supported
 */
export function isSupportedLanguage(code) {
    return code in SUPPORTED_LANGUAGES;
}
/**
 * Get language info by code
 */
export function getLanguageInfo(code) {
    return SUPPORTED_LANGUAGES[code];
}
/**
 * Get all Tier 1 languages
 */
export function getTier1Languages() {
    return Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 1);
}
/**
 * Get all Tier 2 languages
 */
export function getTier2Languages() {
    return Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 2);
}
/**
 * Get all supported languages as array
 */
export function getAllLanguages() {
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
//# sourceMappingURL=language.js.map