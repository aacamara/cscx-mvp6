/**
 * Auth Callback Component
 * Handles OAuth redirect after Google sign-in
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthCallbackProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function AuthCallback({ onSuccess, onError }: AuthCallbackProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        setStatus('error');
        setMessage('Authentication not configured');
        onError?.('Authentication not configured');
        return;
      }

      try {
        // Supabase will automatically handle the OAuth callback
        // and extract tokens from the URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          setStatus('success');
          setMessage('Successfully signed in! Redirecting...');

          // Small delay before redirect for user feedback
          setTimeout(() => {
            onSuccess?.();
            window.location.href = '/';
          }, 1000);
        } else {
          // No session yet, wait for the auth state change
          const timeout = setTimeout(() => {
            setStatus('error');
            setMessage('Authentication timed out. Please try again.');
            onError?.('Authentication timed out');
          }, 10000);

          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              clearTimeout(timeout);
              setStatus('success');
              setMessage('Successfully signed in! Redirecting...');

              setTimeout(() => {
                onSuccess?.();
                window.location.href = '/';
              }, 1000);
            }
          });

          return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
          };
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');
        onError?.(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [onSuccess, onError]);

  return (
    <div className="min-h-screen bg-cscx-black flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* Logo */}
        <h1 className="text-3xl font-bold text-white mb-8">
          CSCX<span className="text-cscx-accent">.AI</span>
        </h1>

        {/* Status Indicator */}
        <div className="mb-6">
          {status === 'processing' && (
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cscx-accent border-t-transparent mx-auto"></div>
          )}
          {status === 'success' && (
            <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Message */}
        <p className={`text-lg ${status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
          {message}
        </p>

        {/* Retry Button */}
        {status === 'error' && (
          <button
            onClick={() => window.location.href = '/login'}
            className="mt-6 px-6 py-2 bg-cscx-accent hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
