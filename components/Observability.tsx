/**
 * Observability Dashboard
 * Unified view of customer portfolio with CS metrics, health scores,
 * and links to Google Workspace resources (Drive, Sheets, QBRs)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AccountBriefing } from './AccountBriefing';
import { HealthScorePortfolio } from './HealthScorePortfolio';
import { isAccountBriefingCommand, extractAccountName } from '../hooks/useAccountBriefing';
import { isRevenueAnalyticsCommand } from '../hooks/useRevenueAnalytics';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  mrr?: number;
  health_score: number;
  status: 'active' | 'onboarding' | 'at_risk' | 'churned';
  renewal_date?: string;
  contract_start?: string;
  csm_name?: string;
  tier?: 'enterprise' | 'strategic' | 'commercial' | 'smb';
  nps_score?: number;
  product_adoption?: number;
  last_activity_days?: number;
  open_tickets?: number;
  expansion_potential?: 'low' | 'medium' | 'high';
  risk_level?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  contacts_count?: number;
  drive_root_id?: string;
  onboarding_sheet_id?: string;
  primary_contact?: {
    name: string;
    email: string;
    title?: string;
  };
}

interface DashboardMetrics {
  revenue: {
    mrr: number;
    arr: number;
    newMRR: number;
    expansionMRR: number;
    contractionMRR: number;
    churnedMRR: number;
    arpu: number;
  };
  retention: {
    nrr: number;
    grr: number;
    customerRetentionRate: number;
    customerChurnRate: number;
  };
  ltv: {
    ltv: number;
    cac: number;
    ltvCacRatio: number;
    cacPaybackMonths: number;
  };
  satisfaction: {
    nps: { nps: number; totalResponses: number };
    csat: number;
    ces: number;
  };
  healthDistribution: {
    critical: number;
    atRisk: number;
    neutral: number;
    healthy: number;
    champion: number;
  };
}

interface AgentActivity {
  id: string;
  type: 'activity';
  agentType: string;
  actionType: string;
  status: string;
  actionData: Record<string, any>;
  resultData?: Record<string, any>;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  sessionId?: string;
}

interface PendingApproval {
  id: string;
  type: 'approval';
  actionType: string;
  actionData: Record<string, any>;
  originalContent?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentType?: string;
  toolCalls?: any[];
  createdAt: string;
}

interface AgentInbox {
  activities: AgentActivity[];
  pendingApprovals: PendingApproval[];
  completedApprovals: any[];
  chatHistory: ChatMessage[];
  summary: {
    totalActivities: number;
    pendingApprovals: number;
    completedToday: number;
  };
}

interface ObservabilityProps {
  onSelectCustomer?: (customer: Customer) => void;
  onNewOnboarding?: () => void;
  initialSelectedCustomerId?: string | null;
  initialTab?: 'overview' | 'customers' | 'metrics' | 'health-portfolio' | 'engagement' | 'revenue';
}

// ============================================
// COMPONENT
// ============================================

export const Observability: React.FC<ObservabilityProps> = ({
  onSelectCustomer,
  onNewOnboarding,
  initialSelectedCustomerId,
  initialTab
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('arr');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'health-portfolio'>(initialTab || 'overview');

  // Engagement metrics state (PRD-157)
  const [engagementCustomerId, setEngagementCustomerId] = useState<string | undefined>(undefined);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialSelectedCustomerId || null);

  // Agent inbox state
  const [agentInbox, setAgentInbox] = useState<AgentInbox | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Customer metrics state
  const [customerMetrics, setCustomerMetrics] = useState<{
    daysSinceOnboard: number;
    activeUsers: number;
    featureAdoption: number;
    supportTickets: number;
  } | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Summary state
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalArr: 0,
    avgHealth: 0,
    atRiskCount: 0
  });

  // Account briefing state (PRD-056)
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [briefingAccountName, setBriefingAccountName] = useState<string | undefined>(undefined);
  const [briefingCustomerId, setBriefingCustomerId] = useState<string | undefined>(undefined);
  const [commandInput, setCommandInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch customers and metrics in parallel
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const [customersRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/customers?${params}`),
        fetch(`${API_BASE}/metrics/dashboard`)
      ]);

      if (!customersRes.ok) throw new Error('Failed to fetch customers');

      const customersData = await customersRes.json();
      setCustomers(customersData.customers || []);
      setSummary(customersData.summary || {
        totalCustomers: 0,
        totalArr: 0,
        avgHealth: 0,
        atRiskCount: 0
      });

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle initial customer selection from parent
  useEffect(() => {
    if (initialSelectedCustomerId && initialTab === 'metrics') {
      setSelectedCustomerId(initialSelectedCustomerId);
      setActiveTab('metrics');
    }
  }, [initialSelectedCustomerId, initialTab]);

  // Fetch agent inbox when customer is selected
  const fetchAgentInbox = useCallback(async (customerId: string) => {
    setInboxLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const res = await fetch(`${API_BASE}/agent-activities/customer/${customerId}`, {
        headers: { 'x-user-id': userId }
      });
      if (res.ok) {
        const data = await res.json();
        setAgentInbox(data);
      }
    } catch (err) {
      console.error('Failed to fetch agent inbox:', err);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  // Fetch customer metrics when customer is selected
  const fetchCustomerMetrics = useCallback(async (customerId: string) => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/metrics`);
      if (res.ok) {
        const data = await res.json();
        setCustomerMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch customer metrics:', err);
      setCustomerMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  }, []);


  // Get selected customer object
  const selectedCustomer = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)
    : null;

  // Handle customer click in Customers tab -> open customer detail
  const handleCustomerClick = (customer: Customer) => {
    onSelectCustomer?.(customer);
  };

  // Handle approval action
  const handleApprovalAction = async (approvalId: string, action: 'approve' | 'reject') => {
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const res = await fetch(`${API_BASE}/approvals/${approvalId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        }
      });
      if (res.ok && selectedCustomerId) {
        fetchAgentInbox(selectedCustomerId); // Refresh inbox
      }
    } catch (err) {
      console.error(`Failed to ${action} approval:`, err);
    }
  };

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      onboarding: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      at_risk: 'bg-red-500/20 text-red-400 border-red-500/30',
      churned: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return styles[status] || styles.active;
  };

  const getBenchmarkColor = (metric: string, value: number) => {
    const thresholds: Record<string, { good: number; excellent: number }> = {
      nrr: { good: 100, excellent: 120 },
      grr: { good: 90, excellent: 95 },
      nps: { good: 20, excellent: 50 },
      ltvCac: { good: 3, excellent: 4 }
    };
    const t = thresholds[metric];
    if (!t) return 'text-white';
    if (value >= t.excellent) return 'text-green-400';
    if (value >= t.good) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const openGoogleDrive = (folderId: string | undefined) => {
    if (folderId) {
      window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
    }
  };

  const openGoogleSheet = (sheetId: string | undefined) => {
    if (sheetId) {
      window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '_blank');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading observability dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchData}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Calculate health distribution for chart
  const healthDistribution = metrics?.healthDistribution || {
    critical: 0,
    atRisk: 0,
    neutral: 0,
    healthy: 0,
    champion: 0
  };
  const totalHealth = Object.values(healthDistribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['overview', 'customers', 'health-portfolio'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab === 'overview' ? '📊 Overview' :
             tab === 'customers' ? '👥 Customers' :
             '💚 Health Portfolio'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Natural Language Command Bar (PRD-056) */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = commandInput.trim();
                if (!trimmed) return;

                // Check if it's an account briefing command
                if (isAccountBriefingCommand(trimmed)) {
                  const accountName = extractAccountName(trimmed);
                  if (accountName) {
                    setBriefingAccountName(accountName);
                    setBriefingCustomerId(undefined);
                    setShowBriefingModal(true);
                    setCommandInput('');
                    return;
                  }
                }

                // Otherwise treat as customer search
                setSearch(trimmed);
                setActiveTab('customers');
                setCommandInput('');
              }}
              className="flex gap-3"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder='Try: "Tell me about Acme Corp" or search for a customer...'
                  className="w-full px-4 py-3 pl-12 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent transition-colors"
                />
                <svg className="absolute left-4 top-3.5 w-5 h-5 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Go
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs text-cscx-gray-500">Try:</span>
              {[
                'Tell me about Meridian Capital',
                'Brief me on Acme Corp',
                'What accounts need attention?'
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setCommandInput(example)}
                  className="text-xs px-2 py-1 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-400 hover:text-white rounded transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total Customers</p>
              <p className="text-2xl font-bold text-white mt-1">{summary.totalCustomers}</p>
              <p className="text-xs text-cscx-gray-500 mt-1">
                {customers.filter(c => c.status === 'active').length} active
              </p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total ARR</p>
              <p className="text-2xl font-bold text-cscx-accent mt-1">{formatCurrency(summary.totalArr)}</p>
              <p className="text-xs text-cscx-gray-500 mt-1">
                MRR: {formatCurrency(summary.totalArr / 12)}
              </p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg Health Score</p>
              <p className={`text-2xl font-bold mt-1 ${getHealthColor(summary.avgHealth)}`}>
                {summary.avgHealth}%
              </p>
              <p className="text-xs text-cscx-gray-500 mt-1">
                Portfolio average
              </p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">At Risk</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{summary.atRiskCount}</p>
              <p className="text-xs text-cscx-gray-500 mt-1">
                Need attention
              </p>
            </div>
          </div>

          {/* Retention & Revenue Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Retention Metrics */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🔄</span> Retention Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-cscx-gray-400 uppercase">NRR (Net Revenue Retention)</p>
                  <p className={`text-xl font-bold ${getBenchmarkColor('nrr', metrics?.retention.nrr || 100)}`}>
                    {formatPercent(metrics?.retention.nrr || 100)}
                  </p>
                  <p className="text-xs text-cscx-gray-500">Target: &gt;100%</p>
                </div>
                <div>
                  <p className="text-xs text-cscx-gray-400 uppercase">GRR (Gross Revenue Retention)</p>
                  <p className={`text-xl font-bold ${getBenchmarkColor('grr', metrics?.retention.grr || 100)}`}>
                    {formatPercent(metrics?.retention.grr || 100)}
                  </p>
                  <p className="text-xs text-cscx-gray-500">Target: &gt;90%</p>
                </div>
                <div>
                  <p className="text-xs text-cscx-gray-400 uppercase">Customer Retention</p>
                  <p className="text-xl font-bold text-white">
                    {formatPercent(metrics?.retention.customerRetentionRate || 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-cscx-gray-400 uppercase">Customer Churn Rate</p>
                  <p className="text-xl font-bold text-white">
                    {formatPercent(metrics?.retention.customerChurnRate || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Health Distribution */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>💚</span> Health Distribution
              </h3>
              <div className="space-y-3">
                {[
                  { key: 'champion', label: 'Champion (86+)', color: 'bg-green-500' },
                  { key: 'healthy', label: 'Healthy (71-85)', color: 'bg-emerald-500' },
                  { key: 'neutral', label: 'Neutral (51-70)', color: 'bg-yellow-500' },
                  { key: 'atRisk', label: 'At Risk (31-50)', color: 'bg-orange-500' },
                  { key: 'critical', label: 'Critical (0-30)', color: 'bg-red-500' },
                ].map(({ key, label, color }) => {
                  const count = healthDistribution[key as keyof typeof healthDistribution];
                  const pct = (count / totalHealth) * 100;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-cscx-gray-400">{label}</div>
                      <div className="flex-1 h-4 bg-cscx-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm text-right text-white font-medium">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LTV & Revenue Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase">LTV:CAC Ratio</p>
              <p className={`text-2xl font-bold ${getBenchmarkColor('ltvCac', metrics?.ltv.ltvCacRatio || 3)}`}>
                {(metrics?.ltv.ltvCacRatio || 3).toFixed(1)}:1
              </p>
              <p className="text-xs text-cscx-gray-500 mt-1">Target: &gt;3:1</p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase">CAC Payback</p>
              <p className="text-2xl font-bold text-white">
                {Math.round(metrics?.ltv.cacPaybackMonths || 12)} months
              </p>
              <p className="text-xs text-cscx-gray-500 mt-1">Target: &lt;12 months</p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase">ARPU</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(metrics?.revenue.arpu || 0)}
              </p>
              <p className="text-xs text-cscx-gray-500 mt-1">Per customer/month</p>
            </div>
          </div>

          {/* Quick Customer List */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>🎯</span> Customers Needing Attention
              </h3>
              <button
                onClick={() => setActiveTab('customers')}
                className="text-sm text-cscx-accent hover:underline"
              >
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {customers
                .filter(c => c.health_score < 60 || c.status === 'at_risk')
                .slice(0, 5)
                .map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => onSelectCustomer?.(customer)}
                    className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg hover:bg-cscx-gray-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${customer.health_score < 50 ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="text-white font-medium">{customer.name}</p>
                        <p className="text-xs text-cscx-gray-500">{formatCurrency(customer.arr)} ARR</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium ${getHealthColor(customer.health_score)}`}>
                        {customer.health_score}%
                      </span>
                      <div className="flex gap-2">
                        {customer.drive_root_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openGoogleDrive(customer.drive_root_id); }}
                            className="p-1 hover:bg-cscx-gray-700 rounded"
                            title="Open Google Drive"
                          >
                            📁
                          </button>
                        )}
                        {customer.onboarding_sheet_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openGoogleSheet(customer.onboarding_sheet_id); }}
                            className="p-1 hover:bg-cscx-gray-700 rounded"
                            title="Open Tracker Sheet"
                          >
                            📊
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              {customers.filter(c => c.health_score < 60 || c.status === 'at_risk').length === 0 && (
                <p className="text-cscx-gray-500 text-center py-4">No customers need immediate attention</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search customers, contacts, industries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="at_risk">At Risk</option>
              <option value="churned">Churned</option>
            </select>
            {onNewOnboarding && (
              <button
                onClick={onNewOnboarding}
                className="px-4 py-2.5 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <span>+</span>
                New Onboarding
              </button>
            )}
          </div>

          {/* Customer Table */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
            {customers.length === 0 ? (
              <div className="p-8 text-center text-cscx-gray-400">
                No customers found. Start by uploading a contract!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1400px]">
                  <thead>
                    <tr className="bg-cscx-gray-800/50 border-b border-cscx-gray-800">
                      <th
                        className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white whitespace-nowrap"
                        onClick={() => handleSort('name')}
                      >
                        Customer {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        Tier
                      </th>
                      <th
                        className="text-left px-3 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white whitespace-nowrap"
                        onClick={() => handleSort('arr')}
                      >
                        ARR {sortBy === 'arr' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left px-3 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white whitespace-nowrap"
                        onClick={() => handleSort('health_score')}
                      >
                        Health {sortBy === 'health_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        NPS
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        Adoption
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        Risk
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        Status
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        Last Activity
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        Renewal
                      </th>
                      <th className="text-left px-3 py-3 text-cscx-gray-400 font-medium whitespace-nowrap">
                        CSM
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => handleCustomerClick(customer)}
                      >
                        {/* Customer Name + Industry */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{customer.name}</p>
                            <p className="text-cscx-gray-500 text-xs">{customer.industry || 'N/A'}</p>
                          </div>
                        </td>
                        {/* Tier */}
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            customer.tier === 'enterprise' ? 'bg-purple-500/20 text-purple-400' :
                            customer.tier === 'strategic' ? 'bg-blue-500/20 text-blue-400' :
                            customer.tier === 'commercial' ? 'bg-cyan-500/20 text-cyan-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {customer.tier || 'N/A'}
                          </span>
                        </td>
                        {/* ARR */}
                        <td className="px-3 py-3">
                          <div>
                            <span className="text-white font-medium">{formatCurrency(customer.arr)}</span>
                            {customer.mrr && (
                              <p className="text-cscx-gray-500 text-xs">{formatCurrency(customer.mrr)}/mo</p>
                            )}
                          </div>
                        </td>
                        {/* Health Score */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-2 rounded-full bg-cscx-gray-700">
                              <div
                                className={`h-full rounded-full ${customer.health_score >= 80 ? 'bg-green-500' : customer.health_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${customer.health_score}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium ${getHealthColor(customer.health_score)}`}>
                              {customer.health_score}
                            </span>
                          </div>
                        </td>
                        {/* NPS */}
                        <td className="px-3 py-3">
                          <span className={`font-medium ${
                            (customer.nps_score || 0) >= 50 ? 'text-green-400' :
                            (customer.nps_score || 0) >= 0 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {customer.nps_score !== undefined ? customer.nps_score : '-'}
                          </span>
                        </td>
                        {/* Adoption */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${
                              (customer.product_adoption || 0) >= 70 ? 'text-green-400' :
                              (customer.product_adoption || 0) >= 50 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {customer.product_adoption !== undefined ? `${customer.product_adoption}%` : '-'}
                            </span>
                          </div>
                        </td>
                        {/* Risk Level */}
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            customer.risk_level === 'critical' ? 'bg-red-500/30 text-red-400 border border-red-500/50' :
                            customer.risk_level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            customer.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            customer.risk_level === 'low' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {customer.risk_level || 'none'}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadge(customer.status)}`}>
                            {customer.status.replace('_', ' ')}
                          </span>
                        </td>
                        {/* Last Activity */}
                        <td className="px-3 py-3">
                          <span className={`text-sm ${
                            (customer.last_activity_days || 0) <= 3 ? 'text-green-400' :
                            (customer.last_activity_days || 0) <= 7 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {customer.last_activity_days !== undefined
                              ? customer.last_activity_days === 0
                                ? 'Today'
                                : `${customer.last_activity_days}d ago`
                              : '-'}
                          </span>
                        </td>
                        {/* Renewal */}
                        <td className="px-3 py-3 text-cscx-gray-300 whitespace-nowrap">
                          {customer.renewal_date ? new Date(customer.renewal_date).toLocaleDateString() : '-'}
                        </td>
                        {/* CSM */}
                        <td className="px-3 py-3">
                          <span className="text-cscx-gray-300 text-sm">
                            {customer.csm_name || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Health Portfolio Tab (PRD-153) */}
      {activeTab === 'health-portfolio' && (
        <HealthScorePortfolio
          onSelectCustomer={(customerId) => {
            // Find customer by ID and call parent handler
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
              onSelectCustomer?.(customer);
            }
          }}
        />
      )}
      {/* Account Briefing Modal (PRD-056) */}
      {showBriefingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-cscx-gray-900 border-b border-cscx-gray-800 p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-white">Account 360 Briefing</h2>
                <p className="text-sm text-cscx-gray-400">AI-generated comprehensive account intelligence</p>
              </div>
              <button
                onClick={() => {
                  setShowBriefingModal(false);
                  setBriefingAccountName(undefined);
                  setBriefingCustomerId(undefined);
                }}
                className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <AccountBriefing
                customerId={briefingCustomerId}
                accountName={briefingAccountName}
                onClose={() => {
                  setShowBriefingModal(false);
                  setBriefingAccountName(undefined);
                  setBriefingCustomerId(undefined);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

const MetricCard: React.FC<{
  label: string;
  value: string;
  highlight?: 'green' | 'red' | 'yellow';
}> = ({ label, value, highlight }) => {
  const textColor = highlight === 'green' ? 'text-green-400' : highlight === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
      <p className="text-xs text-cscx-gray-400 uppercase">{label}</p>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
};

export default Observability;
