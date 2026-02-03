/**
 * Mobile Meeting Notes Component
 * PRD-269: Mobile Meeting Notes
 *
 * React component for capturing meeting notes on mobile devices with:
 * - Voice recording and transcription
 * - Quick action items entry
 * - Real-time collaboration
 * - AI-powered post-meeting processing
 * - Offline sync capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface Attendee {
  id: string;
  name: string;
  email?: string;
  role?: 'customer' | 'internal' | 'partner' | 'unknown';
  is_present: boolean;
}

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  owner_id?: string;
  owner_name?: string;
  owner_type: 'customer' | 'internal' | 'both' | 'unknown';
  due_date?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed';
  created_at: Date;
  source: 'manual' | 'ai_extracted';
}

interface Highlight {
  id: string;
  text: string;
  timestamp: Date;
  type: 'key_moment' | 'decision' | 'quote' | 'concern';
  speaker?: string;
}

interface VoiceNote {
  id: string;
  uri: string;
  transcription?: string;
  duration: number;
  timestamp: Date;
  status: 'recording' | 'transcribing' | 'completed' | 'failed';
}

interface RiskFlag {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

interface OpportunityFlag {
  id: string;
  description: string;
  potential: 'low' | 'medium' | 'high';
  type: 'upsell' | 'cross_sell' | 'expansion' | 'referral';
  timestamp: Date;
}

interface MeetingNote {
  id: string;
  meeting_id?: string;
  customer_id?: string;
  customer_name?: string;
  title: string;
  content: string;
  attendees: Attendee[];
  action_items: ActionItem[];
  highlights: Highlight[];
  voice_notes: VoiceNote[];
  risks: RiskFlag[];
  opportunities: OpportunityFlag[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  template_type?: MeetingTemplateType;
  started_at: Date;
  ended_at?: Date;
  status: 'active' | 'processing' | 'completed';
  created_by: string;
  collaborators: string[];
  last_synced_at?: Date;
}

type MeetingTemplateType =
  | 'discovery'
  | 'qbr'
  | 'kickoff'
  | 'check_in'
  | 'escalation'
  | 'renewal'
  | 'training'
  | 'general';

interface MeetingTemplate {
  type: MeetingTemplateType;
  name: string;
  description: string;
  default_topics: string[];
  suggested_duration: number;
}

interface ProcessedMeetingNotes {
  summary: string;
  key_topics: string[];
  action_items: ActionItem[];
  risks: RiskFlag[];
  opportunities: OpportunityFlag[];
  sentiment: 'positive' | 'neutral' | 'negative';
  follow_up_email: string;
  next_steps: string[];
}

interface CalendarMeeting {
  id: string;
  title: string;
  customer_id?: string;
  customer_name?: string;
  start_time: Date;
  end_time: Date;
  attendees: string[];
}

interface OfflineChange {
  id: string;
  field: string;
  value: any;
  timestamp: Date;
  synced: boolean;
}

interface MobileMeetingNotesProps {
  meetingId?: string;
  customerId?: string;
  customerName?: string;
  onBack?: () => void;
  onComplete?: (note: MeetingNote, processed: ProcessedMeetingNotes) => void;
}

// ============================================
// API Functions
// ============================================

const API_URL = import.meta.env.VITE_API_URL || '';

async function createMeetingNote(params: {
  customer_id?: string;
  customer_name?: string;
  title: string;
  template_type?: MeetingTemplateType;
  meeting_id?: string;
  attendees?: Attendee[];
}): Promise<MeetingNote> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  return data.note;
}

async function updateMeetingNote(noteId: string, updates: Partial<MeetingNote>): Promise<MeetingNote> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  return data.note;
}

async function addActionItem(noteId: string, item: Omit<ActionItem, 'id' | 'created_at' | 'source'>): Promise<ActionItem> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${noteId}/action-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  const data = await response.json();
  return data.actionItem;
}

async function addHighlight(noteId: string, highlight: Omit<Highlight, 'id' | 'timestamp'>): Promise<Highlight> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${noteId}/highlights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(highlight),
  });
  const data = await response.json();
  return data.highlight;
}

async function addRiskFlag(noteId: string, risk: Omit<RiskFlag, 'id' | 'timestamp'>): Promise<RiskFlag> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${noteId}/risks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(risk),
  });
  const data = await response.json();
  return data.risk;
}

async function addOpportunityFlag(noteId: string, opp: Omit<OpportunityFlag, 'id' | 'timestamp'>): Promise<OpportunityFlag> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${noteId}/opportunities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opp),
  });
  const data = await response.json();
  return data.opportunity;
}

async function processMeetingNotes(noteId: string): Promise<ProcessedMeetingNotes> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${noteId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  return data.processed;
}

async function detectCurrentMeeting(): Promise<CalendarMeeting | null> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/detect-meeting`);
  const data = await response.json();
  return data.meeting;
}

async function getMeetingTemplates(): Promise<MeetingTemplate[]> {
  const response = await fetch(`${API_URL}/api/mobile/meeting-notes/templates`);
  const data = await response.json();
  return data.templates;
}

// ============================================
// Utility Functions
// ============================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Sub-Components
// ============================================

const MeetingHeader: React.FC<{
  customer?: string;
  title: string;
  startTime: Date;
  isRecording: boolean;
}> = ({ customer, title, startTime, isRecording }) => (
  <div className="bg-cscx-gray-900 border-b border-cscx-gray-800 p-4">
    <div className="flex items-center justify-between">
      <div>
        {customer && (
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wide">{customer}</p>
        )}
        <h2 className="text-lg font-semibold text-white mt-1">{title}</h2>
        <p className="text-sm text-cscx-gray-400">Started {formatTime(startTime)}</p>
      </div>
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-600/50 rounded-full">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400 font-medium">Recording</span>
        </div>
      )}
    </div>
  </div>
);

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  variant?: 'default' | 'danger' | 'warning' | 'success';
}> = ({ icon, label, onPress, active, variant = 'default' }) => {
  const variantClasses = {
    default: active ? 'bg-cscx-accent text-white' : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700',
    danger: 'bg-red-900/30 text-red-400 border border-red-600/50 hover:bg-red-900/50',
    warning: 'bg-yellow-900/30 text-yellow-400 border border-yellow-600/50 hover:bg-yellow-900/50',
    success: 'bg-green-900/30 text-green-400 border border-green-600/50 hover:bg-green-900/50',
  };

  return (
    <button
      onClick={onPress}
      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg transition-colors ${variantClasses[variant]}`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};

const QuickActionBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex justify-around gap-2 p-4 bg-cscx-gray-900 border-b border-cscx-gray-800">
    {children}
  </div>
);

const AttendeeTags: React.FC<{
  attendees: Attendee[];
  onAdd: (name: string) => void;
  onToggle: (id: string) => void;
}> = ({ attendees, onAdd, onToggle }) => {
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue('');
      setShowInput(false);
    }
  };

  return (
    <div className="mb-4">
      <label className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 block">
        Attendees
      </label>
      <div className="flex flex-wrap gap-2">
        {attendees.map((attendee) => (
          <button
            key={attendee.id}
            onClick={() => onToggle(attendee.id)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              attendee.is_present
                ? 'bg-cscx-accent/20 text-cscx-accent border border-cscx-accent/50'
                : 'bg-cscx-gray-800 text-cscx-gray-400 border border-cscx-gray-700'
            }`}
          >
            {attendee.name}
          </button>
        ))}
        {showInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Name..."
              autoFocus
              className="px-3 py-1.5 rounded-full text-sm bg-cscx-gray-800 border border-cscx-gray-700 text-white placeholder-cscx-gray-500 focus:border-cscx-accent focus:outline-none"
            />
            <button
              onClick={handleSubmit}
              className="p-1.5 rounded-full bg-cscx-accent text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="px-3 py-1.5 rounded-full text-sm bg-cscx-gray-800 text-cscx-gray-400 border border-dashed border-cscx-gray-600 hover:border-cscx-accent hover:text-cscx-accent transition-colors"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
};

const ActionItemsList: React.FC<{
  items: ActionItem[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
}> = ({ items, onAdd, onToggle }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="mb-4">
      <label className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 block">
        Action Items ({items.length})
      </label>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 bg-cscx-gray-800 rounded-lg"
          >
            <button
              onClick={() => onToggle(item.id)}
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                item.status === 'completed'
                  ? 'bg-green-500 border-green-500'
                  : 'border-cscx-gray-600 hover:border-cscx-accent'
              }`}
            >
              {item.status === 'completed' && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <p className={`text-sm ${item.status === 'completed' ? 'text-cscx-gray-500 line-through' : 'text-white'}`}>
                {item.title}
              </p>
              {item.owner_name && (
                <p className="text-xs text-cscx-gray-400 mt-1">
                  Assigned to {item.owner_name}
                </p>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded text-xs ${
              item.priority === 'high'
                ? 'bg-red-900/30 text-red-400'
                : item.priority === 'medium'
                ? 'bg-yellow-900/30 text-yellow-400'
                : 'bg-cscx-gray-700 text-cscx-gray-400'
            }`}>
              {item.priority}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Add action item..."
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-cscx-gray-800 border border-cscx-gray-700 text-white placeholder-cscx-gray-500 focus:border-cscx-accent focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            className="p-2 rounded-lg bg-cscx-accent text-white hover:bg-cscx-accent/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const VoiceNotesList: React.FC<{ notes: VoiceNote[] }> = ({ notes }) => (
  <div className="mb-4">
    <label className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 block">
      Voice Notes ({notes.length})
    </label>
    <div className="space-y-2">
      {notes.map((note) => (
        <div
          key={note.id}
          className="p-3 bg-cscx-gray-800 rounded-lg border border-cscx-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-cscx-gray-400">
              {formatTime(new Date(note.timestamp))}
            </span>
            <span className="text-xs text-cscx-gray-400">
              {formatDuration(note.duration)}
            </span>
          </div>
          {note.transcription && (
            <p className="text-sm text-white">{note.transcription}</p>
          )}
          {note.status === 'transcribing' && (
            <p className="text-sm text-cscx-gray-400 italic">Transcribing...</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

const SyncIndicator: React.FC<{ pending: number; isSyncing: boolean }> = ({ pending, isSyncing }) => {
  if (pending === 0 && !isSyncing) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-cscx-gray-800 rounded-lg p-3 border border-cscx-gray-700 flex items-center gap-3">
      {isSyncing ? (
        <>
          <div className="w-4 h-4 border-2 border-cscx-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-cscx-gray-300">Syncing changes...</span>
        </>
      ) : (
        <>
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-sm text-cscx-gray-300">{pending} pending changes</span>
        </>
      )}
    </div>
  );
};

const ProcessingModal: React.FC<{
  isOpen: boolean;
  processed?: ProcessedMeetingNotes;
  onClose: () => void;
  onCreateTasks: () => void;
}> = ({ isOpen, processed, onClose, onCreateTasks }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
      <div className="w-full max-w-lg bg-cscx-gray-900 rounded-t-2xl border-t border-cscx-gray-700 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Meeting Summary</h3>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!processed ? (
          <div className="p-8 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-cscx-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-cscx-gray-300">Processing meeting notes with AI...</p>
          </div>
        ) : (
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {/* Summary */}
            <div className="mb-4">
              <h4 className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2">Summary</h4>
              <p className="text-sm text-white">{processed.summary}</p>
            </div>

            {/* Sentiment */}
            <div className="mb-4">
              <h4 className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2">Sentiment</h4>
              <span className={`px-3 py-1 rounded-full text-sm ${
                processed.sentiment === 'positive'
                  ? 'bg-green-900/30 text-green-400'
                  : processed.sentiment === 'negative'
                  ? 'bg-red-900/30 text-red-400'
                  : 'bg-cscx-gray-700 text-cscx-gray-300'
              }`}>
                {processed.sentiment.charAt(0).toUpperCase() + processed.sentiment.slice(1)}
              </span>
            </div>

            {/* Key Topics */}
            {processed.key_topics.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2">Key Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {processed.key_topics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-cscx-gray-800 text-cscx-gray-300 text-xs rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {processed.action_items.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2">
                  AI-Extracted Action Items ({processed.action_items.length})
                </h4>
                <div className="space-y-2">
                  {processed.action_items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 bg-cscx-gray-800 rounded text-sm text-white"
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {processed.next_steps.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2">Next Steps</h4>
                <ul className="list-disc list-inside space-y-1">
                  {processed.next_steps.map((step, i) => (
                    <li key={i} className="text-sm text-white">{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up Email */}
            {processed.follow_up_email && (
              <div className="mb-4">
                <h4 className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2">Suggested Follow-up</h4>
                <div className="p-3 bg-cscx-gray-800 rounded text-sm text-white whitespace-pre-wrap">
                  {processed.follow_up_email}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onCreateTasks}
                className="flex-1 px-4 py-3 bg-cscx-accent text-white rounded-lg font-medium hover:bg-cscx-accent/80 transition-colors"
              >
                Create Tasks from Action Items
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const MobileMeetingNotes: React.FC<MobileMeetingNotesProps> = ({
  meetingId,
  customerId,
  customerName,
  onBack,
  onComplete,
}) => {
  // State
  const [note, setNote] = useState<MeetingNote | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<OfflineChange[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processedNotes, setProcessedNotes] = useState<ProcessedMeetingNotes | undefined>();
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplateType>('general');
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  const [noteTitle, setNoteTitle] = useState('');

  // Load templates
  useEffect(() => {
    getMeetingTemplates().then(setTemplates).catch(console.error);
  }, []);

  // Auto-detect meeting
  useEffect(() => {
    if (!meetingId && !note) {
      detectCurrentMeeting().then((meeting) => {
        if (meeting) {
          setNoteTitle(meeting.title);
          // Could auto-fill other fields from calendar
        }
      }).catch(console.error);
    }
  }, [meetingId, note]);

  // Create note
  const handleCreateNote = useCallback(async () => {
    if (!noteTitle.trim()) return;

    try {
      const newNote = await createMeetingNote({
        customer_id: customerId,
        customer_name: customerName,
        title: noteTitle,
        template_type: selectedTemplate,
        meeting_id: meetingId,
      });
      setNote(newNote);
      setShowTemplateSelector(false);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [noteTitle, customerId, customerName, selectedTemplate, meetingId]);

  // Update content
  const handleContentChange = useCallback(async (content: string) => {
    if (!note) return;

    setNote({ ...note, content });

    // Queue offline change
    const change: OfflineChange = {
      id: generateId(),
      field: 'content',
      value: content,
      timestamp: new Date(),
      synced: false,
    };
    setPendingChanges((prev) => [...prev, change]);

    // Debounced sync
    setTimeout(async () => {
      try {
        await updateMeetingNote(note.id, { content });
        setPendingChanges((prev) => prev.filter((c) => c.id !== change.id));
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }, 2000);
  }, [note]);

  // Add attendee
  const handleAddAttendee = useCallback(async (name: string) => {
    if (!note) return;

    const newAttendee: Attendee = {
      id: generateId(),
      name,
      is_present: true,
    };

    const updatedAttendees = [...note.attendees, newAttendee];
    setNote({ ...note, attendees: updatedAttendees });

    try {
      await updateMeetingNote(note.id, { attendees: updatedAttendees });
    } catch (error) {
      console.error('Failed to add attendee:', error);
    }
  }, [note]);

  // Toggle attendee presence
  const handleToggleAttendee = useCallback(async (id: string) => {
    if (!note) return;

    const updatedAttendees = note.attendees.map((a) =>
      a.id === id ? { ...a, is_present: !a.is_present } : a
    );
    setNote({ ...note, attendees: updatedAttendees });

    try {
      await updateMeetingNote(note.id, { attendees: updatedAttendees });
    } catch (error) {
      console.error('Failed to toggle attendee:', error);
    }
  }, [note]);

  // Add action item
  const handleAddActionItem = useCallback(async (title: string) => {
    if (!note) return;

    try {
      const item = await addActionItem(note.id, {
        title,
        owner_type: 'unknown',
        priority: 'medium',
        status: 'open',
      });
      setNote({ ...note, action_items: [...note.action_items, item] });
    } catch (error) {
      console.error('Failed to add action item:', error);
    }
  }, [note]);

  // Toggle action item
  const handleToggleActionItem = useCallback(async (id: string) => {
    if (!note) return;

    const updatedItems = note.action_items.map((item) =>
      item.id === id
        ? { ...item, status: item.status === 'completed' ? 'open' as const : 'completed' as const }
        : item
    );
    setNote({ ...note, action_items: updatedItems });

    try {
      await updateMeetingNote(note.id, { action_items: updatedItems });
    } catch (error) {
      console.error('Failed to toggle action item:', error);
    }
  }, [note]);

  // Add highlight
  const handleAddHighlight = useCallback(async () => {
    if (!note) return;

    const text = window.prompt('Enter highlight text:');
    if (!text) return;

    try {
      const highlight = await addHighlight(note.id, {
        text,
        type: 'key_moment',
      });
      setNote({ ...note, highlights: [...note.highlights, highlight] });
    } catch (error) {
      console.error('Failed to add highlight:', error);
    }
  }, [note]);

  // Add risk
  const handleAddRisk = useCallback(async () => {
    if (!note) return;

    const description = window.prompt('Describe the risk:');
    if (!description) return;

    try {
      const risk = await addRiskFlag(note.id, {
        description,
        severity: 'medium',
      });
      setNote({ ...note, risks: [...note.risks, risk] });
    } catch (error) {
      console.error('Failed to add risk:', error);
    }
  }, [note]);

  // Add opportunity
  const handleAddOpportunity = useCallback(async () => {
    if (!note) return;

    const description = window.prompt('Describe the opportunity:');
    if (!description) return;

    try {
      const opp = await addOpportunityFlag(note.id, {
        description,
        potential: 'medium',
        type: 'expansion',
      });
      setNote({ ...note, opportunities: [...note.opportunities, opp] });
    } catch (error) {
      console.error('Failed to add opportunity:', error);
    }
  }, [note]);

  // Voice recording (mock - would use native APIs in real mobile app)
  const handleVoiceToggle = useCallback(() => {
    setIsRecording(!isRecording);

    if (isRecording) {
      // Stop recording - in real app, would stop recording and transcribe
      const mockTranscription = '[Voice note transcription would appear here]';

      if (note) {
        const newVoiceNote: VoiceNote = {
          id: generateId(),
          uri: `voice_${Date.now()}.m4a`,
          transcription: mockTranscription,
          duration: 30,
          timestamp: new Date(),
          status: 'completed',
        };

        const updatedContent = note.content + `\n\n[Voice Note - ${formatTime(new Date())}]\n${mockTranscription}`;

        setNote({
          ...note,
          voice_notes: [...note.voice_notes, newVoiceNote],
          content: updatedContent,
        });
      }
    }
  }, [isRecording, note]);

  // End meeting and process
  const handleEndMeeting = useCallback(async () => {
    if (!note) return;

    setShowProcessingModal(true);

    try {
      const processed = await processMeetingNotes(note.id);
      setProcessedNotes(processed);

      // Update local note with processed data
      setNote({
        ...note,
        status: 'completed',
        ended_at: new Date(),
        sentiment: processed.sentiment,
      });

      if (onComplete) {
        onComplete(note, processed);
      }
    } catch (error) {
      console.error('Failed to process notes:', error);
      setShowProcessingModal(false);
    }
  }, [note, onComplete]);

  // Create tasks from action items
  const handleCreateTasks = useCallback(async () => {
    if (!note) return;

    try {
      const response = await fetch(`${API_URL}/api/mobile/meeting-notes/${note.id}/create-tasks`, {
        method: 'POST',
      });
      const result = await response.json();
      alert(`Created ${result.created} tasks${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
    } catch (error) {
      console.error('Failed to create tasks:', error);
    }
  }, [note]);

  // Template selector view
  if (showTemplateSelector && !note) {
    return (
      <div className="min-h-screen bg-cscx-black">
        {/* Header */}
        <div className="bg-cscx-gray-900 border-b border-cscx-gray-800 p-4 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 text-cscx-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-white">New Meeting Note</h1>
        </div>

        <div className="p-4">
          {/* Title Input */}
          <div className="mb-6">
            <label className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 block">
              Meeting Title
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g., QBR with Acme Corp"
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:border-cscx-accent focus:outline-none"
            />
          </div>

          {/* Template Selection */}
          <div className="mb-6">
            <label className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 block">
              Meeting Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.type}
                  onClick={() => setSelectedTemplate(template.type)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedTemplate === template.type
                      ? 'bg-cscx-accent/20 border-cscx-accent text-white'
                      : 'bg-cscx-gray-800 border-cscx-gray-700 text-cscx-gray-300 hover:border-cscx-gray-600'
                  }`}
                >
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-cscx-gray-400 mt-1">
                    {template.suggested_duration} min
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleCreateNote}
            disabled={!noteTitle.trim()}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors ${
              noteTitle.trim()
                ? 'bg-cscx-accent text-white hover:bg-cscx-accent/80'
                : 'bg-cscx-gray-800 text-cscx-gray-500 cursor-not-allowed'
            }`}
          >
            Start Meeting Notes
          </button>
        </div>
      </div>
    );
  }

  // Main note taking view
  if (!note) {
    return (
      <div className="min-h-screen bg-cscx-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cscx-black flex flex-col">
      {/* Header */}
      <MeetingHeader
        customer={note.customer_name}
        title={note.title}
        startTime={note.started_at}
        isRecording={isRecording}
      />

      {/* Quick Actions */}
      <QuickActionBar>
        <QuickActionButton
          icon={isRecording ? '⏹️' : '🎤'}
          label={isRecording ? 'Stop' : 'Voice'}
          onPress={handleVoiceToggle}
          active={isRecording}
        />
        <QuickActionButton
          icon="⭐"
          label="Highlight"
          onPress={handleAddHighlight}
        />
        <QuickActionButton
          icon="⚠️"
          label="Risk"
          onPress={handleAddRisk}
          variant="warning"
        />
        <QuickActionButton
          icon="💡"
          label="Opportunity"
          onPress={handleAddOpportunity}
          variant="success"
        />
      </QuickActionBar>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Attendees */}
        <AttendeeTags
          attendees={note.attendees}
          onAdd={handleAddAttendee}
          onToggle={handleToggleAttendee}
        />

        {/* Notes Input */}
        <div className="mb-4">
          <label className="text-xs text-cscx-gray-400 uppercase tracking-wide mb-2 block">
            Notes
          </label>
          <textarea
            value={note.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start taking notes..."
            rows={8}
            className="w-full px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:border-cscx-accent focus:outline-none resize-none"
          />
        </div>

        {/* Action Items */}
        <ActionItemsList
          items={note.action_items}
          onAdd={handleAddActionItem}
          onToggle={handleToggleActionItem}
        />

        {/* Voice Notes */}
        {note.voice_notes.length > 0 && (
          <VoiceNotesList notes={note.voice_notes} />
        )}
      </div>

      {/* Sync Indicator */}
      <SyncIndicator pending={pendingChanges.length} isSyncing={isSyncing} />

      {/* End Meeting Button */}
      <div className="p-4 bg-cscx-gray-900 border-t border-cscx-gray-800">
        <button
          onClick={handleEndMeeting}
          className="w-full py-4 bg-cscx-accent text-white rounded-lg font-semibold hover:bg-cscx-accent/80 transition-colors"
        >
          End Meeting & Process
        </button>
      </div>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={showProcessingModal}
        processed={processedNotes}
        onClose={() => setShowProcessingModal(false)}
        onCreateTasks={handleCreateTasks}
      />
    </div>
  );
};

export default MobileMeetingNotes;
