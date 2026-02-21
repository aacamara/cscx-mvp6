/**
 * OnboardingFlow - Multi-step onboarding workflow
 * Embedded in Agent Studio when Onboarding Specialist is selected
 *
 * Steps:
 * 1. google_check - Check/prompt Google connection
 * 2. contract_upload - Reuse ContractUpload component
 * 3. parsing - Loading state, call parseContractFull()
 * 4. review - Show extracted data with edit option
 * 5. workspace_setup - Create Drive + Sheets, show progress
 * 6. complete - Success with links to created resources
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ContractUpload } from '../ContractUpload';
import { useAuth } from '../../context/AuthContext';
import { parseContractFull, createOnboardingWorkspace, OnboardingWorkspaceResult } from '../../services/geminiService';
import { ContractInput, ContractExtraction, OnboardingPlan } from '../../types';
import { AIAnalysisButton } from '../AIAnalysis';

const API_URL = import.meta.env.VITE_API_URL || '';

type FlowStep = 'google_check' | 'contract_upload' | 'parsing' | 'review' | 'workspace_setup' | 'complete' | 'demo_complete';

interface OnboardingFlowProps {
  agentId: string;
  onComplete: (result: OnboardingResult) => void;
  onCancel: () => void;
}

export interface OnboardingResult {
  customerId: string;
  contractId?: string;
  driveRootId: string;
  driveFolders: OnboardingWorkspaceResult['driveFolders'];
  sheetId: string;
  sheetUrl: string;
  contractData: ContractExtraction;
  plan: OnboardingPlan;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
}

interface WorkspaceProgress {
  folders: boolean;
  contract: boolean;
  tracker: boolean;
  data: boolean;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  agentId,
  onComplete,
  onCancel,
}) => {
  const { user, userId, isAuthenticated, hasGoogleAccess, getAuthHeaders } = useAuth();

  // Detect Demo Mode: no authentication or no Google tokens available
  const isDemoMode = !isAuthenticated || !hasGoogleAccess;

  // Flow state - Start directly at contract_upload for demo (bypass Google auth)
  const [currentStep, setCurrentStep] = useState<FlowStep>('contract_upload');
  const [error, setError] = useState<string | null>(null);
  const [demoMode] = useState(false); // Legacy flag for workspace step - kept for compatibility

  // Google connection
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false });
  const [checkingGoogle, setCheckingGoogle] = useState(true);

  // Contract data
  const [contractInput, setContractInput] = useState<ContractInput | null>(null);
  const [contractData, setContractData] = useState<ContractExtraction | null>(null);
  const [onboardingPlan, setOnboardingPlan] = useState<OnboardingPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ContractExtraction | null>(null);

  // Automation states
  const [automationLoading, setAutomationLoading] = useState<string | null>(null);
  const [automationResults, setAutomationResults] = useState<Record<string, { success: boolean; message: string; url?: string }>>({});

  // Workspace creation
  const [workspaceProgress, setWorkspaceProgress] = useState<WorkspaceProgress>({
    folders: false,
    contract: false,
    tracker: false,
    data: false,
  });
  const [workspaceResult, setWorkspaceResult] = useState<OnboardingWorkspaceResult | null>(null);

  // Check Google connection on mount
  useEffect(() => {
    checkGoogleConnection();
  }, []);

  const checkGoogleConnection = async () => {
    setCheckingGoogle(true);
    try {
      const response = await fetch(`${API_URL}/api/google/auth/status`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const status = await response.json();
        setGoogleStatus({
          connected: status.connected,
          email: status.email,
          scopes: status.scopes,
        });

        if (status.connected) {
          setCurrentStep('contract_upload');
        }
      }
    } catch (err) {
      console.error('Error checking Google status:', err);
    } finally {
      setCheckingGoogle(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch(`${API_URL}/api/google/auth/connect?userId=${user?.id}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const { url } = await response.json();
        // Open Google OAuth in new window
        const popup = window.open(url, 'google-auth', 'width=600,height=700');

        // Poll for connection
        const checkInterval = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(checkInterval);
            await checkGoogleConnection();
          }
        }, 1000);
      }
    } catch (err) {
      setError('Failed to initiate Google connection');
    }
  };

  const handleContractUpload = useCallback(async (input: ContractInput) => {
    setContractInput(input);
    setCurrentStep('parsing');
    setError(null);

    // Demo Mode: use simulated analysis results instead of calling the API
    if (isDemoMode) {
      try {
        // Simulate realistic analysis delay (2-3 seconds)
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

        const demoContractData: ContractExtraction = {
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
            { requirement: 'SSO Integration via SAML 2.0', type: 'Integration', priority: 'High', owner: 'Engineering', status: 'Pending', due_date: '2026-01-15' },
            { requirement: 'Data migration from legacy system', type: 'Migration', priority: 'High', owner: 'Operations', status: 'Pending', due_date: '2026-02-01' },
          ],
          contract_tasks: [
            { task: 'Complete SSO Configuration', description: 'Set up SAML 2.0 SSO with customer IdP', assigned_agent: 'Onboarding', priority: 'High', dependencies: 'Technical requirements doc', due_date: '2026-01-15' },
            { task: 'Conduct Kickoff Meeting', description: 'Initial alignment meeting with all stakeholders', assigned_agent: 'Onboarding', priority: 'High', dependencies: 'None', due_date: '2026-01-10' },
          ],
          pricing_terms: [
            { item: 'Enterprise License', description: '150-seat annual license', quantity: '1', unit_price: '$120,000', total: '$120,000', payment_terms: 'Annual prepaid' },
            { item: 'Premium Support', description: '24/7 priority support', quantity: '1', unit_price: '$45,000', total: '$45,000', payment_terms: 'Annual prepaid' },
            { item: 'Training Package', description: '8 onboarding sessions', quantity: '1', unit_price: '$20,000', total: '$20,000', payment_terms: 'Due on signing' },
          ],
          missing_info: ['Preferred SSO identity provider details', 'Data migration timeline from customer'],
          next_steps: 'Schedule kickoff meeting with all stakeholders within 5 business days. Begin SSO technical discovery in parallel.',
        };

        const demoPlan: OnboardingPlan = {
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

        setContractData(demoContractData);
        setEditedData(demoContractData);
        setOnboardingPlan(demoPlan);
        setCurrentStep('review');
      } catch (err) {
        console.error('Demo mode parsing error:', err);
        setError('Demo mode analysis failed unexpectedly');
        setCurrentStep('contract_upload');
      }
      return;
    }

    // Real mode: call the backend API with timeout to prevent infinite spinner
    try {
      const timeoutMs = 60000; // 60-second timeout
      const result = await Promise.race([
        parseContractFull(input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Analysis timed out. Please try again or use a smaller document.')), timeoutMs)
        ),
      ]);
      setContractData(result.contractData);
      setEditedData(result.contractData);
      setOnboardingPlan(result.plan);
      setCurrentStep('review');
    } catch (err) {
      console.error('Contract parsing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse contract');
      setCurrentStep('contract_upload');
    }
  }, [isDemoMode]);

  const handleReviewContinue = async () => {
    const dataToUse = editedData || contractData;
    if (!dataToUse) return;

    setCurrentStep('workspace_setup');
    setError(null);

    try {
      // Simulate progress updates
      setWorkspaceProgress({ folders: false, contract: false, tracker: false, data: false });

      if (isDemoMode) {
        // Demo mode - create mock workspace data with simulated progress
        await new Promise(r => setTimeout(r, 800));
        setWorkspaceProgress(prev => ({ ...prev, folders: true }));

        await new Promise(r => setTimeout(r, 600));
        setWorkspaceProgress(prev => ({ ...prev, contract: true }));

        await new Promise(r => setTimeout(r, 700));
        setWorkspaceProgress(prev => ({ ...prev, tracker: true }));

        await new Promise(r => setTimeout(r, 500));
        setWorkspaceProgress(prev => ({ ...prev, data: true }));

        // Create mock workspace result
        const mockCustomerId = `cust_${dataToUse.company_name.toLowerCase().replace(/\s+/g, '-')}_${Date.now().toString(36)}`;
        const mockResult: OnboardingWorkspaceResult = {
          customerId: mockCustomerId,
          driveRootId: 'demo_folder_' + Date.now(),
          driveFolders: {
            root: 'demo_folder_root',
            onboarding: 'demo_folder_onboarding',
            meetings: 'demo_folder_meetings',
            qbrs: 'demo_folder_qbrs',
            contracts: 'demo_folder_contracts',
            reports: 'demo_folder_reports',
          },
          sheetId: 'demo_sheet_' + Date.now(),
          sheetUrl: '#demo-sheet',
          contractFileId: 'demo_contract_' + Date.now(),
        };

        setWorkspaceResult(mockResult);
        setCurrentStep('demo_complete');
      } else {
        // Real mode - call actual API with timeout
        const result = await Promise.race([
          createOnboardingWorkspace(
            userId, // Uses authenticated user or DEMO_USER_ID
            dataToUse.company_name,
            dataToUse,
            contractInput?.type === 'file' ? {
              fileName: contractInput.fileName || 'Contract.pdf',
              mimeType: contractInput.mimeType || 'application/pdf',
              content: contractInput.content,
            } : undefined
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Workspace creation timed out. Please try again.')), 90000)
          ),
        ]);

        // Update progress as we go
        setWorkspaceProgress(prev => ({ ...prev, folders: true }));
        await new Promise(r => setTimeout(r, 300));
        setWorkspaceProgress(prev => ({ ...prev, contract: true }));
        await new Promise(r => setTimeout(r, 300));
        setWorkspaceProgress(prev => ({ ...prev, tracker: true }));
        await new Promise(r => setTimeout(r, 300));
        setWorkspaceProgress(prev => ({ ...prev, data: true }));

        setWorkspaceResult(result);
        setCurrentStep('complete');
      }

    } catch (err) {
      console.error('Workspace creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
      setCurrentStep('review');
    }
  };

  const handleComplete = () => {
    if (!workspaceResult || !contractData || !onboardingPlan) return;

    onComplete({
      customerId: workspaceResult.customerId,
      driveRootId: workspaceResult.driveRootId,
      driveFolders: workspaceResult.driveFolders,
      sheetId: workspaceResult.sheetId,
      sheetUrl: workspaceResult.sheetUrl,
      contractData,
      plan: onboardingPlan,
    });
  };

  // Automation handlers - call real APIs instead of alerts
  const handleSendWelcomeEmail = async () => {
    if (!workspaceResult || !contractData) return;

    setAutomationLoading('welcome_email');
    try {
      const stakeholders = contractData.stakeholders || [];
      const toEmails = stakeholders
        .filter(s => s.email)
        .map(s => s.email as string);

      if (toEmails.length === 0) {
        setAutomationResults(prev => ({
          ...prev,
          welcome_email: { success: false, message: 'No stakeholder emails found in contract' }
        }));
        return;
      }

      const response = await fetch(`${API_URL}/api/workspace-agent/execute`, {
        method: 'POST',
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'draft_email',
          customerId: workspaceResult.customerId,
          customerName: contractData.company_name,
          params: {
            to: toEmails,
            subject: `Welcome to ${contractData.company_name} - Let's Get Started!`,
            templateType: 'welcome',
            variables: {
              customerName: contractData.company_name,
              csmName: 'Your CSM'
            }
          }
        })
      });

      const result = await response.json();

      if (result.success || result.emailId) {
        setAutomationResults(prev => ({
          ...prev,
          welcome_email: { success: true, message: `Email drafted for ${toEmails.length} stakeholder(s). Check your Gmail drafts.` }
        }));
      } else {
        setAutomationResults(prev => ({
          ...prev,
          welcome_email: { success: false, message: result.error || 'Failed to create email draft' }
        }));
      }
    } catch (err) {
      console.error('Failed to send welcome email:', err);
      setAutomationResults(prev => ({
        ...prev,
        welcome_email: { success: false, message: 'Failed to connect to email service' }
      }));
    } finally {
      setAutomationLoading(null);
    }
  };

  const handleScheduleKickoff = async () => {
    if (!workspaceResult || !contractData) return;

    setAutomationLoading('schedule_kickoff');
    try {
      const stakeholders = contractData.stakeholders || [];
      const attendeeEmails = stakeholders
        .filter(s => s.email)
        .map(s => s.email as string);

      const response = await fetch(`${API_URL}/api/workspace-agent/execute`, {
        method: 'POST',
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'schedule_meeting',
          customerId: workspaceResult.customerId,
          customerName: contractData.company_name,
          params: {
            title: `${contractData.company_name} - Kickoff Meeting`,
            description: `Kickoff meeting to discuss onboarding plan and next steps.\n\nAgenda:\n1. Introductions\n2. Success criteria\n3. 30-60-90 day plan review\n4. Next steps`,
            durationMinutes: 60,
            attendeeEmails,
            preferredTimes: ['morning', 'afternoon']
          }
        })
      });

      const result = await response.json();

      if (result.success || result.eventId || result.meetLink) {
        setAutomationResults(prev => ({
          ...prev,
          schedule_kickoff: {
            success: true,
            message: 'Meeting created! Check your Google Calendar.',
            url: result.meetLink
          }
        }));
      } else {
        setAutomationResults(prev => ({
          ...prev,
          schedule_kickoff: { success: false, message: result.error || 'Failed to schedule meeting' }
        }));
      }
    } catch (err) {
      console.error('Failed to schedule kickoff:', err);
      setAutomationResults(prev => ({
        ...prev,
        schedule_kickoff: { success: false, message: 'Failed to connect to calendar service' }
      }));
    } finally {
      setAutomationLoading(null);
    }
  };

  const handleGenerateQBR = async () => {
    if (!workspaceResult || !contractData) return;

    setAutomationLoading('generate_qbr');
    try {
      const response = await fetch(`${API_URL}/api/workspace-agent/execute`, {
        method: 'POST',
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create_qbr_slides',
          customerId: workspaceResult.customerId,
          customerName: contractData.company_name,
          params: {
            title: `${contractData.company_name} - Q1 Business Review`,
            folderId: workspaceResult.driveFolders?.qbrs,
            includeData: {
              arr: contractData.arr,
              entitlements: contractData.entitlements,
              stakeholders: contractData.stakeholders
            }
          }
        })
      });

      const result = await response.json();

      if (result.success || result.documentId || result.webViewLink) {
        setAutomationResults(prev => ({
          ...prev,
          generate_qbr: {
            success: true,
            message: 'QBR template created in Google Slides!',
            url: result.webViewLink || result.url
          }
        }));
      } else {
        setAutomationResults(prev => ({
          ...prev,
          generate_qbr: { success: false, message: result.error || 'Failed to create QBR template' }
        }));
      }
    } catch (err) {
      console.error('Failed to generate QBR:', err);
      setAutomationResults(prev => ({
        ...prev,
        generate_qbr: { success: false, message: 'Failed to connect to document service' }
      }));
    } finally {
      setAutomationLoading(null);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'google_check', label: 'Google', icon: '🔗' },
      { key: 'contract_upload', label: 'Contract', icon: '📄' },
      { key: 'parsing', label: 'Analysis', icon: '🔍' },
      { key: 'review', label: 'Review', icon: '✓' },
      { key: 'workspace_setup', label: 'Setup', icon: '⚙️' },
      { key: 'complete', label: 'Done', icon: '🎉' },
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${
                    isActive
                      ? 'bg-cscx-accent text-white'
                      : isComplete
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-cscx-gray-800 text-cscx-gray-500'
                  }`}
                >
                  {isComplete ? '✓' : step.icon}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isActive ? 'text-white' : 'text-cscx-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentIndex ? 'bg-green-500/50' : 'bg-cscx-gray-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Step 1: Google Connection Check
  if (currentStep === 'google_check') {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        {renderStepIndicator()}

        <div className="text-center py-8">
          {checkingGoogle ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-cscx-accent border-t-transparent mx-auto mb-4" />
              <p className="text-white">Checking Google connection...</p>
            </>
          ) : googleStatus.connected ? (
            <>
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Google Connected</h3>
              <p className="text-cscx-gray-400 mb-6">
                Connected as {googleStatus.email}
              </p>
              <button
                onClick={() => setCurrentStep('contract_upload')}
                className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Continue to Contract Upload
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-cscx-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔗</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connect Google Workspace</h3>
              <p className="text-cscx-gray-400 mb-6 max-w-md mx-auto">
                Connect your Google account to create Drive folders and Sheets trackers for customer onboarding.
              </p>
              <button
                onClick={handleConnectGoogle}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 mx-auto"
              >
                <span>Connect Google Account</span>
              </button>
            </>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t border-cscx-gray-800 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Contract Upload
  if (currentStep === 'contract_upload') {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        {renderStepIndicator()}

        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-2">Upload Contract</h3>
          <p className="text-cscx-gray-400">
            Upload the customer contract to extract onboarding details automatically.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <ContractUpload onUpload={handleContractUpload} />

        <div className="flex justify-between pt-4 border-t border-cscx-gray-800 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Parsing
  if (currentStep === 'parsing') {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        {renderStepIndicator()}

        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-cscx-accent border-t-transparent mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Contract...</h3>
          <p className="text-cscx-gray-400 max-w-md mx-auto">
            Extracting customer information, stakeholders, entitlements, and creating an onboarding plan.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {['Parsing', 'Extracting', 'Planning'].map((step, i) => (
              <span
                key={step}
                className="px-3 py-1 bg-cscx-gray-800 text-cscx-gray-400 text-sm rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Review
  if (currentStep === 'review') {
    const data = editedData || contractData;

    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        {renderStepIndicator()}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Review Extracted Data</h3>
            <p className="text-cscx-gray-400 text-sm">
              Verify the extracted information before creating the workspace.
            </p>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            {isEditing ? 'Done Editing' : 'Edit'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {/* Company Info */}
          <div className="p-4 bg-cscx-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Company Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-cscx-gray-500">Company Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData?.company_name || ''}
                    onChange={(e) => setEditedData(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                    className="w-full mt-1 px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded text-white"
                  />
                ) : (
                  <p className="text-white font-medium mt-1">{data?.company_name}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-cscx-gray-500">ARR</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={editedData?.arr || 0}
                    onChange={(e) => setEditedData(prev => prev ? { ...prev, arr: parseInt(e.target.value) || 0 } : null)}
                    className="w-full mt-1 px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded text-white"
                  />
                ) : (
                  <p className="text-white font-medium mt-1">${(data?.arr || 0).toLocaleString()}</p>
                )}
              </div>
              {data?.contract_period && (
                <div className="col-span-2">
                  <label className="text-xs text-cscx-gray-500">Contract Period</label>
                  <p className="text-white mt-1">{data.contract_period}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stakeholders */}
          {data?.stakeholders && data.stakeholders.length > 0 && (
            <div className="p-4 bg-cscx-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">
                Stakeholders ({data.stakeholders.length})
              </h4>
              <div className="space-y-2">
                {data.stakeholders.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-cscx-gray-900 rounded">
                    <div>
                      <p className="text-white text-sm">{s.name}</p>
                      <p className="text-xs text-cscx-gray-500">{s.role}</p>
                    </div>
                    {s.email && (
                      <span className="text-xs text-cscx-gray-400">{s.email}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entitlements */}
          {data?.entitlements && data.entitlements.length > 0 && (
            <div className="p-4 bg-cscx-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">
                Entitlements ({data.entitlements.length})
              </h4>
              <div className="space-y-2">
                {data.entitlements.map((e, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-cscx-gray-900 rounded">
                    <span className="text-white text-sm">{e.description}</span>
                    {e.quantity && (
                      <span className="text-xs text-cscx-accent">{e.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Onboarding Plan Summary */}
          {onboardingPlan && (
            <div className="p-4 bg-cscx-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">
                Onboarding Plan ({onboardingPlan.timeline_days} days)
              </h4>
              <div className="space-y-2">
                {onboardingPlan.phases.map((phase, i) => (
                  <div key={i} className="p-2 bg-cscx-gray-900 rounded">
                    <p className="text-white text-sm font-medium">{phase.name}</p>
                    <p className="text-xs text-cscx-gray-500">{phase.tasks.length} tasks</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t border-cscx-gray-800 mt-4">
          <button
            onClick={() => setCurrentStep('contract_upload')}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleReviewContinue}
            className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Create Google Workspace
          </button>
        </div>
      </div>
    );
  }

  // Step 5: Workspace Setup
  if (currentStep === 'workspace_setup') {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        {renderStepIndicator()}

        <div className="text-center py-8">
          <h3 className="text-xl font-bold text-white mb-6">Creating Google Workspace...</h3>

          <div className="max-w-md mx-auto space-y-4">
            <ProgressItem
              label="Creating Drive folder structure"
              done={workspaceProgress.folders}
            />
            <ProgressItem
              label="Uploading contract to Drive"
              done={workspaceProgress.contract}
            />
            <ProgressItem
              label="Creating Onboarding Tracker sheet"
              done={workspaceProgress.tracker}
            />
            <ProgressItem
              label="Populating with extracted data"
              done={workspaceProgress.data}
            />
          </div>
        </div>
      </div>
    );
  }

  // Step 6: Complete (real Google integration)
  if (currentStep === 'complete' && workspaceResult) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        {renderStepIndicator()}

        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎉</span>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">Onboarding Ready!</h3>
          <p className="text-cscx-gray-400 mb-8 max-w-md mx-auto">
            Google Workspace has been created for <strong className="text-white">{contractData?.company_name}</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href={`https://drive.google.com/drive/folders/${workspaceResult.driveRootId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>📁</span> Open Drive Folder
            </a>
            <a
              href={workspaceResult.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>📊</span> Open Onboarding Tracker
            </a>
          </div>

          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <span>💬</span> Start Agent Chat
          </button>
        </div>

        <div className="pt-4 border-t border-cscx-gray-800 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Step 6b: Demo Complete (with full demo UI)
  if (currentStep === 'demo_complete' && workspaceResult && contractData) {
    const data = editedData || contractData;

    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6 max-h-[80vh] overflow-y-auto">
        {renderStepIndicator()}

        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">Onboarding Created!</h3>
          <p className="text-cscx-gray-400">
            <strong className="text-white">{data.company_name}</strong> • ${data.arr?.toLocaleString()} ARR
          </p>
        </div>

        {/* Google Workspace Section (Demo) */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <span>📁</span> Google Workspace Created (Demo)
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-cscx-gray-800 rounded flex items-center gap-2">
              <span>📂</span>
              <div>
                <p className="text-white font-medium">CSCX - {data.company_name}</p>
                <p className="text-xs text-cscx-gray-500">Root folder</p>
              </div>
            </div>
            <div className="p-3 bg-cscx-gray-800 rounded flex items-center gap-2">
              <span>📄</span>
              <div>
                <p className="text-white font-medium">Contract.pdf</p>
                <p className="text-xs text-cscx-gray-500">Uploaded to /Contracts</p>
              </div>
            </div>
            <div className="p-3 bg-cscx-gray-800 rounded flex items-center gap-2">
              <span>📊</span>
              <div>
                <p className="text-white font-medium">Onboarding Tracker</p>
                <p className="text-xs text-cscx-gray-500">Google Sheet</p>
              </div>
            </div>
            <div className="p-3 bg-cscx-gray-800 rounded flex items-center gap-2">
              <span>📋</span>
              <div>
                <p className="text-white font-medium">Kickoff Deck</p>
                <p className="text-xs text-cscx-gray-500">Google Slides</p>
              </div>
            </div>
          </div>
        </div>

        {/* Entitlements Table */}
        {data.entitlements && data.entitlements.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span>📋</span> Contract Entitlements
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cscx-gray-800 text-cscx-gray-400">
                    <th className="px-3 py-2 text-left rounded-tl-lg">Entitlement</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right rounded-tr-lg">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entitlements.map((e, i) => (
                    <tr key={i} className="border-b border-cscx-gray-800">
                      <td className="px-3 py-2 text-white">{e.description}</td>
                      <td className="px-3 py-2 text-cscx-gray-400">{e.type || 'License'}</td>
                      <td className="px-3 py-2 text-right text-cscx-accent font-medium">{e.quantity || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stakeholders */}
        {data.stakeholders && data.stakeholders.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span>👥</span> Key Stakeholders
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.stakeholders.map((s, i) => (
                <div key={i} className="p-3 bg-cscx-gray-800 rounded-lg flex items-center gap-3">
                  <div className="w-10 h-10 bg-cscx-accent/20 rounded-full flex items-center justify-center text-cscx-accent font-bold">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{s.name}</p>
                    <p className="text-xs text-cscx-gray-500">{s.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Automation Section */}
        <div className="mb-6 p-4 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg">
          <h4 className="text-sm font-semibold text-cscx-accent mb-3 flex items-center gap-2">
            <span>⚡</span> Agent Automations
          </h4>
          <p className="text-sm text-cscx-gray-400 mb-4">
            Launch automated workflows with CS agents:
          </p>
          <div className="space-y-2">
            <AutomationButton
              icon="📧"
              label="Send Welcome Email Sequence"
              description="3-email drip campaign to all stakeholders"
              onClick={handleSendWelcomeEmail}
              loading={automationLoading === 'welcome_email'}
              result={automationResults.welcome_email}
            />
            <AutomationButton
              icon="📅"
              label="Schedule Kickoff Meeting"
              description="Find availability and send calendar invite"
              onClick={handleScheduleKickoff}
              loading={automationLoading === 'schedule_kickoff'}
              result={automationResults.schedule_kickoff}
            />
            <AutomationButton
              icon="🤖"
              label="Activate Onboarding Agent"
              description="Start AI-assisted onboarding workflow"
              onClick={handleComplete}
            />
            <AutomationButton
              icon="📊"
              label="Generate QBR Template"
              description="Create first QBR document from contract data"
              onClick={handleGenerateQBR}
              loading={automationLoading === 'generate_qbr'}
              result={automationResults.generate_qbr}
            />
          </div>
        </div>

        {/* AI Analysis Section - Alternative to AppScript */}
        {workspaceResult?.spreadsheetId && (
          <div className="mb-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
            <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
              <span>🤖</span> AI-Powered Analysis
            </h4>
            <p className="text-sm text-cscx-gray-400 mb-4">
              Analyze your customer data with Claude AI - no AppScript needed:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <AIAnalysisButton
                spreadsheetId={workspaceResult.spreadsheetId}
                analysisType="health_score"
                label="Health Score Analysis"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors justify-center"
              />
              <AIAnalysisButton
                spreadsheetId={workspaceResult.spreadsheetId}
                analysisType="renewal_risk"
                label="Renewal Risk Analysis"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors justify-center"
              />
              <AIAnalysisButton
                spreadsheetId={workspaceResult.spreadsheetId}
                analysisType="adoption_metrics"
                label="Adoption Metrics"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors justify-center"
              />
              <AIAnalysisButton
                spreadsheetId={workspaceResult.spreadsheetId}
                analysisType="custom"
                label="Custom Analysis"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors justify-center"
              />
            </div>
            <p className="text-xs text-cscx-gray-500 mt-3 text-center">
              Claude reads your Google Sheet directly and provides actionable insights
            </p>
          </div>
        )}

        {/* Onboarding Plan Preview */}
        {onboardingPlan && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span>📋</span> {onboardingPlan.timeline_days}-Day Onboarding Plan
            </h4>
            <div className="space-y-2">
              {onboardingPlan.phases.map((phase, i) => (
                <div key={i} className="p-3 bg-cscx-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{phase.name}</span>
                    <span className="text-xs text-cscx-gray-500">{phase.days || `Phase ${i + 1}`}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {phase.tasks.slice(0, 3).map((task, j) => (
                      <span key={j} className="px-2 py-1 bg-cscx-gray-900 text-xs text-cscx-gray-400 rounded">
                        {task.title || task.task}
                      </span>
                    ))}
                    {phase.tasks.length > 3 && (
                      <span className="px-2 py-1 bg-cscx-gray-900 text-xs text-cscx-accent rounded">
                        +{phase.tasks.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-cscx-gray-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleComplete}
            className="px-6 py-3 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>💬</span> Start Agent Collaboration
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// Helper component for progress items
const ProgressItem: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <div className="flex items-center gap-3 p-3 bg-cscx-gray-800 rounded-lg">
    {done ? (
      <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
        <span className="text-green-400 text-sm">✓</span>
      </div>
    ) : (
      <div className="w-6 h-6 border-2 border-cscx-gray-600 border-t-cscx-accent rounded-full animate-spin" />
    )}
    <span className={done ? 'text-green-400' : 'text-cscx-gray-400'}>{label}</span>
  </div>
);

// Helper component for automation buttons
const AutomationButton: React.FC<{
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
  result?: { success: boolean; message: string; url?: string };
}> = ({ icon, label, description, onClick, loading, result }) => (
  <div className="space-y-1">
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full p-3 rounded-lg text-left transition-colors flex items-center gap-3 group ${
        result?.success
          ? 'bg-green-500/10 border border-green-500/30'
          : loading
            ? 'bg-cscx-gray-800 opacity-70 cursor-wait'
            : 'bg-cscx-gray-800 hover:bg-cscx-gray-700'
      }`}
    >
      {loading ? (
        <div className="w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full animate-spin" />
      ) : result?.success ? (
        <span className="text-xl text-green-400">✓</span>
      ) : (
        <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      )}
      <div className="flex-1">
        <p className={`font-medium text-sm ${result?.success ? 'text-green-400' : 'text-white'}`}>{label}</p>
        <p className="text-xs text-cscx-gray-500">{description}</p>
      </div>
      {!loading && !result && (
        <span className="text-cscx-gray-500 group-hover:text-cscx-accent transition-colors">→</span>
      )}
    </button>
    {result && (
      <div className={`px-3 py-2 rounded text-xs ${result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
        {result.message}
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline hover:no-underline"
          >
            Open →
          </a>
        )}
      </div>
    )}
  </div>
);

export default OnboardingFlow;
