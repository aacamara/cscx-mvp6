import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ContractExtraction, OnboardingPlan, WorkflowState } from '../types';
import { AgentMessage, CustomerContext, AgentId } from '../types/agents';

// ============================================
// UNIFIED STATE FOR SEQUENTIAL HANDOFF
// ============================================

export type OnboardingPhase =
  | 'upload'      // Contract upload
  | 'parsing'     // Extracting data
  | 'review'      // User reviews extracted data
  | 'planning'    // Generating plan
  | 'handoff'     // Transitioning to agents
  | 'execution'   // Agents executing
  | 'complete';   // Onboarding done

export interface OnboardingState {
  // Current phase
  phase: OnboardingPhase;

  // Contract data (from parsing)
  contractData: ContractExtraction | null;

  // Generated content
  summary: string | null;
  plan: OnboardingPlan | null;

  // Customer context (for agents)
  customer: CustomerContext | null;

  // Agent execution
  sessionId: string | null;
  agentMessages: AgentMessage[];
  activeAgent: AgentId | null;

  // UI state
  isProcessing: boolean;
  error: string | null;
}

interface OnboardingContextType {
  state: OnboardingState;

  // Phase transitions
  setPhase: (phase: OnboardingPhase) => void;

  // Contract data
  setContractData: (data: ContractExtraction) => void;
  setSummary: (summary: string) => void;
  setPlan: (plan: OnboardingPlan) => void;

  // Agent handoff
  initiateHandoff: () => void;
  setSessionId: (id: string) => void;
  addAgentMessage: (message: AgentMessage) => void;
  setActiveAgent: (agent: AgentId | null) => void;

  // UI
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState: OnboardingState = {
  phase: 'upload',
  contractData: null,
  summary: null,
  plan: null,
  customer: null,
  sessionId: null,
  agentMessages: [],
  activeAgent: null,
  isProcessing: false,
  error: null,
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>(initialState);

  const setPhase = useCallback((phase: OnboardingPhase) => {
    setState(prev => ({ ...prev, phase }));
  }, []);

  const setContractData = useCallback((contractData: ContractExtraction) => {
    // Also create customer context from contract data
    const customer: CustomerContext = {
      name: contractData.company_name,
      arr: contractData.arr,
      products: contractData.entitlements?.map(e => e.description).slice(0, 5) || [],
      stakeholders: contractData.stakeholders?.map(s => `${s.name} (${s.role})`) || [],
    };

    setState(prev => ({
      ...prev,
      contractData,
      customer,
    }));
  }, []);

  const setSummary = useCallback((summary: string) => {
    setState(prev => ({ ...prev, summary }));
  }, []);

  const setPlan = useCallback((plan: OnboardingPlan) => {
    setState(prev => ({ ...prev, plan }));
  }, []);

  const initiateHandoff = useCallback(() => {
    // Generate session ID and transition to agent execution
    const sessionId = `session_${Date.now()}`;

    // Create initial agent message with context
    const contextMessage: AgentMessage = {
      agent: 'onboarding',
      message: `I've reviewed the contract for ${state.contractData?.company_name || 'the customer'}. Here's what I found:\n\n` +
        `**Company:** ${state.contractData?.company_name}\n` +
        `**ARR:** $${state.contractData?.arr?.toLocaleString()}\n` +
        `**Contract Period:** ${state.contractData?.contract_period}\n` +
        `**Key Stakeholders:** ${state.contractData?.stakeholders?.map(s => s.name).join(', ')}\n\n` +
        `I have a ${state.plan?.timeline_days || 90}-day onboarding plan ready with ${state.plan?.phases?.length || 3} phases.\n\n` +
        `Would you like me to:\n` +
        `1. **Schedule a kickoff meeting** with the stakeholders\n` +
        `2. **Send welcome emails** to introduce ourselves\n` +
        `3. **Begin technical setup** based on their requirements\n\n` +
        `Just tell me what to do first, or I can walk you through the full plan.`,
    };

    setState(prev => ({
      ...prev,
      phase: 'execution',
      sessionId,
      agentMessages: [contextMessage],
      activeAgent: 'onboarding',
    }));
  }, [state.contractData, state.plan]);

  const setSessionId = useCallback((sessionId: string) => {
    setState(prev => ({ ...prev, sessionId }));
  }, []);

  const addAgentMessage = useCallback((message: AgentMessage) => {
    setState(prev => ({
      ...prev,
      agentMessages: [...prev.agentMessages, message],
    }));
  }, []);

  const setActiveAgent = useCallback((activeAgent: AgentId | null) => {
    setState(prev => ({ ...prev, activeAgent }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setPhase,
        setContractData,
        setSummary,
        setPlan,
        initiateHandoff,
        setSessionId,
        addAgentMessage,
        setActiveAgent,
        setProcessing,
        setError,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

// Helper hook for quick access to common values
export const useOnboardingState = () => {
  const { state } = useOnboarding();
  return state;
};

export const useCustomerContext = () => {
  const { state } = useOnboarding();
  return state.customer;
};
