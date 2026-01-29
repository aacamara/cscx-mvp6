/**
 * Skills Library - Browse and execute pre-built skills
 * Part of WorkspaceAgent V2 Dashboard (WAD-005)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface SkillVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'date';
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  variables?: SkillVariable[];
  estimated_duration_seconds?: number;
  cost_savings_percent?: number;
  created_at: string;
}

interface SkillsLibraryProps {
  customerId?: string;
  customerName?: string;
}

// ============================================
// Constants
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  research: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  analysis: 'bg-green-500/20 text-green-400 border-green-500/30',
  automation: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  reporting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  default: 'bg-cscx-gray-700 text-cscx-gray-300 border-cscx-gray-600',
};

const DEFAULT_ICONS: Record<string, string> = {
  communication: '📧',
  research: '🔍',
  analysis: '📊',
  automation: '🤖',
  reporting: '📋',
  default: '🎯',
};

// ============================================
// Component
// ============================================

export const SkillsLibrary: React.FC<SkillsLibraryProps> = ({
  customerId,
  customerName,
}) => {
  const { getAuthHeaders } = useAuth();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [executingSkillId, setExecutingSkillId] = useState<string | null>(null);
  const [variableInputs, setVariableInputs] = useState<Record<string, Record<string, string>>>({});

  // Fetch skills on mount
  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/skills`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch skills: ${response.status}`);
      }
      const data = await response.json();
      setSkills(data.skills || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch skills');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (skillId: string) => {
    setExpandedSkillId((prev) => (prev === skillId ? null : skillId));
  };

  const handleVariableChange = (skillId: string, varName: string, value: string) => {
    setVariableInputs((prev) => ({
      ...prev,
      [skillId]: {
        ...(prev[skillId] || {}),
        [varName]: value,
      },
    }));
  };

  const handleExecuteSkill = async (skill: Skill) => {
    setExecutingSkillId(skill.id);
    try {
      const inputs = variableInputs[skill.id] || {};
      const response = await fetch(`${API_URL}/api/skills/${skill.id}/execute`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          customer_id: customerId,
          variables: inputs,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to execute skill: ${response.status}`);
      }
      // Could show success toast or display result
    } catch (err) {
      console.error('Failed to execute skill:', err);
    } finally {
      setExecutingSkillId(null);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '~1 min';
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `~${mins} min`;
    const hours = Math.round(mins / 60);
    return `~${hours}h`;
  };

  const getSkillIcon = (skill: Skill): string => {
    return skill.icon || DEFAULT_ICONS[skill.category] || DEFAULT_ICONS.default;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
          <span className="ml-3 text-cscx-gray-400">Loading skills...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Skills</h3>
          <p className="text-cscx-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchSkills}
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (skills.length === 0) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Skills Yet</h3>
          <p className="text-cscx-gray-400 max-w-md mx-auto">
            Skills are pre-built automation routines that can be executed with custom inputs
            to save time on common customer success tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎯</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Skills Library</h3>
              <p className="text-sm text-cscx-gray-400">{skills.length} available skills</p>
            </div>
          </div>
          {customerId && (
            <div className="text-sm text-cscx-gray-400">
              Customer: <span className="text-white">{customerName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Skill Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {skills.map((skill) => {
          const isExpanded = expandedSkillId === skill.id;
          const isExecuting = executingSkillId === skill.id;
          const inputs = variableInputs[skill.id] || {};

          return (
            <div
              key={skill.id}
              className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden"
            >
              {/* Skill Header */}
              <button
                onClick={() => toggleExpanded(skill.id)}
                className="w-full p-4 flex items-start justify-between gap-4 hover:bg-cscx-gray-800/30 transition-colors text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="text-2xl">{getSkillIcon(skill)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-white font-medium">{skill.name}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${
                          CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.default
                        }`}
                      >
                        {skill.category}
                      </span>
                    </div>

                    {skill.description && (
                      <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">
                        {skill.description}
                      </p>
                    )}

                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-1 text-cscx-gray-400">
                        <span>⏱️</span>
                        <span>{formatDuration(skill.estimated_duration_seconds)}</span>
                      </div>
                      {skill.cost_savings_percent && (
                        <div className="flex items-center gap-1 text-green-400">
                          <span>💰</span>
                          <span>{skill.cost_savings_percent}% saved</span>
                        </div>
                      )}
                      {skill.variables && skill.variables.length > 0 && (
                        <div className="flex items-center gap-1 text-cscx-gray-400">
                          <span>📝</span>
                          <span>{skill.variables.length} inputs</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-cscx-gray-400">{isExpanded ? '▼' : '▶'}</span>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-cscx-gray-800 p-4 bg-cscx-gray-800/20">
                  {/* Variables/Inputs */}
                  {skill.variables && skill.variables.length > 0 && (
                    <div className="space-y-3 mb-4">
                      <h5 className="text-sm font-medium text-white">Inputs</h5>
                      {skill.variables.map((variable) => (
                        <div key={variable.name}>
                          <label className="block text-sm text-cscx-gray-400 mb-1">
                            {variable.name}
                            {variable.required && (
                              <span className="text-cscx-accent ml-1">*</span>
                            )}
                            {variable.description && (
                              <span className="text-cscx-gray-500 ml-2">
                                - {variable.description}
                              </span>
                            )}
                          </label>
                          <input
                            type={variable.type === 'number' ? 'number' : 'text'}
                            value={inputs[variable.name] || variable.default?.toString() || ''}
                            onChange={(e) =>
                              handleVariableChange(skill.id, variable.name, e.target.value)
                            }
                            placeholder={variable.default?.toString() || `Enter ${variable.name}`}
                            className="w-full bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Execute Button */}
                  <button
                    onClick={() => handleExecuteSkill(skill)}
                    disabled={isExecuting}
                    className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      isExecuting
                        ? 'bg-cscx-gray-700 text-cscx-gray-400 cursor-not-allowed'
                        : 'bg-cscx-accent hover:bg-cscx-accent/80 text-white'
                    }`}
                  >
                    {isExecuting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        Execute Skill
                        {customerId && ` for ${customerName}`}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SkillsLibrary;
