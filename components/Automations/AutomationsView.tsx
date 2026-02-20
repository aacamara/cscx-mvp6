/**
 * AutomationsView - Automations & Triggers Management
 * Three-tab view: Rules | Triggers | Runs
 * Manages automation rules with NL parsing, triggers with event types, and run history.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { FilterBar, FilterConfig } from '../shared/FilterBar';

const API_URL = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  actions: Record<string, any>[];
  conditions: Record<string, any>[];
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  run_count: number;
}

interface AutomationStats {
  total: number;
  active: number;
  paused: number;
}

interface ParsedAutomation {
  name: string;
  trigger: Record<string, any>;
  conditions: Record<string, any>[];
  actions: Record<string, any>[];
}

interface Trigger {
  id: string;
  name: string;
  description: string;
  type: string;
  conditions: Record<string, any>[];
  actions: Record<string, any>[];
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldown_minutes: number;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
}

interface TriggerStats {
  total: number;
  active: number;
  paused: number;
}

interface TriggerEvent {
  id: string;
  trigger_id: string;
  event_type: string;
  payload: Record<string, any>;
  result: Record<string, any>;
  created_at: string;
}

type Tab = 'rules' | 'triggers' | 'runs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function jsonPretty(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AutomationsView: React.FC = () => {
  const { getAuthHeaders } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('rules');

  // ------ Rules state ------
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationStats, setAutomationStats] = useState<AutomationStats>({ total: 0, active: 0, paused: 0 });
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesFilters, setRulesFilters] = useState<Record<string, string>>({ search: '', status: '' });

  // Rules modals
  const [showNewAutomation, setShowNewAutomation] = useState(false);
  const [nlInput, setNlInput] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedAutomation | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // ------ Triggers state ------
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [triggerStats, setTriggerStats] = useState<TriggerStats>({ total: 0, active: 0, paused: 0 });
  const [triggersLoading, setTriggersLoading] = useState(true);
  const [triggersError, setTriggersError] = useState<string | null>(null);
  const [triggersFilters, setTriggersFilters] = useState<Record<string, string>>({ search: '', type: '' });

  // Trigger modals
  const [showNewTrigger, setShowNewTrigger] = useState(false);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [newTrigger, setNewTrigger] = useState({
    name: '',
    description: '',
    type: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    cooldown_minutes: 60,
    conditions: '[]',
    actions: '[]',
  });
  const [creatingTrigger, setCreatingTrigger] = useState(false);

  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);
  const [triggerEventsLoading, setTriggerEventsLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }), [getAuthHeaders]);

  // ---------------------------------------------------------------------------
  // Rules fetchers
  // ---------------------------------------------------------------------------

  const fetchAutomations = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const res = await fetch(`${API_URL}/api/automations`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch automations (${res.status})`);
      const data = await res.json();
      setAutomations(data.automations ?? []);
    } catch (err: any) {
      setRulesError(err.message ?? 'Failed to load automations');
    } finally {
      setRulesLoading(false);
    }
  }, [authHeaders]);

  const fetchAutomationStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/automations/stats`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setAutomationStats({ total: data.total ?? 0, active: data.active ?? 0, paused: data.paused ?? 0 });
    } catch {
      // Stats are non-critical -- fail silently
    }
  }, [authHeaders]);

  const toggleAutomation = useCallback(async (automation: Automation) => {
    try {
      const res = await fetch(`${API_URL}/api/automations/${automation.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !automation.enabled }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      setAutomations(prev =>
        prev.map(a => a.id === automation.id ? { ...a, enabled: !a.enabled } : a)
      );
      fetchAutomationStats();
    } catch (err: any) {
      setRulesError(err.message);
    }
  }, [authHeaders, fetchAutomationStats]);

  const parseNL = useCallback(async () => {
    if (!nlInput.trim()) return;
    setParsing(true);
    setParsedResult(null);
    try {
      const res = await fetch(`${API_URL}/api/automations/parse`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ description: nlInput }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();
      if (data.success && data.parsed) {
        setParsedResult(data.parsed);
      } else {
        setRulesError('Could not parse the description. Try rephrasing.');
      }
    } catch (err: any) {
      setRulesError(err.message);
    } finally {
      setParsing(false);
    }
  }, [nlInput, authHeaders]);

  const createFromNL = useCallback(async () => {
    if (!nlInput.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/automations/from-nl`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ description: nlInput, name: parsedResult?.name ?? '', enabled: true }),
      });
      if (!res.ok) throw new Error('Create failed');
      setShowNewAutomation(false);
      setNlInput('');
      setParsedResult(null);
      fetchAutomations();
      fetchAutomationStats();
    } catch (err: any) {
      setRulesError(err.message);
    } finally {
      setCreating(false);
    }
  }, [nlInput, parsedResult, authHeaders, fetchAutomations, fetchAutomationStats]);

  const deleteAutomation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/automations/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Delete failed');
      setSelectedAutomation(null);
      fetchAutomations();
      fetchAutomationStats();
    } catch (err: any) {
      setRulesError(err.message);
    }
  }, [authHeaders, fetchAutomations, fetchAutomationStats]);

  const updateAutomation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/automations/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      if (!res.ok) throw new Error('Update failed');
      setSelectedAutomation(null);
      fetchAutomations();
    } catch (err: any) {
      setRulesError(err.message);
    }
  }, [authHeaders, editName, editDescription, fetchAutomations]);

  const runAutomation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/automations/${id}/run`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Run failed');
      fetchAutomations();
    } catch (err: any) {
      setRulesError(err.message);
    }
  }, [authHeaders, fetchAutomations]);

  // ---------------------------------------------------------------------------
  // Triggers fetchers
  // ---------------------------------------------------------------------------

  const fetchTriggers = useCallback(async () => {
    setTriggersLoading(true);
    setTriggersError(null);
    try {
      const res = await fetch(`${API_URL}/api/triggers`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch triggers (${res.status})`);
      const data = await res.json();
      setTriggers(data.triggers ?? []);
    } catch (err: any) {
      setTriggersError(err.message ?? 'Failed to load triggers');
    } finally {
      setTriggersLoading(false);
    }
  }, [authHeaders]);

  const fetchTriggerStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/triggers/stats`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setTriggerStats({ total: data.total ?? 0, active: data.active ?? 0, paused: data.paused ?? 0 });
    } catch {
      // Non-critical
    }
  }, [authHeaders]);

  const fetchEventTypes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/triggers/event-types`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setEventTypes(data.eventTypes ?? []);
    } catch {
      // Non-critical
    }
  }, [authHeaders]);

  const toggleTrigger = useCallback(async (trigger: Trigger) => {
    try {
      const res = await fetch(`${API_URL}/api/triggers/${trigger.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !trigger.enabled }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      setTriggers(prev =>
        prev.map(t => t.id === trigger.id ? { ...t, enabled: !t.enabled } : t)
      );
      fetchTriggerStats();
    } catch (err: any) {
      setTriggersError(err.message);
    }
  }, [authHeaders, fetchTriggerStats]);

  const createTrigger = useCallback(async () => {
    if (!newTrigger.name.trim() || !newTrigger.type) return;
    setCreatingTrigger(true);
    try {
      let conditions: any[];
      let actions: any[];
      try { conditions = JSON.parse(newTrigger.conditions); } catch { conditions = []; }
      try { actions = JSON.parse(newTrigger.actions); } catch { actions = []; }

      const res = await fetch(`${API_URL}/api/triggers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: newTrigger.name,
          description: newTrigger.description,
          type: newTrigger.type,
          priority: newTrigger.priority,
          cooldown_minutes: newTrigger.cooldown_minutes,
          conditions,
          actions,
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error('Create trigger failed');
      setShowNewTrigger(false);
      setNewTrigger({ name: '', description: '', type: '', priority: 'medium', cooldown_minutes: 60, conditions: '[]', actions: '[]' });
      fetchTriggers();
      fetchTriggerStats();
    } catch (err: any) {
      setTriggersError(err.message);
    } finally {
      setCreatingTrigger(false);
    }
  }, [newTrigger, authHeaders, fetchTriggers, fetchTriggerStats]);

  const fetchTriggerEvents = useCallback(async (triggerId: string) => {
    setTriggerEventsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/triggers/${triggerId}/events`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setTriggerEvents(data.events ?? []);
    } catch {
      setTriggerEvents([]);
    } finally {
      setTriggerEventsLoading(false);
    }
  }, [authHeaders]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (activeTab === 'rules') {
      fetchAutomations();
      fetchAutomationStats();
    }
  }, [activeTab, fetchAutomations, fetchAutomationStats]);

  useEffect(() => {
    if (activeTab === 'triggers') {
      fetchTriggers();
      fetchTriggerStats();
      fetchEventTypes();
    }
  }, [activeTab, fetchTriggers, fetchTriggerStats, fetchEventTypes]);

  useEffect(() => {
    if (selectedTrigger) {
      fetchTriggerEvents(selectedTrigger.id);
    }
  }, [selectedTrigger, fetchTriggerEvents]);

  useEffect(() => {
    if (selectedAutomation) {
      setEditName(selectedAutomation.name);
      setEditDescription(selectedAutomation.description);
    }
  }, [selectedAutomation]);

  // ---------------------------------------------------------------------------
  // Filtered data
  // ---------------------------------------------------------------------------

  const filteredAutomations = automations.filter(a => {
    if (rulesFilters.search) {
      const q = rulesFilters.search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
    }
    if (rulesFilters.status === 'enabled' && !a.enabled) return false;
    if (rulesFilters.status === 'disabled' && a.enabled) return false;
    return true;
  });

  const filteredTriggers = triggers.filter(t => {
    if (triggersFilters.search) {
      const q = triggersFilters.search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    if (triggersFilters.type && t.type !== triggersFilters.type) return false;
    return true;
  });

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------

  const rulesColumns: Column<Automation>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'trigger_type', label: 'Trigger', sortable: true },
    {
      key: 'enabled',
      label: 'Status',
      render: (a) => (
        <StatusBadge status={a.enabled ? 'enabled' : 'disabled'} />
      ),
    },
    { key: 'run_count', label: 'Runs', sortable: true, className: 'text-right' },
    {
      key: 'last_run_at',
      label: 'Last Run',
      sortable: true,
      render: (a) => <span className="text-cscx-gray-400 text-xs">{formatDate(a.last_run_at)}</span>,
    },
    {
      key: '_toggle',
      label: '',
      render: (a) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleAutomation(a); }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${a.enabled ? 'bg-cscx-accent' : 'bg-cscx-gray-700'}`}
          title={a.enabled ? 'Disable' : 'Enable'}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${a.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      ),
      className: 'w-12',
    },
  ];

  const triggersColumns: Column<Trigger>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    {
      key: 'enabled',
      label: 'Status',
      render: (t) => (
        <StatusBadge status={t.enabled ? 'enabled' : 'disabled'} />
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (t) => (
        <StatusBadge
          status={t.priority}
          colorMap={{
            low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
            medium: 'bg-blue-500/20 text-blue-400',
            high: 'badge-warning',
            critical: 'badge-error',
          }}
        />
      ),
    },
    { key: 'fire_count', label: 'Fires', sortable: true, className: 'text-right' },
    {
      key: 'last_fired_at',
      label: 'Last Fired',
      sortable: true,
      render: (t) => <span className="text-cscx-gray-400 text-xs">{formatDate(t.last_fired_at)}</span>,
    },
    {
      key: '_toggle',
      label: '',
      render: (t) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleTrigger(t); }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.enabled ? 'bg-cscx-accent' : 'bg-cscx-gray-700'}`}
          title={t.enabled ? 'Disable' : 'Enable'}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${t.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      ),
      className: 'w-12',
    },
  ];

  // ---------------------------------------------------------------------------
  // Filter configs
  // ---------------------------------------------------------------------------

  const rulesFilterConfig: FilterConfig[] = [
    { key: 'search', label: 'Search', type: 'search', placeholder: 'Search automations...' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'enabled', label: 'Enabled' },
        { value: 'disabled', label: 'Disabled' },
      ],
    },
  ];

  const triggersFilterConfig: FilterConfig[] = [
    { key: 'search', label: 'Search', type: 'search', placeholder: 'Search triggers...' },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: eventTypes.map(et => ({ value: et, label: et })),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderStatsBar = (stats: { total: number; active: number; paused: number }, label: string) => (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[
        { title: `Total ${label}`, value: stats.total, color: 'text-white' },
        { title: 'Active', value: stats.active, color: 'text-green-400' },
        { title: 'Paused', value: stats.paused, color: 'text-cscx-gray-400' },
      ].map((s) => (
        <div key={s.title} className="card p-4">
          <p className="text-xs text-cscx-gray-400 mb-1">{s.title}</p>
          <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );

  const renderError = (msg: string | null) =>
    msg ? (
      <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
        <span>{msg}</span>
        <button onClick={() => { setRulesError(null); setTriggersError(null); }} className="ml-2 text-red-400 hover:text-red-300">&times;</button>
      </div>
    ) : null;

  // ---------------------------------------------------------------------------
  // Modal: backdrop
  // ---------------------------------------------------------------------------

  const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }> = ({ open, onClose, title, children, wide }) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className={`relative bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg shadow-xl p-6 max-h-[85vh] overflow-y-auto ${wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="text-cscx-gray-400 hover:text-white text-xl leading-none">&times;</button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Tab: Rules
  // ---------------------------------------------------------------------------

  const renderRules = () => (
    <div>
      {renderStatsBar(automationStats, 'Rules')}
      {renderError(rulesError)}

      <div className="flex items-center justify-between mb-4">
        <FilterBar
          filters={rulesFilterConfig}
          values={rulesFilters}
          onChange={(k, v) => setRulesFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setRulesFilters({ search: '', status: '' })}
        />
        <button
          onClick={() => setShowNewAutomation(true)}
          className="btn btn-primary text-sm whitespace-nowrap"
        >
          + New Automation
        </button>
      </div>

      <DataTable<Automation>
        columns={rulesColumns}
        data={filteredAutomations}
        loading={rulesLoading}
        onRowClick={(a) => setSelectedAutomation(a)}
        emptyMessage="No automations found. Create one to get started."
        searchable={false}
        rowKey={(a) => a.id}
      />

      {/* New Automation Modal */}
      <Modal open={showNewAutomation} onClose={() => { setShowNewAutomation(false); setNlInput(''); setParsedResult(null); }} title="New Automation">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cscx-gray-300 mb-1">Describe your automation in plain English</label>
            <textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder='e.g. "When a customer health score drops below 60, send an alert to the CS team and create a recovery playbook"'
              rows={4}
              className="input w-full text-sm resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={parseNL}
              disabled={parsing || !nlInput.trim()}
              className="btn bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm disabled:opacity-40"
            >
              {parsing ? 'Parsing...' : 'Parse'}
            </button>
            {parsedResult && (
              <button
                onClick={createFromNL}
                disabled={creating}
                className="btn btn-primary text-sm disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'Create Automation'}
              </button>
            )}
          </div>

          {parsedResult && (
            <div className="rounded-md bg-cscx-gray-800 p-4 space-y-3">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Parsed Preview</p>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-cscx-gray-400">Name:</span>{' '}
                  <span className="text-white">{parsedResult.name}</span>
                </div>
                <div>
                  <span className="text-cscx-gray-400">Trigger:</span>
                  <pre className="mt-1 text-xs text-cscx-gray-300 bg-cscx-black rounded p-2 overflow-x-auto">{jsonPretty(parsedResult.trigger)}</pre>
                </div>
                <div>
                  <span className="text-cscx-gray-400">Conditions:</span>
                  <pre className="mt-1 text-xs text-cscx-gray-300 bg-cscx-black rounded p-2 overflow-x-auto">{jsonPretty(parsedResult.conditions)}</pre>
                </div>
                <div>
                  <span className="text-cscx-gray-400">Actions:</span>
                  <pre className="mt-1 text-xs text-cscx-gray-300 bg-cscx-black rounded p-2 overflow-x-auto">{jsonPretty(parsedResult.actions)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Automation Detail Modal */}
      <Modal
        open={!!selectedAutomation}
        onClose={() => setSelectedAutomation(null)}
        title={selectedAutomation?.name ?? 'Automation Details'}
        wide
      >
        {selectedAutomation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-cscx-gray-400 mb-1">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-cscx-gray-400 mb-1">Trigger Type</label>
                <p className="text-sm text-white mt-1">{selectedAutomation.trigger_type}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="input w-full text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-cscx-gray-400">Status:</span>{' '}
                <StatusBadge status={selectedAutomation.enabled ? 'enabled' : 'disabled'} />
              </div>
              <div>
                <span className="text-cscx-gray-400">Runs:</span>{' '}
                <span className="text-white">{selectedAutomation.run_count}</span>
              </div>
              <div>
                <span className="text-cscx-gray-400">Created:</span>{' '}
                <span className="text-cscx-gray-300">{formatDate(selectedAutomation.created_at)}</span>
              </div>
              <div>
                <span className="text-cscx-gray-400">Last Run:</span>{' '}
                <span className="text-cscx-gray-300">{formatDate(selectedAutomation.last_run_at)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-cscx-gray-400 mb-1">Trigger Config</p>
              <pre className="text-xs text-cscx-gray-300 bg-cscx-black rounded p-3 overflow-x-auto max-h-40">{jsonPretty(selectedAutomation.trigger_config)}</pre>
            </div>

            <div>
              <p className="text-xs text-cscx-gray-400 mb-1">Conditions</p>
              <pre className="text-xs text-cscx-gray-300 bg-cscx-black rounded p-3 overflow-x-auto max-h-40">{jsonPretty(selectedAutomation.conditions)}</pre>
            </div>

            <div>
              <p className="text-xs text-cscx-gray-400 mb-1">Actions</p>
              <pre className="text-xs text-cscx-gray-300 bg-cscx-black rounded p-3 overflow-x-auto max-h-40">{jsonPretty(selectedAutomation.actions)}</pre>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-cscx-gray-800">
              <button
                onClick={() => updateAutomation(selectedAutomation.id)}
                className="btn btn-primary text-sm"
              >
                Save Changes
              </button>
              <button
                onClick={() => runAutomation(selectedAutomation.id)}
                className="btn bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm"
              >
                Run Now
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { if (window.confirm('Delete this automation? This cannot be undone.')) deleteAutomation(selectedAutomation.id); }}
                className="btn bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Tab: Triggers
  // ---------------------------------------------------------------------------

  const renderTriggers = () => (
    <div>
      {renderStatsBar(triggerStats, 'Triggers')}
      {renderError(triggersError)}

      <div className="flex items-center justify-between mb-4">
        <FilterBar
          filters={triggersFilterConfig}
          values={triggersFilters}
          onChange={(k, v) => setTriggersFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setTriggersFilters({ search: '', type: '' })}
        />
        <button
          onClick={() => setShowNewTrigger(true)}
          className="btn btn-primary text-sm whitespace-nowrap"
        >
          + New Trigger
        </button>
      </div>

      <DataTable<Trigger>
        columns={triggersColumns}
        data={filteredTriggers}
        loading={triggersLoading}
        onRowClick={(t) => setSelectedTrigger(t)}
        emptyMessage="No triggers found. Create one to get started."
        searchable={false}
        rowKey={(t) => t.id}
      />

      {/* New Trigger Modal */}
      <Modal open={showNewTrigger} onClose={() => setShowNewTrigger(false)} title="New Trigger" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Name</label>
              <input
                value={newTrigger.name}
                onChange={(e) => setNewTrigger(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Trigger name"
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Event Type</label>
              <select
                value={newTrigger.type}
                onChange={(e) => setNewTrigger(prev => ({ ...prev, type: e.target.value }))}
                className="input w-full text-sm appearance-none"
              >
                <option value="">Select type...</option>
                {eventTypes.map(et => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-cscx-gray-400 mb-1">Description</label>
            <textarea
              value={newTrigger.description}
              onChange={(e) => setNewTrigger(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this trigger do?"
              rows={2}
              className="input w-full text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Priority</label>
              <select
                value={newTrigger.priority}
                onChange={(e) => setNewTrigger(prev => ({ ...prev, priority: e.target.value as any }))}
                className="input w-full text-sm appearance-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-cscx-gray-400 mb-1">Cooldown (minutes)</label>
              <input
                type="number"
                min={0}
                value={newTrigger.cooldown_minutes}
                onChange={(e) => setNewTrigger(prev => ({ ...prev, cooldown_minutes: parseInt(e.target.value) || 0 }))}
                className="input w-full text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-cscx-gray-400 mb-1">Conditions (JSON)</label>
            <textarea
              value={newTrigger.conditions}
              onChange={(e) => setNewTrigger(prev => ({ ...prev, conditions: e.target.value }))}
              rows={3}
              className="input w-full text-sm font-mono resize-none"
              placeholder="[]"
            />
          </div>

          <div>
            <label className="block text-xs text-cscx-gray-400 mb-1">Actions (JSON)</label>
            <textarea
              value={newTrigger.actions}
              onChange={(e) => setNewTrigger(prev => ({ ...prev, actions: e.target.value }))}
              rows={3}
              className="input w-full text-sm font-mono resize-none"
              placeholder="[]"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={createTrigger}
              disabled={creatingTrigger || !newTrigger.name.trim() || !newTrigger.type}
              className="btn btn-primary text-sm disabled:opacity-40"
            >
              {creatingTrigger ? 'Creating...' : 'Create Trigger'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Trigger Detail Modal */}
      <Modal
        open={!!selectedTrigger}
        onClose={() => { setSelectedTrigger(null); setTriggerEvents([]); }}
        title={selectedTrigger?.name ?? 'Trigger Details'}
        wide
      >
        {selectedTrigger && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-cscx-gray-400">Type:</span>{' '}
                <span className="text-white">{selectedTrigger.type}</span>
              </div>
              <div>
                <span className="text-cscx-gray-400">Status:</span>{' '}
                <StatusBadge status={selectedTrigger.enabled ? 'enabled' : 'disabled'} />
              </div>
              <div>
                <span className="text-cscx-gray-400">Priority:</span>{' '}
                <StatusBadge
                  status={selectedTrigger.priority}
                  colorMap={{
                    low: 'bg-cscx-gray-700/50 text-cscx-gray-400',
                    medium: 'bg-blue-500/20 text-blue-400',
                    high: 'badge-warning',
                    critical: 'badge-error',
                  }}
                />
              </div>
              <div>
                <span className="text-cscx-gray-400">Cooldown:</span>{' '}
                <span className="text-white">{selectedTrigger.cooldown_minutes} min</span>
              </div>
              <div>
                <span className="text-cscx-gray-400">Fires:</span>{' '}
                <span className="text-white">{selectedTrigger.fire_count}</span>
              </div>
              <div>
                <span className="text-cscx-gray-400">Last Fired:</span>{' '}
                <span className="text-cscx-gray-300">{formatDate(selectedTrigger.last_fired_at)}</span>
              </div>
            </div>

            {selectedTrigger.description && (
              <div>
                <p className="text-xs text-cscx-gray-400 mb-1">Description</p>
                <p className="text-sm text-cscx-gray-300">{selectedTrigger.description}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-cscx-gray-400 mb-1">Conditions</p>
              <pre className="text-xs text-cscx-gray-300 bg-cscx-black rounded p-3 overflow-x-auto max-h-32">{jsonPretty(selectedTrigger.conditions)}</pre>
            </div>

            <div>
              <p className="text-xs text-cscx-gray-400 mb-1">Actions</p>
              <pre className="text-xs text-cscx-gray-300 bg-cscx-black rounded p-3 overflow-x-auto max-h-32">{jsonPretty(selectedTrigger.actions)}</pre>
            </div>

            {/* Event History */}
            <div>
              <p className="text-xs text-cscx-gray-400 mb-2 uppercase tracking-wider">Event History</p>
              {triggerEventsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent" />
                </div>
              ) : triggerEvents.length === 0 ? (
                <p className="text-sm text-cscx-gray-400 py-4 text-center">No events recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {triggerEvents.map(ev => (
                    <div key={ev.id} className="rounded bg-cscx-gray-800 p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium">{ev.event_type}</span>
                        <span className="text-cscx-gray-400">{formatDate(ev.created_at)}</span>
                      </div>
                      <pre className="text-cscx-gray-300 overflow-x-auto">{jsonPretty(ev.result)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Tab: Runs
  // ---------------------------------------------------------------------------

  const renderRuns = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-cscx-gray-800 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-cscx-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-white text-lg font-medium mb-2">Run History</h3>
      <p className="text-cscx-gray-400 text-sm max-w-md mb-6">
        Select an automation from the Rules tab to view its detailed run history, or browse recent activity below.
      </p>

      {/* Show automations with their last run status */}
      {automations.length > 0 ? (
        <div className="w-full max-w-2xl">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-3 text-left">Recent Automation Activity</p>
          <div className="space-y-2">
            {automations
              .filter(a => a.last_run_at)
              .sort((a, b) => new Date(b.last_run_at!).getTime() - new Date(a.last_run_at!).getTime())
              .slice(0, 10)
              .map(a => (
                <div
                  key={a.id}
                  onClick={() => { setActiveTab('rules'); setSelectedAutomation(a); }}
                  className="card p-3 flex items-center justify-between cursor-pointer hover:bg-cscx-gray-800/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={a.enabled ? 'enabled' : 'disabled'} />
                    <div>
                      <p className="text-sm text-white">{a.name}</p>
                      <p className="text-xs text-cscx-gray-400">{a.trigger_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-cscx-gray-300">{formatDate(a.last_run_at)}</p>
                    <p className="text-xs text-cscx-gray-400">{a.run_count} total runs</p>
                  </div>
                </div>
              ))}
          </div>
          {automations.filter(a => a.last_run_at).length === 0 && (
            <p className="text-sm text-cscx-gray-400 py-4 text-center">No automations have run yet.</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setActiveTab('rules')}
          className="btn btn-primary text-sm"
        >
          Go to Rules
        </button>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rules', label: 'Rules' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'runs', label: 'Runs' },
  ];

  return (
    <div className="h-full flex flex-col bg-cscx-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-cscx-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-white">Automations</h1>
          <p className="text-sm text-cscx-gray-400 mt-0.5">Manage automation rules, triggers, and run history</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-1 bg-cscx-gray-900 rounded-lg p-1 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-cscx-accent text-white rounded-md'
                  : 'text-cscx-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'rules' && renderRules()}
        {activeTab === 'triggers' && renderTriggers()}
        {activeTab === 'runs' && renderRuns()}
      </div>
    </div>
  );
};
