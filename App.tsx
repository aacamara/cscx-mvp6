/**
 * CSCX.AI - Customer Success Platform
 * 10X Refactor: Unified Navigation + Embedded AI
 *
 * Changes from MVP:
 * - Removed standalone AI Assistant view (merged into onboarding)
 * - Removed standalone Integrations view (merged into CustomerDetail)
 * - Simplified AppView type
 * - Unified onboarding flow with persistent AI panel
 */

import React, { useState, useEffect } from 'react';
import { CustomerDetail } from './components/CustomerDetail';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { AuthCallback } from './components/AuthCallback';
import { UserProfile } from './components/UserProfile';
import { UnifiedOnboarding } from './components/UnifiedOnboarding';
import { AgentCenterView } from './components/AgentCenterView';
import { KnowledgeBase } from './components/KnowledgeBase';
import { Observability } from './components/Observability';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { AgenticModeProvider } from './context/AgenticModeContext';
import { ThemeProvider } from './context/ThemeContext';
import { isSupabaseConfigured } from './lib/supabase';
import { AgenticModeToggle } from './components/AgenticModeToggle';
import { AgentNotifications } from './components/AgentNotifications';
import { GoogleConnect } from './components/GoogleConnect';
import { AccessibilitySettings } from './components/Settings/AccessibilitySettings';
import { HighContrastToggle } from './components/HighContrastToggle';
import { AdminDashboard } from './components/AdminDashboard';
import { SupportTickets } from './components/SupportTickets';
import { AgentActionsView } from './components/AgentActionsView';
import { DesignPartnerWelcome } from './components/DesignPartnerWelcome';

// ============================================
// CSCX.AI 10X - Simplified View Model
// ============================================

// Simplified view type - Observability is now the primary view (includes customers)
type AppView = 'observability' | 'customer-detail' | 'onboarding' | 'agent-center' | 'knowledge-base' | 'admin' | 'support' | 'agent-actions' | 'login' | 'auth-callback';

// Settings modal tabs
type SettingsTab = 'integrations' | 'accessibility';

// ============================================
// Settings Modal Component
// ============================================

const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('integrations');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-lg mx-4 bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 shadow-xl hc-bg hc-border">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-cscx-gray-800 hc-border">
          <h2 className="text-lg font-semibold hc-text">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors hc-text"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cscx-gray-800 hc-border">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'integrations'
                ? 'text-cscx-accent border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white hc-text'
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab('accessibility')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'accessibility'
                ? 'text-cscx-accent border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white hc-text'
            }`}
          >
            Accessibility
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'integrations' && (
            <GoogleConnect onClose={onClose} />
          )}
          {activeTab === 'accessibility' && (
            <AccessibilitySettings />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main App Content
// ============================================

const AppContent: React.FC = () => {
  const { isAuthenticated, isAdmin, isDesignPartner, loading: authLoading, getAuthHeaders } = useAuth();
  const [demoMode, setDemoMode] = useState(false);

  // View management - Observability is the default/home view
  const [view, setView] = useState<AppView>('observability');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [observabilityTab, setObservabilityTab] = useState<'overview' | 'customers' | 'health-portfolio'>('overview');
  const [agentCenterOnboardingMode, setAgentCenterOnboardingMode] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check for auth callback route
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/auth/callback') {
      setView('auth-callback');
    } else if (path === '/login') {
      setView('login');
    }
  }, []);

  // Navigation handlers
  const handleNewOnboarding = () => {
    // Navigate to Agent Center with onboarding mode enabled
    setAgentCenterOnboardingMode(true);
    setView('agent-center');
  };

  const handleOpenAgentCenter = () => {
    setAgentCenterOnboardingMode(false); // Reset onboarding mode when navigating directly
    setView('agent-center');
  };

  const handleSelectCustomer = (customer: { id: string; name: string }) => {
    setSelectedCustomerId(customer.id);
    setView('customer-detail');
  };

  const handleBackFromDetail = () => {
    setView('observability');
    setObservabilityTab('customers');
    setSelectedCustomerId(null);
  };

  const handleBackToCustomers = () => {
    setView('observability');
    setObservabilityTab('overview');
  };

  // Get current view title
  const getViewTitle = (): string => {
    switch (view) {
      case 'observability':
        return 'Customer Success Platform';
      case 'customer-detail':
        return 'Customer 360° View';
      case 'onboarding':
        return 'New Customer Onboarding';
      case 'agent-center':
        return 'Agent Center';
      case 'knowledge-base':
        return 'Knowledge Base';
      default:
        return 'Customer Success Platform';
    }
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cscx-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  // Auth callback route
  if (view === 'auth-callback') {
    return <AuthCallback />;
  }

  // Show login page with invite code if not authenticated
  if (!isAuthenticated && !demoMode && isSupabaseConfigured()) {
    return <Login onDemoMode={() => setDemoMode(true)} />;
  }

  return (
    <div className="min-h-screen bg-cscx-black text-white p-4 sm:p-8 font-sans">
      {/* Design Partner Welcome Modal */}
      <DesignPartnerWelcome isDesignPartner={isDesignPartner} />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg animate-fade-in ${
            toast.type === 'success'
              ? 'bg-green-600/90 border border-green-500'
              : 'bg-red-600/90 border border-red-500'
          }`}
        >
          <p className="text-white text-sm">{toast.message}</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                CSCX<span className="text-cscx-accent">.</span>AI
              </h1>
              <p className="text-cscx-gray-300 mt-1">{getViewTitle()}</p>
            </div>

            <div className="flex items-center gap-3 mt-4 sm:mt-0">
              {/* Back button for secondary views */}
              {(view === 'onboarding' || view === 'agent-center' || view === 'knowledge-base' || view === 'customer-detail') && (
                <button
                  onClick={handleBackToCustomers}
                  className="px-4 py-2 text-sm border border-cscx-gray-700 rounded-lg hover:bg-cscx-gray-800 hover:text-cscx-accent transition-colors"
                >
                  ← Back to Dashboard
                </button>
              )}

              {/* Agent Notifications - show when authenticated, in demo mode, or when Supabase not configured */}
              {(isAuthenticated || demoMode || !isSupabaseConfigured()) && <AgentNotifications />}

              {/* Agentic Mode Toggle - show when authenticated, in demo mode, or when Supabase not configured */}
              {(isAuthenticated || demoMode || !isSupabaseConfigured()) && <AgenticModeToggle />}

              {/* High Contrast Toggle - PRD-273 */}
              {(isAuthenticated || demoMode || !isSupabaseConfigured()) && <HighContrastToggle compact />}

              {/* Settings Button */}
              {(isAuthenticated || demoMode || !isSupabaseConfigured()) && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
                  title="Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              {/* User Profile */}
              {isAuthenticated && <UserProfile />}

              {/* Demo mode indicator */}
              {demoMode && !isAuthenticated && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                  <span className="text-xs text-yellow-500">Demo Mode</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation - Observability (with Customers) is primary */}
          <nav className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
            <button
              onClick={() => { setView('observability'); setObservabilityTab('overview'); setSelectedCustomerId(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                view === 'observability'
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
              }`}
            >
              <span>📊</span> Dashboard
            </button>

            <button
              onClick={handleOpenAgentCenter}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                view === 'agent-center'
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
              }`}
            >
              <span>🤖</span> Agent Center
            </button>

            <button
              onClick={() => setView('knowledge-base')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                view === 'knowledge-base'
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
              }`}
            >
              <span>📚</span> Knowledge Base
            </button>

            {/* Admin-only navigation items */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setView('agent-actions')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    view === 'agent-actions'
                      ? 'bg-cscx-accent text-white'
                      : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
                  }`}
                >
                  <span>📥</span> Actions
                </button>

                {/* ARCHIVED: Support and Admin tabs
                <button
                  onClick={() => setView('support')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    view === 'support'
                      ? 'bg-cscx-accent text-white'
                      : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
                  }`}
                >
                  <span>🎫</span> Support
                </button>

                <button
                  onClick={() => setView('admin')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    view === 'admin'
                      ? 'bg-cscx-accent text-white'
                      : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
                  }`}
                >
                  <span>⚙️</span> Admin
                </button>
                */}
              </>
            )}
          </nav>
        </header>

        {/* Main Content */}
        <main>
          {/* VIEW: OBSERVABILITY - Primary Dashboard with Customers, Overview, Metrics */}
          {view === 'observability' && (
            <Observability
              onSelectCustomer={handleSelectCustomer}
              onNewOnboarding={handleNewOnboarding}
              initialSelectedCustomerId={selectedCustomerId}
              initialTab={observabilityTab}
            />
          )}

          {/* VIEW: CUSTOMER DETAIL - 360° View with Workspace Integration */}
          {view === 'customer-detail' && selectedCustomerId && (
            <CustomerDetail
              customerId={selectedCustomerId}
              onBack={handleBackFromDetail}
            />
          )}

          {/* VIEW: ONBOARDING - Unified Flow with AI Panel */}
          {view === 'onboarding' && (
            <UnifiedOnboarding
              onBack={handleBackToCustomers}
              onComplete={async (data) => {
                console.log('Onboarding complete:', data);

                // Save customer to database
                const API_URL = import.meta.env.VITE_API_URL || '';
                try {
                  const response = await fetch(`${API_URL}/api/customers`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                      name: data.contract.company_name,
                      arr: data.contract.arr || 0,
                      status: 'onboarding'
                    })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to create customer');
                  }

                  const newCustomer = await response.json();

                  // US-002: Save contract linked to customer
                  try {
                    const contractResponse = await fetch(`${API_URL}/api/contracts`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                      },
                      body: JSON.stringify({
                        customer_id: newCustomer.id,
                        file_name: data.fileMetadata?.fileName || 'Unknown',
                        file_type: data.fileMetadata?.fileType || 'unknown',
                        file_size: data.fileMetadata?.fileSize || 0,
                        parsed_data: data.contract,
                        status: 'parsed'
                      })
                    });

                    if (!contractResponse.ok) {
                      console.error('Failed to save contract, but customer was created');
                    }
                  } catch (contractError) {
                    console.error('Error saving contract:', contractError);
                    // Don't fail the whole operation if contract save fails
                  }

                  showToast('Customer created successfully', 'success');

                  // Navigate to the new customer's detail view
                  setSelectedCustomerId(newCustomer.id);
                  setView('customer-detail');
                } catch (error) {
                  console.error('Error saving customer:', error);
                  showToast(
                    error instanceof Error ? error.message : 'Failed to create customer',
                    'error'
                  );
                  // Still navigate to customers list on error
                  setView('observability');
                  setObservabilityTab('customers');
                }
              }}
            />
          )}

          {/* VIEW: AGENT CENTER - Standalone Agent Access */}
          {view === 'agent-center' && (
            <AgentCenterView
              startOnboarding={agentCenterOnboardingMode}
              onOnboardingStarted={() => setAgentCenterOnboardingMode(false)}
            />
          )}

          {/* VIEW: KNOWLEDGE BASE - Unified Knowledge Management */}
          {view === 'knowledge-base' && (
            <KnowledgeBase />
          )}

          {/* ARCHIVED: Admin and Support views
          {view === 'admin' && (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <AdminDashboard onClose={() => setView('observability')} />
            </div>
          )}

          {view === 'support' && (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <SupportTickets onClose={() => setView('observability')} />
            </div>
          )}
          */}

          {/* VIEW: AGENT ACTIONS - Agent Inbox for HITL Approval (PRD-3) */}
          {view === 'agent-actions' && (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <AgentActionsView onClose={() => setView('observability')} />
            </div>
          )}

        </main>

        {/* Settings Modal */}
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </div>
    </div>
  );
};

// ============================================
// App Wrapper with Auth Provider
// ============================================

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <WebSocketProvider>
          <AgenticModeProvider>
            <AppContent />
          </AgenticModeProvider>
        </WebSocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
