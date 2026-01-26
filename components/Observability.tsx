/**
 * Observability Dashboard
 * Unified view of customer portfolio with CS metrics, health scores,
 * and links to Google Workspace resources (Drive, Sheets, QBRs)
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  health_score: number;
  status: 'active' | 'onboarding' | 'at_risk' | 'churned';
  renewal_date?: string;
  csm_name?: string;
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
  initialTab?: 'overview' | 'customers' | 'metrics';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'metrics'>(initialTab || 'overview');
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

  useEffect(() => {
    if (selectedCustomerId && activeTab === 'metrics') {
      fetchAgentInbox(selectedCustomerId);
      fetchCustomerMetrics(selectedCustomerId);
    }
  }, [selectedCustomerId, activeTab, fetchAgentInbox, fetchCustomerMetrics]);

  // Get selected customer object
  const selectedCustomer = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId)
    : null;

  // Handle customer click in Customers tab -> redirect to Metrics with selection
  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setActiveTab('metrics');
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
        {(['overview', 'customers', 'metrics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab === 'overview' ? '📊 Overview' : tab === 'customers' ? '👥 Customers' : '📈 Metrics'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cscx-gray-800/50 border-b border-cscx-gray-800">
                      <th
                        className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('name')}
                      >
                        Customer {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('arr')}
                      >
                        ARR {sortBy === 'arr' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('health_score')}
                      >
                        Health {sortBy === 'health_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                        Renewal
                      </th>
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                        Workspace
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
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{customer.name}</p>
                            <p className="text-cscx-gray-500 text-xs">{customer.industry}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{formatCurrency(customer.arr)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-2 rounded-full ${getHealthBg(customer.health_score)}`}>
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
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(customer.status)}`}>
                            {customer.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-cscx-gray-300">
                          {customer.renewal_date ? new Date(customer.renewal_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {customer.drive_root_id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openGoogleDrive(customer.drive_root_id); }}
                                className="p-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded text-sm"
                                title="Open Google Drive"
                              >
                                📁 Drive
                              </button>
                            )}
                            {customer.onboarding_sheet_id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openGoogleSheet(customer.onboarding_sheet_id); }}
                                className="p-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded text-sm"
                                title="Open Tracker Sheet"
                              >
                                📊 Sheet
                              </button>
                            )}
                            {!customer.drive_root_id && !customer.onboarding_sheet_id && (
                              <span className="text-cscx-gray-500 text-xs">No workspace</span>
                            )}
                          </div>
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

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <>
          {/* Customer Selector */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-sm text-cscx-gray-400 whitespace-nowrap">View metrics for:</label>
                <select
                  value={selectedCustomerId || ''}
                  onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                  className="flex-1 px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
                >
                  <option value="">All Customers (Portfolio)</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {selectedCustomer && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(selectedCustomer.status)}`}>
                    {selectedCustomer.status.replace('_', ' ')}
                  </span>
                  {selectedCustomer.drive_root_id && (
                    <button
                      onClick={() => openGoogleDrive(selectedCustomer.drive_root_id)}
                      className="px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded text-sm flex items-center gap-1"
                    >
                      📁 Drive
                    </button>
                  )}
                  {selectedCustomer.onboarding_sheet_id && (
                    <button
                      onClick={() => openGoogleSheet(selectedCustomer.onboarding_sheet_id)}
                      className="px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded text-sm flex items-center gap-1"
                    >
                      📊 Sheet
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Individual Customer Metrics */}
          {selectedCustomer ? (
            <>
              {/* Customer Header */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedCustomer.name}</h2>
                    <p className="text-cscx-gray-400">{selectedCustomer.industry || 'Industry not specified'}</p>
                  </div>
                  <button
                    onClick={() => onSelectCustomer?.(selectedCustomer)}
                    className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Open Full 360° View →
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase">ARR</p>
                    <p className="text-xl font-bold text-cscx-accent">{formatCurrency(selectedCustomer.arr)}</p>
                  </div>
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase">MRR</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(selectedCustomer.arr / 12)}</p>
                  </div>
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase">Health Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-xl font-bold ${getHealthColor(selectedCustomer.health_score)}`}>
                        {selectedCustomer.health_score}%
                      </p>
                      <div className={`flex-1 h-2 rounded-full ${getHealthBg(selectedCustomer.health_score)}`}>
                        <div
                          className={`h-full rounded-full ${selectedCustomer.health_score >= 80 ? 'bg-green-500' : selectedCustomer.health_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${selectedCustomer.health_score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase">Renewal Date</p>
                    <p className="text-xl font-bold text-white">
                      {selectedCustomer.renewal_date ? new Date(selectedCustomer.renewal_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer-Specific Metrics */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📈</span> {selectedCustomer.name} Engagement Metrics
                </h3>
                {metricsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
                    <span className="ml-2 text-cscx-gray-400">Loading metrics...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      label="Days Since Onboard"
                      value={customerMetrics?.daysSinceOnboard?.toString() || '0'}
                    />
                    <MetricCard
                      label="Active Users"
                      value={customerMetrics?.activeUsers?.toString() || '0'}
                    />
                    <MetricCard
                      label="Feature Adoption"
                      value={`${customerMetrics?.featureAdoption || 0}%`}
                      highlight={customerMetrics?.featureAdoption && customerMetrics.featureAdoption >= 70 ? 'green' : undefined}
                    />
                    <MetricCard
                      label="Support Tickets"
                      value={customerMetrics?.supportTickets?.toString() || '0'}
                    />
                  </div>
                )}
              </div>

              {/* Contact Info */}
              {selectedCustomer.primary_contact && (
                <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>👤</span> Primary Contact
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-cscx-accent/20 flex items-center justify-center text-cscx-accent font-bold">
                      {selectedCustomer.primary_contact.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{selectedCustomer.primary_contact.name}</p>
                      <p className="text-cscx-gray-400 text-sm">{selectedCustomer.primary_contact.title}</p>
                      <p className="text-cscx-gray-500 text-sm">{selectedCustomer.primary_contact.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Inbox */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span>🤖</span> Agent Inbox
                  </h3>
                  {agentInbox && (
                    <div className="flex items-center gap-4 text-xs">
                      <span className="px-2 py-1 bg-cscx-accent/20 text-cscx-accent rounded">
                        {agentInbox.summary.pendingApprovals} Pending
                      </span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                        {agentInbox.summary.completedToday} Today
                      </span>
                    </div>
                  )}
                </div>

                {inboxLoading ? (
                  <div className="text-center py-8 text-cscx-gray-400">
                    <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
                    Loading agent inbox...
                  </div>
                ) : agentInbox ? (
                  <div className="space-y-4">
                    {/* Pending Approvals */}
                    {agentInbox.pendingApprovals.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                          <span>⏳</span> Pending Approvals ({agentInbox.pendingApprovals.length})
                        </h4>
                        <div className="space-y-2">
                          {agentInbox.pendingApprovals.map(approval => (
                            <div key={approval.id} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-white font-medium text-sm">
                                    {approval.actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                  </p>
                                  <p className="text-cscx-gray-400 text-xs mt-1">
                                    {approval.actionData.subject || approval.actionData.title || 'Action pending approval'}
                                  </p>
                                  <p className="text-cscx-gray-500 text-xs mt-1">
                                    Created {new Date(approval.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApprovalAction(approval.id, 'approve')}
                                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleApprovalAction(approval.id, 'reject')}
                                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Activities */}
                    <div>
                      <h4 className="text-sm font-medium text-cscx-gray-300 mb-2 flex items-center gap-2">
                        <span>📋</span> Recent Agent Activities
                      </h4>
                      {agentInbox.activities.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {agentInbox.activities.slice(0, 10).map(activity => (
                            <div key={activity.id} className="p-3 bg-cscx-gray-800/50 rounded-lg flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                activity.status === 'completed' ? 'bg-green-500' :
                                activity.status === 'failed' ? 'bg-red-500' :
                                'bg-yellow-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 bg-cscx-accent/20 text-cscx-accent rounded">
                                    {activity.agentType}
                                  </span>
                                  <span className="text-white text-sm font-medium">
                                    {activity.actionType.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-cscx-gray-500 text-xs mt-1">
                                  {new Date(activity.startedAt).toLocaleString()}
                                  {activity.durationMs && ` • ${(activity.durationMs / 1000).toFixed(1)}s`}
                                </p>
                                {activity.errorMessage && (
                                  <p className="text-red-400 text-xs mt-1">{activity.errorMessage}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-cscx-gray-500 text-center py-4">No agent activities yet</p>
                      )}
                    </div>

                    {/* Chat History */}
                    <div>
                      <h4 className="text-sm font-medium text-cscx-gray-300 mb-2 flex items-center gap-2">
                        <span>💬</span> Recent Conversations
                      </h4>
                      {agentInbox.chatHistory.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {agentInbox.chatHistory.slice(0, 20).map(msg => (
                            <div key={msg.id} className={`p-3 rounded-lg ${
                              msg.role === 'user' ? 'bg-cscx-gray-800/50 ml-8' : 'bg-cscx-accent/10 mr-8'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium ${
                                  msg.role === 'user' ? 'text-blue-400' : 'text-cscx-accent'
                                }`}>
                                  {msg.role === 'user' ? 'You' : msg.agentType || 'Assistant'}
                                </span>
                                <span className="text-cscx-gray-600 text-xs">
                                  {new Date(msg.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-cscx-gray-300 text-sm whitespace-pre-wrap">
                                {msg.content.length > 200 ? `${msg.content.slice(0, 200)}...` : msg.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-cscx-gray-500 text-center py-4">No chat history yet</p>
                      )}
                    </div>

                    {/* Completed Approvals History */}
                    {agentInbox.completedApprovals.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-cscx-gray-300 mb-2 flex items-center gap-2">
                          <span>✅</span> Completed Approvals
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {agentInbox.completedApprovals.slice(0, 5).map(approval => (
                            <div key={approval.id} className="p-2 bg-cscx-gray-800/30 rounded flex items-center justify-between">
                              <span className="text-cscx-gray-400 text-xs">
                                {approval.actionType.replace(/_/g, ' ')}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                approval.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                approval.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {approval.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-cscx-gray-500 text-center py-8">
                    Select a customer to view their agent inbox
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Portfolio-Level Metrics (existing) */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>💰</span> Revenue Metrics (Portfolio)
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="MRR" value={formatCurrency(metrics?.revenue.mrr || 0)} />
                  <MetricCard label="ARR" value={formatCurrency(metrics?.revenue.arr || 0)} />
                  <MetricCard label="New MRR" value={formatCurrency(metrics?.revenue.newMRR || 0)} highlight="green" />
                  <MetricCard label="Expansion MRR" value={formatCurrency(metrics?.revenue.expansionMRR || 0)} highlight="green" />
                  <MetricCard label="Contraction MRR" value={formatCurrency(metrics?.revenue.contractionMRR || 0)} highlight="red" />
                  <MetricCard label="Churned MRR" value={formatCurrency(metrics?.revenue.churnedMRR || 0)} highlight="red" />
                  <MetricCard label="ARPU" value={formatCurrency(metrics?.revenue.arpu || 0)} />
                  <MetricCard label="Customer Count" value={summary.totalCustomers.toString()} />
                </div>
              </div>

              {/* Satisfaction Metrics */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>😊</span> Satisfaction Metrics (Portfolio)
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase mb-2">Net Promoter Score (NPS)</p>
                    <p className={`text-4xl font-bold ${getBenchmarkColor('nps', metrics?.satisfaction.nps.nps || 0)}`}>
                      {metrics?.satisfaction.nps.nps || 0}
                    </p>
                    <p className="text-xs text-cscx-gray-500 mt-2">
                      {metrics?.satisfaction.nps.totalResponses || 0} responses
                    </p>
                  </div>
                  <div className="text-center p-4 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase mb-2">CSAT Score</p>
                    <p className="text-4xl font-bold text-white">
                      {formatPercent(metrics?.satisfaction.csat || 0)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-xs text-cscx-gray-400 uppercase mb-2">CES Score</p>
                    <p className="text-4xl font-bold text-white">
                      {(metrics?.satisfaction.ces || 0).toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* LTV Metrics */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>📈</span> Lifetime Value Metrics
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="Lifetime Value (LTV)" value={formatCurrency(metrics?.ltv.ltv || 0)} />
                  <MetricCard label="CAC" value={formatCurrency(metrics?.ltv.cac || 0)} />
                  <MetricCard label="LTV:CAC Ratio" value={`${(metrics?.ltv.ltvCacRatio || 0).toFixed(1)}:1`} />
                  <MetricCard label="CAC Payback" value={`${Math.round(metrics?.ltv.cacPaybackMonths || 0)} mo`} />
                </div>
              </div>
            </>
          )}
        </>
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
