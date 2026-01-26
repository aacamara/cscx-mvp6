import { useState } from 'react';
import type { CSAgentType } from '../../../../types/agents';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AIEnhanceButtonProps {
  text: string;
  onEnhanced: (enhancedText: string) => void;
  context?: {
    type: 'email' | 'meeting_description' | 'document';
    customerName?: string;
    tone?: 'professional' | 'friendly' | 'formal' | 'casual';
    agentType?: CSAgentType;
    additionalContext?: string;
  };
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function AIEnhanceButton({
  text,
  onEnhanced,
  context = { type: 'email' },
  disabled = false,
  size = 'md',
}: AIEnhanceButtonProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleEnhance = async () => {
    if (!text.trim() || isEnhancing) return;

    setIsEnhancing(true);

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/workspace/ai/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {})
        },
        body: JSON.stringify({ text, context }),
      });

      if (!response.ok) {
        throw new Error('Enhancement failed');
      }

      const data = await response.json();
      onEnhanced(data.enhanced);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('AI enhance error:', error);
      // Fallback: basic enhancement simulation
      const enhanced = simulateEnhancement(text, context);
      onEnhanced(enhanced);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <button
      className={`ai-enhance-btn ai-enhance-btn-${size} ${isEnhancing ? 'enhancing' : ''} ${showSuccess ? 'success' : ''}`}
      onClick={handleEnhance}
      disabled={disabled || !text.trim() || isEnhancing}
      title="Enhance with AI"
    >
      {isEnhancing ? (
        <>
          <span className="enhance-spinner" />
          <span>Enhancing...</span>
        </>
      ) : showSuccess ? (
        <>
          <span className="enhance-icon">✓</span>
          <span>Enhanced!</span>
        </>
      ) : (
        <>
          <span className="enhance-icon">✨</span>
          <span>AI Enhance</span>
        </>
      )}
    </button>
  );
}

// Fallback simulation when API is unavailable
function simulateEnhancement(
  text: string,
  context: AIEnhanceButtonProps['context']
): string {
  // Basic enhancements based on context
  let enhanced = text;

  // Capitalize first letter of sentences
  enhanced = enhanced.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) =>
    p1 + p2.toUpperCase()
  );

  // Add professional closings if missing
  if (context?.type === 'email' && !enhanced.toLowerCase().includes('best') && !enhanced.toLowerCase().includes('regards')) {
    enhanced = enhanced.trim() + '\n\nBest regards';
  }

  // Ensure proper punctuation at end
  if (!/[.!?]$/.test(enhanced.trim())) {
    enhanced = enhanced.trim() + '.';
  }

  // Add greeting if missing for emails
  if (context?.type === 'email' && !enhanced.toLowerCase().startsWith('hi') && !enhanced.toLowerCase().startsWith('hello') && !enhanced.toLowerCase().startsWith('dear')) {
    enhanced = 'Hi,\n\n' + enhanced;
  }

  return enhanced;
}
