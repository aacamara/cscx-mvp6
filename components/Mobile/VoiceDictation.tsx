/**
 * Voice Dictation Component (PRD-264)
 *
 * Dictation mode for composing text with voice, including
 * punctuation commands and edit commands.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface VoiceDictationProps {
  onTextChange: (text: string) => void;
  initialText?: string;
  placeholder?: string;
  className?: string;
  autoStart?: boolean;
  onSave?: (text: string) => void;
  onCancel?: () => void;
}

// ============================================
// Punctuation and Command Maps
// ============================================

const PUNCTUATION_MAP: Record<string, string> = {
  'period': '.',
  'full stop': '.',
  'comma': ',',
  'question mark': '?',
  'exclamation mark': '!',
  'exclamation point': '!',
  'colon': ':',
  'semicolon': ';',
  'dash': '-',
  'hyphen': '-',
  'open parenthesis': '(',
  'close parenthesis': ')',
  'open bracket': '[',
  'close bracket': ']',
  'open quote': '"',
  'close quote': '"',
  'apostrophe': "'",
  'ampersand': '&',
  'at sign': '@',
  'hashtag': '#',
  'dollar sign': '$',
  'percent sign': '%',
};

const FORMAT_COMMANDS: Record<string, string> = {
  'new line': '\n',
  'newline': '\n',
  'new paragraph': '\n\n',
  'tab': '\t',
};

// ============================================
// Component
// ============================================

export const VoiceDictation: React.FC<VoiceDictationProps> = ({
  onTextChange,
  initialText = '',
  placeholder = 'Start speaking to dictate...',
  className = '',
  autoStart = false,
  onSave,
  onCancel,
}) => {
  // State
  const [text, setText] = useState(initialText);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  // Refs
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================
  // Initialize Speech Recognition
  // ============================================

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const results = event.results;

      // Process all results from the current recognition session
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        const processed = processInput(finalTranscript);
        appendText(processed);
        setInterimText('');
      } else {
        setInterimText(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Dictation error:', event.error);
      if (event.error !== 'aborted') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;

    if (autoStart) {
      startListening();
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // ============================================
  // Text Processing
  // ============================================

  const processInput = useCallback((input: string): string => {
    let processed = input.trim();

    // Process punctuation commands
    for (const [command, punctuation] of Object.entries(PUNCTUATION_MAP)) {
      const regex = new RegExp(`\\b${command}\\b`, 'gi');
      processed = processed.replace(regex, punctuation);
    }

    // Process format commands
    for (const [command, format] of Object.entries(FORMAT_COMMANDS)) {
      const regex = new RegExp(`\\b${command}\\b`, 'gi');
      processed = processed.replace(regex, format);
    }

    // Handle edit commands
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('delete last word')) {
      setText((prev) => {
        const newText = deleteLastWord(prev);
        setUndoStack((stack) => [...stack, prev]);
        onTextChange(newText);
        return newText;
      });
      return '';
    }

    if (lowerInput.includes('delete last sentence')) {
      setText((prev) => {
        const newText = deleteLastSentence(prev);
        setUndoStack((stack) => [...stack, prev]);
        onTextChange(newText);
        return newText;
      });
      return '';
    }

    if (lowerInput.includes('undo') || lowerInput.includes('undo that')) {
      if (undoStack.length > 0) {
        const previousText = undoStack[undoStack.length - 1];
        setUndoStack((stack) => stack.slice(0, -1));
        setText(previousText);
        onTextChange(previousText);
      }
      return '';
    }

    if (lowerInput.includes('clear all') || lowerInput.includes('clear everything')) {
      setUndoStack((stack) => [...stack, text]);
      setText('');
      onTextChange('');
      return '';
    }

    if (lowerInput === 'capitalize' || lowerInput === 'cap') {
      // Capitalize the last word
      setText((prev) => {
        const words = prev.split(' ');
        if (words.length > 0) {
          words[words.length - 1] = words[words.length - 1].charAt(0).toUpperCase() +
            words[words.length - 1].slice(1);
        }
        const newText = words.join(' ');
        onTextChange(newText);
        return newText;
      });
      return '';
    }

    return processed;
  }, [text, undoStack, onTextChange]);

  const appendText = useCallback((newText: string) => {
    if (!newText) return;

    setText((prev) => {
      // Add space before new text if needed
      const needsSpace = prev.length > 0 &&
        !prev.endsWith(' ') &&
        !prev.endsWith('\n') &&
        !newText.startsWith('.') &&
        !newText.startsWith(',') &&
        !newText.startsWith('!') &&
        !newText.startsWith('?');

      const separator = needsSpace ? ' ' : '';
      const updated = prev + separator + newText;
      onTextChange(updated);
      return updated;
    });

    // Auto-scroll textarea
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [onTextChange]);

  const deleteLastWord = (text: string): string => {
    return text.replace(/\s*\S+\s*$/, '');
  };

  const deleteLastSentence = (text: string): string => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    sentences.pop();
    return sentences.join(' ');
  };

  // ============================================
  // Control Functions
  // ============================================

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start dictation:', error);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      // Ignore
    }
    setIsListening(false);
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTextChange(newText);
  };

  const handleSave = () => {
    stopListening();
    onSave?.(text);
  };

  const handleCancel = () => {
    stopListening();
    onCancel?.();
  };

  // ============================================
  // Render
  // ============================================

  if (!isSupported) {
    return (
      <div className={`p-4 bg-cscx-gray-900 rounded-xl ${className}`}>
        <p className="text-cscx-gray-400 text-center">
          Voice dictation is not supported in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-cscx-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-cscx-accent animate-pulse' : 'bg-cscx-gray-600'}`} />
          <span className="text-sm font-medium text-white">
            {isListening ? 'Dictating...' : 'Dictation Mode'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isListening
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-cscx-accent hover:bg-red-700 text-white'
              }
            `}
          >
            {isListening ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>

      {/* Text Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder={placeholder}
          className="w-full h-40 p-4 bg-transparent text-white resize-none focus:outline-none placeholder-cscx-gray-500"
        />

        {/* Interim Text Overlay */}
        {interimText && (
          <div className="absolute bottom-2 left-4 right-4 p-2 bg-cscx-gray-800/90 rounded-lg">
            <p className="text-cscx-gray-400 text-sm italic">{interimText}</p>
          </div>
        )}
      </div>

      {/* Commands Help */}
      <div className="px-4 py-2 border-t border-cscx-gray-800 bg-cscx-gray-800/30">
        <p className="text-xs text-cscx-gray-500">
          <span className="text-cscx-gray-400">Commands:</span>{' '}
          &quot;period&quot;, &quot;comma&quot;, &quot;new line&quot;, &quot;delete last word&quot;, &quot;undo&quot;
        </p>
      </div>

      {/* Footer Actions */}
      {(onSave || onCancel) && (
        <div className="p-3 border-t border-cscx-gray-800 flex items-center justify-between">
          <span className="text-xs text-cscx-gray-500">
            {text.split(/\s+/).filter(w => w).length} words
          </span>
          <div className="flex gap-2">
            {onCancel && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            {onSave && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceDictation;
