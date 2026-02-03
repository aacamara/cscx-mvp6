/**
 * ExpansionPropensity Component
 * PRD-238: AI-Powered Expansion Propensity Scoring
 *
 * Displays expansion propensity scores and predictions for customers.
 * Helps CSMs prioritize expansion conversations with customers ready to buy.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  DollarSign,
  Clock,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Zap,
  Award,
  Building2,
  BarChart3,
  Calendar,
  MessageSquare,
  Check,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ContributingFactor {
  factor: string;
  description: string;
  weight: number;
  category: 'usage' | 'engagement' | 'health' | 'business' | 'stakeholder' | 'cohort';
  signal: 'positive' | 'negative' | 'neutral';
}

interface RecommendedProduct {
  name: string;
  reason: string;
  estimatedValue: number;
  confidence: number;
}

interface ExpansionApproach {
  champion: string | null;
  entryPoint: string;
  timing: string;
  talkingPoints: string[];
}

interface PropensityScore {
  id: string;
  customerId: string;
  customerName: string;
  propensityScore: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceValue: number;
  contributingFactors: ContributingFactor[];
  recommendedProducts: RecommendedProduct[];
  estimatedValue: number;
  approach: ExpansionApproach;
  calculatedAt: string;
  scoreBreakdown: {
    usage: number;
    engagement: number;
    health: number;
    business: number;
    stakeholder: number;
    cohort: number;
  };
  primarySignal: string;
  currentState: {
    arr: number;
    plan: string;
    healthScore: number;
    activeUsers: number;
    contractedSeats: number;
    daysToRenewal: number | null;
    usageCapacity: number;
  };
}

interface PropensityRanking {
  rank: number;
  customer: PropensityScore;
}

interface PortfolioStats {
  totalCustomers: number;
  avgPropensity: number;
  highPropensityCount: number;
  totalEstimatedValue: number;
  topOpportunities: PropensityRanking[];
  distribution: {
    veryHigh: number;
    high: number;
    medium: number;
    low: number;
    veryLow: number;
  };
  lastRefreshed: string;
}

interface ExpansionPropensityProps {
  customerId?: string;
  showPortfolio?: boolean;
  compact?: boolean;
  onCreateOpportunity?: (customerId: string) => void;
  onScheduleMeeting?: (customerId: string) => void;
}

// ============================================
// API Functions
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchCustomerPropensity(customerId: string, refresh: boolean = false): Promise<PropensityScore | null> {
  const response = await fetch(`${API_BASE}/customers/${customerId}/expansion-propensity${refresh ? '?refresh=true' : ''}`);
  const data = await response.json();
  return data.success ? data.data.propensity : null;
}

async function fetchTopOpportunities(limit: number = 10): Promise<PropensityRanking[]> {
  const response = await fetch(`${API_BASE}/analytics/expansion-propensity/top?limit=${limit}`);
  const data = await response.json();
  return data.success ? data.data.fullDetails : [];
}

async function fetchPortfolioStats(): Promise<PortfolioStats | null> {
  const response = await fetch(`${API_BASE}/analytics/expansion-propensity/stats`);
  const data = await response.json();
  return data.success ? data.data : null;
}

async function submitFeedback(customerId: string, accurate: boolean, outcome?: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/analytics/expansion-propensity/${customerId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accurate, actualOutcome: outcome }),
  });
  const data = await response.json();
  return data.success;
}

// ============================================
// Helper Functions
// ============================================

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
};

const getScoreBg = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

const getConfidenceBadge = (confidence: string): string => {
  switch (confidence) {
    case 'high':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getCategoryIcon = (category: string): JSX.Element => {
  const iconClass = 'w-4 h-4';
  switch (category) {
    case 'usage':
      return <BarChart3 className={iconClass} />;
    case 'engagement':
      return <MessageSquare className={iconClass} />;
    case 'health':
      return <Award className={iconClass} />;
    case 'business':
      return <Building2 className={iconClass} />;
    case 'stakeholder':
      return <Users className={iconClass} />;
    case 'cohort':
      return <Target className={iconClass} />;
    default:
      return <Zap className={iconClass} />;
  }
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'usage':
      return 'text-blue-400';
    case 'engagement':
      return 'text-purple-400';
    case 'health':
      return 'text-green-400';
    case 'business':
      return 'text-orange-400';
    case 'stakeholder':
      return 'text-cyan-400';
    case 'cohort':
      return 'text-pink-400';
    default:
      return 'text-gray-400';
  }
};

// ============================================
// Score Gauge Component
// ============================================

const PropensityGauge: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
  const dimensions = {
    sm: { width: 60, height: 60, stroke: 4, fontSize: 'text-sm' },
    md: { width: 100, height: 100, stroke: 6, fontSize: 'text-xl' },
    lg: { width: 140, height: 140, stroke: 8, fontSize: 'text-3xl' },
  };

  const { width, height, stroke, fontSize } = dimensions[size];
  const radius = (width / 2) - (stroke / 2) - 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative inline-block">
      <svg width={width} height={height} className="transform -rotate-90">
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radius}
          fill="none"
          stroke="#333"
          strokeWidth={stroke}
        />
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radius}
          fill="none"
          stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold ${fontSize} ${getScoreColor(score)}`}>{score}</span>
      </div>
    </div>
  );
};

// ============================================
// Factor Card Component
// ============================================

const FactorCard: React.FC<{ factor: ContributingFactor }> = ({ factor }) => (
  <div className="flex items-start gap-3 p-3 bg-cscx-gray-800 rounded-lg border border-gray-700/50">
    <div className={`p-2 rounded-lg bg-black/30 ${getCategoryColor(factor.category)}`}>
      {getCategoryIcon(factor.category)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-medium text-white">{factor.factor}</h4>
        <span className={`text-sm font-bold ${factor.signal === 'positive' ? 'text-green-400' : factor.signal === 'negative' ? 'text-red-400' : 'text-gray-400'}`}>
          {factor.signal === 'positive' ? '+' : factor.signal === 'negative' ? '-' : ''}{Math.abs(factor.weight)} pts
        </span>
      </div>
      <p className="text-xs text-gray-400">{factor.description}</p>
    </div>
  </div>
);

// ============================================
// Opportunity Row Component
// ============================================

const OpportunityRow: React.FC<{
  ranking: PropensityRanking;
  expanded: boolean;
  onToggle: () => void;
  onCreateOpp?: (customerId: string) => void;
  onScheduleMeeting?: (customerId: string) => void;
}> = ({ ranking, expanded, onToggle, onCreateOpp, onScheduleMeeting }) => {
  const { rank, customer } = ranking;

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-cscx-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="w-8 h-8 bg-cscx-accent text-white text-sm font-bold rounded-full flex items-center justify-center">
            {rank}
          </span>
          <div className="text-left">
            <h4 className="font-medium text-white">{customer.customerName}</h4>
            <p className="text-xs text-gray-400">{customer.primarySignal}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className={`text-lg font-bold ${getScoreColor(customer.propensityScore)}`}>
              {customer.propensityScore}%
            </span>
            <p className="text-xs text-gray-400">Propensity</p>
          </div>
          <div className="text-right">
            <span className={`px-2 py-0.5 text-xs rounded-full border ${getConfidenceBadge(customer.confidence)}`}>
              {customer.confidence}
            </span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-green-400">${customer.estimatedValue.toLocaleString()}</span>
            <p className="text-xs text-gray-400">Est. Value</p>
          </div>
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50 bg-cscx-gray-800/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* Contributing Factors */}
            <div>
              <h5 className="text-sm font-medium text-gray-300 mb-3">Contributing Factors</h5>
              <div className="space-y-2">
                {customer.contributingFactors.slice(0, 5).map((factor, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={getCategoryColor(factor.category)}>{getCategoryIcon(factor.category)}</span>
                      <span className="text-gray-300">{factor.factor}</span>
                    </div>
                    <span className={factor.signal === 'positive' ? 'text-green-400' : 'text-red-400'}>
                      {factor.signal === 'positive' ? '+' : '-'}{Math.abs(factor.weight)} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Approach */}
            <div>
              <h5 className="text-sm font-medium text-gray-300 mb-3">Recommended Approach</h5>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Product</p>
                  <p className="text-sm text-white">{customer.recommendedProducts[0]?.name || 'Additional Seats'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Timing</p>
                  <p className="text-sm text-white">{customer.approach.timing}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entry Point</p>
                  <p className="text-sm text-white">{customer.approach.entryPoint}</p>
                </div>
                {customer.approach.champion && (
                  <div>
                    <p className="text-xs text-gray-500">Champion</p>
                    <p className="text-sm text-white">{customer.approach.champion}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Current State */}
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700/50">
            <div>
              <p className="text-xs text-gray-500">Current ARR</p>
              <p className="text-sm font-medium text-white">${customer.currentState.arr.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Usage Capacity</p>
              <p className={`text-sm font-medium ${customer.currentState.usageCapacity >= 90 ? 'text-red-400' : customer.currentState.usageCapacity >= 75 ? 'text-yellow-400' : 'text-green-400'}`}>
                {customer.currentState.usageCapacity}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Health Score</p>
              <p className={`text-sm font-medium ${getScoreColor(customer.currentState.healthScore)}`}>
                {customer.currentState.healthScore}/100
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Days to Renewal</p>
              <p className={`text-sm font-medium ${customer.currentState.daysToRenewal && customer.currentState.daysToRenewal <= 30 ? 'text-red-400' : 'text-white'}`}>
                {customer.currentState.daysToRenewal ?? '-'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-700/50">
            <button
              onClick={() => onCreateOpp?.(customer.customerId)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              <Target className="w-4 h-4" />
              Create Expansion Opp
            </button>
            <button
              onClick={() => onScheduleMeeting?.(customer.customerId)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Schedule Meeting
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Customer Deep Dive Component
// ============================================

const CustomerDeepDive: React.FC<{
  propensity: PropensityScore;
  onRefresh: () => void;
  onCreateOpp?: (customerId: string) => void;
  onScheduleMeeting?: (customerId: string) => void;
  loading: boolean;
}> = ({ propensity, onRefresh, onCreateOpp, onScheduleMeeting, loading }) => {
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const handleFeedback = async (accurate: boolean) => {
    const success = await submitFeedback(propensity.customerId, accurate);
    if (success) setFeedbackGiven(true);
  };

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
      {/* Header */}
      <div className="p-6 border-b border-cscx-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Expansion Propensity</h2>
              <p className="text-xs text-cscx-gray-400">{propensity.customerName}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Score Overview */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <PropensityGauge score={propensity.propensityScore} size="md" />
            <p className="text-xs text-cscx-gray-400 mt-2">Propensity Score</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getConfidenceBadge(propensity.confidence)}`}>
              {propensity.confidence}
            </span>
            <p className="text-xs text-cscx-gray-400 mt-2">Confidence</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-green-400">
              ${propensity.estimatedValue.toLocaleString()}
            </span>
            <p className="text-xs text-cscx-gray-400 mt-1">Est. Expansion Value</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${propensity.currentState.usageCapacity >= 90 ? 'text-red-400' : propensity.currentState.usageCapacity >= 75 ? 'text-yellow-400' : 'text-green-400'}`}>
              {propensity.currentState.usageCapacity}%
            </span>
            <p className="text-xs text-cscx-gray-400 mt-1">Usage Capacity</p>
          </div>
        </div>
      </div>

      {/* Contributing Factors */}
      <div className="p-6 border-b border-cscx-gray-800">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Contributing Factors</h3>
        <div className="space-y-3">
          {propensity.contributingFactors.map((factor, i) => (
            <FactorCard key={i} factor={factor} />
          ))}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="p-6 border-b border-cscx-gray-800">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Score Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(propensity.scoreBreakdown).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className={`w-8 ${getCategoryColor(key)}`}>{getCategoryIcon(key)}</span>
              <span className="text-sm text-gray-400 capitalize w-24">{key}</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBg(value)}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className={`text-sm font-medium w-12 text-right ${getScoreColor(value)}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Approach */}
      <div className="p-6 border-b border-cscx-gray-800">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Recommended Approach</h3>
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-4 border border-green-500/20">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">Product</p>
              <p className="text-sm font-medium text-white">
                {propensity.recommendedProducts[0]?.name || 'Additional Seats'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Timing</p>
              <p className="text-sm font-medium text-white">{propensity.approach.timing}</p>
            </div>
            {propensity.approach.champion && (
              <div>
                <p className="text-xs text-gray-500">Champion</p>
                <p className="text-sm font-medium text-white">{propensity.approach.champion}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Entry Point</p>
              <p className="text-sm font-medium text-white">{propensity.approach.entryPoint}</p>
            </div>
          </div>

          {propensity.approach.talkingPoints.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Talking Points</p>
              <ul className="space-y-1">
                {propensity.approach.talkingPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onCreateOpp?.(propensity.customerId)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            <Target className="w-4 h-4" />
            Create Expansion Opp
          </button>
          <button
            onClick={() => onScheduleMeeting?.(propensity.customerId)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Schedule Meeting
          </button>
        </div>

        {/* Feedback */}
        <div className="flex items-center gap-2">
          {!feedbackGiven ? (
            <>
              <span className="text-xs text-gray-500">Accurate?</span>
              <button
                onClick={() => handleFeedback(true)}
                className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
                title="Yes, accurate"
              >
                <ThumbsUp className="w-4 h-4 text-gray-400 hover:text-green-400" />
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Not accurate"
              >
                <ThumbsDown className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-500">Thanks for feedback!</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-cscx-gray-800 flex items-center justify-between text-xs text-cscx-gray-500">
        <span>Calculated {new Date(propensity.calculatedAt).toLocaleString()}</span>
        <span>Powered by Claude AI</span>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const ExpansionPropensity: React.FC<ExpansionPropensityProps> = ({
  customerId,
  showPortfolio = true,
  compact = false,
  onCreateOpportunity,
  onScheduleMeeting,
}) => {
  const [propensity, setPropensity] = useState<PropensityScore | null>(null);
  const [opportunities, setOpportunities] = useState<PropensityRanking[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<'opportunities' | 'stats'>('opportunities');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (customerId) {
        const data = await fetchCustomerPropensity(customerId);
        setPropensity(data);
      } else if (showPortfolio) {
        const [opps, portfolioStats] = await Promise.all([
          fetchTopOpportunities(10),
          fetchPortfolioStats(),
        ]);
        setOpportunities(opps);
        setStats(portfolioStats);
      }
    } catch (err) {
      setError('Failed to load expansion propensity data');
      console.error('[ExpansionPropensity] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId, showPortfolio]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (customerId) {
        const data = await fetchCustomerPropensity(customerId, true);
        setPropensity(data);
      } else {
        await loadData();
      }
    } catch (err) {
      console.error('[ExpansionPropensity] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-3 text-cscx-gray-400">Calculating expansion propensity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
        <button onClick={loadData} className="ml-4 text-cscx-accent hover:underline">
          Retry
        </button>
      </div>
    );
  }

  // Customer-specific view
  if (customerId && propensity) {
    if (compact) {
      return (
        <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">Expansion Propensity</span>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full ${getScoreBg(propensity.propensityScore)} text-white`}>
              {propensity.propensityScore}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Est. Value</span>
              <span className="text-green-400 font-medium">${propensity.estimatedValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Confidence</span>
              <span className={`capitalize ${propensity.confidence === 'high' ? 'text-green-400' : propensity.confidence === 'medium' ? 'text-yellow-400' : 'text-gray-400'}`}>
                {propensity.confidence}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">{propensity.primarySignal}</p>
        </div>
      );
    }

    return (
      <CustomerDeepDive
        propensity={propensity}
        onRefresh={handleRefresh}
        onCreateOpp={onCreateOpportunity}
        onScheduleMeeting={onScheduleMeeting}
        loading={refreshing}
      />
    );
  }

  // Portfolio view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            Expansion Propensity
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            AI-powered predictions for expansion-ready customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <TrendingUp className="w-4 h-4" />
              Avg Propensity
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(stats.avgPropensity)}`}>
              {stats.avgPropensity}%
            </div>
          </div>

          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Target className="w-4 h-4" />
              High Propensity
            </div>
            <div className="text-2xl font-bold text-green-400">
              {stats.highPropensityCount}
            </div>
            <p className="text-xs text-gray-500">customers</p>
          </div>

          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              Total Opportunity
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${stats.totalEstimatedValue.toLocaleString()}
            </div>
          </div>

          <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Users className="w-4 h-4" />
              Analyzed
            </div>
            <div className="text-2xl font-bold text-white">
              {stats.totalCustomers}
            </div>
            <p className="text-xs text-gray-500">customers</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveView('opportunities')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeView === 'opportunities'
              ? 'text-cscx-accent border-b-2 border-cscx-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Top Opportunities ({opportunities.length})
        </button>
        <button
          onClick={() => setActiveView('stats')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeView === 'stats'
              ? 'text-cscx-accent border-b-2 border-cscx-accent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Distribution
        </button>
      </div>

      {/* Content */}
      {activeView === 'opportunities' && (
        <div className="space-y-3">
          {opportunities.map((ranking, index) => (
            <OpportunityRow
              key={ranking.customer.customerId}
              ranking={ranking}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
              onCreateOpp={onCreateOpportunity}
              onScheduleMeeting={onScheduleMeeting}
            />
          ))}

          {opportunities.length === 0 && (
            <div className="text-center py-12 bg-cscx-gray-800 rounded-lg border border-gray-700/50">
              <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No High-Propensity Customers</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                No customers currently meet the threshold for high expansion propensity.
                Scores are refreshed automatically based on usage and engagement signals.
              </p>
            </div>
          )}
        </div>
      )}

      {activeView === 'stats' && stats && (
        <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Propensity Distribution</h3>
          <div className="space-y-3">
            {[
              { label: 'Very High (80-100)', value: stats.distribution.veryHigh, color: 'bg-green-500' },
              { label: 'High (60-80)', value: stats.distribution.high, color: 'bg-yellow-500' },
              { label: 'Medium (40-60)', value: stats.distribution.medium, color: 'bg-orange-500' },
              { label: 'Low (20-40)', value: stats.distribution.low, color: 'bg-red-500' },
              { label: 'Very Low (0-20)', value: stats.distribution.veryLow, color: 'bg-gray-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-32">{label}</span>
                <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all`}
                    style={{ width: `${(value / stats.totalCustomers) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-white w-8 text-right">{value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Last refreshed: {new Date(stats.lastRefreshed).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpansionPropensity;
