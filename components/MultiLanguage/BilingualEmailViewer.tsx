/**
 * BilingualEmailViewer Component
 * PRD-224: Multi-Language Support
 *
 * Displays emails with original and translated content side-by-side or toggleable.
 * Supports automatic language detection and on-demand translation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useMultiLanguage, getLanguageDisplay, getTextDirection, SUPPORTED_LANGUAGES } from '../../hooks/useMultiLanguage';
import type { SupportedLanguage, BilingualEmail } from '../../types/language';

// ============================================
// Types
// ============================================

interface BilingualEmailViewerProps {
  email: {
    id: string;
    subject: string;
    body: string;
    from: {
      name: string;
      email: string;
    };
    date?: string;
  };
  userLanguage?: SupportedLanguage;
  showBilingualDefault?: boolean;
  onReplyInLanguage?: (language: SupportedLanguage) => void;
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export const BilingualEmailViewer: React.FC<BilingualEmailViewerProps> = ({
  email,
  userLanguage = 'en',
  showBilingualDefault = true,
  onReplyInLanguage,
  compact = false,
}) => {
  const { state, detectLanguage, translate } = useMultiLanguage();

  // Local state
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLanguage | null>(null);
  const [translatedSubject, setTranslatedSubject] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(!showBilingualDefault);
  const [showBilingual, setShowBilingual] = useState(showBilingualDefault);
  const [isTranslating, setIsTranslating] = useState(false);

  // Detect language on mount
  useEffect(() => {
    const detectEmailLanguage = async () => {
      if (!email.body) return;

      const detection = await detectLanguage(email.body);
      if (detection) {
        setDetectedLanguage(detection.detectedLanguage);

        // Auto-translate if different from user's language
        if (detection.detectedLanguage !== userLanguage) {
          handleTranslate(detection.detectedLanguage);
        }
      }
    };

    detectEmailLanguage();
  }, [email.body, userLanguage]);

  // Translate email content
  const handleTranslate = useCallback(async (sourceLanguage: SupportedLanguage) => {
    setIsTranslating(true);

    try {
      // Translate subject
      const subjectResult = await translate({
        text: email.subject,
        sourceLanguage,
        targetLanguage: userLanguage,
        context: 'customer_email',
      });
      if (subjectResult) {
        setTranslatedSubject(subjectResult.translatedText);
      }

      // Translate body
      const bodyResult = await translate({
        text: email.body,
        sourceLanguage,
        targetLanguage: userLanguage,
        context: 'customer_email',
        preserveFormatting: true,
      });
      if (bodyResult) {
        setTranslatedBody(bodyResult.translatedText);
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [email.subject, email.body, userLanguage, translate]);

  // Toggle between original and translated
  const toggleView = useCallback(() => {
    if (showBilingual) {
      setShowBilingual(false);
      setShowOriginal(false);
    } else if (!showOriginal) {
      setShowOriginal(true);
    } else {
      setShowBilingual(true);
      setShowOriginal(false);
    }
  }, [showBilingual, showOriginal]);

  // Get display content based on current view mode
  const displaySubject = showOriginal ? email.subject : (translatedSubject || email.subject);
  const displayBody = showOriginal ? email.body : (translatedBody || email.body);

  const needsTranslation = detectedLanguage && detectedLanguage !== userLanguage;
  const hasTranslation = translatedBody !== null;

  return (
    <div className={`bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden ${compact ? '' : 'shadow-lg'}`}>
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800 bg-cscx-gray-800/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-cscx-gray-400 mb-1">
              <span className="font-medium text-white">{email.from.name}</span>
              <span>&lt;{email.from.email}&gt;</span>
            </div>
            <h3 className="text-white font-medium truncate">
              {displaySubject}
            </h3>
          </div>

          {/* Language indicator and controls */}
          <div className="flex items-center gap-2 shrink-0">
            {detectedLanguage && (
              <div className="flex items-center gap-1 px-2 py-1 bg-cscx-gray-700 rounded text-xs">
                <span>{SUPPORTED_LANGUAGES[detectedLanguage]?.flag}</span>
                <span className="text-cscx-gray-300">{SUPPORTED_LANGUAGES[detectedLanguage]?.name}</span>
              </div>
            )}

            {needsTranslation && (
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleView}
                  className="px-2 py-1 bg-cscx-gray-700 hover:bg-cscx-gray-600 rounded text-xs text-white transition-colors"
                >
                  {showBilingual ? 'Single View' : showOriginal ? 'Show Translation' : 'Show Original'}
                </button>
              </div>
            )}
          </div>
        </div>

        {email.date && (
          <div className="text-xs text-cscx-gray-500 mt-2">
            {new Date(email.date).toLocaleString()}
          </div>
        )}
      </div>

      {/* Loading state */}
      {(state.isDetecting || isTranslating) && (
        <div className="px-4 py-2 bg-blue-900/20 border-b border-blue-800/30">
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent" />
            <span>{state.isDetecting ? 'Detecting language...' : 'Translating...'}</span>
          </div>
        </div>
      )}

      {/* Email Body */}
      <div className={`p-4 ${showBilingual && hasTranslation ? 'grid grid-cols-2 gap-4' : ''}`}>
        {/* Translation (or only content when not bilingual) */}
        {(!showBilingual || !showOriginal || !hasTranslation) && (
          <div
            className={`prose prose-invert prose-sm max-w-none ${getTextDirection(userLanguage) === 'rtl' ? 'text-right' : ''}`}
            dir={getTextDirection(userLanguage)}
          >
            {showBilingual && hasTranslation && (
              <div className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 pb-2 border-b border-cscx-gray-800">
                Translation ({SUPPORTED_LANGUAGES[userLanguage]?.name})
              </div>
            )}
            <div className="whitespace-pre-wrap text-white leading-relaxed">
              {displayBody}
            </div>
          </div>
        )}

        {/* Original (in bilingual mode) */}
        {showBilingual && hasTranslation && detectedLanguage && (
          <div
            className={`prose prose-invert prose-sm max-w-none border-l border-cscx-gray-800 pl-4 ${getTextDirection(detectedLanguage) === 'rtl' ? 'text-right' : ''}`}
            dir={getTextDirection(detectedLanguage)}
          >
            <div className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 pb-2 border-b border-cscx-gray-800 flex items-center justify-between">
              <span>Original ({SUPPORTED_LANGUAGES[detectedLanguage]?.name})</span>
              <button
                onClick={() => setShowBilingual(false)}
                className="text-cscx-gray-500 hover:text-white transition-colors"
                title="Hide original"
              >
                [Hide]
              </button>
            </div>
            <div className="whitespace-pre-wrap text-cscx-gray-300 leading-relaxed">
              {email.body}
            </div>
          </div>
        )}
      </div>

      {/* Reply Actions */}
      {onReplyInLanguage && needsTranslation && (
        <div className="px-4 py-3 border-t border-cscx-gray-800 bg-cscx-gray-800/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-cscx-gray-400">Reply in:</span>
            {detectedLanguage && (
              <button
                onClick={() => onReplyInLanguage(detectedLanguage)}
                className="px-3 py-1.5 bg-cscx-accent hover:bg-red-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
              >
                {SUPPORTED_LANGUAGES[detectedLanguage]?.flag} {SUPPORTED_LANGUAGES[detectedLanguage]?.name}
              </button>
            )}
            <button
              onClick={() => onReplyInLanguage(userLanguage)}
              className="px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
            >
              {SUPPORTED_LANGUAGES[userLanguage]?.flag} {SUPPORTED_LANGUAGES[userLanguage]?.name}
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {state.error && (
        <div className="px-4 py-2 bg-red-900/20 border-t border-red-800/30">
          <div className="text-red-400 text-sm">
            {state.error}
          </div>
        </div>
      )}
    </div>
  );
};

export default BilingualEmailViewer;
