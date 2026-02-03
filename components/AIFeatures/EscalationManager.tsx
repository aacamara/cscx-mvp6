/**
 * PRD-236: Escalation Manager Component
 *
 * AI-powered escalation creation and routing UI.
 * Provides intelligent routing preview, classification, and team assignment.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Users,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Zap,
  Building2,
  MessageSquare,
  UserPlus,
  ArrowRight,
  Slack,
  FileText,
  Target,
  AlertCircle,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface RoutedMember {
  userId: string;
  userName: string;
  email: string;
  role: string;
  slackUserId?: string;
  matchScore: number;
  matchReasons: string[];
  availability: 'online' | 'away' | 'offline';
  currentLoad: number;
}

interface Classification {
  category: string;
  severity: string;
  confidence: number;
  requiredExpertise: string[];
  urgencyIndicators: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  keyIssues: string[];
  suggestedTitle?: string;
  reasoning: string;
}

interface RoutingDecision {
  id: string;
  primary: RoutedMember;
  secondary: RoutedMember[];
  executiveSponsor?: RoutedMember;
  standbyTeam: string[];
  estimatedResponseTime: number;
  routingReason: string;
  classification: Classification;
}

interface EscalationManagerProps {
  customerId: string;
  customerName: string;
  customerTier?: string;
  customerARR?: number;
  healthScore?: number;
  onClose?: () => void;
  onEscalationCreated?: (escalation: any) => void;
}

// ============================================
// API
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function previewRouting(data: {
  title: string;
  description: string;
  customerId: string;
  customerName?: string;
  customerTier?: string;
  customerARR?: number;
  healthScore?: number;
  severity?: string;
  category?: string;
}): Promise<RoutingDecision> {
  const response = await fetch(`${API_BASE}/escalations/routing-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.routing;
}

async function createEscalationWithRouting(
  userId: string,
  data: {
    customerId: string;
    title: string;
    description: string;
    impact?: string;
    severity?: string;
    category?: string;
  }
): Promise<any> {
  const response = await fetch(`${API_BASE}/escalations/with-routing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result;
}

// ============================================
// Severity Badge Component
// ============================================

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    P1: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'P1 - Critical' },
    P2: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'P2 - Major' },
    P3: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'P3 - Moderate' },
  };
  const c = config[severity] || config.P2;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ============================================
// Category Badge Component
// ============================================

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const config: Record<string, { icon: typeof AlertTriangle; color: string }> = {
    technical: { icon: Zap, color: 'text-blue-400' },
    support: { icon: MessageSquare, color: 'text-green-400' },
    product: { icon: Target, color: 'text-purple-400' },
    commercial: { icon: Building2, color: 'text-yellow-400' },
    relationship: { icon: Users, color: 'text-pink-400' },
  };
  const c = config[category] || { icon: AlertCircle, color: 'text-gray-400' };
  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-2 ${c.color}`}>
      <Icon className="w-4 h-4" />
      <span className="capitalize">{category}</span>
    </div>
  );
};

// ============================================
// Availability Indicator Component
// ============================================

const AvailabilityIndicator: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; label: string }> = {
    online: { color: 'bg-green-500', label: 'Online' },
    away: { color: 'bg-yellow-500', label: 'Away' },
    offline: { color: 'bg-gray-500', label: 'Offline' },
  };
  const c = config[status] || config.offline;

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className="text-sm text-gray-400">{c.label}</span>
    </div>
  );
};

// ============================================
// Team Member Card Component
// ============================================

const TeamMemberCard: React.FC<{
  member: RoutedMember;
  role: 'primary' | 'secondary' | 'executive';
}> = ({ member, role }) => {
  const roleLabels = {
    primary: 'Primary',
    secondary: 'Secondary',
    executive: 'Executive Sponsor',
  };

  const roleBg = {
    primary: 'border-cscx-accent/50 bg-cscx-accent/10',
    secondary: 'border-blue-500/50 bg-blue-500/10',
    executive: 'border-purple-500/50 bg-purple-500/10',
  };

  return (
    <div className={`p-4 rounded-lg border ${roleBg[role]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{member.userName}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {roleLabels[role]}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1 capitalize">{member.role}</p>
        </div>
        <AvailabilityIndicator status={member.availability} />
      </div>

      <div className="mt-3 space-y-2">
        {member.matchReasons.map((reason, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            {reason}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
        <span>{member.currentLoad} active escalations</span>
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          {Math.round(member.matchScore * 100)}% match
        </span>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const EscalationManager: React.FC<EscalationManagerProps> = ({
  customerId,
  customerName,
  customerTier,
  customerARR,
  healthScore,
  onClose,
  onEscalationCreated,
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [overrideSeverity, setOverrideSeverity] = useState<string | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<string | null>(null);

  // UI state
  const [step, setStep] = useState<'input' | 'preview' | 'confirm'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routing, setRouting] = useState<RoutingDecision | null>(null);
  const [createdEscalation, setCreatedEscalation] = useState<any>(null);

  // Get routing preview
  const handlePreview = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      setError('Please provide a title and description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await previewRouting({
        title,
        description,
        customerId,
        customerName,
        customerTier,
        customerARR,
        healthScore,
        severity: overrideSeverity || undefined,
        category: overrideCategory || undefined,
      });
      setRouting(result);
      setStep('preview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [title, description, customerId, customerName, customerTier, customerARR, healthScore, overrideSeverity, overrideCategory]);

  // Submit escalation
  const handleSubmit = useCallback(async () => {
    if (!routing) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: Get actual user ID from auth context
      const userId = 'current-user-id';

      const result = await createEscalationWithRouting(userId, {
        customerId,
        title,
        description,
        severity: overrideSeverity || routing.classification.severity,
        category: overrideCategory || routing.classification.category,
      });

      setCreatedEscalation(result);
      setStep('confirm');
      onEscalationCreated?.(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [routing, customerId, title, description, overrideSeverity, overrideCategory, onEscalationCreated]);

  // Refresh routing preview
  const handleRefreshRouting = useCallback(async () => {
    setLoading(true);
    try {
      const result = await previewRouting({
        title,
        description,
        customerId,
        customerName,
        customerTier,
        customerARR,
        healthScore,
        severity: overrideSeverity || undefined,
        category: overrideCategory || undefined,
      });
      setRouting(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [title, description, customerId, customerName, customerTier, customerARR, healthScore, overrideSeverity, overrideCategory]);

  // ============================================
  // Render: Input Step
  // ============================================

  if (step === 'input') {
    return (
      <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cscx-accent/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-cscx-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create Escalation</h2>
              <p className="text-sm text-gray-400">{customerName}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Customer Info Banner */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 flex items-center gap-6">
          <div>
            <p className="text-sm text-gray-400">Customer</p>
            <p className="font-medium text-white">{customerName}</p>
          </div>
          {customerTier && (
            <div>
              <p className="text-sm text-gray-400">Tier</p>
              <p className="font-medium text-white capitalize">{customerTier}</p>
            </div>
          )}
          {customerARR && (
            <div>
              <p className="text-sm text-gray-400">ARR</p>
              <p className="font-medium text-white">${(customerARR / 1000).toFixed(0)}K</p>
            </div>
          )}
          {healthScore !== undefined && (
            <div>
              <p className="text-sm text-gray-400">Health Score</p>
              <p className={`font-medium ${healthScore < 50 ? 'text-red-400' : healthScore < 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                {healthScore}
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Escalation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cscx-accent focus:ring-1 focus:ring-cscx-accent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed context about the issue, impact, and any relevant history..."
              rows={5}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cscx-accent focus:ring-1 focus:ring-cscx-accent outline-none resize-none"
            />
          </div>

          {/* Optional Overrides */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Override Severity (Optional)
              </label>
              <select
                value={overrideSeverity || ''}
                onChange={(e) => setOverrideSeverity(e.target.value || null)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cscx-accent focus:ring-1 focus:ring-cscx-accent outline-none"
              >
                <option value="">Let AI Determine</option>
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - Major</option>
                <option value="P3">P3 - Moderate</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Override Category (Optional)
              </label>
              <select
                value={overrideCategory || ''}
                onChange={(e) => setOverrideCategory(e.target.value || null)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cscx-accent focus:ring-1 focus:ring-cscx-accent outline-none"
              >
                <option value="">Let AI Determine</option>
                <option value="technical">Technical</option>
                <option value="support">Support</option>
                <option value="product">Product</option>
                <option value="commercial">Commercial</option>
                <option value="relationship">Relationship</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handlePreview}
            disabled={loading || !title.trim() || !description.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Preview Routing
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Preview Step
  // ============================================

  if (step === 'preview' && routing) {
    const { classification, primary, secondary, executiveSponsor, standbyTeam, estimatedResponseTime } = routing;

    return (
      <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cscx-accent/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-cscx-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Intelligent Routing Preview</h2>
              <p className="text-sm text-gray-400">Review the AI-recommended routing</p>
            </div>
          </div>
          <button
            onClick={handleRefreshRouting}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Classification */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">AI Classification</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <SeverityBadge severity={classification.severity} />
            <CategoryBadge category={classification.category} />
            <span className="text-sm text-gray-400">
              {Math.round(classification.confidence * 100)}% confidence
            </span>
          </div>

          {classification.urgencyIndicators.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {classification.urgencyIndicators.map((indicator, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs"
                >
                  {indicator}
                </span>
              ))}
            </div>
          )}

          {classification.keyIssues.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-gray-400 mb-2">Key Issues Identified:</p>
              <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                {classification.keyIssues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Team Routing */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Intelligent Routing</h3>
          <div className="space-y-3">
            <TeamMemberCard member={primary} role="primary" />
            {secondary.map((member, i) => (
              <TeamMemberCard key={i} member={member} role="secondary" />
            ))}
            {executiveSponsor && (
              <TeamMemberCard member={executiveSponsor} role="executive" />
            )}
          </div>
        </div>

        {/* Standby Team */}
        {standbyTeam.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Standby Team</h3>
            <div className="flex flex-wrap gap-2">
              {standbyTeam.map((team, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300"
                >
                  {team}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Response Time */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">
                Estimated Response Time: {estimatedResponseTime < 60
                  ? `${estimatedResponseTime} minutes`
                  : `${Math.round(estimatedResponseTime / 60)} hours`}
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                Based on team availability and current workload
              </p>
            </div>
          </div>
        </div>

        {/* Actions Preview */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Actions Upon Submission</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <Slack className="w-4 h-4 text-purple-400" />
              Slack notification sent to {primary.userName}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              War room channel created
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <FileText className="w-4 h-4 text-green-400" />
              Escalation brief document generated
            </div>
            {executiveSponsor && (
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <Users className="w-4 h-4 text-yellow-400" />
                Executive sponsor briefed
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep('input')}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Back to Edit
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setOverrideSeverity(null);
                setOverrideCategory(null);
                handleRefreshRouting();
              }}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              Reset Overrides
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Create Escalation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Confirmation Step
  // ============================================

  if (step === 'confirm' && createdEscalation) {
    return (
      <div className="bg-cscx-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Escalation Created</h2>
          <p className="text-gray-400 mb-6">
            Your escalation has been created and routed to the appropriate team.
          </p>

          {/* Actions Taken */}
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Actions Taken</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Slack notification sent to {createdEscalation.routing?.primary?.userName}
              </div>
              {createdEscalation.warRoom?.slackChannelName && (
                <div className="flex items-center gap-3 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  War room created: #{createdEscalation.warRoom.slackChannelName}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Escalation brief linked
              </div>
              {createdEscalation.routing?.executiveSponsor && (
                <div className="flex items-center gap-3 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Executive sponsor notified
                </div>
              )}
            </div>
          </div>

          {/* Estimated Response */}
          {createdEscalation.routing?.estimatedResponseTime && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400">
                  Estimated response in {createdEscalation.routing.estimatedResponseTime < 60
                    ? `${createdEscalation.routing.estimatedResponseTime} minutes`
                    : `${Math.round(createdEscalation.routing.estimatedResponseTime / 60)} hours`}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {createdEscalation.warRoom?.slackChannelUrl && (
              <a
                href={createdEscalation.warRoom.slackChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Slack className="w-4 h-4" />
                Open War Room
              </a>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default EscalationManager;
