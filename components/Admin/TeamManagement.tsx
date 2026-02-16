/**
 * Team Management Component
 * Admin UI for managing team members, assigning roles, and mapping customers to CSMs.
 * Only admins can modify roles and deactivate members.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'csm' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  assignedCustomerCount: number;
  avatarUrl?: string;
  lastActiveAt?: string;
}

interface OrgCustomer {
  id: string;
  name: string;
}

interface InviteResult {
  inviteCode: string;
  expiresAt: string;
  maxUses: number;
}

interface TeamManagementProps {
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ROLE_OPTIONS: Array<{ value: TeamMember['role']; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'csm', label: 'CSM' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_BADGE_CLASSES: Record<TeamMember['role'], string> = {
  admin: 'bg-red-900/40 text-red-400 border border-red-800',
  csm: 'bg-blue-900/40 text-blue-400 border border-blue-800',
  viewer: 'bg-gray-700/60 text-gray-400 border border-gray-600',
};

const STATUS_DOT_CLASSES: Record<TeamMember['status'], string> = {
  active: 'bg-green-400',
  inactive: 'bg-gray-500',
  pending: 'bg-yellow-400 animate-pulse',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Overlay backdrop for modals */
function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      onClick={onClick}
    />
  );
}

/** Reusable modal shell */
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl shadow-2xl w-full ${
            wide ? 'max-w-lg' : 'max-w-md'
          } animate-fadeIn`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-cscx-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          {/* Body */}
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </>
  );
}

/** Confirmation modal for deactivation */
function DeactivateConfirmModal({
  member,
  onConfirm,
  onCancel,
  processing,
}: {
  member: TeamMember;
  onConfirm: () => void;
  onCancel: () => void;
  processing: boolean;
}) {
  return (
    <Modal title="Deactivate Team Member" onClose={onCancel}>
      <p className="text-gray-300 text-sm mb-1">
        Are you sure you want to deactivate{' '}
        <span className="text-white font-medium">{member.name}</span>?
      </p>
      <p className="text-gray-500 text-xs mb-6">
        This will revoke their access to the organization. Any customers
        currently assigned to them will need to be reassigned.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          disabled={processing}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={processing}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
        >
          {processing ? 'Deactivating...' : 'Deactivate'}
        </button>
      </div>
    </Modal>
  );
}

/** Invite member modal */
function InviteModal({
  organizationId,
  getAuthHeaders,
  onClose,
}: {
  organizationId: string;
  getAuthHeaders: () => Record<string, string>;
  onClose: () => void;
}) {
  const [role, setRole] = useState<TeamMember['role']>('csm');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
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
          body: JSON.stringify({ role, maxUses, expiresInDays }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create invite (${response.status})`);
      }
      const data = await response.json();
      setInviteResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = inviteResult.inviteCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal title="Invite Team Member" onClose={onClose} wide>
      {inviteResult ? (
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            Share this invite code with the new team member:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-cscx-black border border-cscx-gray-800 rounded-lg text-cscx-accent font-mono text-sm select-all break-all">
              {inviteResult.inviteCode}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 px-4 py-3 text-sm font-medium bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              Expires:{' '}
              {new Date(inviteResult.expiresAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p>Max uses: {inviteResult.maxUses}</p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-900/30 text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamMember['role'])}
              className="w-full px-3 py-2 bg-cscx-black border border-cscx-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent transition-colors"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Max uses */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Max uses
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 bg-cscx-black border border-cscx-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent transition-colors"
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Expires in (days)
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-cscx-black border border-cscx-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent transition-colors"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-cscx-accent hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Invite'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Customer assignment panel (shown when a CSM row is expanded) */
function CustomerAssignmentPanel({
  member,
  getAuthHeaders,
  onAssignmentChange,
}: {
  member: TeamMember;
  getAuthHeaders: () => Record<string, string>;
  onAssignmentChange: () => void;
}) {
  const [allCustomers, setAllCustomers] = useState<OrgCustomer[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all org customers + current assignments in parallel
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [customersRes, assignmentsRes] = await Promise.all([
          fetch(`${API_URL}/api/customers`, {
            headers: getAuthHeaders(),
          }),
          fetch(`${API_URL}/api/team/${member.id}/customers`, {
            headers: getAuthHeaders(),
          }),
        ]);

        if (!customersRes.ok) throw new Error('Failed to load customers');
        if (!assignmentsRes.ok) throw new Error('Failed to load assignments');

        const customersData = await customersRes.json();
        const assignmentsData = await assignmentsRes.json();

        if (cancelled) return;

        // Normalize: API may return { customers: [...] } or [...]
        const customersList: OrgCustomer[] = Array.isArray(customersData)
          ? customersData
          : customersData.customers || [];
        const assignedList: string[] = Array.isArray(assignmentsData)
          ? assignmentsData.map((c: any) => c.id || c)
          : assignmentsData.customerIds || [];

        setAllCustomers(customersList);
        setAssignedIds(new Set(assignedList));
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [member.id, getAuthHeaders]);

  const toggleCustomer = (customerId: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `${API_URL}/api/team/${member.id}/assign-customers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ customerIds: Array.from(assignedIds) }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to save assignments (${response.status})`);
      }

      setSuccess(true);
      onAssignmentChange();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = searchQuery
    ? allCustomers.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allCustomers;

  if (loading) {
    return (
      <div className="px-6 py-4 bg-cscx-black/50">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading customer assignments...
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-cscx-black/50 border-t border-cscx-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">
          Customer Assignments for{' '}
          <span className="text-white">{member.name}</span>
        </h4>
        <span className="text-xs text-gray-500">
          {assignedIds.size} of {allCustomers.length} assigned
        </span>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-900/30 text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-3 px-3 py-2 bg-green-900/30 text-green-400 text-sm rounded-lg">
          Assignments saved successfully.
        </div>
      )}

      {/* Search */}
      {allCustomers.length > 5 && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cscx-accent transition-colors"
          />
        </div>
      )}

      {/* Customer checkboxes */}
      {allCustomers.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">
          No customers in this organization yet.
        </p>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {filteredCustomers.map((customer) => (
            <label
              key={customer.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-cscx-gray-900 cursor-pointer transition-colors group"
            >
              <input
                type="checkbox"
                checked={assignedIds.has(customer.id)}
                onChange={() => toggleCustomer(customer.id)}
                className="w-4 h-4 rounded border-gray-600 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                {customer.name}
              </span>
            </label>
          ))}
          {filteredCustomers.length === 0 && searchQuery && (
            <p className="text-sm text-gray-500 py-2 px-3">
              No customers match "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {/* Save button */}
      {allCustomers.length > 0 && (
        <div className="flex justify-end mt-4 pt-3 border-t border-cscx-gray-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-cscx-accent hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const TeamManagement: React.FC<TeamManagementProps> = ({
  organizationId,
}) => {
  const { isAdmin, getAuthHeaders } = useAuth();

  // Core state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roleChangeLoading, setRoleChangeLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchMembers = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/team`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to load team (${response.status})`);
      }
      const data = await response.json();
      // Normalize: API may return { members: [...] } or [...]
      const list: TeamMember[] = Array.isArray(data) ? data : data.members || [];
      setMembers(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRoleChange = async (memberId: string, newRole: TeamMember['role']) => {
    setRoleChangeLoading(memberId);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/team/${memberId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update role (${response.status})`);
      }

      // Optimistic update
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      showSuccess('Role updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/team/${deactivateTarget.id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to deactivate member (${response.status})`);
      }

      // Remove from local state
      setMembers((prev) => prev.filter((m) => m.id !== deactivateTarget.id));
      setDeactivateTarget(null);

      // Collapse assignment panel if it was expanded for this member
      if (expandedMemberId === deactivateTarget.id) {
        setExpandedMemberId(null);
      }

      showSuccess(`${deactivateTarget.name} has been deactivated`);
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate member');
    } finally {
      setDeactivating(false);
    }
  };

  const toggleExpanded = (memberId: string) => {
    setExpandedMemberId((prev) => (prev === memberId ? null : memberId));
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // -------------------------------------------------------------------------
  // Render: Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-cscx-gray-800">
          <div className="h-6 w-48 bg-cscx-gray-800 rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-cscx-gray-800/50 rounded-lg animate-pulse"
            >
              <div className="w-10 h-10 bg-cscx-gray-700 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-cscx-gray-700 rounded" />
                <div className="h-3 w-56 bg-cscx-gray-700 rounded" />
              </div>
              <div className="h-6 w-16 bg-cscx-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Error state (full-page, only when no members loaded)
  // -------------------------------------------------------------------------

  if (error && members.length === 0) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-cscx-gray-800">
          <h2 className="text-lg font-semibold text-white">Team Management</h2>
        </div>
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-900/30 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchMembers();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Main
  // -------------------------------------------------------------------------

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cscx-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Team Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''} in this
            organization
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cscx-accent hover:bg-red-500 rounded-lg transition-colors shadow-accent-glow"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Inline banners */}
      {successMessage && (
        <div className="px-6 py-3 bg-green-900/20 border-b border-green-900/30 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-green-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-green-400 text-sm">{successMessage}</span>
        </div>
      )}

      {error && members.length > 0 && (
        <div className="px-6 py-3 bg-red-900/20 border-b border-red-900/30 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-red-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01"
            />
          </svg>
          <span className="text-red-400 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400 text-sm transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 && !loading && (
        <div className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cscx-gray-800 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>
          <p className="text-gray-400 text-sm mb-1">No team members yet</p>
          <p className="text-gray-600 text-xs">
            Invite your first team member to get started.
          </p>
        </div>
      )}

      {/* Member table */}
      {members.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-center">
                  Customers
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {members.map((member) => {
                const isExpanded = expandedMemberId === member.id;
                const isCsm = member.role === 'csm';

                return (
                  <React.Fragment key={member.id}>
                    {/* Member row */}
                    <tr
                      className={`transition-colors ${
                        isCsm
                          ? 'hover:bg-cscx-gray-800/40 cursor-pointer'
                          : 'hover:bg-cscx-gray-800/20'
                      } ${isExpanded ? 'bg-cscx-gray-800/30' : ''}`}
                      onClick={() => {
                        if (isCsm) toggleExpanded(member.id);
                      }}
                    >
                      {/* Name / Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-9 h-9 rounded-full object-cover border border-cscx-gray-700"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-cscx-gray-800 border border-cscx-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300">
                              {initials(member.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">
                              {member.name}
                            </div>
                            <div className="text-gray-500 text-xs truncate">
                              {member.email}
                            </div>
                          </div>
                          {/* Expand indicator for CSMs */}
                          {isCsm && (
                            <svg
                              className={`w-4 h-4 text-gray-500 ml-1 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <div className="relative inline-block">
                            <select
                              value={member.role}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleRoleChange(
                                  member.id,
                                  e.target.value as TeamMember['role']
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                              disabled={roleChangeLoading === member.id}
                              className={`appearance-none px-3 py-1 pr-7 text-xs font-medium rounded-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-cscx-accent transition-colors ${
                                ROLE_BADGE_CLASSES[member.role]
                              } ${
                                roleChangeLoading === member.id
                                  ? 'opacity-50 cursor-wait'
                                  : ''
                              } bg-transparent`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 6px center',
                                backgroundSize: '14px',
                              }}
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option
                                  key={opt.value}
                                  value={opt.value}
                                  className="bg-cscx-gray-900 text-white"
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                              ROLE_BADGE_CLASSES[member.role]
                            }`}
                          >
                            {member.role.toUpperCase()}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              STATUS_DOT_CLASSES[member.status]
                            }`}
                          />
                          <span className="text-gray-300 text-sm capitalize">
                            {member.status}
                          </span>
                        </div>
                      </td>

                      {/* Assigned Customers */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-300 font-mono text-sm">
                          {member.assignedCustomerCount}
                        </span>
                      </td>

                      {/* Actions (admin only) */}
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeactivateTarget(member);
                            }}
                            disabled={member.status === 'inactive'}
                            className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-900/40 hover:border-red-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Deactivate
                          </button>
                        </td>
                      )}
                    </tr>

                    {/* Expanded assignment panel */}
                    {isExpanded && isCsm && (
                      <tr>
                        <td
                          colSpan={isAdmin ? 5 : 4}
                          className="p-0"
                        >
                          <CustomerAssignmentPanel
                            member={member}
                            getAuthHeaders={getAuthHeaders}
                            onAssignmentChange={fetchMembers}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivate confirmation modal */}
      {deactivateTarget && (
        <DeactivateConfirmModal
          member={deactivateTarget}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
          processing={deactivating}
        />
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          organizationId={organizationId}
          getAuthHeaders={getAuthHeaders}
          onClose={() => {
            setShowInviteModal(false);
            fetchMembers();
          }}
        />
      )}
    </div>
  );
};

export default TeamManagement;
