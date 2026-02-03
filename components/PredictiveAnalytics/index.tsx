/**
 * Predictive Analytics Report Component
 * PRD-176: ML-powered predictions for customer outcomes
 *
 * Features:
 * - Portfolio prediction summary (churn, expansion, health)
 * - High churn risk table with confidence scores
 * - Expansion opportunities with estimated values
 * - Key prediction factors and recommendations
 * - Model performance metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// TYPES
// ============================================

type PredictionType = 'churn' | 'expansion' | 'health' | 'behavior';
type FactorDirection = 'positive' | 'negative';
type ConfidenceLevel = 'high' | 'medium' | 'low';

interface PredictionFactor {
  factor: string;
  impact: number;
  direction: FactorDirection;
  description?: string;
}

interface PredictionOutcome {
  predicted_value: number;
  confidence: number;
  range: {
    low: number;
    high: number;
  };
}

interface Prediction {
  id: string;
  customer_id: string;
  customer_name?: string;
  prediction_type: PredictionType;
  prediction_date: string;
  horizon_days: number;
  outcome: PredictionOutcome;
  factors: PredictionFactor[];
  recommendations: string[];
  arr?: number;
  segment?: string;
  health_color?: string;
  created_at: string;
}

interface PortfolioPredictions {
  expected_churn: {
    accounts: { low: number; high: number };
    arr: { low: number; high: number };
    confidence: number;
  };
  expected_expansion: {
    accounts: { low: number; high: number };
    arr: { low: number; high: number };
    confidence: number;
  };
  expected_health_change: {
    avg_change: number;
    direction: 'improving' | 'stable' | 'declining';
    confidence: number;
  };
}

interface ModelPerformance {
  model_type: PredictionType;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc?: number;
  last_trained: string;
  training_samples: number;
  validation_samples: number;
}

interface PredictiveAnalyticsReport {
  generated_at: string;
  horizon_days: number;
  portfolio_predictions: PortfolioPredictions;
  high_risk: Prediction[];
  high_opportunity: Prediction[];
  health_forecasts: Prediction[];
  model_performance: ModelPerformance[];
  total_customers: number;
}

interface PredictiveAnalyticsReportProps {
  customerId?: string;
  onSelectCustomer?: (customerId: string, customerName?: string) => void;
  onBack?: () => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/reports/predictive-analytics`;

// ============================================
// COMPONENT
// ============================================

export const PredictiveAnalyticsReport: React.FC<PredictiveAnalyticsReportProps> = ({
  customerId,
  onSelectCustomer,
  onBack,
}) => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(90);
  const [activeTab, setActiveTab] = useState<'risk' | 'opportunity' | 'performance'>('risk');

  // Portfolio report state
  const [report, setReport] = useState<PredictiveAnalyticsReport | null>(null);

  // Customer detail state
  const [customerPredictions, setCustomerPredictions] = useState<{
    churn: Prediction | null;
    expansion: Prediction | null;
    health: Prediction | null;
  } | null>(null);

  // Fetch portfolio report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}?horizon_days=${horizonDays}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch predictive analytics');
      }

      const result = await response.json();
      if (result.success) {
        setReport(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  }, [horizonDays, getAuthHeaders]);

  // Fetch customer predictions
  const fetchCustomerPredictions = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/customers/${id}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customer predictions');
      }

      const result = await response.json();
      if (result.success) {
        setCustomerPredictions(result.data.predictions);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer predictions');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerPredictions(customerId);
    } else {
      fetchReport();
    }
  }, [customerId, fetchReport, fetchCustomerPredictions]);

  // Helper functions
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getConfidenceLevel = (confidence: number): ConfidenceLevel => {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  };

  const getConfidenceColor = (confidence: number) => {
    const level = getConfidenceLevel(confidence);
    switch (level) {
      case 'high':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-orange-400';
    }
  };

  const getProbabilityColor = (value: number, type: 'risk' | 'opportunity') => {
    if (type === 'risk') {
      if (value >= 70) return 'text-red-400';
      if (value >= 50) return 'text-orange-400';
      return 'text-yellow-400';
    } else {
      if (value >= 70) return 'text-green-400';
      if (value >= 50) return 'text-blue-400';
      return 'text-gray-400';
    }
  };

  const getHealthColorBg = (color: string | undefined) => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-cscx-gray-400">Loading predictive analytics...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
        <button
          onClick={() => customerId ? fetchCustomerPredictions(customerId) : fetchReport()}
          className="mt-4 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Customer Detail View
  if (customerId && customerPredictions) {
    const { churn, expansion, health } = customerPredictions;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <button
              onClick={onBack}
              className="text-cscx-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              &#8592; Back to Portfolio
            </button>
            <h2 className="text-xl font-bold text-white">
              Predictions: {churn?.customer_name || 'Customer'}
            </h2>
          </div>
        </div>

        {/* Churn Prediction */}
        {churn && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Churn Risk (90-Day)</h3>
              <span className={`text-sm ${getConfidenceColor(churn.outcome.confidence)}`}>
                {getConfidenceLevel(churn.outcome.confidence).toUpperCase()} confidence
              </span>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div>
                <span className={`text-5xl font-bold ${getProbabilityColor(churn.outcome.predicted_value, 'risk')}`}>
                  {churn.outcome.predicted_value}%
                </span>
                <p className="text-cscx-gray-500 text-sm mt-1">
                  Range: {churn.outcome.range.low}% - {churn.outcome.range.high}%
                </p>
              </div>
              <div className="flex-1 h-4 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${churn.outcome.predicted_value >= 70 ? 'bg-red-500' : churn.outcome.predicted_value >= 50 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                  style={{ width: `${churn.outcome.predicted_value}%` }}
                />
              </div>
            </div>

            {/* Factors */}
            {churn.factors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Key Factors</h4>
                <div className="space-y-2">
                  {churn.factors.map((factor, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded">
                      <span className={`text-lg ${factor.direction === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
                        {factor.direction === 'positive' ? '+' : '-'}
                      </span>
                      <div>
                        <p className="text-white text-sm">{factor.factor}</p>
                        {factor.description && (
                          <p className="text-cscx-gray-500 text-xs">{factor.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {churn.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {churn.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-cscx-gray-300 text-sm flex items-start gap-2">
                      <span className="text-cscx-accent">&#8226;</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Expansion Prediction */}
        {expansion && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Expansion Opportunity (90-Day)</h3>
              <span className={`text-sm ${getConfidenceColor(expansion.outcome.confidence)}`}>
                {getConfidenceLevel(expansion.outcome.confidence).toUpperCase()} confidence
              </span>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div>
                <span className={`text-5xl font-bold ${getProbabilityColor(expansion.outcome.predicted_value, 'opportunity')}`}>
                  {expansion.outcome.predicted_value}%
                </span>
                <p className="text-cscx-gray-500 text-sm mt-1">
                  Range: {expansion.outcome.range.low}% - {expansion.outcome.range.high}%
                </p>
              </div>
              <div className="flex-1 h-4 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${expansion.outcome.predicted_value >= 70 ? 'bg-green-500' : expansion.outcome.predicted_value >= 50 ? 'bg-blue-500' : 'bg-gray-500'}`}
                  style={{ width: `${expansion.outcome.predicted_value}%` }}
                />
              </div>
            </div>

            {/* Factors */}
            {expansion.factors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Key Indicators</h4>
                <div className="space-y-2">
                  {expansion.factors.map((factor, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded">
                      <span className="text-lg text-green-400">+</span>
                      <div>
                        <p className="text-white text-sm">{factor.factor}</p>
                        {factor.description && (
                          <p className="text-cscx-gray-500 text-xs">{factor.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {expansion.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-cscx-gray-400 mb-2">Next Steps</h4>
                <ul className="space-y-1">
                  {expansion.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-cscx-gray-300 text-sm flex items-start gap-2">
                      <span className="text-green-400">&#8226;</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Health Forecast */}
        {health && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Health Score Forecast (30-Day)</h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-cscx-gray-400 text-sm">Predicted Score</p>
                <span className="text-3xl font-bold text-white">{health.outcome.predicted_value}</span>
              </div>
              <div className="text-cscx-gray-500">&#8594;</div>
              <div className="text-center">
                <p className="text-cscx-gray-400 text-sm">Range</p>
                <span className="text-lg text-cscx-gray-300">
                  {health.outcome.range.low} - {health.outcome.range.high}
                </span>
              </div>
              <div className="ml-auto">
                <span className={`text-sm ${getConfidenceColor(health.outcome.confidence)}`}>
                  {Math.round(health.outcome.confidence)}% confidence
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Portfolio View
  if (!report) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        No prediction data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Predictive Analytics Report</h2>
          <p className="text-cscx-gray-400 text-sm">
            ML-powered predictions for your portfolio ({report.total_customers} customers)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(parseInt(e.target.value) as 30 | 60 | 90)}
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm"
          >
            <option value={30}>30-Day Horizon</option>
            <option value={60}>60-Day Horizon</option>
            <option value={90}>90-Day Horizon</option>
          </select>
        </div>
      </div>

      {/* Portfolio Predictions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expected Churn */}
        <div className="bg-cscx-gray-900 border border-red-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider">Expected Churn</h3>
            <span className="text-xs text-cscx-gray-500">
              {report.portfolio_predictions.expected_churn.confidence}% conf
            </span>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-2xl font-bold text-white">
                {report.portfolio_predictions.expected_churn.accounts.low}-{report.portfolio_predictions.expected_churn.accounts.high}
              </span>
              <span className="text-cscx-gray-400 ml-2">accounts</span>
            </div>
            <div>
              <span className="text-lg text-red-400">
                {formatCurrency(report.portfolio_predictions.expected_churn.arr.low)}-{formatCurrency(report.portfolio_predictions.expected_churn.arr.high)}
              </span>
              <span className="text-cscx-gray-500 ml-2">ARR at risk</span>
            </div>
          </div>
        </div>

        {/* Expected Expansion */}
        <div className="bg-cscx-gray-900 border border-green-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-green-400 uppercase tracking-wider">Expected Expansion</h3>
            <span className="text-xs text-cscx-gray-500">
              {report.portfolio_predictions.expected_expansion.confidence}% conf
            </span>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-2xl font-bold text-white">
                {report.portfolio_predictions.expected_expansion.accounts.low}-{report.portfolio_predictions.expected_expansion.accounts.high}
              </span>
              <span className="text-cscx-gray-400 ml-2">opportunities</span>
            </div>
            <div>
              <span className="text-lg text-green-400">
                {formatCurrency(report.portfolio_predictions.expected_expansion.arr.low)}-{formatCurrency(report.portfolio_predictions.expected_expansion.arr.high)}
              </span>
              <span className="text-cscx-gray-500 ml-2">potential ARR</span>
            </div>
          </div>
        </div>

        {/* Health Change */}
        <div className="bg-cscx-gray-900 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider">Health Forecast</h3>
            <span className="text-xs text-cscx-gray-500">
              {report.portfolio_predictions.expected_health_change.confidence}% conf
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${
                report.portfolio_predictions.expected_health_change.avg_change > 0 ? 'text-green-400' :
                report.portfolio_predictions.expected_health_change.avg_change < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {report.portfolio_predictions.expected_health_change.avg_change > 0 ? '+' : ''}
                {report.portfolio_predictions.expected_health_change.avg_change}
              </span>
              <span className="text-cscx-gray-400">avg pts</span>
            </div>
            <div>
              <span className={`text-sm px-2 py-1 rounded ${
                report.portfolio_predictions.expected_health_change.direction === 'improving'
                  ? 'bg-green-500/20 text-green-400'
                  : report.portfolio_predictions.expected_health_change.direction === 'declining'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {report.portfolio_predictions.expected_health_change.direction}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cscx-gray-800">
        <button
          onClick={() => setActiveTab('risk')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'risk'
              ? 'border-red-500 text-red-400'
              : 'border-transparent text-cscx-gray-400 hover:text-white'
          }`}
        >
          High Churn Risk ({report.high_risk.length})
        </button>
        <button
          onClick={() => setActiveTab('opportunity')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'opportunity'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-cscx-gray-400 hover:text-white'
          }`}
        >
          Expansion Opportunities ({report.high_opportunity.length})
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'performance'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-cscx-gray-400 hover:text-white'
          }`}
        >
          Model Performance
        </button>
      </div>

      {/* High Risk Table */}
      {activeTab === 'risk' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          {report.high_risk.length === 0 ? (
            <div className="p-8 text-center text-cscx-gray-400">
              No high-risk customers identified
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cscx-gray-800 bg-cscx-gray-800/50">
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Churn Prob</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Confidence</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">ARR at Risk</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Key Factors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cscx-gray-800">
                  {report.high_risk.map((prediction) => (
                    <tr
                      key={prediction.id}
                      className="hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => onSelectCustomer?.(prediction.customer_id, prediction.customer_name)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getHealthColorBg(prediction.health_color)}`} />
                          <span className="text-white font-medium">{prediction.customer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getProbabilityColor(prediction.outcome.predicted_value, 'risk')}`}>
                          {prediction.outcome.predicted_value}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getConfidenceColor(prediction.outcome.confidence)}>
                          {getConfidenceLevel(prediction.outcome.confidence)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-red-400">
                        {prediction.arr ? formatCurrency(prediction.arr) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {prediction.factors.slice(0, 2).map((factor, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 text-xs rounded ${
                                factor.direction === 'negative'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-green-500/20 text-green-400'
                              }`}
                            >
                              {factor.factor}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Expansion Opportunities Table */}
      {activeTab === 'opportunity' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          {report.high_opportunity.length === 0 ? (
            <div className="p-8 text-center text-cscx-gray-400">
              No high-probability expansion opportunities identified
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cscx-gray-800 bg-cscx-gray-800/50">
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Expansion Prob</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Confidence</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Current ARR</th>
                    <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Indicators</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cscx-gray-800">
                  {report.high_opportunity.map((prediction) => (
                    <tr
                      key={prediction.id}
                      className="hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => onSelectCustomer?.(prediction.customer_id, prediction.customer_name)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getHealthColorBg(prediction.health_color)}`} />
                          <span className="text-white font-medium">{prediction.customer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getProbabilityColor(prediction.outcome.predicted_value, 'opportunity')}`}>
                          {prediction.outcome.predicted_value}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getConfidenceColor(prediction.outcome.confidence)}>
                          {getConfidenceLevel(prediction.outcome.confidence)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cscx-gray-300">
                        {prediction.arr ? formatCurrency(prediction.arr) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {prediction.factors.slice(0, 2).map((factor, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400"
                            >
                              {factor.factor}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Model Performance */}
      {activeTab === 'performance' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Model Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.model_performance.map((model) => (
              <div key={model.model_type} className="p-4 bg-cscx-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium capitalize">{model.model_type} Model</h4>
                  <span className="text-xs text-cscx-gray-500">
                    Trained {formatDate(model.last_trained)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-cscx-gray-400 text-xs">Accuracy</p>
                    <p className="text-xl font-bold text-white">{model.accuracy}%</p>
                  </div>
                  <div>
                    <p className="text-cscx-gray-400 text-xs">Precision</p>
                    <p className="text-xl font-bold text-white">{(model.precision * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-cscx-gray-400 text-xs">Recall</p>
                    <p className="text-xl font-bold text-white">{(model.recall * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-cscx-gray-400 text-xs">F1 Score</p>
                    <p className="text-xl font-bold text-white">{(model.f1_score * 100).toFixed(0)}%</p>
                  </div>
                </div>
                {model.auc_roc && (
                  <div className="mt-3 pt-3 border-t border-cscx-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-cscx-gray-400">AUC-ROC</span>
                      <span className="text-white">{(model.auc_roc * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-cscx-gray-500">
                  {model.training_samples.toLocaleString()} training samples
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated timestamp */}
      <div className="text-center text-cscx-gray-500 text-xs">
        Report generated: {formatDate(report.generated_at)}
      </div>
    </div>
  );
};

export default PredictiveAnalyticsReport;
