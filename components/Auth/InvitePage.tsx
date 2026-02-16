/**
 * Invite Page Component
 * Admin-only page for generating and managing organization invite codes.
 * Allows creating invite codes with role, max uses, and expiration settings.
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface InvitePageProps {
  organizationId: string;
}

type InviteRole = 'csm' | 'viewer';

interface InviteFormState {
  role: InviteRole;
  maxUses: number;
  expiresInDays: number;
}

interface GeneratedInvite {
  code: string;
  role: InviteRole;
  maxUses: number;
  expiresAt: string;
  createdAt: string;
}

const ROLE_OPTIONS: { value: InviteRole; label: string; description: string }[] = [
  { value: 'csm', label: 'CSM', description: 'Full access to customer success features' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards and reports' },
];

const EXPIRATION_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export function InvitePage({ organizationId }: InvitePageProps) {
  const { getAuthHeaders } = useAuth();

  const [form, setForm] = useState<InviteFormState>({
    role: 'csm',
    maxUses: 1,
    expiresInDays: 7,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track all generated invites for this session
  const [generatedInvites, setGeneratedInvites] = useState<GeneratedInvite[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleGenerateInvite = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/organizations/${organizationId}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            role: form.role,
            maxUses: form.maxUses,
            expiresInDays: form.expiresInDays,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error?.message || 'Failed to generate invite code.');
        return;
      }

      const invite: GeneratedInvite = {
        code: data.code,
        role: form.role,
        maxUses: form.maxUses,
        expiresAt: data.expiresAt || new Date(Date.now() + form.expiresInDays * 86400000).toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
      };

      setGeneratedInvites((prev) => [invite, ...prev]);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, form, getAuthHeaders]);

  const handleCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }, []);

  const formatDate = (isoDate: string): string => {
    try {
      return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="min-h-screen bg-cscx-black p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Invite Codes</h1>
          <p className="text-gray-400">
            Generate invite codes to add team members to your organization.
          </p>
        </div>

        {/* Generate Invite Card */}
        <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6">Generate New Invite</h2>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            {/* Role Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setForm((prev) => ({ ...prev, role: option.value }))}
                    disabled={loading}
                    className={`p-4 rounded-lg border text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      form.role === option.value
                        ? 'border-cscx-accent bg-cscx-accent/10'
                        : 'border-gray-700 bg-cscx-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <p
                      className={`font-medium text-sm ${
                        form.role === option.value ? 'text-cscx-accent' : 'text-white'
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Uses */}
            <div>
              <label htmlFor="max-uses" className="block text-sm font-medium text-gray-300 mb-2">
                Maximum Uses
              </label>
              <input
                id="max-uses"
                type="number"
                min={1}
                max={100}
                value={form.maxUses}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 100) {
                    setForm((prev) => ({ ...prev, maxUses: val }));
                  }
                }}
                disabled={loading}
                className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cscx-accent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-gray-500 text-xs mt-1">
                How many people can use this code (1-100).
              </p>
            </div>

            {/* Expiration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Expires In
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPIRATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setForm((prev) => ({ ...prev, expiresInDays: option.value }))}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      form.expiresInDays === option.value
                        ? 'border-cscx-accent bg-cscx-accent/10 text-cscx-accent'
                        : 'border-gray-700 bg-cscx-gray-800 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateInvite}
              disabled={loading}
              className="w-full bg-cscx-accent hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Generate Invite Code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Invites List */}
        {generatedInvites.length > 0 && (
          <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-8">
            <h2 className="text-xl font-semibold text-white mb-6">
              Generated Codes
              <span className="text-gray-500 text-sm font-normal ml-2">
                ({generatedInvites.length})
              </span>
            </h2>

            <div className="space-y-4">
              {generatedInvites.map((invite, index) => (
                <div
                  key={`${invite.code}-${index}`}
                  className="bg-cscx-gray-800 border border-gray-700 rounded-lg p-4"
                >
                  {/* Code Row */}
                  <div className="flex items-center justify-between mb-3">
                    <code className="text-lg font-mono text-white tracking-wider">
                      {invite.code}
                    </code>
                    <button
                      onClick={() => handleCopyCode(invite.code)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        copiedCode === invite.code
                          ? 'bg-green-900/30 text-green-400 border border-green-800'
                          : 'bg-cscx-gray-900 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {copiedCode === invite.code ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Role: <span className="text-gray-300 capitalize">{invite.role}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                        />
                      </svg>
                      Max uses: <span className="text-gray-300">{invite.maxUses}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Expires: <span className="text-gray-300">{formatDate(invite.expiresAt)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {generatedInvites.length === 0 && (
          <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-8 text-center">
            <div className="w-12 h-12 bg-cscx-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-white font-medium mb-1">No invite codes yet</h3>
            <p className="text-gray-500 text-sm">
              Generate an invite code above to start adding team members.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvitePage;
