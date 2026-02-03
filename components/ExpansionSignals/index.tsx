/**
 * Expansion Signals Component
 * PRD-103: Expansion Signal Detected
 *
 * Displays expansion signals and opportunities for a customer.
 * Can be embedded in CustomerDetail or used standalone.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Users,
  Zap,
  MessageSquare,
  Building2,
  BarChart3,
  Swords,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  DollarSign,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface DetectedSignal {
  type: string;
  details: string;
  detected_at: string;
  strength: number;
  source?: string;
  quote?: string;
}

interface ExpansionDetection {
  customerId: string;
  customerName: string;
  signals: DetectedSignal[];
  compositeScore: number;
  estimatedExpansionArr: number;
  suggestedProducts: string[];
  recommendedApproach: string;
  expansionType: string;
  currentState: {
    arr: number;
    plan: string;
    healthScore: number;
    contractEndDate?: string;
    activeUsers: number;
    contractedSeats: number;
  };
}

interface ExpansionOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  opportunityType: string;
  productLine?: string;
  estimatedValue: number;
  probability: number;
  stage: string;
  timeline?: string;
  signalData: {
    signals: DetectedSignal[];
    compositeScore: number;
    suggestedProducts: string[];
    recommendedApproach: string;
  };
  detectedAt: string;
  qualifiedAt?: string;
  closedAt?: string;
}

interface ExpansionSignalsProps {
  customerId: string;
  showOpportunities?: boolean;
  compact?: boolean;
  onCreateOpportunity?: (opportunityId: string) => void;
}

// ============================================
// Signal Type Configurations
// ============================================

const SIGNAL_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  usage_limit_approaching: { icon: Zap, color: 'text-yellow-400', label: 'Usage Limit Approaching' },
  seat_overage: { icon: Users, color: 'text-blue-400', label: 'Seat Overage' },
  feature_interest: { icon: TrendingUp, color: 'text-green-400', label: 'Feature Interest' },
  expansion_mention: { icon: MessageSquare, color: 'text-purple-400', label: 'Expansion Mention' },
  new_team_onboarding: { icon: Building2, color: 'text-cyan-400', label: 'New Team Onboarding' },
  api_usage_growth: { icon: BarChart3, color: 'text-orange-400', label: 'API Usage Growth' },
  competitor_displacement: { icon: Swords, color: 'text-red-400', label: 'Competitor Displacement' },
};

const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
  detected: { color: 'bg-gray-600', label: 'Detected' },
  qualified: { color: 'bg-blue-600', label: 'Qualified' },
  proposed: { color: 'bg-purple-600', label: 'Proposed' },
  negotiating: { color: 'bg-yellow-600', label: 'Negotiating' },
  closed_won: { color: 'bg-green-600', label: 'Won' },
  closed_lost: { color: 'bg-red-600', label: 'Lost' },
};

// ============================================
// API
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchSignals(customerId: string): Promise<ExpansionDetection | null> {
  const response = await fetch(`${API_BASE}/expansion/signals/${customerId}`);
  const data = await response.json();
  return data.success ? data.data : null;
}

async function fetchOpportunities(customerId: string): Promise<ExpansionOpportunity[]> {
  const response = await fetch(`${API_BASE}/expansion/customers/${customerId}/opportunities`);
  const data = await response.json();
  return data.success ? data.data.opportunities : [];
}

async function createOpportunity(customerId: string): Promise<ExpansionOpportunity | null> {
  const response = await fetch(`${API_BASE}/expansion/opportunities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  });
  const data = await response.json();
  return data.success ? data.data.opportunity : null;
}

// ============================================
// Signal Card Component
// ============================================

const SignalCard: React.FC<{ signal: DetectedSignal }> = ({ signal }) => {
  const config = SIGNAL_CONFIG[signal.type] || { icon: AlertCircle, color: 'text-gray-400', label: signal.type };
  const Icon = config.icon;

  return (
    <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-black/30 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-medium text-white">{config.label}</h4>
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
                  style={{ width: `${signal.strength * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{Math.round(signal.strength * 100)}%</span>
            </div>
          </div>
          <p className="text-sm text-gray-300">{signal.details}</p>
          {signal.quote && (
            <blockquote className="mt-2 text-xs text-gray-400 italic border-l-2 border-gray-600 pl-2">
              "{signal.quote}"
            </blockquote>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            {signal.source && <span className="capitalize">{signal.source.replace('_', ' ')}</span>}
            <span>{new Date(signal.detected_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Opportunity Card Component
// ============================================

const OpportunityCard: React.FC<{ opportunity: ExpansionOpportunity }> = ({ opportunity }) => {
  const stageConfig = STAGE_CONFIG[opportunity.stage] || { color: 'bg-gray-600', label: opportunity.stage };

  return (
    <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-white capitalize">
            {opportunity.opportunityType.replace('_', ' ')}
          </h4>
          {opportunity.productLine && (
            <p className="text-xs text-gray-400">{opportunity.productLine}</p>
          )}
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full text-white ${stageConfig.color}`}>
          {stageConfig.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500">Estimated Value</p>
          <p className="text-lg font-semibold text-green-400">
            ${opportunity.estimatedValue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Probability</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${opportunity.probability}%` }}
              />
            </div>
            <span className="text-sm text-white">{opportunity.probability}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>Detected {new Date(opportunity.detectedAt).toLocaleDateString()}</span>
        {opportunity.timeline && (
          <>
            <span>|</span>
            <Target className="w-3 h-3" />
            <span className="capitalize">{opportunity.timeline.replace('_', ' ')}</span>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const ExpansionSignals: React.FC<ExpansionSignalsProps> = ({
  customerId,
  showOpportunities = true,
  compact = false,
  onCreateOpportunity,
}) => {
  const [detection, setDetection] = useState<ExpansionDetection | null>(null);
  const [opportunities, setOpportunities] = useState<ExpansionOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [signalData, oppData] = await Promise.all([
        fetchSignals(customerId),
        showOpportunities ? fetchOpportunities(customerId) : Promise.resolve([]),
      ]);

      setDetection(signalData);
      setOpportunities(oppData);
    } catch (err) {
      setError('Failed to load expansion data');
      console.error('[ExpansionSignals] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId, showOpportunities]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateOpportunity = async () => {
    setCreating(true);
    try {
      const opportunity = await createOpportunity(customerId);
      if (opportunity) {
        setOpportunities((prev) => [opportunity, ...prev]);
        onCreateOpportunity?.(opportunity.id);
      }
    } catch (err) {
      console.error('[ExpansionSignals] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  const hasSignals = detection && detection.signals.length > 0;
  const activeOpportunities = opportunities.filter((o) => !['closed_won', 'closed_lost'].includes(o.stage));

  // Compact view for sidebar/widget
  if (compact) {
    if (!hasSignals) return null;

    return (
      <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-white">Expansion Signals</span>
          </div>
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
            {detection.signals.length} detected
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Score</span>
            <span className="text-white font-medium">
              {Math.round(detection.compositeScore * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Est. Expansion</span>
            <span className="text-green-400 font-medium">
              ${detection.estimatedExpansionArr.toLocaleString()}
            </span>
          </div>
        </div>

        {detection.suggestedProducts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Suggested Products</p>
            <div className="flex flex-wrap gap-1">
              {detection.suggestedProducts.map((product, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                  {product}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Expansion Signals
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {hasSignals
              ? `${detection.signals.length} signals detected - ${detection.customerName}`
              : 'No expansion signals detected'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {hasSignals && activeOpportunities.length === 0 && (
            <button
              onClick={handleCreateOpportunity}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              Create Opportunity
            </button>
          )}
        </div>
      </div>

      {hasSignals && (
        <>
          {/* Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Target className="w-4 h-4" />
                Composite Score
              </div>
              <div className="text-2xl font-bold text-white">
                {Math.round(detection.compositeScore * 100)}%
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full transition-all"
                  style={{ width: `${detection.compositeScore * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <DollarSign className="w-4 h-4" />
                Estimated Expansion
              </div>
              <div className="text-2xl font-bold text-green-400">
                ${detection.estimatedExpansionArr.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Additional ARR</p>
            </div>

            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <TrendingUp className="w-4 h-4" />
                Expansion Type
              </div>
              <div className="text-lg font-semibold text-white capitalize">
                {detection.expansionType.replace('_', ' ')}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Current: ${detection.currentState.arr.toLocaleString()} ARR
              </p>
            </div>

            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <AlertCircle className="w-4 h-4" />
                Signals Detected
              </div>
              <div className="text-2xl font-bold text-white">{detection.signals.length}</div>
              <p className="text-xs text-gray-500 mt-1">
                Plan: {detection.currentState.plan}
              </p>
            </div>
          </div>

          {/* Recommended Approach */}
          <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-4 border border-green-500/20">
            <h3 className="text-sm font-medium text-green-400 mb-2">Recommended Approach</h3>
            <p className="text-white">{detection.recommendedApproach}</p>
            {detection.suggestedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {detection.suggestedProducts.map((product, i) => (
                  <span
                    key={i}
                    className="text-sm px-3 py-1 bg-green-500/20 text-green-300 rounded-full"
                  >
                    {product}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Signals List */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Detected Signals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detection.signals.map((signal, i) => (
                <SignalCard key={i} signal={signal} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Opportunities Section */}
      {showOpportunities && opportunities.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Expansion Opportunities ({opportunities.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasSignals && (
        <div className="text-center py-12 bg-cscx-gray-800 rounded-lg border border-gray-700/50">
          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Expansion Signals</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            No expansion signals have been detected for this customer yet. Signals are automatically
            detected based on usage patterns, meeting conversations, and account activity.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpansionSignals;
