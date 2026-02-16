/**
 * AgentCenterView - Standalone Agent Access
 * Quick access to agents for any customer (or general mode)
 * Provides customer selection for context-aware agent interactions
 * Now includes contract upload for starting new onboardings
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentControlCenter } from './AgentControlCenter';
import { ContractUpload } from './ContractUpload';
import { ExtractionPreview } from './ContractUpload/ExtractionPreview';
import { useAuth } from '../context/AuthContext';
import { CustomerContext, ContractData } from '../types/workflow';
import { parseContractFull } from '../services/geminiService';
import { ContractInput, ContractExtraction, OnboardingPlan } from '../types';
import { trackOnboardingStarted, trackContractUploadStarted } from '../src/services/analytics';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
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
  primary_contact?: {
    name: string;
    email: string;
    title?: string;
  };
}

// ============================================
// Props
// ============================================

interface AgentCenterViewProps {
  /** If true, automatically show contract upload for new onboarding */
  startOnboarding?: boolean;
  /** Callback when onboarding mode has been started (to reset parent state) */
  onOnboardingStarted?: () => void;
}

// ============================================
// Component
// ============================================

export const AgentCenterView: React.FC<AgentCenterViewProps> = ({
  startOnboarding = false,
  onOnboardingStarted
}) => {
  const { getAuthHeaders, isDesignPartner, userId } = useAuth();
  const [showMockOnboarding, setShowMockOnboarding] = useState(false);
  const [showExtractionPreview, setShowExtractionPreview] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState<ContractExtraction | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // View mode - go directly to chat (no customer selector)
  const [showCustomerSelector] = useState(false);
  const [activeAgentTab] = useState<'chat'>('chat');

  // New onboarding from contract upload
  const [showContractUpload, setShowContractUpload] = useState(false);
  const [isParsingContract, setIsParsingContract] = useState(false);
  const [contractData, setContractData] = useState<ContractExtraction | null>(null);
  const [onboardingPlan, setOnboardingPlan] = useState<OnboardingPlan | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Auto-trigger onboarding mode when startOnboarding prop is true
  useEffect(() => {
    if (startOnboarding) {
      setShowContractUpload(true);
      setContractData(null);
      setOnboardingPlan(null);
      setUploadError(null);
      // Notify parent that onboarding has started
      onOnboardingStarted?.();
    }
  }, [startOnboarding, onOnboardingStarted]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [dropdownOpen]);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch(`${API_URL}/api/customers?limit=100`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Filter customers by search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build customer context for agents
  const buildCustomerContext = (customer: Customer | null): CustomerContext => {
    // If we have contract data from upload, use that
    if (contractData) {
      return {
        id: contractData.company_name?.toLowerCase().replace(/\s+/g, '-') || 'new-customer',
        name: contractData.company_name || 'New Customer',
        arr: contractData.arr || 0,
        healthScore: 100,
        status: 'onboarding',
        products: contractData.entitlements?.map(e => e.description).slice(0, 5) || [],
        stakeholders: contractData.stakeholders?.map(s => `${s.name} (${s.role})`) || [],
        contractPeriod: contractData.contract_period,
      };
    }

    if (!customer) {
      return {
        name: 'General Mode',
        arr: 0,
        products: [],
        stakeholders: [],
        healthScore: 100,
        status: 'active'
      };
    }

    return {
      id: customer.id,
      name: customer.name,
      arr: customer.arr,
      healthScore: customer.health_score,
      status: customer.status,
      renewalDate: customer.renewal_date,
      csmName: customer.csm_name,
      primaryContact: customer.primary_contact,
      products: [],
      stakeholders: customer.primary_contact
        ? [`${customer.primary_contact.name} (${customer.primary_contact.title || 'Primary Contact'})`]
        : []
    };
  };

  // Handle contract upload for new onboarding
  const handleContractUpload = useCallback(async (input: ContractInput) => {
    setIsParsingContract(true);
    setUploadError(null);

    try {
      const result = await parseContractFull(input);
      const extraction = result.contractData as unknown as ContractExtraction;

      // For design partners, show preview step before creating customer
      if (isDesignPartner) {
        setPendingExtraction(extraction);
        setOnboardingPlan(result.plan as unknown as OnboardingPlan);
        setShowContractUpload(false);
        setShowExtractionPreview(true);
      } else {
        // Admins go directly to chat
        setContractData(extraction);
        setOnboardingPlan(result.plan as unknown as OnboardingPlan);
        setShowContractUpload(false);
      }

    } catch (e) {
      console.error('Contract parsing error:', e);
      setUploadError(e instanceof Error ? e.message : 'Failed to parse contract');
    } finally {
      setIsParsingContract(false);
    }
  }, [isDesignPartner]);

  // Handle confirmed extraction - create customer with owner_id
  const handleConfirmExtraction = useCallback(async (data: ContractExtraction) => {
    setIsCreatingCustomer(true);

    try {
      // Create customer with owner_id for design partners
      const response = await fetch(`${API_URL}/api/customers/from-contract`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractData: data,
          ownerId: isDesignPartner ? userId : null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create customer');
      }

      // Move to chat with the confirmed data
      setContractData(data);
      setShowExtractionPreview(false);
      setPendingExtraction(null);

    } catch (e) {
      console.error('Customer creation error:', e);
      setUploadError(e instanceof Error ? e.message : 'Failed to create customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  }, [getAuthHeaders, isDesignPartner, userId]);

  // Cancel extraction preview
  const handleCancelExtraction = useCallback(() => {
    setShowExtractionPreview(false);
    setPendingExtraction(null);
    setOnboardingPlan(null);
    setShowContractUpload(true);
  }, []);

  // Start new onboarding from contract
  const handleStartOnboarding = () => {
    setShowContractUpload(true);
    setContractData(null);
    setOnboardingPlan(null);
    setUploadError(null);
  };

  // Reset from contract upload
  const handleBackFromContractUpload = () => {
    setShowContractUpload(false);
    setContractData(null);
    setOnboardingPlan(null);
  };

  // Contract upload view
  if (showContractUpload) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">📄</span>
              New Onboarding
            </h2>
            <p className="text-cscx-gray-400 mt-1">
              Upload a contract to start AI-powered onboarding analysis
            </p>
          </div>
          <button
            onClick={handleBackFromContractUpload}
            className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Contract Upload */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          {isParsingContract ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-cscx-accent border-t-transparent mx-auto mb-4" />
              <p className="text-white font-medium">Analyzing contract...</p>
              <p className="text-sm text-cscx-gray-400 mt-2">
                Extracting customer info, stakeholders, entitlements, and creating onboarding plan
              </p>
            </div>
          ) : (
            <ContractUpload onUpload={handleContractUpload} />
          )}

          {uploadError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{uploadError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Extraction preview view (design partners only)
  if (showExtractionPreview && pendingExtraction) {
    return (
      <ExtractionPreview
        extraction={pendingExtraction}
        onConfirm={handleConfirmExtraction}
        onCancel={handleCancelExtraction}
        loading={isCreatingCustomer}
      />
    );
  }


  // Agent chat view - direct to conversation
  return (
    <div className="space-y-4">
      {/* Header with Customer Dropdown */}
      <div className="flex items-center gap-4 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="w-10 h-10 bg-gradient-to-br from-cscx-accent to-red-700 rounded-lg flex items-center justify-center text-xl">
          🤖
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-white font-medium">AI Assistant</span>
            <span className="text-cscx-gray-500">•</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => { setDropdownOpen(!dropdownOpen); setSearchQuery(''); }}
                className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cscx-accent cursor-pointer min-w-[200px] text-left flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {loadingCustomers
                    ? 'Loading...'
                    : selectedCustomer
                      ? `${selectedCustomer.name} ($${Math.round(selectedCustomer.arr / 1000)}K)`
                      : 'General Mode'}
                </span>
                <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-cscx-gray-700">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search customers..."
                      className="w-full bg-cscx-gray-900 border border-cscx-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedCustomer(null); setDropdownOpen(false); setSearchQuery(''); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-cscx-gray-700 transition-colors ${!selectedCustomer ? 'bg-cscx-accent/20 text-cscx-accent' : 'text-white'}`}
                    >
                      General Mode
                    </button>
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => { setSelectedCustomer(customer); setDropdownOpen(false); setSearchQuery(''); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-cscx-gray-700 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-cscx-accent/20 text-cscx-accent' : 'text-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium">{customer.name}</span>
                          <span className={`text-xs ml-2 flex-shrink-0 ${customer.health_score >= 80 ? 'text-green-400' : customer.health_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {customer.health_score}%
                          </span>
                        </div>
                        <div className="text-xs text-cscx-gray-400 mt-0.5">
                          {customer.industry || 'N/A'} &middot; ${Math.round(customer.arr / 1000)}K ARR
                        </div>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && !loadingCustomers && (
                      <div className="px-3 py-4 text-sm text-cscx-gray-500 text-center">
                        No customers match &ldquo;{searchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {selectedCustomer
              ? `${selectedCustomer.status.replace('_', ' ')} • $${selectedCustomer.arr.toLocaleString()} ARR • ${selectedCustomer.health_score}% health`
              : 'Select a customer for context-aware assistance'}
          </p>
        </div>
      </div>

      {/* Design Partner Quick Actions */}
      {isDesignPartner && !showMockOnboarding && !contractData && (
        <div className="bg-gradient-to-r from-cscx-accent/20 to-purple-900/20 border border-cscx-accent/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              <div>
                <p className="text-white font-medium">Try Mock Onboarding</p>
                <p className="text-gray-400 text-sm">Experience the AI-powered customer onboarding flow with simulated data</p>
              </div>
            </div>
            <button
              onClick={() => {
                trackOnboardingStarted();
                setShowMockOnboarding(true);
              }}
              className="bg-cscx-accent hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Start Demo
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <AgentControlCenter
          customer={buildCustomerContext(selectedCustomer)}
          contractData={contractData}
          plan={onboardingPlan}
          embedded={false}
          initialMessage={
            showMockOnboarding
              ? `🎭 **[DEMO MODE]** Welcome to the mock onboarding experience!\n\nI'll guide you through what a typical customer onboarding looks like in CSCX.AI.\n\n**Simulated Customer:** Acme Corp\n**ARR:** $250,000\n**Industry:** Technology\n\nLet me show you how I can help:\n1. 📧 **Draft welcome emails** - I'll create personalized onboarding sequences\n2. 📅 **Schedule kickoff meetings** - I'll propose optimal meeting times\n3. 📄 **Generate documents** - Success plans, QBR decks, and more\n\n*Note: All actions are simulated - no real emails will be sent.*\n\nWhat would you like to explore first?`
              : contractData
                ? `I've analyzed the contract for **${contractData.company_name}**.\n\n**ARR:** $${(contractData.arr || 0).toLocaleString()}\n**Stakeholders:** ${contractData.stakeholders?.length || 0}\n**Entitlements:** ${contractData.entitlements?.length || 0}\n\nI'm ready to help with onboarding. What would you like to do first?`
                : selectedCustomer
                  ? `I'm ready to help with ${selectedCustomer.name}. Their current health score is ${selectedCustomer.health_score}% and ARR is $${selectedCustomer.arr.toLocaleString()}. What would you like me to do?`
                  : `I'm ready to help. I can assist with playbooks, best practices, customer success questions, or any tasks you need. What would you like to know?`
          }
        />
      </div>
    </div>
  );
};

export default AgentCenterView;
