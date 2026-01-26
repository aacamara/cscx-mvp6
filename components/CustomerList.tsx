import React, { useState, useEffect, useCallback } from 'react';

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
}

interface CustomerListProps {
  onSelectCustomer?: (customer: Customer) => void;
  onNewOnboarding?: () => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export const CustomerList: React.FC<CustomerListProps> = ({
  onSelectCustomer,
  onNewOnboarding
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalArr: 0,
    avgHealth: 0,
    atRiskCount: 0
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`${API_BASE}/customers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch customers');

      const data = await response.json();
      setCustomers(data.customers);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-600 ml-1">&#8597;</span>;
    return <span className="text-cscx-accent ml-1">{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total Customers</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.totalCustomers}</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total ARR</p>
          <p className="text-2xl font-bold text-cscx-accent mt-1">{formatCurrency(summary.totalArr)}</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg Health</p>
          <p className={`text-2xl font-bold mt-1 ${getHealthColor(summary.avgHealth)}`}>
            {summary.avgHealth}%
          </p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">At Risk</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{summary.atRiskCount}</p>
        </div>
      </div>

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
        {loading ? (
          <div className="p-8 text-center text-cscx-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
            Loading customers...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            {error}
            <button
              onClick={fetchCustomers}
              className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
            >
              Try again
            </button>
          </div>
        ) : customers.length === 0 ? (
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
                    Customer <SortIcon field="name" />
                  </th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                    Primary Contact
                  </th>
                  <th
                    className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('arr')}
                  >
                    ARR <SortIcon field="arr" />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('health_score')}
                  >
                    Health <SortIcon field="health_score" />
                  </th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                    Status
                  </th>
                  <th
                    className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                    onClick={() => handleSort('renewal_date')}
                  >
                    Renewal <SortIcon field="renewal_date" />
                  </th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                    CSM
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => onSelectCustomer?.(customer)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{customer.name}</p>
                        <p className="text-cscx-gray-500 text-xs">{customer.industry}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {customer.primary_contact ? (
                        <div>
                          <p className="text-white text-sm">{customer.primary_contact.name}</p>
                          <p className="text-cscx-gray-500 text-xs">{customer.primary_contact.email}</p>
                        </div>
                      ) : (
                        <span className="text-cscx-gray-500">-</span>
                      )}
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
                      {formatDate(customer.renewal_date)}
                    </td>
                    <td className="px-4 py-3 text-cscx-gray-300">
                      {customer.csm_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
