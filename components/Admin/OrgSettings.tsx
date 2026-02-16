/**
 * Organization Settings Component
 * Admin-only panel for managing organization name, slug, plan, and settings.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface OrgDetails {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  memberCount: number;
  createdAt: string;
}

interface OrgSettingsProps {
  organizationId: string;
}

export function OrgSettings({ organizationId }: OrgSettingsProps) {
  const { getAuthHeaders, isAdmin } = useAuth();
  const [org, setOrg] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState('');

  useEffect(() => {
    fetchOrgDetails();
  }, [organizationId]);

  const fetchOrgDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/organizations/${organizationId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch organization');
      const data = await response.json();
      setOrg(data.organization || data);
      setName(data.organization?.name || data.name || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/organizations/${organizationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to update');
      }

      setSuccess('Organization updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchOrgDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-400">
        Only admins can manage organization settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Organization Settings</h2>
        <p className="text-gray-400 text-sm mt-1">Manage your organization details and preferences</p>
      </div>

      {/* Error/Success */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Organization Details */}
      <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Organization Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent"
          />
        </div>

        {/* Slug (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">app.cscx.ai/</span>
            <input
              type="text"
              value={org?.slug || ''}
              disabled
              className="flex-1 bg-cscx-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-400 cursor-not-allowed"
            />
          </div>
          <p className="text-gray-500 text-xs mt-1">Slug cannot be changed after creation</p>
        </div>

        {/* Plan */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Plan</label>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              org?.plan === 'enterprise' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' :
              org?.plan === 'pro' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
              'bg-gray-800 text-gray-300 border border-gray-700'
            }`}>
              {(org?.plan || 'free').charAt(0).toUpperCase() + (org?.plan || 'free').slice(1)}
            </span>
            <span className="text-gray-500 text-sm">
              {org?.memberCount || 0} member{(org?.memberCount || 0) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Created */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Created</label>
          <p className="text-gray-400 text-sm">
            {org?.createdAt ? new Date(org.createdAt).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            }) : 'Unknown'}
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving || name === org?.name}
            className="px-6 py-2.5 bg-cscx-accent hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-cscx-gray-900 rounded-xl border border-red-900/50 p-6">
        <h3 className="text-lg font-medium text-red-400 mb-2">Danger Zone</h3>
        <p className="text-gray-400 text-sm mb-4">
          These actions are irreversible. Please be certain.
        </p>
        <button
          disabled
          className="px-4 py-2 border border-red-800 text-red-400 rounded-lg text-sm opacity-50 cursor-not-allowed"
        >
          Delete Organization (Coming Soon)
        </button>
      </div>
    </div>
  );
}
