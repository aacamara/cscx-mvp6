import React, { useState, useEffect } from 'react';

interface Entitlement {
  id: string;
  contractId: string;
  customerId: string;
  customerName?: string;
  contract?: {
    file_name?: string;
    file_url?: string;
    parsed_data?: Record<string, unknown>;
  };
  sku?: string;
  productName?: string;
  quantity?: number;
  quantityUnit?: string;
  usageLimit?: number;
  usageUnit?: string;
  supportTier?: string;
  slaResponseTime?: string;
  slaResolutionTime?: string;
  startDate?: string;
  endDate?: string;
  effectiveDate?: string;
  renewalDate?: string;
  renewalTerms?: string;
  autoRenew?: boolean;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  billingFrequency?: string;
  confidenceSku?: number;
  confidenceQuantity?: number;
  confidenceDates?: number;
  confidencePricing?: number;
  confidenceOverall?: number;
  specialClauses?: string[];
  exclusions?: string[];
  notes?: string;
  sourceSection?: string;
  version?: number;
  isActive?: boolean;
  status: 'draft' | 'pending_review' | 'finalized';
}

interface EditHistory {
  id: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  editedBy?: string;
  editedAt: string;
}

interface EntitlementReviewModalProps {
  entitlementId: string;
  onClose: () => void;
  onSave: () => void;
  onFinalize?: () => void;
}

const getConfidenceBadge = (confidence?: number): { color: string; label: string } => {
  if (!confidence) return { color: 'bg-gray-500/20 text-gray-400', label: 'Unknown' };
  if (confidence >= 0.85) return { color: 'bg-green-500/20 text-green-400', label: 'High' };
  if (confidence >= 0.7) return { color: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' };
  return { color: 'bg-red-500/20 text-red-400', label: 'Low' };
};

const FormField: React.FC<{
  label: string;
  value: string | number | boolean | undefined;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'checkbox' | 'textarea';
  confidence?: number;
  disabled?: boolean;
}> = ({ label, value, onChange, type = 'text', confidence, disabled }) => {
  const badge = getConfidenceBadge(confidence);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">{label}</label>
        {confidence !== undefined && (
          <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      {type === 'textarea' ? (
        <textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full px-3 py-2 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-cscx-accent focus:border-cscx-accent disabled:opacity-50"
        />
      ) : type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(String(e.target.checked))}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-700 bg-cscx-gray-800 text-cscx-accent focus:ring-cscx-accent"
        />
      ) : (
        <input
          type={type}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-cscx-accent focus:border-cscx-accent disabled:opacity-50"
        />
      )}
    </div>
  );
};

export const EntitlementReviewModal: React.FC<EntitlementReviewModalProps> = ({
  entitlementId,
  onClose,
  onSave,
  onFinalize
}) => {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchEntitlement();
    fetchHistory();
  }, [entitlementId]);

  const fetchEntitlement = async () => {
    try {
      const response = await fetch(`/api/entitlements/${entitlementId}`);
      if (!response.ok) throw new Error('Failed to fetch entitlement');

      const data = await response.json();
      setEntitlement(data);
      setFormData({
        sku: data.sku || '',
        productName: data.productName || '',
        quantity: data.quantity || '',
        quantityUnit: data.quantityUnit || '',
        usageLimit: data.usageLimit || '',
        usageUnit: data.usageUnit || '',
        supportTier: data.supportTier || '',
        slaResponseTime: data.slaResponseTime || '',
        slaResolutionTime: data.slaResolutionTime || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        effectiveDate: data.effectiveDate || '',
        renewalDate: data.renewalDate || '',
        renewalTerms: data.renewalTerms || '',
        autoRenew: data.autoRenew || false,
        unitPrice: data.unitPrice || '',
        totalPrice: data.totalPrice || '',
        currency: data.currency || 'USD',
        billingFrequency: data.billingFrequency || '',
        notes: data.notes || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entitlement');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/entitlements/${entitlementId}/history`);
      if (!response.ok) return;

      const data = await response.json();
      setEditHistory(data.edits || []);
    } catch {
      // History is optional, don't show error
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Build update payload with only changed fields
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        const original = entitlement?.[key as keyof Entitlement];
        if (String(value) !== String(original || '')) {
          // Convert types appropriately
          if (['quantity', 'usageLimit', 'unitPrice', 'totalPrice'].includes(key)) {
            updates[key] = value ? Number(value) : null;
          } else if (key === 'autoRenew') {
            updates[key] = value === 'true' || value === true;
          } else {
            updates[key] = value || null;
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        onSave();
        return;
      }

      const response = await fetch(`/api/entitlements/${entitlementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to save changes');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save first if there are changes
      await handleSave();

      const response = await fetch(`/api/entitlements/${entitlementId}/finalize`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to finalize entitlement');
      }

      onFinalize?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!entitlement) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 rounded-lg p-8 text-red-400">
          Entitlement not found
          <button onClick={onClose} className="block mt-4 text-gray-400 hover:text-white">
            Close
          </button>
        </div>
      </div>
    );
  }

  const isFinalized = entitlement.status === 'finalized';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Review Entitlement</h2>
            <p className="text-sm text-gray-400">
              {entitlement.customerName} - {entitlement.contract?.file_name || 'Contract'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs ${
                isFinalized
                  ? 'bg-green-500/20 text-green-400'
                  : entitlement.status === 'pending_review'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {isFinalized ? 'Finalized' : entitlement.status === 'pending_review' ? 'Pending Review' : 'Draft'}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form Fields */}
            <div className="space-y-6">
              {/* Product Info */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-white">Product Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="SKU"
                    value={formData.sku as string}
                    onChange={(v) => handleFieldChange('sku', v)}
                    confidence={entitlement.confidenceSku}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Product Name"
                    value={formData.productName as string}
                    onChange={(v) => handleFieldChange('productName', v)}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Quantity"
                    value={formData.quantity as number}
                    onChange={(v) => handleFieldChange('quantity', v)}
                    type="number"
                    confidence={entitlement.confidenceQuantity}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Quantity Unit"
                    value={formData.quantityUnit as string}
                    onChange={(v) => handleFieldChange('quantityUnit', v)}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Usage Limit"
                    value={formData.usageLimit as number}
                    onChange={(v) => handleFieldChange('usageLimit', v)}
                    type="number"
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Usage Unit"
                    value={formData.usageUnit as string}
                    onChange={(v) => handleFieldChange('usageUnit', v)}
                    disabled={isFinalized}
                  />
                </div>
              </div>

              {/* Support */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-white">Support Terms</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Support Tier"
                    value={formData.supportTier as string}
                    onChange={(v) => handleFieldChange('supportTier', v)}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="SLA Response Time"
                    value={formData.slaResponseTime as string}
                    onChange={(v) => handleFieldChange('slaResponseTime', v)}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="SLA Resolution Time"
                    value={formData.slaResolutionTime as string}
                    onChange={(v) => handleFieldChange('slaResolutionTime', v)}
                    disabled={isFinalized}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-white">Contract Dates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Start Date"
                    value={formData.startDate as string}
                    onChange={(v) => handleFieldChange('startDate', v)}
                    type="date"
                    confidence={entitlement.confidenceDates}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="End Date"
                    value={formData.endDate as string}
                    onChange={(v) => handleFieldChange('endDate', v)}
                    type="date"
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Effective Date"
                    value={formData.effectiveDate as string}
                    onChange={(v) => handleFieldChange('effectiveDate', v)}
                    type="date"
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Renewal Date"
                    value={formData.renewalDate as string}
                    onChange={(v) => handleFieldChange('renewalDate', v)}
                    type="date"
                    disabled={isFinalized}
                  />
                </div>
                <FormField
                  label="Renewal Terms"
                  value={formData.renewalTerms as string}
                  onChange={(v) => handleFieldChange('renewalTerms', v)}
                  type="textarea"
                  disabled={isFinalized}
                />
              </div>

              {/* Pricing */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-white">Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Unit Price"
                    value={formData.unitPrice as number}
                    onChange={(v) => handleFieldChange('unitPrice', v)}
                    type="number"
                    confidence={entitlement.confidencePricing}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Total Price"
                    value={formData.totalPrice as number}
                    onChange={(v) => handleFieldChange('totalPrice', v)}
                    type="number"
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Currency"
                    value={formData.currency as string}
                    onChange={(v) => handleFieldChange('currency', v)}
                    disabled={isFinalized}
                  />
                  <FormField
                    label="Billing Frequency"
                    value={formData.billingFrequency as string}
                    onChange={(v) => handleFieldChange('billingFrequency', v)}
                    disabled={isFinalized}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-white">Notes</h3>
                <FormField
                  label="Internal Notes"
                  value={formData.notes as string}
                  onChange={(v) => handleFieldChange('notes', v)}
                  type="textarea"
                  disabled={isFinalized}
                />
              </div>
            </div>

            {/* Right: Source & History */}
            <div className="space-y-6">
              {/* Source Section */}
              {entitlement.sourceSection && (
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Source Text</h3>
                  <div className="bg-cscx-gray-900 rounded p-3 text-sm text-gray-300 max-h-64 overflow-auto whitespace-pre-wrap">
                    {entitlement.sourceSection}
                  </div>
                </div>
              )}

              {/* Special Clauses */}
              {entitlement.specialClauses && entitlement.specialClauses.length > 0 && (
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Special Clauses</h3>
                  <ul className="space-y-2">
                    {entitlement.specialClauses.map((clause, idx) => (
                      <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-cscx-accent">•</span>
                        {clause}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Exclusions */}
              {entitlement.exclusions && entitlement.exclusions.length > 0 && (
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Exclusions</h3>
                  <ul className="space-y-2">
                    {entitlement.exclusions.map((exclusion, idx) => (
                      <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        {exclusion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Edit History */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between w-full text-sm font-medium text-white"
                >
                  <span>Edit History ({editHistory.length})</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                    {editHistory.length === 0 ? (
                      <p className="text-sm text-gray-500">No edits yet</p>
                    ) : (
                      editHistory.map((edit) => (
                        <div key={edit.id} className="text-xs bg-cscx-gray-900 rounded p-2">
                          <div className="flex items-center justify-between text-gray-400">
                            <span className="font-medium text-white">{edit.fieldName}</span>
                            <span>{new Date(edit.editedAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-red-400 line-through">{edit.oldValue || '(empty)'}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-green-400">{edit.newValue || '(empty)'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Confidence Summary */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-3">Confidence Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'SKU', value: entitlement.confidenceSku },
                    { label: 'Quantity', value: entitlement.confidenceQuantity },
                    { label: 'Dates', value: entitlement.confidenceDates },
                    { label: 'Pricing', value: entitlement.confidencePricing },
                    { label: 'Overall', value: entitlement.confidenceOverall }
                  ].map(({ label, value }) => {
                    const badge = getConfidenceBadge(value);
                    return (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-gray-400">{label}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                          {value ? `${Math.round(value * 100)}%` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {!isFinalized && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/80 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {saving ? 'Finalizing...' : 'Finalize'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntitlementReviewModal;
