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
import { AuthCallback } from './components/AuthCallback';
import { UserProfile } from './components/UserProfile';
import { UnifiedOnboarding } from './components/UnifiedOnboarding';
import { AgentCenterView } from './components/AgentCenterView';
import { AgentObservability } from './components/AgentObservability';
import { KnowledgeBase } from './components/KnowledgeBase';
import { AgentStudio } from './components/AgentStudio';
import { Observability } from './components/Observability';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { AgenticModeProvider } from './context/AgenticModeContext';
import { isSupabaseConfigured } from './lib/supabase';
import { AgenticModeToggle } from './components/AgenticModeToggle';
import { AgentNotifications } from './components/AgentNotifications';

// ============================================
// CSCX.AI 10X - Simplified View Model
// ============================================

// Simplified view type - Observability is now the primary view (includes customers)
type AppView = 'observability' | 'customer-detail' | 'onboarding' | 'agent-center' | 'agent-studio' | 'knowledge-base' | 'login' | 'auth-callback';

// ============================================
// Main App Content
// ============================================

const AppContent: React.FC = () => {
  const { isAuthenticated, loading: authLoading, getAuthHeaders } = useAuth();
  const [demoMode, setDemoMode] = useState(false);

  // View management - Observability is the default/home view
  const [view, setView] = useState<AppView>('observability');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showObservability, setShowObservability] = useState(false);
  const [observabilityTab, setObservabilityTab] = useState<'overview' | 'customers' | 'metrics'>('overview');

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
    setView('onboarding');
  };

  const handleOpenAgentCenter = () => {
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
      case 'agent-studio':
        return 'Agent Studio';
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

  // Show login if not authenticated
  if (!isAuthenticated && !demoMode && isSupabaseConfigured()) {
    return <Login onDemoMode={() => setDemoMode(true)} />;
  }

  return (
    <div className="min-h-screen bg-cscx-black text-white p-4 sm:p-8 font-sans">
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
              {(view === 'onboarding' || view === 'agent-center' || view === 'agent-studio' || view === 'knowledge-base' || view === 'customer-detail') && (
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
              onClick={() => setView('agent-studio')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                view === 'agent-studio'
                  ? 'bg-cscx-accent text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
              }`}
            >
              <span>🛠️</span> Agent Studio
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

            <button
              onClick={() => setShowObservability(true)}
              className="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800"
            >
              <span>🛰️</span> Mission Control
            </button>
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
            <AgentCenterView />
          )}

          {/* VIEW: KNOWLEDGE BASE - Unified Knowledge Management */}
          {view === 'knowledge-base' && (
            <KnowledgeBase />
          )}

          {/* VIEW: AGENT STUDIO - Build and Test Agents */}
          {view === 'agent-studio' && (
            <AgentStudio />
          )}
        </main>

        {/* Mission Control Modal */}
        {showObservability && (
          <AgentObservability onClose={() => setShowObservability(false)} />
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
      <WebSocketProvider>
        <AgenticModeProvider>
          <AppContent />
        </AgenticModeProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;
