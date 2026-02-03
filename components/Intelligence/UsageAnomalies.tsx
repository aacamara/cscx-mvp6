/**
 * Usage Anomalies Component
 * PRD-084: Usage Anomaly Detection
 *
 * Displays detected usage anomalies for a customer including:
 * - Drops (potential churn signals)
 * - Spikes (potential expansion opportunities)
 * - Feature abandonment patterns
 * - Pattern changes
 *
 * Can be embedded in CustomerDetail or used standalone in portfolio view.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  X,
  ChevronRight,
  BarChart3,
  Users,
  Zap,
  Clock,
  MessageSquare,
  Phone,
  Eye,
  EyeOff,
} from 'lucide-react';

// ============================================
// Types
// ============================================

type AnomalyType = 'drop' | 'spike' | 'pattern_change' | 'feature_abandonment';
type AnomalySeverity = 'critical' | 'warning' | 'info';
type MetricType = 'dau' | 'wau' | 'mau' | 'total_events' | 'api_calls' | 'feature_usage' | 'session_duration';

interface UsageAnomaly {
  id: string;
  customerId: string;
  customerName?: string;
  metricType: MetricType;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  baselineValue: number;
  actualValue: number;
  deviationPercent: number;
  zScore?: number;
  detectedAt: string;
  dismissedAt?: string;
  dismissedBy?: string;
  affectedFeature?: string;
  possibleCause?: string;
  duration?: number;
}

interface PortfolioSummary {
  accounts: Array<{
    customerId: string;
    customerName: string;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    primaryAnomaly?: UsageAnomaly;
  }>;
  totals: {
    critical: number;
    warning: number;
    info: number;
  };
}

interface UsageAnomaliesProps {
  customerId?: string; // If provided, shows single customer view
  showPortfolio?: boolean; // If true, shows portfolio overview
  compact?: boolean; // Compact view for sidebar/widget
  onInvestigate?: (customerId: string, anomalyId: string) => void;
  onContactCustomer?: (customerId: string) => void;
}

// ============================================
// Configuration
// ============================================

const ANOMALY_TYPE_CONFIG: Record<AnomalyType, { icon: typeof TrendingDown; color: string; label: string; bgColor: string }> = {
  drop: { icon: TrendingDown, color: 'text-red-400', label: 'Usage Drop', bgColor: 'bg-red-500/20' },
  spike: { icon: TrendingUp, color: 'text-green-400', label: 'Usage Spike', bgColor: 'bg-green-500/20' },
  pattern_change: { icon: Activity, color: 'text-yellow-400', label: 'Pattern Change', bgColor: 'bg-yellow-500/20' },
  feature_abandonment: { icon: Zap, color: 'text-purple-400', label: 'Feature Abandonment', bgColor: 'bg-purple-500/20' },
};

const SEVERITY_CONFIG: Record<AnomalySeverity, { icon: typeof AlertTriangle; color: string; bgColor: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Critical' },
  warning: { icon: AlertCircle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Info' },
};

const METRIC_LABELS: Record<MetricType, string> = {
  dau: 'Daily Active Users',
  wau: 'Weekly Active Users',
  mau: 'Monthly Active Users',
  total_events: 'Total Events',
  api_calls: 'API Calls',
  feature_usage: 'Feature Usage',
  session_duration: 'Session Duration',
};

// ============================================
// API
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchAnomalies(customerId: string, includeDismissed: boolean = false): Promise<UsageAnomaly[]> {
  const response = await fetch(
    `${API_BASE}/intelligence/anomalies/${customerId}?includeDismissed=${includeDismissed}`
  );
  const data = await response.json();
  return data.success ? data.data.anomalies : [];
}

async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_BASE}/intelligence/anomalies/portfolio`);
  const data = await response.json();
  return data.success ? data.data : { accounts: [], totals: { critical: 0, warning: 0, info: 0 } };
}

async function dismissAnomaly(anomalyId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/intelligence/anomalies/${anomalyId}/dismiss`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  return data.success;
}

async function triggerScan(customerId?: string): Promise<void> {
  await fetch(`${API_BASE}/intelligence/anomalies/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerId ? { customerId } : {}),
  });
}

// ============================================
// Anomaly Card Component
// ============================================

interface AnomalyCardProps {
  anomaly: UsageAnomaly;
  onDismiss?: (id: string) => void;
  onInvestigate?: () => void;
  onContactCustomer?: () => void;
  showCustomerName?: boolean;
}

const AnomalyCard: React.FC<AnomalyCardProps> = ({
  anomaly,
  onDismiss,
  onInvestigate,
  onContactCustomer,
  showCustomerName = false,
}) => {
  const [dismissing, setDismissing] = useState(false);
  const typeConfig = ANOMALY_TYPE_CONFIG[anomaly.anomalyType];
  const severityConfig = SEVERITY_CONFIG[anomaly.severity];
  const TypeIcon = typeConfig.icon;
  const SeverityIcon = severityConfig.icon;

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setDismissing(true);
    await onDismiss(anomaly.id);
    setDismissing(false);
  };

  const formatValue = (value: number, metricType: MetricType) => {
    if (metricType === 'session_duration') {
      return `${Math.round(value)}min`;
    }
    return value.toLocaleString();
  };

  const getDaysAgo = (dateStr: string) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className={`bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors ${anomaly.dismissedAt ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${typeConfig.bgColor} ${typeConfig.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-white">{typeConfig.label}</h4>
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${severityConfig.bgColor} ${severityConfig.color}`}>
                <SeverityIcon className="w-3 h-3" />
                {severityConfig.label}
              </span>
            </div>
            {onDismiss && !anomaly.dismissedAt && (
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                title="Dismiss"
              >
                {dismissing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Customer name (portfolio view) */}
          {showCustomerName && anomaly.customerName && (
            <p className="text-sm text-gray-300 font-medium mb-1">{anomaly.customerName}</p>
          )}

          {/* Metric info */}
          <div className="flex items-center gap-4 text-sm mb-2">
            <span className="text-gray-400">{METRIC_LABELS[anomaly.metricType]}</span>
            <span className={`font-semibold ${anomaly.deviationPercent < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {anomaly.deviationPercent > 0 ? '+' : ''}{anomaly.deviationPercent.toFixed(1)}%
            </span>
          </div>

          {/* Values */}
          <div className="flex items-center gap-2 text-sm mb-2">
            <span className="text-gray-500">
              Baseline: {formatValue(anomaly.baselineValue, anomaly.metricType)}/day
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <span className="text-white font-medium">
              Actual: {formatValue(anomaly.actualValue, anomaly.metricType)}/day
            </span>
          </div>

          {/* Affected feature (for feature abandonment) */}
          {anomaly.affectedFeature && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Zap className="w-3 h-3" />
              <span>Feature: <span className="text-white">{anomaly.affectedFeature}</span></span>
            </div>
          )}

          {/* Possible cause */}
          {anomaly.possibleCause && (
            <p className="text-xs text-gray-400 italic mb-2">
              Possible cause: {anomaly.possibleCause}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{getDaysAgo(anomaly.detectedAt)}</span>
              {anomaly.duration && anomaly.duration > 1 && (
                <span className="text-yellow-400">({anomaly.duration} days)</span>
              )}
            </div>

            {/* Actions */}
            {(onInvestigate || onContactCustomer) && !anomaly.dismissedAt && (
              <div className="flex items-center gap-2">
                {onInvestigate && (
                  <button
                    onClick={onInvestigate}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Investigate
                  </button>
                )}
                {onContactCustomer && (
                  <button
                    onClick={onContactCustomer}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Contact
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Portfolio Summary Card
// ============================================

interface PortfolioAccountCardProps {
  account: PortfolioSummary['accounts'][0];
  onClick?: () => void;
}

const PortfolioAccountCard: React.FC<PortfolioAccountCardProps> = ({ account, onClick }) => {
  const totalAnomalies = account.criticalCount + account.warningCount + account.infoCount;
  const primaryAnomaly = account.primaryAnomaly;
  const primaryConfig = primaryAnomaly ? ANOMALY_TYPE_CONFIG[primaryAnomaly.anomalyType] : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-white">{account.customerName}</h4>
        <div className="flex items-center gap-1">
          {account.criticalCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
              {account.criticalCount}
            </span>
          )}
          {account.warningCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
              {account.warningCount}
            </span>
          )}
          {account.infoCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
              {account.infoCount}
            </span>
          )}
        </div>
      </div>

      {primaryAnomaly && primaryConfig && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <primaryConfig.icon className={`w-4 h-4 ${primaryConfig.color}`} />
          <span>{primaryConfig.label}</span>
          <span className={primaryAnomaly.deviationPercent < 0 ? 'text-red-400' : 'text-green-400'}>
            {primaryAnomaly.deviationPercent > 0 ? '+' : ''}{primaryAnomaly.deviationPercent.toFixed(0)}%
          </span>
        </div>
      )}
    </button>
  );
};

// ============================================
// Main Component
// ============================================

export const UsageAnomalies: React.FC<UsageAnomaliesProps> = ({
  customerId,
  showPortfolio = false,
  compact = false,
  onInvestigate,
  onContactCustomer,
}) => {
  const [anomalies, setAnomalies] = useState<UsageAnomaly[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (showPortfolio) {
        const summary = await fetchPortfolioSummary();
        setPortfolioSummary(summary);
      } else if (customerId) {
        const data = await fetchAnomalies(customerId, showDismissed);
        setAnomalies(data);
      }
    } catch (err) {
      setError('Failed to load anomaly data');
      console.error('[UsageAnomalies] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId, showPortfolio, showDismissed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await triggerScan(customerId);
      await loadData();
    } catch (err) {
      console.error('[UsageAnomalies] Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleDismiss = async (anomalyId: string) => {
    const success = await dismissAnomaly(anomalyId);
    if (success) {
      setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
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

  // Portfolio View
  if (showPortfolio && portfolioSummary) {
    const { accounts, totals } = portfolioSummary;
    const totalAnomalies = totals.critical + totals.warning + totals.info;

    if (compact) {
      return (
        <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">Usage Anomalies</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
              {totalAnomalies} detected
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">{totals.critical}</div>
              <div className="text-xs text-gray-500">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">{totals.warning}</div>
              <div className="text-xs text-gray-500">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">{totals.info}</div>
              <div className="text-xs text-gray-500">Info</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-400" />
              Usage Anomalies
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {totalAnomalies} anomalies across {accounts.length} accounts
            </p>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan All'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Critical</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{totals.critical}</div>
            <p className="text-xs text-gray-400 mt-1">Require immediate attention</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Warning</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{totals.warning}</div>
            <p className="text-xs text-gray-400 mt-1">Monitor closely</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Info className="w-5 h-5" />
              <span className="text-sm font-medium">Info</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{totals.info}</div>
            <p className="text-xs text-gray-400 mt-1">Informational signals</p>
          </div>
        </div>

        {/* Account List */}
        {accounts.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Affected Accounts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accounts.map((account) => (
                <PortfolioAccountCard
                  key={account.customerId}
                  account={account}
                  onClick={() => onInvestigate?.(account.customerId, account.primaryAnomaly?.id || '')}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-cscx-gray-800 rounded-lg border border-gray-700/50">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Anomalies Detected</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              All accounts are showing normal usage patterns. Anomalies are automatically
              detected based on statistical analysis of usage data.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Customer View
  const activeAnomalies = anomalies.filter(a => !a.dismissedAt);
  const hasAnomalies = activeAnomalies.length > 0;

  // Compact view for sidebar/widget
  if (compact) {
    if (!hasAnomalies) return null;

    const criticalCount = activeAnomalies.filter(a => a.severity === 'critical').length;
    const warningCount = activeAnomalies.filter(a => a.severity === 'warning').length;

    return (
      <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-400' : 'text-yellow-400'}`} />
            <span className="text-sm font-medium text-white">Usage Anomalies</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${criticalCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {activeAnomalies.length} detected
          </span>
        </div>

        <div className="space-y-2">
          {criticalCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Critical</span>
              <span className="text-red-400 font-medium">{criticalCount}</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Warning</span>
              <span className="text-yellow-400 font-medium">{warningCount}</span>
            </div>
          )}
        </div>

        {activeAnomalies[0] && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Primary Concern</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white">{ANOMALY_TYPE_CONFIG[activeAnomalies[0].anomalyType].label}</span>
              <span className={activeAnomalies[0].deviationPercent < 0 ? 'text-red-400' : 'text-green-400'}>
                {activeAnomalies[0].deviationPercent > 0 ? '+' : ''}{activeAnomalies[0].deviationPercent.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full customer view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-400" />
            Usage Anomalies
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {hasAnomalies
              ? `${activeAnomalies.length} anomalies detected`
              : 'No anomalies detected'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${showDismissed ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {showDismissed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showDismissed ? 'Showing All' : 'Show Dismissed'}
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {hasAnomalies || (showDismissed && anomalies.length > 0) ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <AlertTriangle className="w-4 h-4" />
                Critical
              </div>
              <div className="text-2xl font-bold text-red-400">
                {activeAnomalies.filter(a => a.severity === 'critical').length}
              </div>
            </div>

            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <AlertCircle className="w-4 h-4" />
                Warning
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {activeAnomalies.filter(a => a.severity === 'warning').length}
              </div>
            </div>

            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <TrendingDown className="w-4 h-4" />
                Drops
              </div>
              <div className="text-2xl font-bold text-white">
                {activeAnomalies.filter(a => a.anomalyType === 'drop').length}
              </div>
            </div>

            <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <TrendingUp className="w-4 h-4" />
                Spikes
              </div>
              <div className="text-2xl font-bold text-white">
                {activeAnomalies.filter(a => a.anomalyType === 'spike').length}
              </div>
            </div>
          </div>

          {/* Anomaly List */}
          <div className="space-y-3">
            {(showDismissed ? anomalies : activeAnomalies).map((anomaly) => (
              <AnomalyCard
                key={anomaly.id}
                anomaly={anomaly}
                onDismiss={handleDismiss}
                onInvestigate={() => onInvestigate?.(customerId!, anomaly.id)}
                onContactCustomer={() => onContactCustomer?.(customerId!)}
              />
            ))}
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="text-center py-12 bg-cscx-gray-800 rounded-lg border border-gray-700/50">
          <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Usage Anomalies</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            This customer&apos;s usage is within normal patterns. Anomalies are automatically
            detected based on statistical analysis comparing current usage to historical baselines.
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 mx-auto"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            Run Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default UsageAnomalies;
