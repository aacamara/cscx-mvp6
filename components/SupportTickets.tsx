/**
 * SupportTickets - Support Ticket Management
 * PRD-4: Support Tickets View
 * Create and view support tickets with AI troubleshooting suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface Ticket {
  id: string;
  customerId: string;
  customerName?: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt?: string;
  assignedTo?: string;
  troubleshootingSuggestions?: string[];
}

interface SupportTicketsProps {
  customerId?: string;
  onClose?: () => void;
}

export const SupportTickets: React.FC<SupportTicketsProps> = ({ customerId, onClose }) => {
  const { getAuthHeaders } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // New ticket form state
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium' as Ticket['priority'],
    customerId: customerId || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // PRD-017: Customer search state for dropdown
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (filter !== 'all') params.append('status', filter);

      const response = await fetch(`${API_BASE}/support/tickets?${params}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch tickets');
      const data = await response.json();
      setTickets(data.tickets || []);
      setError(null);
    } catch (err) {
      // If endpoint doesn't exist yet, show empty state
      setTickets([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, filter, getAuthHeaders]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // PRD-017: Fetch customers when search changes
  useEffect(() => {
    if (!customerId && customerSearch.length > 0) {
      const fetchCustomers = async () => {
        setLoadingCustomers(true);
        try {
          const response = await fetch(`${API_BASE}/customers?search=${encodeURIComponent(customerSearch)}&limit=10`, {
            headers: getAuthHeaders()
          });
          if (response.ok) {
            const data = await response.json();
            setCustomers(data.customers || data || []);
          }
        } catch (err) {
          console.error('Failed to fetch customers:', err);
        } finally {
          setLoadingCustomers(false);
        }
      };
      fetchCustomers();
    } else if (customerSearch.length === 0) {
      setCustomers([]);
    }
  }, [customerSearch, customerId, getAuthHeaders]);

  // PRD-017: Handle customer selection from dropdown
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setNewTicket(prev => ({ ...prev, customerId: customer.id }));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.description) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(newTicket)
      });

      if (!response.ok) throw new Error('Failed to create ticket');

      const data = await response.json();

      // Show AI suggestions if provided
      if (data.troubleshootingSuggestions) {
        setAiSuggestions(data.troubleshootingSuggestions);
      }

      // Add new ticket to list
      setTickets(prev => [data.ticket, ...prev]);

      // Reset form
      setNewTicket({
        subject: '',
        description: '',
        priority: 'medium',
        customerId: customerId || ''
      });
      setCustomerSearch('');
      setSelectedCustomer(null);
      setShowNewTicket(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-cscx-gray-800 text-cscx-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/20 text-blue-400';
      case 'in_progress': return 'bg-yellow-500/20 text-yellow-400';
      case 'resolved': return 'bg-green-500/20 text-green-400';
      case 'closed': return 'bg-cscx-gray-800 text-cscx-gray-400';
      default: return 'bg-cscx-gray-800 text-cscx-gray-400';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cscx-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Support Tickets</h2>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {customerId ? 'Customer support tickets' : 'All support tickets'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewTicket(true)}
            className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* AI Suggestions Banner */}
      {aiSuggestions.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-400">AI Troubleshooting Suggestions</h4>
              <ul className="mt-2 space-y-1">
                {aiSuggestions.map((suggestion, i) => (
                  <li key={i} className="text-sm text-cscx-gray-300 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setAiSuggestions([])}
              className="text-cscx-gray-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-cscx-gray-800 pb-2">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === status
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* New Ticket Form */}
      {showNewTicket && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Create New Ticket</h3>
          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div>
              <label className="block text-sm text-cscx-gray-400 mb-1">Subject</label>
              <input
                type="text"
                value={newTicket.subject}
                onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Brief description of the issue"
                className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-cscx-gray-400 mb-1">Description</label>
              <textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the issue, steps to reproduce, etc."
                rows={4}
                className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-cscx-gray-400 mb-1">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as Ticket['priority'] }))}
                  className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              {!customerId && (
                <div className="relative">
                  <label className="block text-sm text-cscx-gray-400 mb-1">Customer</label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search customer by name..."
                    className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    required
                  />
                  {showCustomerDropdown && customerSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {loadingCustomers ? (
                        <div className="p-4 text-center text-cscx-gray-400">Loading customers...</div>
                      ) : customers.length > 0 ? (
                        customers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleCustomerSelect(customer)}
                            className="w-full px-4 py-3 text-left hover:bg-cscx-gray-700 transition-colors border-b border-cscx-gray-700 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-medium">{customer.name}</div>
                                <div className="text-xs text-cscx-gray-400 mt-0.5">
                                  {customer.industry || 'No industry'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-cscx-gray-400">
                                  Health: {customer.health_score || 'N/A'}
                                </div>
                                <div className="text-xs text-cscx-gray-400">
                                  ARR: ${((customer.arr || 0) / 1000).toFixed(0)}K
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-cscx-gray-400">No customers found</div>
                      )}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="mt-2 p-2 bg-cscx-gray-700 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-cscx-gray-300">
                        Selected: {selectedCustomer.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearch('');
                          setNewTicket(prev => ({ ...prev, customerId: '' }));
                        }}
                        className="text-cscx-gray-400 hover:text-white"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                )}
                Create Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 text-cscx-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-cscx-gray-400">No tickets found</p>
          <p className="text-sm text-cscx-gray-500 mt-1">Create a new ticket to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 hover:border-cscx-gray-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="text-white font-medium">{ticket.subject}</h4>
                  <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">{ticket.description}</p>
                </div>
                <div className="text-right text-xs text-cscx-gray-500">
                  <p>{formatDate(ticket.createdAt)}</p>
                  <p className="mt-1">{ticket.id.slice(0, 8)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Ticket Details</h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(selectedTicket.priority)}`}>
                  {selectedTicket.priority}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(selectedTicket.status)}`}>
                  {selectedTicket.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-cscx-gray-500">{selectedTicket.id}</span>
              </div>
              <div>
                <h4 className="text-xl font-medium text-white">{selectedTicket.subject}</h4>
                <p className="text-sm text-cscx-gray-400 mt-1">Created {formatDate(selectedTicket.createdAt)}</p>
              </div>
              <div className="bg-cscx-gray-800 rounded-lg p-4">
                <p className="text-cscx-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              {selectedTicket.troubleshootingSuggestions && selectedTicket.troubleshootingSuggestions.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-400 mb-2">AI Suggestions</h5>
                  <ul className="space-y-1">
                    {selectedTicket.troubleshootingSuggestions.map((suggestion, i) => (
                      <li key={i} className="text-sm text-cscx-gray-300 flex items-start gap-2">
                        <span className="text-blue-400">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTickets;
