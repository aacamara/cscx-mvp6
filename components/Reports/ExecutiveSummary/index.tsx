/**
 * Executive Summary Report Component
 * PRD-179: Executive Summary Report
 *
 * Displays a comprehensive executive summary for CS leadership with
 * key metrics, trends, risks, and recommendations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Shield,
  Target,
  Users,
  DollarSign,
  Clock,
  Calendar,
  RefreshCw,
  Download,
  Send,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  AlertCircle,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ExecutiveMetric {
  name: string;
  actual: number;
  target: number;
  status: 'above' | 'on_target' | 'below';
  delta: number;
  deltaPercent: number;
  format: 'percent' | 'currency' | 'number' | 'days' | 'score';
}

interface PortfolioSummary {
  totalArr: number;
  arrChange: number;
  arrChangePercent: number;
  activeCustomers: number;
  netNewCustomers: number;
  churnedArr: number;
  churnedCustomers: number;
  expansionArr: number;
  expansionCustomers: number;
}

interface TopWin {
  id: string;
  customerName: string;
  type: 'renewal' | 'expansion' | 'save' | 'efficiency' | 'milestone';
  description: string;
  value?: number;
  previousValue?: number;
  percentChange?: number;
  date: string;
}

interface KeyRisk {
  id: string;
  customerName: string;
  severity: 'high' | 'medium' | 'low';
  type: 'churn' | 'contraction' | 'support' | 'engagement' | 'champion';
  description: string;
  arrAtRisk: number;
  action?: string;
  daysToRenewal?: number;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'engagement' | 'support' | 'expansion' | 'risk' | 'process';
  title: string;
  description: string;
  expectedImpact?: string;
  effort?: 'low' | 'medium' | 'high';
}

interface TrendDataPoint {
  period: string;
  periodLabel: string;
  value: number;
}

interface MetricTrend {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'declining';
  dataPoints: TrendDataPoint[];
}

interface ExecutiveSummaryReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  generatedAt: string;
  keyMetrics: ExecutiveMetric[];
  portfolio: PortfolioSummary;
  topWins: TopWin[];
  keyRisks: KeyRisk[];
  recommendations: Recommendation[];
  trends: {
    arr: MetricTrend;
    nrr: MetricTrend;
    healthScore: MetricTrend;
    nps: MetricTrend;
  };
  customerCount: number;
  atRiskCount: number;
  healthyCount: number;
}

interface ExecutiveSummaryProps {
  initialPeriod?: 'month' | 'quarter' | 'year';
  onSchedule?: () => void;
  onDownloadPdf?: (reportId: string) => void;
}

// ============================================
// API
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchExecutiveSummary(period: string): Promise<ExecutiveSummaryReport | null> {
  try {
    const response = await fetch(`${API_BASE}/reports/executive-summary?period=${period}`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('[ExecutiveSummary] Fetch error:', error);
    return null;
  }
}

// ============================================
// Helper Functions
// ============================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatMetricValue(value: number, format: ExecutiveMetric['format']): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return formatCurrency(value);
    case 'days':
      return `${value} days`;
    case 'score':
      return `${Math.round(value)}`;
    default:
      return value.toLocaleString();
  }
}

// ============================================
// Sub-Components
// ============================================

const StatusBadge: React.FC<{ status: 'above' | 'on_target' | 'below' }> = ({ status }) => {
  const config = {
    above: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Above Target' },
    on_target: { icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'On Target' },
    below: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Below Target' },
  };

  const { icon: Icon, color, bg } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${color} ${bg}`}>
      <Icon className="w-3 h-3" />
    </span>
  );
};

const TrendIndicator: React.FC<{ trend: 'improving' | 'stable' | 'declining'; value: number }> = ({ trend, value }) => {
  const config = {
    improving: { icon: TrendingUp, color: 'text-green-400' },
    stable: { icon: Minus, color: 'text-gray-400' },
    declining: { icon: TrendingDown, color: 'text-red-400' },
  };

  const { icon: Icon, color } = config[trend];

  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </span>
  );
};

const MetricCard: React.FC<{ metric: ExecutiveMetric }> = ({ metric }) => {
  return (
    <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-gray-400">{metric.name}</span>
        <StatusBadge status={metric.status} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">
          {formatMetricValue(metric.actual, metric.format)}
        </span>
        <span className="text-sm text-gray-500">
          / {formatMetricValue(metric.target, metric.format)}
        </span>
      </div>
      <div className={`mt-2 text-sm ${metric.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {metric.delta >= 0 ? '+' : ''}{metric.delta.toFixed(1)}
        {metric.format === 'percent' ? 'pp' : ''} vs target
      </div>
    </div>
  );
};

const PortfolioCard: React.FC<{ portfolio: PortfolioSummary }> = ({ portfolio }) => {
  return (
    <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        Portfolio Summary
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Total ARR</p>
          <p className="text-xl font-bold text-white">{formatCurrency(portfolio.totalArr)}</p>
          <p className={`text-sm ${portfolio.arrChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {portfolio.arrChangePercent >= 0 ? '+' : ''}{portfolio.arrChangePercent}% QoQ
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Active Customers</p>
          <p className="text-xl font-bold text-white">{portfolio.activeCustomers}</p>
          <p className="text-sm text-gray-400">
            {portfolio.netNewCustomers >= 0 ? '+' : ''}{portfolio.netNewCustomers} net new
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Churned ARR</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(portfolio.churnedArr)}</p>
          <p className="text-sm text-gray-400">{portfolio.churnedCustomers} customers</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Expansion ARR</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(portfolio.expansionArr)}</p>
          <p className="text-sm text-gray-400">{portfolio.expansionCustomers} customers</p>
        </div>
      </div>
    </div>
  );
};

const WinCard: React.FC<{ win: TopWin }> = ({ win }) => {
  const typeConfig = {
    renewal: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    expansion: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/20' },
    save: { icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    efficiency: { icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    milestone: { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  };

  const { icon: Icon, color, bg } = typeConfig[win.type];

  return (
    <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{win.customerName}</p>
        <p className="text-sm text-gray-400">{win.description}</p>
        {win.value && win.previousValue && (
          <p className="text-xs text-green-400 mt-1">
            {formatCurrency(win.previousValue)} -&gt; {formatCurrency(win.value)} (+{win.percentChange}%)
          </p>
        )}
      </div>
    </div>
  );
};

const RiskCard: React.FC<{ risk: KeyRisk }> = ({ risk }) => {
  const severityConfig = {
    high: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
    low: { color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
  };

  const { color, bg, border } = severityConfig[risk.severity];

  return (
    <div className={`p-3 bg-black/20 rounded-lg border ${border}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${bg.replace('/20', '')}`} />
          <span className="text-sm font-medium text-white">{risk.customerName}</span>
        </div>
        <span className={`text-xs font-medium ${color}`}>
          {formatCurrency(risk.arrAtRisk)} at risk
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-2">{risk.description}</p>
      {risk.action && (
        <p className="text-xs text-blue-400">Action: {risk.action}</p>
      )}
      {risk.daysToRenewal && (
        <p className="text-xs text-gray-500 mt-1">
          <Clock className="w-3 h-3 inline mr-1" />
          {risk.daysToRenewal} days to renewal
        </p>
      )}
    </div>
  );
};

const RecommendationCard: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
  const priorityConfig = {
    high: { color: 'text-red-400', bg: 'bg-red-500/20' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    low: { color: 'text-gray-400', bg: 'bg-gray-500/20' },
  };

  const { color, bg } = priorityConfig[recommendation.priority];

  return (
    <div className="p-4 bg-black/20 rounded-lg border border-gray-700/50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-white">{recommendation.title}</span>
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full ${color} ${bg}`}>
          {recommendation.priority}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-2">{recommendation.description}</p>
      {recommendation.expectedImpact && (
        <p className="text-xs text-green-400">
          <ArrowUpRight className="w-3 h-3 inline mr-1" />
          {recommendation.expectedImpact}
        </p>
      )}
    </div>
  );
};

const MiniTrendChart: React.FC<{ dataPoints: TrendDataPoint[]; color: string }> = ({ dataPoints, color }) => {
  const maxValue = Math.max(...dataPoints.map(d => d.value));
  const minValue = Math.min(...dataPoints.map(d => d.value));
  const range = maxValue - minValue || 1;

  const points = dataPoints
    .map((d, i) => {
      const x = (i / (dataPoints.length - 1)) * 100;
      const y = 100 - ((d.value - minValue) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ============================================
// Main Component
// ============================================

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  initialPeriod = 'quarter',
  onSchedule,
  onDownloadPdf,
}) => {
  const [report, setReport] = useState<ExecutiveSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>(initialPeriod);
  const [showAllWins, setShowAllWins] = useState(false);
  const [showAllRisks, setShowAllRisks] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchExecutiveSummary(period);
      if (data) {
        setReport(data);
      } else {
        setError('Failed to load executive summary');
      }
    } catch (err) {
      setError('An error occurred while loading the report');
      console.error('[ExecutiveSummary] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Unable to Load Report</h3>
        <p className="text-gray-400 mb-4">{error || 'An unexpected error occurred'}</p>
        <button
          onClick={loadReport}
          className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const displayedWins = showAllWins ? report.topWins : report.topWins.slice(0, 3);
  const displayedRisks = showAllRisks ? report.keyRisks : report.keyRisks.slice(0, 3);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Executive Summary</h1>
          <p className="text-gray-400 mt-1">{report.periodLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center bg-cscx-gray-800 rounded-lg p-1">
            {(['month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                  period === p
                    ? 'bg-cscx-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p === 'quarter' ? 'Q' : p[0].toUpperCase()}{p.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={loadReport}
            className="p-2 rounded-lg bg-cscx-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {onDownloadPdf && (
            <button
              onClick={() => onDownloadPdf(report.id)}
              className="flex items-center gap-2 px-4 py-2 bg-cscx-gray-800 text-gray-300 hover:text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}

          {onSchedule && (
            <button
              onClick={onSchedule}
              className="flex items-center gap-2 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          Key Metrics At-a-Glance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {report.keyMetrics.map((metric) => (
            <MetricCard key={metric.name} metric={metric} />
          ))}
        </div>
      </div>

      {/* Portfolio Summary */}
      <PortfolioCard portfolio={report.portfolio} />

      {/* Trends */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(report.trends).map(([key, trend]) => (
          <div key={key} className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{trend.metric}</span>
              <TrendIndicator trend={trend.trend} value={trend.changePercent} />
            </div>
            <MiniTrendChart
              dataPoints={trend.dataPoints}
              color={trend.trend === 'improving' ? '#4ade80' : trend.trend === 'declining' ? '#f87171' : '#9ca3af'}
            />
          </div>
        ))}
      </div>

      {/* Two Column Layout: Wins and Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Wins */}
        <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Top Wins
          </h3>
          <div className="space-y-3">
            {displayedWins.map((win) => (
              <WinCard key={win.id} win={win} />
            ))}
          </div>
          {report.topWins.length > 3 && (
            <button
              onClick={() => setShowAllWins(!showAllWins)}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {showAllWins ? (
                <>Show Less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Show All ({report.topWins.length}) <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>

        {/* Key Risks */}
        <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Key Risks
          </h3>
          <div className="space-y-3">
            {displayedRisks.map((risk) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </div>
          {report.keyRisks.length > 3 && (
            <button
              onClick={() => setShowAllRisks(!showAllRisks)}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {showAllRisks ? (
                <>Show Less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Show All ({report.keyRisks.length}) <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.recommendations.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-700/50">
        <span>
          Generated {new Date(report.generatedAt).toLocaleString()}
        </span>
        <span>
          {report.customerCount} customers | {report.healthyCount} healthy | {report.atRiskCount} at risk
        </span>
      </div>
    </div>
  );
};

export default ExecutiveSummary;
