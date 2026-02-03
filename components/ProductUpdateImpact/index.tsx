/**
 * Product Update Impact Component
 * PRD-126: Product Update Impact Assessment
 *
 * Features:
 * - Product updates list with filtering
 * - Impact assessment visualization
 * - Customer impact matrix
 * - Communication templates
 * - Adoption tracking
 * - Deprecation management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProductUpdateImpact } from '../../hooks/useProductUpdateImpact';
import {
  ProductUpdate,
  CustomerImpact,
  UpdateType,
  ImpactType,
  AdoptionStatus
} from '../../types/productUpdateImpact';
import { ImpactDetailModal } from './ImpactDetailModal';
import { CreateUpdateModal } from './CreateUpdateModal';

// ============================================
// Helper Functions
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (date: Date | string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getUpdateTypeColor = (type: UpdateType): string => {
  switch (type) {
    case 'feature': return 'bg-green-500/20 text-green-400';
    case 'improvement': return 'bg-blue-500/20 text-blue-400';
    case 'fix': return 'bg-gray-500/20 text-gray-400';
    case 'deprecation': return 'bg-yellow-500/20 text-yellow-400';
    case 'breaking': return 'bg-red-500/20 text-red-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
};

const getUpdateTypeIcon = (type: UpdateType): string => {
  switch (type) {
    case 'feature': return '+';
    case 'improvement': return '\u2191';
    case 'fix': return '\u2713';
    case 'deprecation': return '\u26A0';
    case 'breaking': return '!';
    default: return '\u2022';
  }
};

const getImpactTypeColor = (type: ImpactType): string => {
  switch (type) {
    case 'positive': return 'bg-green-500/20 text-green-400';
    case 'neutral': return 'bg-gray-500/20 text-gray-400';
    case 'action_required': return 'bg-yellow-500/20 text-yellow-400';
    case 'at_risk': return 'bg-red-500/20 text-red-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
};

const getImpactTypeLabel = (type: ImpactType): string => {
  switch (type) {
    case 'positive': return 'Positive';
    case 'neutral': return 'Neutral';
    case 'action_required': return 'Action Required';
    case 'at_risk': return 'At Risk';
    default: return type;
  }
};

const getAdoptionStatusColor = (status: AdoptionStatus): string => {
  switch (status) {
    case 'completed': return 'bg-green-500/20 text-green-400';
    case 'in_progress': return 'bg-blue-500/20 text-blue-400';
    case 'not_started': return 'bg-gray-500/20 text-gray-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
};

// ============================================
// Main Component
// ============================================

interface ProductUpdateImpactProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const ProductUpdateImpact: React.FC<ProductUpdateImpactProps> = ({
  onSelectCustomer
}) => {
  const {
    updates,
    updatesLoading,
    updatesError,
    fetchUpdates,
    selectedUpdate,
    impacts,
    impactSummary,
    impactLoading,
    impactError,
    fetchUpdateImpact,
    templates,
    adoptionSummary,
    deprecationSummary,
    notifyCSMs,
    triggerAssessment,
    createUpdate,
    clearSelection
  } = useProductUpdateImpact();

  // Local state
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [impactTypeFilter, setImpactTypeFilter] = useState<ImpactType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'adoption'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCustomerImpact, setSelectedCustomerImpact] = useState<CustomerImpact | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'impacts' | 'templates' | 'adoption' | 'deprecation'>('impacts');

  // Fetch update impact when selected
  useEffect(() => {
    if (selectedUpdateId) {
      fetchUpdateImpact(selectedUpdateId, {
        impactType: impactTypeFilter !== 'all' ? impactTypeFilter : undefined,
        search: searchQuery || undefined,
        sortBy,
        sortOrder
      });
    }
  }, [selectedUpdateId, impactTypeFilter, searchQuery, sortBy, sortOrder, fetchUpdateImpact]);

  // Handlers
  const handleSelectUpdate = (updateId: string) => {
    if (selectedUpdateId === updateId) {
      setSelectedUpdateId(null);
      clearSelection();
    } else {
      setSelectedUpdateId(updateId);
    }
  };

  const handleNotifyCSMs = async () => {
    if (!selectedUpdateId) return;
    const result = await notifyCSMs(selectedUpdateId);
    if (result.notified > 0) {
      alert(`Successfully notified ${result.notified} CSM(s)`);
    }
  };

  const handleTriggerAssessment = async () => {
    if (!selectedUpdateId) return;
    const success = await triggerAssessment(selectedUpdateId);
    if (success) {
      alert('Impact assessment completed successfully');
    }
  };

  const handleCreateUpdate = async (data: Partial<ProductUpdate>) => {
    const result = await createUpdate(data);
    if (result) {
      setShowCreateModal(false);
      setSelectedUpdateId(result.id);
    }
  };

  const handleSort = (field: 'relevance' | 'name' | 'adoption') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Filter impacts locally for display
  const filteredImpacts = impacts.filter(impact => {
    if (impactTypeFilter !== 'all' && impact.impactType !== impactTypeFilter) {
      return false;
    }
    if (searchQuery && !impact.customerName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Loading state
  if (updatesLoading && updates.length === 0) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading product updates...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Product Update Impact</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Assess customer impact and drive feature adoption
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUpdates}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Update
          </button>
        </div>
      </div>

      {/* Updates List */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">Recent Product Updates</h3>
        </div>
        <div className="divide-y divide-cscx-gray-800">
          {updates.length === 0 ? (
            <div className="p-8 text-center text-cscx-gray-500">
              No product updates found. Click "Log Update" to add one.
            </div>
          ) : (
            updates.map(update => (
              <div
                key={update.id}
                onClick={() => handleSelectUpdate(update.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedUpdateId === update.id
                    ? 'bg-cscx-accent/10 border-l-2 border-cscx-accent'
                    : 'hover:bg-cscx-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getUpdateTypeColor(update.updateType)}`}>
                        {getUpdateTypeIcon(update.updateType)} {update.updateType}
                      </span>
                      <span className="text-cscx-gray-500 text-xs">v{update.version}</span>
                    </div>
                    <h4 className="text-white font-medium">{update.name}</h4>
                    <p className="text-cscx-gray-400 text-sm mt-1 line-clamp-2">{update.description}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-cscx-gray-400">{formatDate(update.releasedAt)}</p>
                    {(update.updateType === 'deprecation' || update.updateType === 'breaking') && update.deprecationDeadline && (
                      <p className="text-yellow-400 text-xs mt-1">
                        Deadline: {formatDate(update.deprecationDeadline)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Impact Assessment Panel */}
      {selectedUpdate && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          {/* Update Header */}
          <div className="p-4 border-b border-cscx-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getUpdateTypeColor(selectedUpdate.updateType)}`}>
                    {selectedUpdate.updateType}
                  </span>
                  <span className="text-cscx-gray-500 text-sm">v{selectedUpdate.version}</span>
                </div>
                <h3 className="text-xl font-semibold text-white">{selectedUpdate.name}</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerAssessment}
                  className="px-3 py-1.5 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                >
                  Re-assess
                </button>
                <button
                  onClick={handleNotifyCSMs}
                  className="px-3 py-1.5 text-sm bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg transition-colors"
                >
                  Notify CSMs
                </button>
              </div>
            </div>
          </div>

          {/* Impact Summary Cards */}
          {impactSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-cscx-gray-800">
              <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-cscx-gray-400 uppercase">Total Impacted</p>
                <p className="text-2xl font-bold text-white mt-1">{impactSummary.totalCustomers}</p>
                <p className="text-xs text-cscx-gray-500">customers</p>
              </div>
              <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-cscx-gray-400 uppercase">ARR Impacted</p>
                <p className="text-2xl font-bold text-cscx-accent mt-1">
                  {formatCurrency(impactSummary.totalARRImpacted)}
                </p>
              </div>
              <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-cscx-gray-400 uppercase">Avg Relevance</p>
                <p className="text-2xl font-bold text-white mt-1">{impactSummary.avgRelevanceScore}%</p>
              </div>
              <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-cscx-gray-400 uppercase">At Risk</p>
                <p className="text-2xl font-bold text-red-400 mt-1">
                  {impactSummary.byImpactType.at_risk || 0}
                </p>
                <p className="text-xs text-cscx-gray-500">customers</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-cscx-gray-800">
            {(['impacts', 'templates', 'adoption', 'deprecation'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-cscx-accent border-b-2 border-cscx-accent'
                    : 'text-cscx-gray-400 hover:text-white'
                }`}
              >
                {tab === 'impacts' && 'Customer Impacts'}
                {tab === 'templates' && 'Templates'}
                {tab === 'adoption' && 'Adoption'}
                {tab === 'deprecation' && 'Deprecation'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Impacts Tab */}
            {activeTab === 'impacts' && (
              <div>
                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-1.5 pl-8 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent w-48"
                    />
                    <svg className="absolute left-2.5 top-2 w-4 h-4 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="flex gap-1 bg-cscx-gray-800 rounded-lg p-1">
                    {(['all', 'positive', 'neutral', 'action_required', 'at_risk'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setImpactTypeFilter(type)}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                          impactTypeFilter === type
                            ? 'bg-cscx-accent text-white'
                            : 'text-cscx-gray-400 hover:text-white'
                        }`}
                      >
                        {type === 'all' ? 'All' : getImpactTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Impacts Table */}
                {impactLoading ? (
                  <div className="p-8 text-center text-cscx-gray-400">
                    <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
                    Loading impact assessment...
                  </div>
                ) : filteredImpacts.length === 0 ? (
                  <div className="p-8 text-center text-cscx-gray-500">
                    No customers match the current filters
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cscx-gray-800/50">
                          <th
                            className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                            onClick={() => handleSort('name')}
                          >
                            Customer {sortBy === 'name' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                          </th>
                          <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Impact</th>
                          <th
                            className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                            onClick={() => handleSort('relevance')}
                          >
                            Relevance {sortBy === 'relevance' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                          </th>
                          <th
                            className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                            onClick={() => handleSort('adoption')}
                          >
                            Adoption {sortBy === 'adoption' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                          </th>
                          <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cscx-gray-800">
                        {filteredImpacts.map(impact => (
                          <tr
                            key={impact.id}
                            onClick={() => setSelectedCustomerImpact(impact)}
                            className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <p className="text-white font-medium">{impact.customerName}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getImpactTypeColor(impact.impactType)}`}>
                                {getImpactTypeLabel(impact.impactType)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-cscx-accent rounded-full"
                                    style={{ width: `${impact.relevanceScore}%` }}
                                  />
                                </div>
                                <span className="text-white text-sm">{impact.relevanceScore}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getAdoptionStatusColor(impact.adoptionStatus)}`}>
                                {impact.adoptionStatus.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-cscx-gray-300 text-xs truncate max-w-xs">
                                {impact.recommendedAction}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="p-8 text-center text-cscx-gray-500">
                    No communication templates available
                  </div>
                ) : (
                  templates.map(template => (
                    <div
                      key={template.id}
                      className="bg-cscx-gray-800/50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-medium bg-cscx-accent/20 text-cscx-accent rounded">
                            {template.templateType}
                          </span>
                          <h4 className="text-white font-medium">{template.name}</h4>
                        </div>
                        <button className="px-3 py-1 text-xs bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded transition-colors">
                          Copy
                        </button>
                      </div>
                      <p className="text-cscx-gray-400 text-sm mb-2">
                        Subject: {template.subject}
                      </p>
                      <div className="flex gap-2">
                        {template.targetImpactTypes.map(type => (
                          <span
                            key={type}
                            className={`px-2 py-0.5 text-xs rounded ${getImpactTypeColor(type)}`}
                          >
                            {getImpactTypeLabel(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Adoption Tab */}
            {activeTab === 'adoption' && adoptionSummary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400 uppercase">Adoption Rate</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{adoptionSummary.adoptionRate}%</p>
                  </div>
                  <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400 uppercase">Completed</p>
                    <p className="text-2xl font-bold text-white mt-1">{adoptionSummary.byStatus.completed}</p>
                  </div>
                  <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400 uppercase">In Progress</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{adoptionSummary.byStatus.in_progress}</p>
                  </div>
                  <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-cscx-gray-400 uppercase">Not Started</p>
                    <p className="text-2xl font-bold text-gray-400 mt-1">{adoptionSummary.byStatus.not_started}</p>
                  </div>
                </div>

                {adoptionSummary.avgDaysToAdoption && (
                  <p className="text-cscx-gray-400 text-sm">
                    Average time to adoption: <span className="text-white font-medium">{adoptionSummary.avgDaysToAdoption} days</span>
                  </p>
                )}

                {adoptionSummary.topBlockers.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-2">Top Adoption Blockers</h4>
                    <div className="space-y-2">
                      {adoptionSummary.topBlockers.map((blocker, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-cscx-gray-800/50 rounded-lg p-3"
                        >
                          <span className="text-cscx-gray-300 capitalize">{blocker.type.replace('_', ' ')}</span>
                          <span className="text-white font-medium">{blocker.count} customers</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Deprecation Tab */}
            {activeTab === 'deprecation' && (
              <div>
                {deprecationSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-cscx-gray-400 uppercase">Deadline</p>
                        <p className="text-lg font-bold text-yellow-400 mt-1">
                          {formatDate(deprecationSummary.deprecationDeadline)}
                        </p>
                      </div>
                      <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-cscx-gray-400 uppercase">Affected</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {deprecationSummary.totalAffectedCustomers}
                        </p>
                      </div>
                      <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-cscx-gray-400 uppercase">Completed</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">
                          {deprecationSummary.completedCount}
                        </p>
                      </div>
                      <div className="bg-cscx-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-cscx-gray-400 uppercase">At Risk</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">
                          {deprecationSummary.atRiskCount}
                        </p>
                        <p className="text-xs text-cscx-gray-500">
                          {formatCurrency(deprecationSummary.arrAtRisk)} ARR
                        </p>
                      </div>
                    </div>

                    {/* Status breakdown */}
                    <div>
                      <h4 className="text-white font-medium mb-2">Migration Status</h4>
                      <div className="flex gap-2">
                        {Object.entries(deprecationSummary.byStatus).map(([status, count]) => (
                          <div
                            key={status}
                            className="bg-cscx-gray-800/50 rounded-lg px-3 py-2 text-center flex-1"
                          >
                            <p className="text-lg font-bold text-white">{count as number}</p>
                            <p className="text-xs text-cscx-gray-400 capitalize">
                              {status.replace('_', ' ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-cscx-gray-500">
                    This update does not have deprecation tracking
                    <p className="text-xs mt-1">
                      Deprecation tracking is available for deprecation and breaking change updates
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Impact Detail Modal */}
      {selectedCustomerImpact && (
        <ImpactDetailModal
          impact={selectedCustomerImpact}
          templates={templates}
          onClose={() => setSelectedCustomerImpact(null)}
          onViewCustomer={onSelectCustomer}
        />
      )}

      {/* Create Update Modal */}
      {showCreateModal && (
        <CreateUpdateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUpdate}
        />
      )}
    </div>
  );
};

export default ProductUpdateImpact;
