/**
 * FeatureExplorationTracker - Track and display feature exploration progress
 * PRD: Compound Product Launch (CP-012)
 * Shows 'Explored X/8 features' with progress indicator
 */

import React, { useState, useEffect, useCallback } from 'react';
import { trackFeatureExplored } from '../src/services/analytics';

const STORAGE_KEY = 'cscx_explored_features';

// Define the core features to track
const FEATURES = [
  { id: 'customer_list', name: 'Customer List', icon: '👥' },
  { id: 'mock_onboarding', name: 'Mock Onboarding', icon: '🚀' },
  { id: 'csv_import', name: 'CSV Import', icon: '📊' },
  { id: 'csv_template', name: 'CSV Template', icon: '📋' },
  { id: 'contract_upload', name: 'Contract Upload', icon: '📄' },
  { id: 'agent_chat', name: 'AI Agent Chat', icon: '🤖' },
  { id: 'customer_detail', name: 'Customer Detail', icon: '🔍' },
  { id: 'approval_queue', name: 'Approval Queue', icon: '✅' },
] as const;

type FeatureId = typeof FEATURES[number]['id'];

interface ExplorationState {
  explored: FeatureId[];
  lastExplored: FeatureId | null;
  lastExploredAt: string | null;
}

// Context for feature exploration tracking
const ExplorationContext = React.createContext<{
  explored: Set<FeatureId>;
  markExplored: (featureId: FeatureId) => void;
  resetExploration: () => void;
  progress: number;
  total: number;
} | null>(null);

export function FeatureExplorationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ExplorationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          explored: parsed.explored || [],
          lastExplored: parsed.lastExplored || null,
          lastExploredAt: parsed.lastExploredAt || null,
        };
      }
    } catch {
      // Ignore parse errors
    }
    return { explored: [], lastExplored: null, lastExploredAt: null };
  });

  const exploredSet = new Set(state.explored);

  const markExplored = useCallback((featureId: FeatureId) => {
    if (exploredSet.has(featureId)) return;

    const newExplored = [...state.explored, featureId];
    const newState: ExplorationState = {
      explored: newExplored,
      lastExplored: featureId,
      lastExploredAt: new Date().toISOString(),
    };

    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    trackFeatureExplored(featureId);
  }, [state.explored, exploredSet]);

  const resetExploration = useCallback(() => {
    const newState: ExplorationState = {
      explored: [],
      lastExplored: null,
      lastExploredAt: null,
    };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, []);

  return (
    <ExplorationContext.Provider
      value={{
        explored: exploredSet,
        markExplored,
        resetExploration,
        progress: state.explored.length,
        total: FEATURES.length,
      }}
    >
      {children}
    </ExplorationContext.Provider>
  );
}

export function useFeatureExploration() {
  const context = React.useContext(ExplorationContext);
  if (!context) {
    throw new Error('useFeatureExploration must be used within FeatureExplorationProvider');
  }
  return context;
}

// Hook to automatically mark a feature as explored when a component mounts
export function useMarkFeatureExplored(featureId: FeatureId) {
  const { markExplored } = useFeatureExploration();

  useEffect(() => {
    markExplored(featureId);
  }, [featureId, markExplored]);
}

// Progress indicator component
interface FeatureProgressProps {
  showDetails?: boolean;
  className?: string;
}

export function FeatureProgress({ showDetails = false, className = '' }: FeatureProgressProps) {
  const { progress, total, explored, resetExploration } = useFeatureExploration();
  const [showDropdown, setShowDropdown] = useState(false);

  const percentage = (progress / total) * 100;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors"
      >
        <div className="w-20 h-1.5 bg-cscx-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cscx-accent to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-gray-300">
          {progress}/{total}
        </span>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl shadow-xl z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">Feature Exploration</h4>
              <span className="text-xs text-gray-400">{progress}/{total} explored</span>
            </div>

            <div className="space-y-2">
              {FEATURES.map((feature) => {
                const isExplored = explored.has(feature.id);
                return (
                  <div
                    key={feature.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      isExplored ? 'bg-green-900/20' : 'bg-cscx-gray-800'
                    }`}
                  >
                    <span className="text-lg">{feature.icon}</span>
                    <span className={`text-sm ${isExplored ? 'text-green-400' : 'text-gray-400'}`}>
                      {feature.name}
                    </span>
                    {isExplored && (
                      <svg className="w-4 h-4 text-green-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {!isExplored && (
                      <span className="ml-auto w-2 h-2 bg-cscx-accent/50 rounded-full animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reset button for demo */}
            <button
              onClick={() => {
                resetExploration();
                setShowDropdown(false);
              }}
              className="w-full mt-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reset for demo
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

// Badge for unexplored features
interface UnexploredBadgeProps {
  featureId: FeatureId;
  className?: string;
}

export function UnexploredBadge({ featureId, className = '' }: UnexploredBadgeProps) {
  const { explored } = useFeatureExploration();

  if (explored.has(featureId)) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-2 h-2 bg-cscx-accent rounded-full animate-pulse ${className}`}
      title="Not yet explored"
    />
  );
}

export default {
  FeatureExplorationProvider,
  useFeatureExploration,
  useMarkFeatureExplored,
  FeatureProgress,
  UnexploredBadge,
};
