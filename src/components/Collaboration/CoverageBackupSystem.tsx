/**
 * PRD-258: Coverage Backup System
 * React component for managing CSM absences, backup assignments, and coverage
 */

import React, { useState, useEffect } from 'react';

// ============================================
// Types
// ============================================

type AbsenceType = 'vacation' | 'sick' | 'conference' | 'parental' | 'other';
type AbsenceStatus = 'planned' | 'coverage_assigned' | 'active' | 'completed' | 'cancelled';
type AssignmentStatus = 'pending' | 'accepted' | 'declined' | 'active' | 'completed';

interface CSMAbsence {
  id: string;
  userId: string;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  isPartial: boolean;
  partialHours?: string;
  preferredBackupUserId?: string;
  specialInstructions?: string;
  status: AbsenceStatus;
  createdAt: string;
  updatedAt: string;
}

interface CoverageAssignment {
  id: string;
  absenceId: string;
  backupUserId: string;
  coverageType: 'full' | 'partial' | 'tiered';
  status: AssignmentStatus;
  tier: 1 | 2;
  actionsTaken: number;
  createdAt: string;
}

interface BackupSuggestion {
  userId: string;
  userName: string;
  userEmail: string;
  score: number;
  factors: {
    capacityScore: number;
    familiarityScore: number;
    skillMatchScore: number;
    preferenceScore: number;
  };
  availability: {
    currentAccountCount: number;
    maxAccountCount: number;
    isAvailable: boolean;
  };
}

interface CoverageBrief {
  id: string;
  customerId: string;
  briefContent: {
    customer: {
      name: string;
      arr: number;
      healthScore: number;
      stage: string;
    };
    urgentItems: Array<{
      id: string;
      type: string;
      description: string;
      dueDate: string;
      priority: string;
    }>;
    keyContacts: Array<{
      name: string;
      email: string;
      title?: string;
    }>;
    riskFlags: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
  };
  generatedAt: string;
  viewedAt?: string;
}

// ============================================
// Sub-components
// ============================================

interface AbsenceFormProps {
  onSubmit: (data: CreateAbsenceFormData) => void;
  onCancel: () => void;
}

interface CreateAbsenceFormData {
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  isPartial: boolean;
  partialHours?: string;
  preferredBackupUserId?: string;
  specialInstructions?: string;
}

const AbsenceForm: React.FC<AbsenceFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<CreateAbsenceFormData>({
    absenceType: 'vacation',
    startDate: '',
    endDate: '',
    isPartial: false,
    partialHours: '',
    specialInstructions: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Absence Type
        </label>
        <select
          value={formData.absenceType}
          onChange={(e) => setFormData({ ...formData, absenceType: e.target.value as AbsenceType })}
          className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cscx-accent focus:border-transparent"
        >
          <option value="vacation">Vacation</option>
          <option value="sick">Sick Leave</option>
          <option value="conference">Conference</option>
          <option value="parental">Parental Leave</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cscx-accent focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cscx-accent focus:border-transparent"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPartial"
          checked={formData.isPartial}
          onChange={(e) => setFormData({ ...formData, isPartial: e.target.checked })}
          className="rounded border-gray-700 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
        />
        <label htmlFor="isPartial" className="text-sm text-gray-300">
          Partial day absence
        </label>
      </div>

      {formData.isPartial && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Hours (e.g., "9am-12pm")
          </label>
          <input
            type="text"
            value={formData.partialHours || ''}
            onChange={(e) => setFormData({ ...formData, partialHours: e.target.value })}
            className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cscx-accent focus:border-transparent"
            placeholder="e.g., 9am-12pm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Special Instructions
        </label>
        <textarea
          value={formData.specialInstructions || ''}
          onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
          className="w-full bg-cscx-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cscx-accent focus:border-transparent"
          rows={3}
          placeholder="Any special instructions for your backup..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Log Absence
        </button>
      </div>
    </form>
  );
};

interface BackupSuggestionCardProps {
  suggestion: BackupSuggestion;
  onSelect: (userId: string) => void;
  selected?: boolean;
}

const BackupSuggestionCard: React.FC<BackupSuggestionCardProps> = ({
  suggestion,
  onSelect,
  selected,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        selected
          ? 'border-cscx-accent bg-cscx-accent/10'
          : 'border-gray-700 bg-cscx-gray-800 hover:border-gray-600'
      }`}
      onClick={() => onSelect(suggestion.userId)}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium text-white">{suggestion.userName}</div>
          <div className="text-sm text-gray-400">{suggestion.userEmail}</div>
        </div>
        <div className={`text-2xl font-bold ${getScoreColor(suggestion.score)}`}>
          {Math.round(suggestion.score)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Capacity:</span>
          <span className={getScoreColor(suggestion.factors.capacityScore)}>
            {Math.round(suggestion.factors.capacityScore)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Familiarity:</span>
          <span className={getScoreColor(suggestion.factors.familiarityScore)}>
            {Math.round(suggestion.factors.familiarityScore)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Skill Match:</span>
          <span className={getScoreColor(suggestion.factors.skillMatchScore)}>
            {Math.round(suggestion.factors.skillMatchScore)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Accounts:</span>
          <span className="text-gray-300">
            {suggestion.availability.currentAccountCount}/{suggestion.availability.maxAccountCount}
          </span>
        </div>
      </div>

      {suggestion.factors.preferenceScore > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-cscx-accent">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
          Preferred backup
        </div>
      )}
    </div>
  );
};

interface CoverageBriefCardProps {
  brief: CoverageBrief;
  onView: (briefId: string) => void;
}

const CoverageBriefCard: React.FC<CoverageBriefCardProps> = ({ brief, onView }) => {
  const { customer, urgentItems, keyContacts, riskFlags } = brief.briefContent;

  const getHealthColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="p-4 rounded-lg border border-gray-700 bg-cscx-gray-800">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-white">{customer.name}</h4>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>${(customer.arr / 1000).toFixed(0)}k ARR</span>
            <span className={getHealthColor(customer.healthScore)}>
              Health: {customer.healthScore}
            </span>
            <span className="capitalize">{customer.stage}</span>
          </div>
        </div>
        {!brief.viewedAt && (
          <span className="px-2 py-1 text-xs bg-cscx-accent/20 text-cscx-accent rounded">
            New
          </span>
        )}
      </div>

      {riskFlags.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Risk Signals</div>
          <div className="flex flex-wrap gap-1">
            {riskFlags.map((flag, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(flag.severity)}`}
              >
                {flag.type}
              </span>
            ))}
          </div>
        </div>
      )}

      {urgentItems.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">
            Urgent Items ({urgentItems.length})
          </div>
          <ul className="text-sm text-gray-300 space-y-1">
            {urgentItems.slice(0, 2).map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  item.priority === 'high' ? 'bg-red-400' : 'bg-yellow-400'
                }`} />
                {item.description}
              </li>
            ))}
            {urgentItems.length > 2 && (
              <li className="text-gray-500">+{urgentItems.length - 2} more</li>
            )}
          </ul>
        </div>
      )}

      {keyContacts.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Key Contacts</div>
          <div className="text-sm text-gray-300">
            {keyContacts.slice(0, 2).map((contact, i) => (
              <div key={i}>
                {contact.name} {contact.title && `(${contact.title})`}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onView(brief.id)}
        className="w-full mt-2 px-3 py-2 text-sm border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        View Full Brief
      </button>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

interface CoverageBackupSystemProps {
  userId?: string;
  teamId?: string;
}

export const CoverageBackupSystem: React.FC<CoverageBackupSystemProps> = ({
  userId = 'csm-001',
  teamId = 'team-001',
}) => {
  const [activeTab, setActiveTab] = useState<'my-absences' | 'covering' | 'team-calendar'>('my-absences');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [absences, setAbsences] = useState<CSMAbsence[]>([]);
  const [suggestions, setSuggestions] = useState<BackupSuggestion[]>([]);
  const [selectedAbsence, setSelectedAbsence] = useState<CSMAbsence | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [coverageAssignments, setCoverageAssignments] = useState<CoverageAssignment[]>([]);
  const [coverageBriefs, setCoverageBriefs] = useState<CoverageBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch absences on mount
  useEffect(() => {
    fetchAbsences();
  }, [userId]);

  const fetchAbsences = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/absences?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setAbsences(data.absences);
      }
    } catch (err) {
      setError('Failed to load absences');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupSuggestions = async (absenceId: string) => {
    try {
      const response = await fetch(`/api/absences/${absenceId}/backup-suggestions`);
      const data = await response.json();
      if (data.success) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      setError('Failed to load backup suggestions');
    }
  };

  const fetchCoverageAssignments = async (absenceId: string) => {
    try {
      const response = await fetch(`/api/absences/${absenceId}/coverage`);
      const data = await response.json();
      if (data.success) {
        setCoverageAssignments(data.assignments);
      }
    } catch (err) {
      setError('Failed to load coverage assignments');
    }
  };

  const handleCreateAbsence = async (formData: CreateAbsenceFormData) => {
    try {
      setLoading(true);
      const response = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAbsences([...absences, data.absence]);
        setShowCreateForm(false);
        setSelectedAbsence(data.absence);
        fetchBackupSuggestions(data.absence.id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create absence');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignBackup = async () => {
    if (!selectedAbsence || !selectedBackup) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/absences/${selectedAbsence.id}/coverage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          backupUserId: selectedBackup,
          coverageType: 'full',
        }),
      });
      const data = await response.json();
      if (data.success) {
        // Refresh data
        fetchAbsences();
        fetchCoverageAssignments(selectedAbsence.id);
        setSelectedBackup(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to assign backup');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: AbsenceStatus) => {
    const colors: Record<AbsenceStatus, string> = {
      planned: 'bg-blue-500/20 text-blue-400',
      coverage_assigned: 'bg-green-500/20 text-green-400',
      active: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-gray-500/20 text-gray-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || colors.planned;
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const formatAbsenceType = (type: AbsenceType) => {
    const types: Record<AbsenceType, string> = {
      vacation: 'Vacation',
      sick: 'Sick Leave',
      conference: 'Conference',
      parental: 'Parental Leave',
      other: 'Other',
    };
    return types[type] || type;
  };

  return (
    <div className="bg-cscx-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Coverage Backup System</h1>
          <p className="text-gray-400">Manage absences and ensure continuous customer coverage</p>
        </div>
        {activeTab === 'my-absences' && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Absence
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cscx-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('my-absences')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'my-absences'
              ? 'bg-cscx-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          My Absences
        </button>
        <button
          onClick={() => setActiveTab('covering')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'covering'
              ? 'bg-cscx-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Covering For
        </button>
        <button
          onClick={() => setActiveTab('team-calendar')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'team-calendar'
              ? 'bg-cscx-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Team Calendar
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - Absences List */}
        <div className="col-span-4">
          <div className="bg-cscx-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              {activeTab === 'my-absences' ? 'My Planned Absences' :
               activeTab === 'covering' ? 'Coverage Assignments' :
               'Team Absences'}
            </h2>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : absences.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No absences logged</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="text-cscx-accent hover:text-red-400"
                >
                  Log your first absence
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {absences.map((absence) => (
                  <div
                    key={absence.id}
                    onClick={() => {
                      setSelectedAbsence(absence);
                      fetchBackupSuggestions(absence.id);
                      fetchCoverageAssignments(absence.id);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedAbsence?.id === absence.id
                        ? 'border-cscx-accent bg-cscx-accent/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">
                        {formatAbsenceType(absence.absenceType)}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${getStatusBadge(absence.status)}`}>
                        {absence.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {formatDateRange(absence.startDate, absence.endDate)}
                    </div>
                    {absence.isPartial && (
                      <div className="text-xs text-gray-500 mt-1">
                        Partial: {absence.partialHours}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Details */}
        <div className="col-span-8">
          {showCreateForm ? (
            <div className="bg-cscx-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Log New Absence</h2>
              <AbsenceForm
                onSubmit={handleCreateAbsence}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          ) : selectedAbsence ? (
            <div className="space-y-6">
              {/* Absence Details */}
              <div className="bg-cscx-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">
                    {formatAbsenceType(selectedAbsence.absenceType)}
                  </h2>
                  <span className={`px-3 py-1 text-sm rounded ${getStatusBadge(selectedAbsence.status)}`}>
                    {selectedAbsence.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Dates:</span>
                    <span className="ml-2 text-white">
                      {formatDateRange(selectedAbsence.startDate, selectedAbsence.endDate)}
                    </span>
                  </div>
                  {selectedAbsence.isPartial && (
                    <div>
                      <span className="text-gray-500">Hours:</span>
                      <span className="ml-2 text-white">{selectedAbsence.partialHours}</span>
                    </div>
                  )}
                </div>
                {selectedAbsence.specialInstructions && (
                  <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">Special Instructions</span>
                    <p className="text-gray-300">{selectedAbsence.specialInstructions}</p>
                  </div>
                )}
              </div>

              {/* Backup Suggestions (only for planned absences) */}
              {selectedAbsence.status === 'planned' && (
                <div className="bg-cscx-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Backup Suggestions</h2>
                    {selectedBackup && (
                      <button
                        onClick={handleAssignBackup}
                        disabled={loading}
                        className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Assigning...' : 'Assign Selected Backup'}
                      </button>
                    )}
                  </div>
                  {suggestions.length === 0 ? (
                    <p className="text-gray-400">Loading suggestions...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {suggestions.map((suggestion) => (
                        <BackupSuggestionCard
                          key={suggestion.userId}
                          suggestion={suggestion}
                          selected={selectedBackup === suggestion.userId}
                          onSelect={setSelectedBackup}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coverage Briefs (for assigned/active coverage) */}
              {(selectedAbsence.status === 'coverage_assigned' || selectedAbsence.status === 'active') && (
                <div className="bg-cscx-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Coverage Briefs</h2>
                  {coverageBriefs.length === 0 ? (
                    <p className="text-gray-400">No coverage briefs available</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {coverageBriefs.map((brief) => (
                        <CoverageBriefCard
                          key={brief.id}
                          brief={brief}
                          onView={(id) => console.log('View brief:', id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-cscx-gray-800 rounded-lg p-6 text-center">
              <div className="text-gray-400 py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg">Select an absence to view details</p>
                <p className="text-sm mt-2">Or log a new absence to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverageBackupSystem;
