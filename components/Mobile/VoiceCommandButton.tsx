/**
 * Voice Command Button Component (PRD-264)
 *
 * Mobile-friendly voice input button with visual feedback,
 * interim transcription display, and command processing.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface VoiceCommandResult {
  success: boolean;
  action: string;
  response: string;
  data?: any;
  requiresConfirmation?: boolean;
  navigationTarget?: string;
  error?: string;
}

interface CommandMatch {
  matched: boolean;
  command?: {
    id: string;
    action: string;
    description: string;
    category: string;
    requiresConfirmation: boolean;
  };
  args?: string[];
  confidence?: number;
  result?: VoiceCommandResult;
  suggestions?: Array<{
    pattern: string;
    description: string;
    example: string;
  }>;
  message?: string;
}

interface VoiceSettings {
  voiceEnabled: boolean;
  continuousListening: boolean;
  speechRate: number;
  voiceResponseEnabled: boolean;
  summaryMode: boolean;
  confirmDestructiveActions: boolean;
  language: string;
}

interface VoiceCommandButtonProps {
  onTranscript?: (text: string) => void;
  onCommand?: (result: VoiceCommandResult) => void;
  onError?: (error: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTranscript?: boolean;
  floatingPosition?: 'bottom-right' | 'bottom-center' | 'inline';
}

// ============================================
// Web Speech API Type Definitions
// ============================================

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// ============================================
// Component
// ============================================

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({
  onTranscript,
  onCommand,
  onError,
  className = '',
  size = 'md',
  showTranscript = true,
  floatingPosition = 'bottom-right',
}) => {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  // State
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CommandMatch | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    commandId: string;
    args: string[];
    response: string;
  } | null>(null);
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // ============================================
  // Initialize Speech APIs
  // ============================================

  useEffect(() => {
    // Check for Speech Recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    // Initialize recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = settings?.language || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      const last = results.length - 1;
      const result = results[last];

      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        setFinalText(transcript);
        setInterimText('');
        onTranscript?.(transcript);
        processVoiceCommand(transcript);
      } else {
        setInterimText(result[0].transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);

      if (event.error === 'not-allowed') {
        onError?.('Microphone access denied. Please enable microphone permissions.');
      } else if (event.error === 'network') {
        onError?.('Network error. Please check your connection.');
      } else if (event.error !== 'aborted') {
        onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if continuous listening is enabled
      if (settings?.continuousListening && !isProcessing) {
        setTimeout(() => {
          startListening();
        }, 500);
      }
    };

    recognitionRef.current = recognition;

    // Initialize speech synthesis
    synthRef.current = window.speechSynthesis;

    // Load settings
    loadSettings();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [settings?.language, settings?.continuousListening]);

  // ============================================
  // Settings
  // ============================================

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/voice/settings`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load voice settings:', error);
      // Use defaults
      setSettings({
        voiceEnabled: true,
        continuousListening: false,
        speechRate: 1.0,
        voiceResponseEnabled: true,
        summaryMode: false,
        confirmDestructiveActions: true,
        language: 'en-US',
      });
    }
  };

  // ============================================
  // Voice Recognition
  // ============================================

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    setInterimText('');
    setFinalText('');
    setLastResult(null);
    setPendingConfirmation(null);

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start recognition:', error);
      onError?.('Failed to start voice recognition');
    }
  }, [isListening, onError]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      // Ignore stop errors
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

  // ============================================
  // Command Processing
  // ============================================

  const processVoiceCommand = async (transcript: string) => {
    if (!transcript.trim()) return;

    setIsProcessing(true);

    try {
      const response = await fetch(`${API_URL}/api/voice/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          transcript,
          executeIfMatch: true,
        }),
      });

      const data: CommandMatch = await response.json();
      setLastResult(data);

      if (data.matched && data.result) {
        // Handle result
        if (data.result.requiresConfirmation && data.command) {
          // Store for confirmation
          setPendingConfirmation({
            commandId: data.command.id,
            args: data.args || [],
            response: data.result.response,
          });
          speak(data.result.response);
        } else if (data.result.navigationTarget) {
          // Handle navigation
          speak(data.result.response);
          if (data.result.navigationTarget === 'back') {
            window.history.back();
          } else {
            navigate(data.result.navigationTarget);
          }
        } else {
          speak(data.result.response);
        }

        onCommand?.(data.result);
      } else {
        // No match - speak suggestions or fallback
        const message = data.message || "I didn't understand that command.";
        speak(message);
      }
    } catch (error) {
      console.error('Voice command processing error:', error);
      const errorMessage = 'Sorry, I had trouble processing that command.';
      speak(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmCommand = async () => {
    if (!pendingConfirmation) return;

    setIsProcessing(true);

    try {
      const response = await fetch(`${API_URL}/api/voice/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          commandId: pendingConfirmation.commandId,
          args: pendingConfirmation.args,
        }),
      });

      const data = await response.json();

      if (data.success && data.result) {
        speak(data.result.response);
        if (data.result.navigationTarget) {
          navigate(data.result.navigationTarget);
        }
        onCommand?.(data.result);
      }

      setPendingConfirmation(null);
    } catch (error) {
      console.error('Command confirmation error:', error);
      speak('Sorry, I could not complete that action.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelCommand = () => {
    setPendingConfirmation(null);
    speak('Command cancelled.');
  };

  // ============================================
  // Text-to-Speech
  // ============================================

  const speak = (text: string) => {
    if (!settings?.voiceResponseEnabled || !synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.speechRate;
    utterance.pitch = 1.0;
    utterance.lang = settings.language;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // ============================================
  // Size Classes
  // ============================================

  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-3xl',
  };

  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6 z-50',
    'bottom-center': 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
    'inline': '',
  };

  // ============================================
  // Render
  // ============================================

  if (!isSupported) {
    return (
      <div className={`text-center text-cscx-gray-400 text-sm ${className}`}>
        Voice commands not supported in this browser
      </div>
    );
  }

  return (
    <div className={`${positionClasses[floatingPosition]} ${className}`}>
      {/* Transcript Display */}
      {showTranscript && (interimText || finalText || lastResult) && (
        <div className="mb-3 p-3 bg-cscx-gray-800 rounded-xl border border-cscx-gray-700 max-w-xs">
          {/* Interim transcript */}
          {interimText && (
            <p className="text-cscx-gray-400 text-sm italic">{interimText}</p>
          )}

          {/* Final transcript */}
          {finalText && !interimText && (
            <p className="text-white text-sm font-medium">&quot;{finalText}&quot;</p>
          )}

          {/* Result message */}
          {lastResult && !interimText && lastResult.result?.response && (
            <p className="text-cscx-gray-300 text-sm mt-2">
              {lastResult.result.response}
            </p>
          )}

          {/* Suggestions */}
          {lastResult && !lastResult.matched && lastResult.suggestions && (
            <div className="mt-2 pt-2 border-t border-cscx-gray-700">
              <p className="text-xs text-cscx-gray-500 mb-1">Try saying:</p>
              {lastResult.suggestions.slice(0, 2).map((s, i) => (
                <p key={i} className="text-xs text-cscx-accent">
                  &quot;{s.example}&quot;
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {pendingConfirmation && (
        <div className="mb-3 p-3 bg-yellow-900/50 rounded-xl border border-yellow-600/50 max-w-xs">
          <p className="text-yellow-200 text-sm mb-3">{pendingConfirmation.response}</p>
          <div className="flex gap-2">
            <button
              onClick={confirmCommand}
              disabled={isProcessing}
              className="flex-1 px-3 py-1.5 bg-cscx-accent hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Yes
            </button>
            <button
              onClick={cancelCommand}
              disabled={isProcessing}
              className="flex-1 px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Voice Button */}
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
          ${sizeClasses[size]}
          flex items-center justify-center
          rounded-full shadow-lg
          transition-all duration-200
          ${
            isListening
              ? 'bg-cscx-accent animate-pulse ring-4 ring-cscx-accent/30'
              : 'bg-cscx-gray-800 hover:bg-cscx-gray-700 border border-cscx-gray-600'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={isListening ? 'Stop listening' : 'Start voice command'}
      >
        {isProcessing ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isListening ? (
          // Microphone active icon
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        ) : (
          // Microphone icon
          <svg
            className="w-6 h-6 text-cscx-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>

      {/* Listening Indicator Ring */}
      {isListening && (
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 rounded-full bg-cscx-accent/20 animate-ping" />
        </div>
      )}

      {/* Stop Speaking Button */}
      {isSpeaking && (
        <button
          onClick={stopSpeaking}
          className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-600 hover:bg-yellow-700 rounded-full flex items-center justify-center shadow-lg"
          aria-label="Stop speaking"
        >
          <span className="w-2 h-2 bg-white rounded-sm" />
        </button>
      )}
    </div>
  );
};

export default VoiceCommandButton;
