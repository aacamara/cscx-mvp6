/**
 * AgentCenterView - Standalone Agent Access
 * Quick access to agents for any customer (or general mode)
 * Provides customer selection for context-aware agent interactions
 * Now includes contract upload for starting new onboardings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AgentControlCenter } from './AgentControlCenter';
import { ContractUpload } from './ContractUpload';
import { MCPToolsBrowser } from './WorkspaceAgentV2/MCPToolsBrowser';
import { TriggersDashboard } from './WorkspaceAgentV2/TriggersDashboard';
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

  // View mode
  const [showCustomerSelector, setShowCustomerSelector] = useState(true);
  const [activeAgentTab, setActiveAgentTab] = useState<
    'chat' | 'tools' | 'triggers' | 'playbooks' | 'skills' | 'automations' | 'meetings'
  >('chat');

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

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSelector(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setShowCustomerSelector(true);
  };

  const handleUseGeneralMode = () => {
    setSelectedCustomer(null);
    setShowCustomerSelector(false);
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
      setShowCustomerSelector(false);

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

  // Reset to selector
  const handleBackToSelector = () => {
    setShowContractUpload(false);
    setContractData(null);
    setOnboardingPlan(null);
    setShowCustomerSelector(true);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400',
      onboarding: 'bg-blue-500/20 text-blue-400',
      at_risk: 'bg-red-500/20 text-red-400',
      churned: 'bg-gray-500/20 text-gray-400'
    };
    return styles[status] || styles.active;
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
            onClick={handleBackToSelector}
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

  // Customer selector view
  if (showCustomerSelector) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              Agent Center
            </h2>
            <p className="text-cscx-gray-400 mt-1">
              Select a customer for context-aware agent interactions, or use general mode
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* General Mode Card */}
          <button
            onClick={handleUseGeneralMode}
            className="p-6 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl hover:border-cscx-accent/50 transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cscx-gray-800 rounded-xl flex items-center justify-center text-2xl group-hover:bg-cscx-accent/20 transition-colors">
                🌐
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">General Mode</h3>
                <p className="text-sm text-cscx-gray-400 mt-1">
                  Use agents for general questions, playbook lookup, and non-customer tasks.
                </p>
              </div>
            </div>
          </button>

          {/* Customer Mode Card */}
          <div className="p-6 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-2xl">
                👤
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Customer Context</h3>
                <p className="text-sm text-cscx-gray-400 mt-1">
                  Select a customer below for personalized assistance
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Search */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold text-white">Select Customer</h3>
            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers..."
                className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
              />
            </div>
          </div>

          {/* Customer Grid */}
          {loadingCustomers ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-cscx-gray-400">
                {searchQuery ? 'No customers match your search' : 'No customers found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="p-4 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-xl text-left transition-all hover:scale-[1.02] border border-transparent hover:border-cscx-accent/30"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cscx-accent to-red-700 rounded-lg flex items-center justify-center text-white font-bold">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{customer.name}</h4>
                        <p className="text-xs text-cscx-gray-400">{customer.industry}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(customer.status)}`}>
                      {customer.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cscx-gray-400">
                      ${(customer.arr / 1000).toFixed(0)}K ARR
                    </span>
                    <span className={getHealthColor(customer.health_score)}>
                      {customer.health_score}% health
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Agent view with selected customer (or general mode or contract data)
  return (
    <div className="space-y-4">
      {/* Context Bar */}
      <div className="flex items-center justify-between bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-4">
          {contractData ? (
            <>
              <div className="w-10 h-10 bg-gradient-to-br from-cscx-accent to-red-700 rounded-lg flex items-center justify-center text-white font-bold">
                {contractData.company_name?.charAt(0) || 'N'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium">{contractData.company_name || 'New Customer'}</h3>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                    onboarding
                  </span>
                </div>
                <p className="text-sm text-cscx-gray-400">
                  ${(contractData.arr || 0).toLocaleString()} ARR • {contractData.stakeholders?.length || 0} stakeholders
                </p>
              </div>
            </>
          ) : selectedCustomer ? (
            <>
              <div className="w-10 h-10 bg-gradient-to-br from-cscx-accent to-red-700 rounded-lg flex items-center justify-center text-white font-bold">
                {selectedCustomer.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium">{selectedCustomer.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(selectedCustomer.status)}`}>
                    {selectedCustomer.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-cscx-gray-400">
                  ${selectedCustomer.arr.toLocaleString()} ARR • {selectedCustomer.health_score}% health
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 bg-cscx-gray-800 rounded-lg flex items-center justify-center text-xl">
                🌐
              </div>
              <div>
                <h3 className="text-white font-medium">General Mode</h3>
                <p className="text-sm text-cscx-gray-400">No customer context</p>
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleBackToSelector}
          className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
        >
          <span>↻</span>
          {contractData ? 'New Session' : 'Change Customer'}
        </button>
      </div>

      {/* Agent Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'chat' as const, label: 'Chat', icon: '💬' },
          { id: 'tools' as const, label: 'Tools', icon: '🔧' },
          { id: 'triggers' as const, label: 'Triggers', icon: '⚡' },
          { id: 'playbooks' as const, label: 'Playbooks', icon: '📋' },
          { id: 'skills' as const, label: 'Skills', icon: '🎯' },
          { id: 'automations' as const, label: 'Automations', icon: '🤖' },
          { id: 'meetings' as const, label: 'Meetings', icon: '📅' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveAgentTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeAgentTab === tab.id
                ? 'bg-cscx-accent text-white'
                : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeAgentTab === 'chat' && (
        <div className="h-[calc(100vh-340px)] min-h-[500px]">
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
                  : `I'm in general mode without customer context. I can help with playbooks, best practices, or general customer success questions. What would you like to know?`
            }
          />
        </div>
      )}

      {activeAgentTab === 'tools' && <MCPToolsBrowser />}

      {activeAgentTab === 'triggers' && <TriggersDashboard />}

      {activeAgentTab === 'playbooks' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-white mb-2">Playbooks Manager</h3>
            <p className="text-cscx-gray-400 max-w-md mx-auto">
              Browse playbook templates with stage visualizations. Start playbook executions for customers.
            </p>
            <div className="mt-6 px-4 py-2 bg-cscx-gray-800 rounded-lg inline-block">
              <span className="text-cscx-gray-500 text-sm">Coming in WAD-004</span>
            </div>
          </div>
        </div>
      )}

      {activeAgentTab === 'skills' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-white mb-2">Skills Library</h3>
            <p className="text-cscx-gray-400 max-w-md mx-auto">
              Execute pre-built skills with custom inputs. Track cost savings and time estimates.
            </p>
            <div className="mt-6 px-4 py-2 bg-cscx-gray-800 rounded-lg inline-block">
              <span className="text-cscx-gray-500 text-sm">Coming in WAD-005</span>
            </div>
          </div>
        </div>
      )}

      {activeAgentTab === 'automations' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-white mb-2">Automations Panel</h3>
            <p className="text-cscx-gray-400 max-w-md mx-auto">
              Create automations using natural language. Manage schedules and view run history.
            </p>
            <div className="mt-6 px-4 py-2 bg-cscx-gray-800 rounded-lg inline-block">
              <span className="text-cscx-gray-500 text-sm">Coming in WAD-006</span>
            </div>
          </div>
        </div>
      )}

      {activeAgentTab === 'meetings' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-white mb-2">Meeting Intelligence</h3>
            <p className="text-cscx-gray-400 max-w-md mx-auto">
              View meeting analyses with summaries, sentiment, action items, and risk indicators.
            </p>
            <div className="mt-6 px-4 py-2 bg-cscx-gray-800 rounded-lg inline-block">
              <span className="text-cscx-gray-500 text-sm">Coming in WAD-007</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCenterView;
