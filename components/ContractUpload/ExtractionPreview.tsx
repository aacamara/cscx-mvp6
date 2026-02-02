/**
 * ExtractionPreview - Review and edit extracted contract data before creating customer
 * Allows design partners to confirm/modify AI-extracted data
 */

import React, { useState } from 'react';
import { ContractExtraction } from '../../types';

interface ExtractionPreviewProps {
  extraction: ContractExtraction;
  onConfirm: (data: ContractExtraction) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ExtractionPreview: React.FC<ExtractionPreviewProps> = ({
  extraction,
  onConfirm,
  onCancel,
  loading = false
}) => {
  const [editedData, setEditedData] = useState<ContractExtraction>({
    ...extraction,
    stakeholders: extraction.stakeholders || [],
    entitlements: extraction.entitlements || []
  });

  const [newStakeholder, setNewStakeholder] = useState({ name: '', role: '', contact: '' });
  const [newEntitlement, setNewEntitlement] = useState({
    type: '',
    description: '',
    quantity: '',
    start_date: '',
    end_date: '',
    dependencies: ''
  });

  const handleFieldChange = (field: keyof ContractExtraction, value: unknown) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddStakeholder = () => {
    if (!newStakeholder.name.trim()) return;
    setEditedData(prev => ({
      ...prev,
      stakeholders: [...(prev.stakeholders || []), { ...newStakeholder }]
    }));
    setNewStakeholder({ name: '', role: '', contact: '' });
  };

  const handleRemoveStakeholder = (index: number) => {
    setEditedData(prev => ({
      ...prev,
      stakeholders: prev.stakeholders?.filter((_, i) => i !== index) || []
    }));
  };

  const handleAddEntitlement = () => {
    if (!newEntitlement.description.trim()) return;
    setEditedData(prev => ({
      ...prev,
      entitlements: [...(prev.entitlements || []), { ...newEntitlement }]
    }));
    setNewEntitlement({
      type: '',
      description: '',
      quantity: '',
      start_date: '',
      end_date: '',
      dependencies: ''
    });
  };

  const handleRemoveEntitlement = (index: number) => {
    setEditedData(prev => ({
      ...prev,
      entitlements: prev.entitlements?.filter((_, i) => i !== index) || []
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">📋</span>
            Review Extracted Data
          </h2>
          <p className="text-cscx-gray-400 mt-1">
            Verify the information extracted from your contract before creating the customer
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Main Form */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6 space-y-6">
        {/* Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={editedData.company_name || ''}
              onChange={(e) => handleFieldChange('company_name', e.target.value)}
              className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
              ARR (Annual Recurring Revenue) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-cscx-gray-500">$</span>
              <input
                type="number"
                value={editedData.arr || 0}
                onChange={(e) => handleFieldChange('arr', parseInt(e.target.value) || 0)}
                className="w-full pl-8 pr-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
              />
            </div>
          </div>
        </div>

        {/* Contract Period */}
        <div>
          <label className="block text-sm font-medium text-cscx-gray-400 mb-2">
            Contract Period
          </label>
          <input
            type="text"
            value={editedData.contract_period || ''}
            onChange={(e) => handleFieldChange('contract_period', e.target.value)}
            placeholder="e.g., January 1, 2026 - December 31, 2026"
            className="w-full px-4 py-2.5 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
          />
        </div>

        {/* Stakeholders */}
        <div>
          <label className="block text-sm font-medium text-cscx-gray-400 mb-3">
            Stakeholders ({editedData.stakeholders?.length || 0})
          </label>
          <div className="space-y-2 mb-3">
            {editedData.stakeholders?.map((stakeholder, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-cscx-gray-800 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white font-medium">{stakeholder.name}</p>
                  <p className="text-cscx-gray-500 text-sm">
                    {stakeholder.role}{stakeholder.contact ? ` - ${stakeholder.contact}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveStakeholder(idx)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newStakeholder.name}
              onChange={(e) => setNewStakeholder(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name"
              className="flex-1 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            />
            <input
              type="text"
              value={newStakeholder.role}
              onChange={(e) => setNewStakeholder(prev => ({ ...prev, role: e.target.value }))}
              placeholder="Role"
              className="flex-1 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            />
            <input
              type="text"
              value={newStakeholder.contact}
              onChange={(e) => setNewStakeholder(prev => ({ ...prev, contact: e.target.value }))}
              placeholder="Email"
              className="flex-1 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            />
            <button
              onClick={handleAddStakeholder}
              disabled={!newStakeholder.name.trim()}
              className="px-3 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              Add
            </button>
          </div>
        </div>

        {/* Entitlements */}
        <div>
          <label className="block text-sm font-medium text-cscx-gray-400 mb-3">
            Entitlements ({editedData.entitlements?.length || 0})
          </label>
          <div className="space-y-2 mb-3">
            {editedData.entitlements?.map((entitlement, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-cscx-gray-800 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white">{entitlement.description}</p>
                  {entitlement.quantity && (
                    <p className="text-cscx-gray-500 text-sm">Qty: {entitlement.quantity}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveEntitlement(idx)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEntitlement.description}
              onChange={(e) => setNewEntitlement(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              className="flex-1 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            />
            <input
              type="text"
              value={newEntitlement.quantity}
              onChange={(e) => setNewEntitlement(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="Quantity (optional)"
              className="w-32 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            />
            <button
              onClick={handleAddEntitlement}
              disabled={!newEntitlement.description.trim()}
              className="px-3 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(editedData)}
          disabled={!editedData.company_name?.trim() || loading}
          className="px-6 py-2.5 bg-cscx-accent hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Confirm & Start Onboarding
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ExtractionPreview;
