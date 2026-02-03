/**
 * Webhook Manager Component - PRD-210
 *
 * Provides UI for managing:
 * - Outbound webhooks (CSCX.AI -> Zapier/External)
 * - Inbound webhook tokens (External -> CSCX.AI)
 * - Webhook testing and delivery logs
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InboundToken {
  id: string;
  name: string;
  actionType: string;
  token: string;
  webhookUrl: string;
  fieldMapping: Record<string, string>;
  active: boolean;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  eventType: string;
  status: string;
  responseStatus?: number;
  error?: string;
  deliveredAt?: string;
  createdAt: string;
}

const EVENT_TYPES = [
  { key: 'health_score.changed', name: 'Health Score Changed' },
  { key: 'health_score.critical', name: 'Health Score Critical' },
  { key: 'customer.created', name: 'New Customer' },
  { key: 'customer.updated', name: 'Customer Updated' },
  { key: 'risk_signal.created', name: 'Risk Signal Detected' },
  { key: 'renewal.approaching', name: 'Renewal Approaching' },
  { key: 'renewal.at_risk', name: 'Renewal At Risk' },
  { key: 'task.created', name: 'Task Created' },
  { key: 'task.completed', name: 'Task Completed' },
  { key: 'approval.requested', name: 'Approval Requested' },
  { key: 'nps.received', name: 'NPS Response Received' },
  { key: 'support_ticket.created', name: 'Support Ticket Created' },
  { key: 'support_ticket.escalated', name: 'Support Ticket Escalated' },
  { key: 'meeting.scheduled', name: 'Meeting Scheduled' },
  { key: 'meeting.completed', name: 'Meeting Completed' },
];

const ACTION_TYPES = [
  { key: 'create_customer', name: 'Create Customer' },
  { key: 'update_customer', name: 'Update Customer' },
  { key: 'add_stakeholder', name: 'Add Stakeholder' },
  { key: 'log_activity', name: 'Log Activity' },
  { key: 'create_task', name: 'Create Task' },
  { key: 'create_risk_signal', name: 'Create Risk Signal' },
  { key: 'update_health_score', name: 'Update Health Score' },
];

export function WebhookManager() {
  const { user, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound'>('outbound');

  // Outbound webhooks state
  const [outboundWebhooks, setOutboundWebhooks] = useState<OutboundWebhook[]>([]);
  const [loadingOutbound, setLoadingOutbound] = useState(true);
  const [showCreateOutbound, setShowCreateOutbound] = useState(false);
  const [newOutboundWebhook, setNewOutboundWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  // Inbound tokens state
  const [inboundTokens, setInboundTokens] = useState<InboundToken[]>([]);
  const [loadingInbound, setLoadingInbound] = useState(true);
  const [showCreateInbound, setShowCreateInbound] = useState(false);
  const [newInboundToken, setNewInboundToken] = useState({
    name: '',
    actionType: 'log_activity',
  });

  // Delivery logs state
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Test results
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchOutboundWebhooks();
      fetchInboundTokens();
    }
  }, [user?.id]);

  const fetchOutboundWebhooks = async () => {
    setLoadingOutbound(true);
    try {
      const response = await fetch(
        `${API_URL}/api/webhooks/outbound?userId=${user?.id}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setOutboundWebhooks(data.webhooks || []);
      }
    } catch (err) {
      console.error('Failed to fetch outbound webhooks:', err);
    } finally {
      setLoadingOutbound(false);
    }
  };

  const fetchInboundTokens = async () => {
    setLoadingInbound(true);
    try {
      const response = await fetch(
        `${API_URL}/api/webhooks/inbound-tokens?userId=${user?.id}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setInboundTokens(data.tokens || []);
      }
    } catch (err) {
      console.error('Failed to fetch inbound tokens:', err);
    } finally {
      setLoadingInbound(false);
    }
  };

  const fetchDeliveryLogs = async (webhookId: string) => {
    setLoadingLogs(true);
    setSelectedWebhookId(webhookId);
    try {
      const response = await fetch(
        `${API_URL}/api/webhooks/outbound/${webhookId}/logs?limit=20`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setDeliveryLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch delivery logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const createOutboundWebhook = async () => {
    if (!newOutboundWebhook.name || !newOutboundWebhook.url || newOutboundWebhook.events.length === 0) {
      setError('Please fill in all fields and select at least one event');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/webhooks/outbound`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          ...newOutboundWebhook,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`Webhook created! Secret: ${data.webhook.secret}`);
        setShowCreateOutbound(false);
        setNewOutboundWebhook({ name: '', url: '', events: [] });
        fetchOutboundWebhooks();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create webhook');
      }
    } catch (err) {
      setError('Failed to create webhook');
    }
  };

  const createInboundToken = async () => {
    if (!newInboundToken.name || !newInboundToken.actionType) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/webhooks/inbound-tokens`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          ...newInboundToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`Inbound webhook created! URL: ${data.webhook.webhookUrl}`);
        setShowCreateInbound(false);
        setNewInboundToken({ name: '', actionType: 'log_activity' });
        fetchInboundTokens();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create inbound webhook');
      }
    } catch (err) {
      setError('Failed to create inbound webhook');
    }
  };

  const testWebhook = async (webhookId: string) => {
    setTestResult(null);
    try {
      const response = await fetch(`${API_URL}/api/webhooks/outbound/${webhookId}/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? `Test delivered successfully (Status: ${data.responseStatus})`
          : `Test failed: ${data.error}`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Failed to send test webhook',
      });
    }
  };

  const deleteOutboundWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`${API_URL}/api/webhooks/outbound/${webhookId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setSuccessMessage('Webhook deleted');
        fetchOutboundWebhooks();
      }
    } catch (err) {
      setError('Failed to delete webhook');
    }
  };

  const deleteInboundToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to delete this inbound webhook?')) return;

    try {
      const response = await fetch(`${API_URL}/api/webhooks/inbound-tokens/${tokenId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setSuccessMessage('Inbound webhook deleted');
        fetchInboundTokens();
      }
    } catch (err) {
      setError('Failed to delete inbound webhook');
    }
  };

  const toggleEventSelection = (eventKey: string) => {
    setNewOutboundWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventKey)
        ? prev.events.filter((e) => e !== eventKey)
        : [...prev.events, eventKey],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Copied to clipboard!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Webhook Management</h1>
        <p className="text-gray-400">
          Configure webhooks to connect CSCX.AI with Zapier and other external services.
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-4 text-green-400 hover:text-green-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-cscx-gray-800">
        <button
          onClick={() => setActiveTab('outbound')}
          className={`pb-4 px-2 font-medium transition-colors ${
            activeTab === 'outbound'
              ? 'text-cscx-accent border-b-2 border-cscx-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Outbound Webhooks
        </button>
        <button
          onClick={() => setActiveTab('inbound')}
          className={`pb-4 px-2 font-medium transition-colors ${
            activeTab === 'inbound'
              ? 'text-cscx-accent border-b-2 border-cscx-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Inbound Webhooks
        </button>
      </div>

      {/* Outbound Webhooks Tab */}
      {activeTab === 'outbound' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white">
              Outbound Webhooks (CSCX.AI to External)
            </h2>
            <button
              onClick={() => setShowCreateOutbound(true)}
              className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80 transition-colors"
            >
              + New Webhook
            </button>
          </div>

          {/* Create Outbound Modal */}
          {showCreateOutbound && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-cscx-gray-900 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-white mb-4">Create Outbound Webhook</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={newOutboundWebhook.name}
                      onChange={(e) => setNewOutboundWebhook((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Slack Health Alerts"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
                    <input
                      type="url"
                      value={newOutboundWebhook.url}
                      onChange={(e) => setNewOutboundWebhook((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://hooks.zapier.com/..."
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Events to Trigger</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {EVENT_TYPES.map((event) => (
                        <label key={event.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newOutboundWebhook.events.includes(event.key)}
                            onChange={() => toggleEventSelection(event.key)}
                            className="rounded bg-cscx-gray-800 border-cscx-gray-700"
                          />
                          <span className="text-gray-300">{event.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateOutbound(false)}
                    className="flex-1 px-4 py-2 bg-cscx-gray-800 text-gray-300 rounded-lg hover:bg-cscx-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createOutboundWebhook}
                    className="flex-1 px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80"
                  >
                    Create Webhook
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Outbound Webhooks List */}
          {loadingOutbound ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
            </div>
          ) : outboundWebhooks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-2">No outbound webhooks configured</p>
              <p className="text-sm">Create a webhook to send CSCX.AI events to external services</p>
            </div>
          ) : (
            <div className="space-y-4">
              {outboundWebhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{webhook.name}</h3>
                      <p className="text-sm text-gray-400 truncate max-w-md">{webhook.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          webhook.active
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-gray-900 text-gray-400'
                        }`}
                      >
                        {webhook.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-0.5 bg-cscx-gray-800 text-gray-300 rounded text-xs"
                      >
                        {event}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => testWebhook(webhook.id)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => fetchDeliveryLogs(webhook.id)}
                      className="px-3 py-1 text-sm bg-cscx-gray-800 text-gray-300 rounded hover:bg-cscx-gray-700"
                    >
                      View Logs
                    </button>
                    <button
                      onClick={() => deleteOutboundWebhook(webhook.id)}
                      className="px-3 py-1 text-sm bg-red-900/50 text-red-400 rounded hover:bg-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-900/50 border border-green-500 text-green-200'
                  : 'bg-red-900/50 border border-red-500 text-red-200'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {/* Delivery Logs */}
          {selectedWebhookId && (
            <div className="mt-6 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">Delivery Logs</h3>
                <button
                  onClick={() => setSelectedWebhookId(null)}
                  className="text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {loadingLogs ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
                </div>
              ) : deliveryLogs.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No delivery logs yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {deliveryLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 bg-cscx-gray-800 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            log.status === 'delivered'
                              ? 'bg-green-500'
                              : log.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                        <span className="text-sm text-gray-300">{log.eventType}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {log.responseStatus && (
                          <span className="text-gray-400">HTTP {log.responseStatus}</span>
                        )}
                        <span className="text-gray-500">{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inbound Webhooks Tab */}
      {activeTab === 'inbound' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white">
              Inbound Webhooks (External to CSCX.AI)
            </h2>
            <button
              onClick={() => setShowCreateInbound(true)}
              className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80 transition-colors"
            >
              + New Inbound Webhook
            </button>
          </div>

          {/* Create Inbound Modal */}
          {showCreateInbound && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-cscx-gray-900 rounded-lg p-6 max-w-lg w-full mx-4">
                <h3 className="text-xl font-bold text-white mb-4">Create Inbound Webhook</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={newInboundToken.name}
                      onChange={(e) => setNewInboundToken((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Typeform Submissions"
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Action Type</label>
                    <select
                      value={newInboundToken.actionType}
                      onChange={(e) => setNewInboundToken((prev) => ({ ...prev, actionType: e.target.value }))}
                      className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white"
                    >
                      {ACTION_TYPES.map((action) => (
                        <option key={action.key} value={action.key}>
                          {action.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateInbound(false)}
                    className="flex-1 px-4 py-2 bg-cscx-gray-800 text-gray-300 rounded-lg hover:bg-cscx-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createInboundToken}
                    className="flex-1 px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80"
                  >
                    Create Webhook
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inbound Tokens List */}
          {loadingInbound ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
            </div>
          ) : inboundTokens.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-2">No inbound webhooks configured</p>
              <p className="text-sm">Create an inbound webhook to receive data from Zapier or other services</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inboundTokens.map((token) => (
                <div
                  key={token.id}
                  className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{token.name}</h3>
                      <p className="text-sm text-gray-400">
                        Action: {ACTION_TYPES.find((a) => a.key === token.actionType)?.name || token.actionType}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        token.active
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-gray-900 text-gray-400'
                      }`}
                    >
                      {token.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="bg-cscx-gray-800 rounded p-2 mb-3">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-cscx-accent break-all">{token.webhookUrl}</code>
                      <button
                        onClick={() => copyToClipboard(token.webhookUrl)}
                        className="ml-2 px-2 py-1 text-xs bg-cscx-gray-700 text-gray-300 rounded hover:bg-cscx-gray-600"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteInboundToken(token.id)}
                      className="px-3 py-1 text-sm bg-red-900/50 text-red-400 rounded hover:bg-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zapier Setup Instructions */}
          <div className="mt-8 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4">Zapier Setup Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Create a new Zap in Zapier</li>
              <li>Choose your trigger app (e.g., Typeform, Slack, Gmail)</li>
              <li>Select Webhooks by Zapier as your action</li>
              <li>Choose POST method</li>
              <li>Copy the webhook URL from above and paste it in Zapier</li>
              <li>Configure your payload format as JSON</li>
              <li>Map your trigger data to the expected fields (customer_id, name, etc.)</li>
              <li>Test and enable your Zap</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebhookManager;
