/**
 * PRD-1: Onboarding Checklist Component
 * Shows first-run users their setup progress
 * Slides in from right side, persists until complete or dismissed
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

interface OnboardingChecklistProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCustomers: () => void;
  onCreateSuccessPlan?: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  isOpen,
  onClose,
  onImportCustomers,
  onCreateSuccessPlan
}) => {
  const { isAuthenticated, user } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Load checklist state
  useEffect(() => {
    const loadChecklist = async () => {
      // Default checklist items
      const items: ChecklistItem[] = [
        {
          id: 'google_connected',
          title: 'Google Workspace Connected',
          description: 'Your Google account is connected for email, calendar, and drive access.',
          completed: isAuthenticated, // If authenticated via Google, this is done
        },
        {
          id: 'customers_imported',
          title: 'Import Your Customers',
          description: 'Add your customers from Google Sheets or CSV to get started.',
          completed: false,
          action: onImportCustomers,
          actionLabel: 'Import Customers'
        },
        {
          id: 'first_success_plan',
          title: 'Create First Success Plan',
          description: 'Generate an AI-powered success plan for one of your customers.',
          completed: false,
          action: onCreateSuccessPlan,
          actionLabel: 'Create Plan'
        }
      ];

      // Try to load saved state from API
      try {
        const response = await fetch(`${API_URL}/api/auth/session`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user?.onboarding_checklist) {
            // Update items with saved state
            items.forEach(item => {
              if (data.user.onboarding_checklist[item.id] !== undefined) {
                item.completed = data.user.onboarding_checklist[item.id];
              }
            });
          }
        }
      } catch (err) {
        // Use defaults if API fails
        console.warn('Could not load onboarding state:', err);
      }

      setChecklist(items);
    };

    if (isOpen) {
      loadChecklist();
    }
  }, [isOpen, isAuthenticated, API_URL, onImportCustomers, onCreateSuccessPlan]);

  // Mark item as complete
  const markComplete = useCallback(async (itemId: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: true } : item
      )
    );

    // Persist to backend
    try {
      await fetch(`${API_URL}/api/users/onboarding`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          [itemId]: true
        })
      });
    } catch (err) {
      console.warn('Could not save onboarding state:', err);
    }
  }, [API_URL]);

  // Calculate progress
  const completedCount = checklist.filter(item => item.completed).length;
  const totalCount = checklist.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = completedCount === totalCount;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-md bg-cscx-gray-900 border-l border-cscx-gray-800 z-50
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-cscx-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Welcome to CSCX.AI</h2>
              <button
                onClick={onClose}
                className="p-2 text-cscx-gray-400 hover:text-white rounded-lg hover:bg-cscx-gray-800 transition-colors"
                aria-label="Close onboarding"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-cscx-gray-400">Setup Progress</span>
                <span className="text-cscx-accent font-medium">{completedCount}/{totalCount}</span>
              </div>
              <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cscx-accent transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {checklist.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border transition-colors
                    ${item.completed
                      ? 'bg-green-900/10 border-green-500/30'
                      : 'bg-cscx-gray-800/50 border-cscx-gray-700'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Step Number / Check */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${item.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-cscx-gray-700 text-cscx-gray-400'}`}
                    >
                      {item.completed ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className={`font-medium mb-1 ${item.completed ? 'text-green-400' : 'text-white'}`}>
                        {item.title}
                      </h3>
                      <p className="text-sm text-cscx-gray-400 mb-3">
                        {item.description}
                      </p>

                      {/* Action Button */}
                      {!item.completed && item.action && (
                        <button
                          onClick={() => {
                            item.action?.();
                            // Optionally mark as in-progress
                          }}
                          className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white text-sm font-medium rounded-lg
                            transition-colors"
                        >
                          {item.actionLabel || 'Start'}
                        </button>
                      )}

                      {item.completed && (
                        <span className="inline-flex items-center gap-1 text-sm text-green-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* All Complete Message */}
            {allComplete && (
              <div className="mt-6 p-4 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-cscx-accent/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold mb-1">You're all set!</h3>
                <p className="text-cscx-gray-400 text-sm">
                  Your CSCX.AI workspace is ready to use.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-cscx-gray-800">
            <button
              onClick={onClose}
              className={`w-full py-3 font-medium rounded-lg transition-colors
                ${allComplete
                  ? 'bg-cscx-accent hover:bg-cscx-accent/90 text-white'
                  : 'bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-300'}`}
            >
              {allComplete ? 'Get Started' : 'Skip for Now'}
            </button>

            {!allComplete && (
              <p className="text-center text-cscx-gray-500 text-xs mt-3">
                You can always access this from Settings
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingChecklist;
