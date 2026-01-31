/**
 * AgentCenterView - Standalone Agent Access
 * Quick access to agents for any customer (or general mode)
 * Provides customer selection for context-aware agent interactions
 * Now includes contract upload for starting new onboardings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AgentControlCenter } from './AgentControlCenter';
import { ContractUpload } from './ContractUpload';
import { useAuth } from '../context/AuthContext';
import { CustomerContext, ContractData } from '../types/workflow';
import { parseContractFull } from '../services/geminiService';
import { ContractInput, ContractExtraction, OnboardingPlan } from '../types';

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
// Component
// ============================================

export const AgentCenterView: React.FC = () => {
  const { getAuthHeaders } = useAuth();

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch(`${API_URL}/api/customers`, {
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

      setContractData(result.contractData as unknown as ContractExtraction);
      setOnboardingPlan(result.plan as unknown as OnboardingPlan);
      setShowContractUpload(false);

    } catch (e) {
      console.error('Contract parsing error:', e);
      setUploadError(e instanceof Error ? e.message : 'Failed to parse contract');
    } finally {
      setIsParsingContract(false);
    }
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
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const customer = customers.find(c => c.id === e.target.value);
                setSelectedCustomer(customer || null);
              }}
              className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cscx-accent cursor-pointer min-w-[200px]"
            >
              <option value="">🌐 General Mode</option>
              {loadingCustomers ? (
                <option disabled>Loading customers...</option>
              ) : (
                customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} (${Math.round(customer.arr / 1000)}K • {customer.health_score}%)
                  </option>
                ))
              )}
            </select>
          </div>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {selectedCustomer
              ? `${selectedCustomer.status.replace('_', ' ')} • $${selectedCustomer.arr.toLocaleString()} ARR • ${selectedCustomer.health_score}% health`
              : 'Select a customer for context-aware assistance'}
          </p>
        </div>
      </div>

      {/* Chat */}
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <AgentControlCenter
          customer={buildCustomerContext(selectedCustomer)}
          contractData={contractData}
          plan={onboardingPlan}
          embedded={false}
          initialMessage={
            contractData
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
