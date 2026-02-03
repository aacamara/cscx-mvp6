import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { trackCustomerListViewed, trackCsvTemplateDownloaded, trackCsvImportCompleted } from '../src/services/analytics';

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
  is_demo?: boolean;
  owner_id?: string | null;
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
  const { getAuthHeaders, isDesignPartner, userId } = useAuth();
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const hasTrackedView = useRef(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`${API_BASE}/customers?${params}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch customers');

      const data = await response.json();
      setCustomers(data.customers);
      setSummary(data.summary);
      setError(null);

      // Track customer list viewed (only once per mount)
      if (!hasTrackedView.current) {
        trackCustomerListViewed(data.customers?.length || 0);
        hasTrackedView.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder, getAuthHeaders]);

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

  // Download CSV template
  const handleDownloadTemplate = () => {
    trackCsvTemplateDownloaded();
    window.location.href = `${API_BASE}/customers/template`;
  };

  // Handle CSV file import
  const handleImportCSV = async (csvContent: string) => {
    setImportLoading(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/customers/import-csv`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ csvData: csvContent })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Import failed');
      }

      // Track CSV import completed
      trackCsvImportCompleted(result.imported || 0, result.errors?.length || 0);

      if (result.imported > 0) {
        setImportSuccess(`Imported ${result.imported} customer${result.imported > 1 ? 's' : ''}`);
        fetchCustomers(); // Refresh list
      }

      if (result.errors?.length > 0) {
        setImportError(`${result.errors.length} row(s) had errors`);
      }

      // Close modal after short delay on success
      if (result.imported > 0 && !result.errors?.length) {
        setTimeout(() => setShowImportModal(false), 1500);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  // Get ownership badge for customer
  const getOwnershipBadge = (customer: Customer) => {
    if (!isDesignPartner) return null;
    if (customer.is_demo) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
          DEMO
        </span>
      );
    }
    if (customer.owner_id === userId) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
          YOUR DATA
        </span>
      );
    }
    return null;
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
        {/* Design Partner Import Actions */}
        {isDesignPartner && (
          <>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 border border-cscx-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Template
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
          </>
        )}
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
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-cscx-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cscx-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No customers yet</h3>
            <p className="text-cscx-gray-400 mb-4">Import your first one to get started</p>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 bg-cscx-accent hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Import Customers
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
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
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-white font-medium">{customer.name}</p>
                          <p className="text-cscx-gray-500 text-xs">{customer.industry}</p>
                        </div>
                        {getOwnershipBadge(customer)}
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

      {/* CSV Import Modal */}
      {showImportModal && (
        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setImportError(null);
            setImportSuccess(null);
          }}
          onImport={handleImportCSV}
          loading={importLoading}
          error={importError}
          success={importSuccess}
          onDownloadTemplate={handleDownloadTemplate}
        />
      )}
    </div>
  );
};

// CSV Import Modal Component
interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvContent: string) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  onDownloadTemplate: () => void;
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  loading,
  error,
  success,
  onDownloadTemplate
}) => {
  const [csvContent, setCSVContent] = useState('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCSVContent(content);

      // Parse preview
      const lines = content.trim().split('\n').slice(0, 6);
      const parsed = lines.map(line => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });
      setPreviewRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Import Customers from CSV</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* File Drop Zone */}
        {!csvContent && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-cscx-gray-700 rounded-lg p-8 text-center hover:border-cscx-accent transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <svg className="w-12 h-12 text-cscx-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-white font-medium mb-2">Drop CSV file here or click to browse</p>
            <p className="text-cscx-gray-500 text-sm">Supports .csv files up to 5MB</p>
          </div>
        )}

        {/* Preview */}
        {csvContent && previewRows.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-medium">
                Preview: {fileName} ({previewRows.length - 1} rows)
              </p>
              <button
                onClick={() => {
                  setCSVContent('');
                  setPreviewRows([]);
                  setFileName('');
                }}
                className="text-sm text-cscx-gray-400 hover:text-white"
              >
                Change file
              </button>
            </div>
            <div className="overflow-x-auto bg-cscx-gray-800 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cscx-gray-700">
                    {previewRows[0]?.map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left text-cscx-gray-400 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(1, 6).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-cscx-gray-700/50">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-3 py-2 text-white">
                          {cell || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > 6 && (
              <p className="text-cscx-gray-500 text-sm mt-2">
                ...and {previewRows.length - 6} more rows
              </p>
            )}
          </div>
        )}

        {/* Template Link */}
        <div className="mb-6">
          <p className="text-cscx-gray-400 text-sm">
            Need the template?{' '}
            <button
              onClick={onDownloadTemplate}
              className="text-cscx-accent hover:underline"
            >
              Download it here
            </button>
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onImport(csvContent)}
            disabled={!csvContent || loading}
            className="px-4 py-2 bg-cscx-accent hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${previewRows.length > 1 ? previewRows.length - 1 : 0} Customers`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
