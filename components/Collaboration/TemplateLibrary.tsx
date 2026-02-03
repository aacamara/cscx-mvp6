/**
 * Template Library Component (PRD-256: Team Meeting Prep)
 *
 * Provides a UI for managing meeting prep templates and scheduled meetings:
 * - Browse and select templates
 * - Create/edit custom templates
 * - Schedule meetings with templates
 * - View and generate prep documents
 * - Manage agenda and action items
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Types
// ============================================

type MeetingType = '1on1' | 'team_sync' | 'pipeline_review' | 'qbr_planning' | 'custom';
type MeetingPrepStatus = 'scheduled' | 'generated' | 'sent' | 'in_progress' | 'completed';
type TopicPriority = 'low' | 'normal' | 'high' | 'urgent';
type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface TemplateSection {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

interface AgendaItem {
  topic: string;
  duration_minutes: number;
  notes?: string;
  linked_customer_id?: string;
}

interface MeetingPrepTemplate {
  id: string;
  name: string;
  description?: string;
  meeting_type: MeetingType;
  sections: TemplateSection[];
  default_agenda: AgendaItem[];
  generate_hours_before: number;
  send_to_attendees: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface ScheduledMeetingPrep {
  id: string;
  template_id?: string;
  meeting_title: string;
  meeting_date: string;
  attendees: string[];
  agenda: AgendaItem[];
  status: MeetingPrepStatus;
  prep_document?: {
    sections: Array<{ name: string; type: string; data: unknown }>;
    suggested_agenda: AgendaItem[];
    previous_action_items: ActionItem[];
  };
  generated_at?: string;
  effectiveness_rating?: number;
}

interface TopicSubmission {
  id: string;
  topic: string;
  description?: string;
  priority: TopicPriority;
  submitted_at: string;
}

interface ActionItem {
  id: string;
  description: string;
  owner_user_id?: string;
  due_date?: string;
  status: ActionItemStatus;
}

// ============================================
// Helper Functions
// ============================================

const getMeetingTypeLabel = (type: MeetingType): string => {
  const labels: Record<MeetingType, string> = {
    '1on1': '1:1 Meeting',
    'team_sync': 'Team Sync',
    'pipeline_review': 'Pipeline Review',
    'qbr_planning': 'QBR Planning',
    'custom': 'Custom'
  };
  return labels[type] || type;
};

const getMeetingTypeIcon = (type: MeetingType): string => {
  const icons: Record<MeetingType, string> = {
    '1on1': 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    'team_sync': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    'pipeline_review': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    'qbr_planning': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    'custom': 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
  };
  return icons[type] || icons.custom;
};

const getStatusColor = (status: MeetingPrepStatus): string => {
  const colors: Record<MeetingPrepStatus, string> = {
    scheduled: 'text-gray-400 bg-gray-500/20',
    generated: 'text-blue-400 bg-blue-500/20',
    sent: 'text-purple-400 bg-purple-500/20',
    in_progress: 'text-yellow-400 bg-yellow-500/20',
    completed: 'text-green-400 bg-green-500/20'
  };
  return colors[status] || 'text-gray-400 bg-gray-500/20';
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// ============================================
// Sub-Components
// ============================================

interface TemplateCardProps {
  template: MeetingPrepTemplate;
  onSelect: (template: MeetingPrepTemplate) => void;
  selected: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSelect, selected }) => {
  const totalDuration = template.default_agenda.reduce((sum, item) => sum + item.duration_minutes, 0);

  return (
    <div
      onClick={() => onSelect(template)}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        selected
          ? 'border-cscx-accent bg-cscx-accent/10 ring-1 ring-cscx-accent'
          : 'border-cscx-gray-800 bg-cscx-gray-900 hover:border-cscx-gray-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${selected ? 'bg-cscx-accent/20' : 'bg-cscx-gray-800'}`}>
          <svg className={`w-5 h-5 ${selected ? 'text-cscx-accent' : 'text-cscx-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getMeetingTypeIcon(template.meeting_type)} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate">{template.name}</h4>
            {template.is_default && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-cscx-accent/20 text-cscx-accent rounded">
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-cscx-gray-400 mt-0.5">{getMeetingTypeLabel(template.meeting_type)}</p>
          {template.description && (
            <p className="text-xs text-cscx-gray-500 mt-1 line-clamp-2">{template.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-cscx-gray-800 text-xs text-cscx-gray-500">
        <span>{template.sections.length} sections</span>
        <span>{template.default_agenda.length} agenda items</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>
    </div>
  );
};

interface MeetingPrepCardProps {
  prep: ScheduledMeetingPrep;
  onView: (prep: ScheduledMeetingPrep) => void;
}

const MeetingPrepCard: React.FC<MeetingPrepCardProps> = ({ prep, onView }) => {
  const isUpcoming = new Date(prep.meeting_date) > new Date();
  const totalDuration = prep.agenda.reduce((sum, item) => sum + item.duration_minutes, 0);

  return (
    <div
      onClick={() => onView(prep)}
      className="p-4 rounded-xl border border-cscx-gray-800 bg-cscx-gray-900 hover:border-cscx-gray-700 cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{prep.meeting_title}</h4>
          <p className="text-sm text-cscx-gray-400 mt-0.5">{formatDate(prep.meeting_date)}</p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(prep.status)}`}>
          {prep.status.replace('_', ' ')}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-cscx-gray-800 text-xs text-cscx-gray-500">
        <span>{prep.attendees.length} attendees</span>
        <span>{prep.agenda.length} agenda items</span>
        <span>{formatDuration(totalDuration)}</span>
        {prep.effectiveness_rating && (
          <span className="text-yellow-400">{prep.effectiveness_rating}/5</span>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

interface TemplateLibraryProps {
  onScheduleMeeting?: (prep: ScheduledMeetingPrep) => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ onScheduleMeeting }) => {
  // State
  const [activeTab, setActiveTab] = useState<'templates' | 'scheduled' | 'upcoming'>('templates');
  const [templates, setTemplates] = useState<MeetingPrepTemplate[]>([]);
  const [meetingPreps, setMeetingPreps] = useState<ScheduledMeetingPrep[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingPrepTemplate | null>(null);
  const [selectedPrep, setSelectedPrep] = useState<ScheduledMeetingPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<MeetingType | 'all'>('all');

  // Create meeting form state
  const [createForm, setCreateForm] = useState({
    meeting_title: '',
    meeting_date: '',
    attendees: ''
  });

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const params = filterType !== 'all' ? `?type=${filterType}` : '';
      const response = await fetch(`${API_BASE}/template-library/templates${params}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      setTemplates(result.data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    }
  }, [filterType]);

  // Fetch meeting preps
  const fetchMeetingPreps = useCallback(async () => {
    try {
      const endpoint = activeTab === 'upcoming'
        ? `${API_BASE}/template-library/preps/upcoming`
        : `${API_BASE}/template-library/preps`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch meeting preps');
      const result = await response.json();
      setMeetingPreps(result.data.preps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting preps');
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTemplates(), fetchMeetingPreps()])
      .finally(() => setLoading(false));
  }, [fetchTemplates, fetchMeetingPreps]);

  // Create meeting prep
  const handleCreateMeeting = async () => {
    if (!selectedTemplate || !createForm.meeting_title || !createForm.meeting_date) {
      return;
    }

    try {
      const attendeeIds = createForm.attendees
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      const response = await fetch(`${API_BASE}/template-library/preps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          meeting_title: createForm.meeting_title,
          meeting_date: new Date(createForm.meeting_date).toISOString(),
          attendees: attendeeIds.length > 0 ? attendeeIds : ['demo_user']
        })
      });

      if (!response.ok) throw new Error('Failed to create meeting prep');
      const result = await response.json();

      setMeetingPreps(prev => [result.data, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ meeting_title: '', meeting_date: '', attendees: '' });
      setSelectedTemplate(null);
      onScheduleMeeting?.(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    }
  };

  // Generate prep document
  const handleGeneratePrep = async (prepId: string) => {
    try {
      const response = await fetch(`${API_BASE}/template-library/preps/${prepId}/generate`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to generate prep document');
      const result = await response.json();

      setMeetingPreps(prev =>
        prev.map(p => p.id === prepId ? result.data : p)
      );
      setSelectedPrep(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prep');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading template library...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Meeting Prep Templates</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Prepare for team meetings with automated prep materials
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Meeting
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-cscx-gray-900 rounded-lg p-1 w-fit">
        {[
          { key: 'templates', label: 'Templates', count: templates.length },
          { key: 'upcoming', label: 'Upcoming', count: meetingPreps.filter(p => new Date(p.meeting_date) > new Date()).length },
          { key: 'scheduled', label: 'All Meetings', count: meetingPreps.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-cscx-gray-800 text-white'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              activeTab === tab.key ? 'bg-cscx-accent/20 text-cscx-accent' : 'bg-cscx-gray-800 text-cscx-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {(['all', '1on1', 'team_sync', 'pipeline_review', 'qbr_planning'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterType === type
                    ? 'bg-cscx-accent text-white'
                    : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
                }`}
              >
                {type === 'all' ? 'All Types' : getMeetingTypeLabel(type)}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={setSelectedTemplate}
                selected={selectedTemplate?.id === template.id}
              />
            ))}
          </div>

          {templates.length === 0 && (
            <div className="p-8 text-center text-cscx-gray-500">
              No templates found. Create a custom template to get started.
            </div>
          )}
        </div>
      )}

      {/* Scheduled/Upcoming Meetings Tab */}
      {(activeTab === 'scheduled' || activeTab === 'upcoming') && (
        <div className="space-y-4">
          {/* Meeting Prep Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetingPreps
              .filter(p => activeTab === 'scheduled' || new Date(p.meeting_date) > new Date())
              .map(prep => (
                <MeetingPrepCard
                  key={prep.id}
                  prep={prep}
                  onView={setSelectedPrep}
                />
              ))}
          </div>

          {meetingPreps.length === 0 && (
            <div className="p-8 text-center text-cscx-gray-500">
              No scheduled meetings. Use a template to schedule one.
            </div>
          )}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-6 w-full max-w-lg mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Schedule Meeting</h3>

            <div className="space-y-4">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
                  Template
                </label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value);
                    setSelectedTemplate(template || null);
                  }}
                  className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                >
                  <option value="">Select a template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Meeting Title */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
                  Meeting Title
                </label>
                <input
                  type="text"
                  value={createForm.meeting_title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, meeting_title: e.target.value }))}
                  placeholder="e.g., Weekly Team Sync"
                  className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                />
              </div>

              {/* Meeting Date */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={createForm.meeting_date}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, meeting_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
                  Attendees (comma-separated user IDs)
                </label>
                <input
                  type="text"
                  value={createForm.attendees}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, attendees: e.target.value }))}
                  placeholder="e.g., user1, user2"
                  className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ meeting_title: '', meeting_date: '', attendees: '' });
                }}
                className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={!selectedTemplate || !createForm.meeting_title || !createForm.meeting_date}
                className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 disabled:bg-cscx-gray-700 disabled:text-cscx-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Prep Detail Modal */}
      {selectedPrep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedPrep.meeting_title}</h3>
                <p className="text-cscx-gray-400 text-sm mt-1">{formatDate(selectedPrep.meeting_date)}</p>
              </div>
              <button
                onClick={() => setSelectedPrep(null)}
                className="p-1 text-cscx-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 mb-6">
              <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusColor(selectedPrep.status)}`}>
                {selectedPrep.status.replace('_', ' ')}
              </span>
              {selectedPrep.generated_at && (
                <span className="text-sm text-cscx-gray-500">
                  Generated: {new Date(selectedPrep.generated_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* Generate Button */}
            {selectedPrep.status === 'scheduled' && (
              <button
                onClick={() => handleGeneratePrep(selectedPrep.id)}
                className="w-full mb-6 px-4 py-3 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Prep Document
              </button>
            )}

            {/* Agenda */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-white mb-3">Agenda</h4>
              <div className="space-y-2">
                {selectedPrep.agenda.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-cscx-gray-800 rounded-lg">
                    <span className="text-white">{item.topic}</span>
                    <span className="text-sm text-cscx-gray-500">{item.duration_minutes}m</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prep Document Sections */}
            {selectedPrep.prep_document && (
              <div className="space-y-6">
                {selectedPrep.prep_document.sections.map((section, index) => (
                  <div key={index}>
                    <h4 className="text-lg font-semibold text-white mb-3">{section.name}</h4>
                    <div className="p-4 bg-cscx-gray-800 rounded-lg">
                      <pre className="text-sm text-cscx-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(section.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-cscx-gray-800">
              <button
                onClick={() => setSelectedPrep(null)}
                className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
              {selectedPrep.status === 'generated' && (
                <button
                  className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg font-medium transition-colors"
                >
                  Send to Attendees
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateLibrary;
