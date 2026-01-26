/**
 * AI Analysis Component
 * Claude-powered analysis of Google Sheets data
 * Alternative to AppScript for data analysis
 */

import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface WorkspaceStatus {
  connected: boolean;
  email?: string;
  services: {
    sheets: boolean;
  };
}

interface AnalysisType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface AnalysisInsight {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

interface AnalysisAlert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedItems?: string[];
  recommendedAction?: string;
}

interface AnalysisResult {
  success: boolean;
  analysisType: string;
  summary: string;
  insights: AnalysisInsight[];
  recommendations: string[];
  alerts: AnalysisAlert[];
  metrics: Record<string, number | string>;
  generatedAt: string;
  dataPoints: number;
}

interface AIAnalysisProps {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
  onClose?: () => void;
  defaultAnalysisType?: string;
}

export const AIAnalysis: React.FC<AIAnalysisProps> = ({
  spreadsheetId: propSpreadsheetId,
  spreadsheetUrl: propSpreadsheetUrl,
  sheetName,
  onClose,
  defaultAnalysisType,
}) => {
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisType[]>([]);
  const [selectedType, setSelectedType] = useState<string>(defaultAnalysisType || '');
  const [spreadsheetInput, setSpreadsheetInput] = useState(propSpreadsheetUrl || '');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Check workspace connection status
  useEffect(() => {
    const checkWorkspaceStatus = async () => {
      try {
        const userId = localStorage.getItem('userId') || '';
        const response = await fetch(`${API_URL}/api/workspace-agent/status`, {
          headers: userId ? { 'x-user-id': userId } : {},
        });
        if (response.ok) {
          const status = await response.json();
          setWorkspaceStatus(status);
        }
      } catch (err) {
        console.error('Failed to check workspace status:', err);
      }
    };
    checkWorkspaceStatus();
  }, []);

  // Fetch analysis types on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/ai-analysis/types`);
        if (response.ok) {
          const data = await response.json();
          setAnalysisTypes(data.types || []);
          if (!selectedType && data.types?.length > 0) {
            setSelectedType(data.types[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch analysis types:', err);
        // Fallback types
        setAnalysisTypes([
          { id: 'health_score', name: 'Health Score Analysis', description: 'Analyze customer health', icon: '💚' },
          { id: 'renewal_risk', name: 'Renewal Risk', description: 'Identify at-risk renewals', icon: '📅' },
          { id: 'usage_trends', name: 'Usage Trends', description: 'Analyze usage patterns', icon: '📈' },
          { id: 'custom', name: 'Custom Analysis', description: 'Run custom analysis', icon: '🔮' },
        ]);
      }
    };
    fetchTypes();
  }, []);

  // Extract spreadsheet ID from URL
  const getSpreadsheetId = (): string | null => {
    if (propSpreadsheetId) return propSpreadsheetId;

    const match = spreadsheetInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleAnalyze = async () => {
    const spreadsheetId = getSpreadsheetId();

    if (!spreadsheetId) {
      setError('Please enter a valid Google Sheets URL');
      return;
    }

    if (!selectedType) {
      setError('Please select an analysis type');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Always use demo user ID for now to ensure Google connection works
      const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
      const userId = localStorage.getItem('userId') || DEMO_USER_ID;

      const requestBody = {
        spreadsheetId,
        sheetName,
        analysisType: selectedType,
        customPrompt: selectedType === 'custom' ? customPrompt : undefined,
        options: {
          includeRecommendations: true,
          includeAlerts: true,
          includeTrends: true,
        },
      };

      console.log('[AIAnalysis] Sending request:', {
        url: `${API_URL}/api/ai-analysis/analyze`,
        userId,
        spreadsheetId,
        analysisType: selectedType,
      });

      const response = await fetch(`${API_URL}/api/ai-analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[AIAnalysis] Response status:', response.status);

      const data = await response.json();
      console.log('[AIAnalysis] Response data:', data);

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || data.message || 'Analysis failed');
      }
    } catch (err) {
      console.error('[AIAnalysis] Error:', err);
      setError(`Failed to connect to analysis service: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-500/10';
      case 'warning': return 'border-yellow-500 bg-yellow-500/10';
      case 'info': return 'border-blue-500 bg-blue-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  // Generate CSV from analysis result
  const generateCSV = (data: AnalysisResult): string => {
    const lines: string[] = [];

    // Header info
    lines.push('CSCX.AI Analysis Report');
    lines.push(`Analysis Type,${data.analysisType}`);
    lines.push(`Generated,${new Date(data.generatedAt).toLocaleString()}`);
    lines.push(`Data Points,${data.dataPoints}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push(`"${data.summary.replace(/"/g, '""')}"`);
    lines.push('');

    // Insights
    if (data.insights.length > 0) {
      lines.push('INSIGHTS');
      lines.push('Title,Description,Impact,Category');
      data.insights.forEach(insight => {
        lines.push(`"${insight.title}","${insight.description.replace(/"/g, '""')}",${insight.impact},${insight.category}`);
      });
      lines.push('');
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS');
      data.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1},"${rec.replace(/"/g, '""')}"`);
      });
      lines.push('');
    }

    // Alerts
    if (data.alerts.length > 0) {
      lines.push('ALERTS');
      lines.push('Severity,Title,Description,Recommended Action');
      data.alerts.forEach(alert => {
        lines.push(`${alert.severity},"${alert.title}","${alert.description.replace(/"/g, '""')}","${alert.recommendedAction?.replace(/"/g, '""') || ''}"`);
      });
      lines.push('');
    }

    // Metrics
    if (Object.keys(data.metrics).length > 0) {
      lines.push('METRICS');
      lines.push('Metric,Value');
      Object.entries(data.metrics).forEach(([key, value]) => {
        lines.push(`"${key.replace(/_/g, ' ')}","${value}"`);
      });
    }

    return lines.join('\n');
  };

  // Download as CSV
  const downloadCSV = () => {
    if (!result) return;

    const csv = generateCSV(result);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis_${result.analysisType}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate HTML for PDF printing
  const generatePrintHTML = (data: AnalysisResult): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CSCX.AI Analysis Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; }
          h1 { color: #e63946; border-bottom: 2px solid #e63946; padding-bottom: 10px; }
          h2 { color: #1a1a2e; margin-top: 30px; }
          .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
          .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .insight, .alert, .rec { padding: 15px; margin: 10px 0; border-radius: 6px; }
          .insight { background: #f0f4ff; border-left: 4px solid #3b82f6; }
          .alert-critical { background: #fef2f2; border-left: 4px solid #ef4444; }
          .alert-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
          .alert-info { background: #eff6ff; border-left: 4px solid #3b82f6; }
          .rec { background: #f0fdf4; border-left: 4px solid #22c55e; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
          .metric { background: #f5f5f5; padding: 15px; border-radius: 6px; text-align: center; }
          .metric-value { font-size: 24px; font-weight: bold; color: #e63946; }
          .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
          .impact { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
          .impact-high { background: #fef2f2; color: #ef4444; }
          .impact-medium { background: #fffbeb; color: #f59e0b; }
          .impact-low { background: #f0fdf4; color: #22c55e; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>🤖 CSCX.AI Analysis Report</h1>
        <div class="meta">
          <strong>Analysis Type:</strong> ${data.analysisType.replace(/_/g, ' ').toUpperCase()} &nbsp;|&nbsp;
          <strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()} &nbsp;|&nbsp;
          <strong>Data Points:</strong> ${data.dataPoints} rows
        </div>

        <h2>📋 Summary</h2>
        <div class="summary">${data.summary}</div>

        ${data.alerts.length > 0 ? `
          <h2>🚨 Alerts</h2>
          ${data.alerts.map(alert => `
            <div class="alert alert-${alert.severity}">
              <strong>${alert.title}</strong>
              <p>${alert.description}</p>
              ${alert.recommendedAction ? `<p><em>→ ${alert.recommendedAction}</em></p>` : ''}
            </div>
          `).join('')}
        ` : ''}

        ${data.insights.length > 0 ? `
          <h2>💡 Key Insights</h2>
          ${data.insights.map(insight => `
            <div class="insight">
              <strong>${insight.title}</strong>
              <span class="impact impact-${insight.impact}">${insight.impact}</span>
              <p>${insight.description}</p>
            </div>
          `).join('')}
        ` : ''}

        ${data.recommendations.length > 0 ? `
          <h2>🎯 Recommendations</h2>
          ${data.recommendations.map((rec, i) => `
            <div class="rec"><strong>${i + 1}.</strong> ${rec}</div>
          `).join('')}
        ` : ''}

        ${Object.keys(data.metrics).length > 0 ? `
          <h2>📊 Key Metrics</h2>
          <div class="metrics">
            ${Object.entries(data.metrics).map(([key, value]) => `
              <div class="metric">
                <div class="metric-value">${value}</div>
                <div class="metric-label">${key.replace(/_/g, ' ')}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="footer">
          Generated by CSCX.AI - Powered by Claude AI<br>
          ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `;
  };

  // Print/Save as PDF
  const printToPDF = () => {
    if (!result) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the report');
      return;
    }

    printWindow.document.write(generatePrintHTML(result));
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Save to Google Drive
  const saveToDrive = async () => {
    if (!result) return;

    setIsSaving(true);
    setSaveSuccess(null);

    try {
      const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
      const userId = localStorage.getItem('userId') || DEMO_USER_ID;

      // Create a Google Doc with the analysis
      const response = await fetch(`${API_URL}/api/google/drive/create-doc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          title: `CSCX Analysis - ${result.analysisType.replace(/_/g, ' ')} - ${new Date().toLocaleDateString()}`,
          content: generatePrintHTML(result),
          mimeType: 'text/html',
        }),
      });

      const data = await response.json();

      if (data.success && data.webViewLink) {
        setSaveSuccess(data.webViewLink);
      } else {
        throw new Error(data.error || 'Failed to save to Drive');
      }
    } catch (err) {
      console.error('Save to Drive error:', err);
      setError(`Failed to save to Drive: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-cscx-gray-900 rounded-lg border border-cscx-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="font-semibold text-white">AI Analysis</h3>
            <p className="text-xs text-cscx-gray-400">Claude-powered data analysis</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-cscx-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Input Section */}
      {!result && (
        <div className="p-4 space-y-4">
          {/* Warning if Google Sheets not connected */}
          {workspaceStatus && !workspaceStatus.services?.sheets && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm font-medium">⚠️ Google Sheets not connected</p>
              <p className="text-yellow-300/70 text-xs mt-1">
                Please reconnect your Google account with Sheets permission to analyze spreadsheets.
                Go to the sidebar and click "Connect Google" to authorize.
              </p>
            </div>
          )}

          {/* Spreadsheet URL Input */}
          {!propSpreadsheetId && (
            <div>
              <label className="block text-sm font-medium text-cscx-gray-300 mb-1">
                Google Sheet URL
              </label>
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
              />
            </div>
          )}

          {/* Analysis Type Selection */}
          <div>
            <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
              Analysis Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {analysisTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedType === type.id
                      ? 'border-cscx-accent bg-cscx-accent/10'
                      : 'border-cscx-gray-600 bg-cscx-gray-800 hover:border-cscx-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{type.icon}</span>
                    <span className="font-medium text-white text-sm">{type.name}</span>
                  </div>
                  <p className="text-xs text-cscx-gray-400">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt (for custom analysis) */}
          {selectedType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-cscx-gray-300 mb-1">
                Custom Analysis Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you want to analyze..."
                rows={3}
                className="w-full px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-600 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || (!propSpreadsheetId && !spreadsheetInput)}
            className="w-full py-3 bg-cscx-accent hover:bg-cscx-accent/90 disabled:bg-cscx-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Analyzing...
              </>
            ) : (
              <>
                <span>✨</span>
                Run AI Analysis
              </>
            )}
          </button>

          <p className="text-xs text-cscx-gray-500 text-center">
            Powered by Claude AI - analyzes your data without requiring AppScript
          </p>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {/* Summary */}
          <div className="p-4 bg-cscx-gray-800 rounded-lg">
            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
              <span>📋</span> Summary
            </h4>
            <p className="text-cscx-gray-300 text-sm">{result.summary}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-cscx-gray-500">
              <span>Analyzed {result.dataPoints} rows</span>
              <span>Generated {new Date(result.generatedAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Alerts */}
          {result.alerts.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span>🚨</span> Alerts
              </h4>
              <div className="space-y-2">
                {result.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="font-medium text-white text-sm">{alert.title}</div>
                    <p className="text-cscx-gray-400 text-xs mt-1">{alert.description}</p>
                    {alert.recommendedAction && (
                      <p className="text-cscx-accent text-xs mt-2">
                        → {alert.recommendedAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {result.insights.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span>💡</span> Key Insights
              </h4>
              <div className="space-y-2">
                {result.insights.map((insight, i) => (
                  <div key={i} className="p-3 bg-cscx-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">{insight.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getImpactColor(insight.impact)}`}>
                        {insight.impact}
                      </span>
                    </div>
                    <p className="text-cscx-gray-400 text-xs">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span>🎯</span> Recommendations
              </h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-cscx-gray-300 flex items-start gap-2">
                    <span className="text-cscx-accent">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          {Object.keys(result.metrics).length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span>📊</span> Key Metrics
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.metrics).map(([key, value]) => (
                  <div key={key} className="p-2 bg-cscx-gray-800 rounded-lg">
                    <div className="text-xs text-cscx-gray-500">{key.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Success Message */}
          {saveSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm font-medium">✓ Saved to Google Drive</p>
              <a
                href={saveSuccess}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-300 text-xs underline hover:text-green-200"
              >
                Open in Drive →
              </a>
            </div>
          )}

          {/* Export Actions */}
          <div className="border-t border-cscx-gray-700 pt-4 mt-4">
            <p className="text-xs text-cscx-gray-500 mb-3">Export & Save</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={printToPDF}
                className="py-2 px-3 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span>📄</span> Print / PDF
              </button>
              <button
                onClick={downloadCSV}
                className="py-2 px-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span>📊</span> Download CSV
              </button>
              <button
                onClick={saveToDrive}
                disabled={isSaving}
                className="py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-wait text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin">⏳</span> Saving...
                  </>
                ) : (
                  <>
                    <span>☁️</span> Save to Drive
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                  alert('Copied to clipboard!');
                }}
                className="py-2 px-3 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span>📋</span> Copy JSON
              </button>
            </div>
          </div>

          {/* Run Another */}
          <button
            onClick={() => {
              setResult(null);
              setSaveSuccess(null);
            }}
            className="w-full py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-300 rounded-lg transition-colors text-sm border border-cscx-gray-600"
          >
            ← Run Another Analysis
          </button>
        </div>
      )}
    </div>
  );
};

// Quick analysis button for use in other components
export const AIAnalysisButton: React.FC<{
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  analysisType?: string;
  label?: string;
  className?: string;
}> = ({ spreadsheetId, spreadsheetUrl, analysisType, label = 'AI Analysis', className }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={className || "px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"}
      >
        <span>🤖</span>
        {label}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <AIAnalysis
              spreadsheetId={spreadsheetId}
              spreadsheetUrl={spreadsheetUrl}
              defaultAnalysisType={analysisType}
              onClose={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AIAnalysis;
