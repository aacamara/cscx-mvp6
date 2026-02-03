import React, { useState, useEffect } from 'react';

interface Entitlement {
  id: string;
  contractId: string;
  customerId: string;
  customerName?: string;
  contractFileName?: string;
  sku?: string;
  productName?: string;
  quantity?: number;
  quantityUnit?: string;
  usageLimit?: number;
  usageUnit?: string;
  supportTier?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  confidenceOverall?: number;
  version?: number;
  isActive?: boolean;
  status: 'draft' | 'pending_review' | 'finalized';
  createdAt: string;
  updatedAt?: string;
}

interface EntitlementsTableProps {
  customerId?: string;
  contractId?: string;
  onReviewClick?: (entitlement: Entitlement) => void;
  onFinalizeClick?: (entitlement: Entitlement) => void;
}

const getConfidenceColor = (confidence?: number): string => {
  if (!confidence) return 'bg-gray-500';
  if (confidence >= 0.85) return 'bg-green-500';
  if (confidence >= 0.7) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getStatusBadge = (status: string): { color: string; label: string } => {
  switch (status) {
    case 'finalized':
      return { color: 'bg-green-500/20 text-green-400', label: 'Finalized' };
    case 'pending_review':
      return { color: 'bg-yellow-500/20 text-yellow-400', label: 'Pending Review' };
    default:
      return { color: 'bg-gray-500/20 text-gray-400', label: 'Draft' };
  }
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
};

const formatCurrency = (amount?: number, currency?: string): string => {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(amount);
};

export const EntitlementsTable: React.FC<EntitlementsTableProps> = ({
  customerId,
  contractId,
  onReviewClick,
  onFinalizeClick
}) => {
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchEntitlements();
  }, [customerId, contractId, statusFilter, page]);

  const fetchEntitlements = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (customerId) params.set('customer_id', customerId);
      if (contractId) params.set('contract_id', contractId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));

      const response = await fetch(`/api/entitlements?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch entitlements');
      }

      const data = await response.json();
      setEntitlements(data.entitlements || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (entitlement: Entitlement) => {
    if (onFinalizeClick) {
      onFinalizeClick(entitlement);
      return;
    }

    try {
      const response = await fetch(`/api/entitlements/${entitlement.id}/finalize`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to finalize entitlement');
      }

      fetchEntitlements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize');
    }
  };

  if (loading && entitlements.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-cscx-accent focus:border-cscx-accent"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending Review</option>
          <option value="finalized">Finalized</option>
        </select>

        <span className="text-sm text-gray-400">
          {total} entitlement{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Product</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Quantity</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Period</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Value</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Confidence</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entitlements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No entitlements found
                </td>
              </tr>
            ) : (
              entitlements.map((entitlement) => {
                const statusBadge = getStatusBadge(entitlement.status);
                return (
                  <tr
                    key={entitlement.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="text-white font-medium">
                          {entitlement.productName || entitlement.sku || 'Unnamed'}
                        </div>
                        {entitlement.sku && entitlement.productName && (
                          <div className="text-xs text-gray-500">{entitlement.sku}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {entitlement.quantity ? (
                        <>
                          {entitlement.quantity}
                          {entitlement.quantityUnit && (
                            <span className="text-gray-500 ml-1">{entitlement.quantityUnit}</span>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      <div className="text-xs">
                        {formatDate(entitlement.startDate)} - {formatDate(entitlement.endDate)}
                      </div>
                      {entitlement.renewalDate && (
                        <div className="text-xs text-gray-500">
                          Renews: {formatDate(entitlement.renewalDate)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {formatCurrency(entitlement.totalPrice, entitlement.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${getConfidenceColor(entitlement.confidenceOverall)}`}
                        />
                        <span className="text-gray-300">
                          {entitlement.confidenceOverall
                            ? `${Math.round(entitlement.confidenceOverall * 100)}%`
                            : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onReviewClick?.(entitlement)}
                          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                        >
                          Review
                        </button>
                        {entitlement.status !== 'finalized' && (
                          <button
                            onClick={() => handleFinalize(entitlement)}
                            className="px-3 py-1 text-xs bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded transition-colors"
                          >
                            Finalize
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default EntitlementsTable;
