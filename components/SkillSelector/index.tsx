/**
 * Skill Selector Component
 * Grid of available skills with configuration and execution
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface SkillVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  enabled: boolean;
  cacheable: boolean;
  estimatedDurationSeconds: number;
  estimatedCostSavingsPercent: number;
}

interface SkillDetails extends SkillSummary {
  keywords: string[];
  variables: SkillVariable[];
  steps: Array<{
    id: string;
    name: string;
    description: string;
    tool: string;
    requiresApproval: boolean;
  }>;
}

interface SkillExecutionResult {
  executionId: string;
  skillId: string;
  skillName: string;
  success: boolean;
  fromCache: boolean;
  steps: Array<{
    stepId: string;
    stepName: string;
    status: string;
    result?: any;
    error?: string;
    approvalId?: string;
  }>;
  pendingApprovals: string[];
  message: string;
}

interface CacheStatus {
  cached: boolean;
  cacheKey?: string;
  ttlSeconds?: number | null;
}

interface SkillSelectorProps {
  customerId?: string;
  customerName?: string;
  customerData?: Record<string, any>;
  onExecutionComplete?: (result: SkillExecutionResult) => void;
  onApprovalRequired?: (approvalIds: string[]) => void;
  embedded?: boolean;
}

// ============================================
// Constants
// ============================================

const API_URL = import.meta.env.VITE_API_URL || '';
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

const CATEGORY_ICONS: Record<string, string> = {
  onboarding: 'rocket',
  communication: 'mail',
  analysis: 'activity',
  documentation: 'file-text',
  scheduling: 'calendar',
  renewal: 'refresh-cw',
};

const CATEGORY_COLORS: Record<string, string> = {
  onboarding: '#22c55e',
  communication: '#3b82f6',
  analysis: '#8b5cf6',
  documentation: '#f59e0b',
  scheduling: '#ec4899',
  renewal: '#06b6d4',
};

const ICON_MAP: Record<string, string> = {
  calendar: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'folder-plus': 'M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  'refresh-cw': 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
};

// ============================================
// Component
// ============================================

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  customerId,
  customerName,
  customerData,
  onExecutionComplete,
  onApprovalRequired,
  embedded = false,
}) => {
  // State
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [lastResult, setLastResult] = useState<SkillExecutionResult | null>(null);

  // Load skills
  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/skills`, {
        headers: { 'x-user-id': DEMO_USER_ID },
      });

      if (!response.ok) throw new Error('Failed to load skills');

      const data = await response.json();
      setSkills(data.skills || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Load skill details
  const loadSkillDetails = useCallback(async (skillId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/skills/${skillId}`, {
        headers: { 'x-user-id': DEMO_USER_ID },
      });

      if (!response.ok) throw new Error('Failed to load skill details');

      const data = await response.json();
      setSelectedSkill(data.skill);

      // Initialize variables with defaults
      const defaults: Record<string, any> = {};
      for (const v of data.skill.variables || []) {
        if (v.defaultValue !== undefined) {
          defaults[v.name] = v.defaultValue;
        }
        // Auto-fill from customer context
        if (v.name === 'customerName' && customerName) {
          defaults[v.name] = customerName;
        }
        if (v.name === 'customerId' && customerId) {
          defaults[v.name] = customerId;
        }
      }
      setVariables(defaults);

      // Check cache status
      checkCacheStatus(skillId, defaults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill');
    }
  }, [customerId, customerName]);

  // Check cache status
  const checkCacheStatus = async (skillId: string, vars: Record<string, any>) => {
    try {
      const response = await fetch(
        `${API_URL}/api/skills/${skillId}/cache?variables=${encodeURIComponent(JSON.stringify(vars))}`,
        { headers: { 'x-user-id': DEMO_USER_ID } }
      );

      if (response.ok) {
        const data = await response.json();
        setCacheStatus(data);
      }
    } catch {
      setCacheStatus(null);
    }
  };

  // Execute skill
  const executeSkill = async () => {
    if (!selectedSkill) return;

    setExecuting(true);
    setError(null);
    setLastResult(null);

    try {
      const response = await fetch(`${API_URL}/api/skills/${selectedSkill.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID,
        },
        body: JSON.stringify({
          variables,
          customerId,
          customer: customerData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      const result = data.execution as SkillExecutionResult;
      setLastResult(result);

      if (result.pendingApprovals.length > 0 && onApprovalRequired) {
        onApprovalRequired(result.pendingApprovals);
      }

      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  // Clear cache
  const clearCache = async () => {
    if (!selectedSkill) return;

    try {
      await fetch(`${API_URL}/api/skills/${selectedSkill.id}/cache`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEMO_USER_ID,
        },
        body: JSON.stringify({ variables }),
      });

      setCacheStatus({ cached: false });
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  };

  // Filter skills by category
  const filteredSkills = selectedCategory
    ? skills.filter(s => s.category === selectedCategory)
    : skills;

  // Get unique categories
  const categories = [...new Set(skills.map(s => s.category))];

  // Render icon
  const renderIcon = (iconName: string, size = 24) => {
    const path = ICON_MAP[iconName];
    if (!path) return <span style={{ fontSize: size }}>*</span>;

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    );
  };

  // Render variable input
  const renderVariableInput = (variable: SkillVariable) => {
    const value = variables[variable.name] ?? '';

    switch (variable.type) {
      case 'boolean':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => setVariables(prev => ({ ...prev, [variable.name]: e.target.checked }))}
            />
            {variable.description}
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            min={variable.validation?.min}
            max={variable.validation?.max}
            onChange={e => setVariables(prev => ({ ...prev, [variable.name]: Number(e.target.value) }))}
            placeholder={variable.description}
            style={inputStyle}
          />
        );

      case 'date':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={e => setVariables(prev => ({ ...prev, [variable.name]: e.target.value }))}
            style={inputStyle}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={e => setVariables(prev => ({ ...prev, [variable.name]: e.target.value }))}
            placeholder={variable.description}
            style={inputStyle}
          />
        );

      case 'array':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : value}
            onChange={e =>
              setVariables(prev => ({
                ...prev,
                [variable.name]: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              }))
            }
            placeholder={`${variable.description} (comma-separated)`}
            style={inputStyle}
          />
        );

      default:
        if (variable.validation?.options) {
          return (
            <select
              value={value}
              onChange={e => setVariables(prev => ({ ...prev, [variable.name]: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Select...</option>
              {variable.validation.options.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        }

        return (
          <input
            type="text"
            value={value}
            onChange={e => setVariables(prev => ({ ...prev, [variable.name]: e.target.value }))}
            placeholder={variable.description}
            style={inputStyle}
          />
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading skills...</div>
      </div>
    );
  }

  // Skill configuration view
  if (selectedSkill) {
    return (
      <div style={containerStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setSelectedSkill(null)} style={backButtonStyle}>
            Back
          </button>
          <div
            style={{
              ...iconContainerStyle,
              background: CATEGORY_COLORS[selectedSkill.category] || '#666',
            }}
          >
            {renderIcon(selectedSkill.icon, 28)}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedSkill.name}</h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
              {selectedSkill.description}
            </p>
          </div>
        </div>

        {/* Cache indicator */}
        {cacheStatus && selectedSkill.cacheable && (
          <div style={cacheIndicatorStyle}>
            {cacheStatus.cached ? (
              <>
                <span style={{ color: '#22c55e' }}>Cached</span>
                <span style={{ color: '#888' }}>
                  (expires in {formatTTL(cacheStatus.ttlSeconds || 0)})
                </span>
                <button onClick={clearCache} style={clearCacheButtonStyle}>
                  Clear
                </button>
              </>
            ) : (
              <span style={{ color: '#888' }}>
                Not cached - saves ~{selectedSkill.estimatedCostSavingsPercent}% on repeat runs
              </span>
            )}
          </div>
        )}

        {/* Variables form */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#ccc' }}>
            Configuration
          </h3>
          {selectedSkill.variables?.map(variable => (
            <div key={variable.name} style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>
                {variable.name}
                {variable.required && <span style={{ color: '#e63946' }}>*</span>}
              </label>
              {renderVariableInput(variable)}
            </div>
          ))}
        </div>

        {/* Steps preview */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#ccc' }}>
            Steps ({selectedSkill.steps?.length || 0})
          </h3>
          <div style={stepsListStyle}>
            {selectedSkill.steps?.map((step, i) => (
              <div key={step.id} style={stepItemStyle}>
                <span style={stepNumberStyle}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{step.name}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{step.description}</div>
                </div>
                {step.requiresApproval && (
                  <span style={approvalBadgeStyle}>Approval</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Last result */}
        {lastResult && (
          <div
            style={{
              ...resultStyle,
              borderColor: lastResult.success ? '#22c55e' : '#e63946',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
              {lastResult.success ? 'Execution Successful' : 'Execution Failed'}
              {lastResult.fromCache && <span style={cacheBadgeStyle}>From Cache</span>}
            </div>
            <div style={{ fontSize: '13px', color: '#888' }}>{lastResult.message}</div>
            {lastResult.pendingApprovals.length > 0 && (
              <div style={{ marginTop: '8px', color: '#f59e0b' }}>
                {lastResult.pendingApprovals.length} action(s) awaiting approval
              </div>
            )}
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={executeSkill}
          disabled={executing}
          style={{
            ...executeButtonStyle,
            opacity: executing ? 0.6 : 1,
          }}
        >
          {executing
            ? 'Executing...'
            : cacheStatus?.cached
              ? 'Execute (Cached)'
              : `Execute (~${selectedSkill.estimatedDurationSeconds}s)`}
        </button>
      </div>
    );
  }

  // Skills grid view
  return (
    <div style={containerStyle}>
      <h2 style={{ margin: '0 0 20px', fontSize: '18px' }}>Available Skills</h2>

      {/* Category filter */}
      <div style={categoryFilterStyle}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            ...categoryButtonStyle,
            background: !selectedCategory ? '#333' : 'transparent',
          }}
        >
          All ({skills.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...categoryButtonStyle,
              background: selectedCategory === cat ? CATEGORY_COLORS[cat] : 'transparent',
              borderColor: CATEGORY_COLORS[cat],
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)} (
            {skills.filter(s => s.category === cat).length})
          </button>
        ))}
      </div>

      {/* Skills grid */}
      <div style={gridStyle}>
        {filteredSkills.map(skill => (
          <div
            key={skill.id}
            onClick={() => loadSkillDetails(skill.id)}
            style={{
              ...cardStyle,
              opacity: skill.enabled ? 1 : 0.5,
            }}
          >
            <div
              style={{
                ...cardIconStyle,
                background: CATEGORY_COLORS[skill.category] || '#666',
              }}
            >
              {renderIcon(skill.icon, 24)}
            </div>
            <div style={cardContentStyle}>
              <h3 style={cardTitleStyle}>{skill.name}</h3>
              <p style={cardDescStyle}>{skill.description}</p>
              <div style={cardMetaStyle}>
                <span style={categoryTagStyle(skill.category)}>{skill.category}</span>
                {skill.cacheable && (
                  <span style={cacheTagStyle}>~{skill.estimatedCostSavingsPercent}% savings</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredSkills.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No skills found in this category
        </div>
      )}
    </div>
  );
};

// ============================================
// Styles
// ============================================

const containerStyle: React.CSSProperties = {
  background: '#0a0a0a',
  borderRadius: '12px',
  padding: '20px',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const categoryFilterStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '20px',
};

const categoryButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '16px',
  border: '1px solid #333',
  background: 'transparent',
  color: '#fff',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px',
};

const cardStyle: React.CSSProperties = {
  background: '#111',
  borderRadius: '12px',
  padding: '16px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  border: '1px solid #222',
  display: 'flex',
  gap: '12px',
};

const cardIconStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: '#fff',
};

const cardContentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '14px',
  fontWeight: 600,
};

const cardDescStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: '#888',
  lineHeight: 1.4,
};

const cardMetaStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const categoryTagStyle = (category: string): React.CSSProperties => ({
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '10px',
  background: CATEGORY_COLORS[category] + '20',
  color: CATEGORY_COLORS[category],
  fontWeight: 500,
});

const cacheTagStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '10px',
  background: '#22c55e20',
  color: '#22c55e',
  fontWeight: 500,
};

const backButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  border: '1px solid #333',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
};

const iconContainerStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
};

const cacheIndicatorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  background: '#111',
  borderRadius: '8px',
  marginBottom: '20px',
  fontSize: '13px',
};

const clearCacheButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '4px',
  border: '1px solid #333',
  background: 'transparent',
  color: '#888',
  cursor: 'pointer',
  fontSize: '12px',
  marginLeft: 'auto',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '13px',
  color: '#ccc',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #333',
  background: '#111',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const stepsListStyle: React.CSSProperties = {
  background: '#111',
  borderRadius: '8px',
  padding: '4px',
};

const stepItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px',
  borderRadius: '6px',
};

const stepNumberStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  background: '#333',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 600,
};

const approvalBadgeStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '10px',
  background: '#f59e0b20',
  color: '#f59e0b',
  fontWeight: 500,
};

const errorStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  background: '#e6394610',
  border: '1px solid #e63946',
  color: '#e63946',
  marginBottom: '16px',
  fontSize: '13px',
};

const resultStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid',
  marginBottom: '16px',
};

const cacheBadgeStyle: React.CSSProperties = {
  marginLeft: '8px',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '10px',
  background: '#22c55e20',
  color: '#22c55e',
};

const executeButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '8px',
  border: 'none',
  background: 'linear-gradient(135deg, #e63946 0%, #c41d3a 100%)',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

// ============================================
// Helpers
// ============================================

function formatTTL(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export default SkillSelector;
