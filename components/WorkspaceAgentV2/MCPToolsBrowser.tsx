/**
 * MCP Tools Browser - Browse and search all MCP tools
 * Part of WorkspaceAgent V2 Dashboard (WAD-002)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface MCPTool {
  name: string;
  description: string;
  category: string;
  provider: string;
  requiresApproval?: boolean;
}

interface ToolsResponse {
  tools: MCPTool[];
  total: number;
}

// ============================================
// Constants
// ============================================

const PROVIDER_FILTERS = [
  { id: 'all', label: 'All', icon: '🔧' },
  { id: 'google', label: 'Google', icon: '📧' },
  { id: 'slack', label: 'Slack', icon: '💬' },
  { id: 'zoom', label: 'Zoom', icon: '📹' },
  { id: 'internal', label: 'Internal', icon: '⚙️' },
];

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  scheduling: 'bg-green-500/20 text-green-400 border-green-500/30',
  documents: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  meeting_intelligence: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  default: 'bg-cscx-gray-700 text-cscx-gray-300 border-cscx-gray-600',
};

const PROVIDER_BADGES: Record<string, string> = {
  google: 'bg-blue-500/20 text-blue-400',
  slack: 'bg-purple-500/20 text-purple-400',
  zoom: 'bg-blue-600/20 text-blue-300',
  internal: 'bg-cscx-gray-700 text-cscx-gray-400',
};

// ============================================
// Component
// ============================================

export const MCPToolsBrowser: React.FC = () => {
  const { getAuthHeaders } = useAuth();

  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Fetch tools on mount
  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/mcp/tools`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.status}`);
      }
      const data: ToolsResponse = await response.json();
      setTools(data.tools || []);
      // Expand all categories by default
      const categories = new Set(data.tools?.map((t) => t.category) || []);
      setExpandedCategories(categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  };

  // Filter tools based on search and provider
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesSearch =
        searchQuery === '' ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProvider =
        selectedProvider === 'all' || tool.provider === selectedProvider;
      return matchesSearch && matchesProvider;
    });
  }, [tools, searchQuery, selectedProvider]);

  // Group tools by category
  const toolsByCategory = useMemo(() => {
    const groups: Record<string, MCPTool[]> = {};
    for (const tool of filteredTools) {
      const cat = tool.category || 'other';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(tool);
    }
    return groups;
  }, [filteredTools]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  const getProviderBadge = (provider: string) => {
    return PROVIDER_BADGES[provider] || PROVIDER_BADGES.internal;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
          <span className="ml-3 text-cscx-gray-400">Loading MCP tools...</span>
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
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Tools</h3>
          <p className="text-cscx-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchTools}
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🔧</div>
            <div>
              <h3 className="text-lg font-semibold text-white">MCP Tools</h3>
              <p className="text-sm text-cscx-gray-400">
                {filteredTools.length} of {tools.length} tools
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools by name or description..."
              className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
            />
          </div>
        </div>
      </div>

      {/* Provider Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {PROVIDER_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedProvider(filter.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              selectedProvider === filter.id
                ? 'bg-cscx-accent text-white'
                : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
            }`}
          >
            <span>{filter.icon}</span> {filter.label}
          </button>
        ))}
      </div>

      {/* Tools by Category */}
      <div className="space-y-4">
        {Object.entries(toolsByCategory).length === 0 ? (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-white mb-2">No tools found</h3>
              <p className="text-cscx-gray-400">
                Try adjusting your search or filter criteria
              </p>
            </div>
          </div>
        ) : (
          Object.entries(toolsByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categoryTools]) => (
              <div
                key={category}
                className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-cscx-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-sm rounded-full border ${getCategoryColor(category)}`}
                    >
                      {category.replace('_', ' ')}
                    </span>
                    <span className="text-cscx-gray-400 text-sm">
                      {categoryTools.length} tools
                    </span>
                  </div>
                  <span className="text-cscx-gray-400">
                    {expandedCategories.has(category) ? '▼' : '▶'}
                  </span>
                </button>

                {/* Category Tools */}
                {expandedCategories.has(category) && (
                  <div className="border-t border-cscx-gray-800 divide-y divide-cscx-gray-800">
                    {categoryTools.map((tool) => (
                      <div
                        key={tool.name}
                        className="px-4 py-3 hover:bg-cscx-gray-800/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-white font-medium">{tool.name}</h4>
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${getProviderBadge(tool.provider)}`}
                              >
                                {tool.provider}
                              </span>
                              {tool.requiresApproval && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                                  Requires Approval
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default MCPToolsBrowser;
