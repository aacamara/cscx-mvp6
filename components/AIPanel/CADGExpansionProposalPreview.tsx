/**
 * CADGExpansionProposalPreview - Editable expansion proposal preview for CADG-generated plans
 * Allows users to review, edit, and approve expansion products, pricing options, business case, and ROI before creating document
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface ExpansionProduct {
  id: string;
  name: string;
  description: string;
  category: 'module' | 'tier_upgrade' | 'seats' | 'storage' | 'support' | 'professional_services';
  currentPlan: string;
  proposedPlan: string;
  monthlyPrice: number;
  annualPrice: number;
  included: boolean;
}

export interface PricingOption {
  id: string;
  name: string;
  description: string;
  monthlyTotal: number;
  annualTotal: number;
  discount: string;
  term: string;
  recommended: boolean;
}

export interface BusinessCaseItem {
  id: string;
  title: string;
  description: string;
  category: 'efficiency' | 'revenue' | 'cost_savings' | 'risk_reduction' | 'competitive';
  impact: string;
  included: boolean;
}

export interface ROIProjection {
  investmentIncrease: number;
  projectedBenefit: number;
  roiPercentage: number;
  paybackMonths: number;
  assumptions: string[];
}

export interface ExpansionProposalData {
  title: string;
  proposalDate: string;
  validUntil: string;
  currentArrValue: number;
  proposedArrValue: number;
  expansionAmount: number;
  expansionProducts: ExpansionProduct[];
  pricingOptions: PricingOption[];
  businessCase: BusinessCaseItem[];
  roiProjection: ROIProjection;
  usageGaps: string[];
  growthSignals: string[];
  nextSteps: string[];
  notes: string;
}

export interface CustomerData {
  id: string | null;
  name: string;
  healthScore?: number;
  arr?: number;
}

interface CADGExpansionProposalPreviewProps {
  expansionProposal: ExpansionProposalData;
  customer: CustomerData;
  onSave: (expansionProposal: ExpansionProposalData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const PRODUCT_CATEGORY_OPTIONS = ['module', 'tier_upgrade', 'seats', 'storage', 'support', 'professional_services'] as const;
const BUSINESS_CASE_CATEGORY_OPTIONS = ['efficiency', 'revenue', 'cost_savings', 'risk_reduction', 'competitive'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  module: 'Module',
  tier_upgrade: 'Tier Upgrade',
  seats: 'Seats',
  storage: 'Storage',
  support: 'Support',
  professional_services: 'Professional Services',
  efficiency: 'Efficiency',
  revenue: 'Revenue',
  cost_savings: 'Cost Savings',
  risk_reduction: 'Risk Reduction',
  competitive: 'Competitive',
};

const CATEGORY_COLORS: Record<string, string> = {
  module: 'bg-blue-500/20 text-blue-400',
  tier_upgrade: 'bg-purple-500/20 text-purple-400',
  seats: 'bg-green-500/20 text-green-400',
  storage: 'bg-cyan-500/20 text-cyan-400',
  support: 'bg-amber-500/20 text-amber-400',
  professional_services: 'bg-pink-500/20 text-pink-400',
  efficiency: 'bg-blue-500/20 text-blue-400',
  revenue: 'bg-emerald-500/20 text-emerald-400',
  cost_savings: 'bg-green-500/20 text-green-400',
  risk_reduction: 'bg-amber-500/20 text-amber-400',
  competitive: 'bg-purple-500/20 text-purple-400',
};

// ============================================
// Component
// ============================================

export const CADGExpansionProposalPreview: React.FC<CADGExpansionProposalPreviewProps> = ({
  expansionProposal,
  customer,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();

  // Original data (for tracking modifications)
  const [original] = useState<ExpansionProposalData>(() => JSON.parse(JSON.stringify(expansionProposal)));

  // Editable draft state
  const [draft, setDraft] = useState<ExpansionProposalData>(() => JSON.parse(JSON.stringify(expansionProposal)));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'pricing' | 'business_case' | 'roi'>('overview');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [expandedBusinessCase, setExpandedBusinessCase] = useState<string | null>(null);

  // Check if draft has been modified
  const isModified = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(original);
  }, [draft, original]);

  // Calculate totals based on included products
  const calculatedTotals = useMemo(() => {
    const includedProducts = draft.expansionProducts.filter(p => p.included);
    const totalExpansion = includedProducts.reduce((sum, p) => sum + p.annualPrice, 0);
    const proposedArr = draft.currentArrValue + totalExpansion;
    const growthPercentage = Math.round((totalExpansion / draft.currentArrValue) * 100);
    return {
      productsCount: includedProducts.length,
      totalExpansion,
      proposedArr,
      growthPercentage,
      businessCaseCount: draft.businessCase.filter(b => b.included).length,
    };
  }, [draft.expansionProducts, draft.businessCase, draft.currentArrValue]);

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (isModified) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Update calculated values before saving
      const finalDraft = {
        ...draft,
        expansionAmount: calculatedTotals.totalExpansion,
        proposedArrValue: calculatedTotals.proposedArr,
      };
      await onSave(finalDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expansion proposal');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Basic Field Operations
  // ============================================

  const updateTitle = (value: string) => {
    setDraft(prev => ({ ...prev, title: value }));
  };

  const updateProposalDate = (value: string) => {
    setDraft(prev => ({ ...prev, proposalDate: value }));
  };

  const updateValidUntil = (value: string) => {
    setDraft(prev => ({ ...prev, validUntil: value }));
  };

  const updateNotes = (value: string) => {
    setDraft(prev => ({ ...prev, notes: value }));
  };

  // ============================================
  // Product Operations
  // ============================================

  const toggleProductIncluded = (productId: string) => {
    setDraft(prev => ({
      ...prev,
      expansionProducts: prev.expansionProducts.map(p =>
        p.id === productId ? { ...p, included: !p.included } : p
      ),
    }));
  };

  const updateProduct = (productId: string, field: keyof ExpansionProduct, value: any) => {
    setDraft(prev => ({
      ...prev,
      expansionProducts: prev.expansionProducts.map(p =>
        p.id === productId ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addProduct = () => {
    const newId = `product-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      expansionProducts: [
        ...prev.expansionProducts,
        {
          id: newId,
          name: 'New Product',
          description: '',
          category: 'module',
          currentPlan: 'Basic',
          proposedPlan: 'Enterprise',
          monthlyPrice: 0,
          annualPrice: 0,
          included: true,
        },
      ],
    }));
    setExpandedProduct(newId);
  };

  const removeProduct = (productId: string) => {
    setDraft(prev => ({
      ...prev,
      expansionProducts: prev.expansionProducts.filter(p => p.id !== productId),
    }));
    if (expandedProduct === productId) setExpandedProduct(null);
  };

  // ============================================
  // Pricing Option Operations
  // ============================================

  const setRecommendedOption = (optionId: string) => {
    setDraft(prev => ({
      ...prev,
      pricingOptions: prev.pricingOptions.map(o => ({
        ...o,
        recommended: o.id === optionId,
      })),
    }));
  };

  const updatePricingOption = (optionId: string, field: keyof PricingOption, value: any) => {
    setDraft(prev => ({
      ...prev,
      pricingOptions: prev.pricingOptions.map(o =>
        o.id === optionId ? { ...o, [field]: value } : o
      ),
    }));
  };

  const addPricingOption = () => {
    const newId = `option-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      pricingOptions: [
        ...prev.pricingOptions,
        {
          id: newId,
          name: 'New Option',
          description: '',
          monthlyTotal: 0,
          annualTotal: 0,
          discount: '0%',
          term: '12 months',
          recommended: false,
        },
      ],
    }));
  };

  const removePricingOption = (optionId: string) => {
    setDraft(prev => ({
      ...prev,
      pricingOptions: prev.pricingOptions.filter(o => o.id !== optionId),
    }));
  };

  // ============================================
  // Business Case Operations
  // ============================================

  const toggleBusinessCaseIncluded = (caseId: string) => {
    setDraft(prev => ({
      ...prev,
      businessCase: prev.businessCase.map(b =>
        b.id === caseId ? { ...b, included: !b.included } : b
      ),
    }));
  };

  const updateBusinessCase = (caseId: string, field: keyof BusinessCaseItem, value: any) => {
    setDraft(prev => ({
      ...prev,
      businessCase: prev.businessCase.map(b =>
        b.id === caseId ? { ...b, [field]: value } : b
      ),
    }));
  };

  const addBusinessCase = () => {
    const newId = `case-${Date.now()}`;
    setDraft(prev => ({
      ...prev,
      businessCase: [
        ...prev.businessCase,
        {
          id: newId,
          title: 'New Business Case',
          description: '',
          category: 'efficiency',
          impact: '',
          included: true,
        },
      ],
    }));
    setExpandedBusinessCase(newId);
  };

  const removeBusinessCase = (caseId: string) => {
    setDraft(prev => ({
      ...prev,
      businessCase: prev.businessCase.filter(b => b.id !== caseId),
    }));
    if (expandedBusinessCase === caseId) setExpandedBusinessCase(null);
  };

  // ============================================
  // ROI Projection Operations
  // ============================================

  const updateROIField = (field: keyof ROIProjection, value: any) => {
    setDraft(prev => {
      const newROI = { ...prev.roiProjection, [field]: value };
      // Auto-calculate derived values
      if (field === 'investmentIncrease' || field === 'projectedBenefit') {
        const investment = field === 'investmentIncrease' ? value : prev.roiProjection.investmentIncrease;
        const benefit = field === 'projectedBenefit' ? value : prev.roiProjection.projectedBenefit;
        newROI.roiPercentage = investment > 0 ? Math.round(((benefit - investment) / investment) * 100) : 0;
        newROI.paybackMonths = benefit > 0 ? Math.round((investment / benefit) * 12) : 0;
      }
      return { ...prev, roiProjection: newROI };
    });
  };

  const addAssumption = () => {
    setDraft(prev => ({
      ...prev,
      roiProjection: {
        ...prev.roiProjection,
        assumptions: [...prev.roiProjection.assumptions, ''],
      },
    }));
  };

  const updateAssumption = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      roiProjection: {
        ...prev.roiProjection,
        assumptions: prev.roiProjection.assumptions.map((a, i) => (i === index ? value : a)),
      },
    }));
  };

  const removeAssumption = (index: number) => {
    setDraft(prev => ({
      ...prev,
      roiProjection: {
        ...prev.roiProjection,
        assumptions: prev.roiProjection.assumptions.filter((_, i) => i !== index),
      },
    }));
  };

  // ============================================
  // List Operations (gaps, signals, nextSteps)
  // ============================================

  const addUsageGap = () => {
    setDraft(prev => ({
      ...prev,
      usageGaps: [...prev.usageGaps, ''],
    }));
  };

  const updateUsageGap = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      usageGaps: prev.usageGaps.map((g, i) => (i === index ? value : g)),
    }));
  };

  const removeUsageGap = (index: number) => {
    setDraft(prev => ({
      ...prev,
      usageGaps: prev.usageGaps.filter((_, i) => i !== index),
    }));
  };

  const addGrowthSignal = () => {
    setDraft(prev => ({
      ...prev,
      growthSignals: [...prev.growthSignals, ''],
    }));
  };

  const updateGrowthSignal = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      growthSignals: prev.growthSignals.map((s, i) => (i === index ? value : s)),
    }));
  };

  const removeGrowthSignal = (index: number) => {
    setDraft(prev => ({
      ...prev,
      growthSignals: prev.growthSignals.filter((_, i) => i !== index),
    }));
  };

  const addNextStep = () => {
    setDraft(prev => ({
      ...prev,
      nextSteps: [...prev.nextSteps, ''],
    }));
  };

  const updateNextStep = (index: number, value: string) => {
    setDraft(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.map((s, i) => (i === index ? value : s)),
    }));
  };

  const removeNextStep = (index: number) => {
    setDraft(prev => ({
      ...prev,
      nextSteps: prev.nextSteps.filter((_, i) => i !== index),
    }));
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Expansion Proposal Preview</h2>
              <p className="text-white/70 text-sm">
                {customer.name} • Review and edit before creating document
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">
              {calculatedTotals.productsCount} products • ${calculatedTotals.totalExpansion.toLocaleString()} expansion
            </span>
            {isModified && (
              <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 bg-cscx-gray-800/50">
        {(['overview', 'products', 'pricing', 'business_case', 'roi'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-violet-400 border-b-2 border-violet-400 bg-violet-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'products' && `Products (${draft.expansionProducts.length})`}
            {tab === 'pricing' && `Pricing (${draft.pricingOptions.length})`}
            {tab === 'business_case' && `Business Case (${draft.businessCase.length})`}
            {tab === 'roi' && 'ROI Analysis'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Proposal Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateTitle(e.target.value)}
                className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Proposal Date</label>
                <input
                  type="date"
                  value={draft.proposalDate}
                  onChange={(e) => updateProposalDate(e.target.value)}
                  className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={draft.validUntil}
                  onChange={(e) => updateValidUntil(e.target.value)}
                  className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-300">${(draft.currentArrValue / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Current ARR</div>
              </div>
              <div className="bg-cscx-gray-900 border border-violet-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-violet-400">${(calculatedTotals.proposedArr / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Proposed ARR</div>
              </div>
              <div className="bg-cscx-gray-900 border border-emerald-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-emerald-400">+${(calculatedTotals.totalExpansion / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Expansion</div>
              </div>
              <div className="bg-cscx-gray-900 border border-purple-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">+{calculatedTotals.growthPercentage}%</div>
                <div className="text-sm text-gray-400">Growth</div>
              </div>
            </div>

            {/* Growth Signals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Growth Signals</label>
                <button
                  onClick={addGrowthSignal}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  + Add Signal
                </button>
              </div>
              <div className="space-y-2">
                {draft.growthSignals.map((signal, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-emerald-400">+</span>
                    <input
                      type="text"
                      value={signal}
                      onChange={(e) => updateGrowthSignal(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => removeGrowthSignal(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Gaps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Usage Gaps (Opportunities)</label>
                <button
                  onClick={addUsageGap}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  + Add Gap
                </button>
              </div>
              <div className="space-y-2">
                {draft.usageGaps.map((gap, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-amber-400">!</span>
                    <input
                      type="text"
                      value={gap}
                      onChange={(e) => updateUsageGap(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => removeUsageGap(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Next Steps</label>
                <button
                  onClick={addNextStep}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  + Add Step
                </button>
              </div>
              <div className="space-y-2">
                {draft.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => updateNextStep(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => removeNextStep(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => updateNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes for this proposal..."
                className="w-full bg-cscx-gray-900 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Select products to include in the expansion proposal</p>
              <button
                onClick={addProduct}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Product
              </button>
            </div>

            <div className="space-y-3">
              {draft.expansionProducts.map((product) => (
                <div
                  key={product.id}
                  className={`bg-cscx-gray-900 border rounded-lg overflow-hidden transition-all ${
                    product.included ? 'border-violet-500/30' : 'border-white/10 opacity-50'
                  }`}
                >
                  {/* Product Header */}
                  <div className="p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={product.included}
                      onChange={() => toggleProductIncluded(product.id)}
                      className="w-5 h-5 rounded border-white/20 bg-cscx-gray-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <button
                      onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <span className={`text-xs px-2 py-0.5 rounded ${CATEGORY_COLORS[product.category]}`}>
                        {CATEGORY_LABELS[product.category]}
                      </span>
                      <span className="font-medium text-white">{product.name}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-violet-400">{product.proposedPlan}</span>
                      <span className="text-emerald-400 ml-auto">${product.annualPrice.toLocaleString()}/yr</span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedProduct === product.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded Product Details */}
                  {expandedProduct === product.id && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Category</label>
                          <select
                            value={product.category}
                            onChange={(e) => updateProduct(product.id, 'category', e.target.value)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {PRODUCT_CATEGORY_OPTIONS.map((cat) => (
                              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <textarea
                          value={product.description}
                          onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Current Plan</label>
                          <input
                            type="text"
                            value={product.currentPlan}
                            onChange={(e) => updateProduct(product.id, 'currentPlan', e.target.value)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Proposed Plan</label>
                          <input
                            type="text"
                            value={product.proposedPlan}
                            onChange={(e) => updateProduct(product.id, 'proposedPlan', e.target.value)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Monthly Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-400">$</span>
                            <input
                              type="number"
                              value={product.monthlyPrice}
                              onChange={(e) => updateProduct(product.id, 'monthlyPrice', parseInt(e.target.value) || 0)}
                              className="w-full bg-cscx-gray-800 border border-white/10 rounded pl-7 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Annual Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-400">$</span>
                            <input
                              type="number"
                              value={product.annualPrice}
                              onChange={(e) => updateProduct(product.id, 'annualPrice', parseInt(e.target.value) || 0)}
                              className="w-full bg-cscx-gray-800 border border-white/10 rounded pl-7 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeProduct(product.id)}
                        className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove Product
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Products Total */}
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total Expansion ({calculatedTotals.productsCount} products selected)</span>
                <span className="text-2xl font-bold text-violet-400">${calculatedTotals.totalExpansion.toLocaleString()}/yr</span>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Configure pricing options for the proposal</p>
              <button
                onClick={addPricingOption}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Option
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {draft.pricingOptions.map((option) => (
                <div
                  key={option.id}
                  className={`bg-cscx-gray-900 border rounded-lg p-4 transition-all ${
                    option.recommended ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-white/10'
                  }`}
                >
                  {option.recommended && (
                    <div className="text-xs text-violet-400 font-medium mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Recommended
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Option Name</label>
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => updatePricingOption(option.id, 'name', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Term</label>
                        <input
                          type="text"
                          value={option.term}
                          onChange={(e) => updatePricingOption(option.id, 'term', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={option.description}
                        onChange={(e) => updatePricingOption(option.id, 'description', e.target.value)}
                        className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Monthly Total</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-400">$</span>
                          <input
                            type="number"
                            value={option.monthlyTotal}
                            onChange={(e) => updatePricingOption(option.id, 'monthlyTotal', parseInt(e.target.value) || 0)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded pl-7 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Annual Total</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-400">$</span>
                          <input
                            type="number"
                            value={option.annualTotal}
                            onChange={(e) => updatePricingOption(option.id, 'annualTotal', parseInt(e.target.value) || 0)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded pl-7 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Discount</label>
                        <input
                          type="text"
                          value={option.discount}
                          onChange={(e) => updatePricingOption(option.id, 'discount', e.target.value)}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <button
                        onClick={() => setRecommendedOption(option.id)}
                        disabled={option.recommended}
                        className={`text-sm flex items-center gap-1 ${
                          option.recommended ? 'text-gray-500 cursor-not-allowed' : 'text-violet-400 hover:text-violet-300'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Set as Recommended
                      </button>
                      <button
                        onClick={() => removePricingOption(option.id)}
                        className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Case Tab */}
        {activeTab === 'business_case' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Build the business case for expansion</p>
              <button
                onClick={addBusinessCase}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {draft.businessCase.map((item) => (
                <div
                  key={item.id}
                  className={`bg-cscx-gray-900 border rounded-lg overflow-hidden transition-all ${
                    item.included ? 'border-violet-500/30' : 'border-white/10 opacity-50'
                  }`}
                >
                  {/* Business Case Header */}
                  <div className="p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={() => toggleBusinessCaseIncluded(item.id)}
                      className="w-5 h-5 rounded border-white/20 bg-cscx-gray-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <button
                      onClick={() => setExpandedBusinessCase(expandedBusinessCase === item.id ? null : item.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <span className={`text-xs px-2 py-0.5 rounded ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className="font-medium text-white">{item.title}</span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ml-auto ${
                          expandedBusinessCase === item.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded Business Case Details */}
                  {expandedBusinessCase === item.id && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Title</label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateBusinessCase(item.id, 'title', e.target.value)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Category</label>
                          <select
                            value={item.category}
                            onChange={(e) => updateBusinessCase(item.id, 'category', e.target.value)}
                            className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {BUSINESS_CASE_CATEGORY_OPTIONS.map((cat) => (
                              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateBusinessCase(item.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Impact</label>
                        <input
                          type="text"
                          value={item.impact}
                          onChange={(e) => updateBusinessCase(item.id, 'impact', e.target.value)}
                          placeholder="e.g., 20% reduction in manual tasks"
                          className="w-full bg-cscx-gray-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>

                      <button
                        onClick={() => removeBusinessCase(item.id)}
                        className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove Item
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROI Tab */}
        {activeTab === 'roi' && (
          <div className="space-y-4">
            {/* ROI Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-4">
                <div className="text-2xl font-bold text-violet-400">${(draft.roiProjection.investmentIncrease / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Investment</div>
              </div>
              <div className="bg-cscx-gray-900 border border-emerald-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-emerald-400">${(draft.roiProjection.projectedBenefit / 1000).toFixed(0)}K</div>
                <div className="text-sm text-gray-400">Projected Benefit</div>
              </div>
              <div className="bg-cscx-gray-900 border border-green-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{draft.roiProjection.roiPercentage}%</div>
                <div className="text-sm text-gray-400">ROI</div>
              </div>
              <div className="bg-cscx-gray-900 border border-cyan-500/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-cyan-400">{draft.roiProjection.paybackMonths}</div>
                <div className="text-sm text-gray-400">Payback Months</div>
              </div>
            </div>

            {/* Editable ROI Values */}
            <div className="bg-cscx-gray-900 border border-white/10 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-300">ROI Calculation</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Investment Increase (Annual)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={draft.roiProjection.investmentIncrease}
                      onChange={(e) => updateROIField('investmentIncrease', parseInt(e.target.value) || 0)}
                      className="w-full bg-cscx-gray-800 border border-white/10 rounded pl-7 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Projected Annual Benefit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={draft.roiProjection.projectedBenefit}
                      onChange={(e) => updateROIField('projectedBenefit', parseInt(e.target.value) || 0)}
                      className="w-full bg-cscx-gray-800 border border-white/10 rounded pl-7 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* Auto-calculated values */}
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">ROI Percentage: </span>
                    <span className="text-violet-400 font-medium">{draft.roiProjection.roiPercentage}%</span>
                    <span className="text-gray-500 text-xs ml-1">(auto-calculated)</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Payback Period: </span>
                    <span className="text-violet-400 font-medium">{draft.roiProjection.paybackMonths} months</span>
                    <span className="text-gray-500 text-xs ml-1">(auto-calculated)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assumptions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Assumptions</label>
                <button
                  onClick={addAssumption}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  + Add Assumption
                </button>
              </div>
              <div className="space-y-2">
                {draft.roiProjection.assumptions.map((assumption, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">•</span>
                    <input
                      type="text"
                      value={assumption}
                      onChange={(e) => updateAssumption(index, e.target.value)}
                      className="flex-1 bg-cscx-gray-900 border border-white/10 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => removeAssumption(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-cscx-gray-800 border-t border-white/10 px-4 py-3">
        {error && (
          <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {calculatedTotals.productsCount} products selected • ${calculatedTotals.totalExpansion.toLocaleString()} expansion • {calculatedTotals.growthPercentage}% growth
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Create Proposal Document
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
