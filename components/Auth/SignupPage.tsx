/**
 * Signup Page Component
 * Post-OAuth flow for users without an organization.
 * Provides two paths: create a new organization or join with an invite code.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SignupPageProps {
  onOrgJoined: (orgId: string) => void;
}

type FlowMode = 'choose' | 'create' | 'join';

interface CreateOrgForm {
  name: string;
  slug: string;
}

interface ApiError {
  message: string;
  code?: string;
}

/**
 * Generates a URL-safe slug from an organization name.
 * Converts to lowercase, replaces spaces and special characters with hyphens,
 * removes consecutive hyphens, and trims leading/trailing hyphens.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function SignupPage({ onOrgJoined }: SignupPageProps) {
  const { user, getAuthHeaders } = useAuth();

  const [mode, setMode] = useState<FlowMode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create org form state
  const [createForm, setCreateForm] = useState<CreateOrgForm>({ name: '', slug: '' });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Join org form state
  const [inviteCode, setInviteCode] = useState('');

  // Derive the slug from the name unless the user has manually edited it
  const effectiveSlug = useMemo(() => {
    if (slugManuallyEdited) return createForm.slug;
    return generateSlug(createForm.name);
  }, [createForm.name, createForm.slug, slugManuallyEdited]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCreateForm((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : generateSlug(name),
    }));
    setError(null);
  }, [slugManuallyEdited]);

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlugManuallyEdited(true);
    setCreateForm((prev) => ({ ...prev, slug: rawSlug }));
    setError(null);
  }, []);

  const resetState = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
    setLoading(false);
  }, []);

  const handleModeChange = useCallback((newMode: FlowMode) => {
    resetState();
    setMode(newMode);
  }, [resetState]);

  const handleCreateOrg = useCallback(async () => {
    const name = createForm.name.trim();
    const slug = effectiveSlug;

    if (!name) {
      setError('Organization name is required.');
      return;
    }

    if (name.length < 2) {
      setError('Organization name must be at least 2 characters.');
      return;
    }

    if (!slug) {
      setError('Organization slug is required.');
      return;
    }

    if (slug.length < 2) {
      setError('Slug must be at least 2 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/organizations/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name, slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError = data as ApiError;
        setError(apiError.message || 'Failed to create organization. Please try again.');
        return;
      }

      const orgId = data.organization?.id || data.organizationId || data.id;
      if (!orgId) {
        setError('Organization created but no ID was returned. Please refresh and try again.');
        return;
      }

      setSuccessMessage(`Organization "${name}" created successfully!`);

      // Brief delay so user can see the success message before redirect
      setTimeout(() => {
        onOrgJoined(orgId);
      }, 800);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [createForm.name, effectiveSlug, getAuthHeaders, onOrgJoined]);

  const handleJoinWithCode = useCallback(async () => {
    const code = inviteCode.trim();

    if (!code) {
      setError('Please enter an invite code.');
      return;
    }

    if (code.length < 6) {
      setError('Invite code must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/organizations/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError = data as ApiError;

        const errorMessages: Record<string, string> = {
          INVALID_CODE: 'Invalid invite code. Please check and try again.',
          EXPIRED_CODE: 'This invite code has expired.',
          CODE_EXHAUSTED: 'This invite code has reached its maximum uses.',
          ALREADY_MEMBER: 'You are already a member of this organization.',
        };

        const errorCode = apiError.code || (data as { error?: { code?: string } }).error?.code;
        setError(
          (errorCode && errorMessages[errorCode]) ||
          apiError.message ||
          'Failed to join organization. Please check your code and try again.'
        );
        return;
      }

      const orgId = data.organization?.id || data.organizationId || data.id;
      if (!orgId) {
        setError('Joined organization but no ID was returned. Please refresh and try again.');
        return;
      }

      setSuccessMessage('Successfully joined the organization!');

      setTimeout(() => {
        onOrgJoined(orgId);
      }, 800);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [inviteCode, getAuthHeaders, onOrgJoined]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        if (mode === 'create') handleCreateOrg();
        if (mode === 'join') handleJoinWithCode();
      }
    },
    [loading, mode, handleCreateOrg, handleJoinWithCode]
  );

  return (
    <div className="min-h-screen bg-cscx-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          CSCX<span className="text-cscx-accent">.AI</span>
        </h1>
        <p className="text-gray-400 text-lg">Set Up Your Organization</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-cscx-gray-900 rounded-xl border border-gray-800 p-8">
        {/* Greeting */}
        {user?.email && (
          <p className="text-gray-400 text-sm text-center mb-6">
            Signed in as <span className="text-white">{user.email}</span>
          </p>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-800 rounded-lg">
            <p className="text-green-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Mode: Choose */}
        {mode === 'choose' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white text-center mb-2">
              Welcome to CSCX.AI
            </h2>
            <p className="text-gray-400 text-center text-sm mb-6">
              Create a new organization or join an existing one with an invite code.
            </p>

            <button
              onClick={() => handleModeChange('create')}
              className="w-full flex items-center gap-4 bg-cscx-gray-800 hover:bg-cscx-gray-800/80 border border-gray-700 hover:border-cscx-accent rounded-lg p-4 transition-colors group"
            >
              <div className="w-10 h-10 bg-cscx-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-cscx-accent/30 transition-colors">
                <svg className="w-5 h-5 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Create Organization</p>
                <p className="text-gray-500 text-sm">Start a new workspace for your team</p>
              </div>
            </button>

            <button
              onClick={() => handleModeChange('join')}
              className="w-full flex items-center gap-4 bg-cscx-gray-800 hover:bg-cscx-gray-800/80 border border-gray-700 hover:border-cscx-accent rounded-lg p-4 transition-colors group"
            >
              <div className="w-10 h-10 bg-cscx-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-cscx-accent/30 transition-colors">
                <svg className="w-5 h-5 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Join with Invite Code</p>
                <p className="text-gray-500 text-sm">Enter a code from your organization admin</p>
              </div>
            </button>
          </div>
        )}

        {/* Mode: Create Organization */}
        {mode === 'create' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => handleModeChange('choose')}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-white">Create Organization</h2>
            </div>

            {/* Organization Name */}
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium text-gray-300 mb-2">
                Organization Name
              </label>
              <input
                id="org-name"
                type="text"
                value={createForm.name}
                onChange={handleNameChange}
                onKeyDown={handleKeyDown}
                placeholder="Acme Corp"
                disabled={loading}
                className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="org-slug" className="block text-sm font-medium text-gray-300 mb-2">
                URL Slug
              </label>
              <div className="flex items-center gap-0">
                <span className="bg-cscx-gray-800 border border-r-0 border-gray-700 rounded-l-lg px-3 py-3 text-gray-500 text-sm select-none">
                  cscx.ai/
                </span>
                <input
                  id="org-slug"
                  type="text"
                  value={effectiveSlug}
                  onChange={handleSlugChange}
                  onKeyDown={handleKeyDown}
                  placeholder="acme-corp"
                  disabled={loading}
                  className="w-full bg-cscx-gray-800 border border-gray-700 rounded-r-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleCreateOrg}
              disabled={loading || !createForm.name.trim() || !effectiveSlug}
              className="w-full bg-cscx-accent hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </button>
          </div>
        )}

        {/* Mode: Join with Invite Code */}
        {mode === 'join' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => handleModeChange('choose')}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-white">Join Organization</h2>
            </div>

            <p className="text-gray-400 text-sm">
              Enter the invite code you received from your organization administrator.
            </p>

            {/* Invite Code Input */}
            <div>
              <label htmlFor="invite-code" className="block text-sm font-medium text-gray-300 mb-2">
                Invite Code
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="PARTNER-2026-XXXX"
                disabled={loading}
                className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-lg tracking-widest font-mono placeholder-gray-500 placeholder:text-sm placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-cscx-accent disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleJoinWithCode}
              disabled={loading || !inviteCode.trim()}
              className="w-full bg-cscx-accent hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Organization'
              )}
            </button>
          </div>
        )}

        {/* Help */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <p className="text-center text-gray-500 text-xs">
            Need help?{' '}
            <a href="mailto:support@cscx.ai" className="text-cscx-accent hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
