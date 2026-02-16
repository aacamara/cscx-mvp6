/**
 * UnifiedOnboarding - Two-Column Layout with AI Panel
 * Replaces separate onboarding/handoff/execution views
 */

import React, { useState, useReducer, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
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
  // Detect Demo Mode: no authentication or no Google tokens available
  const { isAuthenticated, hasGoogleAccess } = useAuth();
  const isDemoMode = !isAuthenticated || !hasGoogleAccess;

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

      // Demo Mode: use simulated analysis results instead of calling the API
      if (isDemoMode) {
        // Simulate realistic analysis delay (2-3 seconds)
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

        const demoContractData = {
          company_name: input.fileName?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Acme Corporation',
          arr: 185000,
          contract_period: 'January 1, 2026 - December 31, 2026',
          entitlements: [
            { type: 'Platform License', description: 'Enterprise Platform Access', quantity: '150 seats', start_date: '2026-01-01', end_date: '2026-12-31', dependencies: 'SSO Configuration' },
            { type: 'API Access', description: 'REST API with 10,000 req/day', quantity: '10,000 requests/day', start_date: '2026-01-01', end_date: '2026-12-31', dependencies: 'API Key Setup' },
            { type: 'Premium Support', description: '24/7 Priority Support with 1-hour SLA', quantity: 'Unlimited', start_date: '2026-01-01', end_date: '2026-12-31', dependencies: 'None' },
            { type: 'Data Storage', description: 'Cloud Storage Allocation', quantity: '500 GB', start_date: '2026-01-01', end_date: '2026-12-31', dependencies: 'Data Migration' },
            { type: 'Training', description: 'Onboarding Training Sessions', quantity: '8 sessions', start_date: '2026-01-01', end_date: '2026-03-31', dependencies: 'Kickoff Meeting' },
          ],
          stakeholders: [
            { name: 'Sarah Chen', role: 'VP of Customer Success', department: 'Customer Success', contact: 'sarah.chen@acme.com', responsibilities: 'Executive sponsor, final approval authority', approval_required: true },
            { name: 'Marcus Johnson', role: 'Director of Operations', department: 'Operations', contact: 'marcus.j@acme.com', responsibilities: 'Day-to-day implementation lead', approval_required: false },
            { name: 'Priya Patel', role: 'Technical Lead', department: 'Engineering', contact: 'priya.p@acme.com', responsibilities: 'API integration and SSO setup', approval_required: false },
            { name: 'David Kim', role: 'Head of Product', department: 'Product', contact: 'david.kim@acme.com', responsibilities: 'Feature requirements and roadmap alignment', approval_required: true },
          ],
          technical_requirements: [
            { requirement: 'SSO Integration via SAML 2.0', type: 'Integration', priority: 'High' as const, owner: 'Engineering', status: 'Pending', due_date: '2026-01-15' },
            { requirement: 'Data migration from legacy system', type: 'Migration', priority: 'High' as const, owner: 'Operations', status: 'Pending', due_date: '2026-02-01' },
          ],
          contract_tasks: [
            { task: 'Complete SSO Configuration', description: 'Set up SAML 2.0 SSO with customer IdP', assigned_agent: 'Onboarding', priority: 'High' as const, dependencies: 'Technical requirements doc', due_date: '2026-01-15' },
            { task: 'Conduct Kickoff Meeting', description: 'Initial alignment meeting with all stakeholders', assigned_agent: 'Onboarding', priority: 'High' as const, dependencies: 'None', due_date: '2026-01-10' },
          ],
          pricing_terms: [
            { item: 'Enterprise License', description: '150-seat annual license', quantity: '1', unit_price: '$120,000', total: '$120,000', payment_terms: 'Annual prepaid' },
            { item: 'Premium Support', description: '24/7 priority support', quantity: '1', unit_price: '$45,000', total: '$45,000', payment_terms: 'Annual prepaid' },
            { item: 'Training Package', description: '8 onboarding sessions', quantity: '1', unit_price: '$20,000', total: '$20,000', payment_terms: 'Due on signing' },
          ],
          missing_info: ['Preferred SSO identity provider details', 'Data migration timeline from customer'],
          next_steps: 'Schedule kickoff meeting with all stakeholders within 5 business days. Begin SSO technical discovery in parallel.',
          confidence_scores: { company_name: 0.95, arr: 0.92, stakeholders: 0.88, entitlements: 0.90 },
        };

        const demoSummary = `## Key Details\n- **Company:** ${demoContractData.company_name}\n- **ARR:** $${demoContractData.arr.toLocaleString()}\n- **Contract Period:** ${demoContractData.contract_period}\n\n## Entitlements\n${demoContractData.entitlements.map(e => `- ${e.type}: ${e.quantity}`).join('\n')}\n\n## Key Stakeholders\n${demoContractData.stakeholders.map(s => `- ${s.name} (${s.role})`).join('\n')}\n\n## Next Steps\n${demoContractData.next_steps}`;

        const demoResearch = {
          company_name: demoContractData.company_name,
          domain: `${demoContractData.company_name.toLowerCase().replace(/\s+/g, '')}.com`,
          industry: 'Technology / SaaS',
          employee_count: 500,
          tech_stack: ['AWS', 'React', 'Node.js', 'PostgreSQL'],
          recent_news: ['Series B funding raised', 'Expanded into EMEA market'],
          key_initiatives: ['Digital transformation', 'Customer experience overhaul'],
          competitors: ['Competitor A', 'Competitor B'],
          overview: `${demoContractData.company_name} is a growing SaaS company focused on innovation and customer success.`,
        };

        const demoPlan = {
          timeline_days: 90,
          phases: [
            {
              name: 'Foundation (Days 1-30)',
              days: '1-30',
              description: 'Establish relationship and complete initial setup',
              tasks: [
                { task: 'Kickoff Meeting', title: 'Kickoff Meeting', owner: 'CSM', due_days: 5, success_criteria: 'All stakeholders aligned on goals' },
                { task: 'SSO Configuration', title: 'SSO Configuration', owner: 'SA', due_days: 14, success_criteria: 'SSO working for all users' },
                { task: 'Initial Training', title: 'Initial Training', owner: 'CSM', due_days: 21, success_criteria: '80% of users can log in and navigate' },
              ],
              success_metrics: ['First login within 7 days', 'SSO configured', 'Training sessions scheduled'],
            },
            {
              name: 'Adoption (Days 31-60)',
              days: '31-60',
              description: 'Drive usage and value realization',
              tasks: [
                { task: 'Value Check-in', title: 'Value Check-in', owner: 'CSM', due_days: 45, success_criteria: 'Customer confirms progress on goals' },
                { task: 'Advanced Training', title: 'Advanced Training', owner: 'CSM', due_days: 50, success_criteria: 'Power users identified and enabled' },
              ],
              success_metrics: ['50% DAU achieved', 'First success metric hit'],
            },
            {
              name: 'Optimization (Days 61-90)',
              days: '61-90',
              description: 'Expand usage and prepare for first QBR',
              tasks: [
                { task: 'QBR Preparation', title: 'QBR Preparation', owner: 'CSM', due_days: 80, success_criteria: 'ROI metrics documented' },
                { task: 'Expansion Discussion', title: 'Expansion Discussion', owner: 'AE', due_days: 85, success_criteria: 'Expansion pipeline identified' },
              ],
              success_metrics: ['CSAT > 8', 'Expansion opportunities identified'],
            },
          ],
          risk_factors: ['Stakeholder availability for meetings', 'SSO integration complexity', 'Data migration timeline'],
          opportunities: ['Cross-sell API analytics add-on', 'Expand seat count to 250', 'Case study potential'],
          recommended_touchpoints: ['Day 1: Welcome email', 'Day 5: Kickoff meeting', 'Day 14: Technical check-in', 'Day 30: First month review', 'Day 60: Mid-quarter check-in', 'Day 90: QBR'],
        };

        setContractData(demoContractData as unknown as ContractData);
        setSummary(demoSummary);
        setResearchData(demoResearch as unknown as CompanyResearch);
        setPlan(demoPlan as unknown as OnboardingPlan);

        dispatch({ type: 'PARSING_COMPLETE', payload: { data: demoContractData as unknown as ContractData } });
        setLegacyState(LegacyWorkflowState.Ready);
        return;
      }

      // Real mode: call the backend API
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
  }, [isDemoMode]);

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
