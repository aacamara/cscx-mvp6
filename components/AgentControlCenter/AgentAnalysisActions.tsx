/**
 * Agent Analysis Actions
 * Context-aware analysis options for each specialist agent
 */

import React, { useState, useEffect } from 'react';
import { CSAgentType } from '../../types/agents';
import { AIAnalysis } from '../AIAnalysis';

const API_URL = import.meta.env.VITE_API_URL || '';

interface CustomerSheet {
  id: string;
  name: string;
  link: string;
  type: 'sheet' | 'doc';
  modifiedTime?: string;
}

interface AgentAnalysisActionsProps {
  agentType: CSAgentType;
  customerId?: string;
  customerName?: string;
  onAnalysisComplete?: (result: any) => void;
}

// Analysis actions per agent type
const AGENT_ANALYSIS_CONFIG: Record<CSAgentType, {
  title: string;
  actions: { id: string; label: string; icon: string; analysisType: string; description: string }[];
}> = {
  adoption: {
    title: 'Adoption Analysis',
    actions: [
      { id: 'usage', label: 'Analyze Usage', icon: '📈', analysisType: 'usage_trends', description: 'Identify usage patterns and trends' },
      { id: 'adoption', label: 'Feature Adoption', icon: '🎯', analysisType: 'adoption_metrics', description: 'Track feature adoption rates' },
      { id: 'forecast', label: 'Generate Forecast', icon: '🔮', analysisType: 'custom', description: 'Predict future usage trends' },
    ]
  },
  renewal: {
    title: 'Renewal Analysis',
    actions: [
      { id: 'risk', label: 'Renewal Risk', icon: '⚠️', analysisType: 'renewal_risk', description: 'Identify at-risk renewals' },
      { id: 'forecast', label: 'Revenue Forecast', icon: '💰', analysisType: 'custom', description: 'Project renewal revenue' },
      { id: 'health', label: 'Health Check', icon: '💚', analysisType: 'health_score', description: 'Assess customer health' },
    ]
  },
  risk: {
    title: 'Risk Assessment',
    actions: [
      { id: 'churn', label: 'Churn Prediction', icon: '🚨', analysisType: 'churn_prediction', description: 'Identify churn signals' },
      { id: 'health', label: 'Health Analysis', icon: '💚', analysisType: 'health_score', description: 'Deep dive on health scores' },
      { id: 'usage', label: 'Usage Decline', icon: '📉', analysisType: 'usage_trends', description: 'Find declining accounts' },
    ]
  },
  strategic: {
    title: 'Strategic Analysis',
    actions: [
      { id: 'qbr', label: 'QBR Prep', icon: '📊', analysisType: 'qbr_prep', description: 'Generate QBR insights' },
      { id: 'digest', label: 'Weekly Digest', icon: '📋', analysisType: 'weekly_digest', description: 'Portfolio summary' },
      { id: 'nps', label: 'NPS Analysis', icon: '⭐', analysisType: 'nps_analysis', description: 'Analyze customer sentiment' },
    ]
  },
  onboarding: {
    title: 'Onboarding Analysis',
    actions: [
      { id: 'progress', label: 'Track Progress', icon: '📈', analysisType: 'adoption_metrics', description: 'Monitor onboarding progress' },
      { id: 'health', label: 'Health Check', icon: '💚', analysisType: 'health_score', description: 'Early health signals' },
      { id: 'custom', label: 'Custom Analysis', icon: '🔮', analysisType: 'custom', description: 'Run custom analysis' },
    ]
  }
};

export const AgentAnalysisActions: React.FC<AgentAnalysisActionsProps> = ({
  agentType,
  customerId,
  customerName,
  onAnalysisComplete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customerSheets, setCustomerSheets] = useState<CustomerSheet[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<CustomerSheet | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSheetPicker, setShowSheetPicker] = useState(false);

  const config = AGENT_ANALYSIS_CONFIG[agentType];

  // Fetch customer sheets when in customer context
  useEffect(() => {
    if (customerId && isExpanded && customerSheets.length === 0) {
      fetchCustomerSheets();
    }
  }, [customerId, isExpanded]);

  const fetchCustomerSheets = async () => {
    setIsLoadingSheets(true);
    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(
        `${API_URL}/api/workspace/drive/files?customerId=${customerId}&type=spreadsheet`,
        { headers: userId ? { 'x-user-id': userId } : {} }
      );

      if (response.ok) {
        const data = await response.json();
        setCustomerSheets(data.files?.map((f: any) => ({
          id: f.id,
          name: f.name,
          link: f.webViewLink || f.link,
          type: 'sheet',
          modifiedTime: f.modifiedTime
        })) || []);
      }
    } catch (err) {
      console.error('Failed to fetch customer sheets:', err);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleActionClick = (actionId: string) => {
    setSelectedAction(actionId);

    if (customerId && customerSheets.length > 0) {
      // In customer context with sheets - show sheet picker
      setShowSheetPicker(true);
    } else if (customerId) {
      // In customer context but no sheets found
      setShowSheetPicker(true);
      fetchCustomerSheets();
    } else {
      // General mode - show sheet picker with Drive search option
      setShowSheetPicker(true);
    }
  };

  const handleSheetSelect = (sheet: CustomerSheet) => {
    setSelectedSheet(sheet);
    setShowSheetPicker(false);
    setShowAnalysis(true);
  };

  const handleAnalysisClose = () => {
    setShowAnalysis(false);
    setSelectedSheet(null);
    setSelectedAction(null);
  };

  const getSelectedAnalysisType = () => {
    const action = config.actions.find(a => a.id === selectedAction);
    return action?.analysisType || 'health_score';
  };

  if (!config) return null;

  return (
    <div style={{
      background: '#1a1a2e',
      border: '1px solid #2d2d44',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '12px'
    }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
          <span>🤖</span>
          <span>{config.title}</span>
          {customerName && (
            <span style={{ color: '#7c3aed', fontSize: '11px' }}>• {customerName}</span>
          )}
        </span>
        <span style={{ color: '#666', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>

      {/* Actions */}
      {isExpanded && (
        <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {config.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: '#252540',
                border: '1px solid #3d3d5c',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2d2d50';
                e.currentTarget.style.borderColor = '#7c3aed';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#252540';
                e.currentTarget.style.borderColor = '#3d3d5c';
              }}
            >
              <span style={{ fontSize: '18px' }}>{action.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{action.label}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{action.description}</div>
              </div>
              <span style={{ color: '#7c3aed' }}>→</span>
            </button>
          ))}

          <p style={{ fontSize: '10px', color: '#666', textAlign: 'center', marginTop: '4px' }}>
            {customerId
              ? "Select a data source from this customer's files"
              : "You'll be asked to select a sheet from your Drive"}
          </p>
        </div>
      )}

      {/* Sheet Picker Modal */}
      {showSheetPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowSheetPicker(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              background: '#1a1a2e',
              borderRadius: '12px',
              border: '1px solid #3d3d5c',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #3d3d5c' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>
                Select Data Source
              </h3>
              <p style={{ margin: '8px 0 0', color: '#888', fontSize: '12px' }}>
                {customerId
                  ? `Choose a spreadsheet from ${customerName || 'this customer'}'s workspace`
                  : 'Select a spreadsheet from your Google Drive'}
              </p>
            </div>

            <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
              {isLoadingSheets ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  Loading sheets...
                </div>
              ) : customerSheets.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customerSheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      onClick={() => handleSheetSelect(sheet)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: '#252540',
                        border: '1px solid #3d3d5c',
                        borderRadius: '8px',
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span>📊</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px' }}>{sheet.name}</div>
                        {sheet.modifiedTime && (
                          <div style={{ fontSize: '10px', color: '#666' }}>
                            Modified: {new Date(sheet.modifiedTime).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <span style={{ color: '#7c3aed' }}>Analyze →</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p style={{ color: '#888', marginBottom: '16px' }}>
                    {customerId
                      ? 'No spreadsheets found for this customer.'
                      : 'Enter a Google Sheets URL to analyze:'}
                  </p>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#252540',
                      border: '1px solid #3d3d5c',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const url = (e.target as HTMLInputElement).value;
                        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                        if (match) {
                          handleSheetSelect({
                            id: match[1],
                            name: 'Google Sheet',
                            link: url,
                            type: 'sheet'
                          });
                        }
                      }
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                    Press Enter to analyze
                  </p>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #3d3d5c', textAlign: 'right' }}>
              <button
                onClick={() => setShowSheetPicker(false)}
                style={{
                  padding: '8px 16px',
                  background: '#333',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ccc',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {showAnalysis && selectedSheet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={handleAnalysisClose}
        >
          <div
            style={{ width: '100%', maxWidth: '700px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <AIAnalysis
              spreadsheetId={selectedSheet.id}
              defaultAnalysisType={getSelectedAnalysisType()}
              onClose={handleAnalysisClose}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentAnalysisActions;
