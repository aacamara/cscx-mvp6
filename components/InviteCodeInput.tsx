/**
 * PRD-1: Invite Code Input Component
 * Displays after OAuth for users without authorized access
 * Validates invite codes and binds users to workspaces
 */

import React, { useState, useCallback } from 'react';
import { trackInviteCodeEntered, trackInviteCodeValidated } from '../src/services/analytics';

interface InviteCodeInputProps {
  onSuccess: (workspaceId: string, workspaceName: string) => void;
  onCancel?: () => void;
  userEmail?: string;
}

interface ValidationResult {
  valid: boolean;
  workspace?: {
    id: string;
    name: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const InviteCodeInput: React.FC<InviteCodeInputProps> = ({
  onSuccess,
  onCancel,
  userEmail
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const validateCode = useCallback(async () => {
    if (!code.trim()) {
      setError('Please enter an invite code');
      return;
    }

    if (code.length < 6) {
      setError('Invite code must be at least 6 characters');
      return;
    }

    // Track invite code entry
    trackInviteCodeEntered(code);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/validate-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Track invalid code
        trackInviteCodeValidated(false, code);

        const errorMessages: Record<string, string> = {
          'INVALID_CODE': 'Invalid invite code. Please check and try again.',
          'EXPIRED_CODE': 'This invite code has expired.',
          'CODE_EXHAUSTED': 'This invite code has reached its maximum uses.',
          'RATE_LIMITED': 'Too many attempts. Please wait a minute and try again.',
        };

        setError(errorMessages[data.error?.code] || data.error?.message || 'Failed to validate code');
        setValidationResult(null);
        return;
      }

      // Track valid code
      trackInviteCodeValidated(true, code);

      // Code is valid - show workspace info
      setValidationResult({
        valid: true,
        workspace: data.workspace
      });

    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [code, API_URL]);

  const claimCode = useCallback(async () => {
    if (!validationResult?.workspace) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/claim-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to claim invite');
        return;
      }

      // Success - call onSuccess with workspace info
      onSuccess(
        validationResult.workspace.id,
        validationResult.workspace.name
      );

    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [code, validationResult, onSuccess, API_URL]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (validationResult?.valid) {
        claimCode();
      } else {
        validateCode();
      }
    }
  };

  return (
    <div className="min-h-screen bg-cscx-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            CSCX<span className="text-cscx-accent">.</span>AI
          </h1>
          <h2 className="text-xl text-cscx-gray-300">Enter Invite Code</h2>
          {userEmail && (
            <p className="text-sm text-cscx-gray-400 mt-2">
              Signed in as {userEmail}
            </p>
          )}
        </div>

        {/* Card */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          {/* Explanation */}
          <p className="text-cscx-gray-300 text-sm mb-6">
            CSCX.AI is currently in private beta. If you received an invite code
            from a design partner, enter it below to access the platform.
          </p>

          {/* Input */}
          <div className="mb-4">
            <label htmlFor="invite-code" className="block text-sm font-medium text-cscx-gray-300 mb-2">
              Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
                setValidationResult(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="PARTNER-2026-XXXX"
              disabled={loading || validationResult?.valid}
              className={`w-full px-4 py-3 bg-cscx-gray-800 border rounded-lg text-white text-center text-lg tracking-widest font-mono
                ${error ? 'border-red-500' : 'border-cscx-gray-700'}
                ${validationResult?.valid ? 'border-green-500 bg-green-900/20' : ''}
                focus:outline-none focus:border-cscx-accent
                disabled:opacity-50 disabled:cursor-not-allowed
                placeholder:text-cscx-gray-600 placeholder:tracking-normal placeholder:font-sans`}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success - Workspace Preview */}
          {validationResult?.valid && validationResult.workspace && (
            <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-400 font-medium">Code Valid</p>
                  <p className="text-cscx-gray-300 text-sm">
                    You will join: <span className="font-semibold text-white">{validationResult.workspace.name}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            {validationResult?.valid ? (
              <button
                onClick={claimCode}
                disabled={loading}
                className="w-full py-3 bg-cscx-accent hover:bg-cscx-accent/90 text-white font-semibold rounded-lg
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Workspace'
                )}
              </button>
            ) : (
              <button
                onClick={validateCode}
                disabled={loading || !code.trim()}
                className="w-full py-3 bg-cscx-accent hover:bg-cscx-accent/90 text-white font-semibold rounded-lg
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate Code'
                )}
              </button>
            )}

            {onCancel && (
              <button
                onClick={onCancel}
                disabled={loading}
                className="w-full py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-300 font-medium rounded-lg
                  transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Help Text */}
          <p className="text-center text-cscx-gray-500 text-xs mt-6">
            Don't have an invite code?{' '}
            <a href="mailto:support@cscx.ai" className="text-cscx-accent hover:underline">
              Request access
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default InviteCodeInput;
