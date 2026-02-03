/**
 * Segment Integration Component - PRD-198
 *
 * Configuration UI for Segment.io data sync:
 * - Connection setup with write key
 * - Event mapping configuration
 * - Real-time event monitor
 * - Test event sender
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

interface SegmentConfig {
  writeKey: string;
  webhookUrl: string;
  enabled: boolean;
  settings: {
    processIdentify: boolean;
    processGroup: boolean;
    processTrack: boolean;
    matchByEmail: boolean;
    matchByUserId: boolean;
    matchByGroupId: boolean;
    createUnknownUsers: boolean;
  };
  stats: {
    eventsReceived: number;
    eventsProcessed: number;
    eventsFailed: number;
    lastEventAt: string | null;
  };
}

interface SegmentMapping {
  id: string;
  segmentEvent: string;
  cscxSignalType: string;
  propertyMappings: Record<string, string>;
  signalPriority: 'low' | 'medium' | 'high' | 'critical';
  triggerHealthUpdate: boolean;
  triggerAlert: boolean;
  enabled: boolean;
}

interface EventStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
  bySignal: Record<string, number>;
}

type TabType = 'setup' | 'mappings' | 'monitor' | 'test';

export function SegmentIntegration() {
  const { user, getAuthHeaders } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('setup');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SegmentConfig | null>(null);
  const [mappings, setMappings] = useState<SegmentMapping[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Test event state
  const [testEventType, setTestEventType] = useState<string>('track');
  const [testEventName, setTestEventName] = useState<string>('Feature Used');
  const [testLoading, setTestLoading] = useState(false);

  // New mapping form state
  const [newMapping, setNewMapping] = useState<Partial<SegmentMapping>>({
    segmentEvent: '',
    cscxSignalType: 'adoption',
    signalPriority: 'medium',
    triggerHealthUpdate: true,
    triggerAlert: false,
    enabled: true,
    propertyMappings: {},
  });
  const [showNewMappingForm, setShowNewMappingForm] = useState(false);

  // Load configuration
  const loadConfig = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/integrations/segment/config?userId=${user.id}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setConfig(data.connection);
      } else {
        setError('Failed to load Segment configuration');
      }
    } catch (err) {
      setError('Error loading configuration');
      console.error('Load config error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, getAuthHeaders]);

  // Load mappings
  const loadMappings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/integrations/segment/mappings`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setMappings(data.mappings || []);
      }
    } catch (err) {
      console.error('Load mappings error:', err);
    }
  }, [getAuthHeaders]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(
        `${API_URL}/api/integrations/segment/stats?userId=${user.id}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Load stats error:', err);
    }
  }, [user?.id, getAuthHeaders]);

  // Initial load
  useEffect(() => {
    loadConfig();
    loadMappings();
    loadStats();
  }, [loadConfig, loadMappings, loadStats]);

  // Update settings
  const updateSettings = async (settings: Partial<SegmentConfig['settings']>) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_URL}/api/integrations/segment/config`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, settings }),
      });

      if (response.ok) {
        setSuccess('Settings updated successfully');
        loadConfig();
      } else {
        setError('Failed to update settings');
      }
    } catch (err) {
      setError('Error updating settings');
    }
  };

  // Regenerate write key
  const regenerateWriteKey = async () => {
    if (!user?.id) return;
    if (!confirm('Are you sure? This will invalidate your current write key.')) return;

    try {
      const response = await fetch(`${API_URL}/api/integrations/segment/regenerate-key`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        setSuccess('Write key regenerated. Update your Segment destination.');
        loadConfig();
      } else {
        setError('Failed to regenerate write key');
      }
    } catch (err) {
      setError('Error regenerating write key');
    }
  };

  // Save new mapping
  const saveMapping = async () => {
    if (!newMapping.segmentEvent || !newMapping.cscxSignalType) {
      setError('Event name and signal type are required');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/integrations/segment/mappings`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mappings: [newMapping] }),
      });

      if (response.ok) {
        setSuccess('Mapping saved successfully');
        setShowNewMappingForm(false);
        setNewMapping({
          segmentEvent: '',
          cscxSignalType: 'adoption',
          signalPriority: 'medium',
          triggerHealthUpdate: true,
          triggerAlert: false,
          enabled: true,
          propertyMappings: {},
        });
        loadMappings();
      } else {
        setError('Failed to save mapping');
      }
    } catch (err) {
      setError('Error saving mapping');
    }
  };

  // Delete mapping
  const deleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const response = await fetch(
        `${API_URL}/api/integrations/segment/mappings/${mappingId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );

      if (response.ok) {
        setSuccess('Mapping deleted');
        loadMappings();
      } else {
        setError('Failed to delete mapping');
      }
    } catch (err) {
      setError('Error deleting mapping');
    }
  };

  // Toggle mapping enabled
  const toggleMapping = async (mapping: SegmentMapping) => {
    try {
      const response = await fetch(`${API_URL}/api/integrations/segment/mappings`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mappings: [{ ...mapping, enabled: !mapping.enabled }],
        }),
      });

      if (response.ok) {
        loadMappings();
      }
    } catch (err) {
      console.error('Toggle mapping error:', err);
    }
  };

  // Send test event
  const sendTestEvent = async () => {
    if (!user?.id) return;

    try {
      setTestLoading(true);
      const response = await fetch(`${API_URL}/api/integrations/segment/test`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          eventType: testEventType,
          eventName: testEventName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        loadStats();
      } else {
        setError(data.message || 'Test event failed');
      }
    } catch (err) {
      setError('Error sending test event');
    } finally {
      setTestLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(`${label} copied to clipboard`);
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Segment Integration</h2>
            <p className="text-sm text-cscx-gray-400">
              Receive real-time usage events from your Segment workspace
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                config?.enabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-cscx-gray-700 text-cscx-gray-400'
              }`}
            >
              {config?.enabled ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-cscx-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
              <p className="text-sm text-cscx-gray-400">Events Received</p>
            </div>
            <div className="bg-cscx-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-400">{stats.processed.toLocaleString()}</p>
              <p className="text-sm text-cscx-gray-400">Processed</p>
            </div>
            <div className="bg-cscx-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-red-400">{stats.failed.toLocaleString()}</p>
              <p className="text-sm text-cscx-gray-400">Failed</p>
            </div>
            <div className="bg-cscx-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-yellow-400">{stats.pending.toLocaleString()}</p>
              <p className="text-sm text-cscx-gray-400">Pending</p>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-400">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['setup', 'mappings', 'monitor', 'test'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab === 'setup' ? 'Setup' : tab === 'mappings' ? 'Event Mappings' : tab === 'monitor' ? 'Monitor' : 'Test'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800">
        {/* Setup Tab */}
        {activeTab === 'setup' && config && (
          <div className="p-6 space-y-6">
            {/* Connection Details */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Connection Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-cscx-gray-400 mb-2">Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={config.webhookUrl}
                      readOnly
                      className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white text-sm font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(config.webhookUrl, 'Webhook URL')}
                      className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-cscx-gray-400 mb-2">Write Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={config.writeKey}
                      readOnly
                      className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white text-sm font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(config.writeKey, 'Write Key')}
                      className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      onClick={regenerateWriteKey}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="bg-cscx-gray-800 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Setup Instructions</h4>
              <ol className="space-y-2 text-sm text-cscx-gray-300">
                <li className="flex items-start gap-2">
                  <span className="bg-cscx-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                  <span>Go to your Segment workspace</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-cscx-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                  <span>Navigate to Connections &gt; Destinations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-cscx-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                  <span>Add a new &quot;Webhooks&quot; destination</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-cscx-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">4</span>
                  <span>Set the webhook URL to the URL above</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-cscx-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">5</span>
                  <span>Configure Basic Auth with your Write Key as the username</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-cscx-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">6</span>
                  <span>Enable the destination and select which sources to connect</span>
                </li>
              </ol>
            </div>

            {/* Settings */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Processing Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 bg-cscx-gray-800 rounded-lg p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.processTrack}
                    onChange={(e) => updateSettings({ processTrack: e.target.checked })}
                    className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-700 text-cscx-accent focus:ring-cscx-accent"
                  />
                  <div>
                    <p className="text-white font-medium">Process Track Events</p>
                    <p className="text-sm text-cscx-gray-400">Feature usage, actions, etc.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-cscx-gray-800 rounded-lg p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.processIdentify}
                    onChange={(e) => updateSettings({ processIdentify: e.target.checked })}
                    className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-700 text-cscx-accent focus:ring-cscx-accent"
                  />
                  <div>
                    <p className="text-white font-medium">Process Identify Calls</p>
                    <p className="text-sm text-cscx-gray-400">User trait updates</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-cscx-gray-800 rounded-lg p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.processGroup}
                    onChange={(e) => updateSettings({ processGroup: e.target.checked })}
                    className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-700 text-cscx-accent focus:ring-cscx-accent"
                  />
                  <div>
                    <p className="text-white font-medium">Process Group Calls</p>
                    <p className="text-sm text-cscx-gray-400">Account/organization updates</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-cscx-gray-800 rounded-lg p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.settings.matchByEmail}
                    onChange={(e) => updateSettings({ matchByEmail: e.target.checked })}
                    className="w-5 h-5 rounded border-cscx-gray-600 bg-cscx-gray-700 text-cscx-accent focus:ring-cscx-accent"
                  />
                  <div>
                    <p className="text-white font-medium">Match by Email</p>
                    <p className="text-sm text-cscx-gray-400">Link events via email address</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Mappings Tab */}
        {activeTab === 'mappings' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Event to Signal Mappings</h3>
              <button
                onClick={() => setShowNewMappingForm(true)}
                className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
              >
                + Add Mapping
              </button>
            </div>

            {/* New Mapping Form */}
            {showNewMappingForm && (
              <div className="bg-cscx-gray-800 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-cscx-gray-400 mb-1">Segment Event Name</label>
                    <input
                      type="text"
                      value={newMapping.segmentEvent}
                      onChange={(e) => setNewMapping({ ...newMapping, segmentEvent: e.target.value })}
                      placeholder="e.g., Feature Used"
                      className="w-full bg-cscx-gray-700 border border-cscx-gray-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-cscx-gray-400 mb-1">CSCX Signal Type</label>
                    <select
                      value={newMapping.cscxSignalType}
                      onChange={(e) => setNewMapping({ ...newMapping, cscxSignalType: e.target.value })}
                      className="w-full bg-cscx-gray-700 border border-cscx-gray-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="adoption">Adoption</option>
                      <option value="expansion">Expansion</option>
                      <option value="risk">Risk</option>
                      <option value="engagement">Engagement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-cscx-gray-400 mb-1">Priority</label>
                    <select
                      value={newMapping.signalPriority}
                      onChange={(e) => setNewMapping({ ...newMapping, signalPriority: e.target.value as any })}
                      className="w-full bg-cscx-gray-700 border border-cscx-gray-600 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMapping.triggerHealthUpdate}
                        onChange={(e) => setNewMapping({ ...newMapping, triggerHealthUpdate: e.target.checked })}
                        className="rounded border-cscx-gray-600 bg-cscx-gray-700 text-cscx-accent"
                      />
                      <span className="text-sm text-cscx-gray-300">Update Health Score</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMapping.triggerAlert}
                        onChange={(e) => setNewMapping({ ...newMapping, triggerAlert: e.target.checked })}
                        className="rounded border-cscx-gray-600 bg-cscx-gray-700 text-cscx-accent"
                      />
                      <span className="text-sm text-cscx-gray-300">Trigger Alert</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowNewMappingForm(false)}
                    className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveMapping}
                    className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
                  >
                    Save Mapping
                  </button>
                </div>
              </div>
            )}

            {/* Mappings List */}
            <div className="space-y-2">
              {mappings.length === 0 ? (
                <p className="text-cscx-gray-500 text-center py-8">No custom mappings configured</p>
              ) : (
                mappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className={`bg-cscx-gray-800 rounded-lg p-4 flex items-center justify-between ${
                      !mapping.enabled ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-white font-medium">{mapping.segmentEvent}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            mapping.cscxSignalType === 'adoption' ? 'bg-blue-500/20 text-blue-400' :
                            mapping.cscxSignalType === 'expansion' ? 'bg-green-500/20 text-green-400' :
                            mapping.cscxSignalType === 'risk' ? 'bg-red-500/20 text-red-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {mapping.cscxSignalType}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            mapping.signalPriority === 'critical' ? 'bg-red-500/20 text-red-400' :
                            mapping.signalPriority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            mapping.signalPriority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-cscx-gray-700 text-cscx-gray-400'
                          }`}>
                            {mapping.signalPriority}
                          </span>
                          {mapping.triggerHealthUpdate && (
                            <span className="text-xs text-cscx-gray-400">Health Update</span>
                          )}
                          {mapping.triggerAlert && (
                            <span className="text-xs text-orange-400">Alert</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleMapping(mapping)}
                        className={`px-3 py-1 rounded text-sm ${
                          mapping.enabled
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-cscx-gray-700 text-cscx-gray-400'
                        }`}
                      >
                        {mapping.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => deleteMapping(mapping.id)}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Monitor Tab */}
        {activeTab === 'monitor' && stats && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Event Statistics</h3>

            {/* By Type */}
            <div>
              <h4 className="text-white font-medium mb-3">By Event Type</h4>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="bg-cscx-gray-800 rounded-lg p-4">
                    <p className="text-xl font-bold text-white">{count.toLocaleString()}</p>
                    <p className="text-sm text-cscx-gray-400 capitalize">{type}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* By Signal */}
            <div>
              <h4 className="text-white font-medium mb-3">By Signal Type</h4>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(stats.bySignal).map(([signal, count]) => (
                  <div key={signal} className="bg-cscx-gray-800 rounded-lg p-4">
                    <p className="text-xl font-bold text-white">{count.toLocaleString()}</p>
                    <p className="text-sm text-cscx-gray-400 capitalize">{signal}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={loadStats}
              className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
            >
              Refresh Stats
            </button>
          </div>
        )}

        {/* Test Tab */}
        {activeTab === 'test' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Send Test Event</h3>
            <p className="text-cscx-gray-400">
              Send a test event to verify your integration is working correctly.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-1">Event Type</label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="track">Track</option>
                  <option value="identify">Identify</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-1">Event Name</label>
                <input
                  type="text"
                  value={testEventName}
                  onChange={(e) => setTestEventName(e.target.value)}
                  placeholder="Feature Used"
                  className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>

            <button
              onClick={sendTestEvent}
              disabled={testLoading}
              className="px-6 py-2 bg-cscx-accent hover:bg-cscx-accent/80 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {testLoading ? 'Sending...' : 'Send Test Event'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SegmentIntegration;
