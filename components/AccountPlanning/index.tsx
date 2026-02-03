/**
 * Account Planning Component
 * PRD-235: AI-Powered Account Planning
 *
 * Displays AI-generated account plans with:
 * - Executive summary
 * - Strategic objectives with milestones
 * - Stakeholder relationship plans
 * - Expansion opportunities
 * - Risk mitigation strategies
 * - 90-day action plans
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Target,
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Edit2,
  Send,
  Check,
  X,
  DollarSign,
  BarChart3,
  Shield,
  ListChecks,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface SuccessMetric {
  metric: string;
  current: string | number;
  target: string | number;
  measurement: string;
}

interface QuarterlyMilestone {
  quarter: string;
  milestone: string;
  completed?: boolean;
}

interface StrategicObjective {
  id: string;
  objective: string;
  rationale: string;
  success_metrics: SuccessMetric[];
  quarterly_milestones: QuarterlyMilestone[];
  owner: 'CSM' | 'Customer' | 'Both';
  priority: 'critical' | 'high' | 'medium';
}

interface RelationshipGoal {
  stakeholder_id?: string;
  name: string;
  role?: string;
  current_score?: number;
  target_score?: number;
  strategy: string;
}

interface StakeholderPlan {
  current_assessment: string;
  relationship_goals: RelationshipGoal[];
  multi_threading_target: number;
  exec_sponsor_strategy: string;
}

interface ExpansionOpportunity {
  type: string;
  description: string;
  value: number;
  probability: number;
  timeline: string;
}

interface ExpansionPlan {
  current_arr: number;
  target_arr: number;
  opportunities: ExpansionOpportunity[];
}

interface RiskItem {
  risk: string;
  mitigation: string;
  owner: string;
}

interface RiskMitigation {
  identified_risks: RiskItem[];
}

interface QBRScheduleItem {
  quarter: string;
  scheduled_date?: string;
  topics: string[];
}

interface ActionItem {
  week: number;
  action: string;
  owner: string;
  completed?: boolean;
}

interface BusinessContext {
  industry_trends: string;
  customer_goals: string;
  competitive_landscape: string;
}

interface BenchmarkComparison {
  similar_accounts_success_rate: number;
  key_differentiators: string;
}

interface AccountPlan {
  plan_id: string;
  customer_id: string;
  customer_name?: string;
  fiscal_year: string;
  status: 'draft' | 'pending_review' | 'approved' | 'active';
  ai_confidence: number;

  executive_summary: string;
  business_context: BusinessContext;
  strategic_objectives: StrategicObjective[];
  stakeholder_plan: StakeholderPlan;
  expansion_plan: ExpansionPlan;
  risk_mitigation: RiskMitigation;
  qbr_schedule: QBRScheduleItem[];
  action_plan_90day: ActionItem[];

  benchmark_comparison?: BenchmarkComparison;
  metadata: {
    ai_generated: boolean;
    created_at: string;
    approved_by?: string;
    approved_at?: string;
  };
}

interface AccountPlanningProps {
  customerId: string;
  customerName?: string;
  fiscalYear?: string;
  onPlanGenerated?: (planId: string) => void;
}

// ============================================
// API
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchPlan(customerId: string, fiscalYear: string): Promise<AccountPlan | null> {
  try {
    const response = await fetch(
      `${API_BASE}/customers/${customerId}/account-plan?fiscal_year=${fiscalYear}`
    );
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('[AccountPlanning] Error fetching plan:', error);
    return null;
  }
}

async function generatePlan(
  customerId: string,
  fiscalYear: string
): Promise<AccountPlan | null> {
  try {
    const response = await fetch(`${API_BASE}/customers/${customerId}/account-plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiscal_year: fiscalYear,
        include_sections: ['all'],
        reference_similar_accounts: true,
      }),
    });
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('[AccountPlanning] Error generating plan:', error);
    return null;
  }
}

async function submitPlanForReview(planId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/account-plans/${planId}/submit`, {
      method: 'POST',
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('[AccountPlanning] Error submitting plan:', error);
    return false;
  }
}

// ============================================
// Status Badge Component
// ============================================

const StatusBadge: React.FC<{ status: AccountPlan['status'] }> = ({ status }) => {
  const config = {
    draft: { color: 'bg-gray-600', label: 'Draft' },
    pending_review: { color: 'bg-yellow-600', label: 'Pending Review' },
    approved: { color: 'bg-blue-600', label: 'Approved' },
    active: { color: 'bg-green-600', label: 'Active' },
  };

  const { color, label } = config[status];

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full text-white ${color}`}>
      {label}
    </span>
  );
};

// ============================================
// Priority Badge Component
// ============================================

const PriorityBadge: React.FC<{ priority: StrategicObjective['priority'] }> = ({ priority }) => {
  const config = {
    critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'CRITICAL' },
    high: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'HIGH' },
    medium: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'MEDIUM' },
  };

  const { color, label } = config[priority];

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${color}`}>
      {label}
    </span>
  );
};

// ============================================
// Objective Card Component
// ============================================

const ObjectiveCard: React.FC<{
  objective: StrategicObjective;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}> = ({ objective, index, expanded, onToggle }) => {
  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start justify-between text-left hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-gray-400 text-sm">#{index + 1}</span>
            <h4 className="text-white font-medium">{objective.objective}</h4>
            <PriorityBadge priority={objective.priority} />
          </div>
          <p className="text-sm text-gray-400">{objective.rationale}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50">
          {/* Success Metrics */}
          <div className="pt-4">
            <h5 className="text-sm font-medium text-gray-300 mb-2">Success Metrics</h5>
            <div className="space-y-2">
              {objective.success_metrics.map((metric, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-700/30 rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm text-white">{metric.metric}</p>
                    <p className="text-xs text-gray-500">{metric.measurement}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="text-gray-400">{metric.current}</span>
                      <span className="text-gray-600 mx-1">-&gt;</span>
                      <span className="text-green-400">{metric.target}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quarterly Milestones */}
          <div>
            <h5 className="text-sm font-medium text-gray-300 mb-2">Quarterly Milestones</h5>
            <div className="space-y-2">
              {objective.quarterly_milestones.map((milestone, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      milestone.completed
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-700 text-gray-500'
                    }`}
                  >
                    {milestone.completed ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <span className="text-xs">{milestone.quarter.replace(/[^0-9]/g, '')}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 w-8">{milestone.quarter}</span>
                  <span className="text-sm text-gray-300">{milestone.milestone}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Owner */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
            <span className="text-xs text-gray-500">Owner:</span>
            <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
              {objective.owner}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Generate Plan Card Component
// ============================================

const GeneratePlanCard: React.FC<{
  customerName: string;
  fiscalYear: string;
  onGenerate: () => void;
  generating: boolean;
}> = ({ customerName, fiscalYear, onGenerate, generating }) => {
  return (
    <div className="bg-cscx-gray-800 rounded-lg border border-gray-700/50 p-8 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-8 h-8 text-purple-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Generate Account Plan</h3>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        AI will generate a comprehensive account plan for {customerName} based on health score,
        stakeholder relationships, expansion opportunities, and risk signals.
      </p>

      <div className="bg-gray-700/30 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Plan will include:</h4>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Executive summary and business context
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            3-5 strategic objectives with milestones
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Stakeholder relationship plan
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Expansion targets and timeline
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Risk mitigation strategies
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            90-day action plan
          </li>
        </ul>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all disabled:opacity-50"
      >
        {generating ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Generating Plan...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate {fiscalYear} Plan
          </>
        )}
      </button>
      <p className="text-xs text-gray-500 mt-4">Estimated generation time: 30-60 seconds</p>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const AccountPlanning: React.FC<AccountPlanningProps> = ({
  customerId,
  customerName = 'Customer',
  fiscalYear: defaultFiscalYear,
  onPlanGenerated,
}) => {
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'summary' | 'objectives' | 'stakeholders' | 'actions'>('summary');

  const fiscalYear = defaultFiscalYear || `FY${new Date().getFullYear()}`;

  // Load existing plan
  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPlan(customerId, fiscalYear);
      setPlan(data);
    } catch (err) {
      setError('Failed to load account plan');
    } finally {
      setLoading(false);
    }
  }, [customerId, fiscalYear]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Generate new plan
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const data = await generatePlan(customerId, fiscalYear);
      if (data) {
        setPlan(data);
        onPlanGenerated?.(data.plan_id);
      } else {
        setError('Failed to generate plan');
      }
    } catch (err) {
      setError('Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  // Submit for review
  const handleSubmit = async () => {
    if (!plan) return;
    setSubmitting(true);

    try {
      const success = await submitPlanForReview(plan.plan_id);
      if (success) {
        setPlan({ ...plan, status: 'pending_review' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle objective expansion
  const toggleObjective = (id: string) => {
    setExpandedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="text-center p-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadPlan}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!plan) {
    return (
      <GeneratePlanCard
        customerName={customerName}
        fiscalYear={fiscalYear}
        onGenerate={handleGenerate}
        generating={generating}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Account Plan - {plan.fiscal_year}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={plan.status} />
            {plan.metadata.ai_generated && (
              <span className="flex items-center gap-1 text-xs text-purple-400">
                <Sparkles className="w-3 h-3" />
                AI Generated ({Math.round(plan.ai_confidence * 100)}% confidence)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
            title="Regenerate Plan"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          </button>
          {plan.status === 'draft' && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </div>

      {/* Benchmark comparison */}
      {plan.benchmark_comparison && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-4 border border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            Benchmark Insight
          </div>
          <p className="text-white">
            Similar accounts have a{' '}
            <span className="text-green-400 font-medium">
              {Math.round(plan.benchmark_comparison.similar_accounts_success_rate * 100)}%
            </span>{' '}
            success rate. {plan.benchmark_comparison.key_differentiators}
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {[
          { id: 'summary', label: 'Summary', icon: FileText },
          { id: 'objectives', label: 'Objectives', icon: Target },
          { id: 'stakeholders', label: 'Stakeholders', icon: Users },
          { id: 'actions', label: '90-Day Plan', icon: ListChecks },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Executive Summary */}
            <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Executive Summary</h3>
              <p className="text-white leading-relaxed">{plan.executive_summary}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Target className="w-4 h-4" />
                  Strategic Objectives
                </div>
                <div className="text-2xl font-bold text-white">
                  {plan.strategic_objectives.length}
                </div>
              </div>

              <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Users className="w-4 h-4" />
                  Stakeholder Goals
                </div>
                <div className="text-2xl font-bold text-white">
                  {plan.stakeholder_plan.relationship_goals.length}
                </div>
              </div>

              <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <DollarSign className="w-4 h-4" />
                  Expansion Target
                </div>
                <div className="text-2xl font-bold text-green-400">
                  ${(plan.expansion_plan.target_arr - plan.expansion_plan.current_arr).toLocaleString()}
                </div>
              </div>

              <div className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Shield className="w-4 h-4" />
                  Risks Identified
                </div>
                <div className="text-2xl font-bold text-white">
                  {plan.risk_mitigation.identified_risks.length}
                </div>
              </div>
            </div>

            {/* Business Context */}
            <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Business Context</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xs text-gray-500 mb-1">Industry Trends</h4>
                  <p className="text-sm text-gray-300">{plan.business_context.industry_trends}</p>
                </div>
                <div>
                  <h4 className="text-xs text-gray-500 mb-1">Customer Goals</h4>
                  <p className="text-sm text-gray-300">{plan.business_context.customer_goals}</p>
                </div>
                <div>
                  <h4 className="text-xs text-gray-500 mb-1">Competitive Landscape</h4>
                  <p className="text-sm text-gray-300">{plan.business_context.competitive_landscape}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'objectives' && (
          <div className="space-y-4">
            {plan.strategic_objectives.map((objective, index) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                index={index}
                expanded={expandedObjectives.has(objective.id)}
                onToggle={() => toggleObjective(objective.id)}
              />
            ))}
          </div>
        )}

        {activeTab === 'stakeholders' && (
          <div className="space-y-6">
            {/* Assessment */}
            <div className="bg-cscx-gray-800 rounded-lg p-6 border border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Current Assessment</h3>
              <p className="text-white">{plan.stakeholder_plan.current_assessment}</p>
            </div>

            {/* Relationship Goals */}
            <div className="bg-cscx-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="text-sm font-medium text-white">Relationship Goals</h3>
              </div>
              <div className="divide-y divide-gray-700/50">
                {plan.stakeholder_plan.relationship_goals.map((goal, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-white font-medium">{goal.name}</h4>
                        {goal.role && <p className="text-xs text-gray-500">{goal.role}</p>}
                      </div>
                      {goal.current_score !== undefined && goal.target_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">{goal.current_score}</span>
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-500 to-green-500"
                              style={{ width: `${goal.current_score}%` }}
                            />
                          </div>
                          <span className="text-sm text-green-400">{goal.target_score}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{goal.strategy}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Executive Strategy */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
              <h3 className="text-sm font-medium text-blue-400 mb-2">
                Executive Sponsor Strategy
              </h3>
              <p className="text-white">{plan.stakeholder_plan.exec_sponsor_strategy}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-400">Multi-threading target:</span>
                <span className="text-sm font-medium text-white">
                  {plan.stakeholder_plan.multi_threading_target} relationships
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Action Items */}
            <div className="bg-cscx-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="text-sm font-medium text-white">90-Day Action Plan</h3>
              </div>
              <div className="divide-y divide-gray-700/50">
                {plan.action_plan_90day.map((action, i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        action.completed
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {action.completed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-medium">W{action.week}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white">{action.action}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                      {action.owner}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* QBR Schedule */}
            <div className="bg-cscx-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  QBR Schedule
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-700/50">
                {plan.qbr_schedule.map((qbr, i) => (
                  <div key={i} className="p-4">
                    <div className="text-sm font-medium text-white mb-2">{qbr.quarter}</div>
                    {qbr.scheduled_date && (
                      <p className="text-xs text-gray-500 mb-2">{qbr.scheduled_date}</p>
                    )}
                    <ul className="space-y-1">
                      {qbr.topics.map((topic, j) => (
                        <li key={j} className="text-xs text-gray-400 flex items-center gap-1">
                          <span className="w-1 h-1 bg-gray-500 rounded-full" />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Mitigation */}
            {plan.risk_mitigation.identified_risks.length > 0 && (
              <div className="bg-cscx-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
                <div className="p-4 border-b border-gray-700/50">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    Risk Mitigation
                  </h3>
                </div>
                <div className="divide-y divide-gray-700/50">
                  {plan.risk_mitigation.identified_risks.map((risk, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-white font-medium">{risk.risk}</p>
                          <p className="text-sm text-gray-400 mt-1">{risk.mitigation}</p>
                          <span className="inline-block text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded mt-2">
                            Owner: {risk.owner}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountPlanning;
