/**
 * useMultiLanguage Hook
 * PRD-224: Multi-Language Support
 *
 * Custom hook for managing language detection, translation, and multilingual content.
 * Provides easy-to-use interface for language operations in React components.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  SupportedLanguage,
  LanguageDetection,
  TranslationRequest,
  TranslationResult,
  MultilingualContentRequest,
  MultilingualContentResult,
  MultiLanguageState,
  UseMultiLanguageReturn,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
} from '../types/language';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Language Data (duplicated for frontend)
// ============================================

const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
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

// ============================================
// Initial State
// ============================================

const initialState: MultiLanguageState = {
  isDetecting: false,
  isTranslating: false,
  isGenerating: false,
  detectedLanguage: null,
  currentTranslation: null,
  generatedContent: null,
  error: null,
  bilingualView: true,
};

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for managing multi-language operations
 */
export function useMultiLanguage(): UseMultiLanguageReturn {
  const [state, setState] = useState<MultiLanguageState>(initialState);
  const [targetLanguage, setTargetLanguageState] = useState<SupportedLanguage>('en');

  // Track ongoing requests for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Get auth headers for API requests
   */
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const userId = localStorage.getItem('userId');
    return userId ? { 'x-user-id': userId } : {};
  }, []);

  /**
   * Detect the language of a text sample
   */
  const detectLanguage = useCallback(async (text: string): Promise<LanguageDetection | null> => {
    if (!text || text.length < 3) {
      setState(prev => ({ ...prev, error: 'Text must be at least 3 characters' }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isDetecting: true,
      error: null,
    }));

    try {
      const response = await fetch(`${API_URL}/api/language/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to detect language');
      }

      setState(prev => ({
        ...prev,
        isDetecting: false,
        detectedLanguage: data.data.detectedLanguage,
      }));

      return data.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Detection failed';
      setState(prev => ({
        ...prev,
        isDetecting: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [getAuthHeaders]);

  /**
   * Translate text from one language to another
   */
  const translate = useCallback(async (request: TranslationRequest): Promise<TranslationResult | null> => {
    if (!request.text) {
      setState(prev => ({ ...prev, error: 'Text is required for translation' }));
      return null;
    }

    if (!request.targetLanguage) {
      setState(prev => ({ ...prev, error: 'Target language is required' }));
      return null;
    }

    // Cancel any ongoing translation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isTranslating: true,
      error: null,
    }));

    try {
      const response = await fetch(`${API_URL}/api/language/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to translate');
      }

      setState(prev => ({
        ...prev,
        isTranslating: false,
        currentTranslation: data.data,
      }));

      return data.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't update state
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [getAuthHeaders]);

  /**
   * Generate content in a specified language
   */
  const generateContent = useCallback(async (
    request: MultilingualContentRequest
  ): Promise<MultilingualContentResult | null> => {
    if (!request.prompt) {
      setState(prev => ({ ...prev, error: 'Prompt is required' }));
      return null;
    }

    if (!request.targetLanguage) {
      setState(prev => ({ ...prev, error: 'Target language is required' }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
    }));

    try {
      const response = await fetch(`${API_URL}/api/language/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate content');
      }

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generatedContent: data.data,
      }));

      return data.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [getAuthHeaders]);

  /**
   * Toggle bilingual view mode
   */
  const toggleBilingualView = useCallback(() => {
    setState(prev => ({
      ...prev,
      bilingualView: !prev.bilingualView,
    }));
  }, []);

  /**
   * Set target language for operations
   */
  const setTargetLanguage = useCallback((language: SupportedLanguage) => {
    setTargetLanguageState(language);
  }, []);

  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(initialState);
  }, []);

  return {
    state,
    detectLanguage,
    translate,
    generateContent,
    toggleBilingualView,
    setTargetLanguage,
    reset,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get language info by code
 */
export function getLanguageInfo(code: SupportedLanguage): LanguageInfo {
  return SUPPORTED_LANGUAGES[code];
}

/**
 * Get language name with flag
 */
export function getLanguageDisplay(code: SupportedLanguage): string {
  const info = SUPPORTED_LANGUAGES[code];
  return info ? `${info.flag} ${info.name}` : code;
}

/**
 * Get all supported languages
 */
export function getAllLanguages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES);
}

/**
 * Get Tier 1 languages
 */
export function getTier1Languages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 1);
}

/**
 * Get Tier 2 languages
 */
export function getTier2Languages(): LanguageInfo[] {
  return Object.values(SUPPORTED_LANGUAGES).filter(l => l.tier === 2);
}

/**
 * Check if a language code is valid
 */
export function isValidLanguage(code: string): code is SupportedLanguage {
  return code in SUPPORTED_LANGUAGES;
}

/**
 * Get text direction for a language
 */
export function getTextDirection(code: SupportedLanguage): 'ltr' | 'rtl' {
  return SUPPORTED_LANGUAGES[code]?.direction || 'ltr';
}

// ============================================
// Export
// ============================================

export { SUPPORTED_LANGUAGES };
export default useMultiLanguage;
