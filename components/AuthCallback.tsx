/**
 * Auth Callback Component
 * Handles OAuth redirect after Google sign-in
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;

// Admin emails get auto-provisioned with admin role
const ADMIN_EMAILS = ['azizcamara2@gmail.com'];
const DEFAULT_WORKSPACE_ID = 'a0000000-0000-0000-0000-000000000001';

interface AuthCallbackProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

async function handleUserSetup(session: { user: { id: string; email?: string }; access_token: string }) {
  const pendingInvite = localStorage.getItem('pendingInvite');
  const isAdminAttempt = localStorage.getItem('adminLoginAttempt');
  const userEmail = session.user.email?.toLowerCase() || '';

  // Clean up localStorage flags
  localStorage.removeItem('adminLoginAttempt');

  // Check if admin email
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  if (isAdmin) {
    // Auto-provision admin
    try {
      await fetch(`${API_BASE}/auth/provision-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          email: userEmail,
          workspaceId: DEFAULT_WORKSPACE_ID,
        }),
      });
    } catch (err) {
      console.error('Failed to provision admin:', err);
    }
    return;
  }

  // Non-admin: must have pending invite
  if (!pendingInvite) {
    console.warn('Non-admin user without invite code');
    return;
  }

  try {
    const invite = JSON.parse(pendingInvite);

    // Call backend to redeem invite and set up user
    const response = await fetch(`${API_BASE}/auth/redeem-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        inviteId: invite.inviteId,
        workspaceId: invite.workspaceId,
        userId: session.user.id,
        email: session.user.email,
      }),
    });

    if (response.ok) {
      localStorage.removeItem('pendingInvite');
    }
  } catch (err) {
    console.error('Failed to redeem invite:', err);
  }
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
          // Handle user setup (admin or invite redemption)
          await handleUserSetup(data.session);

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

          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
              clearTimeout(timeout);

              // Handle user setup (admin or invite redemption)
              await handleUserSetup(session);

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
