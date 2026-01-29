/**
 * UnifiedOnboarding - Two-Column Layout with AI Panel
 * Replaces separate onboarding/handoff/execution views
 */

import React, { useState, useReducer, useCallback } from 'react';
import { ContractUpload } from './ContractUpload';
import { OnboardingStep } from './OnboardingStep';
import { EntitlementsTable } from './EntitlementsTable';
import { StakeholdersList } from './StakeholdersList';
import { TechnicalRequirementsTable } from './TechnicalRequirementsTable';
import { ContractTasksTable } from './ContractTasksTable';
import { PricingTable } from './PricingTable';
import { AnalysisSummary } from './AnalysisSummary';
import { ExecutiveSummary } from './ExecutiveSummary';
import { CompanyResearchView } from './CompanyResearch';
import { IntelligenceSources } from './IntelligenceSources';
import { OnboardingPlanView } from './OnboardingPlanView';
import { AgentControlCenter } from './AgentControlCenter';
import { AIPanel } from './AIPanel';
import {
  OnboardingPhase,
  WorkflowState,
  WorkflowAction,
  workflowReducer,
  initialWorkflowState,
  phaseMetadata,
  ContractData,
  CompanyResearch,
  OnboardingPlan,
  CustomerContext
} from '../types/workflow';
import { parseContractFull } from '../services/geminiService';
import { ContractInput, WorkflowState as LegacyWorkflowState } from '../types';

// ============================================
// File metadata for contract persistence
// ============================================

interface FileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
}

// ============================================
// Props
// ============================================

interface UnifiedOnboardingProps {
  onComplete?: (data: { contract: ContractData; plan: OnboardingPlan; fileMetadata?: FileMetadata }) => void;
  onBack?: () => void;
}

// ============================================
// Component
// ============================================

export const UnifiedOnboarding: React.FC<UnifiedOnboardingProps> = ({
  onComplete,
  onBack
}) => {
  // Workflow state (new reducer-based)
  const [workflow, dispatch] = useReducer(workflowReducer, initialWorkflowState);

  // Legacy workflow state for compatibility with existing components
  const [legacyState, setLegacyState] = useState<LegacyWorkflowState>(LegacyWorkflowState.Idle);

  // Data states
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [researchData, setResearchData] = useState<CompanyResearch | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);

  // UI states
  const [activeTab, setActiveTab] = useState('entitlements');
  const [aiPanelMinimized, setAIPanelMinimized] = useState(false);

  // Derived customer context for AI panel
  const customerContext: CustomerContext = contractData ? {
    name: contractData.company_name,
    arr: contractData.arr,
    products: contractData.entitlements?.map(e => e.description).slice(0, 5) || [],
    stakeholders: contractData.stakeholders?.map(s => `${s.name} (${s.role})`) || [],
    contractPeriod: contractData.contract_period,
    technicalRequirements: contractData.technical_requirements?.map(r => r.requirement) || [],
    tasks: contractData.contract_tasks || [],
    missingInfo: contractData.missing_info || [],
  } : {
    name: 'New Customer',
    arr: 0,
    products: [],
    stakeholders: []
  };

  // Tabs for contract review
  const tabs = [
    { id: 'entitlements', label: 'Entitlements' },
    { id: 'stakeholders', label: 'Stakeholders' },
    { id: 'technical', label: 'Tech Specs' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'pricing', label: 'Pricing' },
  ];

  // Handle contract upload and parsing
  const handleUpload = useCallback(async (input: ContractInput) => {
    try {
      dispatch({ type: 'START_PARSING', payload: { contract: input as unknown as File } });
      setLegacyState(LegacyWorkflowState.Parsing);
      setError(null);

      // Capture file metadata for later persistence
      // Estimate file size from base64 content length (base64 is ~33% larger than original)
      const estimatedSize = input.type === 'file' && input.content
        ? Math.round(input.content.length * 0.75)
        : input.content?.length || 0;

      setFileMetadata({
        fileName: input.fileName || 'Unknown',
        fileType: input.mimeType || (input.type === 'text' ? 'text/plain' : 'application/octet-stream'),
        fileSize: estimatedSize
      });

      // Parse contract
      const result = await parseContractFull(input);

      // Update states
      setContractData(result.contractData as unknown as ContractData);
      setSummary(result.summary);
      setResearchData(result.research as unknown as CompanyResearch);
      setPlan(result.plan as unknown as OnboardingPlan);

      dispatch({ type: 'PARSING_COMPLETE', payload: { data: result.contractData as unknown as ContractData } });
      setLegacyState(LegacyWorkflowState.Ready);

    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : 'An unknown error occurred';
      dispatch({ type: 'PARSING_ERROR', payload: { error: errorMsg } });
      setError(errorMsg);
      setLegacyState(LegacyWorkflowState.Error);
    }
  }, []);

  // Handle deploy agents
  const handleDeployAgents = useCallback(() => {
    dispatch({ type: 'APPROVE_PLAN' });

    // Call onComplete with contract data, plan, and file metadata
    if (onComplete && contractData && plan) {
      onComplete({
        contract: contractData,
        plan,
        fileMetadata: fileMetadata || undefined
      });
    }
  }, [onComplete, contractData, plan, fileMetadata]);

  // Get phase progress
  const getPhaseProgress = (): { current: number; total: number } => {
    const phases: OnboardingPhase[] = ['upload', 'parsing', 'review', 'planning', 'plan_review', 'executing'];
    const currentIndex = phases.indexOf(workflow.phase);
    return {
      current: Math.max(0, currentIndex),
      total: phases.length - 1
    };
  };

  const progress = getPhaseProgress();
  const currentPhaseMeta = phaseMetadata[workflow.phase];

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[600px]">
      {/* Main Content (70%) */}
      <div className="flex-1 overflow-y-auto pr-4">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{currentPhaseMeta.icon}</span>
              <span className="text-white font-medium">{currentPhaseMeta.title}</span>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1 text-sm text-cscx-gray-400 hover:text-white transition-colors"
              >
                ← Back to Customers
              </button>
            )}
          </div>
          <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cscx-accent transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-cscx-gray-400 mt-1">{currentPhaseMeta.description}</p>
        </div>

        {/* Phase: Upload */}
        {workflow.phase === 'upload' && (
          <ContractUpload onUpload={handleUpload} />
        )}

        {/* Phase: Parsing */}
        {workflow.phase === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-cscx-accent border-t-transparent mb-4" />
            <p className="text-white font-medium">Analyzing contract...</p>
            <p className="text-sm text-cscx-gray-400 mt-1">This usually takes 10-30 seconds</p>
          </div>
        )}

        {/* Phase: Review */}
        {(workflow.phase === 'review' || legacyState >= LegacyWorkflowState.Parsing) && contractData && (
          <div className="space-y-6">
            <OnboardingStep title="Contract Parsing & Analysis" state={legacyState} successState={LegacyWorkflowState.Generating}>
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-cscx-gray-800 pb-2">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-cscx-accent text-white'
                          : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[200px]">
                  {activeTab === 'entitlements' && <EntitlementsTable entitlements={contractData.entitlements} />}
                  {activeTab === 'stakeholders' && <StakeholdersList stakeholders={contractData.stakeholders} />}
                  {activeTab === 'technical' && <TechnicalRequirementsTable requirements={contractData.technical_requirements} />}
                  {activeTab === 'tasks' && <ContractTasksTable tasks={contractData.contract_tasks} />}
                  {activeTab === 'pricing' && <PricingTable pricing={contractData.pricing_terms} />}
                </div>

                <AnalysisSummary missingInfo={contractData.missing_info} nextSteps={contractData.next_steps} />
              </div>
            </OnboardingStep>

            {/* Intelligence Section */}
            <OnboardingStep title="Intelligence Generation" state={legacyState} successState={LegacyWorkflowState.Ready}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {summary && <ExecutiveSummary summary={summary} />}
                {researchData && <CompanyResearchView research={researchData} />}
              </div>
              <IntelligenceSources />
            </OnboardingStep>

            {/* Plan Section */}
            <OnboardingStep title="30-60-90 Day Onboarding Plan" state={legacyState} successState={LegacyWorkflowState.Ready}>
              {plan && <OnboardingPlanView plan={plan} />}
            </OnboardingStep>

            {/* Deploy Button */}
            {legacyState === LegacyWorkflowState.Ready && contractData && plan && (
              <div className="p-6 bg-gradient-to-r from-cscx-gray-900 to-cscx-gray-800 border border-cscx-accent/30 rounded-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      Contract Analysis Complete
                    </h3>
                    <p className="text-cscx-gray-300 mt-1">
                      Ready to deploy AI agents for {contractData.company_name}
                    </p>
                  </div>
                  <button
                    onClick={handleDeployAgents}
                    className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>🚀</span>
                    Deploy Agents
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phase: Executing */}
        {workflow.phase === 'executing' && customerContext && contractData && plan && (
          <AgentControlCenter
            customer={customerContext}
            contractData={contractData}
            plan={plan}
            embedded
            initialMessage={
              `I've analyzed the contract for ${contractData.company_name}. ` +
              `They have a $${contractData.arr?.toLocaleString()} ARR deal with ${contractData.entitlements?.length || 0} entitlements. ` +
              `I've prepared a ${plan.timeline_days || 90}-day onboarding plan. ` +
              `What would you like me to do first?`
            }
          />
        )}

        {/* Error State */}
        {error && (
          <div className="bg-cscx-error/10 border border-cscx-error text-cscx-error p-4 rounded-lg mt-6">
            <h3 className="font-bold">Error</h3>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => {
                dispatch({ type: 'RESET' });
                setLegacyState(LegacyWorkflowState.Idle);
                setError(null);
              }}
              className="mt-3 px-4 py-2 bg-cscx-error/20 hover:bg-cscx-error/30 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* AI Panel (30%) */}
      <div className="w-80 flex-shrink-0">
        <AIPanel
          context={{
            phase: workflow.phase,
            customerName: contractData?.company_name,
            arr: contractData?.arr,
            contractData,
            plan,
            workflowState: workflow
          }}
          embedded
          minimized={aiPanelMinimized}
          onToggleMinimize={() => setAIPanelMinimized(!aiPanelMinimized)}
        />
      </div>
    </div>
  );
};

export default UnifiedOnboarding;
