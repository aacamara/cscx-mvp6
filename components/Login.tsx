/**
 * Login Component
 * Google OAuth sign-in for CSCX.AI with invite code gating
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;

// Admin emails bypass invite code
const ADMIN_EMAILS = ['azizcamara2@gmail.com'];

interface LoginProps {
  onDemoMode?: () => void;
}

interface InviteValidation {
  valid: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  inviteId: string;
}

export function Login({ onDemoMode }: LoginProps) {
  const { signInWithGoogle, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [validatedInvite, setValidatedInvite] = useState<InviteValidation | null>(null);

  const handleValidateInviteCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setError(null);
    setIsValidatingCode(true);

    try {
      const response = await fetch(`${API_BASE}/auth/validate-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError(data.error?.message || 'Invalid invite code');
        setIsValidatingCode(false);
        return;
      }

      // Store invite info for after OAuth
      localStorage.setItem('pendingInvite', JSON.stringify({
        inviteId: data.inviteId,
        workspaceId: data.workspace.id,
        workspaceName: data.workspace.name,
      }));

      setValidatedInvite(data);
    } catch (err) {
      setError('Failed to validate invite code. Please try again.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      setError('Authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setError(null);
    setIsSigningIn(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cscx-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cscx-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          CSCX<span className="text-cscx-accent">.AI</span>
        </h1>
        <p className="text-gray-400 text-lg">
          AI-Powered Customer Success Platform
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-cscx-gray-900 rounded-xl border border-gray-800 p-8">
        <h2 className="text-2xl font-semibold text-white text-center mb-2">
          {validatedInvite ? 'Welcome!' : 'Enter Invite Code'}
        </h2>
        <p className="text-gray-400 text-center mb-8">
          {validatedInvite
            ? `You're joining ${validatedInvite.workspace.name}`
            : 'CSCX.AI is invite-only. Enter your code to continue.'}
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Invite Code Input */}
        {!validatedInvite && (
          <div className="space-y-4">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidateInviteCode()}
              placeholder="Enter invite code"
              className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent"
              disabled={isValidatingCode}
            />
            <button
              onClick={handleValidateInviteCode}
              disabled={isValidatingCode || !inviteCode.trim()}
              className="w-full bg-cscx-accent hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidatingCode ? 'Validating...' : 'Continue'}
            </button>

            {/* Admin Login - bypasses invite code */}
            <div className="pt-4 border-t border-gray-800">
              <button
                onClick={() => {
                  localStorage.setItem('adminLoginAttempt', 'true');
                  handleGoogleSignIn();
                }}
                disabled={isSigningIn}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
              >
                Admin? Sign in with Google
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Google Sign In (after valid invite code) */}
        {validatedInvite && (
          <>
            {/* Success indicator */}
            <div className="mb-6 p-4 bg-green-900/30 border border-green-800 rounded-lg">
              <p className="text-green-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Invite code verified! Sign in to complete setup.
              </p>
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-gray-900"></div>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>{isSigningIn ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            {/* Back button */}
            <button
              onClick={() => {
                setValidatedInvite(null);
                setInviteCode('');
                localStorage.removeItem('pendingInvite');
              }}
              className="w-full mt-3 text-gray-400 hover:text-white text-sm py-2 transition-colors"
            >
              Use a different invite code
            </button>
          </>
        )}

        {/* Workspace Permissions Info */}
        <div className="mt-6 p-4 bg-cscx-gray-800 rounded-lg">
          <p className="text-sm text-gray-400 mb-3">
            Sign in with Google to enable:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-gray-300">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Gmail - Draft and send customer emails
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Calendar - Schedule meetings with Meet links
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Drive - Access customer documents
            </li>
          </ul>
        </div>

        {/* Demo Mode Option */}
        {onDemoMode && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <button
              onClick={onDemoMode}
              className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors"
            >
              Continue without sign in (Demo Mode)
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default Login;
