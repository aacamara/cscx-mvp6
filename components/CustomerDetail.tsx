import React, { useState, useEffect, useCallback } from 'react';
import { WorkspacePanel } from './WorkspacePanel';
import { WorkspaceAgent } from './WorkspaceAgent';
import { useAuth } from '../context/AuthContext';

interface Customer {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  health_score: number;
  status: 'active' | 'onboarding' | 'at_risk' | 'churned';
  renewal_date?: string;
  csm_name?: string;
  primary_contact?: {
    name: string;
    email: string;
    title?: string;
  };
  tags?: string[];
  contract_id?: string;
  created_at?: string;
}

interface Activity {
  id: string;
  type: 'email' | 'meeting' | 'call' | 'note' | 'task' | 'milestone';
  title: string;
  description?: string;
  date: string;
  user?: string;
}

interface CustomerMetrics {
  daysSinceOnboard: number;
  activeUsers: number;
  featureAdoption: number;
  supportTickets: number;
  totalMeetings: number;
  emailsSent: number;
  openTasks: number;
  csatScore: number;
  healthBreakdown: {
    engagement: number;
    productAdoption: number;
    supportSentiment: number;
  };
}

interface Contract {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string;
  companyName?: string;
  arr?: number;
  contractPeriod?: string;
  status: string;
  parsedData?: {
    stakeholders?: Array<{
      name: string;
      role?: string;
      email?: string;
      phone?: string;
    }>;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  onStartChat?: (customer: Customer) => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customerId,
  onBack,
  onStartChat
}) => {
  const { getAuthHeaders } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'contracts' | 'stakeholders'>('overview');

  // Metrics and activities state
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  // Modal states for buttons
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [showUploadContractModal, setShowUploadContractModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Fetch customer metrics
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/metrics`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, [customerId]);

  // Fetch customer activities
  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/activities`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  }, [customerId]);

  // Fetch customer contracts
  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/contracts?customerId=${customerId}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    } finally {
      setContractsLoading(false);
    }
  }, [customerId, getAuthHeaders]);

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/customers/${customerId}`);
        if (!response.ok) throw new Error('Failed to fetch customer');
        const data = await response.json();
        setCustomer(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
    fetchMetrics();
    fetchActivities();
    fetchContracts();
  }, [customerId, fetchMetrics, fetchActivities, fetchContracts]);

  // Action handlers for buttons
  const showFeedback = (message: string) => {
    setActionFeedback(message);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleSendEmail = () => {
    if (customer?.primary_contact?.email) {
      window.location.href = `mailto:${customer.primary_contact.email}`;
      showFeedback('Opening email client...');
    }
  };

  const handleScheduleMeeting = () => {
    if (onStartChat && customer) {
      onStartChat(customer);
      showFeedback('Opening AI chat to schedule meeting...');
    } else {
      showFeedback('Start AI Chat to schedule a meeting');
    }
  };

  const handleStartRenewal = () => {
    if (onStartChat && customer) {
      onStartChat(customer);
      showFeedback('Opening AI chat for renewal process...');
    } else {
      showFeedback('Start AI Chat to begin renewal process');
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const getDaysUntilRenewal = (renewalDate?: string) => {
    if (!renewalDate) return null;
    const renewal = new Date(renewalDate);
    const now = new Date();
    const diffDays = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      email: '\u2709\ufe0f',
      meeting: '\ud83d\udcc5',
      call: '\ud83d\udcde',
      note: '\ud83d\udcdd',
      task: '\u2705',
      milestone: '\ud83c\udfc6'
    };
    return icons[type] || '\ud83d\udccc';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getContractStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return styles[status] || styles.pending;
  };

  // Extract all stakeholders from contracts
  const getAllStakeholders = () => {
    const stakeholders: Array<{ name: string; role?: string; email?: string; phone?: string; source: string }> = [];

    contracts.forEach(contract => {
      if (contract.parsedData?.stakeholders) {
        contract.parsedData.stakeholders.forEach(s => {
          stakeholders.push({ ...s, source: contract.fileName });
        });
      }
    });

    return stakeholders;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error || 'Customer not found'}</p>
        <button onClick={onBack} className="text-cscx-accent hover:underline">
          Back to Customers
        </button>
      </div>
    );
  }

  const daysUntilRenewal = getDaysUntilRenewal(customer.renewal_date);

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {actionFeedback && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg shadow-lg animate-fade-in">
          <p className="text-white text-sm">{actionFeedback}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cscx-gray-400 hover:text-white transition-colors"
        >
          <span>\u2190</span>
          Back to Customers
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => showFeedback('Edit functionality coming soon - use AI Chat to update customer details')}
            className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span>\u270f\ufe0f</span>
            Edit
          </button>
          {onStartChat && (
            <button
              onClick={() => onStartChat(customer)}
              className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <span>\ud83e\udd16</span>
              Start AI Chat
            </button>
          )}
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cscx-accent to-red-700 rounded-xl flex items-center justify-center text-2xl font-bold text-white">
              {customer.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(customer.status)}`}>
                  {customer.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-cscx-gray-400 mt-1">{customer.industry}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {customer.tags?.map((tag, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-cscx-gray-800 text-cscx-gray-300 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center lg:text-right">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">ARR</p>
              <p className="text-xl font-bold text-cscx-accent">{formatCurrency(customer.arr)}</p>
            </div>
            <div className="text-center lg:text-right">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Health</p>
              <p className={`text-xl font-bold ${getHealthColor(customer.health_score)}`}>
                {customer.health_score}%
              </p>
            </div>
            <div className="text-center lg:text-right">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Renewal</p>
              <p className="text-xl font-bold text-white">{formatDate(customer.renewal_date)}</p>
              {daysUntilRenewal !== null && (
                <p className={`text-xs ${daysUntilRenewal < 30 ? 'text-red-400' : daysUntilRenewal < 90 ? 'text-yellow-400' : 'text-cscx-gray-400'}`}>
                  {daysUntilRenewal > 0 ? `${daysUntilRenewal} days left` : 'Overdue'}
                </p>
              )}
            </div>
            <div className="text-center lg:text-right">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">CSM</p>
              <p className="text-lg font-medium text-white">{customer.csm_name || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['overview', 'activity', 'contracts', 'stakeholders'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Health Score Card */}
              <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Health Score</h3>
                <div className="flex items-center gap-6">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#222"
                        strokeWidth="12"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke={customer.health_score >= 80 ? '#22c55e' : customer.health_score >= 60 ? '#eab308' : '#ef4444'}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${(customer.health_score / 100) * 352} 352`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-3xl font-bold ${getHealthColor(customer.health_score)}`}>
                        {customer.health_score}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    {metricsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin w-5 h-5 border-2 border-cscx-accent border-t-transparent rounded-full" />
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-cscx-gray-400">Engagement</span>
                            <span className="text-white">{metrics?.healthBreakdown?.engagement || 0}%</span>
                          </div>
                          <div className="h-2 bg-cscx-gray-800 rounded-full">
                            <div
                              className={`h-full rounded-full ${(metrics?.healthBreakdown?.engagement || 0) >= 70 ? 'bg-green-500' : (metrics?.healthBreakdown?.engagement || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${metrics?.healthBreakdown?.engagement || 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-cscx-gray-400">Product Adoption</span>
                            <span className="text-white">{metrics?.healthBreakdown?.productAdoption || 0}%</span>
                          </div>
                          <div className="h-2 bg-cscx-gray-800 rounded-full">
                            <div
                              className={`h-full rounded-full ${(metrics?.healthBreakdown?.productAdoption || 0) >= 70 ? 'bg-green-500' : (metrics?.healthBreakdown?.productAdoption || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${metrics?.healthBreakdown?.productAdoption || 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-cscx-gray-400">Support Sentiment</span>
                            <span className="text-white">{metrics?.healthBreakdown?.supportSentiment || 0}%</span>
                          </div>
                          <div className="h-2 bg-cscx-gray-800 rounded-full">
                            <div
                              className={`h-full rounded-full ${(metrics?.healthBreakdown?.supportSentiment || 0) >= 70 ? 'bg-green-500' : (metrics?.healthBreakdown?.supportSentiment || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${metrics?.healthBreakdown?.supportSentiment || 0}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 text-center">
                  {metricsLoading ? (
                    <div className="animate-pulse h-8 bg-cscx-gray-800 rounded mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{metrics?.totalMeetings || 0}</p>
                  )}
                  <p className="text-xs text-cscx-gray-400">Total Meetings</p>
                </div>
                <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 text-center">
                  {metricsLoading ? (
                    <div className="animate-pulse h-8 bg-cscx-gray-800 rounded mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{metrics?.emailsSent || 0}</p>
                  )}
                  <p className="text-xs text-cscx-gray-400">Emails Sent</p>
                </div>
                <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 text-center">
                  {metricsLoading ? (
                    <div className="animate-pulse h-8 bg-cscx-gray-800 rounded mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{metrics?.openTasks || 0}</p>
                  )}
                  <p className="text-xs text-cscx-gray-400">Open Tasks</p>
                </div>
                <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 text-center">
                  {metricsLoading ? (
                    <div className="animate-pulse h-8 bg-cscx-gray-800 rounded mb-1" />
                  ) : (
                    <p className={`text-2xl font-bold ${(metrics?.csatScore || 0) >= 80 ? 'text-green-400' : (metrics?.csatScore || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {metrics?.csatScore || 0}%
                    </p>
                  )}
                  <p className="text-xs text-cscx-gray-400">CSAT Score</p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'activity' && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
                <button
                  onClick={() => {
                    if (onStartChat && customer) {
                      onStartChat(customer);
                      showFeedback('Opening AI chat to add activity...');
                    } else {
                      showFeedback('Use AI Chat to log activities');
                    }
                  }}
                  className="text-sm text-cscx-accent hover:underline"
                >
                  + Add Activity
                </button>
              </div>
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
                  <span className="ml-2 text-cscx-gray-400">Loading activities...</span>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-cscx-gray-400">No activities recorded yet</p>
                  <p className="text-sm text-cscx-gray-500 mt-1">Activities will appear here as you interact with this customer</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-cscx-gray-800 rounded-full flex items-center justify-center text-lg">
                          {getActivityIcon(activity.type)}
                        </div>
                        {index < activities.length - 1 && (
                          <div className="w-px h-full bg-cscx-gray-800 my-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-medium">{activity.title}</p>
                            {activity.description && (
                              <p className="text-sm text-cscx-gray-400 mt-1">{activity.description}</p>
                            )}
                          </div>
                          <span className="text-xs text-cscx-gray-500">{formatRelativeDate(activity.date)}</span>
                        </div>
                        {activity.user && (
                          <p className="text-xs text-cscx-gray-500 mt-2">by {activity.user}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Contracts</h3>
                <button
                  onClick={() => showFeedback('Contract upload available in Onboarding flow - navigate to + New Onboarding')}
                  className="text-sm text-cscx-accent hover:underline"
                >
                  + Upload Contract
                </button>
              </div>
              {contractsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
                  <span className="ml-2 text-cscx-gray-400">Loading contracts...</span>
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-cscx-gray-400">No contracts uploaded yet</p>
                  <p className="text-sm text-cscx-gray-500 mt-1">Upload a contract during onboarding to see details here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="p-4 bg-cscx-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cscx-gray-700 rounded-lg flex items-center justify-center text-lg">
                            {contract.fileType?.includes('pdf') ? '\ud83d\udcc4' : '\ud83d\udcc3'}
                          </div>
                          <div>
                            <p className="text-white font-medium">{contract.fileName}</p>
                            <p className="text-xs text-cscx-gray-400">
                              {formatFileSize(contract.fileSize)} • Uploaded {formatDate(contract.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getContractStatusBadge(contract.status)}`}>
                            {contract.status}
                          </span>
                          {contract.fileUrl && (
                            <a
                              href={contract.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-sm bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                      {(contract.arr || contract.contractPeriod) && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-3 border-t border-cscx-gray-700">
                          {contract.arr && (
                            <div>
                              <p className="text-cscx-gray-400">Contract Value</p>
                              <p className="text-cscx-accent font-medium">{formatCurrency(contract.arr)}</p>
                            </div>
                          )}
                          {contract.contractPeriod && (
                            <div>
                              <p className="text-cscx-gray-400">Period</p>
                              <p className="text-white">{contract.contractPeriod}</p>
                            </div>
                          )}
                          {contract.companyName && (
                            <div>
                              <p className="text-cscx-gray-400">Company</p>
                              <p className="text-white">{contract.companyName}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stakeholders' && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Stakeholders</h3>
                <button
                  onClick={() => {
                    if (onStartChat && customer) {
                      onStartChat(customer);
                      showFeedback('Opening AI chat to add stakeholder...');
                    } else {
                      showFeedback('Use AI Chat to add new stakeholders');
                    }
                  }}
                  className="text-sm text-cscx-accent hover:underline"
                >
                  + Add Stakeholder
                </button>
              </div>
              {contractsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
                  <span className="ml-2 text-cscx-gray-400">Loading stakeholders...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Primary Contact */}
                  {customer.primary_contact && (
                    <div className="p-4 bg-cscx-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cscx-accent rounded-full flex items-center justify-center text-white font-medium">
                            {customer.primary_contact.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{customer.primary_contact.name}</p>
                            <p className="text-sm text-cscx-gray-400">{customer.primary_contact.title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs bg-cscx-accent/20 text-cscx-accent rounded">Primary</span>
                          <a href={`mailto:${customer.primary_contact.email}`} className="text-cscx-gray-400 hover:text-white text-sm">
                            {customer.primary_contact.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stakeholders from Contracts */}
                  {getAllStakeholders().length > 0 && (
                    <>
                      <div className="text-xs text-cscx-gray-500 uppercase tracking-wider mt-4 mb-2">From Contracts</div>
                      {getAllStakeholders().map((stakeholder, index) => (
                        <div key={`${stakeholder.name}-${index}`} className="p-4 bg-cscx-gray-800 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-cscx-gray-700 rounded-full flex items-center justify-center text-white font-medium">
                                {stakeholder.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-white font-medium">{stakeholder.name}</p>
                                <p className="text-sm text-cscx-gray-400">{stakeholder.role || 'Unknown Role'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {stakeholder.email && (
                                <a href={`mailto:${stakeholder.email}`} className="text-cscx-gray-400 hover:text-white text-sm">
                                  {stakeholder.email}
                                </a>
                              )}
                              {stakeholder.phone && (
                                <span className="text-cscx-gray-500 text-sm">{stakeholder.phone}</span>
                              )}
                              <span className="text-xs text-cscx-gray-600">from {stakeholder.source}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Empty state when no stakeholders */}
                  {!customer.primary_contact && getAllStakeholders().length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-cscx-gray-400">No stakeholders found</p>
                      <p className="text-sm text-cscx-gray-500 mt-1">Upload a contract to extract stakeholder information</p>
                    </div>
                  )}

                  {/* Encourage adding more */}
                  {(customer.primary_contact || getAllStakeholders().length > 0) && (
                    <div className="p-4 border border-dashed border-cscx-gray-700 rounded-lg text-center">
                      <p className="text-cscx-gray-400 text-sm">Add more stakeholders to track all key contacts</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Primary Contact Card */}
          {customer.primary_contact && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">Primary Contact</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-cscx-accent rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {customer.primary_contact.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-medium">{customer.primary_contact.name}</p>
                  <p className="text-sm text-cscx-gray-400">{customer.primary_contact.title}</p>
                </div>
              </div>
              <div className="space-y-2">
                <a
                  href={`mailto:${customer.primary_contact.email}`}
                  className="flex items-center gap-2 text-sm text-cscx-gray-300 hover:text-cscx-accent"
                >
                  <span>\u2709\ufe0f</span>
                  {customer.primary_contact.email}
                </a>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSendEmail}
                  className="flex-1 px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors"
                >
                  Send Email
                </button>
                <button
                  onClick={handleScheduleMeeting}
                  className="flex-1 px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors"
                >
                  Schedule
                </button>
              </div>
            </div>
          )}

          {/* Google Workspace Integration */}
          <WorkspacePanel
            customerId={customer.id}
            customerName={customer.name}
            customerEmail={customer.primary_contact?.email}
          />

          {/* AI-Powered Workspace Agent */}
          <WorkspaceAgent
            customerId={customer.id}
            customerName={customer.name}
            stakeholderEmails={customer.primary_contact ? [customer.primary_contact.email] : []}
            compact={true}
          />

          {/* Renewal Alert */}
          {daysUntilRenewal !== null && daysUntilRenewal < 90 && (
            <div className={`rounded-xl p-4 ${daysUntilRenewal < 30 ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{daysUntilRenewal < 30 ? '\u26a0\ufe0f' : '\ud83d\udcc6'}</span>
                <div>
                  <p className={`font-medium ${daysUntilRenewal < 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    Renewal {daysUntilRenewal < 30 ? 'Urgent' : 'Coming Up'}
                  </p>
                  <p className="text-sm text-cscx-gray-400 mt-1">
                    {daysUntilRenewal} days until renewal on {formatDate(customer.renewal_date)}
                  </p>
                  <button
                    onClick={handleStartRenewal}
                    className="mt-2 text-sm text-cscx-accent hover:underline"
                  >
                    Start Renewal Process
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Customer Since */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">Customer Since</h3>
            <p className="text-white">{formatDate(customer.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
