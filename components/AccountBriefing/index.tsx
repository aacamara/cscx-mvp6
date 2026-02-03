/**
 * Account Briefing Component (PRD-056)
 *
 * Displays a comprehensive 360-degree account briefing including:
 * - Quick stats (ARR, health, renewal)
 * - Executive summary (AI-generated)
 * - Key stakeholders with sentiment
 * - Health indicators
 * - Active risk signals
 * - Recent activity
 * - Expansion opportunities
 * - Recommended actions
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// Types matching backend
interface QuickStats {
  arr: number;
  arrTrend: string;
  arrChangePercent: number;
  healthScore: number;
  healthTrend: string;
  stage: string;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  csmName: string | null;
}

interface KeyStakeholder {
  name: string;
  role: string;
  email: string | null;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Unknown';
  lastContact: string | null;
}

interface HealthIndicator {
  name: string;
  score: number;
  maxScore: number;
  explanation: string;
}

interface RiskSignal {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  detectedAt: string;
}

interface RecentActivity {
  date: string;
  type: string;
  description: string;
}

interface ExpansionOpportunity {
  name: string;
  potential: number;
  stage: string;
  probability: number;
}

interface RecommendedAction {
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
}

interface AccountBriefing {
  customerId: string;
  accountName: string;
  generatedAt: string;
  quickStats: QuickStats;
  executiveSummary: string;
  keyStakeholders: KeyStakeholder[];
  healthIndicators: HealthIndicator[];
  activeRiskSignals: RiskSignal[];
  recentActivity: RecentActivity[];
  expansionOpportunities: ExpansionOpportunity[];
  recommendedActions: RecommendedAction[];
  dataCompleteness: number;
}

interface AccountBriefingProps {
  customerId?: string;
  accountName?: string;
  focusArea?: 'health' | 'renewal' | 'stakeholders' | 'usage';
  timePeriod?: string;
  onClose?: () => void;
  compact?: boolean;
}

export const AccountBriefing: React.FC<AccountBriefingProps> = ({
  customerId,
  accountName,
  focusArea,
  timePeriod,
  onClose,
  compact = false
}) => {
  const [briefing, setBriefing] = useState<AccountBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState(accountName || '');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const fetchBriefing = useCallback(async (id?: string, name?: string) => {
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      let response;

      if (id) {
        // Fetch by ID
        const params = new URLSearchParams();
        if (focusArea) params.append('focusArea', focusArea);
        if (timePeriod) params.append('timePeriod', timePeriod);

        response = await fetch(
          `${API_BASE}/intelligence/account-briefing/${id}?${params.toString()}`
        );
      } else if (name) {
        // Search by name
        response = await fetch(`${API_BASE}/intelligence/account-briefing/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountName: name, focusArea, timePeriod })
        });
      } else {
        throw new Error('Either customerId or accountName is required');
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 300 && data.error?.suggestions) {
          // Multiple matches found
          setSuggestions(data.error.suggestions);
          setError(data.error.message);
        } else if (response.status === 404 && data.error?.suggestions) {
          // Not found but has suggestions
          setSuggestions(data.error.suggestions);
          setError(data.error.message);
        } else {
          throw new Error(data.error?.message || 'Failed to fetch briefing');
        }
        return;
      }

      setBriefing(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [focusArea, timePeriod]);

  useEffect(() => {
    if (customerId || accountName) {
      fetchBriefing(customerId, accountName);
    }
  }, [customerId, accountName, fetchBriefing]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchBriefing(undefined, searchQuery.trim());
    }
  };

  const handleSelectSuggestion = (suggestion: { id: string; name: string }) => {
    setSuggestions([]);
    setSearchQuery(suggestion.name);
    fetchBriefing(suggestion.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return 'text-green-400';
      case 'Negative': return 'text-red-400';
      case 'Neutral': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'High': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-500/20 text-red-400';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'Low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Growing': return <span className="text-green-400">+</span>;
      case 'Declining': return <span className="text-red-400">-</span>;
      default: return <span className="text-gray-400">=</span>;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-3 text-cscx-gray-400">Generating account briefing...</span>
        </div>
      </div>
    );
  }

  // Error state with suggestions
  if (error && !briefing) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl`}>
        <div className="text-center py-8">
          <p className="text-yellow-400 mb-4">{error}</p>

          {suggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-cscx-gray-400 mb-3">Did you mean:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSuggestion(s)}
                    className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search form */}
          <form onSubmit={handleSearch} className="mt-6 max-w-md mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter account name..."
                className="flex-1 px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 text-cscx-gray-400 hover:text-white transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!briefing) {
    return null;
  }

  // Main briefing view
  return (
    <div className={`${compact ? 'space-y-4' : 'space-y-6'}`}>
      {/* Header */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{briefing.accountName}</h2>
            <p className="text-cscx-gray-400 text-sm mt-1">
              Account Briefing - Generated {formatRelativeDate(briefing.generatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-cscx-gray-500 uppercase">Data Completeness</p>
              <p className={`text-lg font-semibold ${briefing.dataCompleteness >= 80 ? 'text-green-400' : briefing.dataCompleteness >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {briefing.dataCompleteness}%
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">ARR</p>
            <p className="text-xl font-bold text-cscx-accent">
              {formatCurrency(briefing.quickStats.arr)}
            </p>
            <p className="text-xs text-cscx-gray-500 flex items-center justify-center gap-1">
              {getTrendIcon(briefing.quickStats.arrTrend)} {briefing.quickStats.arrTrend}
            </p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Health Score</p>
            <p className={`text-xl font-bold ${getHealthColor(briefing.quickStats.healthScore)}`}>
              {briefing.quickStats.healthScore}/100
            </p>
            <p className="text-xs text-cscx-gray-500 flex items-center justify-center gap-1">
              {getTrendIcon(briefing.quickStats.healthTrend)} {briefing.quickStats.healthTrend}
            </p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Stage</p>
            <p className="text-lg font-semibold text-white capitalize">
              {briefing.quickStats.stage.replace('_', ' ')}
            </p>
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">Renewal</p>
            <p className="text-lg font-semibold text-white">
              {formatDate(briefing.quickStats.renewalDate)}
            </p>
            {briefing.quickStats.daysUntilRenewal !== null && (
              <p className={`text-xs ${briefing.quickStats.daysUntilRenewal < 30 ? 'text-red-400' : briefing.quickStats.daysUntilRenewal < 90 ? 'text-yellow-400' : 'text-cscx-gray-500'}`}>
                {briefing.quickStats.daysUntilRenewal > 0 ? `${briefing.quickStats.daysUntilRenewal} days` : 'Overdue'}
              </p>
            )}
          </div>
          <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-xs text-cscx-gray-400 uppercase">CSM</p>
            <p className="text-lg font-semibold text-white">
              {briefing.quickStats.csmName || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Executive Summary</h3>
        <p className="text-cscx-gray-300 leading-relaxed">{briefing.executiveSummary}</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Key Stakeholders */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Key Stakeholders</h3>
            {briefing.keyStakeholders.length === 0 ? (
              <p className="text-cscx-gray-500 text-sm">No stakeholder data available</p>
            ) : (
              <div className="space-y-3">
                {briefing.keyStakeholders.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-cscx-gray-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{s.name}</p>
                      <p className="text-sm text-cscx-gray-400">{s.role}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${getSentimentColor(s.sentiment)}`}>
                        {s.sentiment}
                      </p>
                      <p className="text-xs text-cscx-gray-500">
                        {s.lastContact ? formatRelativeDate(s.lastContact) : 'No contact'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health Indicators */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Health Indicators</h3>
            <div className="space-y-4">
              {briefing.healthIndicators.map((h, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-cscx-gray-300">{h.name}</span>
                    <span className={getHealthColor(h.score)}>{h.score}/{h.maxScore}</span>
                  </div>
                  <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getHealthBg(h.score)}`}
                      style={{ width: `${(h.score / h.maxScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-cscx-gray-500 mt-1">{h.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Expansion Opportunities */}
          {briefing.expansionOpportunities.length > 0 && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Expansion Opportunities</h3>
              <div className="space-y-3">
                {briefing.expansionOpportunities.map((o, i) => (
                  <div key={i} className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">{o.name}</p>
                      <span className="text-green-400 font-semibold">
                        {formatCurrency(o.potential)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="text-cscx-gray-400">Stage: {o.stage}</span>
                      <span className="text-cscx-gray-400">|</span>
                      <span className="text-cscx-gray-400">{o.probability}% probability</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Risk Signals */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Active Risk Signals
              {briefing.activeRiskSignals.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                  {briefing.activeRiskSignals.length}
                </span>
              )}
            </h3>
            {briefing.activeRiskSignals.length === 0 ? (
              <div className="text-center py-4">
                <span className="text-green-400">No active risk signals</span>
              </div>
            ) : (
              <div className="space-y-3">
                {briefing.activeRiskSignals.map((r, i) => (
                  <div key={i} className={`p-3 border rounded-lg ${getSeverityBg(r.severity)}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{r.type}</p>
                      <span className="text-xs uppercase">{r.severity}</span>
                    </div>
                    <p className="text-sm mt-1 opacity-90">{r.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended Actions */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recommended Actions</h3>
            {briefing.recommendedActions.length === 0 ? (
              <p className="text-cscx-gray-500 text-sm">No recommended actions</p>
            ) : (
              <div className="space-y-3">
                {briefing.recommendedActions.map((a, i) => (
                  <div key={i} className="p-3 bg-cscx-gray-800/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${getPriorityBg(a.priority)}`}>
                        {a.priority}
                      </span>
                      <div>
                        <p className="font-medium text-white">{a.action}</p>
                        {a.reason && (
                          <p className="text-sm text-cscx-gray-400 mt-1">{a.reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity (Last 30 Days)</h3>
            {briefing.recentActivity.length === 0 ? (
              <p className="text-cscx-gray-500 text-sm">No recent activity recorded</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {briefing.recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 hover:bg-cscx-gray-800/50 rounded-lg">
                    <span className="text-xs text-cscx-gray-500 whitespace-nowrap min-w-[80px]">
                      {formatRelativeDate(a.date)}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-cscx-gray-800 text-cscx-gray-400 rounded">
                      {a.type}
                    </span>
                    <span className="text-sm text-cscx-gray-300 truncate">{a.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountBriefing;
